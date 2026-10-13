import type { WriteNoteResult } from "../markdown/markdownWriter.js";
import type { StateStore } from "../state/stateStore.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";
import { createProjectManifest } from "./projectManifest.js";
import { ProjectService } from "./projectService.js";
import type { InitProjectInput, ProjectManifest } from "./projectTypes.js";

export type InitProjectResult = {
  project: ProjectManifest;
  note: WriteNoteResult;
};

/**
 * Complete project operations shared by the CLI and the MCP server.
 *
 * `init` registers the project and writes its manifest note. Registration is
 * persisted before the note is written, so a failed note write leaves the
 * project registered without a note.
 */
export class ProjectOperations {
  private readonly service: ProjectService;

  constructor(
    private readonly stateStore: StateStore,
    private readonly vaultRegistry: VaultRegistry,
  ) {
    this.service = new ProjectService(stateStore, vaultRegistry);
  }

  async init(input: InitProjectInput): Promise<InitProjectResult> {
    const project = await this.service.init(input);
    const note = await createProjectManifest(
      this.stateStore,
      this.vaultRegistry,
      project.projectId,
    );

    return { project, note };
  }

  async get(projectId: string): Promise<ProjectManifest | null> {
    return this.service.get(projectId);
  }

  async list(): Promise<ProjectManifest[]> {
    return this.service.list();
  }
}
