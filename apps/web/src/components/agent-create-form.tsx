"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Globe,
  Headset,
  LoaderCircle,
  Plus,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { Agent } from "@/lib/api";

type Category = "support" | "sales" | "hr" | "engineering";
type ResponseStyle = "professional" | "friendly" | "concise" | "detailed";
type Provider = "openai" | "claude";

type FormData = {
  name: string;
  description: string;
  category: Category;
  systemPrompt: string;
  responseStyle: ResponseStyle;
  provider: Provider;
  model: string;
  temperature: number;
};

const INITIAL_FORM: FormData = {
  name: "",
  description: "",
  category: "support",
  systemPrompt: "",
  responseStyle: "professional",
  provider: "openai",
  model: "gpt-4o",
  temperature: 0.7,
};

const CATEGORIES: { value: Category; label: string; icon: React.ElementType }[] = [
  { value: "support", label: "Customer Support", icon: Headset },
  { value: "sales", label: "Sales & Marketing", icon: ShoppingBag },
  { value: "hr", label: "Human Resources", icon: Users },
  { value: "engineering", label: "Engineering & Workflow", icon: Globe },
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

const STEP_LABELS = ["Basic Info", "Instructions", "Model", "Review"];

function getModelsForProvider(provider: Provider): string[] {
  return PROVIDERS.find((p) => p.value === provider)?.models ?? [];
}

export function AgentCreateForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [open]);

  const setField = (key: keyof FormData, value: string | number) => {
    setFormData((prev) => {
      const next = { ...prev } as Record<string, string | number>;
      next[key] = value;
      return next as FormData;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  function validateStep(step: number): boolean {
    const next: Record<string, string> = {};
    let valid = true;

    if (step === 1) {
      if (!formData.name.trim()) {
        next.name = "Agent name is required.";
        valid = false;
      } else if (formData.name.trim().length < 2) {
        next.name = "Agent name must be at least 2 characters.";
        valid = false;
      }
      if (!formData.category) {
        next.category = "Please select a category.";
        valid = false;
      }
    }

    if (step === 2) {
      if (!formData.systemPrompt.trim()) {
        next.systemPrompt = "System prompt is required.";
        valid = false;
      } else if (formData.systemPrompt.trim().length < 10) {
        next.systemPrompt = "System prompt must be at least 10 characters.";
        valid = false;
      }
      if (!formData.responseStyle) {
        next.responseStyle = "Please select a response style.";
        valid = false;
      }
    }

    if (step === 3) {
      if (!formData.provider) {
        next.provider = "Please select a provider.";
        valid = false;
      }
      if (!formData.model) {
        next.model = "Please select a model.";
        valid = false;
      }
    }

    setFieldErrors(next);
    return valid;
  }

  function nextStep() {
    if (!validateStep(currentStep)) return;
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  }

  function prevStep() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  async function handleCreate() {
    setError("");
    try {
      const agentResponse = await fetch(
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
      const agentData = await agentResponse.json();
      if (!agentResponse.ok)
        throw new Error(agentData.error || "Could not create agent");

      const agent = agentData as Agent;

      const versionResponse = await fetch(
        `/api/workspace/${encodeURIComponent(orgId)}/agents/${encodeURIComponent(agent.id)}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_prompt: formData.systemPrompt.trim(),
            model: formData.model,
            temperature: formData.temperature,
            max_tokens: 4096,
            tools_config: {},
          }),
        }
      );
      const versionData = await versionResponse.json();
      if (!versionResponse.ok)
        throw new Error(versionData.error || "Could not create agent version");

      setOpen(false);
      setFormData(INITIAL_FORM);
      setFieldErrors({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setBusy(false);
    }
  }

  const progressWidth = ((currentStep - 1) / 3) * 100;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
      >
        <Plus className="size-4" /> New Agent
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="create-agent-title"
        aria-describedby="create-agent-description"
        onClose={() => {
          setOpen(false);
          setCurrentStep(1);
          setFormData(INITIAL_FORM);
          setFieldErrors({});
          setError("");
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialogRef.current?.close();
          }
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,40rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
      >
        <div className="p-8 sm:p-10">
          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors mt-1 ${
                currentStep === 1 ? "opacity-0 pointer-events-none" : ""
              }`}
            >
              <ArrowLeft className="size-3" />
            </button>
            <div>
              <h1 id="create-agent-title" className="text-xl font-bold text-slate-900 tracking-tight">
                Create AI Agent
              </h1>
              <p id="create-agent-description" className="text-xs text-slate-400 mt-0.5">
                Configure your intelligent assistant
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative flex items-center justify-between mb-6 px-4">
            <div className="absolute left-8 right-8 top-4 h-[1px] bg-slate-200 -z-0" />
            <div
              className="absolute left-8 top-3.5 h-[1px] bg-blue-600 -z-0 origin-left"
              style={{ width: `${progressWidth}%`, transition: "width 0.3s ease" }}
            />
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const isActive = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;
              return (
                <div
                  key={label}
                  className="flex flex-col items-center relative z-10"
                >
                  <div className={`w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-white border border-slate-200 text-slate-400"
                  }`}>
                    {isCompleted ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span>{stepNum}</span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] mt-2 transition-colors ${
                      isActive || isCompleted
                        ? "font-semibold text-slate-900"
                        : "font-medium text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <hr className="border-slate-100 mb-8" />

          {/* Steps */}
          <div className="relative min-h-[320px]">
            {/* Step 1: Basic Info */}
            <div
              className={`space-y-6 transition-opacity duration-300 ${
                currentStep === 1
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Agent Name
                </label>
                <input
                  type="text"
                  autoFocus={currentStep === 1}
                  placeholder="e.g. Customer Support Agent"
                  value={formData.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={`w-full bg-white text-xs text-slate-700 px-4 py-3 rounded-xl border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400 ${
                    fieldErrors.name ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200"
                  }`}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what your agent will do..."
                  value={formData.description}
                  onChange={(e) => setField("description", e.target.value)}
                  className={`w-full bg-white text-xs text-slate-700 p-4 rounded-xl border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none placeholder:text-slate-400 ${
                    fieldErrors.description ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200"
                  }`}
                />
                {fieldErrors.description && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.description}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Agent Category
                </label>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) => setField("category", e.target.value as Category)}
                    className="w-full bg-white text-xs text-slate-700 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
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
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none" />
                </div>
                {fieldErrors.category && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.category}</p>
                )}
              </div>
            </div>

            {/* Step 2: Instructions */}
            <div
              className={`space-y-6 transition-opacity duration-300 ${
                currentStep === 2
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  System Prompt
                </label>
                <textarea
                  id="systemPrompt"
                  rows={6}
                  placeholder="Define the agent's behavior, persona, and instructions..."
                  value={formData.systemPrompt}
                  onChange={(e) => setField("systemPrompt", e.target.value)}
                  className={`w-full bg-white text-xs text-slate-700 p-4 rounded-xl border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none placeholder:text-slate-400 ${
                    fieldErrors.systemPrompt ? "border-rose-500 focus:border-rose-500 focus:ring-rose-100" : "border-slate-200"
                  }`}
                />
                {fieldErrors.systemPrompt && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.systemPrompt}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
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
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="responseStyle"
                          value={style.value}
                          checked={selected}
                          onChange={() => setField("responseStyle", style.value)}
                          className="accent-blue-600 shrink-0"
                        />
                        <span>{style.label}</span>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.responseStyle && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.responseStyle}</p>
                )}
              </div>
            </div>

            {/* Step 3: Model */}
            <div
              className={`space-y-6 transition-opacity duration-300 ${
                currentStep === 3
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
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
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="provider"
                          value={provider.value}
                          checked={selected}
                          onChange={() => {
                            const models = getModelsForProvider(provider.value as Provider);
                            setField("provider", provider.value as Provider);
                            setField("model", models[0]);
                          }}
                          className="accent-blue-600 shrink-0"
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
                <label className="text-xs font-bold text-slate-800 block">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={formData.model}
                    onChange={(e) => setField("model", e.target.value)}
                    className="w-full bg-white text-xs text-slate-700 px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {getModelsForProvider(formData.provider).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none" />
                </div>
                {fieldErrors.model && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.model}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block flex justify-between">
                  <span>Temperature</span>
                  <span className="text-slate-500 font-medium">
                    {formData.temperature.toFixed(1)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) =>
                    setField("temperature", parseFloat(e.target.value))
                  }
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Controls randomness: lower is more deterministic, higher is more creative.
                </p>
              </div>
            </div>

            {/* Step 4: Review */}
            <div
              className={`space-y-6 transition-opacity duration-300 ${
                currentStep === 4
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none absolute inset-0"
              }`}
            >
              <div className="border border-slate-200 rounded-xl p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Agent Name
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formData.name}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">v1.0</p>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">
                        {formData.description || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Category
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {CATEGORIES.find((c) => c.value === formData.category)?.label}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Status
                      </p>
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 font-semibold px-2 py-0.5 rounded-md text-[10px]">
                        Draft
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Provider
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formData.provider.charAt(0).toUpperCase() + formData.provider.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Model
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formData.model}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    System Prompt
                  </p>
                  <p className="text-sm text-slate-700 italic">
                    {formData.systemPrompt || "—"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Response Style
                  </p>
                  <p className="text-sm text-slate-700">
                    {RESPONSE_STYLES.find((s) => s.value === formData.responseStyle)?.label}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Temperature
                  </p>
                  <p className="text-sm text-slate-700">
                    {formData.temperature.toFixed(1)}
                  </p>
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
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (confirm("Cancel creating this agent? All entered data will be lost.")) {
                  dialogRef.current?.close();
                }
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-5 py-3 rounded-xl transition-all"
            >
              Cancel
            </button>
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={busy}
                className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-60"
              >
                Next Step <ArrowRight className="size-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3" />
                )}
                Create Agent
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
