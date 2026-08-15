import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";

describe("management page", () => {
  it("serves a public responsive page for both slots", async () => {
    const fetchImpl = createWorker({
      adminToken: "test-admin-token",
      github: new FakeGitHub(),
    });
    const response = await fetchImpl(new Request("https://control.test/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    const html = await response.text();
    expect(html).toContain("viewport");
    expect(html).toContain("debug-session-linux");
    expect(html).toContain("debug-session-windows");
    expect(html).toContain("/api/slots");
  });
});
