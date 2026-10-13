import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { renderProjectManifestNote } from "../../src/projects/projectManifest.js";
import { ProjectOperations } from "../../src/projects/projectOperations.js";
import { JsonStateStore } from "../../src/state/jsonStateStore.js";
import {
  InvalidPath,
  ProjectAlreadyExistsError,
  VaultPermissionError,
} from "../../src/util/errors.js";
import { VaultRegistry } from "../../src/vaults/vaultRegistry.js";
import type { VaultCapability } from "../../src/vaults/vaultTypes.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((path) => rm(path, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createFixture(capabilities: VaultCapability[] = ["read", "write", "append"]) {
  const rootPath = await mkdtemp(join(tmpdir(), "engzero-project-ops-"));
  tempDirs.push(rootPath);
  const statePath = join(rootPath, "state.json");
  const stateStore = new JsonStateStore(statePath);
  const vaults = new VaultRegistry([{
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities,
  }]);
  const projects = new ProjectOperations(stateStore, vaults);

  return { rootPath, statePath, stateStore, projects };
}

describe("ProjectOperations", () => {
  it("registers the project in state and writes its manifest note", async () => {
    const { rootPath, stateStore, projects } = await createFixture();

    const { project, note } = await projects.init({
      projectId: "agent-runtime",
      riskProfile: "high",
    });

    const state = await stateStore.load();
    expect(state.projects["agent-runtime"]).toEqual(project);
    expect(note).toEqual({
      vaultId: "agent",
      relativePath: "04-Projects/agent-runtime/ProjectManifest.md",
      absolutePath: join(rootPath, "04-Projects", "agent-runtime", "ProjectManifest.md"),
    });
    await expect(readFile(note.absolutePath, "utf8")).resolves.toBe(
      renderProjectManifestNote(project),
    );
  });

  it("reads back registered projects", async () => {
    const { projects } = await createFixture();
    const { project } = await projects.init({ projectId: "demo", name: "Demo" });

    await expect(projects.get("demo")).resolves.toEqual(project);
    await expect(projects.get("missing")).resolves.toBeNull();
    await expect(projects.list()).resolves.toEqual([project]);
  });

  it("rejects duplicate initialization without overwriting state or the note", async () => {
    const { stateStore, projects } = await createFixture();
    const { project, note } = await projects.init({ projectId: "demo" });
    const contents = "User edited this manifest.\n";
    await writeFile(note.absolutePath, contents);

    await expect(projects.init({
      projectId: "demo",
      name: "Replacement",
    })).rejects.toThrow(ProjectAlreadyExistsError);

    expect((await stateStore.load()).projects.demo).toEqual(project);
    await expect(readFile(note.absolutePath, "utf8")).resolves.toBe(contents);
  });

  it("keeps registration persisted when the vault rejects the note write", async () => {
    const { rootPath, statePath, projects } = await createFixture(["read"]);

    await expect(projects.init({ projectId: "demo" })).rejects.toThrow(VaultPermissionError);

    // This is the existing partial-failure contract: no rollback or retry recovery.
    expect((await new JsonStateStore(statePath).load()).projects.demo).toMatchObject({
      projectId: "demo",
      vaultNamespace: "agent",
    });
    await expect(readFile(join(rootPath, "04-Projects/demo/ProjectManifest.md")))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(projects.init({ projectId: "demo" })).rejects.toThrow(ProjectAlreadyExistsError);
  });

  it("keeps registration persisted when a manifest parent is a file", async () => {
    const { rootPath, statePath, projects } = await createFixture();
    const blockedPath = join(rootPath, "04-Projects");
    await writeFile(blockedPath, "Keep this file.\n");

    await expect(projects.init({ projectId: "demo" })).rejects.toThrow(InvalidPath);

    expect((await new JsonStateStore(statePath).load()).projects.demo.projectId).toBe("demo");
    await expect(readFile(blockedPath, "utf8")).resolves.toBe("Keep this file.\n");
  });
});
