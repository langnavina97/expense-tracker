import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "../api";

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({}),
    ...response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("api request wrapper", () => {
  it("returns parsed JSON on success", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ id: 1, name: "Test" }) });

    const result = await api.me();

    expect(result).toEqual({ id: 1, name: "Test" });
  });

  it("sends credentials and JSON headers", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await api.me();

    expect(fetchMock).toHaveBeenCalledWith(
      "/users/me",
      expect.objectContaining({
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("returns undefined for a 204 response without trying to parse a body", async () => {
    const jsonSpy = vi.fn();
    mockFetchOnce({ ok: true, status: 204, json: jsonSpy });

    const result = await api.logout();

    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it("throws an ApiError with the server's message on failure", async () => {
    mockFetchOnce({ ok: false, status: 401, json: async () => ({ error: "Invalid email or password." }) });

    await expect(api.login({ email: "a@b.com", password: "wrong" })).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password.",
    });
  });

  it("falls back to a generic message if the error response has no error field", async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => ({}) });

    await expect(api.me()).rejects.toMatchObject({ status: 500, message: "Something went wrong." });
  });

  it("falls back to a generic message if the error response isn't valid JSON", async () => {
    mockFetchOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.me()).rejects.toMatchObject({ status: 500, message: "Something went wrong." });
  });

  it("ApiError carries the HTTP status", () => {
    const error = new ApiError(404, "Not found.");

    expect(error.status).toBe(404);
    expect(error.message).toBe("Not found.");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("api methods build the expected requests", () => {
  it("createExpense POSTs to /expenses with the given payload", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 201, json: async () => ({ id: 1 }) });
    const payload = { title: "Tacos", categoryId: 1, spenderIds: [1], currency: "USD", amount: 500, date: "2026-01-01" };

    await api.createExpense(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/expenses",
      expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
    );
  });

  it("deleteExpense DELETEs to /expenses/:id", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({ message: "ok" }) });

    await api.deleteExpense(42);

    expect(fetchMock).toHaveBeenCalledWith("/expenses/42", expect.objectContaining({ method: "DELETE" }));
  });

  it("updateMemberRole PATCHes to /households/members/:id", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await api.updateMemberRole(7, { role: "ADULT" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/households/members/7",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "ADULT" }) })
    );
  });

  it("removeMember DELETEs to /households/members/:id", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await api.removeMember(7);

    expect(fetchMock).toHaveBeenCalledWith("/households/members/7", expect.objectContaining({ method: "DELETE" }));
  });

  it("removeDependent DELETEs to /households/dependents/:id", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({}) });

    await api.removeDependent(3);

    expect(fetchMock).toHaveBeenCalledWith(
      "/households/dependents/3",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("suggestCategory POSTs the title to /expenses/suggest-category", async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 200, json: async () => ({ suggestedCategory: null }) });

    await api.suggestCategory("Cinema tickets");

    expect(fetchMock).toHaveBeenCalledWith(
      "/expenses/suggest-category",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Cinema tickets" }) })
    );
  });
});
