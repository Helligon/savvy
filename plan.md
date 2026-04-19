# Plan

## Overview
I would like to create an AI assistant that you can talk to via text input and output. The main functionality of this app would be to assist tabletop RPG players and the GM.

The AI Assistant's name will be Savvy.

## Features: What can you ask Savvy to help you with?
**What do the rules say?** 
- You can ask the assistant to read a certain rule for you or give clarity about a rule that you're unsure about.

**Can you generate a character for me?**
- You can ask Savvy to generate a character for you and it will go through a standardised set of questions about the stats and backstory of your desired character.
- It will then generate a character sheet for your character with a small bio section describing the backstory.

## Risks
**Cost**
- Eliminate risk of high AI costs by hosting my own local AI model for this. My M5 chip macbook should easily be able to handle this.

**AI can be misused**
- The AI will need to have some security checks in place to avoid being misused or given misinformation

## Steps
This section will describe the plan for how the app will develop.

**Functionality**
1. Build a simple AI text assistant that can be asked questions as a command line tool (This should be a local AI model) 
2. Integrate retrieval-augmented generation so that supporting documents can be referenced efficiently

**UI**
1. Create a basic UI that the app can sit in - text input and output
2. A simple landing page/menu where you can choose which games and supporting documents to include

## Claude plan

```text
Savvy — TTRPG AI Assistant: Implementation Plan

     Context

     Building "Savvy", a local AI assistant for tabletop RPG players and GMs. The core needs are:
     - Rule lookups via RAG over uploaded game documents
     - Character sheet generation through a guided Q&A flow
     - No cloud AI costs — all inference runs locally via Ollama on an M5 MacBook

     Tech Stack

     ┌───────────────────┬──────────────────────────────────┬────────────────────────────────────────────────┐
     │       Layer       │              Choice              │                     Reason                     │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Language          │ Python                           │ Best AI/RAG ecosystem                          │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Local LLM         │ Ollama                           │ Easy Mac install, OpenAI-compatible API        │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ RAG orchestration │ LlamaIndex                       │ Clean document ingestion + retrieval pipeline  │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Vector store      │ ChromaDB                         │ Local, no external service, persists to disk   │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Document parsing  │ PyMuPDF (PDF), trafilatura (web) │ Robust, handles both formats                   │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Backend API       │ FastAPI                          │ Lightweight, async, pairs well with LlamaIndex │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ Frontend          │ Next.js (App Router) + React     │ UI + API routes in one project                 │
     ├───────────────────┼──────────────────────────────────┼────────────────────────────────────────────────┤
     │ PDF export        │ WeasyPrint                       │ HTML→PDF, lets you style sheets in CSS         │
     └───────────────────┴──────────────────────────────────┴────────────────────────────────────────────────┘

     Architecture Overview

     savvy/
     ├── backend/                  # Python / FastAPI
     │   ├── main.py               # FastAPI app + routes
     │   ├── chat.py               # Chat endpoint (RAG query → Ollama)
     │   ├── ingest.py             # Document ingestion pipeline
     │   ├── character.py          # Character generation flow
     │   └── data/
     │       ├── documents/        # Uploaded PDFs, text files
     │       └── chroma/           # Persisted vector store
     ├── frontend/                 # Next.js
     │   ├── app/
     │   │   ├── page.tsx          # Landing / game selector
     │   │   ├── chat/page.tsx     # Chat interface
     │   │   └── character/page.tsx # Character sheet display + PDF export
     └── cli.py                    # Phase 1 CLI entry point

     The frontend calls the FastAPI backend over HTTP. The backend talks to Ollama via its local REST API (default: http://localhost:11434).

     Implementation Steps

     Phase 1 — CLI + Core AI (do first)

     1. Set up Python project (pyproject.toml, venv)
     2. Confirm Ollama is running and a suitable model is pulled (e.g. llama3.2 or mistral)
     3. cli.py — basic REPL that sends messages to Ollama and prints responses
     4. ingest.py — document ingestion pipeline:
       - PDF → PyMuPDF → text chunks
       - Markdown/text → direct chunking
       - URL → trafilatura → text chunks
       - Embed with Ollama embedding model (nomic-embed-text) → store in ChromaDB
     5. Wire RAG into CLI: user query → retrieve relevant chunks → inject as context → Ollama

     Phase 2 — FastAPI Backend

     6. main.py — FastAPI app with routes:
       - POST /chat — RAG query, accepts {message, game_ids[]}
       - POST /ingest — upload and index a document
       - GET /games — list indexed game systems
     7. Security: basic input sanitisation, system prompt guardrails to prevent misuse

     Phase 3 — Next.js Frontend

     8. Landing page — list indexed game systems, toggle which to include in context, button to upload new documents
     9. Chat page — text input/output, streaming responses, shows which document chunks were cited

     Phase 4 — Character Generation

     10. character.py — multi-turn Q&A flow:
       - Ask standardised questions (name, race/species, class, ability scores, backstory prompts)
       - Collect answers, then ask Ollama to generate bio + fill sheet fields
       - Return structured CharacterSheet dataclass
     11. Add backend routes: POST /character/generate, GET /character/{id}/pdf
     12. Character page in frontend — guided form driving the generation flow, displays the finished sheet, "Download PDF" button

     Key Technical Decisions

     RAG context selection: User selects game systems on the landing page; only those systems' document chunks are queried. This keeps answers focused and avoids cross-game confusion.

     Streaming: Ollama supports streaming; pipe it through FastAPI SSE to the frontend for a better chat feel.

     Character PDF: Generate an HTML template server-side, run WeasyPrint → return as application/pdf. Style the sheet in CSS to match a character sheet aesthetic.

     Guardrails: System prompt instructs Savvy to only answer TTRPG-related questions and decline off-topic or harmful requests.

     Temperature: Use temperature: 0.1 for all rules/RAG queries to ensure deterministic, factual answers. Character generation can use a higher temperature (e.g. 0.7) where creative output is desirable. Pass
     temperature as a parameter to the Ollama API call so it can be varied per use-case.

     Verification

     - CLI: run python cli.py, ask a rule question, confirm RAG retrieves the right document chunk
     - Ingest: upload a PDF, query something from it, confirm the answer cites it
     - Character: complete the Q&A flow, inspect the output JSON, download the PDF
     - Frontend: npm run dev + uvicorn backend.main:app --reload, test full chat flow in browser
     - Guard rails: send an off-topic message, confirm Savvy declines gracefully
```