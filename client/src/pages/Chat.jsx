import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage } from "../api/chat.js";

const STORAGE_KEY = "preppilot_chat_history";

const PROMPT_CHIPS = [
  "Explain normalization simply.",
  "Give me common HR interview questions.",
  "Explain an OOP concept.",
  "Help me explain my college project.",
];

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // localStorage may be unavailable (private browsing, quota, etc.) —
    // chat still works for the current session, it just won't persist.
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Chat() {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Cancel any in-flight request if the user navigates away.
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSend(textOverride) {
    const text = (textOverride ?? input).trim();

    if (!text || isStreaming) {
      return;
    }

    setError(null);
    setInput("");

    const userMessage = { id: createId(), role: "user", content: text };
    const assistantId = createId();
    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await sendChatMessage({
        message: text,
        signal: controller.signal,
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        },
      });

      // If the assistant produced no text at all (e.g. stopped
      // immediately), drop the empty bubble instead of leaving it blank.
      if (!controller.signal.aborted) {
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId || m.content.length > 0)
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      // Remove the empty assistant bubble on failure.
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  function handleClear() {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    saveHistory([]);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChipClick(prompt) {
    if (isStreaming) return;
    handleSend(prompt);
  }

  const canSend = input.trim().length > 0 && !isStreaming;

  return (
    <div className="page chat-page">
      <div className="chat-header">
        <div>
          <h1>💬 AI Chat</h1>
          <p className="page-subtitle">
            Chat with an AI assistant about placement preparation.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleClear}
          disabled={messages.length === 0 && !isStreaming}
        >
          Clear Chat
        </button>
      </div>

      {messages.length === 0 && (
        <div className="chip-row" aria-label="Suggested prompts">
          {PROMPT_CHIPS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              onClick={() => handleChipClick(prompt)}
              disabled={isStreaming}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="chat-window" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>
              Ask about DSA, C++, OOP, DBMS, SQL, OS, Computer Networks,
              Aptitude, HR interviews, resumes, or your projects.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-bubble-row chat-bubble-row-${message.role}`}
          >
            <div className={`chat-bubble chat-bubble-${message.role}`}>
              {message.role === "assistant" ? (
                message.content ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  <span className="chat-typing" aria-label="AI is typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                )
              ) : (
                <p className="chat-user-text">{message.content}</p>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="chat-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask a placement-related question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          aria-label="Chat message"
          disabled={isStreaming}
        />

        {isStreaming ? (
          <button
            type="button"
            className="btn btn-stop"
            onClick={handleStop}
          >
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!canSend}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
