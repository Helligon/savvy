import os
from pathlib import Path

import chromadb
import fitz  # PyMuPDF
import trafilatura
from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

# nomic-embed-text context limit; ~4 chars/token → 800 chars ≈ 200 tokens, safely within limits
_CHUNK_CHARS = 800
_CHUNK_OVERLAP = 100

CHROMA_PATH = Path(__file__).parent / "data" / "chroma"
DOCUMENTS_PATH = Path(__file__).parent / "data" / "documents"


def _embedding_model() -> OllamaEmbedding:
    return OllamaEmbedding(model_name="nomic-embed-text", base_url="http://localhost:11434")


def _chroma_collection(game_id: str):
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return client.get_or_create_collection(game_id)


def get_index(game_id: str) -> VectorStoreIndex:
    Settings.embed_model = _embedding_model()
    collection = _chroma_collection(game_id)
    store = ChromaVectorStore(chroma_collection=collection)
    storage = StorageContext.from_defaults(vector_store=store)
    return VectorStoreIndex.from_vector_store(store, storage_context=storage)


def ingest_pdf(path: str, game_id: str, progress=None) -> int:
    path = str(Path(path).expanduser().resolve())
    doc = fitz.open(path)
    chunks = []
    for i, page in enumerate(doc):
        text = page.get_text().strip()
        if text:
            chunks.extend(_chunk_text(text, Path(path).name, page=i + 1))
        if progress:
            progress(i + 1, len(doc))
    _add_documents(chunks, game_id)
    return len(chunks)


def ingest_text(path: str, game_id: str) -> int:
    text = Path(path).expanduser().resolve().read_text(encoding="utf-8")
    chunks = _chunk_text(text, Path(path).name)
    _add_documents(chunks, game_id)
    return len(chunks)


def ingest_url(url: str, game_id: str) -> int:
    downloaded = trafilatura.fetch_url(url)
    text = trafilatura.extract(downloaded)
    if not text:
        raise ValueError(f"Could not extract text from {url}")
    chunks = _chunk_text(text, url)
    _add_documents(chunks, game_id)
    return len(chunks)


def list_games() -> list[str]:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return [c.name for c in client.list_collections()]


def _chunk_text(text: str, source: str, page: int | None = None) -> list[Document]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + _CHUNK_CHARS
        chunk = text[start:end].strip()
        if chunk:
            meta = {"source": source}
            if page is not None:
                meta["page"] = page
            chunks.append(Document(text=chunk, metadata=meta))
        start += _CHUNK_CHARS - _CHUNK_OVERLAP
    return chunks


def _add_documents(docs: list[Document], game_id: str) -> None:
    Settings.embed_model = _embedding_model()
    collection = _chroma_collection(game_id)
    store = ChromaVectorStore(chroma_collection=collection)
    storage = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(docs, storage_context=storage)
