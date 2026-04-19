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
import { LandingPage } from "../page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

const GAMES_RESPONSE = { games: ["savageworlds", "dnd5e", "pathfinder2e"] };

function mockFetchGames(): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => GAMES_RESPONSE,
  } as Response);
}

describe("LandingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGames();
  });

  test("fetches and renders games on load", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
      expect(screen.getByText("dnd5e")).toBeInTheDocument();
      expect(screen.getByText("pathfinder2e")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8000/games"
    );
  });

  test("clicking a game card toggles selection", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
    });

    const card = screen.getByText("savageworlds").closest("button")!;
    expect(card).not.toHaveClass("ring-2");

    fireEvent.click(card);
    expect(card).toHaveClass("ring-2");

    fireEvent.click(card);
    expect(card).not.toHaveClass("ring-2");
  });

  test("Start Chatting is disabled with no selection, enabled with one selected", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
    });

    const btn = screen.getByRole("button", { name: /start chatting/i });
    expect(btn).toBeDisabled();

    fireEvent.click(screen.getByText("savageworlds").closest("button")!);
    expect(btn).not.toBeDisabled();
  });

  test("Start Chatting navigates with selected game IDs", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("savageworlds").closest("button")!);
    fireEvent.click(screen.getByText("dnd5e").closest("button")!);

    const btn = screen.getByRole("button", { name: /start chatting/i });
    fireEvent.click(btn);

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/chat?games=")
    );
    const callArg: string = mockPush.mock.calls[0][0] as string;
    expect(callArg).toContain("savageworlds");
    expect(callArg).toContain("dnd5e");
  });

  test("upload calls /ingest with correct form data", async () => {
    const mockFile = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    let capturedFormData: FormData | null = null;
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        if (url === "http://localhost:8000/games") {
          return { ok: true, json: async () => GAMES_RESPONSE };
        }
        return { ok: true, json: async () => ({}) };
      })
      .mockImplementationOnce(async (_url: string, opts: RequestInit) => {
        capturedFormData = opts.body as FormData;
        return {
          ok: true,
          json: async () => ({ chunks: 5, game_id: "myGame" }),
        };
      });

    render(<LandingPage />);
    await waitFor(() =>
      expect(screen.getByText("savageworlds")).toBeInTheDocument()
    );

    const fileInput = screen.getByLabelText(/file/i);
    const gameIdInput = screen.getByPlaceholderText(/game id/i);
    const uploadBtn = screen.getByRole("button", { name: /upload/i });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      fireEvent.change(gameIdInput, { target: { value: "myGame" } });
    });

    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/ingest",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(capturedFormData).not.toBeNull();
    const fd = capturedFormData as unknown as FormData;
    expect(fd.get("game_id")).toBe("myGame");
    expect(fd.get("file")).toBeTruthy();
  });

  test("shows success message after successful upload", async () => {
    const mockFile = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => GAMES_RESPONSE,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chunks: 5, game_id: "myGame" }),
      });

    render(<LandingPage />);
    await waitFor(() =>
      expect(screen.getByText("savageworlds")).toBeInTheDocument()
    );

    const fileInput = screen.getByLabelText(/file/i);
    const gameIdInput = screen.getByPlaceholderText(/game id/i);
    const uploadBtn = screen.getByRole("button", { name: /upload/i });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
      fireEvent.change(gameIdInput, { target: { value: "myGame" } });
    });

    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
