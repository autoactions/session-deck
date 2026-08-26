import { describe, expect, it } from "vitest";
import { decryptSensitiveFacts } from "../src/sensitive-facts.ts";

const password = "shared-session-password";
const salt = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
const iv = Uint8Array.from({ length: 12 }, (_, index) => index + 17);

async function envelope(label: string, value: string, secret = password): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600_000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`session-deck-sensitive-fact:v1:${label}`),
      tagLength: 128,
    },
    key,
    new TextEncoder().encode(value),
  );
  return `enc:v1:${base64url(salt)}:${base64url(iv)}:${base64url(new Uint8Array(encrypted))}`;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("decryptSensitiveFacts", () => {
  it("decrypts the fixed cross-repository v1 vector", async () => {
    const fixed = "enc:v1:AQIDBAUGBwgJCgsMDQ4PEA:ERITFBUWFxgZGhsc:8XYgVKM3GYZMpY15qf4NG8huLDN3f-XD3WdOmQw";
    await expect(decryptSensitiveFacts(
      `## Sensitive Facts\n- Session Password: ${fixed}\n`,
      password,
    )).resolves.toEqual({
      present: true,
      valid: true,
      facts: [{ label: "Session Password", value: "private-value" }],
    });
  });

  it("decrypts a generic labeled fact", async () => {
    const encrypted = await envelope("Motrix Operator Token", "one-time-token");
    await expect(decryptSensitiveFacts(
      `## Sensitive Facts\n\n- Motrix Operator Token: ${encrypted}\n`,
      password,
    )).resolves.toEqual({
      present: true,
      valid: true,
      facts: [{ label: "Motrix Operator Token", value: "one-time-token" }],
    });
  });

  it("fails the whole block closed for the wrong password or changed label", async () => {
    const encrypted = await envelope("Session Password", "private-value");
    const wrongPassword = await decryptSensitiveFacts(
      `## Sensitive Facts\n- Session Password: ${encrypted}\n`,
      "wrong-password",
    );
    const changedLabel = await decryptSensitiveFacts(
      `## Sensitive Facts\n- Other Password: ${encrypted}\n`,
      password,
    );
    expect(wrongPassword).toEqual({ present: true, valid: false, facts: [] });
    expect(changedLabel).toEqual({ present: true, valid: false, facts: [] });
  });

  it("accepts old output without a Sensitive Facts block", async () => {
    await expect(decryptSensitiveFacts("## Locators\n- SSH: runner@100.64.0.1\n", password))
      .resolves.toEqual({ present: false, valid: true, facts: [] });
  });

  it("rejects malformed or empty blocks without returning ciphertext", async () => {
    await expect(decryptSensitiveFacts("## Sensitive Facts\n- Token: enc:v2:nope\n", password))
      .resolves.toEqual({ present: true, valid: false, facts: [] });
    await expect(decryptSensitiveFacts("## Sensitive Facts\n\n", password))
      .resolves.toEqual({ present: true, valid: false, facts: [] });
  });
});
