import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthRequestError, getAuthRequestMessage, postAuthJson } from "@/lib/auth-api-client";

describe("auth API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON and returns the API payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "authenticated" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postAuthJson("/api/login", { email: "user@example.com" })).resolves.toEqual({
      ok: true,
      payload: { status: "authenticated" },
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    }));
  });

  it("reports a useful message when the network is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(postAuthJson("/api/login", {})).rejects.toThrow(AuthRequestError);
    await expect(postAuthJson("/api/login", {})).rejects.toThrow("Revisa tu conexión");
  });

  it("does not expose unknown errors to the user", () => {
    expect(getAuthRequestMessage(new Error("internal"), "No fue posible ingresar.")).toBe(
      "No fue posible ingresar.",
    );
  });
});
