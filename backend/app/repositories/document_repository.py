from typing import Any
from uuid import UUID, uuid4

from psycopg import Connection
from psycopg.types.json import Jsonb

from app.ingestion.embedding import to_pgvector


class DocumentRepository:
    def __init__(self, conn: Connection):
        self.conn = conn

    def create_document(
        self,
        *,
        workspace_id: UUID,
        owner_id: UUID,
        project_id: UUID | None,
        title: str,
        document_type: str,
        source_type: str,
        source_url: str | None,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        document_id = uuid4()
        row = self.conn.execute(
            """
            insert into documents (
                id, workspace_id, owner_id, project_id, title, document_type,
                source_type, source_url, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (
                document_id,
                workspace_id,
                owner_id,
                project_id,
                title,
                document_type,
                source_type,
                source_url,
                Jsonb(metadata),
            ),
        ).fetchone()
        return dict(row)

    def create_version(
        self,
        *,
        workspace_id: UUID,
        owner_id: UUID,
        project_id: UUID | None,
        document_id: UUID,
        content: str,
        storage_path: str | None = None,
        source_path: str | None = None,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        version_number = self.next_version_number(document_id)
        version_id = uuid4()
        row = self.conn.execute(
            """
            insert into document_versions (
                id, workspace_id, owner_id, project_id, document_id,
                version_number, content, storage_path, source_path, metadata
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning *
            """,
            (
                version_id,
                workspace_id,
                owner_id,
                project_id,
                document_id,
                version_number,
                content,
                storage_path,
                source_path,
                Jsonb(metadata),
            ),
        ).fetchone()
        self.conn.execute(
            "update documents set current_version_id = %s where id = %s",
            (version_id, document_id),
        )
        return dict(row)

    def next_version_number(self, document_id: UUID) -> int:
        row = self.conn.execute(
            "select coalesce(max(version_number), 0) + 1 as version_number from document_versions where document_id = %s",
            (document_id,),
        ).fetchone()
        return int(row["version_number"])

    def insert_chunks(
        self,
        *,
        workspace_id: UUID,
        owner_id: UUID,
        project_id: UUID | None,
        document_id: UUID,
        version_id: UUID,
        chunks: list[dict[str, Any]],
    ) -> None:
        for chunk in chunks:
            self.conn.execute(
                """
                insert into chunks (
                    id, workspace_id, owner_id, project_id, document_id,
                    version_id, content, embedding, chunk_index, metadata
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s::vector, %s, %s)
                """,
                (
                    uuid4(),
                    workspace_id,
                    owner_id,
                    project_id,
                    document_id,
                    version_id,
                    chunk["content"],
                    to_pgvector(chunk["embedding"]),
                    chunk["chunk_index"],
                    Jsonb(chunk["metadata"]),
                ),
            )

    def get_document(self, document_id: UUID) -> dict[str, Any] | None:
        document = self.conn.execute(
            "select * from documents where id = %s",
            (document_id,),
        ).fetchone()
        if document is None:
            return None

        version = None
        if document["current_version_id"] is not None:
            version = self.conn.execute(
                "select * from document_versions where id = %s",
                (document["current_version_id"],),
            ).fetchone()

        result = dict(document)
        result["current_version"] = dict(version) if version else None
        return result

    def update_document(self, document_id: UUID, fields: dict[str, Any]) -> None:
        if not fields:
            return
        assignments = ", ".join(f"{key} = %s" for key in fields)
        self.conn.execute(
            f"update documents set {assignments} where id = %s",
            [*fields.values(), document_id],
        )

    def find_document_by_title(self, *, workspace_id: UUID, title: str) -> dict[str, Any] | None:
        row = self.conn.execute(
            "select id from documents where workspace_id = %s and title = %s order by updated_at desc limit 1",
            (workspace_id, title),
        ).fetchone()
        return dict(row) if row else None

    def list_versions(self, document_id: UUID) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "select * from document_versions where document_id = %s order by version_number desc",
            (document_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_documents(self, *, workspace_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            select d.*, v.version_number, v.content, v.storage_path, v.source_path,
                   v.metadata as version_metadata, v.created_at as version_created_at
            from documents d
            left join document_versions v on v.id = d.current_version_id
            where d.workspace_id = %s
            order by d.updated_at desc
            limit %s
            """,
            (workspace_id, limit),
        ).fetchall()
        documents = []
        for row in rows:
            item = dict(row)
            if item["current_version_id"] is not None:
                item["current_version"] = {
                    "id": item["current_version_id"],
                    "document_id": item["id"],
                    "version_number": item.pop("version_number"),
                    "content": item.pop("content"),
                    "storage_path": item.pop("storage_path"),
                    "source_path": item.pop("source_path"),
                    "metadata": item.pop("version_metadata"),
                    "created_at": item.pop("version_created_at"),
                }
            else:
                item["current_version"] = None
            documents.append(item)
        return documents

    def search_chunks(
        self,
        *,
        workspace_id: UUID,
        project_id: UUID | None,
        query_embedding: list[float],
        limit: int,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [to_pgvector(query_embedding), workspace_id]
        project_filter = ""
        if project_id is not None:
            project_filter = "and c.project_id = %s"
            params.append(project_id)
        params.append(limit)

        rows = self.conn.execute(
            f"""
            select
                c.document_id,
                d.title,
                c.content,
                1 - (c.embedding <=> %s::vector) as score,
                c.id as chunk_id,
                c.version_id,
                v.version_number,
                c.chunk_index,
                c.metadata as chunk_metadata,
                v.source_path,
                d.source_type,
                d.source_url
            from chunks c
            join documents d on d.id = c.document_id
            join document_versions v on v.id = c.version_id
            where c.workspace_id = %s
            {project_filter}
            order by c.embedding <=> %s::vector
            limit %s
            """,
            [params[0], *params[1:-1], params[0], params[-1]],
        ).fetchall()
        return [dict(row) for row in rows]
