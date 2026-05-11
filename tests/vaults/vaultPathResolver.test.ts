import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { InvalidPath } from "../../src/util/errors.js";
import { resolveVaultPath } from "../../src/vaults/vaultPathResolver.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";

describe("resolveVaultPath", () => {
  const vault: VaultConfig = {
    id: "agent",
    label: "Agent Vault",
    rootPath: "/tmp/3ng0-agent-vault",
    capabilities: ["read", "write", "append"],
  };

  it("resolves a relative path inside a vault", () => {
    const resolved = resolveVaultPath(vault, "Notes/example.md");

    expect(resolved).toEqual({
      vault,
      vaultId: "agent",
      relativePath: "Notes/example.md",
      absolutePath: resolve("/tmp/3ng0-agent-vault", "Notes/example.md"),
    });
  });

  it("normalizes relative paths before returning them", () => {
    const resolved = resolveVaultPath(vault, "folder/../note.md");

    expect(resolved.relativePath).toBe("note.md");
    expect(resolved.absolutePath).toBe(
      resolve("/tmp/3ng0-agent-vault", "note.md"),
    );
  });

  it("rejects absolute paths", () => {
    expect(() => resolveVaultPath(vault, "/tmp/outside.md")).toThrow(
      InvalidPath,
    );
  });

  it("rejects parent-directory escapes", () => {
    expect(() => resolveVaultPath(vault, "../outside.md")).toThrow(
      InvalidPath,
    );
  });

  it("rejects nested parent-directory escapes", () => {
    expect(() =>
      resolveVaultPath(vault, "folder/../../../outside.md"),
    ).toThrow(InvalidPath);
  });
});
