#!/bin/bash
set -e

# Start Ollama in the background if not already running
if ! pgrep -x "ollama" > /dev/null; then
  echo "Starting Ollama..."
  ollama serve &
  sleep 2
fi

# Pull models if not already present
ollama pull mistral
ollama pull nomic-embed-text

# Start backend and frontend
docker compose up
