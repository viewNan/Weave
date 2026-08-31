import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.services.document_service import ingest_document  # noqa: E402
from app.services.search_service import search_knowledge  # noqa: E402


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python scripts/test_ingest_search.py <markdown-or-text-path> <query>")
        raise SystemExit(2)

    path = Path(sys.argv[1]).resolve()
    query = sys.argv[2]

    document = ingest_document(path)
    results = search_knowledge(query, limit=3)

    print(f"Imported document: {document.title} ({document.id})")
    print(f"Query: {query}")
    print()

    if not results:
        print("No results returned.")
        raise SystemExit(1)

    top = results[0]
    print("Top result")
    print(f"- document_id: {top.document_id}")
    print(f"- title: {top.title}")
    print(f"- score: {top.score:.4f}")
    print(f"- version_id: {top.source['version_id']}")
    print(f"- version_number: {top.source['version_number']}")
    print(f"- chunk_index: {top.source['chunk_index']}")
    print(f"- source_path: {top.source['source_path']}")
    print()
    print(top.content[:800])


if __name__ == "__main__":
    main()
