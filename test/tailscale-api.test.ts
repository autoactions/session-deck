import { describe, expect, it } from "vitest";
import { createTailscale } from "../src/tailscale.ts";

type Call = { url: string; method: string; body: string | null };

function tailscaleWith(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const tailscale = createTailscale({
    clientId: "id",
    clientSecret: "secret",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const call: Call = {
        url: request.url,
        method: request.method,
        body: request.method === "POST" ? await request.text() : null,
      };
      calls.push(call);
      return handler(call);
    },
  });
  return { tailscale, calls };
}

describe("Tailscale adapter", () => {
  it("reports present with the IPv4 when the reserved hostname is online", async () => {
    const { tailscale, calls } = tailscaleWith((call) => {
      if (call.url.includes("/oauth/token")) {
        return Response.json({ access_token: "ts-token" });
      }
      return Response.json({
        devices: [
          {
            hostname: "debug-session-linux",
            online: true,
            addresses: ["fd7a:115c:a1e0::1", "100.64.0.10"],
          },
        ],
      });
    });

    expect(await tailscale.status("debug-session-linux")).toEqual({
      join: "present",
      address: "100.64.0.10",
    });
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "https://api.tailscale.com/api/v2/oauth/token",
    });
    expect(calls[0].body).toContain("client_id=id");
    expect(calls[1]).toMatchObject({
      method: "GET",
      url: "https://api.tailscale.com/api/v2/tailnet/-/devices",
    });
  });

  it("reports absent when the reserved hostname is missing or offline", async () => {
    const { tailscale } = tailscaleWith((call) => {
      if (call.url.includes("/oauth/token")) {
        return Response.json({ access_token: "ts-token" });
      }
      return Response.json({
        devices: [{ hostname: "debug-session-linux", online: false, addresses: ["100.64.0.10"] }],
      });
    });
    expect(await tailscale.status("debug-session-linux")).toEqual({ join: "absent", address: null });
    expect(await tailscale.status("debug-session-windows")).toEqual({ join: "absent", address: null });
  });
});
