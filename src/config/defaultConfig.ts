import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG_ENV_VAR = "THREENGO_CONFIG";

export function getDefaultConfigPath(homeDir = homedir()): string {
  return join(homeDir, ".config", "3ng0", "config.yaml");
}

export function getDefaultStatePath(homeDir = homedir()): string {
  return join(homeDir, ".local", "share", "3ng0", "state.json");
}
