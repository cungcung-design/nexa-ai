"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DeploymentConfig {
  name: string;
  allowed_origins: string[];
}

export function EmbeddedChat({ deploymentId }: { deploymentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/embed/${encodeURIComponent(deploymentId)}/config`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load deployment config");
        return res.json();
      })
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load deployment config"));
  }, [deploymentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setLoading(true);
    setError(null);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch(
        `/api/public/deployments/${encodeURIComponent(deploymentId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (error && !config) {
    return (
      <div
        style={{
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          color: "#dc2626",
          textAlign: "center",
        }}
      >
        Failed to load chat: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "system-ui, sans-serif",
        background: "#fff",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "16px", color: "#111827" }}>
          {config?.name || "Nexa AI Assistant"}
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
          AI-powered support
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.length === 0 && config && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "80%",
              padding: "12px 16px",
              background: "#f0f9ff",
              borderRadius: "12px",
              borderBottomLeftRadius: "4px",
            }}
          >
            <div style={{ fontWeight: 500, color: "#0c4a6e" }}>
              Hello! How can I help you today?
            </div>
            <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "4px" }}>
              Nexa AI
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              padding: "12px 16px",
              background:
                msg.role === "user" ? "#0891b2" : "#f3f4f6",
              borderRadius: "12px",
              borderBottomRightRadius:
                msg.role === "user" ? "4px" : "12px",
              borderBottomLeftRadius:
                msg.role === "user" ? "12px" : "4px",
              color: msg.role === "user" ? "#fff" : "#111827",
            }}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "80%",
              padding: "12px 16px",
              background: "#f3f4f6",
              borderRadius: "12px",
              borderBottomLeftRadius: "4px",
            }}
          >
            <div style={{ color: "#6b7280" }}>Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          style={{
            padding: "8px 16px",
            background: "#fef2f2",
            borderTop: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSend}
        style={{
          padding: "16px",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: "8px",
              background: "#0891b2",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 500,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>
      </form>

      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #e5e7eb",
          background: "#f9fafb",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
          Powered by Nexa AI
        </span>
      </div>
    </div>
  );
}
