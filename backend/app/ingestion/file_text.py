from pathlib import Path


def extract_text(path: str | Path, content_type: str | None = None) -> str:
    file_path = Path(path)
    suffix = file_path.suffix.lower()
    if suffix in {".md", ".markdown", ".txt", ".csv", ".tsv"}:
        return file_path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".pdf":
        from pypdf import PdfReader
        return "\n\n".join(page.extract_text() or "" for page in PdfReader(file_path).pages)
    if suffix == ".docx":
        from docx import Document
        doc = Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)
    if suffix in {".xlsx", ".xlsm"}:
        from openpyxl import load_workbook
        workbook = load_workbook(file_path, read_only=True, data_only=True)
        sheets = []
        for sheet in workbook.worksheets:
            rows = ["\t".join("" if value is None else str(value) for value in row)
                    for row in sheet.iter_rows(values_only=True)]
            sheets.append(f"## {sheet.title}\n" + "\n".join(rows))
        return "\n\n".join(sheets)
    if suffix == ".pptx":
        from pptx import Presentation
        presentation = Presentation(file_path)
        return "\n\n".join(
            "\n".join(shape.text for shape in slide.shapes if hasattr(shape, "text"))
            for slide in presentation.slides
        )
    raise ValueError(f"Text extraction is not supported for {suffix or content_type or 'this file type'}.")
