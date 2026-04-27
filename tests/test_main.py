"""Tests for the FastAPI application routes."""

import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /games
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# GET /models
# ---------------------------------------------------------------------------

class TestGetModels:
    def test_returns_model_list(self):
        response = client.get("/models")

        assert response.status_code == 200
        assert response.json() == {"models": ["mistral", "llama3.2"]}


class TestGetGames:
    def test_returns_game_list(self):
        with patch("backend.main.list_games", return_value=["dnd5e", "pathfinder"]):
            response = client.get("/games")

        assert response.status_code == 200
        assert response.json() == {"games": ["dnd5e", "pathfinder"]}

    def test_returns_empty_list_when_no_games(self):
        with patch("backend.main.list_games", return_value=[]):
            response = client.get("/games")

        assert response.status_code == 200
        assert response.json() == {"games": []}


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

class TestPostChat:
    def _mock_stream(self, tokens):
        """Build a list of mock token objects that stream_complete would yield."""
        chunks = []
        for token in tokens:
            chunk = MagicMock()
            chunk.delta = token
            chunks.append(chunk)
        return iter(chunks)

    def test_streams_sse_response(self):
        tokens = ["The ", "answer ", "is 42."]
        with patch("backend.main.ask", return_value=self._mock_stream(tokens)):
            response = client.post(
                "/chat",
                json={"message": "What is a critical hit?", "game_ids": ["dnd5e"]},
            )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        body = response.text
        assert "The " in body
        assert "answer " in body
        assert "is 42." in body

    def test_sse_lines_format(self):
        tokens = ["Hello"]
        with patch("backend.main.ask", return_value=self._mock_stream(tokens)):
            response = client.post(
                "/chat",
                json={"message": "Hi?", "game_ids": ["dnd5e"]},
            )

        # Each token must be wrapped in SSE "data: ...\n\n"
        assert "data: Hello\n\n" in response.text

    def test_sse_ends_with_done_event(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["Hi"])):
            response = client.post(
                "/chat",
                json={"message": "Hi?", "game_ids": ["dnd5e"]},
            )

        assert "data: [DONE]\n\n" in response.text

    def test_calls_ask_with_stream_true(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])) as mock_ask:
            client.post(
                "/chat",
                json={"message": "Hello?", "game_ids": ["dnd5e"]},
            )

        mock_ask.assert_called_once_with("Hello?", game_ids=["dnd5e"], stream=True, model="mistral", temperature=0.1)

    def test_passes_default_model_mistral(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])) as mock_ask:
            client.post(
                "/chat",
                json={"message": "Hello?", "game_ids": ["dnd5e"]},
            )

        _, kwargs = mock_ask.call_args
        assert kwargs["model"] == "mistral"

    def test_passes_specified_model_to_ask(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])) as mock_ask:
            client.post(
                "/chat",
                json={"message": "Hello?", "game_ids": ["dnd5e"], "model": "llama3.2"},
            )

        _, kwargs = mock_ask.call_args
        assert kwargs["model"] == "llama3.2"

    def test_rejects_invalid_model_name(self):
        response = client.post(
            "/chat",
            json={"message": "Hello?", "game_ids": ["dnd5e"], "model": "gpt-4"},
        )
        assert response.status_code == 422

    def test_passes_multiple_game_ids(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])) as mock_ask:
            client.post(
                "/chat",
                json={"message": "Hello?", "game_ids": ["dnd5e", "pathfinder"]},
            )

        _, kwargs = mock_ask.call_args
        assert kwargs["game_ids"] == ["dnd5e", "pathfinder"]

    # --- message sanitisation ---

    def test_rejects_empty_message(self):
        response = client.post(
            "/chat",
            json={"message": "", "game_ids": ["dnd5e"]},
        )
        assert response.status_code == 422

    def test_rejects_whitespace_only_message(self):
        response = client.post(
            "/chat",
            json={"message": "   ", "game_ids": ["dnd5e"]},
        )
        assert response.status_code == 422

    def test_rejects_message_over_2000_chars(self):
        response = client.post(
            "/chat",
            json={"message": "x" * 2001, "game_ids": ["dnd5e"]},
        )
        assert response.status_code == 422

    def test_accepts_message_at_2000_chars(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])):
            response = client.post(
                "/chat",
                json={"message": "x" * 2000, "game_ids": ["dnd5e"]},
            )
        assert response.status_code == 200

    def test_strips_whitespace_from_message(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])) as mock_ask:
            client.post(
                "/chat",
                json={"message": "  Hello?  ", "game_ids": ["dnd5e"]},
            )

        call_message = mock_ask.call_args[0][0]
        assert call_message == "Hello?"

    def test_rejects_invalid_game_id(self):
        response = client.post(
            "/chat",
            json={"message": "Hello?", "game_ids": ["dnd5e; DROP TABLE games"]},
        )
        assert response.status_code == 422

    def test_rejects_game_id_with_slash(self):
        response = client.post(
            "/chat",
            json={"message": "Hello?", "game_ids": ["../../etc/passwd"]},
        )
        assert response.status_code == 422

    def test_accepts_valid_game_id_formats(self):
        with patch("backend.main.ask", return_value=self._mock_stream(["ok"])):
            response = client.post(
                "/chat",
                json={"message": "Hello?", "game_ids": ["dnd-5e", "pathfinder_2e", "SR5"]},
            )
        assert response.status_code == 200

    def test_rejects_empty_game_ids_list(self):
        response = client.post(
            "/chat",
            json={"message": "Hello?", "game_ids": []},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

class TestPostIngest:
    def _pdf_upload(self, game_id="dnd5e", filename="rules.pdf"):
        return {
            "data": (None, game_id),
            "file": (filename, io.BytesIO(b"%PDF-1.4 fake pdf content"), "application/pdf"),
        }

    def test_ingest_pdf_returns_ingesting_status_and_game_id(self):
        with patch("backend.main.ingest_pdf", return_value=12) as mock_ingest, \
             patch("backend.main.DOCUMENTS_PATH") as mock_path:
            # Make the save path a no-op
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            response = client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("rules.pdf", io.BytesIO(b"%PDF-1.4 content"), "application/pdf")},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ingesting"
        assert body["game_id"] == "dnd5e"

    def test_ingest_text_file(self):
        with patch("backend.main.ingest_text", return_value=3) as mock_ingest, \
             patch("backend.main.DOCUMENTS_PATH") as mock_path:
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            response = client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("rules.txt", io.BytesIO(b"Some rules text"), "text/plain")},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ingesting"
        assert body["game_id"] == "dnd5e"

    def test_ingest_pdf_called_for_pdf_content_type(self):
        with patch("backend.main.ingest_pdf", return_value=5) as mock_pdf, \
             patch("backend.main.ingest_text") as mock_text, \
             patch("backend.main.DOCUMENTS_PATH") as mock_path:
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/pdf")},
            )

        mock_pdf.assert_called_once()
        mock_text.assert_not_called()

    def test_ingest_text_called_for_txt_content_type(self):
        with patch("backend.main.ingest_pdf") as mock_pdf, \
             patch("backend.main.ingest_text", return_value=1) as mock_text, \
             patch("backend.main.DOCUMENTS_PATH") as mock_path:
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("notes.txt", io.BytesIO(b"text content"), "text/plain")},
            )

        mock_text.assert_called_once()
        mock_pdf.assert_not_called()

    def test_ingest_falls_back_to_pdf_extension(self):
        """When content-type is octet-stream, fall back to file extension."""
        with patch("backend.main.ingest_pdf", return_value=7) as mock_pdf, \
             patch("backend.main.ingest_text") as mock_text, \
             patch("backend.main.DOCUMENTS_PATH") as mock_path:
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/octet-stream")},
            )

        mock_pdf.assert_called_once()

    def test_ingest_rejects_invalid_game_id(self):
        response = client.post(
            "/ingest",
            data={"game_id": "bad id!"},
            files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/pdf")},
        )
        assert response.status_code == 422

    def test_ingest_rejects_unsupported_file_type(self):
        with patch("backend.main.DOCUMENTS_PATH") as mock_path:
            mock_dest = MagicMock()
            mock_path.__truediv__ = MagicMock(return_value=mock_dest)

            response = client.post(
                "/ingest",
                data={"game_id": "dnd5e"},
                files={"file": ("rules.docx", io.BytesIO(b"docx content"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
            )

        assert response.status_code == 415

    def test_ingest_saves_file_to_documents_path(self):
        saved_paths = []

        with patch("backend.main.ingest_pdf", return_value=1), \
             patch("backend.main.DOCUMENTS_PATH", new_callable=lambda: lambda: MagicMock()) as mock_path:
            # Use tmp_path approach: just verify write_bytes is called
            import tempfile, pathlib
            with tempfile.TemporaryDirectory() as tmpdir:
                with patch("backend.main.DOCUMENTS_PATH", pathlib.Path(tmpdir)):
                    response = client.post(
                        "/ingest",
                        data={"game_id": "dnd5e"},
                        files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/pdf")},
                    )
                    dest = pathlib.Path(tmpdir) / "rules.pdf"
                    assert dest.exists()

        assert response.status_code == 200

    # --- path-traversal fix ---

    def test_path_traversal_filename_is_sanitised(self):
        """A filename like ../../evil.pdf must be saved inside DOCUMENTS_PATH, not outside."""
        import tempfile, pathlib

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_path = pathlib.Path(tmpdir) / "documents"
            docs_path.mkdir()

            with patch("backend.main.DOCUMENTS_PATH", docs_path), \
                 patch("backend.main.ingest_pdf", return_value=1):
                response = client.post(
                    "/ingest",
                    data={"game_id": "dnd5e"},
                    files={"file": ("../../evil.pdf", io.BytesIO(b"%PDF traversal"), "application/pdf")},
                )

            assert response.status_code == 200
            # The file must NOT escape DOCUMENTS_PATH (two levels up)
            evil_path = pathlib.Path(tmpdir) / "evil.pdf"
            assert not evil_path.exists(), "File must not escape DOCUMENTS_PATH"
            # The sanitised file must land inside documents dir
            inside_path = docs_path / "evil.pdf"
            assert inside_path.exists(), "Sanitised file must be saved inside DOCUMENTS_PATH"

    # --- background task ---

    def test_ingest_returns_immediately_with_ingesting_status(self):
        """The /ingest endpoint must return immediately with status='ingesting'."""
        import tempfile, pathlib

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_path = pathlib.Path(tmpdir) / "documents"
            docs_path.mkdir()

            with patch("backend.main.DOCUMENTS_PATH", docs_path), \
                 patch("backend.main.ingest_pdf", return_value=5):
                response = client.post(
                    "/ingest",
                    data={"game_id": "dnd5e"},
                    files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/pdf")},
                )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ingesting"
        assert body["game_id"] == "dnd5e"

    def test_ingest_calls_ingest_as_background_task(self):
        """ingest_pdf / ingest_text must be enqueued as a BackgroundTask, not called inline."""
        import tempfile, pathlib
        from fastapi.testclient import TestClient
        from fastapi import BackgroundTasks
        from backend.main import app

        captured_tasks = []

        # Intercept BackgroundTasks.add_task to capture what gets enqueued
        original_add_task = BackgroundTasks.add_task

        def spy_add_task(self, func, *args, **kwargs):
            captured_tasks.append((func, args, kwargs))
            original_add_task(self, func, *args, **kwargs)

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_path = pathlib.Path(tmpdir) / "documents"
            docs_path.mkdir()

            with patch("backend.main.DOCUMENTS_PATH", docs_path), \
                 patch("backend.main.ingest_pdf", return_value=5) as mock_pdf, \
                 patch.object(BackgroundTasks, "add_task", spy_add_task):
                response = client.post(
                    "/ingest",
                    data={"game_id": "dnd5e"},
                    files={"file": ("rules.pdf", io.BytesIO(b"%PDF content"), "application/pdf")},
                )

        assert response.status_code == 200
        # At least one background task must have been registered
        assert len(captured_tasks) >= 1, "ingest_pdf should be registered as a background task"
