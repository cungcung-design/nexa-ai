"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Trash2, UserRound } from "lucide-react";
import {
  continueConversation,
  ConversationRequestError,
  loadMessages,
  type StoredMessage,
} from "@/lib/playground-session";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function AgentPlayground({
  orgId,
  agentId,
  agentName,
}: {
  orgId: string;
  agentId: string;
  agentName: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const sending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
    fetch(`/api/workspace/${encodeURIComponent(orgId)}/conversations`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(data) || cancelled) return;
        const match = (data as { id: string; agent_id: string }[]).find(
          (item) => item.agent_id === agentId
        );
        if (!match || cancelled) return;
        const history = await loadMessages(orgId, match.id);
        if (cancelled) return;
        setConversationId(match.id);
        setMessages(
          history
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              id: item.id,
              role: item.role as Message["role"],
              content: item.content,
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the conversation");
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, agentId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function applyHistory(history: StoredMessage[], nextConversationId: string) {
    setConversationId(nextConversationId);
    setMessages(
      history
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({
          id: item.id,
          role: item.role as Message["role"],
          content: item.content,
        }))
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending.current) return;
    sending.current = true;
    setDraft("");
    setError("");
    setLoading(true);
    try {
      const result = await continueConversation({
        orgId,
        agentId,
        conversationId,
        message: text,
      });
      applyHistory(result.messages, result.conversationId);
    } catch (caught) {
      if (caught instanceof ConversationRequestError && caught.conversationId) {
        setConversationId(caught.conversationId);
      }
      setDraft(text);
      setError(
        caught instanceof Error
          ? caught.message
          : "The model provider could not respond"
      );
    } finally {
      sending.current = false;
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
              Published version · conversation is saved
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (loading) return;
            setConversationId(null);
            setMessages([]);
            setError("");
          }}
          disabled={loading}
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 disabled:opacity-40"
          aria-label="Reset chat"
          title="Start a new conversation"
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
              Send a message to the published version. The conversation is
              saved and appears in Conversations.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
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
          disabled={loading}
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
