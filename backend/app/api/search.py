from fastapi import APIRouter

from app.models.document import SearchRequest, SearchResponse
from app.services.search_service import search_knowledge

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def post_search(payload: SearchRequest) -> SearchResponse:
    results = search_knowledge(
        payload.query,
        workspace_id=payload.workspace_id,
        project_id=payload.project_id,
        limit=payload.limit,
    )
    return SearchResponse(query=payload.query, results=results)
