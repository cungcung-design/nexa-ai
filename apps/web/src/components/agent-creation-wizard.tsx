"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sliders,
  User,
} from "lucide-react";
import type { Agent } from "@/lib/api";

type Category = "support" | "sales" | "hr" | "engineering";
type ResponseStyle = "professional" | "friendly" | "concise" | "detailed";
type Provider = "openai" | "claude";

type FormData = {
  name: string;
  description: string;
  icon: string;
  category: Category;
  systemPrompt: string;
  role: string;
  behavior: string;
  constraints: string;
  responseStyle: ResponseStyle;
  provider: Provider;
  model: string;
  temperature: number;
  maxTokens: number;
};

const INITIAL_FORM: FormData = {
  name: "",
  description: "",
  icon: "Bot",
  category: "support",
  systemPrompt: "",
  role: "Assistant",
  behavior: "Be helpful, accurate, and concise.",
  constraints: "Do not share sensitive information.",
  responseStyle: "professional",
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 1024,
};

const STEPS: { id: number; label: string }[] = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Instructions" },
  { id: 3, label: "Model" },
  { id: 4, label: "Review" },
];

const CATEGORIES: { value: Category; label: string; icon: React.ElementType }[] = [
  { value: "support", label: "Customer Support", icon: User },
  { value: "sales", label: "Sales & Marketing", icon: Sliders },
  { value: "hr", label: "Human Resources", icon: ShieldCheck },
  { value: "engineering", label: "Engineering & Workflow", icon: Plus },
];

const RESPONSE_STYLES: { value: ResponseStyle; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
];

const PROVIDERS: { value: Provider; label: string; models: string[] }[] = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] },
  { value: "claude", label: "Claude", models: ["claude-3-5-sonnet", "claude-3-haiku"] },
];

const ICON_OPTIONS: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "Bot", label: "Bot", icon: Bot },
  { value: "Headset", label: "Support", icon: ShieldCheck },
  { value: "ShoppingBag", label: "Sales", icon: Sliders },
  { value: "Brain", label: "Research", icon: User },
  { value: "Users", label: "Team", icon: ShieldCheck },
];

