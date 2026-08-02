import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { renderChangeSetNote } from "../../src/changeSets/changeSetRenderer.js";
import { ChangeSetService } from "../../src/changeSets/changeSetService.js";
import { ProjectService } from "../../src/projects/projectService.js";
import {
  ChangeSetNotFoundError,
  InvalidStatusTransitionError,
  ProjectNotFoundError,
  VaultPermissionError,
} from "../../src/util/errors.js";
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

type Fixture = {
  vault: VaultConfig;
  stateStore: InMemoryStateStore;
  service: ChangeSetService;
};

async function createFixture(
  capabilities: VaultConfig["capabilities"] = ["read", "write", "append"],
): Promise<Fixture> {
  const rootPath = await mkdtemp(join(tmpdir(), "3ng0-change-set-"));
  tempDirs.push(rootPath);

  const vault: VaultConfig = {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities,
  };
  const vaultRegistry = new VaultRegistry([vault]);
  const stateStore = new InMemoryStateStore();
  await new ProjectService(stateStore, vaultRegistry).init({
    projectId: "agent-runtime",
  });

  return {
    vault,
    stateStore,
    service: new ChangeSetService(stateStore, vaultRegistry),
  };
}

describe("ChangeSetService.create", () => {
  it("creates a change set in state and writes its vault note", async () => {
    const { vault, stateStore, service } = await createFixture();

    const changeSet = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    expect(changeSet.id).toMatch(/^cs_\d{8}_[a-z0-9]{6}$/);
    expect(changeSet.title).toBe("Bootstrap memory ledger");
    expect(changeSet.status).toBe("created");
    expect(changeSet.riskLevel).toBe("medium");
    expect(changeSet.events).toHaveLength(1);
    expect(changeSet.events[0]).toMatchObject({
      type: "created",
      message: "Change set created: Bootstrap memory ledger",
    });
    expect(changeSet.obsidianPath).toMatch(
      /^02-Change-Sets\/\d{4}-\d{2}\/cs_\d{8}_[a-z0-9]{6} - bootstrap-memory-ledger\.md$/,
    );

    const state = await stateStore.load();
    expect(state.changeSets[changeSet.id]).toEqual(changeSet);

    const contents = await readFile(
      join(vault.rootPath, changeSet.obsidianPath),
      "utf8",
    );
    expect(contents).toBe(renderChangeSetNote(changeSet).contents);
  });

  it("classifies risk from the goal when not provided", async () => {
    const { service } = await createFixture();

    const changeSet = await service.create({
      projectId: "agent-runtime",
      goal: "Run the database migration",
      source: "cli",
    });

    expect(changeSet.riskLevel).toBe("high");
  });

  it("respects an explicit risk level and title", async () => {
    const { service } = await createFixture();

    const changeSet = await service.create({
      projectId: "agent-runtime",
      goal: "Run the database migration",
      title: "Migration prep",
      source: "manual",
      riskLevel: "low",
    });

    expect(changeSet.riskLevel).toBe("low");
    expect(changeSet.title).toBe("Migration prep");
  });

  it("rejects unknown projects", async () => {
    const { service } = await createFixture();

    await expect(
      service.create({ projectId: "missing", goal: "Anything", source: "cli" }),
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("rejects vaults without write capability", async () => {
    const { service } = await createFixture(["read"]);

    await expect(
      service.create({
        projectId: "agent-runtime",
        goal: "Bootstrap memory ledger",
        source: "cli",
      }),
    ).rejects.toThrow(VaultPermissionError);
  });
});

describe("ChangeSetService mutations", () => {
  it("appends events and keeps the vault note in sync", async () => {
    const { vault, service } = await createFixture();
    const created = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    const updated = await service.appendEvent(created.id, {
      type: "note",
      message: "Created initial schema",
    });

    expect(updated.events).toHaveLength(2);
    expect(updated.events[1]).toMatchObject({
      type: "note",
      message: "Created initial schema",
    });
    expect(updated.events[1].id).toMatch(/^evt_[a-z0-9]{6}$/);

    const contents = await readFile(
      join(vault.rootPath, updated.obsidianPath),
      "utf8",
    );
    expect(contents).toContain("Created initial schema");
  });

  it("changes status through the lifecycle and records the transition", async () => {
    const { service } = await createFixture();
    const created = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    const updated = await service.setStatus(created.id, "planning");

    expect(updated.status).toBe("planning");
    expect(updated.events.at(-1)).toMatchObject({
      type: "status_changed",
      message: "Status changed to planning",
      data: { status: "planning" },
    });
  });

  it("rejects invalid status transitions without recording anything", async () => {
    const { service } = await createFixture();
    const created = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    await expect(service.setStatus(created.id, "deployed")).rejects.toThrow(
      InvalidStatusTransitionError,
    );

    const current = await service.get(created.id);
    expect(current?.status).toBe("created");
    expect(current?.events).toHaveLength(1);
  });

  it("adds plan items, files, and validations", async () => {
    const { service } = await createFixture();
    const created = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    await service.addPlanItem(created.id, "Define vault registry");
    await service.addFileChanged(created.id, "src/vaults/vaultRegistry.ts");
    await service.addFileChanged(created.id, "src/vaults/vaultRegistry.ts");
    const updated = await service.addValidation(created.id, {
      kind: "test",
      command: "pnpm test",
      status: "passed",
      summary: "Unit tests passed",
    });

    expect(updated.plan).toEqual(["Define vault registry"]);
    expect(updated.filesChanged).toEqual(["src/vaults/vaultRegistry.ts"]);
    expect(updated.testsRun).toHaveLength(1);
    expect(updated.testsRun[0]).toMatchObject({
      kind: "test",
      status: "passed",
      summary: "Unit tests passed",
    });
    expect(updated.testsRun[0].id).toMatch(/^val_[a-z0-9]{6}$/);
    expect(updated.events).toHaveLength(5);
  });

  it("closes a change set with a review summary", async () => {
    const { service } = await createFixture();
    const created = await service.create({
      projectId: "agent-runtime",
      goal: "Bootstrap memory ledger",
      source: "cli",
    });

    const closed = await service.close(
      created.id,
      "Memory ledger bootstrap complete",
    );

    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBe(closed.updatedAt);
    expect(closed.reviewSummary).toBe("Memory ledger bootstrap complete");
    expect(closed.events.at(-1)).toMatchObject({
      type: "closed",
      message: "Memory ledger bootstrap complete",
    });

    await expect(service.close(created.id, "Again")).rejects.toThrow(
      InvalidStatusTransitionError,
    );
  });

  it("rejects unknown change-set ids", async () => {
    const { service } = await createFixture();

    await expect(
      service.appendEvent("cs_20260504_zzzzzz", {
        type: "note",
        message: "Nope",
      }),
    ).rejects.toThrow(ChangeSetNotFoundError);
    await expect(service.get("cs_20260504_zzzzzz")).resolves.toBeNull();
  });
});

describe("ChangeSetService.list", () => {
  it("filters by project and status", async () => {
    const { service, stateStore } = await createFixture();
    const vaultRegistry = undefined;
    await new ProjectService(stateStore, vaultRegistry).init({
      projectId: "homelab",
    });

    const first = await service.create({
      projectId: "agent-runtime",
      goal: "First",
      source: "cli",
    });
    const second = await service.create({
      projectId: "homelab",
      goal: "Second",
      source: "cli",
    });
    await service.setStatus(second.id, "planning");

    const all = await service.list();
    expect(all.map((changeSet) => changeSet.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    await expect(service.list({ projectId: "homelab" })).resolves.toMatchObject([
      { id: second.id },
    ]);
    await expect(service.list({ status: "planning" })).resolves.toMatchObject([
      { id: second.id },
    ]);
    await expect(
      service.list({ projectId: "agent-runtime", status: "planning" }),
    ).resolves.toEqual([]);
  });
});
