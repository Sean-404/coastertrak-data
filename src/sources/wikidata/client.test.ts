import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSparqlPage } from "./client.js";

describe("wikidata client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on 429 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ results: { bindings: [{ item: { type: "uri", value: "x" } }] } }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const bindings = await fetchSparqlPage("SELECT ?item WHERE { }", {
      retry: { maxAttempts: 2, initialDelayMs: 1 },
    });
    expect(bindings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
    );

    await expect(
      fetchSparqlPage("SELECT ?item WHERE { }", {
        retry: { maxAttempts: 2, initialDelayMs: 1 },
      }),
    ).rejects.toBeInstanceOf(Response);
  });
});
