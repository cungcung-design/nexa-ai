import { BrainCircuit, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.9fr)]">
      <section className="flex flex-col justify-between border-b border-slate-200 px-6 py-6 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-10 xl:px-20">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-3 rounded-lg text-base font-semibold text-slate-900"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <BrainCircuit className="size-5" />
          </span>
          Nexa AI
        </Link>
        <div className="my-12 max-w-xl lg:my-0">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            AI operations workspace
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl xl:text-[42px]">
            Build and operate AI agents with confidence.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            Bring your agents, knowledge, conversations, and workflows together
            in one secure workspace.
          </p>
        </div>
        <div className="hidden gap-6 text-sm text-slate-500 lg:flex">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-indigo-600" /> Tenant aware
          </span>
          <span className="inline-flex items-center gap-2">
            <Workflow className="size-4 text-indigo-600" /> Built for teams
          </span>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mb-8 mt-2 text-sm leading-6 text-slate-600">
            {description}
          </p>
          {children}
        </div>
      </section>
    </main>
  );
}
