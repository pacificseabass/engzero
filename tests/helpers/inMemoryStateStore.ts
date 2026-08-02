import type { StateStore } from "../../src/state/stateStore.js";
import {
  createEmptyState,
  type AgentRuntimeState,
} from "../../src/state/stateTypes.js";

export class InMemoryStateStore implements StateStore {
  private state = createEmptyState();

  async load(): Promise<AgentRuntimeState> {
    return structuredClone(this.state);
  }

  async save(state: AgentRuntimeState): Promise<void> {
    this.state = structuredClone(state);
  }

  async transaction<T>(
    fn: (state: AgentRuntimeState) => Promise<T>,
  ): Promise<T> {
    const state = await this.load();
    const result = await fn(state);
    await this.save(state);

    return result;
  }
}
