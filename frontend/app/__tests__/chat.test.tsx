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
    mockSearchParamsGet.mockReturnValue("savageworlds,dnd5e");

    let capturedBody: { message: string; game_ids: string[] } | null = null;
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
    };

    expect(capturedBody.game_ids).toEqual(["savageworlds", "dnd5e"]);
    expect(capturedBody.message).toBe("Test message");
  });

  test("renders streamed tokens as they arrive", async () => {
    mockSearchParamsGet.mockReturnValue("savageworlds");

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
    mockSearchParamsGet.mockReturnValue("savageworlds");

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
    mockSearchParamsGet.mockReturnValue("savageworlds");
    render(<ChatPage />);
    const backLink = screen.getByRole("link", { name: /back/i });
    expect(backLink).toHaveAttribute("href", "/");
  });
});
