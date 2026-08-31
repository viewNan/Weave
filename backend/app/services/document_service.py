from pathlib import Path
from uuid import UUID

from app.core.config import get_settings
from app.db.session import get_connection
from app.ingestion.chunker import chunk_text
from app.ingestion.embedding import embed_texts
from app.ingestion.parser import parse_text_file
from app.models.document import Document, DocumentCreate
from app.repositories.document_repository import DocumentRepository


def create_document(payload: DocumentCreate) -> Document:
    settings = get_settings()
    workspace_id = settings.default_workspace_id
    owner_id = settings.default_owner_id
    project_id = payload.project_id or settings.default_project_id

    with get_connection() as conn:
        repo = DocumentRepository(conn)
        document = repo.create_document(
            workspace_id=workspace_id,
            owner_id=owner_id,
            project_id=project_id,
            title=payload.title,
            document_type=payload.document_type,
            source_type=payload.source_type,
            source_url=payload.source_url,
            metadata=payload.metadata,
        )
        version = repo.create_version(
            workspace_id=workspace_id,
            owner_id=owner_id,
            project_id=project_id,
            document_id=document["id"],
            content=payload.content,
            source_path=payload.source_url,
            metadata={"source_type": payload.source_type},
        )
        document["current_version_id"] = version["id"]
        document["current_version"] = version
        return Document.model_validate(document)


def get_document(document_id: UUID) -> Document | None:
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        document = repo.get_document(document_id)
        return Document.model_validate(document) if document else None


def ingest_document(path: str | Path, *, title: str | None = None, project_id: UUID | None = None) -> Document:
    file_path = Path(path)
    content = parse_text_file(file_path)
    document = create_document(
        DocumentCreate(
            title=title or file_path.stem,
            content=content,
            document_type="markdown" if file_path.suffix.lower() in {".md", ".markdown"} else "text",
            source_type="local_file",
            source_url=str(file_path),
            project_id=project_id,
            metadata={"filename": file_path.name},
        )
    )

    chunks = chunk_text(content)
    embeddings = embed_texts([chunk.content for chunk in chunks])
    chunk_rows = [
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
            version_id=document.current_version_id,
            chunks=chunk_rows,
        )

    return get_document(document.id) or document
