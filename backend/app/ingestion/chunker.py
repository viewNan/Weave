from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    content: str
    chunk_index: int
    metadata: dict


def chunk_text(content: str, max_chars: int = 1200, overlap: int = 150) -> list[TextChunk]:
    normalized = content.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    chunks: list[TextChunk] = []
    start = 0

    while start < len(normalized):
        end = min(start + max_chars, len(normalized))
        window = normalized[start:end]

        if end < len(normalized):
            split_at = max(window.rfind("\n\n"), window.rfind("\n"), window.rfind("。"))
            if split_at > max_chars * 0.5:
                end = start + split_at + 1
                window = normalized[start:end]

        chunk_content = window.strip()
        if chunk_content:
            chunks.append(
                TextChunk(
                    content=chunk_content,
                    chunk_index=len(chunks),
                    metadata={"start_char": start, "end_char": end},
                )
            )

        if end >= len(normalized):
            break
        start = max(end - overlap, start + 1)

    return chunks
