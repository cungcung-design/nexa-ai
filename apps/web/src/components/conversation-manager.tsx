"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageSquarePlus, Send } from "lucide-react";
import type { Agent } from "@/lib/api";

export type Conversation = {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function err(d: unknown, fallback: string) {
  if (d && typeof d === "object") {
    const x = d as Record<string, unknown>;
    return typeof x.error === "string"
      ? x.error
      : typeof x.detail === "string"
        ? x.detail
        : fallback;
  }
  return fallback;
}

export function ConversationManager({
  orgId,
  initialConversations,
  agents,
}: {
  orgId: string;
  initialConversations: Conversation[];
  agents: Agent[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [active, setActive] = useState(initialConversations[0]?.id ?? "");
  const [selectedAgent, setSelectedAgent] = useState(
    agents.find((a) => a.published_version_id)?.id ?? ""
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const prefix = `/api/workspace/${encodeURIComponent(orgId)}/conversations`;

  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${prefix}/${encodeURIComponent(active)}/messages`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(err(d, "Could not load messages"));
        if (!cancelled) setMessages(Array.isArray(d) ? d : []);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load messages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, orgId, prefix]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function create() {
    if (!selectedAgent) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(prefix, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgent, title: "New conversation" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(err(d, "Could not create conversation"));
      setConversations((p) => [d as Conversation, ...p]);
      setActive((d as Conversation).id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create conversation");
    } finally {
      setBusy(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const value = message.trim();
    if (!value || !active || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`${prefix}/${encodeURIComponent(active)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(err(d, "Message failed"));
      const messagesResponse = await fetch(
        `${prefix}/${encodeURIComponent(active)}/messages`,
        { cache: "no-store" }
      );
      if (!messagesResponse.ok)
        throw new Error("Reply sent, but history refresh failed");
      setMessages(await messagesResponse.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message failed");
      setMessage(value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[560px] gap-4 lg:grid-cols-[290px_1fr]">
      <aside className="rounded-2xl border border-white/10 bg-[#14131e] p-4">
        <label className="block text-xs text-zinc-400">
          Agent for new conversation
        </label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#111019] p-3 text-sm"
        >
          <option value="">Select a published agent</option>
          {agents
            .filter((a) => a.published_version_id)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
        <button
          disabled={!selectedAgent || busy}
          onClick={() => void create()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 p-3 text-sm font-semibold disabled:opacity-50"
        >
          <MessageSquarePlus className="size-4" /> New conversation
        </button>
        <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          History
        </h2>
        <div className="space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`w-full rounded-lg p-3 text-left text-sm ${
                active === c.id
                  ? "bg-violet-500/15 text-violet-200"
                  : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {c.title}
            </button>
          ))}
          {!conversations.length && (
            <p className="text-sm text-zinc-500">No conversations yet.</p>
          )}
        </div>
      </aside>
      <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14131e]">
        <div className="border-b border-white/10 p-4">
          <h2 className="font-semibold">
            {conversations.find((c) => c.id === active)?.title ??
              "Choose a conversation"}
          </h2>
          <p className="text-xs text-zinc-500">
            History stored by your FastAPI backend
          </p>
        </div>
        <div
          className="flex-1 space-y-4 overflow-y-auto p-5"
          aria-live="polite"
        >
          {loading && (
            <p className="text-sm text-zinc-500">Loading messages...</p>
          )}
          {!loading && !messages.length && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Bot className="size-10 text-violet-400" />
              <p className="text-sm text-zinc-400">
                {active
                  ? "Send your first message."
                  : "Create or select a conversation."}
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl p-4 text-sm ${
                  m.role === "user"
                    ? "bg-violet-600 text-white"
                    : "border border-white/10 bg-white/5 text-zinc-200"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        {error && (
          <p
            role="alert"
            className="mx-4 mb-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        <form
          onSubmit={send}
          className="flex items-end gap-3 border-t border-white/10 p-4"
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!active || busy}
            maxLength={4000}
            rows={2}
            placeholder="Ask your agent..."
            className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-violet-500"
          />
          <button
            disabled={!active || !message.trim() || busy}
            aria-label="Send message"
            className="rounded-xl bg-violet-600 p-3 disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <Send className="size-5" />
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
