import {
  AnalyticsIcon,
  AuditIcon,
  BotIcon,
  ChatIcon,
  DatabaseIcon,
  IntegrationIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "@/components/public/feature-icons";

const FEATURES = [
  {
    icon: BotIcon,
    title: "AI Agents",
    description: "Build configurable agents with tools and knowledge.",
    iconClassName: "bg-[#f0f1ff] text-[#7047ff]",
  },
  {
    icon: WorkflowIcon,
    title: "Workflows",
    description: "Design multi-step automations.",
    iconClassName: "bg-[#faf3ff] text-[#8b5cf6]",
  },
  {
    icon: DatabaseIcon,
    title: "Knowledge Base",
    description: "Connect documents and trusted sources.",
    iconClassName: "bg-[#f1f5ff] text-[#3b82f6]",
  },
  {
    icon: IntegrationIcon,
    title: "Integrations",
    description: "Link your favorite tools and services.",
    iconClassName: "bg-[#f0fdf4] text-[#28a745]",
  },
  {
    icon: ChatIcon,
    title: "Conversations",
    description: "A unified workspace to interact and collaborate.",
    iconClassName: "bg-[#fffbeb] text-[#d77d00]",
  },
  {
    icon: ShieldCheckIcon,
    title: "Human Approvals",
    description: "Add review steps for sensitive actions.",
    iconClassName: "bg-[#fff5f5] text-[#dc2626]",
  },
  {
    icon: AnalyticsIcon,
    title: "Analytics",
    description: "Understand usage and performance.",
    iconClassName: "bg-[#faf3ff] text-[#9333ea]",
  },
  {
    icon: AuditIcon,
    title: "Audit Logs",
    description: "Track activity and changes with full visibility.",
    iconClassName: "bg-[#f0f1ff] text-[#4f46e5]",
  },
];

/**
 * The features grid of the public landing page.
 *
 * It lists what the platform offers, one card per capability, and it follows
 * the hero section of the home page.
 */
export function FeaturesSection() {
  return (
    <section id="features" className="mt-6 font-sans antialiased">
      <div className="nx-features-header">
        <h2 className="nx-features-title">Features</h2>
        <p className="nx-features-subtitle">
          Everything you need to build, deploy, and scale intelligent agents.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-[1000px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.title}
              className="flex flex-col justify-between space-y-4 rounded-[16px] border border-[#dedede] bg-white p-5 shadow-2xs"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${feature.iconClassName}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="m-0 text-[14px] font-semibold text-[#171717]">
                  {feature.title}
                </h3>
                <p className="m-0 text-[12px] leading-[1.5] text-[#666]">
                  {feature.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
