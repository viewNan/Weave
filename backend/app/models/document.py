from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentCreate(BaseModel):
    title: str
    content: str
    document_type: str = "markdown"
    source_type: str = "local_file"
    source_url: str | None = None
    project_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentUpdate(BaseModel):
    title: str | None = None
    document_type: str | None = None
    source_url: str | None = None
    metadata: dict[str, Any] | None = None


class DocumentContentUpdate(BaseModel):
    content: str = Field(min_length=1)


class DocumentVersion(BaseModel):
    id: UUID
    document_id: UUID
    version_number: int
    content: str
    storage_path: str | None = None
    source_path: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class Document(BaseModel):
    id: UUID
    workspace_id: UUID
    owner_id: UUID
    project_id: UUID | None = None
    title: str
    document_type: str
    source_type: str
    source_url: str | None = None
    current_version_id: UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    current_version: DocumentVersion | None = None


class SearchRequest(BaseModel):
    query: str
    workspace_id: UUID | None = None
    project_id: UUID | None = None
    limit: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    document_id: UUID
    title: str
    content: str
    score: float
    source: dict[str, Any]


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
