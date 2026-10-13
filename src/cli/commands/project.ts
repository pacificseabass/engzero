import { type Command } from "commander";

import type { WriteNoteResult } from "../../markdown/markdownWriter.js";
import type {
  ProjectManifest,
  RiskProfile,
} from "../../projects/projectTypes.js";
import { loadRuntime } from "../../runtime/createRuntime.js";
import { ProjectNotFoundError, RuntimeError } from "../../util/errors.js";

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
      const runtime = await loadRuntime();
      const { project, note } = await runtime.projects.init({
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
      const runtime = await loadRuntime();
      const projects = await runtime.projects.list();

      console.log(formatProjectList(projects, options));
    });

  project
    .command("show <projectId>")
    .description("Show a registered project")
    .option("--json", "Print project as JSON")
    .action(async (projectId: string, options: ProjectShowOptions) => {
      const runtime = await loadRuntime();
      const project = await runtime.projects.get(projectId);

      if (project === null) {
        throw new ProjectNotFoundError(`Project not found: ${projectId}`);
      }

      console.log(formatProject(project, options));
    });
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
