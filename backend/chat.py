from llama_index.llms.ollama import Ollama

from backend.ingest import get_index

SYSTEM_PROMPT = (
    "You are Savvy, an assistant for tabletop RPG players and game masters. "
    "Answer questions using only the provided rules documents. "
    "If the answer is not in the documents, say so clearly. "
    "Decline to answer questions unrelated to tabletop RPGs."
)


def ask(question: str, game_ids: list[str], stream: bool = False):
    llm = Ollama(model="mistral", base_url="http://localhost:11434",
                 temperature=0.1, request_timeout=120.0)

    if not game_ids:
        raise ValueError("At least one game must be selected.")

    # Retrieve context from each selected game and combine
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
