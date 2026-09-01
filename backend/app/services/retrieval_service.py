from typing import Any
from uuid import UUID

from app.core.config import get_settings
from app.db.session import get_connection
from app.ingestion.embedding import embed_texts, to_pgvector


def search_knowledge(query: str, *, workspace_id: UUID | None = None,
                     project_id: UUID | None = None, limit: int = 5) -> list[dict[str, Any]]:
    """Hybrid retrieval: metadata filter + PostgreSQL keyword + vector ranking."""
    settings = get_settings()
    workspace_id = workspace_id or settings.default_workspace_id
    vector = to_pgvector(embed_texts([query])[0])
    filters = ["c.workspace_id = %s", "v.id = d.current_version_id"]
    params: list[Any] = []
    if project_id:
        filters.append("c.project_id = %s")
        project_value = project_id
    else:
        project_value = None
    params.extend([query, vector, workspace_id])
    if project_id:
        params.append(project_value)
    params.extend([vector, limit])
    sql = f"""
        select c.document_id, d.title, c.content, c.id as chunk_id, c.version_id,
               v.version_number, c.chunk_index, c.metadata as chunk_metadata,
               v.source_path, v.storage_path, d.source_type, d.source_url,
               (0.35 * ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', %s))
                + 0.65 * (1 - (c.embedding <=> %s::vector))) as score
        from chunks c join documents d on d.id = c.document_id
        join document_versions v on v.id = c.version_id
        where {' and '.join(filters)}
        order by score desc limit %s
    """
    with get_connection() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]
