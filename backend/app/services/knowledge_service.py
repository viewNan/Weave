"""Stable Knowledge Service tool contracts.

The agent-facing layer imports these functions instead of database repositories.
"""

from app.models.document import Document
from app.services.document_service import get_document, list_documents
from app.services.search_service import search_knowledge

__all__ = ["get_document", "list_documents", "search_knowledge", "Document"]
