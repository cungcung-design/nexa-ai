from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.ai.embeddings import embed_query
from app.db.models import (
    Document,
    DocumentChunk,
    KnowledgeBase,
)


def retrieve_context(
    db: Session,
    organization_id: UUID,
    query: str,
    limit: int = 5,
) -> list[dict]:
    query_vector = embed_query(query)
    distance = DocumentChunk.embedding.cosine_distance(
        query_vector
    )
    rows = db.execute(
        select(
            DocumentChunk,
            Document.filename,
            distance.label("distance"),
        )
        .join(
            Document,
            (Document.id == DocumentChunk.document_id),
        )
        .join(
            KnowledgeBase,
            (KnowledgeBase.id == DocumentChunk.knowledge_base_id),
        )
        .where(
            DocumentChunk.organization_id == organization_id,
            Document.status == "READY",
        )
        .order_by(distance.asc())
        .limit(limit)
    ).all()

    results = []
    for chunk, filename, dist in rows:
        results.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "filename": filename,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "distance": float(dist),
            }
        )
    return results
