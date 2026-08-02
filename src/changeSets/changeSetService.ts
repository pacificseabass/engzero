import { MarkdownWriter } from "../markdown/markdownWriter.js";
import type { StateStore } from "../state/stateStore.js";
import {
  ChangeSetNotFoundError,
  ProjectNotFoundError,
} from "../util/errors.js";
import {
  createChangeSetId,
  createEventId,
  createValidationId,
} from "../util/ids.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";
import { assertCloseable, assertTransition } from "./changeSetLifecycle.js";
import {
  getChangeSetNotePath,
  renderChangeSetNote,
} from "./changeSetRenderer.js";
import type {
  ChangeSet,
  ChangeSetEvent,
  ChangeSetStatus,
  RiskLevel,
  ValidationRecord,
} from "./changeSetTypes.js";
import { classifyRisk } from "./riskClassifier.js";

export type CreateChangeSetInput = {
  projectId: string;
  goal: string;
  title?: string;
  source: ChangeSet["source"];
  riskLevel?: RiskLevel;
};

export type ChangeSetFilter = {
  projectId?: string;
  status?: ChangeSetStatus;
};

type NewEvent = Omit<ChangeSetEvent, "id" | "timestamp">;

export class ChangeSetService {
  private readonly writer: MarkdownWriter;

  constructor(
    private readonly stateStore: StateStore,
    vaultRegistry: VaultRegistry,
  ) {
    this.writer = new MarkdownWriter(vaultRegistry);
  }

  async create(input: CreateChangeSetInput): Promise<ChangeSet> {
    const now = new Date();
    const timestamp = now.toISOString();
    const changeSet: ChangeSet = {
      id: createChangeSetId(now),
      projectId: input.projectId,
      title: input.title ?? input.goal,
      goal: input.goal,
      source: input.source,
      status: "created",
      riskLevel: input.riskLevel ?? classifyRisk(input.goal),
      createdAt: timestamp,
      updatedAt: timestamp,
      obsidianPath: "",
      plan: [],
      filesChanged: [],
      testsRun: [],
      events: [
        {
          id: createEventId(),
          timestamp,
          type: "created",
          message: `Change set created: ${input.goal}`,
        },
      ],
      memoryUpdates: [],
    };
    changeSet.obsidianPath = getChangeSetNotePath(changeSet);

    const vaultId = await this.stateStore.transaction(async (state) => {
      const project = state.projects[input.projectId];
      if (project === undefined) {
        throw new ProjectNotFoundError(
          `Unable to find project for id ${input.projectId}`,
        );
      }
      state.changeSets[changeSet.id] = changeSet;

      return project.vaultNamespace;
    });

    await this.writeNote(changeSet, vaultId);

    return changeSet;
  }

  async get(id: string): Promise<ChangeSet | null> {
    const state = await this.stateStore.load();

    return state.changeSets[id] ?? null;
  }

  async list(filter: ChangeSetFilter = {}): Promise<ChangeSet[]> {
    const state = await this.stateStore.load();

    return Object.values(state.changeSets)
      .filter(
        (changeSet) =>
          (filter.projectId === undefined ||
            changeSet.projectId === filter.projectId) &&
          (filter.status === undefined || changeSet.status === filter.status),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async appendEvent(id: string, event: NewEvent): Promise<ChangeSet> {
    return this.update(id, event);
  }

  async setStatus(id: string, status: ChangeSetStatus): Promise<ChangeSet> {
    return this.update(
      id,
      {
        type: "status_changed",
        message: `Status changed to ${status}`,
        data: { status },
      },
      (changeSet) => {
        assertTransition(changeSet.status, status);
        changeSet.status = status;
      },
    );
  }

  async addPlanItem(id: string, item: string): Promise<ChangeSet> {
    return this.update(
      id,
      { type: "plan_updated", message: `Plan item added: ${item}` },
      (changeSet) => {
        changeSet.plan.push(item);
      },
    );
  }

  async addFileChanged(id: string, path: string): Promise<ChangeSet> {
    return this.update(
      id,
      { type: "file_changed", message: `File changed: ${path}` },
      (changeSet) => {
        if (!changeSet.filesChanged.includes(path)) {
          changeSet.filesChanged.push(path);
        }
      },
    );
  }

  async addValidation(
    id: string,
    validation: Omit<ValidationRecord, "id" | "timestamp">,
  ): Promise<ChangeSet> {
    return this.update(
      id,
      {
        type: "validation_recorded",
        message: `Validation ${validation.status}: ${validation.summary}`,
      },
      (changeSet, timestamp) => {
        changeSet.testsRun.push({
          ...validation,
          id: createValidationId(),
          timestamp,
        });
      },
    );
  }

  async close(id: string, summary: string): Promise<ChangeSet> {
    return this.update(
      id,
      { type: "closed", message: summary },
      (changeSet, timestamp) => {
        assertCloseable(changeSet.status);
        changeSet.status = "closed";
        changeSet.closedAt = timestamp;
        changeSet.reviewSummary = summary;
      },
    );
  }

  private async update(
    id: string,
    event: NewEvent,
    mutate?: (changeSet: ChangeSet, timestamp: string) => void,
  ): Promise<ChangeSet> {
    const timestamp = new Date().toISOString();

    const { changeSet, vaultId } = await this.stateStore.transaction(
      async (state) => {
        const changeSet = state.changeSets[id];
        if (changeSet === undefined) {
          throw new ChangeSetNotFoundError(
            `Unable to find change set for id ${id}`,
          );
        }
        const project = state.projects[changeSet.projectId];
        if (project === undefined) {
          throw new ProjectNotFoundError(
            `Unable to find project for id ${changeSet.projectId}`,
          );
        }

        mutate?.(changeSet, timestamp);
        changeSet.events.push({ ...event, id: createEventId(), timestamp });
        changeSet.updatedAt = timestamp;

        return { changeSet, vaultId: project.vaultNamespace };
      },
    );

    await this.writeNote(changeSet, vaultId);

    return changeSet;
  }

  private async writeNote(changeSet: ChangeSet, vaultId: string): Promise<void> {
    const note = renderChangeSetNote(changeSet);

    await this.writer.writeNote({
      vaultId,
      relativePath: changeSet.obsidianPath,
      contents: note.contents,
    });
  }
}
