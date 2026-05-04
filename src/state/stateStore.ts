import type { AgentRuntimeState } from "./stateTypes.js";

export interface StateStore {
  load(): Promise<AgentRuntimeState>;
  save(state: AgentRuntimeState): Promise<void>;
  transaction<T>(fn: (state: AgentRuntimeState) => Promise<T>): Promise<T>;
}
