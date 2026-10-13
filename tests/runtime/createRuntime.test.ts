import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";

import type { AgentRuntimeConfig } from "../../src/config/configSchema.js";
import { renderProjectManifestNote } from "../../src/projects/projectManifest.js";
import { renderChangeSetNote } from "../../src/changeSets/changeSetRenderer.js";
import { createRuntime, loadRuntime } from "../../src/runtime/createRuntime.js";
import { JsonStateStore } from "../../src/state/jsonStateStore.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.map((path) => rm(path, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createFixture() {
  const rootPath = await mkdtemp(join(tmpdir(), "engzero-runtime-"));
  tempDirs.push(rootPath);
  const configPath = join(rootPath, "config.yaml");
  const config: AgentRuntimeConfig = {
    agent: { name: "engzero", timezone: "UTC" },
    state: { type: "json", path: join(rootPath, "state", "state.json") },
    vaults: [{
      id: "agent",
      label: "Agent Vault",
      rootPath: join(rootPath, "vault"),
      capabilities: ["read", "write", "append"],
    }],
    projects: { defaultProjectId: "demo" },
  };
  await writeFile(configPath, stringify({
    agent: config.agent,
    state: config.state,
    vaults: config.vaults.map(({ rootPath, ...vault }) => ({ ...vault, root_path: rootPath })),
    projects: { default_project_id: "demo" },
  }));

  return { rootPath, configPath, config };
}

describe("runtime construction", () => {
  it("assembles and loads runtimes without writing files, probing vaults, or logging", async () => {
    const { rootPath, configPath, config } = await createFixture();
    const output = ["log", "error", "warn", "info", "debug"] as const;
    const spies = output.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));

    const runtime = createRuntime(config);
    const loaded = await loadRuntime({
      path: configPath,
      env: { ENGZERO_CONFIG: join(rootPath, "missing-config.yaml") },
      homeDir: rootPath,
    });

    expect(runtime.config).toEqual(config);
    expect(loaded.config).toEqual(config);
    expect(loaded.vaults.list()).toEqual(config.vaults);
    // Neither the state directory nor the nonexistent vault should be created.
    await expect(readdir(rootPath)).resolves.toEqual(["config.yaml"]);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("shares state across project and change-set operations and persists it across runtimes", async () => {
    const { configPath, config } = await createFixture();
    const options = { env: { ENGZERO_CONFIG: configPath } };
    const runtime = await loadRuntime(options);
    const { project, note } = await runtime.projects.init({
      projectId: "demo",
      name: "Demo Project",
    });
    await expect(runtime.projects.get("demo")).resolves.toEqual(project);

    const changeSet = await runtime.changeSets.create({
      projectId: "demo",
      goal: "Record shared runtime work",
      source: "cli",
    });
    const updated = await runtime.changeSets.addPlanItem(changeSet.id, "Extract runtime construction");

    const reloaded = await loadRuntime(options);
    await expect(reloaded.projects.list()).resolves.toEqual([project]);
    await expect(reloaded.changeSets.get(changeSet.id)).resolves.toEqual(updated);
    await expect(reloaded.changeSets.list({ projectId: "demo" })).resolves.toEqual([updated]);
    const state = await new JsonStateStore(config.state.path).load();
    expect(state.version).toBe(1);
    expect(state.projects.demo).toEqual(project);
    expect(state.changeSets[changeSet.id]).toEqual(updated);
    await expect(readFile(note.absolutePath, "utf8")).resolves.toBe(renderProjectManifestNote(project));
    await expect(readFile(join(config.vaults[0].rootPath, updated.obsidianPath), "utf8"))
      .resolves.toBe(renderChangeSetNote(updated).contents);

    // A runtime keeps service instances, but does not cache their stored records.
    await reloaded.changeSets.appendEvent(changeSet.id, { type: "note", message: "Written by another runtime" });
    expect((await runtime.changeSets.get(changeSet.id))?.events.at(-1)?.message)
      .toBe("Written by another runtime");
  });

  it("keeps runtimes for different configurations independent", async () => {
    const firstFixture = await createFixture();
    const secondFixture = await createFixture();
    const first = createRuntime(firstFixture.config);
    const second = createRuntime(secondFixture.config);

    await first.projects.init({ projectId: "demo" });

    await expect(first.projects.list()).resolves.toHaveLength(1);
    await expect(second.projects.list()).resolves.toEqual([]);
    await expect(second.changeSets.list()).resolves.toEqual([]);
    await expect(readdir(secondFixture.rootPath)).resolves.toEqual(["config.yaml"]);
  });
});
