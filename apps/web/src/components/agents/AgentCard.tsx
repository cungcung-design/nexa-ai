"use client";

type AgentCardProps = {
  id: string;
  name: string;
  description: string;
  published: boolean;
  onOpen: (id: string) => void;
};

export function AgentCard({
  id,
  name,
  description,
  published,
  onOpen,
}: AgentCardProps) {
  return (
    <article className="rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>

        <span
          data-testid="agent-status"
          className="text-sm"
        >
          {published ? "Published" : "Draft"}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {description}
      </p>

      <button
        type="button"
        onClick={() => onOpen(id)}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-white"
      >
        Open Agent
      </button>
    </article>
  );
}
