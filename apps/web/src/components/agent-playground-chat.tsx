"use client";

import { FormEvent, useRef, useState } from "react";
import { AgentPlaygroundInspector } from "@/components/agent-playground-inspector";
import {
  continueConversation,
  ConversationRequestError,
  type ConversationReply,
  type StoredMessage,
} from "@/lib/playground-session";

export function AgentPlaygroundChat({
  orgId,
  agentId,
  agentName,
  published,
  versionLabel,
  model,
  temperature,
  initialConversationId,
  initialMessages,
}: {
  orgId: string;
  agentId: string;
  agentName: string;
  published: boolean;
  versionLabel: string;
  model?: string | null;
  temperature?: number | null;
  initialConversationId: string | null;
  initialMessages: StoredMessage[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<ConversationReply | null>(null);
  const sending = useRef(false);

  const visible = pendingText
    ? [...messages, { id: "pending-user", role: "user" as const, content: pendingText }]
    : messages;

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!published || !text || sending.current) return;
    sending.current = true;
    setLoading(true);
    setError("");
    setDraft("");
    setPendingText(text);
    try {
      const result = await continueConversation({
        orgId,
        agentId,
        conversationId,
        message: text,
      });
      setConversationId(result.conversationId);
      setMessages(result.messages);
      setReply(result.reply);
      setPendingText(null);
    } catch (caught) {
      if (caught instanceof ConversationRequestError && caught.conversationId) {
        setConversationId(caught.conversationId);
      }
      setPendingText(null);
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

  function reset() {
    if (loading) return;
    setConversationId(null);
    setMessages([]);
    setPendingText(null);
    setReply(null);
    setError("");
    setDraft("");
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <select
            aria-label="Agent"
            value={agentId}
            onChange={() => undefined}
            className="w-full appearance-none bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 cursor-pointer shadow-2xs"
          >
            <option value={agentId}>{agentName}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={loading}
          className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-xl text-gray-500 hover:text-gray-900 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          aria-label="Reset chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4 mb-8 min-h-[220px]">
          {visible.length === 0 && (
            <p className="text-xs text-gray-400">
              {published
                ? "Send a test message to the published agent."
                : "Publish this agent before sending a message."}
            </p>
          )}
          {visible.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="bg-indigo-50 border border-indigo-100/60 rounded-2xl rounded-tr-xs px-4 py-2.5 text-xs text-indigo-900 max-w-[80%] shadow-2xs">
                  {message.content}
                </div>
              </div>
            ) : message.role === "assistant" ? (
              <div key={message.id} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </span>
                <div className="bg-gray-50 border border-gray-200/80 rounded-2xl rounded-tl-xs p-4 text-xs text-gray-800 max-w-[85%] shadow-2xs">
                  <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ) : null
          )}
          {loading && (
            <p className="text-xs text-gray-500" role="status">
              Generating response...
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </p>
          )}

          <form onSubmit={send} className="flex items-center gap-2 mb-4 relative">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!published || loading}
              placeholder="Send a test message..."
              aria-label="Message"
              className="w-full bg-white border border-gray-200/85 rounded-xl pl-4 pr-12 py-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={!published || loading || !draft.trim()}
              className="absolute right-2 p-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-40"
              aria-label="Send message"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
        </div>

        <div className="lg:w-96 shrink-0">
          <AgentPlaygroundInspector
            agentName={agentName}
            version={versionLabel}
            model={model}
            temperature={temperature}
            sources={reply?.sources ?? []}
            promptTokens={reply?.prompt_tokens}
            completionTokens={reply?.completion_tokens}
          />
        </div>
      </div>
    </>
  );
}
