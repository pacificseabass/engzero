import { describe, expect, it } from "vitest";

import { classifyRisk } from "../../src/changeSets/riskClassifier.js";

describe("classifyRisk", () => {
  it("defaults to medium risk", () => {
    expect(classifyRisk("Bootstrap memory ledger")).toBe("medium");
  });

  it("classifies goals touching sensitive areas as high risk", () => {
    expect(classifyRisk("Rotate the GCP secret for billing")).toBe("high");
    expect(classifyRisk("Run database migration")).toBe("high");
    expect(classifyRisk("Delete stale branches")).toBe("high");
    expect(classifyRisk("Add auth to the MCP server")).toBe("high");
  });

  it("matches keywords case-insensitively", () => {
    expect(classifyRisk("PRODUCTION deploy checklist")).toBe("high");
  });
});
