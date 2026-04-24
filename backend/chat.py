import os
from enum import Enum

from llama_index.llms.ollama import Ollama

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

from backend.ingest import get_index

SYSTEM_PROMPT = (
    "You are Savvy, an assistant for tabletop RPG players and game masters. "
    "Answer questions using only the provided rules documents. "
    "If the answer is not in the documents, say so clearly. "
    "Decline to answer questions unrelated to tabletop RPGs."
)


class SupportedModel(str, Enum):
    MISTRAL = "mistral"
    LLAMA = "llama3.2"


class QueryMode(str, Enum):
    RULES = "rules"          # temperature=0.1 — factual rules lookups
    ITEM_STATS = "item_stats"  # temperature=0.3 — stat generation for items/weapons/apparel
    CHARACTER = "character"  # temperature=0.7 — creative character generation


_TEMPERATURES: dict[QueryMode, float] = {
    QueryMode.RULES: 0.1,
    QueryMode.ITEM_STATS: 0.3,
    QueryMode.CHARACTER: 0.7,
}


def ask(question: str, game_ids: list[str], stream: bool = False, mode: QueryMode = QueryMode.RULES, model: SupportedModel = SupportedModel.MISTRAL):
    temperature = _TEMPERATURES[mode]
    llm = Ollama(model=model.value, base_url=OLLAMA_BASE_URL,
                 temperature=temperature, request_timeout=120.0)

    if not game_ids:
        raise ValueError("At least one game must be selected.")

    context_chunks: list[str] = []
    for game_id in game_ids:
        index = get_index(game_id)
        retriever = index.as_retriever(similarity_top_k=3)
        nodes = retriever.retrieve(question)
        for node in nodes:
            source = node.metadata.get("source", "unknown")
            context_chunks.append(f"[{source}]\n{node.get_content()}")

    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"{SYSTEM_PROMPT}\n\nContext:\n{context}\n\nQuestion: {question}"

    if stream:
        return llm.stream_complete(prompt)
    return llm.complete(prompt).text
