import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendPushNotification } from "@/lib/push";

describe("Push notification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null when NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set", async () => {
    // Clear the environment variables
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const mockSubscription = {
      endpoint: "https://example.com/push",
      keys: {
        p256dh: "test-key",
        auth: "test-auth",
      },
    };

    const payload = {
      title: "Test",
      body: "Test body",
    };

    const result = await sendPushNotification(mockSubscription, payload);
    expect(result).toBeNull();
  });

  it("returns null when VAPID_PRIVATE_KEY is not set", async () => {
    // Set only the public key
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    delete process.env.VAPID_PRIVATE_KEY;

    const mockSubscription = {
      endpoint: "https://example.com/push",
      keys: {
        p256dh: "test-key",
        auth: "test-auth",
      },
    };

    const payload = {
      title: "Test",
      body: "Test body",
    };

    const result = await sendPushNotification(mockSubscription, payload);
    expect(result).toBeNull();
  });
});
