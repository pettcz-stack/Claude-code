import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("graph client", () => {
  it("hides a comment via POST is_hidden=true", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const { graph } = await import("./graph-client");
    await graph.hideComment("comment-id", "token-xyz");

    const callUrl = fetchMock.mock.calls[0][0] as string;
    expect(callUrl).toContain("/comment-id?");
    expect(callUrl).toContain("is_hidden=true");
    expect(callUrl).toContain("access_token=token-xyz");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("deletes a comment via DELETE", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    const { graph } = await import("./graph-client");
    await graph.deleteComment("cid", "tok");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("throws GraphApiError on non-2xx", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 190, message: "Invalid OAuth" } }), { status: 401 })
    );

    const { graph, GraphApiError } = await import("./graph-client");
    await expect(graph.hideComment("c", "t")).rejects.toBeInstanceOf(GraphApiError);
  });

  it("exchanges code for token via /oauth/access_token", async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "SL-token" }), { status: 200 })
    );
    const { graph } = await import("./graph-client");
    const res = await graph.exchangeCodeForToken("the-code");
    expect(res.access_token).toBe("SL-token");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/oauth/access_token");
    expect(url).toContain("code=the-code");
  });
});
