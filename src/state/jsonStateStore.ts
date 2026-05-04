import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { StateStoreError } from "../util/errors.js";
import type { StateStore } from "./stateStore.js";
import { type AgentRuntimeState, createEmptyState } from "./stateTypes.js";

export class JsonStateStore implements StateStore {
  constructor(private readonly path: string) { }

  async load(): Promise<AgentRuntimeState> {
    let raw: string;

    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return createEmptyState();
      }

      throw new StateStoreError(
        `Failed to read state store at ${this.path}: ${formatError(error)}`,
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new StateStoreError(
        `State store at ${this.path} contains invalid JSON: ${formatError(error)}`,
      );
    }

    return parseState(parsed, this.path);
  }

  async save(state: AgentRuntimeState): Promise<void> {
    assertSupportedState(state, this.path);

    const stateDir = dirname(this.path);
    const tempPath = `${this.path}.tmp-${process.pid}-${Date.now()}`;
    const serialized = `${JSON.stringify(state, null, 2)}\n`;

    try {
      await mkdir(stateDir, { recursive: true });
      await writeFile(tempPath, serialized, "utf8");
      await rename(tempPath, this.path);
    } catch (error) {
      throw new StateStoreError(
        `Failed to write state store at ${this.path}: ${formatError(error)}`,
      );
    }
  }

  async transaction<T>(
    fn: (state: AgentRuntimeState) => Promise<T>,
  ): Promise<T> {
    const state = await this.load();
    const result = await fn(state);
    await this.save(state);

    return result;
  }
}

function parseState(value: unknown, path: string): AgentRuntimeState {
  if (!isRecord(value)) {
    throw new StateStoreError(`State store at ${path} must contain an object.`);
  }

  const state = value as Partial<AgentRuntimeState>;
  assertSupportedState(state, path);

  return {
    ...state,
    version: 1,
    projects: state.projects ?? {},
    changeSets: state.changeSets ?? {},
    memoryUpdates: state.memoryUpdates ?? {},
  };
}

function assertSupportedState(
  state: Partial<AgentRuntimeState>,
  path: string,
): asserts state is AgentRuntimeState {
  if (state.version !== 1) {
    throw new StateStoreError(
      `Unsupported state version in ${path}: ${String(state.version)}`,
    );
  }

  if (!isRecord(state.projects)) {
    throw new StateStoreError(`State store at ${path} has invalid projects.`);
  }

  if (!isRecord(state.changeSets)) {
    throw new StateStoreError(`State store at ${path} has invalid changeSets.`);
  }

  if (!isRecord(state.memoryUpdates)) {
    throw new StateStoreError(
      `State store at ${path} has invalid memoryUpdates.`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
