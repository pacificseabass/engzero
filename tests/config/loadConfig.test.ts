import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG_ENV_VAR } from "../../src/config/defaultConfig.js";
import { loadConfig } from "../../src/config/loadConfig.js";
import { ConfigError } from "../../src/util/errors.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("loadConfig", () => {
  it("loads YAML config and normalizes paths and field names", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "config.yaml");

    await writeFile(
      configPath,
      [
        "agent:",
        '  name: "3ng0"',
        '  timezone: "America/Los_Angeles"',
        "state:",
        '  type: "json"',
        '  path: "~/.local/share/3ng0/state.json"',
        "vaults:",
        '  - id: "agent"',
        '    label: "3ng0 Agent Vault"',
        '    root_path: "~/Obsidian/agent-vault"',
        "    capabilities:",
        "      - read",
        "      - write",
        "      - append",
        "projects:",
        '  default_project_id: "agent-runtime"',
        "",
      ].join("\n"),
      "utf8",
    );

    await expect(loadConfig({ path: configPath, homeDir })).resolves.toEqual({
      agent: {
        name: "3ng0",
        timezone: "America/Los_Angeles",
      },
      state: {
        type: "json",
        path: join(homeDir, ".local", "share", "3ng0", "state.json"),
      },
      vaults: [
        {
          id: "agent",
          label: "3ng0 Agent Vault",
          rootPath: join(homeDir, "Obsidian", "agent-vault"),
          capabilities: ["read", "write", "append"],
        },
      ],
      projects: {
        defaultProjectId: "agent-runtime",
      },
    });
  });

  it("uses THREENGO_CONFIG when no explicit path is provided", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "custom.yaml");

    await writeFile(configPath, "vaults: []\n", "utf8");

    const config = await loadConfig({
      env: {
        [DEFAULT_CONFIG_ENV_VAR]: configPath,
      },
      homeDir,
    });

    expect(config.agent.name).toBe("3ng0");
    expect(config.state.path).toBe(
      join(homeDir, ".local", "share", "3ng0", "state.json"),
    );
  });

  it("uses the default config path when no path or env override is provided", async () => {
    const homeDir = await createTempDir();
    const defaultConfigPath = join(homeDir, ".config", "3ng0", "config.yaml");

    await mkdir(dirname(defaultConfigPath), { recursive: true });
    await writeFile(defaultConfigPath, "vaults: []\n", "utf8");

    const config = await loadConfig({
      env: {},
      homeDir,
    });

    expect(config.vaults).toEqual([]);
  });

  it("rejects duplicate vault ids", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "config.yaml");

    await writeFile(
      configPath,
      [
        "vaults:",
        "  - id: agent",
        "    label: Agent",
        "    root_path: ~/agent",
        "    capabilities: [read]",
        "  - id: agent",
        "    label: Duplicate",
        "    root_path: ~/duplicate",
        "    capabilities: [read]",
        "",
      ].join("\n"),
      "utf8",
    );

    await expect(loadConfig({ path: configPath, homeDir })).rejects.toThrow(
      'Duplicate vault id "agent".',
    );
  });

  it("rejects unsupported state stores", async () => {
    const homeDir = await createTempDir();
    const configPath = join(homeDir, "config.yaml");

    await writeFile(
      configPath,
      "state:\n  type: sqlite\nvaults: []\n",
      "utf8",
    );

    await expect(loadConfig({ path: configPath, homeDir })).rejects.toThrow(
      'Unsupported state.type "sqlite".',
    );
  });

  it("wraps unreadable config errors as ConfigError with cause", async () => {
    const homeDir = await createTempDir();

    const error = await loadConfig({
      path: join(homeDir, "missing.yaml"),
      homeDir,
    }).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ConfigError);
    expect(error).toMatchObject({
      code: "file-does-not-exist",
    });
    expect((error as ConfigError).cause).toBeInstanceOf(Error);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "3ng0-config-"));
  tempDirs.push(dir);

  return dir;
}
