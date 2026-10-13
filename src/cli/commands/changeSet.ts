import { type Command } from "commander";

import type { ChangeSetFilter } from "../../changeSets/changeSetService.js";
import type {
  ChangeSet,
  ChangeSetEvent,
  ChangeSetStatus,
  RiskLevel,
  ValidationRecord,
} from "../../changeSets/changeSetTypes.js";
import { loadRuntime } from "../../runtime/createRuntime.js";
import { ChangeSetNotFoundError, RuntimeError } from "../../util/errors.js";

const STATUSES: ChangeSetStatus[] = [
  "created",
  "planning",
  "executing",
  "validating",
  "ready_for_review",
  "deployed",
  "failed",
  "closed",
];

const EVENT_TYPES: ChangeSetEvent["type"][] = [
  "created",
  "status_changed",
  "note",
  "plan_updated",
  "file_changed",
  "validation_recorded",
  "failure_recorded",
  "memory_written",
  "closed",
];

const SOURCES: ChangeSet["source"][] = [
  "chat",
  "cli",
  "obsidian",
  "watcher",
  "manual",
];

const VALIDATION_KINDS: ValidationRecord["kind"][] = [
  "test",
  "build",
  "lint",
  "manual",
  "other",
];

const VALIDATION_STATUSES: ValidationRecord["status"][] = [
  "passed",
  "failed",
  "skipped",
  "unknown",
];

type JsonOption = { json?: boolean };

export function addChangeSetSubcommand(program: Command): void {
  const changeSet = program
    .command("change-set")
    .description("Manage change sets");

  changeSet
    .command("create")
    .description("Create a change set")
    .requiredOption("--project <projectId>", "Owning project id")
    .requiredOption("--goal <goal>", "What this change set should achieve")
    .option("--title <title>", "Short title (defaults to the goal)")
    .option("--risk <risk>", "Risk level: low, medium, or high")
    .option("--source <source>", "Origin of the change set", "cli")
    .option("--json", "Print created change set as JSON")
    .action(
      async (options: {
        project: string;
        goal: string;
        title?: string;
        risk?: string;
        source: string;
        json?: boolean;
      }) => {
        const { changeSets: service } = await loadRuntime();
        const created = await service.create({
          projectId: options.project,
          goal: options.goal,
          title: options.title,
          source: parseChoice(options.source, SOURCES, "source"),
          riskLevel:
            options.risk === undefined
              ? undefined
              : parseChoice<RiskLevel>(
                  options.risk,
                  ["low", "medium", "high"],
                  "risk level",
                ),
        });

        console.log(formatChangeSetCreate(created, options));
      },
    );

  changeSet
    .command("list")
    .description("List change sets")
    .option("--project <projectId>", "Filter by project id")
    .option("--status <status>", "Filter by status")
    .option("--json", "Print change sets as JSON")
    .action(
      async (options: { project?: string; status?: string; json?: boolean }) => {
        const filter: ChangeSetFilter = {
          projectId: options.project,
          status:
            options.status === undefined
              ? undefined
              : parseChoice(options.status, STATUSES, "status"),
        };
        const { changeSets: service } = await loadRuntime();

        console.log(formatChangeSetList(await service.list(filter), options));
      },
    );

  changeSet
    .command("show <id>")
    .description("Show a change set")
    .option("--json", "Print change set as JSON")
    .action(async (id: string, options: JsonOption) => {
      const { changeSets: service } = await loadRuntime();
      const found = await service.get(id);

      if (found === null) {
        throw new ChangeSetNotFoundError(`Change set not found: ${id}`);
      }

      console.log(formatChangeSet(found, options));
    });

  changeSet
    .command("status <id> <status>")
    .description("Move a change set to a new status")
    .option("--json", "Print updated change set as JSON")
    .action(async (id: string, status: string, options: JsonOption) => {
      const { changeSets: service } = await loadRuntime();
      const updated = await service.setStatus(
        id,
        parseChoice(status, STATUSES, "status"),
      );

      console.log(formatChangeSetUpdate(updated, options));
    });

  changeSet
    .command("event <id>")
    .description("Append an event to a change set")
    .requiredOption("--message <message>", "Event message")
    .option("--type <type>", "Event type", "note")
    .option("--json", "Print updated change set as JSON")
    .action(
      async (
        id: string,
        options: { message: string; type: string; json?: boolean },
      ) => {
        const { changeSets: service } = await loadRuntime();
        const updated = await service.appendEvent(id, {
          type: parseChoice(options.type, EVENT_TYPES, "event type"),
          message: options.message,
        });

        console.log(formatChangeSetUpdate(updated, options));
      },
    );

  const plan = changeSet.command("plan").description("Manage the plan");
  plan
    .command("add <id>")
    .description("Add a plan item")
    .requiredOption("--item <item>", "Plan item")
    .option("--json", "Print updated change set as JSON")
    .action(async (id: string, options: { item: string; json?: boolean }) => {
      const { changeSets: service } = await loadRuntime();

      console.log(
        formatChangeSetUpdate(
          await service.addPlanItem(id, options.item),
          options,
        ),
      );
    });

  const file = changeSet.command("file").description("Track changed files");
  file
    .command("add <id>")
    .description("Record a changed file")
    .requiredOption("--path <path>", "File path")
    .option("--json", "Print updated change set as JSON")
    .action(async (id: string, options: { path: string; json?: boolean }) => {
      const { changeSets: service } = await loadRuntime();

      console.log(
        formatChangeSetUpdate(
          await service.addFileChanged(id, options.path),
          options,
        ),
      );
    });

  const validation = changeSet
    .command("validation")
    .description("Record validation runs");
  validation
    .command("add <id>")
    .description("Record a validation result")
    .requiredOption("--kind <kind>", "Validation kind")
    .requiredOption("--status <status>", "Validation status")
    .requiredOption("--summary <summary>", "Validation summary")
    .option("--command <command>", "Command that was run")
    .option("--json", "Print updated change set as JSON")
    .action(
      async (
        id: string,
        options: {
          kind: string;
          status: string;
          summary: string;
          command?: string;
          json?: boolean;
        },
      ) => {
        const { changeSets: service } = await loadRuntime();
        const updated = await service.addValidation(id, {
          kind: parseChoice(options.kind, VALIDATION_KINDS, "validation kind"),
          status: parseChoice(
            options.status,
            VALIDATION_STATUSES,
            "validation status",
          ),
          summary: options.summary,
          command: options.command,
        });

        console.log(formatChangeSetUpdate(updated, options));
      },
    );

  changeSet
    .command("close <id>")
    .description("Close a change set with a review summary")
    .requiredOption("--summary <summary>", "Review summary")
    .option("--json", "Print closed change set as JSON")
    .action(async (id: string, options: { summary: string; json?: boolean }) => {
      const { changeSets: service } = await loadRuntime();

      console.log(
        formatChangeSetUpdate(await service.close(id, options.summary), options),
      );
    });
}

