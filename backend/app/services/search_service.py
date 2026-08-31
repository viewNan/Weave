from uuid import UUID

from app.core.config import get_settings
from app.db.session import get_connection
from app.ingestion.embedding import embed_texts
from app.models.document import SearchResult
from app.repositories.document_repository import DocumentRepository


def search_knowledge(
    query: str,
    *,
    workspace_id: UUID | None = None,
    project_id: UUID | None = None,
    limit: int = 5,
) -> list[SearchResult]:
    settings = get_settings()
    query_embedding = embed_texts([query])[0]

    with get_connection() as conn:
        repo = DocumentRepository(conn)
        rows = repo.search_chunks(
            workspace_id=workspace_id or settings.default_workspace_id,
            project_id=project_id,
            query_embedding=query_embedding,
            limit=limit,
        )

    return [
        SearchResult(
            document_id=row["document_id"],
            title=row["title"],
            content=row["content"],
            score=float(row["score"]),
            source={
                "chunk_id": row["chunk_id"],
                "version_id": row["version_id"],
                "version_number": row["version_number"],
                "chunk_index": row["chunk_index"],
                "source_type": row["source_type"],
                "source_url": row["source_url"],
                "source_path": row["source_path"],
                "metadata": row["chunk_metadata"],
            },
        )
        for row in rows
    ]
