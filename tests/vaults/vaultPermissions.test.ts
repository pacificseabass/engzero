import { describe, expect, it } from "vitest";

import { VaultPermissionError } from "../../src/util/errors.js";
import { assertVaultCapability } from "../../src/vaults/vaultPermissions.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";

describe("assertVaultCapability", () => {
  const vault: VaultConfig = {
    id: "agent",
    label: "Agent Vault",
    rootPath: "/tmp/agent-vault",
    capabilities: ["read", "append"],
  };

  it("allows a configured capability", () => {
    expect(() => assertVaultCapability(vault, "append")).not.toThrow();
  });

  it("throws when the capability is missing", () => {
    expect(() => assertVaultCapability(vault, "write")).toThrow(
      VaultPermissionError,
    );
  });
});
