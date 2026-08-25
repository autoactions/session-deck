import { describe, expect, it } from "vitest";
import { hasLocatorBlock, parseLocatorBlock } from "../src/locators.ts";

describe("parseLocatorBlock", () => {
  it("reads labeled items under ## Locators", () => {
    expect(
      parseLocatorBlock(`## Locators
- SSH: runner@100.64.0.10
- RDP: 100.64.0.10:3389
`),
    ).toEqual([
      { label: "SSH", value: "runner@100.64.0.10" },
      { label: "RDP", value: "100.64.0.10:3389" },
    ]);
  });

  it("reads a Session Address block", () => {
    expect(
      parseLocatorBlock(`## Session Ready
- Access: Use native Basic Auth

## Locators

- Session Address: https://session-test.trycloudflare.com
`),
    ).toEqual([{ label: "Session Address", value: "https://session-test.trycloudflare.com" }]);
  });

  it("stops before a blank line or the next heading", () => {
    expect(
      parseLocatorBlock(`## Locators
- SSH: runner@100.64.0.10

Stop Signal: run stop-session
`),
    ).toEqual([{ label: "SSH", value: "runner@100.64.0.10" }]);
  });

  it("uses the last Locator Block when the job reprints it", () => {
    expect(
      parseLocatorBlock(`## Locators
- SSH: runner@100.64.0.10

## Locators
- SSH: runner@100.64.0.10
- RDP: 100.64.0.10:3389
`),
    ).toEqual([
      { label: "SSH", value: "runner@100.64.0.10" },
      { label: "RDP", value: "100.64.0.10:3389" },
    ]);
  });

  it("returns nothing when the heading is missing", () => {
    expect(parseLocatorBlock("Session Address: https://x.trycloudflare.com\nSSH: runner@1.1.1.1\n")).toEqual([]);
    expect(hasLocatorBlock("## Session Ready\n- Session Address: https://x.example\n")).toBe(false);
    expect(hasLocatorBlock("## Locators\n- SSH: runner@1.1.1.1\n")).toBe(true);
  });
});
