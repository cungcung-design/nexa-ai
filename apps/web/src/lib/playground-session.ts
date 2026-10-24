export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

export type ConversationRecord = {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
};

export type ConversationReply = {
  conversation_id: string;
  answer: string;
  model?: string;
  sources?: { filename?: string; document_id?: string }[];
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
};

export class ConversationRequestError extends Error {
  conversationId: string | null;

  constructor(message: string, conversationId: string | null) {
    super(message);
    this.name = "ConversationRequestError";
    this.conversationId = conversationId;
  }
}

export function apiError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.error === "string" && record.error) return record.error;
    if (typeof record.detail === "string" && record.detail) return record.detail;
  }
  return fallback;
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export async function createConversation(
  orgId: string,
  agentId: string,
  title: string
) {
  const response = await fetch(
    `/api/workspace/${encodeURIComponent(orgId)}/conversations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        title: title.slice(0, 200) || "New conversation",
      }),
    }
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(apiError(data, "Could not start a conversation"));
  }
  return data as ConversationRecord;
}

export async function sendConversationMessage(
  orgId: string,
  conversationId: string,
  message: string
) {
  const response = await fetch(
    `/api/workspace/${encodeURIComponent(orgId)}/conversations/${encodeURIComponent(conversationId)}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(apiError(data, "The model provider could not respond"));
  }
  return data as ConversationReply;
}

export async function loadMessages(orgId: string, conversationId: string) {
  const response = await fetch(
    `/api/workspace/${encodeURIComponent(orgId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
    { cache: "no-store" }
  );
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(apiError(data, "Could not load the conversation"));
  }
  return (Array.isArray(data) ? data : []) as StoredMessage[];
}

export async function continueConversation(input: {
  orgId: string;
  agentId: string;
  conversationId: string | null;
  message: string;
}) {
  let conversationId = input.conversationId;
  try {
    if (!conversationId) {
      const created = await createConversation(
        input.orgId,
        input.agentId,
        input.message.trim()
      );
      conversationId = created.id;
    }
    const reply = await sendConversationMessage(
      input.orgId,
      conversationId,
      input.message
    );
    const messages = await loadMessages(input.orgId, conversationId);
    return { conversationId, reply, messages };
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "The model provider could not respond";
    throw new ConversationRequestError(message, conversationId);
  }
}
