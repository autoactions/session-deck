import { describe, expect, it } from "vitest";
import { githubRef, parseRepoList } from "../src/catalog.ts";

describe("parseRepoList", () => {
  it("splits a comma-separated owner/repo list", () => {
    expect(parseRepoList("autoactions/debug-session,autoactions/tsvc")).toEqual([
      "autoactions/debug-session",
      "autoactions/tsvc",
    ]);
  });

  it("trims, drops empties, and de-duplicates", () => {
    expect(parseRepoList(" autoactions/debug-session , ,autoactions/debug-session ")).toEqual([
      "autoactions/debug-session",
    ]);
  });

  it("ignores values that are not owner/repo", () => {
    expect(parseRepoList("debug-session,autoactions/tsvc,https://github.com/x/y")).toEqual([
      "autoactions/tsvc",
    ]);
  });
});

describe("githubRef", () => {
  it("defaults to main", () => {
    expect(githubRef(undefined)).toBe("main");
    expect(githubRef("")).toBe("main");
    expect(githubRef("  ")).toBe("main");
  });

  it("keeps a provided ref", () => {
    expect(githubRef("release")).toBe("release");
  });
});
