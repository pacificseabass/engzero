import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG_ENV_VAR = "ENGZERO_CONFIG";

export function getDefaultConfigPath(homeDir = homedir()): string {
  return join(homeDir, ".config", "engzero", "config.yaml");
}

export function getDefaultStatePath(homeDir = homedir()): string {
  return join(homeDir, ".local", "share", "engzero", "state.json");
}
