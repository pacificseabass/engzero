import type { VaultConfig } from "../vaults/vaultTypes.js";

export type StateConfig = {
  type: "json";
  path: string;
};

export type AgentConfig = {
  name: string;
  timezone: string;
};

export type ProjectsConfig = {
  defaultProjectId?: string;
};

export type AgentRuntimeConfig = {
  agent: AgentConfig;
  state: StateConfig;
  vaults: VaultConfig[];
  projects: ProjectsConfig;
};

export type RawAgentRuntimeConfig = {
  agent?: {
    name?: unknown;
    timezone?: unknown;
  };
  state?: {
    type?: unknown;
    path?: unknown;
  };
  vaults?: unknown;
  projects?: {
    default_project_id?: unknown;
    defaultProjectId?: unknown;
  };
};
