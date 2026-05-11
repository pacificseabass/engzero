import { VaultPermissionError } from "../util/errors.js";
import type { VaultCapability, VaultConfig } from "./vaultTypes.js";

export function assertVaultCapability(
  vault: VaultConfig,
  capability: VaultCapability,
): void {
  if (!vault.capabilities.includes(capability)) {
    throw new VaultPermissionError(
      `Vault ${vault.id} does not allow ${capability} access`,
    );
  }
}
