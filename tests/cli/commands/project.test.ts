import { describe, expect, it } from "vitest";

import {
  formatProject,
  formatProjectInit,
  formatProjectList,
} from "../../../src/cli/commands/project.js";
import type { ProjectManifest } from "../../../src/projects/projectTypes.js";

describe("project command formatters", () => {
  const project: ProjectManifest = {
    projectId: "agent-runtime",
    name: "Agent Runtime",
    memoryNamespace: "agent-runtime",
    vaultNamespace: "agent",
    repos: [],
    riskProfile: "high",
    deploymentTargets: [],
    toolsAllowed: [],
  };

  it("formats a project list for human-readable output", () => {
    expect(formatProjectList([project])).toBe(
      "agent-runtime\thigh\tagent\tAgent Runtime",
    );
  });

  it("formats an empty project list", () => {
    expect(formatProjectList([])).toBe("No projects registered.");
  });

  it("formats a project list as JSON", () => {
    expect(formatProjectList([project], { json: true })).toBe(
      JSON.stringify([project], null, 2),
    );
  });

  it("formats initialized project output for human-readable output", () => {
    expect(formatProjectInit(project)).toBe("Created project: agent-runtime");
  });

  it("formats initialized project output as JSON", () => {
    expect(formatProjectInit(project, { json: true })).toBe(
      JSON.stringify(project, null, 2),
    );
  });

  it("mentions the manifest note in initialized project output", () => {
    expect(
      formatProjectInit(project, {}, {
        vaultId: "agent",
        relativePath: "04-Projects/agent-runtime/ProjectManifest.md",
        absolutePath: "/vault/04-Projects/agent-runtime/ProjectManifest.md",
      }),
    ).toBe(
      [
        "Created project: agent-runtime",
        "Manifest note: 04-Projects/agent-runtime/ProjectManifest.md (vault: agent)",
      ].join("\n"),
    );
  });

  it("formats a project for human-readable output", () => {
    expect(formatProject(project)).toBe(
      [
        "Project",
        "  id: agent-runtime",
        "  name: Agent Runtime",
        "  type: (none)",
        "  memoryNamespace: agent-runtime",
        "  vaultNamespace: agent",
        "  riskProfile: high",
        "  repos: 0",
        "  deploymentTargets: 0",
        "  toolsAllowed: 0",
      ].join("\n"),
    );
  });

  it("formats a project as JSON", () => {
    expect(formatProject(project, { json: true })).toBe(
      JSON.stringify(project, null, 2),
    );
  });
});
