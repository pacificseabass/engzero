import { describe, expect, it } from "vitest";

import { renderFrontMatter } from "../../src/markdown/frontmatter.js";

describe("renderFrontMatter", () => {
  it("renders simple scalar values between frontmatter delimiters", () => {
    expect(
      renderFrontMatter({
        type: "project-manifest",
        project_id: "agent-runtime",
        active: true,
        priority: 2,
      }),
    ).toBe(
      [
        "---",
        "type: project-manifest",
        "project_id: agent-runtime",
        "active: true",
        "priority: 2",
        "---",
        "",
      ].join("\n"),
    );
  });

  it("renders arrays as YAML lists", () => {
    expect(
      renderFrontMatter({
        tags: ["project", "mvp-1"],
      }),
    ).toBe(["---", "tags:", "  - project", "  - mvp-1", "---", ""].join("\n"));
  });

  it("skips undefined values", () => {
    expect(
      renderFrontMatter({
        type: "lesson",
        confidence: undefined,
      }),
    ).toBe(["---", "type: lesson", "---", ""].join("\n"));
  });

  it("quotes strings that need YAML escaping", () => {
    expect(
      renderFrontMatter({
        title: "Memory ledger: MVP 1",
        empty: "",
      }),
    ).toBe(
      [
        "---",
        'title: "Memory ledger: MVP 1"',
        'empty: ""',
        "---",
        "",
      ].join("\n"),
    );
  });

  it("renders empty frontmatter", () => {
    expect(renderFrontMatter({})).toBe(["---", "---", ""].join("\n"));
  });
});
