import { afterEach, describe, expect, it } from "vitest";

import { sessionCookieSecure } from "@/lib/session-cookie";

const originalCookieSecure = process.env.COOKIE_SECURE;

afterEach(() => {
  if (originalCookieSecure === undefined) {
    delete process.env.COOKIE_SECURE;
  } else {
    process.env.COOKIE_SECURE = originalCookieSecure;
  }
});

describe("session cookies", () => {
  it("stays readable on the local HTTP staging check", () => {
    process.env.COOKIE_SECURE = "false";
    expect(sessionCookieSecure()).toBe(false);
  });

  it("is marked Secure behind the public HTTPS proxy", () => {
    process.env.COOKIE_SECURE = "true";
    expect(sessionCookieSecure()).toBe(true);
  });
});
