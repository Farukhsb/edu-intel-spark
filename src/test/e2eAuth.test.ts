import { afterEach, describe, expect, it, vi } from "vitest";

import { E2E_AUTH_STORAGE_KEY, readE2EAuthState } from "@/lib/e2eAuth";

const originalWindow = globalThis.window;

const createWindowMock = (storedValue: string | null) =>
  ({
    location: { hostname: "localhost" },
    localStorage: {
      getItem: vi.fn(() => storedValue),
      removeItem: vi.fn(),
    },
  }) as unknown as Window & typeof globalThis;

describe("e2eAuth", () => {
  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("returns null for malformed stored auth state", () => {
    Object.defineProperty(globalThis, "window", {
      value: createWindowMock(
        JSON.stringify({
          user: { id: "user-1" },
          profile: { id: "user-1", role: "staff" },
        }),
      ),
      configurable: true,
    });

    expect(readE2EAuthState()).toBeNull();
  });

  it("returns normalized local auth state for a valid stored payload", () => {
    Object.defineProperty(globalThis, "window", {
      value: createWindowMock(
        JSON.stringify({
          user: { id: "user-1", email: null },
          profile: {
            id: "user-1",
            full_name: "Demo Lecturer",
            email: "lecturer@example.test",
            role: "lecturer",
            avatar_url: null,
            cohort_id: null,
            department_id: "cs",
          },
        }),
      ),
      configurable: true,
    });

    expect(readE2EAuthState()).toEqual({
      user: {
        id: "user-1",
        email: "lecturer@example.test",
      },
      profile: {
        id: "user-1",
        full_name: "Demo Lecturer",
        email: "lecturer@example.test",
        role: "lecturer",
        avatar_url: null,
        cohort_id: null,
        department_id: "cs",
      },
    });
  });
});
