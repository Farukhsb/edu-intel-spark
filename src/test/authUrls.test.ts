import { getPasswordResetRedirectUrl } from "@/lib/authUrls";

describe("auth redirect URLs", () => {
  it("uses the current origin when no app URL override is configured", () => {
    expect(
      getPasswordResetRedirectUrl({
        origin: "https://edu-spark.pages.dev",
      })
    ).toBe("https://edu-spark.pages.dev/reset-password");
  });

  it("prefers an explicit app URL override and trims trailing slashes", () => {
    expect(
      getPasswordResetRedirectUrl({
        origin: "http://localhost:5173",
        configuredAppUrl: "https://edu-spark.pages.dev/",
      })
    ).toBe("https://edu-spark.pages.dev/reset-password");
  });
});
