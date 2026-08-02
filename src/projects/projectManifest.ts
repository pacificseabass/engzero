import { renderFrontMatter } from "../markdown/frontmatter.js";
import {
  MarkdownWriter,
  type WriteNoteResult,
} from "../markdown/markdownWriter.js";
import type { StateStore } from "../state/stateStore.js";
import { ProjectNotFoundError } from "../util/errors.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";
import { ProjectService } from "./projectService.js";
import type { RiskProfile } from "./projectTypes.js";

export async function createProjectManifest(
  stateStore: StateStore,
  vaultRegistry: VaultRegistry,
  projectId: string,
  riskProfile: RiskProfile,
  vaultNamespace: string,
  memoryNamespace: string,
): Promise<WriteNoteResult> {
  const frontMatter = renderFrontMatter({
    type: "project-manifest",
    status: "active",
    project_id: projectId,
    risk_profile: riskProfile,
    vault_namespace: vaultNamespace,
    memory_namespace: memoryNamespace,
  });

  const project = await new ProjectService(stateStore, vaultRegistry).get(
    projectId,
  );
  if (project === null) {
    throw new ProjectNotFoundError(`Unable to find project for id ${projectId}`);
  }

  const writer = new MarkdownWriter(vaultRegistry);

  return writer.writeNote({
    vaultId: vaultNamespace,
    relativePath: getProjectManifestPath(projectId),
    contents: frontMatter,
  });
}

export function getProjectManifestPath(projectId: string): string {
  return `04-Projects/${projectId}/ProjectManifest.md`;
}
