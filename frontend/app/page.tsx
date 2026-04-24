"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface GamesResponse {
  games: string[];
}

interface ModelsResponse {
  models: string[];
}

interface IngestResponse {
  chunks: number;
  game_id: string;
}

export function LandingPage(): React.JSX.Element {
  const router = useRouter();
  const [games, setGames] = useState<string[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("mistral");
  const [file, setFile] = useState<File | null>(null);
  const [gameId, setGameId] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  const fetchGames = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("http://localhost:8000/games");
      const data = (await res.json()) as GamesResponse;
      setGames(data.games);
    } catch {
      // silently fail
    }
  }, []);

  const fetchModels = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("http://localhost:8000/models");
      const data = (await res.json()) as ModelsResponse;
      setModels(data.models);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    void fetchGames();
    void fetchModels();
  }, [fetchGames, fetchModels]);

  const toggleGame = (game: string): void => {
    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(game)) {
        next.delete(game);
      } else {
        next.add(game);
      }
      return next;
    });
  };

  const handleStartChatting = (): void => {
    const ids = Array.from(selectedGames).join(",");
    void router.push(`/chat?games=${ids}&model=${selectedModel}`);
  };

  const handleUpload = async (): Promise<void> => {
    if (!file || !gameId.trim()) return;
    setUploading(true);
    setUploadMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("game_id", gameId.trim());
      const res = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = (await res.json()) as IngestResponse;
      setUploadMessage(
        `Success: ingested ${data.chunks} chunks for ${data.game_id}`
      );
    } catch {
      setUploadMessage("Error: upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <h1 className="text-4xl font-bold mb-2">Savvy</h1>
      <p className="text-gray-400 mb-8">Your TTRPG AI assistant</p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Select Game Systems</h2>
        <div className="flex flex-wrap gap-3">
          {games.map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => toggleGame(game)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedGames.has(game)
                  ? "ring-2 ring-indigo-500 bg-indigo-700 border-indigo-500 text-white"
                  : "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
              }`}
            >
              {game}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <label
          htmlFor="model-select"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Model
        </label>
        <select
          id="model-select"
          aria-label="Model"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="px-3 py-2 bg-gray-800 rounded border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-10 bg-gray-800 p-6 rounded-xl max-w-md">
        <h2 className="text-xl font-semibold mb-4">Upload Game Document</h2>
        <div className="flex flex-col gap-3">
          <label className="text-sm text-gray-300">
            File (PDF or text)
            <input
              aria-label="File"
              type="file"
              accept=".pdf,.txt"
              className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-indigo-700 file:text-white hover:file:bg-indigo-600"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <input
            type="text"
            placeholder="Game ID (e.g. savageworlds)"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || !file || !gameId.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              "Upload"
            )}
          </button>
          {uploadMessage && (
            <p
              className={
                uploadMessage.startsWith("Error")
                  ? "text-red-400 text-sm"
                  : "text-green-400 text-sm"
              }
            >
              {uploadMessage}
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={handleStartChatting}
        disabled={selectedGames.size === 0}
        className="px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Start Chatting
      </button>
    </main>
  );
}

export default LandingPage;
