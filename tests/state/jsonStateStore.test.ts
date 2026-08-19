import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { JsonStateStore } from "../../src/state/jsonStateStore.js";
import { StateStoreError } from "../../src/util/errors.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("JsonStateStore", () => {
  it("returns an empty state when the state file does not exist", async () => {
    const statePath = await createTempStatePath();
    const store = new JsonStateStore(statePath);

    await expect(store.load()).resolves.toEqual({
      version: 1,
      projects: {},
      changeSets: {},
      memoryUpdates: {},
    });
  });

  it("creates parent directories and persists state", async () => {
    const statePath = await createTempStatePath("nested/state.json");
    const store = new JsonStateStore(statePath);

    await store.save({
      version: 1,
      projects: {
        "agent-runtime": {
          projectId: "agent-runtime",
          name: "Agent Runtime",
          memoryNamespace: "agent-runtime",
          vaultNamespace: "agent",
          repos: [],
          riskProfile: "high",
          deploymentTargets: [],
          toolsAllowed: [],
        },
      },
      changeSets: {},
      memoryUpdates: {},
    });

    const reloaded = await store.load();

    expect(reloaded.projects["agent-runtime"]?.name).toBe("Agent Runtime");
  });

  it("runs a transaction by loading, mutating, and saving state", async () => {
    const statePath = await createTempStatePath();
    const store = new JsonStateStore(statePath);

    const result = await store.transaction(async (state) => {
      state.memoryUpdates.example = {
        id: "mem_20260504_example",
        type: "lesson",
        obsidianPath: "03-Self-Improvement/Lessons/example.md",
        summary: "Example lesson",
      };

      return "done";
    });

    await expect(store.load()).resolves.toMatchObject({
      memoryUpdates: {
        example: {
          summary: "Example lesson",
        },
      },
    });
    expect(result).toBe("done");
  });

  it("fails clearly when the state file contains invalid JSON", async () => {
    const statePath = await createTempStatePath();
    await writeFile(statePath, "{not valid json", "utf8");

    const store = new JsonStateStore(statePath);

    const error = await store.load().catch((error: unknown) => error);

    expect(error).toBeInstanceOf(StateStoreError);
    expect(error).toMatchObject({
      code: "state-invalid-json",
    });
    expect((error as StateStoreError).cause).toBeInstanceOf(SyntaxError);
  });

  it("rejects unsupported state versions", async () => {
    const statePath = await createTempStatePath();
    await writeFile(
      statePath,
      JSON.stringify({
        version: 999,
        projects: {},
        changeSets: {},
        memoryUpdates: {},
      }),
      "utf8",
    );

    const store = new JsonStateStore(statePath);

    await expect(store.load()).rejects.toThrow("Unsupported state version");
  });

  it("writes readable formatted JSON", async () => {
    const statePath = await createTempStatePath();
    const store = new JsonStateStore(statePath);

    await store.save({
      version: 1,
      projects: {},
      changeSets: {},
      memoryUpdates: {},
    });

    const raw = await readFile(statePath, "utf8");

    expect(raw).toBe(
      [
        "{",
        '  "version": 1,',
        '  "projects": {},',
        '  "changeSets": {},',
        '  "memoryUpdates": {}',
        "}",
        "",
      ].join("\n"),
    );
  });
});

async function createTempStatePath(relativePath = "state.json"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engzero-state-store-"));
  tempDirs.push(dir);

  return join(dir, relativePath);
}