export function AgentCreationWizard({
  orgId,
  onComplete,
}: {
  orgId: string;
  onComplete: (agentId: string) => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const hasUnsavedChanges =
    formData.name !== INITIAL_FORM.name ||
    formData.description !== INITIAL_FORM.description ||
    formData.systemPrompt !== INITIAL_FORM.systemPrompt;

  const setField = (key: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  function validateStep(s: number): boolean {
    const next: Record<string, string> = {};
    let valid = true;

    if (s === 1) {
      if (!formData.name.trim()) {
        next.name = "Agent name is required.";
        valid = false;
      } else if (formData.name.trim().length < 2) {
        next.name = "Agent name must be at least 2 characters.";
        valid = false;
      } else if (formData.name.trim().length > 150) {
        next.name = "Agent name must be at most 150 characters.";
        valid = false;
      }
      if (!formData.category) {
        next.category = "Please select a category.";
        valid = false;
      }
    }

    if (s === 2) {
      if (!formData.systemPrompt.trim()) {
        next.systemPrompt = "System prompt is required.";
        valid = false;
      } else if (formData.systemPrompt.trim().length < 10) {
        next.systemPrompt = "System prompt must be at least 10 characters.";
        valid = false;
      } else if (formData.systemPrompt.trim().length > 20000) {
        next.systemPrompt = "System prompt must be at most 20000 characters.";
        valid = false;
      }
      if (!formData.role.trim()) {
        next.role = "Role is required.";
        valid = false;
      }
    }

    if (s === 3) {
      if (!formData.provider) {
        next.provider = "Please select a provider.";
        valid = false;
      }
      if (!formData.model) {
        next.model = "Please select a model.";
        valid = false;
      }
      if (formData.temperature < 0 || formData.temperature > 2) {
        next.temperature = "Temperature must be between 0 and 2.";
        valid = false;
      }
      if (formData.maxTokens < 1 || formData.maxTokens > 8192) {
        next.maxTokens = "Max tokens must be between 1 and 8192.";
        valid = false;
      }
    }

    setFieldErrors(next);
    return valid;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    if (step < 4) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  async function handleCreate() {
    setError("");
    try {
      const response = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/agents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not create agent");

      const agent = data as Agent;

      const versionResponse = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agent.id)}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_prompt: formData.systemPrompt.trim(),
            model: formData.model,
            temperature: formData.temperature,
            max_tokens: formData.maxTokens,
            tools_config: {},
          }),
        }
      );
      const versionData = await versionResponse.json();
      if (!versionResponse.ok)
        throw new Error(versionData.error || "Could not create agent version");

      setBusy(false);
      onComplete(agent.id);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Unexpected error");
    }
  }

  const isLastStep = step === 4;

  return (
    <>
      <dialog
        ref={dialogRef}
        open={leaveConfirmOpen}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,24rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
        onClose={() => setLeaveConfirmOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className="p-6 sm:p-8">
          <h2 className="text-sm font-semibold text-slate-900">Leave this page?</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            You have unsaved changes. Leaving will discard your progress.
          </p>
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setLeaveConfirmOpen(false);
                dialogRef.current?.close();
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-5 py-3 rounded-xl transition-all"
            >
              Stay
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaveConfirmOpen(false);
                setStep(1);
                setFormData(INITIAL_FORM);
                setFieldErrors({});
                router.push(`/dashboard/organizations/${orgId}/agents`);
              }}
              className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-md transition-all"
            >
              Leave
            </button>
          </div>
        </div>
      </dialog>

      <div className="w-full max-w-4xl bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b border-gray-100 mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">
              Create AI Agent
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure your agent and save it as a draft.
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200/60">
            Step {step} of 4
          </span>
        </div>

        {/* Stepper */}
        <div className="relative grid grid-cols-4 text-center mb-8">
          <div
            className="absolute top-4 left-[12%] right-[12%] h-0.5 bg-gray-200 -z-0"
          />
          {STEPS.map((s) => {
            const active = step === s.id;
            const completed = step > s.id;
            return (
              <div key={s.label} className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold mb-1.5 shadow-sm ${
                  active
                    ? "bg-indigo-600 text-white"
                    : completed
                      ? "bg-emerald-500 text-white"
                      : "bg-white border border-gray-200 text-gray-400"
                }`}>
                  {completed ? (
                    <Check className="size-3.5" />
                  ) : (
                    <span>{s.id}</span>
                  )}
                </div>
                <span className={`text-xs ${
                  active || completed
                    ? "font-semibold text-gray-900"
                    : "font-medium text-gray-400"
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form */}
        <div className="space-y-6 mb-8">
          {/* Step 1: Basic Info */}
          <div
            className={`space-y-6 transition-opacity duration-300 ${
              step === 1
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none absolute inset-0"
            }`}
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Agent Name
              </label>
              <input
                type="text"
                placeholder="e.g. Customer Support Agent"
                autoFocus={step === 1}
                value={formData.name}
                onChange={(e) => setField("name", e.target.value)}
                className={`w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs ${
                  fieldErrors.name
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100"
                    : "border-gray-200/85"
                }`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Describe what this agent should do..."
                value={formData.description}
                onChange={(e) => setField("description", e.target.value)}
                className={`w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs resize-none ${
                  fieldErrors.description
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100"
                    : "border-gray-200/85"
                }`}
              />
              {fieldErrors.description && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Agent Category
              </label>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setField("category", e.target.value as Category)
                  }
                  className="w-full bg-white text-xs text-gray-700 px-4 py-3 rounded-xl border border-gray-200/85 focus:border-gray-900/10 focus:ring-2 focus:ring-gray-900/10 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {fieldErrors.category && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.category}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Agent Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const selected = formData.icon === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setField("icon", opt.value)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                        selected
                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                          : "bg-white text-gray-600 border border-gray-200/80 hover:border-gray-900/10"
                      }`}
                    >
                      <opt.icon className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Instructions */}
          <div
            className={`space-y-6 transition-opacity duration-300 ${
              step === 2
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none absolute inset-0"
            }`}
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Role
              </label>
              <input
                type="text"
                placeholder="e.g. Support Assistant"
                value={formData.role}
                onChange={(e) => setField("role", e.target.value)}
                className="w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                System Instructions
              </label>
              <textarea
                rows={8}
                placeholder="Define the agent's behavior, persona, and instructions..."
                value={formData.systemPrompt}
                onChange={(e) => setField("systemPrompt", e.target.value)}
                className={`w-full bg-white text-xs text-gray-700 p-4 rounded-xl border focus:border-gray-900/10 focus:ring-2 focus:ring-gray-900/10 outline-none transition-all resize-none placeholder:text-gray-400 ${
                  fieldErrors.systemPrompt
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100"
                    : "border-gray-200/85"
                }`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {formData.systemPrompt.length}/20000 characters
              </p>
              {fieldErrors.systemPrompt && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.systemPrompt}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Behavior Guidelines
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Be helpful, accurate, and concise..."
                value={formData.behavior}
                onChange={(e) => setField("behavior", e.target.value)}
                className="w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Constraints
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Do not share sensitive information..."
                value={formData.constraints}
                onChange={(e) => setField("constraints", e.target.value)}
                className="w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Response Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {RESPONSE_STYLES.map((style) => {
                  const selected = formData.responseStyle === style.value;
                  return (
                    <label
                      key={style.value}
                      className={`cursor-pointer block border rounded-xl p-4 text-xs transition-colors flex items-center gap-2 ${
                        selected
                          ? "border-gray-900 bg-gray-50 text-gray-900"
                          : "border-gray-200/85 text-gray-700 hover:border-gray-900/10"
                      }`}
                    >
                      <input
                        type="radio"
                        name="responseStyle"
                        value={style.value}
                        checked={selected}
                        onChange={() => setField("responseStyle", style.value)}
                        className="accent-gray-900 shrink-0"
                      />
                      <span>{style.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 3: Model */}
          <div
            className={`space-y-6 transition-opacity duration-300 ${
              step === 3
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none absolute inset-0"
            }`}
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                AI Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((provider) => {
                  const selected = formData.provider === provider.value;
                  return (
                    <label
                      key={provider.value}
                      className={`cursor-pointer block border rounded-xl p-4 text-xs transition-colors flex items-center gap-2 ${
                        selected
                          ? "border-gray-900 bg-gray-50 text-gray-900"
                          : "border-gray-200/85 text-gray-700 hover:border-gray-900/10"
                      }`}
                    >
                      <input
                        type="radio"
                        name="provider"
                        value={provider.value}
                        checked={selected}
                        onChange={() => {
                          const models = getModelsForProvider(
                            provider.value as Provider
                          );
                          setField("provider", provider.value as Provider);
                          setField("model", models[0]);
                        }}
                        className="accent-gray-900 shrink-0"
                      />
                      <span>{provider.label}</span>
                    </label>
                  );
                })}
              </div>
              {fieldErrors.provider && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.provider}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Model
              </label>
              <div className="relative">
                <select
                  value={formData.model}
                  onChange={(e) => setField("model", e.target.value)}
                  className="w-full bg-white text-xs text-gray-700 px-4 py-3 rounded-xl border border-gray-200/85 focus:border-gray-900/10 focus:ring-2 focus:ring-gray-900/10 outline-none transition-all appearance-none cursor-pointer"
                >
                  {getModelsForProvider(formData.provider).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {fieldErrors.model && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.model}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Temperature
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) =>
                    setField("temperature", parseFloat(e.target.value))
                  }
                  className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0 (Deterministic)</span>
                  <span>2 (Creative)</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Max Output Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={String(formData.maxTokens)}
                  onChange={(e) => setField("maxTokens", Number(e.target.value))}
                  className="w-full bg-white border border-gray-200/85 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 shadow-2xs"
                />
              </div>
            </div>
            {fieldErrors.temperature && (
              <p className="text-xs text-rose-500 mt-1">{fieldErrors.temperature}</p>
            )}
            {fieldErrors.maxTokens && (
              <p className="text-xs text-rose-500 mt-1">{fieldErrors.maxTokens}</p>
            )}
          </div>

          {/* Step 4: Review */}
          <div
            className={`space-y-6 transition-opacity duration-300 ${
              step === 4
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none absolute inset-0"
            }`}
          >
            <div className="border border-gray-200/80 rounded-2xl p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Agent Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formData.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Draft v1.0</p>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Description
                    </p>
                    <p className="text-sm text-gray-700">
                      {formData.description || "—"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Category
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {CATEGORIES.find((c) => c.value === formData.category)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Status
                    </p>
                    <span className="bg-gray-100 text-gray-600 border border-gray-200/60 font-semibold px-2 py-0.5 rounded-md text-[10px]">
                      Draft
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Provider
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formData.provider.charAt(0).toUpperCase() + formData.provider.slice(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Model
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formData.model}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Temperature
                    </p>
                    <p className="text-sm text-gray-700">
                      {formData.temperature.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Max Tokens
                    </p>
                    <p className="text-sm text-gray-700">
                      {formData.maxTokens}
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    System Prompt
                  </p>
                  <p className="text-sm text-gray-700 italic">
                    {formData.systemPrompt || "—"}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Response Style
                  </p>
                  <p className="text-sm text-gray-700">
                    {RESPONSE_STYLES.find((s) => s.value === formData.responseStyle)?.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={step === 1 ? handleCancel : prevStep}
            disabled={busy}
            className={`bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium border border-gray-200/80 rounded-xl px-5 py-3 transition-all disabled:opacity-50 ${
              step === 1 ? "text-gray-400 border-transparent" : ""
            }`}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>
          <div className="ml-auto flex items-center gap-3">
            {!isLastStep ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={busy}
                className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-6 py-3 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                Continue
                <ArrowRight className="size-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium px-6 py-3 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {busy ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3" />
                )}
                Create Agent
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  function handleCancel() {
    if (hasUnsavedChanges) {
      setLeaveConfirmOpen(true);
    } else {
      router.push(`/dashboard/organizations/${orgId}/agents`);
    }
  }

  function getModelsForProvider(provider: Provider): string[] {
    return PROVIDERS.find((p) => p.value === provider)?.models ?? [];
  }
}
