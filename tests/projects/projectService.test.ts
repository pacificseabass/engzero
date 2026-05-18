import { describe, expect, it } from "vitest";

import { ProjectService } from "../../src/projects/projectService.js";
import { createEmptyState, type AgentRuntimeState } from "../../src/state/stateTypes.js";
import type { StateStore } from "../../src/state/stateStore.js";
import {
  InvalidProjectId,
  InvalidStateError,
  ProjectAlreadyExistsError,
} from "../../src/util/errors.js";
import { VaultRegistry } from "../../src/vaults/vaultRegistry.js";

describe("ProjectService", () => {
  it("initializes a project by normalizing partial input into a manifest", async () => {
    const stateStore = new InMemoryStateStore();
    const service = new ProjectService(stateStore);

    const project = await service.init({
      projectId: "agent-runtime",
      riskProfile: "high",
    });

    expect(project).toEqual({
      projectId: "agent-runtime",
      name: "agent-runtime",
      memoryNamespace: "agent-runtime",
      vaultNamespace: "agent",
      repos: [],
      riskProfile: "high",
      deploymentTargets: [],
      toolsAllowed: [],
    });
    await expect(service.get("agent-runtime")).resolves.toEqual(project);
  });

  it("returns null for missing projects", async () => {
    const service = new ProjectService(new InMemoryStateStore());

    await expect(service.get("missing")).resolves.toBeNull();
  });

  it("lists projects from state", async () => {
    const service = new ProjectService(new InMemoryStateStore());

    const first = await service.init({ projectId: "alpha" });
    const second = await service.init({ projectId: "beta" });

    await expect(service.list()).resolves.toEqual([first, second]);
  });

  it("rejects unsafe project ids", async () => {
    const service = new ProjectService(new InMemoryStateStore());

    await expect(service.init({ projectId: "../escape" })).rejects.toThrow(
      InvalidProjectId,
    );
  });

  it("rejects duplicate project initialization", async () => {
    const service = new ProjectService(new InMemoryStateStore());

    await service.init({ projectId: "agent-runtime" });
    const error = await service
      .init({ projectId: "agent-runtime" })
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ProjectAlreadyExistsError);
    expect(error).toMatchObject({
      code: "project-already-exists",
    });
  });

  it("accepts project vault namespaces that exist in the vault registry", async () => {
    const service = new ProjectService(
      new InMemoryStateStore(),
      new VaultRegistry([
        {
          id: "agent",
          label: "Agent Vault",
          rootPath: "/tmp/agent-vault",
          capabilities: ["read", "write", "append"],
        },
      ]),
    );

    await expect(
      service.init({ projectId: "agent-runtime", vaultNamespace: "agent" }),
    ).resolves.toMatchObject({
      vaultNamespace: "agent",
    });
  });

  it("rejects project vault namespaces that are not configured", async () => {
    const service = new ProjectService(
      new InMemoryStateStore(),
      new VaultRegistry([
        {
          id: "agent",
          label: "Agent Vault",
          rootPath: "/tmp/agent-vault",
          capabilities: ["read", "write", "append"],
        },
      ]),
    );

    const error = await service
      .init({ projectId: "agent-runtime", vaultNamespace: "missing" })
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(InvalidStateError);
    expect(error).toMatchObject({
      code: "project-vault-not-found",
    });
  });
});

class InMemoryStateStore implements StateStore {
  private state = createEmptyState();

  async load(): Promise<AgentRuntimeState> {
    return structuredClone(this.state);
  }

  async save(state: AgentRuntimeState): Promise<void> {
    this.state = structuredClone(state);
  }

  async transaction<T>(fn: (state: AgentRuntimeState) => Promise<T>): Promise<T> {
    const state = await this.load();
    const result = await fn(state);
    await this.save(state);

    return result;
  }
}
