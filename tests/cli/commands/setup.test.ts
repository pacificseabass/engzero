import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSetupConfig,
  promptForMissingSetupOptions,
  renderSetupConfig,
} from "../../../src/cli/commands/setup.js";
import { ConfigError } from "../../../src/util/errors.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("renderSetupConfig", () => {
  it("renders the starter YAML config", () => {
    expect(
      renderSetupConfig({
        vaultPath: "~/vault",
        statePath: "~/.local/share/engzero/state.json",
        defaultProjectId: "agent-runtime",
        timezone: "America/Los_Angeles",
      }),
    ).toBe(
      [
        "agent:",
        '  name: "engzero"',
        '  timezone: "America/Los_Angeles"',
        "",
        "state:",
        '  type: "json"',
        '  path: "~/.local/share/engzero/state.json"',
        "",
        "vaults:",
        '  - id: "agent"',
        '    label: "engzero Agent Vault"',
        '    root_path: "~/vault"',
        "    capabilities:",
        "      - read",
        "      - write",
        "      - append",
        "",
        "projects:",
        '  default_project_id: "agent-runtime"',
        "",
      ].join("\n"),
    );
  });
});

describe("createSetupConfig", () => {
  it("creates the default config file under the provided home directory", async () => {
    const homeDir = await createTempDir();

    const result = await createSetupConfig({
      homeDir,
      timezone: "America/Los_Angeles",
    });

    expect(result).toEqual({
      configPath: join(homeDir, ".config", "engzero", "config.yaml"),
      created: true,
    });

    await expect(readFile(result.configPath, "utf8")).resolves.toContain(
      '  timezone: "America/Los_Angeles"',
    );
  });

  it("creates a config at an explicit path", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "custom", "config.yaml");

    const result = await createSetupConfig({
      configPath,
      homeDir,
      vaultPath: "~/obsidian/engzero",
      statePath: "~/state.json",
      defaultProjectId: "demo",
      timezone: "UTC",
    });

    const config = await readFile(result.configPath, "utf8");

    expect(result.configPath).toBe(configPath);
    expect(config).toContain('    root_path: "~/obsidian/engzero"');
    expect(config).toContain('  path: "~/state.json"');
    expect(config).toContain('  default_project_id: "demo"');
  });

  it("refuses to overwrite an existing config by default", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "config.yaml");

    await createSetupConfig({ configPath, homeDir, timezone: "UTC" });

    const error = await createSetupConfig({
      configPath,
      homeDir,
      timezone: "UTC",
    }).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ConfigError);
    expect(error).toMatchObject({
      code: "config-already-exists",
    });
    expect((error as ConfigError).cause).toBeInstanceOf(Error);
  });

  it("overwrites an existing config when force is enabled", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "config.yaml");

    await createSetupConfig({
      configPath,
      homeDir,
      defaultProjectId: "first",
      timezone: "UTC",
    });
    await createSetupConfig({
      configPath,
      homeDir,
      defaultProjectId: "second",
      timezone: "UTC",
      force: true,
    });

    await expect(readFile(configPath, "utf8")).resolves.toContain(
      '  default_project_id: "second"',
    );
  });
});

describe("promptForMissingSetupOptions", () => {
  it("prompts for missing values and preserves provided flags", async () => {
    const homeDir = await createTempDir();
    const questions: string[] = [];
    const answers = ["~/vault", "~/state.json", "demo", "UTC"];

    const options = await promptForMissingSetupOptions(
      {
        configPath: join(homeDir, "config.yaml"),
        homeDir,
      },
      async (question) => {
        questions.push(question);
        return answers.shift() ?? "";
      },
    );

    expect(questions.map((question) => question.split(" [")[0])).toEqual([
      "Agent vault path",
      "State path",
      "Default project id",
      "Timezone",
    ]);
    expect(options).toMatchObject({
      configPath: join(homeDir, "config.yaml"),
      vaultPath: "~/vault",
      statePath: "~/state.json",
      defaultProjectId: "demo",
      timezone: "UTC",
      homeDir,
    });
  });

  it("uses default values for blank prompt answers", async () => {
    const homeDir = await createTempDir();
    const options = await promptForMissingSetupOptions(
      {
        homeDir,
      },
      async () => "",
    );

    expect(options).toMatchObject({
      configPath: join(homeDir, ".config", "engzero", "config.yaml"),
      vaultPath: "~/Obsidian/agent-vault",
      statePath: "~/.local/share/engzero/state.json",
      defaultProjectId: "agent-runtime",
      homeDir,
    });
    expect(options.timezone).toEqual(expect.any(String));
  });

  it("does not prompt when all values are provided", async () => {
    const homeDir = await createTempDir();
    let promptCount = 0;

    const options = await promptForMissingSetupOptions(
      {
        configPath: join(homeDir, "config.yaml"),
        vaultPath: "~/vault",
        statePath: "~/state.json",
        defaultProjectId: "demo",
        timezone: "UTC",
        homeDir,
      },
      async () => {
        promptCount += 1;
        return "";
      },
    );

    expect(promptCount).toBe(0);
    expect(options.timezone).toBe("UTC");
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "engzero-setup-"));
  tempDirs.push(dir);

  return dir;
}
