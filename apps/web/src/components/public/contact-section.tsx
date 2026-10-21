"use client";

import Link from "next/link";
import { useState } from "react";

const SUBJECTS = [
  { value: "general", label: "General inquiry" },
  { value: "sales", label: "Sales and pricing" },
  { value: "demo", label: "Request a demo" },
  { value: "support", label: "Technical support" },
  { value: "partnership", label: "Partnerships" },
];

const CHANNELS = [
  {
    title: "Email",
    value: "hello@nexora.ai",
    href: "mailto:hello@nexora.ai",
    description: "For general inquiries",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" stroke="none" />
        <path d="m4 7 8 6 8-6" stroke="#e8e5ff" fill="none" />
      </>
    ),
  },
  {
    title: "Sales",
    value: "sales@nexora.ai",
    href: "mailto:sales@nexora.ai",
    description: "Talk to our team about your needs",
    icon: (
      <>
        <circle cx="12" cy="7" r="3" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="9" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="19.5" cy="9" r="2.5" fill="currentColor" stroke="none" />
        <path d="M7 21v-4a5 5 0 0 1 10 0v4H7ZM1 19v-3a3.5 3.5 0 0 1 5-3.2M23 19v-3a3.5 3.5 0 0 0-5-3.2" />
      </>
    ),
  },
  {
    title: "Support",
    value: "support@nexora.ai",
    href: "mailto:support@nexora.ai",
    description: "Get help with your workspace",
    icon: (
      <>
        <path d="M4 14v-3a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3" />
        <rect x="2" y="11" width="5" height="8" rx="2" fill="currentColor" />
        <rect x="17" y="11" width="5" height="8" rx="2" fill="currentColor" />
      </>
    ),
  },
  {
    title: "Office",
    value: "Kuala Lumpur, Malaysia",
    href: null,
    description: "Our main office",
    icon: (
      <>
        <path
          d="M12 22S3 14 3 9a9 9 0 0 1 18 0c0 5-9 13-9 13Z"
          fill="currentColor"
          stroke="none"
        />
        <circle cx="12" cy="9" r="3" fill="#e7e5ff" stroke="none" />
      </>
    ),
  },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    path: "M4 8h4v13H4V8Zm2-6a2.3 2.3 0 1 1 0 4.6A2.3 2.3 0 0 1 6 2Zm4 6h4v1.8c.7-1.2 1.8-2.1 3.7-2.1 3.1 0 4.3 2 4.3 5.5V21h-4v-7c0-1.8-.4-3.1-2-3.1-1.7 0-2 1.4-2 3.1v7h-4V8Z",
  },
  {
    label: "Twitter",
    path: "M22 5.9a8.3 8.3 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3c-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.8 11.7 11.7 0 0 1-8.5-4.3 4.1 4.1 0 0 0 1.3 5.5 4 4 0 0 1-1.9-.5 4.1 4.1 0 0 0 3.3 4 4.2 4.2 0 0 1-1.8.1 4.1 4.1 0 0 0 3.9 2.9A8.3 8.3 0 0 1 2 18.5a11.7 11.7 0 0 0 18-9.9v-.5c.8-.6 1.4-1.3 2-2.2Z",
  },
  {
    label: "YouTube",
    path: "M10 9l6 3-6 3V9Z",
    rect: true,
  },
  {
    label: "GitHub",
    path: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.4-1.1.7-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.7 9.7 0 0 1 5.1 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z",
  },
];

/**
 * The contact section of the public landing page.
 *
 * The form sends the message to the backend, the answer of the request is
 * shown below the button.
 */
