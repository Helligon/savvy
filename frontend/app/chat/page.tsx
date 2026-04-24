"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPage(): React.JSX.Element {
  const searchParams = useSearchParams();
  const gamesParam = searchParams.get("games") ?? "";
  const gameIds = gamesParam ? gamesParam.split(",").filter(Boolean) : [];
  const model = searchParams.get("model") ?? "mistral";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, game_ids: gameIds, model }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to chat API");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const token = line.slice(6);
          if (token === "[DONE]") {
            setLoading(false);
            return;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m
            )
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Error: could not get response." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, gameIds, model]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 bg-gray-800 border-b border-gray-700 shrink-0">
        <Link
          href="/"
          className="text-gray-400 hover:text-gray-100 transition-colors"
          aria-label="Back to home"
        >
          ← Back
        </Link>
        <h1 className="font-semibold text-lg">Savvy Chat</h1>
        {gameIds.length > 0 && (
          <span className="text-xs text-gray-400">
            [{gameIds.join(", ")}]
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">{model}</span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center mt-8">
            Ask Savvy anything about your game systems.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-role={msg.role}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-700 text-gray-100"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && loading ? (
                <span className="inline-flex gap-1">
                  <span className="animate-pulse">•</span>
                  <span className="animate-pulse delay-75">•</span>
                  <span className="animate-pulse delay-150">•</span>
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-6 py-4 bg-gray-800 border-t border-gray-700 flex gap-3 items-end">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1 resize-none px-4 py-2 bg-gray-700 rounded-xl border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function ChatPageWithSuspense(): React.JSX.Element {
  return (
    <React.Suspense fallback={<div className="bg-gray-900 h-screen" />}>
      <ChatPage />
    </React.Suspense>
  );
}

export default ChatPageWithSuspense;
