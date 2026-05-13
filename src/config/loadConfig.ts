import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parse } from "yaml";

import { ConfigError, formatError } from "../util/errors.js";
import type { VaultCapability, VaultConfig } from "../vaults/vaultTypes.js";
import {
  DEFAULT_CONFIG_ENV_VAR,
  getDefaultConfigPath,
  getDefaultStatePath,
} from "./defaultConfig.js";
import type {
  AgentRuntimeConfig,
  RawAgentRuntimeConfig,
} from "./configSchema.js";

export type LoadConfigOptions = {
  path?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<AgentRuntimeConfig> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const configPath = resolvePath(
    options.path ?? env[DEFAULT_CONFIG_ENV_VAR] ?? getDefaultConfigPath(homeDir),
    homeDir,
  );

  let raw: string;

  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new ConfigError(
        `Failed to read config at ${configPath}: ${formatError(error)}`,
        "file-does-not-exist",
        { cause: error },
      );
    }
    throw new ConfigError(
      `Failed to read config at ${configPath}: ${formatError(error)}`,
      "config-read-failed",
      { cause: error },
    );
  }

  let parsed: unknown;

  try {
    parsed = parse(raw);
  } catch (error) {
    throw new ConfigError(
      `Failed to parse config at ${configPath}: ${formatError(error)}`,
      "config-parse-failed",
      { cause: error },
    );
  }

  return normalizeConfig(parsed, {
    configPath,
    homeDir,
  });
}

export function normalizeConfig(
  value: unknown,
  context: { configPath: string; homeDir?: string },
): AgentRuntimeConfig {
  const homeDir = context.homeDir ?? homedir();

  if (!isRecord(value)) {
    throw new ConfigError(`Config at ${context.configPath} must be an object.`);
  }

  const raw = value as RawAgentRuntimeConfig;

  return {
    agent: normalizeAgent(raw),
    state: normalizeState(raw, homeDir),
    vaults: normalizeVaults(raw.vaults, homeDir),
    projects: normalizeProjects(raw),
  };
}

function normalizeAgent(raw: RawAgentRuntimeConfig): AgentRuntimeConfig["agent"] {
  return {
    name: readOptionalString(raw.agent?.name, "agent.name") ?? "3ng0",
    timezone:
      readOptionalString(raw.agent?.timezone, "agent.timezone") ??
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function normalizeState(
  raw: RawAgentRuntimeConfig,
  homeDir: string,
): AgentRuntimeConfig["state"] {
  const stateType = readOptionalString(raw.state?.type, "state.type") ?? "json";

  if (stateType !== "json") {
    throw new ConfigError(`Unsupported state.type "${stateType}".`);
  }

  return {
    type: "json",
    path: resolvePath(
      readOptionalString(raw.state?.path, "state.path") ??
      getDefaultStatePath(homeDir),
      homeDir,
    ),
  };
}

function normalizeVaults(value: unknown, homeDir: string): VaultConfig[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ConfigError("vaults must be an array.");
  }

  const seenIds = new Set<string>();

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new ConfigError(`vaults[${index}] must be an object.`);
    }

    const id = readRequiredString(entry.id, `vaults[${index}].id`);

    if (seenIds.has(id)) {
      throw new ConfigError(`Duplicate vault id "${id}".`);
    }

    seenIds.add(id);

    return {
      id,
      label: readRequiredString(entry.label, `vaults[${index}].label`),
      rootPath: resolvePath(
        readRequiredString(entry.root_path, `vaults[${index}].root_path`),
        homeDir,
      ),
      capabilities: normalizeCapabilities(
        entry.capabilities,
        `vaults[${index}].capabilities`,
      ),
    };
  });
}

function normalizeProjects(
  raw: RawAgentRuntimeConfig,
): AgentRuntimeConfig["projects"] {
  const defaultProjectId =
    readOptionalString(
      raw.projects?.default_project_id,
      "projects.default_project_id",
    ) ??
    readOptionalString(
      raw.projects?.defaultProjectId,
      "projects.defaultProjectId",
    );

  return {
    ...(defaultProjectId ? { defaultProjectId } : {}),
  };
}

function normalizeCapabilities(
  value: unknown,
  field: string,
): VaultCapability[] {
  if (!Array.isArray(value)) {
    throw new ConfigError(`${field} must be an array.`);
  }

  const capabilities = value.map((item, index) => {
    const capability = readRequiredString(item, `${field}[${index}]`);

    if (!isVaultCapability(capability)) {
      throw new ConfigError(`Unsupported vault capability "${capability}".`);
    }

    return capability;
  });

  return Array.from(new Set(capabilities));
}

function isVaultCapability(value: string): value is VaultCapability {
  return (
    value === "read" ||
    value === "write" ||
    value === "append" ||
    value === "delete"
  );
}

function readRequiredString(value: unknown, field: string): string {
  const result = readOptionalString(value, field);

  if (result === undefined) {
    throw new ConfigError(`${field} is required.`);
  }

  return result;
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ConfigError(`${field} must be a string.`);
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function resolvePath(path: string, homeDir: string): string {
  const expanded =
    path === "~" || path.startsWith("~/") ? join(homeDir, path.slice(2)) : path;

  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
