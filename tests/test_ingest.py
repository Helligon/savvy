"""Tests for the document ingestion pipeline."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.ingest import ingest_pdf, ingest_text, ingest_url, list_games


@pytest.fixture
def tmp_chroma(tmp_path, monkeypatch):
    """Redirect ChromaDB and documents storage to a temp directory."""
    monkeypatch.setattr("backend.ingest.CHROMA_PATH", tmp_path / "chroma")
    monkeypatch.setattr("backend.ingest.DOCUMENTS_PATH", tmp_path / "documents")
    (tmp_path / "chroma").mkdir()
    (tmp_path / "documents").mkdir()
    return tmp_path


class TestIngestText:
    def test_ingests_text_file(self, tmp_chroma):
        txt = tmp_chroma / "rules.txt"
        txt.write_text("Roll 2d6 and add your modifier.", encoding="utf-8")

        with patch("backend.ingest._add_documents") as mock_add:
            count = ingest_text(str(txt), "dnd5e")

        assert count == 1
        mock_add.assert_called_once()
        doc = mock_add.call_args[0][0][0]
        assert "Roll 2d6" in doc.text
        assert doc.metadata["source"] == "rules.txt"

    def test_game_id_passed_to_add(self, tmp_chroma):
        txt = tmp_chroma / "rules.txt"
        txt.write_text("Some rules.", encoding="utf-8")

        with patch("backend.ingest._add_documents") as mock_add:
            ingest_text(str(txt), "pathfinder")

        assert mock_add.call_args[0][1] == "pathfinder"


class TestIngestUrl:
    def test_ingests_url(self, tmp_chroma):
        with patch("trafilatura.fetch_url", return_value="<html>content</html>"), \
             patch("trafilatura.extract", return_value="Extracted rules text"), \
             patch("backend.ingest._add_documents") as mock_add:
            count = ingest_url("http://example.com/rules", "dnd5e")

        assert count == 1
        doc = mock_add.call_args[0][0][0]
        assert doc.text == "Extracted rules text"
        assert doc.metadata["source"] == "http://example.com/rules"

    def test_raises_when_extraction_fails(self, tmp_chroma):
        with patch("trafilatura.fetch_url", return_value=None), \
             patch("trafilatura.extract", return_value=None):
            with pytest.raises(ValueError, match="Could not extract text"):
                ingest_url("http://example.com/empty", "dnd5e")


class TestIngestPdf:
    def test_skips_empty_pages(self, tmp_chroma):
        mock_page_with_text = MagicMock()
        mock_page_with_text.get_text.return_value = "  Page with content  "
        mock_empty_page = MagicMock()
        mock_empty_page.get_text.return_value = "   "

        mock_doc = [mock_page_with_text, mock_empty_page]

        with patch("fitz.open", return_value=mock_doc), \
             patch("backend.ingest._add_documents") as mock_add:
            count = ingest_pdf("rules.pdf", "dnd5e")

        assert count == 1

    def test_page_metadata(self, tmp_chroma):
        mock_page = MagicMock()
        mock_page.get_text.return_value = "Chapter 1: Combat"

        with patch("fitz.open", return_value=[mock_page]), \
             patch("backend.ingest._add_documents") as mock_add:
            ingest_pdf("/tmp/rules.pdf", "dnd5e")

        doc = mock_add.call_args[0][0][0]
        assert doc.metadata["source"] == "rules.pdf"
        assert doc.metadata["page"] == 1


class TestListGames:
    def test_returns_collection_names(self, tmp_chroma):
        mock_col_1 = MagicMock()
        mock_col_1.name = "dnd5e"
        mock_col_2 = MagicMock()
        mock_col_2.name = "pathfinder"

        with patch("chromadb.PersistentClient") as mock_client:
            mock_client.return_value.list_collections.return_value = [mock_col_1, mock_col_2]
            games = list_games()

        assert games == ["dnd5e", "pathfinder"]

    def test_returns_empty_when_no_games(self, tmp_chroma):
        with patch("chromadb.PersistentClient") as mock_client:
            mock_client.return_value.list_collections.return_value = []
            assert list_games() == []
