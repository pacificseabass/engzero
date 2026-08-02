import { describe, expect, it } from "vitest";

import type { ChangeSet } from "../../../src/changeSets/changeSetTypes.js";
import {
  formatChangeSet,
  formatChangeSetCreate,
  formatChangeSetList,
  formatChangeSetUpdate,
} from "../../../src/cli/commands/changeSet.js";

const changeSet: ChangeSet = {
  id: "cs_20260504_k7p9x2",
  projectId: "agent-runtime",
  title: "Bootstrap memory ledger",
  goal: "Bootstrap the memory ledger",
  source: "cli",
  status: "created",
  riskLevel: "medium",
  createdAt: "2026-05-04T10:00:00.000Z",
  updatedAt: "2026-05-04T10:00:00.000Z",
  obsidianPath:
    "02-Change-Sets/2026-05/cs_20260504_k7p9x2 - bootstrap-memory-ledger.md",
  plan: ["Define vault registry"],
  filesChanged: [],
  testsRun: [],
  events: [
    {
      id: "evt_x1y2z3",
      timestamp: "2026-05-04T10:00:00.000Z",
      type: "created",
      message: "Change set created: Bootstrap the memory ledger",
    },
  ],
  memoryUpdates: [],
};

describe("change-set command formatters", () => {
  it("formats creation output with the note path", () => {
    expect(formatChangeSetCreate(changeSet)).toBe(
      [
        "Created change set: cs_20260504_k7p9x2",
        "Note: 02-Change-Sets/2026-05/cs_20260504_k7p9x2 - bootstrap-memory-ledger.md",
      ].join("\n"),
    );
  });

  it("formats creation output as JSON", () => {
    expect(formatChangeSetCreate(changeSet, { json: true })).toBe(
      JSON.stringify(changeSet, null, 2),
    );
  });

  it("formats update output with the current status", () => {
    expect(formatChangeSetUpdate({ ...changeSet, status: "planning" })).toBe(
      "Updated change set: cs_20260504_k7p9x2 (status: planning)",
    );
  });

  it("formats a change-set list as rows", () => {
    expect(formatChangeSetList([changeSet])).toBe(
      "cs_20260504_k7p9x2\tcreated\tmedium\tagent-runtime\tBootstrap memory ledger",
    );
  });

  it("formats an empty change-set list", () => {
    expect(formatChangeSetList([])).toBe("No change sets found.");
  });

  it("formats a change set for human-readable output", () => {
    expect(formatChangeSet(changeSet)).toBe(
      [
        "Change Set",
        "  id: cs_20260504_k7p9x2",
        "  title: Bootstrap memory ledger",
        "  goal: Bootstrap the memory ledger",
        "  project: agent-runtime",
        "  status: created",
        "  risk: medium",
        "  source: cli",
        "  created: 2026-05-04T10:00:00.000Z",
        "  updated: 2026-05-04T10:00:00.000Z",
        "  plan items: 1",
        "  files changed: 0",
        "  validations: 0",
        "  events: 1",
        "  note: 02-Change-Sets/2026-05/cs_20260504_k7p9x2 - bootstrap-memory-ledger.md",
      ].join("\n"),
    );
  });

  it("includes closed and review lines once present", () => {
    const closed = formatChangeSet({
      ...changeSet,
      status: "closed",
      closedAt: "2026-05-05T12:00:00.000Z",
      reviewSummary: "Done",
    });

    expect(closed).toContain("  closed: 2026-05-05T12:00:00.000Z");
    expect(closed).toContain("  review: Done");
  });
});
