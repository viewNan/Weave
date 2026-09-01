from uuid import UUID

from app.models.document import SearchResult
from app.services.retrieval_service import search_knowledge as hybrid_search


def search_knowledge(query: str, *, workspace_id: UUID | None = None,
                     project_id: UUID | None = None, limit: int = 5) -> list[SearchResult]:
    return [SearchResult(
        document_id=row["document_id"], title=row["title"], content=row["content"],
        score=float(row["score"]), source={
            "chunk_id": row["chunk_id"], "version_id": row["version_id"],
            "version_number": row["version_number"], "chunk_index": row["chunk_index"],
            "source_type": row["source_type"], "source_url": row["source_url"],
            "source_path": row["source_path"], "storage_path": row["storage_path"],
            "metadata": row["chunk_metadata"],
        }) for row in hybrid_search(query, workspace_id=workspace_id,
                                    project_id=project_id, limit=limit)]
