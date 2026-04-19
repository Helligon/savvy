import os
from pathlib import Path

import chromadb
import fitz  # PyMuPDF
import trafilatura
from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

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
            chunks.append(Document(text=text, metadata={"source": Path(path).name, "page": i + 1}))
        if progress:
            progress(i + 1, len(doc))
    _add_documents(chunks, game_id)
    return len(chunks)


def ingest_text(path: str, game_id: str) -> int:
    text = Path(path).expanduser().resolve().read_text(encoding="utf-8")
    chunks = [Document(text=text, metadata={"source": Path(path).name})]
    _add_documents(chunks, game_id)
    return len(chunks)


def ingest_url(url: str, game_id: str) -> int:
    downloaded = trafilatura.fetch_url(url)
    text = trafilatura.extract(downloaded)
    if not text:
        raise ValueError(f"Could not extract text from {url}")
    chunks = [Document(text=text, metadata={"source": url})]
    _add_documents(chunks, game_id)
    return len(chunks)


def list_games() -> list[str]:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return [c.name for c in client.list_collections()]


def _add_documents(docs: list[Document], game_id: str) -> None:
    Settings.embed_model = _embedding_model()
    collection = _chroma_collection(game_id)
    store = ChromaVectorStore(chroma_collection=collection)
    storage = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(docs, storage_context=storage)
