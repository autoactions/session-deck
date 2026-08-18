export type Join = "present" | "absent" | "unknown";

export type JoinStatus = {
  join: Join;
  address: string | null;
};

export type TailscaleNet = {
  status(hostname: string): Promise<JoinStatus>;
};

export function unknownTailscale(): TailscaleNet {
  return {
    async status() {
      return { join: "unknown", address: null };
    },
  };
}

export type TailscaleConfig = {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
};

type Device = {
  hostname: string;
  name?: string;
  online?: boolean;
  addresses?: string[];
};

export function createTailscale(config: TailscaleConfig): TailscaleNet {
  const fetchImpl = config.fetch ?? fetch;
  let devicesInFlight: Promise<Device[]> | null = null;
  let token: string | null = null;

  async function tailscaleFetch(url: string, init: RequestInit): Promise<Response> {
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Tailscale ${init.method ?? "GET"} failed: ${response.status} ${detail}`);
    }
    return response;
  }

  async function accessToken(): Promise<string> {
    if (token) return token;
    const response = await tailscaleFetch("https://api.tailscale.com/api/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "devices:core",
      }),
    });
    const body = (await response.json()) as { access_token?: string };
    if (!body.access_token) throw new Error("Tailscale OAuth token response did not include an access token");
    token = body.access_token;
    return token;
  }

  async function devices(): Promise<Device[]> {
    if (!devicesInFlight) {
      devicesInFlight = (async () => {
        const response = await tailscaleFetch("https://api.tailscale.com/api/v2/tailnet/-/devices", {
          headers: { Authorization: `Bearer ${await accessToken()}` },
        });
        const body = (await response.json()) as { devices?: Device[] };
        return body.devices ?? [];
      })().finally(() => {
        devicesInFlight = null;
      });
    }
    return devicesInFlight;
  }

  return {
    async status(hostname) {
      const match = (await devices()).find((device) => device.hostname === hostname);
      if (!match?.online) return { join: "absent", address: null };
      const address = match.addresses?.find((value) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) ?? null;
      return { join: "present", address };
    },
  };
}
