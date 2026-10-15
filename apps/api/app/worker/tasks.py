from io import BytesIO
from pathlib import Path
from uuid import UUID
from celery.exceptions import MaxRetriesExceededError
from pypdf import PdfReader
from sqlalchemy import select
from app.ai.chunking import split_text
from app.ai.embeddings import embed_texts
from app.core.config import settings
from app.db.models import Document, DocumentChunk
from app.db.session import SessionLocal
from app.worker.celery_app import celery_app


def extract_document_text(
    content: bytes,
    filename: str,
) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(BytesIO(content))
        return "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )
    return content.decode("utf-8")


@celery_app.task(
    bind=True,
    name="documents.process",
    max_retries=3,
)
def process_document(
    self,
    document_id: str,
    organization_id: str,
):
    document_uuid = UUID(document_id)
    organization_uuid = UUID(organization_id)
    db = SessionLocal()
    try:
        document = db.scalar(
            select(Document).where(
                Document.id == document_uuid,
                Document.organization_id == organization_uuid,
            )
        )
        if document is None:
            return {"status": "NOT_FOUND"}

        document.status = "PROCESSING"
        document.processing_attempts += 1
        db.commit()

        storage_root = Path(settings.document_storage_path)
        storage_path = storage_root / document.storage_key

        if not storage_path.exists():
            document.status = "FAILED"
            document.error_message = "Storage file not found"
            db.commit()
            return {"status": "FAILED", "error": "Storage file not found"}

        content = storage_path.read_bytes()
        text = extract_document_text(content, document.filename)

        if not text.strip():
            document.status = "FAILED"
            document.error_message = "No text content extracted from file"
            db.commit()
            return {"status": "FAILED", "error": "No text content extracted"}

        chunks = split_text(text)
        if not chunks:
            document.status = "FAILED"
            document.error_message = "No valid chunks generated"
            db.commit()
            return {"status": "FAILED", "error": "No valid chunks generated"}

        embeddings = embed_texts(chunks)

        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = DocumentChunk(
                organization_id=organization_uuid,
                knowledge_base_id=document.knowledge_base_id,
                document_id=document.id,
                chunk_index=i,
                content=chunk_text,
                embedding=embedding,
            )
            db.add(chunk)

        document.status = "READY"
        document.error_message = None
        db.commit()
        return {"status": "READY"}

    except Exception as exc:
        try:
            self.retry(exc=exc, countdown=60)
        except MaxRetriesExceededError:
            document = db.scalar(
                select(Document).where(
                    Document.id == document_uuid,
                    Document.organization_id == organization_uuid,
                )
            )
            if document:
                document.status = "FAILED"
                document.error_message = str(exc)
                db.commit()
            return {"status": "FAILED", "error": str(exc)}
    finally:
        db.close()