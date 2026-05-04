import type { MemoryUpdateRef } from "../memory/memoryTypes.js";

export type ChangeSetStatus =
  | "created"
  | "planning"
  | "executing"
  | "validating"
  | "ready_for_review"
  | "deployed"
  | "failed"
  | "closed";

export type RiskLevel = "low" | "medium" | "high";

export type ChangeSet = {
  id: string;
  projectId: string;
  title: string;
  goal: string;
  source: "chat" | "cli" | "obsidian" | "watcher" | "manual";
  status: ChangeSetStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  obsidianPath: string;
  plan: string[];
  filesChanged: string[];
  testsRun: ValidationRecord[];
  events: ChangeSetEvent[];
  reviewSummary?: string;
  deploymentImpact?: DeploymentImpact;
  rollbackNotes?: string;
  memoryUpdates: MemoryUpdateRef[];
  modelTrace?: ModelTraceSummary;
};

export type ChangeSetEvent = {
  id: string;
  timestamp: string;
  type:
    | "created"
    | "status_changed"
    | "note"
    | "plan_updated"
    | "file_changed"
    | "validation_recorded"
    | "failure_recorded"
    | "memory_written"
    | "closed";
  message: string;
  data?: Record<string, unknown>;
};

export type ValidationRecord = {
  id: string;
  timestamp: string;
  kind: "test" | "build" | "lint" | "manual" | "other";
  command?: string;
  status: "passed" | "failed" | "skipped" | "unknown";
  summary: string;
  logPath?: string;
};

export type DeploymentImpact = {
  hasDeploymentImpact: boolean;
  environments?: string[];
  summary?: string;
};

export type ModelTraceSummary = {
  mode?: "none" | "single" | "planner_executor" | "parallel_debate";
  models?: Array<{
    provider: string;
    model: string;
    role: string;
    reasonSelected?: string;
  }>;
  summary?: string;
};
