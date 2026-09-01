# Weave Backend Phase 1

Minimal knowledge loop:

Markdown/Text -> Document -> Version -> Chunks -> Embeddings -> PostgreSQL + pgvector -> search_knowledge()

## Setup

1. Install Docker Desktop.
2. Start PostgreSQL + pgvector from this directory:

```bash
docker compose up -d postgres
```

The schema in `sql/schema.sql` is applied automatically on the first database startup.

3. Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`:

```bash
cp .env.example .env
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

To check both the API process and database connection:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/ready
```

## Run API

```bash
uvicorn app.main:app --reload
```

The interactive API documentation is available at `http://localhost:8000/docs`.

## Upload original files

Uploaded files are stored under `FILE_STORAGE_DIR` (default: `backend/storage/`).
The database records the logical document, version, relative storage path, file
name, MIME type, byte size, and SHA-256 hash. This step only stores the original
file; parsing and vectorization will be added separately.

```bash
curl -F "file=@/path/to/file.docx" http://localhost:8000/documents/upload
```

To upload a new version of an existing document, use its document ID:

```bash
curl -F "file=@/path/to/updated.docx" \
  http://localhost:8000/documents/<document-id>/upload
```

Each upload is stored as `v1`, `v2`, `v3`, etc.; previous versions are never overwritten.
Uploading a file with the same name in the same workspace automatically creates a new
version of the existing document, so a modified local Markdown file can simply be uploaded again.

Metadata and text can also be edited in the system:

```bash
curl -X PUT http://localhost:8000/documents/<document-id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"Final plan"}'

curl -X PUT http://localhost:8000/documents/<document-id>/content \
  -H 'Content-Type: application/json' \
  -d '{"content":"Updated Markdown content"}'
```

Content edits create a new document version and never overwrite an earlier version.

The extraction layer supports Markdown/TXT, CSV/TSV, PDF, DOCX, XLSX/XLSM, and PPTX.
It is intentionally separate from storage; unsupported formats remain safely stored as originals.

Download the current original file:

```bash
curl -OJ http://localhost:8000/documents/<document-id>/file
```

List versions or download a specific historical file:

```bash
curl http://localhost:8000/documents/<document-id>/versions
curl -OJ http://localhost:8000/documents/<document-id>/versions/1/file
```

## Test the Loop

```bash
python scripts/test_ingest_search.py "../Personal Knowledge & Agent Platform.md" "Phase 1 Knowledge Foundation"
```
