from fastapi import FastAPI
from app.db.session import get_connection

from app.api.documents import router as documents_router
from app.api.search import router as search_router

app = FastAPI(title="Weave Knowledge Backend", version="0.1.0")

app.include_router(documents_router)
app.include_router(search_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def readiness() -> dict[str, str]:
    with get_connection() as conn:
        conn.execute("select 1")
    return {"status": "ready", "database": "ok"}
