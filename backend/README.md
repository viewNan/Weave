# Weave Backend Phase 1

Minimal knowledge loop:

Markdown/Text -> Document -> Version -> Chunks -> Embeddings -> PostgreSQL + pgvector -> search_knowledge()

## Setup

1. Create a PostgreSQL database with pgvector enabled.
2. Run `sql/schema.sql`.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `OPENAI_API_KEY`.
4. Install dependencies:

```bash
pip install -r requirements.txt
```

## Run API

```bash
uvicorn app.main:app --reload
```

## Test the Loop

```bash
python scripts/test_ingest_search.py "../Personal Knowledge & Agent Platform.md" "Phase 1 Knowledge Foundation"
```
