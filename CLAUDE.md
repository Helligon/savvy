# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Project

Savvy is a local AI assistant for tabletop RPG players and GMs. It can look up rules from uploaded game documents (via RAG) and generate character sheets through a guided Q&A flow. All inference runs locally via Ollama — no cloud AI costs.

---

## Tech Stack

- **Language:** Python 3.12 (backend), TypeScript 5.x (frontend)
- **Local LLM:** Ollama (`mistral` + `nomic-embed-text` for embeddings)
- **RAG:** LlamaIndex + ChromaDB (persisted locally)
- **Backend:** FastAPI
- **Frontend:** Next.js (App Router) + React
- **Document parsing:** PyMuPDF (PDF), trafilatura (web URLs)
- **PDF export:** WeasyPrint (HTML → PDF)

---

## Project Structure

```
backend/
  main.py         # FastAPI app and routes
  chat.py         # RAG query → Ollama
  ingest.py       # Document ingestion pipeline (PDF, text, URL)
  character.py    # Character generation Q&A flow
  data/
    documents/    # Uploaded source documents
    chroma/       # Persisted vector store

frontend/
  app/
    page.tsx              # Landing page — game system selector + document upload
    chat/page.tsx         # Chat interface
    character/page.tsx    # Character sheet display + PDF download

cli.py            # CLI entry point (Phase 1 dev tool)
```

---

## Commands

```bash
# Backend (from repo root)
uvicorn backend.main:app --reload

# Frontend (from frontend/)
npm run dev
npm run build

# CLI
python cli.py

# Tests (from repo root)
.venv/bin/pytest tests/ -v
```

Ollama must be running before starting the backend: `ollama serve`

---

## Workflow

1. Create feature branch from `main` and name it with using the following example pattern: `<phase>/ <message>`
2. Write tests first (follow TDD process)
3. Implement feature
4. Open PR with description

---

## Key Behaviours

**Temperature:** Use `temperature=0.1` for all rules/RAG queries (deterministic). Use `temperature=0.7` for character generation (creative). Pass temperature explicitly to every Ollama API call.

**RAG scoping:** Queries are scoped to the game systems the user has selected on the landing page. Never query across all documents by default.

**Guardrails:** The system prompt instructs Savvy to answer TTRPG-related questions only and decline off-topic or harmful requests.

---

## Boundaries

✅ **Always:**
- Run tests before committing

⚠️ **Ask first:**
- Changes to the document ingestion pipeline (`ingest.py`) — affects the ChromaDB schema
- Modifying the character sheet data structure in `character.py` — impacts PDF template and frontend rendering

🚫 **Never:**
- Query Ollama without an explicit temperature value
- Default to querying all indexed documents — always scope to selected game systems

---

## Known Gotchas
_Add lessons learned here as you encounter them_
