import type {
  ChangeSet,
  ChangeSetEvent,
  DeploymentImpact,
  ModelTraceSummary,
  ValidationRecord,
} from "../../changeSets/changeSetTypes.js";
import type { MemoryUpdateRef } from "../../memory/memoryTypes.js";
import { renderFrontMatter } from "../frontmatter.js";
import { wikiLink } from "../links.js";

export function renderChangeSetTemplate(changeSet: ChangeSet): string {
  const frontMatter = renderFrontMatter({
    type: "change-set",
    status: changeSet.status,
    created: changeSet.createdAt,
    updated: changeSet.updatedAt,
    closed: changeSet.closedAt,
    project_id: changeSet.projectId,
    change_set_id: changeSet.id,
    risk_level: changeSet.riskLevel,
    source: changeSet.source,
  });

  const body = [
    `# Change Set: ${changeSet.title}`,
    "",
    "## Goal",
    "",
    changeSet.goal,
    "",
    "## Status",
    "",
    changeSet.status,
    "",
    "## Risk Level",
    "",
    changeSet.riskLevel,
    "",
    "## Plan",
    "",
    ...list(changeSet.plan, "No plan items yet."),
    "",
    "## Events",
    "",
    ...list(changeSet.events.map(formatEvent), "No events recorded."),
    "",
    "## Files Changed",
    "",
    ...list(changeSet.filesChanged, "No files changed."),
    "",
    "## Validation",
    "",
    ...list(changeSet.testsRun.map(formatValidation), "No validation recorded."),
    "",
    "## Deployment Impact",
    "",
    ...formatDeploymentImpact(changeSet.deploymentImpact),
    "",
    "## Rollback Notes",
    "",
    changeSet.rollbackNotes ?? "_None._",
    "",
    "## Memory Updates",
    "",
    ...list(changeSet.memoryUpdates.map(formatMemoryUpdate), "None yet."),
    "",
    "## Model Trace",
    "",
    ...formatModelTrace(changeSet.modelTrace),
    "",
    "## Review Summary",
    "",
    changeSet.reviewSummary ?? "_Pending._",
    "",
    "## Follow-Ups",
    "",
    "_None._",
    "",
  ];

  return `${frontMatter}\n${body.join("\n")}`;
}

function list(items: string[], emptyMessage: string): string[] {
  if (items.length === 0) {
    return [`_${emptyMessage}_`];
  }

  return items.map((item) => `- ${item}`);
}

function formatEvent(event: ChangeSetEvent): string {
  return `${event.timestamp} [${event.type}] ${event.message}`;
}

function formatValidation(validation: ValidationRecord): string {
  const command =
    validation.command === undefined ? "" : ` (\`${validation.command}\`)`;

  return `${validation.status} ${validation.kind} — ${validation.summary}${command}`;
}

function formatDeploymentImpact(impact: DeploymentImpact | undefined): string[] {
  if (impact === undefined) {
    return ["_Not assessed._"];
  }

  if (!impact.hasDeploymentImpact) {
    return ["No deployment impact."];
  }

  const lines = ["Has deployment impact."];
  if (impact.environments !== undefined && impact.environments.length > 0) {
    lines.push("", ...impact.environments.map((env) => `- ${env}`));
  }
  if (impact.summary !== undefined) {
    lines.push("", impact.summary);
  }

  return lines;
}

function formatMemoryUpdate(ref: MemoryUpdateRef): string {
  return `${ref.type}: ${ref.summary} (${wikiLink(ref.obsidianPath)})`;
}

function formatModelTrace(trace: ModelTraceSummary | undefined): string[] {
  if (trace === undefined) {
    return ["_None recorded._"];
  }

  const lines = [`Mode: ${trace.mode ?? "none"}`];
  for (const model of trace.models ?? []) {
    lines.push(`- ${model.role}: ${model.provider}/${model.model}`);
  }
  if (trace.summary !== undefined) {
    lines.push("", trace.summary);
  }

  return lines;
}
