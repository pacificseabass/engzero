import type { StateStore } from "../state/stateStore.js";
import {
  InvalidProjectId,
  InvalidStateError,
  ProjectAlreadyExistsError,
} from "../util/errors.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";
import type { InitProjectInput, ProjectManifest } from "./projectTypes.js";

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function assertValidProjectId(projectId: string): void {
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw new InvalidProjectId(`Invalid project id: ${projectId}`);
  }
}

function createProjectManifest(input: InitProjectInput): ProjectManifest {
  return {
    projectId: input.projectId,
    name: input.name ?? input.projectId,
    projectType: input.projectType,
    memoryNamespace: input.memoryNamespace ?? input.projectId,
    vaultNamespace: input.vaultNamespace ?? "agent",
    repos: input.repos ?? [],
    riskProfile: input.riskProfile ?? "medium",
    deploymentTargets: input.deploymentTargets ?? [],
    toolsAllowed: input.toolsAllowed ?? [],
    custom: input.custom,
  };
}

export class ProjectService {
  constructor(
    private readonly stateStore: StateStore,
    private readonly vaultRegistry?: VaultRegistry,
  ) { }

  async init(input: InitProjectInput): Promise<ProjectManifest> {
    assertValidProjectId(input.projectId);

    const manifest = createProjectManifest(input);
    this.assertVaultNamespaceExists(manifest.vaultNamespace);

    await this.stateStore.transaction(async (state) => {
      if (state.projects[manifest.projectId] !== undefined) {
        throw new ProjectAlreadyExistsError(input.projectId);
      }
      state.projects[manifest.projectId] = manifest;
    });

    return manifest;
  }

  async get(projectId: string): Promise<ProjectManifest | null> {
    assertValidProjectId(projectId);
    const state = await this.stateStore.load();

    return state.projects[projectId] ?? null;
  }

  async list(): Promise<ProjectManifest[]> {
    const state = await this.stateStore.load();

    return Object.values(state.projects);
  }

  private assertVaultNamespaceExists(vaultNamespace: string): void {
    if (this.vaultRegistry === undefined) {
      return;
    }

    if (this.vaultRegistry.get(vaultNamespace) === null) {
      throw new InvalidStateError(
        `Vault namespace not found for project: ${vaultNamespace}`,
        "project-vault-not-found",
      );
    }
  }
}
