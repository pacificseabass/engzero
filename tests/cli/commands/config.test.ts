import { describe, expect, it } from "vitest";

import { formatConfig } from "../../../src/cli/commands/config.js";
import type { AgentRuntimeConfig } from "../../../src/config/configSchema.js";

describe("formatConfig", () => {
  const config: AgentRuntimeConfig = {
    agent: {
      name: "3ng0",
      timezone: "America/Los_Angeles",
    },
    state: {
      type: "json",
      path: "/home/test/.local/share/3ng0/state.json",
    },
    vaults: [
      {
        id: "agent",
        label: "3ng0 Agent Vault",
        rootPath: "/home/test/Obsidian/agent-vault",
        capabilities: ["read", "write", "append"],
      },
    ],
    projects: {
      defaultProjectId: "agent-runtime",
    },
  };

  it("formats config for human-readable output", () => {
    expect(formatConfig(config)).toBe(
      [
        "Agent",
        "  name: 3ng0",
        "  timezone: America/Los_Angeles",
        "",
        "State",
        "  type: json",
        "  path: /home/test/.local/share/3ng0/state.json",
        "",
        "Vaults",
        "  agent",
        "    label: 3ng0 Agent Vault",
        "    rootPath: /home/test/Obsidian/agent-vault",
        "    capabilities: read, write, append",
        "",
        "Projects",
        "  defaultProjectId: agent-runtime",
      ].join("\n"),
    );
  });

  it("formats config as JSON", () => {
    expect(formatConfig(config, { json: true })).toBe(
      JSON.stringify(config, null, 2),
    );
  });

  it("handles empty optional sections", () => {
    expect(
      formatConfig({
        ...config,
        vaults: [],
        projects: {},
      }),
    ).toContain(["Vaults", "  (none)"].join("\n"));
  });
});
