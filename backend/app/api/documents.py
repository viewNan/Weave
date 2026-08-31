from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.document import Document, DocumentCreate
from app.services.document_service import create_document, get_document, ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=Document)
def post_document(payload: DocumentCreate) -> Document:
    document = create_document(payload)
    ingest_document_chunks(document.id)
    return get_document(document.id) or document


@router.get("/{document_id}", response_model=Document)
def read_document(document_id: UUID) -> Document:
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def ingest_document_chunks(document_id: UUID) -> None:
    document = get_document(document_id)
    if document is None or document.current_version is None:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.db.session import get_connection
    from app.ingestion.chunker import chunk_text
    from app.ingestion.embedding import embed_texts
    from app.repositories.document_repository import DocumentRepository

    chunks = chunk_text(document.current_version.content)
    embeddings = embed_texts([chunk.content for chunk in chunks])
    rows = [
        {
            "content": chunk.content,
            "chunk_index": chunk.chunk_index,
            "metadata": chunk.metadata,
            "embedding": embedding,
        }
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        repo.insert_chunks(
            workspace_id=document.workspace_id,
            owner_id=document.owner_id,
            project_id=document.project_id,
            document_id=document.id,
            version_id=document.current_version.id,
            chunks=rows,
        )
