/**
 * Thin client for the fly backend.
 *
 * Every call goes through `requestFlyMove`, which is the single seam the UI
 * uses to ask "what does the fly play here?". When the placeholder policy is
 * replaced by a connectome model, nothing in this file changes.
 */

import { Board, COLS, HealthResponse, MoveResponse } from "./types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/** Abort a request that hangs so the UI never gets stuck on "thinking". */
const REQUEST_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError(
      aborted
        ? "The fly took too long to answer."
        : `Cannot reach the fly backend at ${API_BASE_URL}. Is it running?`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Non-JSON error body: keep the generic message.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

/** Basic shape check so a bad payload fails here rather than mid-render. */
function assertMoveResponse(data: MoveResponse): MoveResponse {
  const valid =
    typeof data?.column === "number" &&
    data.column >= 0 &&
    data.column < COLS &&
    Array.isArray(data.scores) &&
    data.activity != null;

  if (!valid) {
    throw new ApiError("The fly returned a move this board cannot accept.");
  }
  return data;
}

/** Ask the backend for the fly's move on the supplied position. */
export async function requestFlyMove(board: Board): Promise<MoveResponse> {
  const data = await request<MoveResponse>("/move", {
    method: "POST",
    body: JSON.stringify({ board }),
  });
  return assertMoveResponse(data);
}

export async function checkHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { method: "GET" });
}
