#!/usr/bin/env python3
"""Savvy CLI — TTRPG AI assistant (Phase 1 dev tool)."""

from pathlib import Path

from tqdm import tqdm

from backend.ingest import ingest_pdf, ingest_text, ingest_url, list_games
from backend.chat import ask


def print_games():
    games = list_games()
    if not games:
        print("No games indexed yet. Use 'ingest' to add documents.")
    else:
        print("Indexed games:", ", ".join(games))


def main():
    print("Savvy — TTRPG Assistant")
    print("Commands: ingest <file_or_url> <game_id> | select <game_id> | games | quit\n")

    available = list_games()
    selected_games: list[str] = list(available)

    if available:
        print("Indexed games:", ", ".join(available))
        print("All games auto-selected. Use 'select <game_id>' to narrow down.\n")
    else:
        print("No games indexed yet. Use: ingest <file_or_url> <game_id>\n")

    while True:
        try:
            line = input("savvy> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if not line:
            continue

        if line == "quit":
            print("Goodbye.")
            break

        if line == "games":
            print_games()
            continue

        if line.startswith("ingest "):
            parts = line.split()
            if len(parts) != 3:
                print("Usage: ingest <file_or_url> <game_id>")
                continue
            _, source, game_id = parts
            try:
                if source.startswith("http"):
                    print(f"Fetching {source}...")
                    count = ingest_url(source, game_id)
                elif source.endswith(".pdf"):
                    bar = tqdm(desc=f"Ingesting {Path(source).name}", unit="pages")
                    def progress(current, total):
                        bar.total = total
                        bar.n = current
                        bar.refresh()
                    count = ingest_pdf(source, game_id, progress=progress)
                    bar.close()
                else:
                    print(f"Ingesting {Path(source).name}...")
                    count = ingest_text(source, game_id)
                print(f"Done — {count} chunk(s) indexed into '{game_id}'.")
                if game_id not in selected_games:
                    selected_games.append(game_id)
                    print(f"'{game_id}' added to active games.")
            except Exception as e:
                print(f"Error: {e}")
            continue

        if line.startswith("select "):
            game_id = line[7:].strip()
            if game_id not in selected_games:
                selected_games.append(game_id)
            print(f"Active games: {', '.join(selected_games)}")
            continue

        # Treat anything else as a question
        if not selected_games:
            print("No games selected. Ingest a document first or use: select <game_id>")
            continue

        try:
            print()
            for chunk in ask(line, selected_games, stream=True):
                print(chunk.delta, end="", flush=True)
            print("\n")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    main()
