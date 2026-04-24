"use client";

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { ChatPage } from "../chat/page";

// Mock next/navigation
const mockSearchParamsGet = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock next/link
jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>;
  MockLink.displayName = "MockLink";
  return MockLink;
});

function makeSSEStream(tokens: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const token of tokens) {
        controller.enqueue(encoder.encode(`data: ${token}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("ChatPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reads game IDs from query params and includes them in /chat request", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds,dnd5e";
      if (key === "model") return "mistral";
      return null;
    });

    let capturedBody: { message: string; game_ids: string[]; model: string } | null = null;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["Hello"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({ method: "POST" })
      );
    });

    const callOpts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    capturedBody = JSON.parse(callOpts.body as string) as {
      message: string;
      game_ids: string[];
      model: string;
    };

    expect(capturedBody.game_ids).toEqual(["savageworlds", "dnd5e"]);
    expect(capturedBody.message).toBe("Test message");
  });

  test("reads model from query params and includes it in POST body", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "llama3.2";
      return null;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["OK"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({ method: "POST" })
      );
    });

    const callOpts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callOpts.body as string) as {
      message: string;
      game_ids: string[];
      model: string;
    };

    expect(body.model).toBe("llama3.2");
  });

  test("defaults model to mistral if not in query params", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      return null; // model param missing
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["OK"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({ method: "POST" })
      );
    });

    const callOpts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callOpts.body as string) as {
      message: string;
      game_ids: string[];
      model: string;
    };

    expect(body.model).toBe("mistral");
  });

  test("displays the active model name in the header", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "llama3.2";
      return null;
    });

    render(<ChatPage />);

    expect(screen.getByText(/llama3\.2/)).toBeInTheDocument();
  });

  test("renders streamed tokens as they arrive", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      return null;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["Hello", " world", "!"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Hi" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Hello world!/)).toBeInTheDocument();
    });
  });

  test("shows user message right-aligned", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      return null;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["OK"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "My question" } });
      fireEvent.click(sendBtn);
    });

    const userMsg = screen.getByText("My question");
    expect(userMsg.closest("[data-role='user']")).toBeInTheDocument();
  });

  test("shows back link to landing page", () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      return null;
    });
    render(<ChatPage />);
    const backLink = screen.getByRole("link", { name: /back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  test("reads temperature from query params and includes it in POST body", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      if (key === "temperature") return "0.7";
      return null;
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["OK"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({ method: "POST" })
      );
    });

    const callOpts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callOpts.body as string) as {
      message: string;
      game_ids: string[];
      model: string;
      temperature: number;
    };

    expect(body.temperature).toBe(0.7);
  });

  test("defaults temperature to 0.1 if missing from query params", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      return null; // temperature param missing
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(["OK"]),
    } as unknown as Response);

    render(<ChatPage />);

    const input = screen.getByRole("textbox");
    const sendBtn = screen.getByRole("button", { name: /send/i });

    await act(async () => {
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/chat",
        expect.objectContaining({ method: "POST" })
      );
    });

    const callOpts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callOpts.body as string) as {
      message: string;
      game_ids: string[];
      model: string;
      temperature: number;
    };

    expect(body.temperature).toBe(0.1);
  });

  test("displays temperature value in the header alongside model name", () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "games") return "savageworlds";
      if (key === "model") return "mistral";
      if (key === "temperature") return "0.3";
      return null;
    });

    render(<ChatPage />);

    expect(screen.getByText(/0\.3/)).toBeInTheDocument();
  });
});