export function ContactSection() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setBusy(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof payload.detail === "string"
            ? payload.detail
            : "The message could not be sent. Please try again."
        );
        return;
      }
      form.reset();
      setStatus(payload.message ?? "Thanks for reaching out.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="contact" className="nx-contact" aria-labelledby="contact-heading">
      <div className="nx-section-header">
        <h2 className="nx-section-title" id="contact-heading">
          Contact
        </h2>
      </div>
      <div className="nx-contact-hero">
        <div className="nx-contact-copy">
          <span className="nx-contact-badge">CONTACT</span>
          <h1 className="nx-contact-title" id="contact-title">
            Get in touch
          </h1>
          <p className="nx-contact-description">
            We&apos;d love to hear from you. Send us a message and we&apos;ll
            get back to you as soon as possible.
          </p>
        </div>

        <div className="nx-contact-illustration" aria-hidden="true">
          <div className="nx-contact-glass" />
          <div className="nx-contact-glass nx-contact-glass-back" />

          <svg className="nx-contact-plane" viewBox="0 0 300 220">
            <defs>
              <linearGradient id="contactWing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#d8e5ff" />
                <stop offset="1" stopColor="#7f8fff" />
              </linearGradient>
              <linearGradient id="contactFold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a7b0ff" />
                <stop offset="1" stopColor="#6842ff" />
              </linearGradient>
              <linearGradient id="contactRightWing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#d8e9ff" />
                <stop offset="1" stopColor="#aacbff" />
              </linearGradient>
            </defs>

            <path d="M15 92 280 15 92 126Z" fill="url(#contactWing)" />
            <path d="m92 126 188-111-144 156-20 32Z" fill="url(#contactFold)" />
            <path d="m116 203 20-32 32 17Z" fill="#6948f2" />
            <path d="M280 15 212 198 136 171Z" fill="url(#contactRightWing)" />
            <path
              d="M15 92 280 15 92 126"
              fill="none"
              stroke="#eef4ff"
              strokeWidth="1.5"
            />
          </svg>

          <div className="nx-contact-tile">
            <svg className="nx-outline" viewBox="0 0 24 24">
              <path d="M4 3h16a2 2 0 0 1 2 2v14H8l-6 3V5a2 2 0 0 1 2-2Z" />
              <path d="M3 6c4 5 7 7 11 5s5-2 8-1" />
            </svg>
          </div>

          <div className="nx-contact-tile nx-contact-tile-small">
            <svg className="nx-outline" viewBox="0 0 24 24">
              <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
              <path d="m8 9 3 3-3 3m4-3h5" />
            </svg>
          </div>

          <div className="nx-contact-future">
            Let&apos;s build
            <br />
            the future together
          </div>
        </div>
      </div>

      <div className="nx-contact-grid">
        <section className="nx-contact-card" aria-labelledby="contact-form-title">
          <h2 className="nx-contact-card-title" id="contact-form-title">
            Send us a message
          </h2>

          <form onSubmit={submit}>
            <div className="nx-contact-field">
              <label htmlFor="contactName">
                Full Name <span className="nx-contact-required">*</span>
              </label>
              <input
                id="contactName"
                name="name"
                type="text"
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>

            <div className="nx-contact-field">
              <label htmlFor="contactEmail">
                Work Email <span className="nx-contact-required">*</span>
              </label>
              <input
                id="contactEmail"
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="nx-contact-field">
              <label htmlFor="contactSubject">
                Subject <span className="nx-contact-required">*</span>
              </label>
              <div className="nx-contact-select">
                <select id="contactSubject" name="subject" required defaultValue="">
                  <option value="" disabled>
                    Select a topic
                  </option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject.value} value={subject.value}>
                      {subject.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="nx-contact-field">
              <label htmlFor="contactMessage">
                Message <span className="nx-contact-required">*</span>
              </label>
              <textarea
                id="contactMessage"
                name="message"
                placeholder="Write your message..."
                required
              />
            </div>

            <button className="nx-contact-send" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send Message"}
            </button>

            <p
              className="nx-contact-status"
              role={error ? "alert" : "status"}
            >
              {error || status}
            </p>

            <p className="nx-contact-privacy">
              By submitting this form, you agree to our{" "}
              <Link href="/privacy">Privacy Policy.</Link>
            </p>
          </form>
        </section>

        <div className="nx-contact-column">
          <section className="nx-contact-card" aria-labelledby="contact-info-title">
            <h2 className="nx-contact-card-title" id="contact-info-title">
              Contact information
            </h2>
            <p className="nx-contact-card-description">
              Reach out through any of the channels below.
            </p>

            <div className="nx-contact-list">
              {CHANNELS.map((channel) => (
                <div key={channel.title} className="nx-contact-item">
                  <span className="nx-contact-icon">
                    <svg className="nx-outline" viewBox="0 0 24 24" aria-hidden="true">
                      {channel.icon}
                    </svg>
                  </span>
                  <div>
                    <h3>{channel.title}</h3>
                    {channel.href ? (
                      <a className="nx-contact-value" href={channel.href}>
                        {channel.value}
                      </a>
                    ) : (
                      <span className="nx-contact-value">{channel.value}</span>
                    )}
                    <p>{channel.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="nx-contact-card" aria-labelledby="contact-follow-title">
            <h2 className="nx-contact-card-title" id="contact-follow-title">
              Follow us
            </h2>
            <p className="nx-contact-card-description">
              Stay updated with the latest news and product updates.
            </p>

            <nav className="nx-contact-socials" aria-label="Social media">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  className="nx-contact-social"
                  href={`/dashboard?social=${social.label.toLowerCase()}`}
                  aria-label={social.label}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {social.rect ? (
                      <>
                        <rect
                          x="2"
                          y="5"
                          width="20"
                          height="14"
                          rx="4"
                          fill="currentColor"
                        />
                        <path d="m10 9 6 3-6 3V9Z" fill="white" />
                      </>
                    ) : (
                      <path d={social.path} fill="currentColor" />
                    )}
                  </svg>
                </a>
              ))}
            </nav>
          </section>
        </div>
      </div>
    </section>
  );
}
