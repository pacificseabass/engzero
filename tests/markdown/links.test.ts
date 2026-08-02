import { describe, expect, it } from "vitest";

import { wikiLink } from "../../src/markdown/links.js";

describe("wikiLink", () => {
  it("links to a vault path without the md extension", () => {
    expect(wikiLink("02-Change-Sets/2026-05/cs_20260504_k7p9x2 - slug.md")).toBe(
      "[[02-Change-Sets/2026-05/cs_20260504_k7p9x2 - slug]]",
    );
  });

  it("supports aliases", () => {
    expect(wikiLink("04-Projects/agent-runtime/ProjectManifest.md", "manifest")).toBe(
      "[[04-Projects/agent-runtime/ProjectManifest|manifest]]",
    );
  });

  it("drops aliases that match the target", () => {
    expect(wikiLink("Note.md", "Note")).toBe("[[Note]]");
  });
});
