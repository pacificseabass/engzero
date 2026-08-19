import { type Command } from "commander";

import type { AgentRuntimeConfig } from "../../config/configSchema.js";
import { loadConfig } from "../../config/loadConfig.js";

type ConfigShowOptions = {
  json?: boolean;
};

export function addConfigSubcommand(program: Command): void {
  const config = program
    .command("config")
    .description("Inspect engzero configuration");

  config
    .command("show")
    .description("Show the loaded and normalized config")
    .option("--json", "Print config as JSON")
    .action(async (options: ConfigShowOptions) => {
      const loadedConfig = await loadConfig();

      console.log(formatConfig(loadedConfig, options));
    });
}

export function formatConfig(
  config: AgentRuntimeConfig,
  options: ConfigShowOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(config, null, 2);
  }

  return [
    "Agent",
    `  name: ${config.agent.name}`,
    `  timezone: ${config.agent.timezone}`,
    "",
    "State",
    `  type: ${config.state.type}`,
    `  path: ${config.state.path}`,
    "",
    "Vaults",
    ...formatVaults(config),
    "",
    "Projects",
    `  defaultProjectId: ${config.projects.defaultProjectId ?? "(none)"}`,
  ].join("\n");
}

function formatVaults(config: AgentRuntimeConfig): string[] {
  if (config.vaults.length === 0) {
    return ["  (none)"];
  }

  return config.vaults.flatMap((vault) => [
    `  ${vault.id}`,
    `    label: ${vault.label}`,
    `    rootPath: ${vault.rootPath}`,
    `    capabilities: ${vault.capabilities.join(", ")}`,
  ]);
}
