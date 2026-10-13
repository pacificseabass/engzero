import { ChangeSetService } from "../changeSets/changeSetService.js";
import type { AgentRuntimeConfig } from "../config/configSchema.js";
import { loadConfig, type LoadConfigOptions } from "../config/loadConfig.js";
import { ProjectOperations } from "../projects/projectOperations.js";
import { JsonStateStore } from "../state/jsonStateStore.js";
import { VaultRegistry } from "../vaults/vaultRegistry.js";

export type Runtime = {
  config: AgentRuntimeConfig;
  vaults: VaultRegistry;
  projects: ProjectOperations;
  changeSets: ChangeSetService;
};

/** Assemble services from normalized configuration without filesystem writes. */
export function createRuntime(config: AgentRuntimeConfig): Runtime {
  const stateStore = new JsonStateStore(config.state.path);
  const vaults = new VaultRegistry(config.vaults);

  return {
    config,
    vaults,
    projects: new ProjectOperations(stateStore, vaults),
    changeSets: new ChangeSetService(stateStore, vaults),
  };
}

export async function loadRuntime(
  options: LoadConfigOptions = {},
): Promise<Runtime> {
  return createRuntime(await loadConfig(options));
}
