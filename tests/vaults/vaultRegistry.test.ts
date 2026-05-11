import { describe, expect, it } from "vitest";

import { InvalidStateError, VaultPermissionError } from "../../src/util/errors.js";
import { VaultRegistry } from "../../src/vaults/vaultRegistry.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";

describe("VaultRegistry", () => {
  const agentVault: VaultConfig = {
    id: "agent",
    label: "Agent Vault",
    rootPath: "/tmp/agent-vault",
    capabilities: ["read", "write", "append"],
  };

  const readonlyVault: VaultConfig = {
    id: "personal",
    label: "Personal Vault",
    rootPath: "/tmp/personal-vault",
    capabilities: ["read"],
  };

  it("lists configured vaults without exposing the internal array", () => {
    const registry = new VaultRegistry([agentVault]);
    const listed = registry.list();

    listed.push(readonlyVault);

    expect(registry.list()).toEqual([agentVault]);
  });

  it("returns a vault by id", () => {
    const registry = new VaultRegistry([agentVault, readonlyVault]);

    expect(registry.get("personal")).toBe(readonlyVault);
  });

  it("returns null for an unknown vault", () => {
    const registry = new VaultRegistry([agentVault]);

    expect(registry.get("missing")).toBeNull();
  });

  it("throws when duplicate vault ids are encountered", () => {
    const registry = new VaultRegistry([
      agentVault,
      {
        ...agentVault,
        label: "Duplicate Agent Vault",
      },
    ]);

    expect(() => registry.get("agent")).toThrow(InvalidStateError);
  });

  it("asserts capabilities by vault id", () => {
    const registry = new VaultRegistry([agentVault]);

    expect(() => registry.assertCapability("agent", "write")).not.toThrow();
  });

  it("throws when a vault is missing a required capability", () => {
    const registry = new VaultRegistry([readonlyVault]);

    expect(() => registry.assertCapability("personal", "write")).toThrow(
      VaultPermissionError,
    );
  });

  it("resolves a path after checking the requested capability", () => {
    const registry = new VaultRegistry([agentVault]);

    expect(registry.resolvePath("agent", "note.md", "write")).toMatchObject({
      vault: agentVault,
      vaultId: "agent",
      relativePath: "note.md",
    });
  });

  it("throws when resolving a path for an unknown vault", () => {
    const registry = new VaultRegistry([agentVault]);

    expect(() => registry.resolvePath("missing", "note.md")).toThrow(
      InvalidStateError,
    );
  });

  it("throws before resolving when the requested capability is denied", () => {
    const registry = new VaultRegistry([readonlyVault]);

    expect(() => registry.resolvePath("personal", "note.md", "write")).toThrow(
      VaultPermissionError,
    );
  });
});
