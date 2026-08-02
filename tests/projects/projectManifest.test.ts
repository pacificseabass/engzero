import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProjectManifest,
  getProjectManifestPath,
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
      project.riskProfile,
      project.vaultNamespace,
      project.memoryNamespace,
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

    const contents = await readFile(result.absolutePath, "utf8");
    expect(contents).toContain("type: project-manifest");
    expect(contents).toContain("project_id: agent-runtime");
    expect(contents).toContain("risk_profile: high");
    expect(contents).toContain("vault_namespace: agent");
    expect(contents).toContain("memory_namespace: agent-runtime");
  });

  it("rejects projects that are not registered in state", async () => {
    const vault = await createVault();
    const vaultRegistry = new VaultRegistry([vault]);

    await expect(
      createProjectManifest(
        new InMemoryStateStore(),
        vaultRegistry,
        "missing",
        "medium",
        "agent",
        "missing",
      ),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("builds vault-relative manifest paths", () => {
    expect(getProjectManifestPath("agent-runtime")).toBe(
      "04-Projects/agent-runtime/ProjectManifest.md",
    );
  });
});

async function createVault(): Promise<VaultConfig> {
  const rootPath = await mkdtemp(join(tmpdir(), "3ng0-project-manifest-"));
  tempDirs.push(rootPath);

  return {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities: ["read", "write", "append"],
  };
}
