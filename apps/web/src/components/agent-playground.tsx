"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Trash2, UserRound } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export function AgentPlayground({
  orgId,
  agentId,
  agentName,
}: {
  orgId: string;
  agentId: string;
  agentName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setError("");
  }, [orgId, agentId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    setDraft("");
    setError("");
    setMessages((p) => [...p, { role: "user", content: text }]);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agentId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chat failed");
      const answer =
        typeof data.answer === "string"
          ? data.answer
          : typeof data.response === "string"
            ? data.response
            : null;
      if (!answer) throw new Error("Unexpected agent response");
      setMessages((p) => [...p, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#14131e]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-500/15 p-2 text-violet-300">
            <Bot className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{agentName}</h2>
            <p className="text-xs text-zinc-500">
              Live agent test · single-turn API
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setMessages([]);
            setError("");
          }}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5"
          aria-label="Clear local chat"
          title="Clear local chat"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div
        aria-live="polite"
        className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
      >
        {messages.length === 0 && (
          <div className="mx-auto max-w-md py-20 text-center">
            <Bot className="mx-auto size-10 text-violet-400" />
            <h3 className="mt-4 text-xl font-bold">Test your agent</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Send a message to the published version. This playground does not
              persist conversations; use Conversations for threaded history.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <Bot className="mt-2 size-4 shrink-0 text-violet-400" />
            )}
            <div
              className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-violet-600 text-white"
                  : "border border-white/10 bg-white/5 text-zinc-200"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <UserRound className="mt-2 size-4 shrink-0 text-zinc-400" />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <LoaderCircle className="size-4 animate-spin" /> Generating
            response...
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
          >
            {error}
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={send}
        className="flex items-end gap-3 border-t border-white/10 p-4"
      >
        <textarea
          aria-label="Message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={4000}
          rows={2}
          placeholder="Ask your agent something..."
          className="max-h-40 min-h-12 flex-1 resize-y rounded-xl border border-white/15 bg-black/20 p-3 text-sm outline-none focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          aria-label="Send message"
          className="rounded-xl bg-violet-600 p-3 text-white disabled:opacity-40"
        >
          <Send className="size-5" />
        </button>
      </form>
    </section>
  );
}
