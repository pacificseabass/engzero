import { type Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import type { WriteNoteResult } from "../../markdown/markdownWriter.js";
import { createProjectManifest } from "../../projects/projectManifest.js";
import { ProjectService } from "../../projects/projectService.js";
import type {
  InitProjectInput,
  ProjectManifest,
  RiskProfile,
} from "../../projects/projectTypes.js";
import { JsonStateStore } from "../../state/jsonStateStore.js";
import type { StateStore } from "../../state/stateStore.js";
import { ProjectNotFoundError, RuntimeError } from "../../util/errors.js";
import { VaultRegistry } from "../../vaults/vaultRegistry.js";

type ProjectInitOptions = {
  name?: string;
  type?: string;
  memoryNamespace?: string;
  vault?: string;
  risk?: string;
  json?: boolean;
};

type ProjectListOptions = {
  json?: boolean;
};

type ProjectShowOptions = {
  json?: boolean;
};

export function addProjectSubcommand(program: Command): void {
  const project = program
    .command("project")
    .description("Manage project capsules");

  project
    .command("init <projectId>")
    .description("Create a project capsule in runtime state")
    .option("--name <name>", "Project display name")
    .option("--type <type>", "Project type")
    .option("--memory-namespace <namespace>", "Memory namespace")
    .option("--vault <vaultId>", "Vault namespace/id")
    .option("--risk <risk>", "Risk profile: low, medium, or high")
    .option("--json", "Print created project as JSON")
    .action(async (projectId: string, options: ProjectInitOptions) => {
      const { stateStore, vaultRegistry } = await createRuntime();
      const { project, note } = await runProjectInit(stateStore, vaultRegistry, {
        projectId,
        name: options.name,
        projectType: options.type,
        memoryNamespace: options.memoryNamespace,
        vaultNamespace: options.vault,
        riskProfile: parseRiskProfile(options.risk),
      });

      console.log(formatProjectInit(project, options, note));
    });

  project
    .command("list")
    .description("List registered projects")
    .option("--json", "Print projects as JSON")
    .action(async (options: ProjectListOptions) => {
      const service = await createProjectService();
      const projects = await service.list();

      console.log(formatProjectList(projects, options));
    });

  project
    .command("show <projectId>")
    .description("Show a registered project")
    .option("--json", "Print project as JSON")
    .action(async (projectId: string, options: ProjectShowOptions) => {
      const service = await createProjectService();
      const project = await service.get(projectId);

      if (project === null) {
        throw new ProjectNotFoundError(`Project not found: ${projectId}`);
      }

      console.log(formatProject(project, options));
    });
}

export async function runProjectInit(
  stateStore: StateStore,
  vaultRegistry: VaultRegistry,
  input: InitProjectInput,
): Promise<{ project: ProjectManifest; note: WriteNoteResult }> {
  const service = new ProjectService(stateStore, vaultRegistry);
  const project = await service.init(input);
  const note = await createProjectManifest(
    stateStore,
    vaultRegistry,
    project.projectId,
  );

  return { project, note };
}

async function createRuntime(): Promise<{
  stateStore: StateStore;
  vaultRegistry: VaultRegistry;
}> {
  const config = await loadConfig();

  return {
    stateStore: new JsonStateStore(config.state.path),
    vaultRegistry: new VaultRegistry(config.vaults),
  };
}

async function createProjectService(): Promise<ProjectService> {
  const { stateStore, vaultRegistry } = await createRuntime();

  return new ProjectService(stateStore, vaultRegistry);
}

function parseRiskProfile(value: string | undefined): RiskProfile | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  throw new RuntimeError(
    `Invalid risk profile: ${value}. Expected low, medium, or high.`,
    "invalid-risk-profile",
  );
}

export function formatProjectList(
  projects: ProjectManifest[],
  options: ProjectListOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(projects, null, 2);
  }

  if (projects.length === 0) {
    return "No projects registered.";
  }

  return projects
    .map((project) =>
      [
        project.projectId,
        project.riskProfile,
        project.vaultNamespace,
        project.name,
      ].join("\t"),
    )
    .join("\n");
}

export function formatProjectInit(
  project: ProjectManifest,
  options: Pick<ProjectInitOptions, "json"> = {},
  note?: WriteNoteResult,
): string {
  if (options.json) {
    return JSON.stringify(project, null, 2);
  }

  const lines = [`Created project: ${project.projectId}`];
  if (note !== undefined) {
    lines.push(`Manifest note: ${note.relativePath} (vault: ${note.vaultId})`);
  }

  return lines.join("\n");
}

export function formatProject(
  project: ProjectManifest,
  options: ProjectShowOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(project, null, 2);
  }

  return [
    "Project",
    `  id: ${project.projectId}`,
    `  name: ${project.name}`,
    `  type: ${project.projectType ?? "(none)"}`,
    `  memoryNamespace: ${project.memoryNamespace}`,
    `  vaultNamespace: ${project.vaultNamespace}`,
    `  riskProfile: ${project.riskProfile}`,
    `  repos: ${project.repos.length}`,
    `  deploymentTargets: ${project.deploymentTargets.length}`,
    `  toolsAllowed: ${project.toolsAllowed.length}`,
  ].join("\n");
}
