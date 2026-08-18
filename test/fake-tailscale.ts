import type { JoinStatus, TailscaleNet } from "../src/tailscale.ts";

export class FakeTailscale implements TailscaleNet {
  online: Record<string, string | null> = {};

  async status(hostname: string): Promise<JoinStatus> {
    if (!(hostname in this.online)) return { join: "absent", address: null };
    return { join: "present", address: this.online[hostname] };
  }
}