function parseChoice<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  throw new RuntimeError(
    `Invalid ${label}: ${value}. Expected one of: ${allowed.join(", ")}.`,
    `invalid-${label.replace(/ /g, "-")}`,
  );
}

export function formatChangeSetCreate(
  changeSet: ChangeSet,
  options: JsonOption = {},
): string {
  if (options.json) {
    return JSON.stringify(changeSet, null, 2);
  }

  return [
    `Created change set: ${changeSet.id}`,
    `Note: ${changeSet.obsidianPath}`,
  ].join("\n");
}

export function formatChangeSetUpdate(
  changeSet: ChangeSet,
  options: JsonOption = {},
): string {
  if (options.json) {
    return JSON.stringify(changeSet, null, 2);
  }

  return `Updated change set: ${changeSet.id} (status: ${changeSet.status})`;
}

export function formatChangeSetList(
  changeSets: ChangeSet[],
  options: JsonOption = {},
): string {
  if (options.json) {
    return JSON.stringify(changeSets, null, 2);
  }

  if (changeSets.length === 0) {
    return "No change sets found.";
  }

  return changeSets
    .map((changeSet) =>
      [
        changeSet.id,
        changeSet.status,
        changeSet.riskLevel,
        changeSet.projectId,
        changeSet.title,
      ].join("\t"),
    )
    .join("\n");
}

export function formatChangeSet(
  changeSet: ChangeSet,
  options: JsonOption = {},
): string {
  if (options.json) {
    return JSON.stringify(changeSet, null, 2);
  }

  const lines = [
    "Change Set",
    `  id: ${changeSet.id}`,
    `  title: ${changeSet.title}`,
    `  goal: ${changeSet.goal}`,
    `  project: ${changeSet.projectId}`,
    `  status: ${changeSet.status}`,
    `  risk: ${changeSet.riskLevel}`,
    `  source: ${changeSet.source}`,
    `  created: ${changeSet.createdAt}`,
    `  updated: ${changeSet.updatedAt}`,
  ];

  if (changeSet.closedAt !== undefined) {
    lines.push(`  closed: ${changeSet.closedAt}`);
  }

  lines.push(
    `  plan items: ${changeSet.plan.length}`,
    `  files changed: ${changeSet.filesChanged.length}`,
    `  validations: ${changeSet.testsRun.length}`,
    `  events: ${changeSet.events.length}`,
    `  note: ${changeSet.obsidianPath}`,
  );

  if (changeSet.reviewSummary !== undefined) {
    lines.push(`  review: ${changeSet.reviewSummary}`);
  }

  return lines.join("\n");
}
