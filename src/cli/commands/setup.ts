import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { type Command } from "commander";

import {
  getDefaultConfigPath,
  getDefaultStatePath,
} from "../../config/defaultConfig.js";
import { ConfigError, isNodeError } from "../../util/errors.js";

export type SetupConfigOptions = {
  configPath?: string;
  vaultPath?: string;
  statePath?: string;
  defaultProjectId?: string;
  timezone?: string;
  force?: boolean;
  homeDir?: string;
};

export type SetupConfigResult = {
  configPath: string;
  created: boolean;
};

type SetupPromptQuestion = {
  key: keyof Pick<
    SetupConfigOptions,
    "configPath" | "vaultPath" | "statePath" | "defaultProjectId" | "timezone"
  >;
  label: string;
  defaultValue: string;
};

type SetupPrompt = (question: string) => Promise<string>;

export function addSetupSubcommand(program: Command): void {
  program
    .command("setup")
    .description("Create an initial engzero config file")
    .option("--config <path>", "Config path to create")
    .option("--vault-path <path>", "Agent vault root path")
    .option("--state-path <path>", "JSON state store path")
    .option("--default-project <id>", "Default project id")
    .option("--timezone <timezone>", "Agent timezone")
    .option("--force", "Overwrite an existing config file")
    .action(async (options: SetupConfigOptions) => {
      const setupOptions = await promptForMissingSetupOptions(options);
      const result = await createSetupConfig(setupOptions);

      console.log(`Created config: ${result.configPath}`);
    });
}

export async function promptForMissingSetupOptions(
  options: SetupConfigOptions,
  prompt?: SetupPrompt,
): Promise<SetupConfigOptions> {
  const homeDir = options.homeDir ?? homedir();
  const questions: SetupPromptQuestion[] = [
    {
      key: "configPath",
      label: "Config path",
      defaultValue: getDefaultConfigPath(homeDir),
    },
    {
      key: "vaultPath",
      label: "Agent vault path",
      defaultValue: "~/Obsidian/agent-vault",
    },
    {
      key: "statePath",
      label: "State path",
      defaultValue: toHomeRelative(getDefaultStatePath(homeDir), homeDir),
    },
    {
      key: "defaultProjectId",
      label: "Default project id",
      defaultValue: "agent-runtime",
    },
    {
      key: "timezone",
      label: "Timezone",
      defaultValue: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  ];

  const resolved: SetupConfigOptions = { ...options, homeDir };
  const missingQuestions = questions.filter(
    ({ key }) => resolved[key] === undefined,
  );

  if (missingQuestions.length === 0) {
    return resolved;
  }

  const terminal = prompt === undefined ? createInterface({ input, output }) : undefined;
  const ask = prompt ?? ((question: string) => terminal!.question(question));

  try {
    for (const question of missingQuestions) {
      const answer = await ask(`${question.label} [${question.defaultValue}]: `);
      resolved[question.key] = answer.trim() || question.defaultValue;
    }
  } finally {
    terminal?.close();
  }

  return resolved;
}

export async function createSetupConfig(
  options: SetupConfigOptions = {},
): Promise<SetupConfigResult> {
  const homeDir = options.homeDir ?? homedir();
  const configPath = resolveUserPath(
    options.configPath ?? getDefaultConfigPath(homeDir),
    homeDir,
  );
  const contents = renderSetupConfig({
    vaultPath: options.vaultPath ?? "~/Obsidian/agent-vault",
    statePath: options.statePath ?? toHomeRelative(getDefaultStatePath(homeDir), homeDir),
    defaultProjectId: options.defaultProjectId ?? "agent-runtime",
    timezone:
      options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  try {
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, contents, {
      encoding: "utf8",
      flag: options.force ? "w" : "wx",
    });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new ConfigError(
        `Config already exists at ${configPath}. Use --force to overwrite it.`,
        "config-already-exists",
        { cause: error },
      );
    }

    throw new ConfigError(
      `Failed to create config at ${configPath}`,
      "config-create-failed",
      { cause: error },
    );
  }

  return {
    configPath,
    created: true,
  };
}

type RenderSetupConfigInput = {
  vaultPath: string;
  statePath: string;
  defaultProjectId: string;
  timezone: string;
};

export function renderSetupConfig(input: RenderSetupConfigInput): string {
  return [
    "agent:",
    '  name: "engzero"',
    `  timezone: ${quoteYamlString(input.timezone)}`,
    "",
    "state:",
    '  type: "json"',
    `  path: ${quoteYamlString(input.statePath)}`,
    "",
    "vaults:",
    '  - id: "agent"',
    '    label: "engzero Agent Vault"',
    `    root_path: ${quoteYamlString(input.vaultPath)}`,
    "    capabilities:",
    "      - read",
    "      - write",
    "      - append",
    "",
    "projects:",
    `  default_project_id: ${quoteYamlString(input.defaultProjectId)}`,
    "",
  ].join("\n");
}

function resolveUserPath(path: string, homeDir: string): string {
  const expanded =
    path === "~" || path.startsWith("~/") ? join(homeDir, path.slice(2)) : path;

  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

function toHomeRelative(path: string, homeDir: string): string {
  const absoluteHome = resolve(homeDir);
  const absolutePath = resolve(path);

  return absolutePath === absoluteHome || absolutePath.startsWith(`${absoluteHome}/`)
    ? `~/${absolutePath.slice(absoluteHome.length + 1)}`
    : absolutePath;
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}



