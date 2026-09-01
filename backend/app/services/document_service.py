from pathlib import Path
import hashlib
import shutil
from uuid import UUID

from app.core.config import get_settings
from app.db.session import get_connection
from app.ingestion.chunker import chunk_text
from app.ingestion.embedding import embed_texts
from app.ingestion.parser import parse_text_file
from app.models.document import Document, DocumentCreate, DocumentContentUpdate, DocumentUpdate
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


def store_uploaded_file(*, filename: str, content: bytes, content_type: str | None) -> Document:
    settings = get_settings()
    safe_name = Path(filename).name or "uploaded-file"
    with get_connection() as conn:
        existing = DocumentRepository(conn).find_document_by_title(
            workspace_id=settings.default_workspace_id, title=safe_name
        )
    if existing:
        return store_new_file_version(
            document_id=existing["id"], filename=safe_name, content=content,
            content_type=content_type,
        )
    digest = hashlib.sha256(content).hexdigest()
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        document = repo.create_document(
            workspace_id=settings.default_workspace_id, owner_id=settings.default_owner_id,
            project_id=settings.default_project_id, title=safe_name,
            document_type=content_type or "application/octet-stream", source_type="upload",
            source_url=None, metadata={"filename": safe_name, "mime_type": content_type,
                                       "size_bytes": len(content), "sha256": digest},
        )
        relative_path = Path(str(document["id"])) / "v1" / safe_name
        target = Path(settings.file_storage_dir) / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        try:
            version = repo.create_version(
                workspace_id=settings.default_workspace_id, owner_id=settings.default_owner_id,
                project_id=settings.default_project_id, document_id=document["id"], content="",
                storage_path=str(relative_path), source_path=None,
                metadata={"filename": safe_name, "mime_type": content_type,
                          "size_bytes": len(content), "sha256": digest},
            )
        except Exception:
            shutil.rmtree(target.parent.parent, ignore_errors=True)
            raise
        document["current_version_id"] = version["id"]
        document["current_version"] = version
        return Document.model_validate(document)


def store_new_file_version(*, document_id: UUID, filename: str, content: bytes,
                           content_type: str | None) -> Document:
    settings = get_settings()
    safe_name = Path(filename).name or "uploaded-file"
    digest = hashlib.sha256(content).hexdigest()
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        document = repo.get_document(document_id)
        if document is None:
            raise FileNotFoundError("Document not found")
        current = document.get("current_version")
        next_version = int(current["version_number"]) + 1 if current else 1
        relative_path = Path(str(document_id)) / f"v{next_version}" / safe_name
        target = Path(settings.file_storage_dir) / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        try:
            version = repo.create_version(
                workspace_id=document["workspace_id"], owner_id=document["owner_id"],
                project_id=document["project_id"], document_id=document_id, content="",
                storage_path=str(relative_path), source_path=None,
                metadata={"filename": safe_name, "mime_type": content_type,
                          "size_bytes": len(content), "sha256": digest},
            )
        except Exception:
            shutil.rmtree(target.parent, ignore_errors=True)
            raise
        conn.execute("update documents set current_version_id = %s where id = %s",
                     (version["id"], document_id))
    return get_document(document_id) or Document.model_validate(document)


def update_document_metadata(document_id: UUID, payload: DocumentUpdate) -> Document:
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        if repo.get_document(document_id) is None:
            raise FileNotFoundError("Document not found")
        fields = payload.model_dump(exclude_unset=True)
        if fields.get("metadata") is not None:
            fields["metadata"] = fields["metadata"]
        repo.update_document(document_id, fields)
    return get_document(document_id) or Document.model_validate(repo.get_document(document_id))


def update_document_content(document_id: UUID, payload: DocumentContentUpdate) -> Document:
    with get_connection() as conn:
        repo = DocumentRepository(conn)
        document = repo.get_document(document_id)
        if document is None:
            raise FileNotFoundError("Document not found")
        version = repo.create_version(
            workspace_id=document["workspace_id"], owner_id=document["owner_id"],
            project_id=document["project_id"], document_id=document_id,
            content=payload.content, storage_path=None, source_path=None,
            metadata={"edited_in_system": True},
        )
        document["current_version_id"] = version["id"]
        document["current_version"] = version
    return get_document(document_id) or Document.model_validate(document)


def list_documents(limit: int = 50) -> list[Document]:
    settings = get_settings()
    with get_connection() as conn:
        rows = DocumentRepository(conn).list_documents(
            workspace_id=settings.default_workspace_id, limit=limit
        )
    return [Document.model_validate(row) for row in rows]


def list_document_versions(document_id: UUID) -> list[dict]:
    with get_connection() as conn:
        if DocumentRepository(conn).get_document(document_id) is None:
            raise FileNotFoundError("Document not found")
        return DocumentRepository(conn).list_versions(document_id)


def ingest_document_chunks(document: Document) -> None:
    if document.current_version is None:
        return
    chunks = chunk_text(document.current_version.content)
    embeddings = embed_texts([chunk.content for chunk in chunks])
    rows = [
        {"content": chunk.content, "chunk_index": chunk.chunk_index,
         "metadata": chunk.metadata, "embedding": embedding}
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]
    with get_connection() as conn:
        DocumentRepository(conn).insert_chunks(
            workspace_id=document.workspace_id, owner_id=document.owner_id,
            project_id=document.project_id, document_id=document.id,
            version_id=document.current_version.id, chunks=rows,
        )


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

    ingest_document_chunks(document)

    return get_document(document.id) or document
