# Agent Team

This file describes the AI agent team responsible for developing Savvy. Each agent owns a specific domain and should be given tasks scoped to that area.

---

## Backend Agent

**Domain:** Python, FastAPI, LlamaIndex, ChromaDB, Ollama

**Responsibilities:**
- RAG pipeline (`ingest.py`) — document ingestion, chunking, embedding, vector storage
- Chat endpoint (`chat.py`) — query retrieval, context injection, Ollama calls
- Character generation flow (`character.py`) — Q&A loop, structured output, PDF generation
- FastAPI routes (`main.py`) — API design, request validation, SSE streaming
- Guardrails — system prompt, input sanitisation

**Key constraints:**
- Always pass `temperature=0.1` for rules queries, `temperature=0.7` for character generation
- RAG queries must be scoped to user-selected game systems only

---

## Frontend Agent

**Domain:** TypeScript, Next.js (App Router), React

**Responsibilities:**
- Landing page (`app/page.tsx`) — game system selector, document upload UI
- Chat page (`app/chat/page.tsx`) — streaming chat interface, source citation display
- Character page (`app/character/page.tsx`) — guided generation form, sheet display, PDF download

**Key constraints:**
- Use named exports and explicit TypeScript types throughout
- All backend calls go to the FastAPI server (default `http://localhost:8000`)

---

## RAG & AI Agent

**Domain:** LlamaIndex, ChromaDB, Ollama, document parsing

**Responsibilities:**
- Designing and tuning the ingestion pipeline for PDFs, markdown, and web URLs
- Embedding model selection and configuration (`nomic-embed-text` via Ollama)
- Retrieval tuning — chunk size, overlap, top-k, similarity threshold
- Evaluating answer quality against source documents

---

## Architect / Orchestrator

**Domain:** Full stack, system design

**Responsibilities:**
- Ensuring the backend and frontend interfaces stay in sync
- Deciding on data structures shared across agents (e.g. `CharacterSheet`, API response shapes)
- Reviewing cross-cutting concerns: security, streaming, error handling, performance
