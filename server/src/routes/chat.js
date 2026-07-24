// server/src/routes/chat.js
import { Router } from "express";
import rateLimit from "express-rate-limit";

import { streamChatReply } from "../services/geminiService.js";

const router = Router();

const MAX_MESSAGE_LENGTH = 5000;

// Chat is one conversation made of many small requests, so it gets its own,
// more generous limiter than the general /api limiter in
// middleware/rateLimiter.js (both apply; this one is stricter and specific
// to /api/chat).
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 chat requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: "Too many chat requests. Please slow down.",
      status: 429,
    },
  },
});

function validateMessage(body) {
  const message = body?.message;

  if (typeof message !== "string") {
    return { error: "message is required and must be a string." };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { error: "message must not be empty." };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      error: `message must not exceed ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  return { message: trimmed };
}

// POST /api/chat
// Streams Claude's reply back to the client as plain text chunks, in the
// order they are generated, so the UI can render them progressively.
router.post("/chat", chatRateLimiter, async (req, res, next) => {
  const { message, error: validationError } = validateMessage(req.body);

  if (validationError) {
    return res.status(400).json({
      error: { message: validationError, status: 400 },
    });
  }

  const controller = new AbortController();

  // Stop asking Claude for more tokens if the client goes away
  // (tab closed, navigation, network drop, etc.).
  req.on("aborted", () => {
    controller.abort();
});

res.on("close", () => {
    if (!res.writableEnded) {
        controller.abort();
    }
});

  // Headers are set but NOT flushed yet — they are sent automatically on the
  // first res.write() below. This means if Claude errors out before
  // producing any text (e.g. bad API key), headers are still unsent and
  // next(err) can still return a proper JSON error with the right status.
  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering

  try {
    await streamChatReply({
      message,
      signal: controller.signal,
      onText: (chunk) => {
        if (!res.writableEnded) {
          res.write(chunk);
        }
      },
    });

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err) {
    if (controller.signal.aborted) {
      // Client disconnected — nothing left to send.
      return;
    }

    if (res.headersSent) {
      // Streaming already began; we can no longer change the status code
      // or send a JSON error body. Log it and close the stream.
      console.error("[POST /api/chat] stream error:", err.message);
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    next(err);
  }
});

export default router;