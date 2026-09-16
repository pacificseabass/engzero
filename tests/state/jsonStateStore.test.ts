import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { JsonStateStore } from "../../src/state/jsonStateStore.js";
import { createEmptyState } from "../../src/state/stateTypes.js";
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

  it.skipIf(process.platform === "win32")("creates private state and directories even with a permissive umask", async () => {
    const statePath = await createTempStatePath("private/nested/state.json");
    const previousUmask = process.umask(0);
    try {
      await new JsonStateStore(statePath).save(createEmptyState());
      expect((await stat(statePath)).mode & 0o777).toBe(0o600);
      expect((await stat(dirname(statePath))).mode & 0o777).toBe(0o700);
      expect((await stat(dirname(dirname(statePath)))).mode & 0o777).toBe(0o700);
    } finally {
      process.umask(previousUmask);
    }
  });

  it.skipIf(process.platform === "win32")("repairs state permissions without changing an existing parent directory", async () => {
    const statePath = await createTempStatePath("shared/state.json");
    await mkdir(dirname(statePath));
    await chmod(dirname(statePath), 0o755);
    await writeFile(statePath, JSON.stringify(createEmptyState()));
    await chmod(statePath, 0o644);

    await new JsonStateStore(statePath).save(createEmptyState());

    expect((await stat(statePath)).mode & 0o777).toBe(0o600);
    expect((await stat(dirname(statePath))).mode & 0o777).toBe(0o755);
    await expect(readdir(dirname(statePath))).resolves.toEqual(["state.json"]);
  });

  it("cleans up a temporary state file after a failed replacement", async () => {
    const statePath = await createTempStatePath();
    await mkdir(statePath);

    await expect(new JsonStateStore(statePath).save(createEmptyState())).rejects.toThrow(StateStoreError);

    await expect(readdir(dirname(statePath))).resolves.toEqual(["state.json"]);
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
