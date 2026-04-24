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
const MODELS_RESPONSE = { models: ["mistral", "llama3.2"] };

function mockFetchGamesAndModels(): void {
  global.fetch = jest.fn().mockImplementation(async (url: string) => {
    if (url === "http://localhost:8000/games") {
      return { ok: true, json: async () => GAMES_RESPONSE };
    }
    if (url === "http://localhost:8000/models") {
      return { ok: true, json: async () => MODELS_RESPONSE };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe("LandingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGamesAndModels();
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

  test("fetches and renders model options on load", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8000/models");
      expect(screen.getByRole("option", { name: "mistral" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "llama3.2" })).toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: /model/i })).toBeInTheDocument();
  });

  test("default selected model is mistral", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "mistral" })).toBeInTheDocument();
    });
    const select = screen.getByRole("combobox", { name: /model/i }) as HTMLSelectElement;
    expect(select.value).toBe("mistral");
  });

  test("selecting a model updates the dropdown value", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "llama3.2" })).toBeInTheDocument();
    });
    const select = screen.getByRole("combobox", { name: /model/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "llama3.2" } });
    expect(select.value).toBe("llama3.2");
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

  test("Start Chatting navigates with selected game IDs and model", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: /model/i })).toBeInTheDocument();
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
    expect(callArg).toContain("model=mistral");
  });

  test("Start Chatting includes the selected model in the URL", async () => {
    render(<LandingPage />);
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /model/i })).toBeInTheDocument();
      expect(screen.getByText("savageworlds")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("savageworlds").closest("button")!);

    const select = screen.getByRole("combobox", { name: /model/i });
    fireEvent.change(select, { target: { value: "llama3.2" } });

    const btn = screen.getByRole("button", { name: /start chatting/i });
    fireEvent.click(btn);

    const callArg: string = mockPush.mock.calls[0][0] as string;
    expect(callArg).toContain("model=llama3.2");
  });

  test("upload calls /ingest with correct form data", async () => {
    const mockFile = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    let capturedFormData: FormData | null = null;
    global.fetch = jest
      .fn()
      .mockImplementation(async (url: string, opts?: RequestInit) => {
        if (url === "http://localhost:8000/games") {
          return { ok: true, json: async () => GAMES_RESPONSE };
        }
        if (url === "http://localhost:8000/models") {
          return { ok: true, json: async () => MODELS_RESPONSE };
        }
        if (url === "http://localhost:8000/ingest") {
          capturedFormData = opts?.body as FormData;
          return { ok: true, json: async () => ({ chunks: 5, game_id: "myGame" }) };
        }
        return { ok: true, json: async () => ({}) };
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
      .mockImplementation(async (url: string) => {
        if (url === "http://localhost:8000/games") {
          return { ok: true, json: async () => GAMES_RESPONSE };
        }
        if (url === "http://localhost:8000/models") {
          return { ok: true, json: async () => MODELS_RESPONSE };
        }
        if (url === "http://localhost:8000/ingest") {
          return { ok: true, json: async () => ({ chunks: 5, game_id: "myGame" }) };
        }
        return { ok: true, json: async () => ({}) };
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
