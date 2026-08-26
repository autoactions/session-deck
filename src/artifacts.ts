import { unzipSync } from "fflate";

export const LOCATOR_ARTIFACT_NAME = "session-deck-locators";
export const LOCATOR_ARTIFACT_FILE = "session-deck-output.md";
export const MAX_LOCATOR_ARCHIVE_BYTES = 64 * 1024;
export const MAX_LOCATOR_FILE_BYTES = 16 * 1024;

export function readLocatorArtifact(archive: Uint8Array): string | null {
  if (archive.byteLength === 0 || archive.byteLength > MAX_LOCATOR_ARCHIVE_BYTES) return null;

  try {
    let entries = 0;
    let validEntry = true;
    const files = unzipSync(archive, {
      filter(file) {
        entries += 1;
        const valid =
          file.name === LOCATOR_ARTIFACT_FILE &&
          file.originalSize > 0 &&
          file.originalSize <= MAX_LOCATOR_FILE_BYTES;
        if (!valid) validEntry = false;
        return valid;
      },
    });
    if (entries !== 1 || !validEntry) return null;
    const bytes = files[LOCATOR_ARTIFACT_FILE];
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_LOCATOR_FILE_BYTES) return null;
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return isLocatorDocument(text) ? text : null;
  } catch {
    return null;
  }
}

function isLocatorDocument(text: string): boolean {
  if (text.includes("\0")) return false;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.at(-1) === "") lines.pop();
  let index = 0;
  if (lines[index++] !== "## Locators") return false;
  while (lines[index] === "") index += 1;

  let locators = 0;
  while (index < lines.length && lines[index] !== "") {
    if (!validListItem(lines[index]!, false)) return false;
    locators += 1;
    index += 1;
  }
  if (locators === 0 || locators > 16) return false;
  while (lines[index] === "") index += 1;
  if (index === lines.length) return true;
  if (lines[index++] !== "## Sensitive Facts") return false;
  while (lines[index] === "") index += 1;

  let sensitiveFacts = 0;
  while (index < lines.length && lines[index] !== "") {
    if (!validListItem(lines[index]!, true)) return false;
    sensitiveFacts += 1;
    index += 1;
  }
  while (lines[index] === "") index += 1;
  return sensitiveFacts > 0 && sensitiveFacts <= 8 && index === lines.length;
}

function validListItem(line: string, sensitive: boolean): boolean {
  const match = line.match(/^- ([^:\r\n]{1,80}): (\S(?:.*\S)?)$/);
  if (!match) return false;
  return !sensitive || /^enc:v2:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(match[2]!);
}
