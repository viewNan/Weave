from pathlib import Path


def parse_text_file(path: str | Path) -> str:
    file_path = Path(path)
    if file_path.suffix.lower() not in {".md", ".markdown", ".txt"}:
        raise ValueError("Phase 1 supports only Markdown and plain text files.")
    return file_path.read_text(encoding="utf-8")
