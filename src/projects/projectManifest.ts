import { renderFrontMatter } from "../markdown/frontmatter.js";
import {
  MarkdownWriter,
  type WriteNoteResult,
} from "../markdown/markdownWriter.js";
import type { StateStore } from "../state/stateStore.js";
import { ProjectNotFoundError } from "../util/errors.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";
import { ProjectService } from "./projectService.js";
import type {
  DeploymentTarget,
  ProjectManifest,
  ProjectRepo,
} from "./projectTypes.js";

export async function createProjectManifest(
  stateStore: StateStore,
  vaultRegistry: VaultRegistry,
  projectId: string,
): Promise<WriteNoteResult> {
  const project = await new ProjectService(stateStore, vaultRegistry).get(
    projectId,
  );
  if (project === null) {
    throw new ProjectNotFoundError(`Unable to find project for id ${projectId}`);
  }

  const writer = new MarkdownWriter(vaultRegistry);

  return writer.writeNote({
    vaultId: project.vaultNamespace,
    relativePath: getProjectManifestPath(projectId),
    contents: renderProjectManifestNote(project),
  });
}

export function renderProjectManifestNote(project: ProjectManifest): string {
  const frontMatter = renderFrontMatter({
    type: "project-manifest",
    status: "active",
    project_id: project.projectId,
    name: project.name,
    project_type: project.projectType,
    risk_profile: project.riskProfile,
    vault_namespace: project.vaultNamespace,
    memory_namespace: project.memoryNamespace,
  });

  const body = [
    `# Project Manifest: ${project.name}`,
    "",
    "## Repositories",
    "",
    ...renderSectionList(project.repos.map(formatRepo), "No repositories registered."),
    "",
    "## Deployment Targets",
    "",
    ...renderSectionList(
      project.deploymentTargets.map(formatDeploymentTarget),
      "No deployment targets registered.",
    ),
    "",
    "## Allowed Tools",
    "",
    ...renderSectionList(project.toolsAllowed, "No tools allowed."),
    "",
  ];

  return `${frontMatter}\n${body.join("\n")}`;
}

export function getProjectManifestPath(projectId: string): string {
  return `04-Projects/${projectId}/ProjectManifest.md`;
}

function renderSectionList(items: string[], emptyMessage: string): string[] {
  if (items.length === 0) {
    return [`_${emptyMessage}_`];
  }

  return items.map((item) => `- ${item}`);
}

function formatRepo(repo: ProjectRepo): string {
  const details = [repo.path, repo.remote].filter(
    (value) => value !== undefined,
  );

  return `${repo.name} (${details.join(", ")})`;
}

function formatDeploymentTarget(target: DeploymentTarget): string {
  const details = [target.provider, target.environment, target.status].filter(
    (value) => value !== undefined,
  );

  return `${target.name} (${details.join(", ")})`;
}
