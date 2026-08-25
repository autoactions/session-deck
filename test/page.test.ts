import { describe, expect, it } from "vitest";
import { createWorker } from "../src/worker.ts";
import { FakeGitHub } from "./fake-github.ts";

describe("management page", () => {
  it("serves a public shell that mounts discovered targets after unlock", async () => {
    const fetchImpl = createWorker({
      adminToken: "test-admin-token",
      github: new FakeGitHub(),
      repos: ["autoactions/debug-session", "autoactions/tsvc"],
    });
    const response = await fetchImpl(new Request("https://control.test/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    const html = await response.text();
    expect(html).toContain('lang="en"');
    expect(html).toContain("<title>Session Deck</title>");
    expect(html).toContain("Session Deck");
    expect(html).toContain("viewport");
    expect(html).toContain('id="board-empty"');
    expect(html).toContain("No targets");
    expect(html).toContain("function mount");
    expect(html).toContain("data-input-pick");
    expect(html).toContain("/api/targets");
    expect(html).not.toContain("/api/slots");
    expect(html).not.toContain("data-slot=");
    expect(html).toContain("Instrument Serif");
    expect(html).toContain("IBM Plex Mono");
    expect(html).toContain("Admin Token");
    expect(html).toContain("autoactions/debug-session");
    expect(html).toContain("autoactions/tsvc");
    expect(html).toContain('cache: "no-store"');
    expect(html).toContain('fact.querySelector(".fact-copy")');
    expect(html).toContain('id="project-select"');
    expect(html).toContain('id="target-picks"');
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain('role="radiogroup" aria-label="Target"');
    expect(html).toContain("function targetsForProject");
    expect(html).toContain("function setProject");
    expect(html).toContain("session-deck-project-targets");
    expect(html).not.toContain("const picks = CATALOG.map");
    expect(html).toContain("Enter");
    expect(html).toContain("Lock");
    expect(html).toContain("Open");
    expect(html).toContain("Close");
    expect(html).toContain("Journal");
    expect(html).toContain("Sessions");
    expect(html).toContain("Last run");
    expect(html).toContain(">For<");
    expect(html).toContain(">Left<");
    expect(html).toContain(">Elapsed<");
    expect(html).toContain("data-locator-fact");
    expect(html).toContain("setLocatorFacts");
    expect(html).not.toContain("data-address-fact");
    expect(html).not.toContain("data-ssh-channel");
    expect(html).not.toContain("data-rdp-channel");
    expect(html).toContain("Close \" + meta(id).label");
    expect(html).toContain("This stops the GitHub run");
    expect(html).toContain("btn-danger");
    expect(html).not.toContain("<dt>Slot</dt>");
    expect(html).not.toMatch(/[\u4e00-\u9fff]/);
    expect(html).not.toContain("#38bdf8");
    expect(html).not.toContain("Geist Mono");
  });

  it("serves the concentric mark", async () => {
    const fetchImpl = createWorker({
      adminToken: "test-admin-token",
      github: new FakeGitHub(),
    });
    const response = await fetchImpl(new Request("https://control.test/assets/mark.svg"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(await response.text()).toContain('r="13"');
  });
});
