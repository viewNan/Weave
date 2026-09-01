from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.db.session import get_connection
from app.models.document import Document, DocumentContentUpdate, DocumentCreate, DocumentUpdate
from app.services.document_service import (create_document, get_document, ingest_document_chunks,
                                            list_documents, store_new_file_version, store_uploaded_file,
                                            update_document_content, update_document_metadata,
                                            list_document_versions)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=Document)
async def upload_document(file: UploadFile = File(...)) -> Document:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    return store_uploaded_file(filename=file.filename or "uploaded-file", content=content, content_type=file.content_type)


@router.post("/{document_id}/upload", response_model=Document)
async def upload_document_version(document_id: UUID, file: UploadFile = File(...)) -> Document:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        return store_new_file_version(
            document_id=document_id, filename=file.filename or "uploaded-file",
            content=content, content_type=file.content_type,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("", response_model=Document)
def post_document(payload: DocumentCreate) -> Document:
    document = create_document(payload)
    ingest_document_chunks(document)
    return get_document(document.id) or document


@router.get("", response_model=list[Document])
def read_documents(limit: int = 50) -> list[Document]:
    return list_documents(limit=max(1, min(limit, 100)))


@router.get("/{document_id}", response_model=Document)
def read_document(document_id: UUID) -> Document:
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("/{document_id}/file")
def download_document_file(document_id: UUID) -> FileResponse:
    document = get_document(document_id)
    if document is None or document.current_version is None or not document.current_version.storage_path:
        raise HTTPException(status_code=404, detail="Original file not found")
    root = Path(get_settings().file_storage_dir).resolve()
    target = (root / document.current_version.storage_path).resolve()
    if root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Original file not found")
    filename = document.current_version.metadata.get("filename", target.name)
    return FileResponse(target, filename=filename, media_type=document.current_version.metadata.get("mime_type"))


@router.get("/{document_id}/versions")
def read_document_versions(document_id: UUID) -> list[dict]:
    try:
        return list_document_versions(document_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{document_id}/versions/{version_number}/file")
def download_document_version(document_id: UUID, version_number: int) -> FileResponse:
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    settings = get_settings()
    with get_connection() as conn:
        row = conn.execute(
            "select storage_path, metadata from document_versions where document_id = %s and version_number = %s",
            (document_id, version_number),
        ).fetchone()
    if row is None or not row["storage_path"]:
        raise HTTPException(status_code=404, detail="Original file not found for this version")
    root = Path(settings.file_storage_dir).resolve()
    target = (root / row["storage_path"]).resolve()
    if root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Original file not found for this version")
    metadata = row["metadata"] or {}
    return FileResponse(target, filename=metadata.get("filename", target.name), media_type=metadata.get("mime_type"))


@router.put("/{document_id}", response_model=Document)
def update_document(document_id: UUID, payload: DocumentUpdate) -> Document:
    try:
        return update_document_metadata(document_id, payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{document_id}/content", response_model=Document)
def update_content(document_id: UUID, payload: DocumentContentUpdate) -> Document:
    try:
        return update_document_content(document_id, payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
