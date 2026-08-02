import { describe, expect, it } from "vitest";

import {
  getChangeSetNotePath,
  renderChangeSetNote,
} from "../../src/changeSets/changeSetRenderer.js";
import type { ChangeSet } from "../../src/changeSets/changeSetTypes.js";

const minimalChangeSet: ChangeSet = {
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
  plan: [],
  filesChanged: [],
  testsRun: [],
  events: [],
  memoryUpdates: [],
};

describe("getChangeSetNotePath", () => {
  it("builds the canonical 02-Change-Sets path from id, month, and slug", () => {
    expect(getChangeSetNotePath(minimalChangeSet)).toBe(
      "02-Change-Sets/2026-05/cs_20260504_k7p9x2 - bootstrap-memory-ledger.md",
    );
  });
});

describe("renderChangeSetNote", () => {
  it("renders a freshly created change set with placeholder sections", () => {
    const note = renderChangeSetNote(minimalChangeSet);

    expect(note.relativePath).toBe(minimalChangeSet.obsidianPath);
    expect(note.contents).toBe(
      [
        "---",
        "type: change-set",
        "status: created",
        'created: "2026-05-04T10:00:00.000Z"',
        'updated: "2026-05-04T10:00:00.000Z"',
        "project_id: agent-runtime",
        "change_set_id: cs_20260504_k7p9x2",
        "risk_level: medium",
        "source: cli",
        "---",
        "",
        "# Change Set: Bootstrap memory ledger",
        "",
        "## Goal",
        "",
        "Bootstrap the memory ledger",
        "",
        "## Status",
        "",
        "created",
        "",
        "## Risk Level",
        "",
        "medium",
        "",
        "## Plan",
        "",
        "_No plan items yet._",
        "",
        "## Events",
        "",
        "_No events recorded._",
        "",
        "## Files Changed",
        "",
        "_No files changed._",
        "",
        "## Validation",
        "",
        "_No validation recorded._",
        "",
        "## Deployment Impact",
        "",
        "_Not assessed._",
        "",
        "## Rollback Notes",
        "",
        "_None._",
        "",
        "## Memory Updates",
        "",
        "_None yet._",
        "",
        "## Model Trace",
        "",
        "_None recorded._",
        "",
        "## Review Summary",
        "",
        "_Pending._",
        "",
        "## Follow-Ups",
        "",
        "_None._",
        "",
      ].join("\n"),
    );
  });

  it("renders a closed change set with every section populated", () => {
    const changeSet: ChangeSet = {
      ...minimalChangeSet,
      status: "closed",
      riskLevel: "high",
      updatedAt: "2026-05-05T12:00:00.000Z",
      closedAt: "2026-05-05T12:00:00.000Z",
      plan: ["Define vault registry", "Write state store"],
      filesChanged: ["src/vaults/vaultRegistry.ts"],
      testsRun: [
        {
          id: "val_a1b2c3",
          timestamp: "2026-05-05T11:00:00.000Z",
          kind: "test",
          command: "pnpm test",
          status: "passed",
          summary: "Unit tests passed",
        },
      ],
      events: [
        {
          id: "evt_x1y2z3",
          timestamp: "2026-05-04T10:00:00.000Z",
          type: "created",
          message: "Change set created",
        },
        {
          id: "evt_x4y5z6",
          timestamp: "2026-05-05T12:00:00.000Z",
          type: "closed",
          message: "Memory ledger bootstrap complete",
        },
      ],
      deploymentImpact: {
        hasDeploymentImpact: true,
        environments: ["local-dev"],
        summary: "Requires re-running setup.",
      },
      rollbackNotes: "Revert the commit.",
      memoryUpdates: [
        {
          id: "mem_20260505_q1w2e3",
          type: "lesson",
          obsidianPath: "03-Self-Improvement/Lessons/2026-05/lesson.md",
          summary: "Always await vault writes",
        },
      ],
      modelTrace: {
        mode: "single",
        models: [
          { provider: "anthropic", model: "claude-sonnet-5", role: "executor" },
        ],
        summary: "Single-model run.",
      },
      reviewSummary: "Memory ledger bootstrap complete",
    };

    const { contents } = renderChangeSetNote(changeSet);

    expect(contents).toContain('closed: "2026-05-05T12:00:00.000Z"');
    expect(contents).toContain("risk_level: high");
    expect(contents).toContain("- Define vault registry");
    expect(contents).toContain("- Write state store");
    expect(contents).toContain("- src/vaults/vaultRegistry.ts");
    expect(contents).toContain(
      "- 2026-05-04T10:00:00.000Z [created] Change set created",
    );
    expect(contents).toContain(
      "- 2026-05-05T12:00:00.000Z [closed] Memory ledger bootstrap complete",
    );
    expect(contents).toContain("- passed test — Unit tests passed (`pnpm test`)");
    expect(contents).toContain("Has deployment impact.");
    expect(contents).toContain("- local-dev");
    expect(contents).toContain("Requires re-running setup.");
    expect(contents).toContain("Revert the commit.");
    expect(contents).toContain(
      "- lesson: Always await vault writes ([[03-Self-Improvement/Lessons/2026-05/lesson]])",
    );
    expect(contents).toContain("Mode: single");
    expect(contents).toContain("- executor: anthropic/claude-sonnet-5");
    expect(contents).toContain("Single-model run.");
    expect(contents).not.toContain("_Pending._");
    expect(contents).toContain("Memory ledger bootstrap complete");
  });
});
