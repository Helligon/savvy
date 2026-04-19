"""Tests for tilde (~) path expansion in ingest functions."""

from pathlib import Path
from unittest.mock import patch


class TestTildeExpansion:
    def test_ingest_pdf_expands_tilde(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.ingest.CHROMA_PATH", tmp_path / "chroma")

        mock_page = __import__("unittest.mock", fromlist=["MagicMock"]).MagicMock()
        mock_page.get_text.return_value = "Some rules."

        home = Path.home()
        tilde_path = "~/rules.pdf"
        expected_path = str((home / "rules.pdf").resolve())

        with patch("fitz.open", return_value=[mock_page]) as mock_fitz, \
             patch("backend.ingest._add_documents"):
            from backend.ingest import ingest_pdf
            ingest_pdf(tilde_path, "dnd5e")

        mock_fitz.assert_called_once_with(expected_path)

    def test_ingest_text_expands_tilde(self, tmp_path, monkeypatch):
        monkeypatch.setattr("backend.ingest.CHROMA_PATH", tmp_path / "chroma")

        home = Path.home()
        fake_file = home / "rules.txt"

        with patch("pathlib.Path.read_text", return_value="Some rules."), \
             patch("backend.ingest._add_documents"):
            from backend.ingest import ingest_text
            ingest_text("~/rules.txt", "dnd5e")
