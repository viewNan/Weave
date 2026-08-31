from openai import OpenAI

from app.core.config import get_settings


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


def to_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"
