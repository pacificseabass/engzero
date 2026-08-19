import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProjectManifest,
  getProjectManifestPath,
  renderProjectManifestNote,
} from "../../src/projects/projectManifest.js";
import { ProjectService } from "../../src/projects/projectService.js";
import { ProjectNotFoundError } from "../../src/util/errors.js";
import { VaultRegistry } from "../../src/vaults/vaultRegistry.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";
import { InMemoryStateStore } from "../helpers/inMemoryStateStore.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("createProjectManifest", () => {
  it("writes the manifest note inside the configured vault", async () => {
    const vault = await createVault();
    const vaultRegistry = new VaultRegistry([vault]);
    const stateStore = new InMemoryStateStore();
    const project = await new ProjectService(stateStore, vaultRegistry).init({
      projectId: "agent-runtime",
      riskProfile: "high",
    });

    const result = await createProjectManifest(
      stateStore,
      vaultRegistry,
      project.projectId,
    );

    expect(result).toEqual({
      vaultId: "agent",
      relativePath: "04-Projects/agent-runtime/ProjectManifest.md",
      absolutePath: join(
        vault.rootPath,
        "04-Projects",
        "agent-runtime",
        "ProjectManifest.md",
      ),
    });
    await expect(readFile(result.absolutePath, "utf8")).resolves.toBe(
      renderProjectManifestNote(project),
    );
  });

  it("rejects projects that are not registered in state", async () => {
    const vault = await createVault();
    const vaultRegistry = new VaultRegistry([vault]);

    await expect(
      createProjectManifest(new InMemoryStateStore(), vaultRegistry, "missing"),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("builds vault-relative manifest paths", () => {
    expect(getProjectManifestPath("agent-runtime")).toBe(
      "04-Projects/agent-runtime/ProjectManifest.md",
    );
  });
});

describe("renderProjectManifestNote", () => {
  it("renders frontmatter and placeholder sections for a minimal project", () => {
    expect(
      renderProjectManifestNote({
        projectId: "agent-runtime",
        name: "agent-runtime",
        memoryNamespace: "agent-runtime",
        vaultNamespace: "agent",
        repos: [],
        riskProfile: "medium",
        deploymentTargets: [],
        toolsAllowed: [],
      }),
    ).toBe(
      [
        "---",
        "type: project-manifest",
        "status: active",
        "project_id: agent-runtime",
        "name: agent-runtime",
        "risk_profile: medium",
        "vault_namespace: agent",
        "memory_namespace: agent-runtime",
        "---",
        "",
        "# Project Manifest: agent-runtime",
        "",
        "## Repositories",
        "",
        "_No repositories registered._",
        "",
        "## Deployment Targets",
        "",
        "_No deployment targets registered._",
        "",
        "## Allowed Tools",
        "",
        "_No tools allowed._",
        "",
      ].join("\n"),
    );
  });

  it("renders repos, deployment targets, and tools as lists", () => {
    const note = renderProjectManifestNote({
      projectId: "agent-runtime",
      name: "Agent Runtime",
      projectType: "internal-platform",
      memoryNamespace: "agent-runtime",
      vaultNamespace: "agent",
      repos: [
        {
          name: "engzero",
          path: "~/developer/engzero",
          remote: "git@github.com:engzero/engzero.git",
        },
      ],
      riskProfile: "high",
      deploymentTargets: [
        { name: "local-dev", provider: "local", status: "active" },
        { name: "future-cloud", provider: "gcp", status: "planned" },
      ],
      toolsAllowed: ["obsidian_writer", "git_tool"],
    });

    expect(note).toContain('name: "Agent Runtime"');
    expect(note).toContain("project_type: internal-platform");
    expect(note).toContain("# Project Manifest: Agent Runtime");
    expect(note).toContain(
      "- engzero (~/developer/engzero, git@github.com:engzero/engzero.git)",
    );
    expect(note).toContain("- local-dev (local, active)");
    expect(note).toContain("- future-cloud (gcp, planned)");
    expect(note).toContain("- obsidian_writer");
    expect(note).toContain("- git_tool");
  });
});

async function createVault(): Promise<VaultConfig> {
  const rootPath = await mkdtemp(join(tmpdir(), "engzero-project-manifest-"));
  tempDirs.push(rootPath);

  return {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities: ["read", "write", "append"],
  };
}
