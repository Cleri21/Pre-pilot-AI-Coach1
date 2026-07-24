// Base URL of the backend API.
// Falls back to localhost:5000 if the .env file is not set up yet.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Calls POST /api/chat and streams the assistant's reply back to the
// caller as plain text chunks, in the order they arrive from the server.
//
// Params:
// - message: the user's message string
// - signal: an AbortSignal used to cancel the in-flight request (Stop Generation)
// - onChunk: called with each new text chunk as it streams in
//
// Throws on a non-OK response or a network/stream failure. Does not throw
// when the request is aborted via `signal` — callers should check
// `signal.aborted` themselves if they need to distinguish a stop from an
// error.
export async function sendChatMessage({ message, signal, onChunk }) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) {
      return;
    }
    throw new Error(
      "Could not reach the server. Please check your connection and try again."
    );
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}.`;

    try {
      const data = await response.json();
      if (data?.error?.message) {
        errorMessage = data.error.message;
      }
    } catch {
      // Response wasn't JSON — fall back to the generic message above.
    }

    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("Streaming is not supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });

      if (chunk) {
        onChunk(chunk);
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return;
    }
    throw new Error("Lost connection while streaming the response.");
  }
}
