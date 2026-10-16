from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from pypdf import PdfReader
from app.db.session import get_db
from app.db.models import User, KnowledgeBase, Document, DocumentChunk
from app.modules.auth.dependencies import get_current_user
from app.modules.organizations.router import require_membership
from app.ai.embeddings import embed_query
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    DocumentResponse,
    SearchRequest,
    SearchResult,
)
from app.core.config import settings
from app.worker.tasks import process_document

router = APIRouter(
    prefix="/api/v1/organizations/{organization_id}/knowledge",
    tags=["Knowledge"],
)

UPLOAD_ROLES = {"OWNER", "ADMIN", "DEVELOPER"}
MAX_FILE_BYTES = 5 * 1024 * 1024


def require_upload_role(membership) -> None:
    if membership.role.value not in UPLOAD_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to upload documents",
        )


def get_knowledge_base(db: Session, organization_id: UUID, kb_id: UUID):
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.id == kb_id, KnowledgeBase.organization_id == organization_id)
        .first()
    )
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found",
        )
    return kb


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    organization_id: UUID,
    request: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_upload_role(membership)

    kb = KnowledgeBase(organization_id=organization_id, name=request.name)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return kb


@router.get("", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    organization_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    kbs = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.organization_id == organization_id)
        .order_by(KnowledgeBase.created_at.desc())
        .all()
    )
    return kbs


@router.post("/{kb_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    organization_id: UUID,
    kb_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    print("=== UPLOAD_DOCUMENT CALLED ===")
    membership = require_membership(db, current_user.id, organization_id)
    require_upload_role(membership)

    get_knowledge_base(db, organization_id, kb_id)

    raw = await file.read(MAX_FILE_BYTES + 1)
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 5 MB limit",
        )

    filename = (file.filename or "document")[:255]
    is_pdf = raw.startswith(b"%PDF-")
    is_txt = filename.lower().endswith((".txt", ".md"))
    if not is_pdf and not is_txt:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, TXT, and MD files are supported",
        )

    if is_txt:
        try:
            raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Text file must be UTF-8",
            )

    storage_root = Path(settings.document_storage_path)
    storage_root.mkdir(parents=True, exist_ok=True)

    storage_key = (
        f"{uuid4()}.pdf"
        if is_pdf
        else f"{uuid4()}.txt"
    )
    storage_path = storage_root / storage_key
    storage_path.write_bytes(raw)

    doc = Document(
        organization_id=organization_id,
        knowledge_base_id=kb_id,
        filename=filename,
        status="PENDING",
        storage_key=storage_key,
        processing_attempts=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    print(f"=== DOC CREATED: {doc.id}, status={doc.status} ===")

    try:
        process_document.delay(str(doc.id), str(organization_id))
        print("=== TASK QUEUED ===")
    except Exception as exc:
        print(f"=== TASK QUEUE FAILED: {exc} ===")

    return doc


@router.delete("/{kb_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_endpoint(
    organization_id: UUID,
    kb_id: UUID,
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = require_membership(db, current_user.id, organization_id)
    require_upload_role(membership)

    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.knowledge_base_id == kb_id,
            Document.organization_id == organization_id,
        )
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if document.storage_key:
        storage_path = Path(settings.document_storage_path) / document.storage_key
        if storage_path.exists():
            try:
                storage_path.unlink()
            except OSError:
                pass

    db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    db.delete(document)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{kb_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    organization_id: UUID,
    kb_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    docs = (
        db.query(Document)
        .filter(Document.knowledge_base_id == kb_id, Document.organization_id == organization_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return docs


@router.get("/{kb_id}/documents/{document_id}", response_model=DocumentResponse)
def get_document_status(
    organization_id: UUID,
    kb_id: UUID,
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)
    get_knowledge_base(db, organization_id, kb_id)

    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == organization_id,
            Document.knowledge_base_id == kb_id,
        )
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


@router.post("/{kb_id}/search", response_model=list[SearchResult])
def search_knowledge(
    organization_id: UUID,
    kb_id: UUID,
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_membership(db, current_user.id, organization_id)

    get_knowledge_base(db, organization_id, kb_id)

    query_embedding = embed_query(request.query)
    embedding_str = "[" + ",".join(
        str(v) for v in query_embedding
    ) + "]"

    from sqlalchemy import text
    query = text("""
        SELECT dc.id, dc.document_id, d.filename, dc.content,
               1 - (dc.embedding <=> CAST(:embedding AS vector)) as score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.organization_id = :org_id
          AND dc.knowledge_base_id = :kb_id
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :limit
    """)

    results = db.execute(
        query,
        {"org_id": str(organization_id), "kb_id": str(kb_id), "embedding": embedding_str, "limit": request.limit}
    ).fetchall()

    return [
        SearchResult(
            id=row.id,
            document_id=row.document_id,
            filename=row.filename,
            content=row.content,
            score=float(row.score),
        )
        for row in results
    ]