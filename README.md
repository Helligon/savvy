# Savvy

A local AI assistant for tabletop RPG players and game masters. Ask rules questions, get answers grounded in your own uploaded rulebooks — no cloud AI costs.

All inference runs locally via [Ollama](https://ollama.com) on your machine.

## Features

- **Rules lookup** — ask questions about any indexed game system; answers cite your uploaded documents
- **Document ingestion** — upload PDFs, text files, or scrape web URLs into a per-game vector store
- **Streaming chat** — responses stream token by token in the UI
- **Multi-game support** — index multiple game systems and toggle which ones are active per session

## Prerequisites

- [Ollama](https://ollama.com) installed and running
- Python 3.12
- Node.js (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- [Docker](https://www.docker.com) (optional, for running backend + frontend together)

Pull the required models:
```bash
ollama pull mistral
ollama pull nomic-embed-text
```

## Quick Start

### With Docker

```bash
ollama serve
docker compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### Without Docker

**Backend:**
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e .
ollama serve
uvicorn backend.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**CLI (dev tool):**
```bash
source .venv/bin/activate
python cli.py
```

## Usage

1. Open http://localhost:3000
2. Upload a rulebook PDF and give it a game ID (e.g. `savageworlds`)
3. Select the game and click **Start Chatting**
4. Ask rules questions — Savvy answers using only your uploaded documents

## Project Structure

```
backend/          # Python / FastAPI
  main.py         # API routes (GET /games, POST /chat, POST /ingest)
  chat.py         # RAG query pipeline → Ollama
  ingest.py       # Document ingestion (PDF, text, URL) → ChromaDB
  data/
    documents/    # Uploaded source files
    chroma/       # Persisted vector store

frontend/         # Next.js (App Router)
  app/
    page.tsx      # Landing page — game selector + document upload
    chat/         # Streaming chat interface

cli.py            # Interactive CLI (dev tool)
```

## Running Tests

**Backend:**
```bash
source .venv/bin/activate
pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm test -- --watchAll=false
```

## API

| Method | Endpoint  | Description |
|--------|-----------|-------------|
| GET    | `/games`  | List indexed game IDs |
| POST   | `/chat`   | Stream a rules answer (SSE) |
| POST   | `/ingest` | Upload and index a document |

### POST /chat
```json
{ "message": "What is a Wild Card?", "game_ids": ["savageworlds"] }
```

### POST /ingest
Multipart form: `file` (PDF or text) + `game_id` (alphanumeric, hyphens, underscores only)
