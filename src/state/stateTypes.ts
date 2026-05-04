import type { ChangeSet } from "../changeSets/changeSetTypes.js";
import type { MemoryUpdateRef } from "../memory/memoryTypes.js";
import type { ProjectManifest } from "../projects/projectTypes.js";

export interface AgentRuntimeState {
  version: 1;
  projects: Record<string, ProjectManifest>;
  changeSets: Record<string, ChangeSet>;
  memoryUpdates: Record<string, MemoryUpdateRef>;
}

export function createEmptyState(): AgentRuntimeState {
  return {
    version: 1,
    projects: {},
    changeSets: {},
    memoryUpdates: {},
  };
}
