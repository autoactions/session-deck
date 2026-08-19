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
    expect(html).toContain('lang="en"');
    expect(html).toContain("viewport");
    expect(html).toContain('data-slot="linux"');
    expect(html).toContain('data-slot="windows"');
    expect(html).toContain('data-slot-pick="linux"');
    expect(html).toContain('data-slot-pick="windows"');
    expect(html).toContain('role="radiogroup"');
    expect(html).not.toContain("data-slot-select");
    expect(html).not.toContain("data-slot-switch");
    expect(html).not.toContain("debug-session-linux");
    expect(html).not.toContain("debug-session-windows");
    expect(html).toContain("/api/slots");
    expect(html).toContain("Instrument Serif");
    expect(html).toContain("IBM Plex Mono");
    expect(html).toContain("Admin Token");
    expect(html).toContain("Access Profile");
    expect(html).toContain("Session Profile");
    expect(html).toContain('data-access-pick="mini"');
    expect(html).toContain('data-access-pick="full"');
    expect(html).toContain('data-session-pick="core"');
    expect(html).toContain('data-session-pick="developer"');
    expect(html).toContain('data-wsl-pick="false"');
    expect(html).toContain('data-wsl-pick="true"');
    expect(html.indexOf('data-session-pick="core"')).toBeLessThan(html.indexOf('data-access-pick="mini"'));
    expect(html).toContain('cache: "no-store"');
    expect(html).toContain('fact.querySelector(".fact-copy")');
    expect(html).not.toContain('removeAttribute("data-copy")');
    expect(html).not.toContain("data-ssh-copy");
    expect(html).not.toContain('name="access_profile"');
    expect(html).not.toContain('name="session_profile"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("data-access-fact");
    expect(html).not.toContain("data-session-fact");
    expect(html).not.toContain("data-wsl-fact");
    expect(html).not.toContain("font-style: italic");
    expect(html).toContain("Enter");
    expect(html).toContain("Lock");
    expect(html).toContain("Open");
    expect(html).toContain("Close");
    expect(html).toContain("Journal");
    expect(html).toContain("Slots");
    expect(html).toContain("Last run");
    expect(html).toContain(">For<");
    expect(html).toContain(">Host<");
    expect(html).toContain(">SSH<");
    expect(html).toContain(">RDP<");
    expect(html).toContain(">Left<");
    expect(html).toContain(">Elapsed<");
    expect(html).toContain("data-channels");
    expect(html).toContain("data-ssh-channel");
    expect(html).toContain("data-rdp-channel");
    expect(html).toContain("data-rdp-fact");
    expect(html).toContain("SSH <strong>open</strong>");
    expect(html).toContain("RDP <strong>open</strong>");
    expect(html).toContain("setFact(\"rdp\", rdpOpen ? slot.rdp : \"\")");
    expect(html).toContain("rdpOpen = joined && !!slot.rdp");
    expect(html).not.toContain(">Address<");
    expect(html).not.toContain("data-address-fact");
    const forAt = html.indexOf(">For<");
    const runAt = html.indexOf(">Last run<");
    const hostAt = html.indexOf(">Host<");
    const sshAt = html.indexOf(">SSH<");
    const rdpAt = html.indexOf(">RDP<");
    const leftAt = html.indexOf(">Left<");
    const elapsedAt = html.indexOf(">Elapsed<");
    expect(forAt).toBeGreaterThan(-1);
    expect(forAt).toBeLessThan(runAt);
    expect(runAt).toBeLessThan(hostAt);
    expect(hostAt).toBeLessThan(sshAt);
    expect(sshAt).toBeLessThan(rdpAt);
    expect(rdpAt).toBeLessThan(leftAt);
    expect(leftAt).toBeLessThan(elapsedAt);
    expect(html).not.toContain("on = run in progress, not SSH ready");
    expect(html).toContain("on = reserved hostname is on the tailnet");
    expect(html).toContain("Close Linux");
    expect(html).toContain("This stops the GitHub run");
    expect(html).toContain("btn-danger");
    expect(html).not.toContain("<dt>Slot</dt>");
    expect(html).not.toMatch(/[\u4e00-\u9fff]/);
    expect(html).not.toContain("Paste the admin token to open or close");
    expect(html).not.toContain("#38bdf8");
    expect(html).not.toContain("--starting");
    expect(html).not.toContain("Geist Mono");
    expect(html).not.toContain("color-scheme: light dark");
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
