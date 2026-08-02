import { describe, expect, it } from "vitest";

import {
  createChangeSetId,
  createEventId,
  createMemoryId,
  createValidationId,
  randomId,
  slugify,
} from "../../src/util/ids.js";

describe("randomId", () => {
  it("generates lowercase alphanumeric ids of the requested length", () => {
    expect(randomId()).toMatch(/^[a-z0-9]{6}$/);
    expect(randomId(10)).toMatch(/^[a-z0-9]{10}$/);
  });
});

describe("id factories", () => {
  const date = new Date(2026, 4, 4);

  it("creates sortable change-set ids", () => {
    expect(createChangeSetId(date)).toMatch(/^cs_20260504_[a-z0-9]{6}$/);
  });

  it("creates event ids", () => {
    expect(createEventId()).toMatch(/^evt_[a-z0-9]{6}$/);
  });

  it("creates validation ids", () => {
    expect(createValidationId()).toMatch(/^val_[a-z0-9]{6}$/);
  });

  it("creates memory ids", () => {
    expect(createMemoryId(date)).toMatch(/^mem_20260504_[a-z0-9]{6}$/);
  });
});

describe("slugify", () => {
  it("lowercases and replaces separators with dashes", () => {
    expect(slugify("Bootstrap memory ledger")).toBe("bootstrap-memory-ledger");
  });

  it("collapses punctuation and trims edge dashes", () => {
    expect(slugify("  Fix: state writer (v2)!  ")).toBe("fix-state-writer-v2");
  });

  it("truncates long titles without leaving a trailing dash", () => {
    const slug = slugify(
      "A very long change set title that keeps going and going and going onwards",
    );

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });
});
