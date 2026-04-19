"""Tests for the chat/RAG query pipeline."""

from unittest.mock import MagicMock, patch

import pytest

from backend.chat import QueryMode, ask


@pytest.fixture
def mock_index():
    node = MagicMock()
    node.get_content.return_value = "On a critical hit, roll damage dice twice."
    node.metadata = {"source": "phb.pdf"}

    retriever = MagicMock()
    retriever.retrieve.return_value = [node]

    index = MagicMock()
    index.as_retriever.return_value = retriever
    return index


class TestAsk:
    def test_raises_when_no_games_selected(self):
        with pytest.raises(ValueError, match="At least one game"):
            ask("What is a critical hit?", game_ids=[])

    def test_queries_each_selected_game(self, mock_index):
        with patch("backend.chat.get_index", return_value=mock_index) as mock_get, \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_ollama_cls.return_value.complete.return_value.text = "A critical hit doubles damage."
            ask("What is a critical hit?", game_ids=["dnd5e", "pathfinder"])

        assert mock_get.call_count == 2
        mock_get.assert_any_call("dnd5e")
        mock_get.assert_any_call("pathfinder")

    def test_uses_low_temperature_for_rules(self, mock_index):
        with patch("backend.chat.get_index", return_value=mock_index), \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_ollama_cls.return_value.complete.return_value.text = "Answer."
            ask("What is a critical hit?", game_ids=["dnd5e"])

        _, kwargs = mock_ollama_cls.call_args
        assert kwargs["temperature"] == 0.1

    def test_context_includes_source_label(self, mock_index):
        captured_prompt = {}

        def fake_complete(prompt):
            captured_prompt["value"] = prompt
            return MagicMock(text="Answer.")

        with patch("backend.chat.get_index", return_value=mock_index), \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_ollama_cls.return_value.complete.side_effect = fake_complete
            ask("What is a critical hit?", game_ids=["dnd5e"])

        assert "[phb.pdf]" in captured_prompt["value"]

    def test_uses_medium_temperature_for_item_stats(self, mock_index):
        with patch("backend.chat.get_index", return_value=mock_index), \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_ollama_cls.return_value.complete.return_value.text = "Answer."
            ask("Generate a magic sword", game_ids=["dnd5e"], mode=QueryMode.ITEM_STATS)

        _, kwargs = mock_ollama_cls.call_args
        assert kwargs["temperature"] == 0.3

    def test_uses_high_temperature_for_character(self, mock_index):
        with patch("backend.chat.get_index", return_value=mock_index), \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_ollama_cls.return_value.complete.return_value.text = "Answer."
            ask("Generate a character", game_ids=["dnd5e"], mode=QueryMode.CHARACTER)

        _, kwargs = mock_ollama_cls.call_args
        assert kwargs["temperature"] == 0.7

    def test_returns_streamed_response(self, mock_index):
        with patch("backend.chat.get_index", return_value=mock_index), \
             patch("backend.chat.Ollama") as mock_ollama_cls:
            mock_stream = MagicMock()
            mock_ollama_cls.return_value.stream_complete.return_value = mock_stream
            result = ask("What is a critical hit?", game_ids=["dnd5e"], stream=True)

        assert result is mock_stream
