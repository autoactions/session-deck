import type { LocatorFact } from "./locators.ts";

const HEADING = "## Sensitive Facts";
const PREFIX = "enc:v1:";
const ITERATIONS = 600_000;
const LABEL_PATTERN = /^[^:\r\n]{1,80}$/;
const MAX_CIPHERTEXT_BYTES = 4_112;
const MAX_FACTS = 8;
const MAX_ENVELOPE_CHARACTERS = 5_600;

type EncryptedFact = { label: string; envelope: string };

export type SensitiveFactsResult = {
  present: boolean;
  valid: boolean;
  facts: LocatorFact[];
};

export async function decryptSensitiveFacts(
  text: string,
  password: string,
): Promise<SensitiveFactsResult> {
  const parsed = parseEncryptedBlock(text);
  if (!parsed.present) return { present: false, valid: true, facts: [] };
  if (!parsed.valid || !password) return { present: true, valid: false, facts: [] };

  try {
    const facts = await Promise.all(
      parsed.facts.map(async ({ label, envelope }) => ({
        label,
        value: await decryptEnvelope(label, envelope, password),
      })),
    );
    return { present: true, valid: true, facts };
  } catch {
    return { present: true, valid: false, facts: [] };
  }
}

function parseEncryptedBlock(text: string): {
  present: boolean;
  valid: boolean;
  facts: EncryptedFact[];
} {
  const lines = text.split(/\r?\n/);
  let found = false;
  let facts: EncryptedFact[] = [];
  let valid = true;
  for (let index = 0; index < lines.length; index++) {
    if (lines[index]!.trim() !== HEADING) continue;
    found = true;
    const block: EncryptedFact[] = [];
    const labels = new Set<string>();
    let blockValid = true;
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor]!.trim() === "") cursor++;
    for (; cursor < lines.length; cursor++) {
      const trimmed = lines[cursor]!.trim();
      if (trimmed === "" || /^#{1,6}\s/.test(trimmed)) break;
      const match = lines[cursor]!.match(/^-\s+([^:]+):\s+(enc:v1:\S+)$/);
      const label = match?.[1]?.trim() ?? "";
      const envelope = match?.[2] ?? "";
      if (
        !match || !LABEL_PATTERN.test(label) || labels.has(label) ||
        envelope.length > MAX_ENVELOPE_CHARACTERS || block.length >= MAX_FACTS
      ) {
        blockValid = false;
        break;
      }
      labels.add(label);
      block.push({ label, envelope });
    }
    if (block.length === 0) blockValid = false;
    facts = block;
    valid = blockValid;
    index = cursor - 1;
  }
  return { present: found, valid, facts };
}

async function decryptEnvelope(label: string, envelope: string, password: string): Promise<string> {
  if (!envelope.startsWith(PREFIX)) throw new Error("unsupported envelope");
  const parts = envelope.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("invalid envelope");
  const salt = decodeBase64Url(parts[0]!);
  const iv = decodeBase64Url(parts[1]!);
  const ciphertext = decodeBase64Url(parts[2]!);
  if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error("invalid envelope parameters");
  if (ciphertext.byteLength < 17 || ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) {
    throw new Error("invalid ciphertext length");
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(aad(label)),
      tagLength: 128,
    },
    key,
    ciphertext,
  );
  const value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(plaintext);
  if (!value || /[\u0000]/.test(value)) throw new Error("invalid plaintext");
  return value;
}

function aad(label: string): string {
  return `session-deck-sensitive-fact:v1:${label}`;
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}
