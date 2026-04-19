"""FastAPI application for Savvy TTRPG assistant."""

import re
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, model_validator

from backend.chat import ask
from backend.ingest import DOCUMENTS_PATH, ingest_pdf, ingest_text, list_games

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Savvy", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

_GAME_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _validate_game_id(game_id: str) -> str:
    """Raise ValueError if game_id contains characters other than alphanumeric, hyphens, underscores."""
    if not _GAME_ID_RE.match(game_id):
        raise ValueError(
            f"Invalid game_id '{game_id}': only alphanumeric characters, hyphens, and underscores are allowed."
        )
    return game_id


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    game_ids: list[str]

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be empty or whitespace-only")
        if len(v) > 2000:
            raise ValueError("message must not exceed 2000 characters")
        return v

    @field_validator("game_ids")
    @classmethod
    def validate_game_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("game_ids must contain at least one entry")
        for gid in v:
            _validate_game_id(gid)
        return v


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/games")
def get_games():
    """Return list of indexed game system IDs from ChromaDB."""
    return {"games": list_games()}


@app.post("/chat")
def post_chat(request: ChatRequest):
    """Stream an SSE response for the given message scoped to selected games."""

    def event_stream():
        stream = ask(request.message, game_ids=request.game_ids, stream=True)
        for chunk in stream:
            if chunk.delta:
                yield f"data: {chunk.delta}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/ingest")
async def post_ingest(
    file: UploadFile,
    game_id: str = Form(...),
):
    """Accept a file upload and ingest it into the vector store for the given game."""
    # Validate game_id
    try:
        _validate_game_id(game_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Determine file type from content-type, fall back to extension
    content_type = (file.content_type or "").lower()
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()

    if content_type == "application/pdf" or (content_type in ("", "application/octet-stream") and ext == ".pdf"):
        file_type = "pdf"
    elif content_type.startswith("text/") or ext == ".txt":
        file_type = "text"
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type}' (extension: '{ext}'). Only PDF and plain-text files are accepted.",
        )

    # Save file to documents directory
    DOCUMENTS_PATH.mkdir(parents=True, exist_ok=True)
    dest = DOCUMENTS_PATH / filename
    dest.write_bytes(await file.read())

    # Ingest
    if file_type == "pdf":
        chunks = ingest_pdf(str(dest), game_id)
    else:
        chunks = ingest_text(str(dest), game_id)

    return {"chunks": chunks, "game_id": game_id}
