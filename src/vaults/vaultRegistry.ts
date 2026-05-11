import { InvalidStateError } from "../util/errors.js";
import { type ResolvedVaultPath, resolveVaultPath } from "./vaultPathResolver.js";
import { assertVaultCapability } from "./vaultPermissions.js";
import type { VaultCapability, VaultConfig } from "./vaultTypes.js";

export class VaultRegistry {
  constructor(private readonly vaults: VaultConfig[]) {}

  list(): VaultConfig[] {
    return [...this.vaults];
  }

  get(id: string): VaultConfig | null {
    let config: VaultConfig | null = null;
    this.vaults.forEach((vault) => {
      if (vault.id === id) {
        if (config !== null) {
          throw new InvalidStateError(`Found multiple vaults with id: ${id}`);
        }
        config = vault;
      }
    });
    return config;
  }

  assertCapability(vaultId: string, capability: VaultCapability): void {
    const config = this.assertVaultExists(vaultId);
    assertVaultCapability(config, capability);
  }

  resolvePath(
    vaultId: string,
    relativePath: string,
    capability?: VaultCapability,
  ): ResolvedVaultPath {
    const config = this.assertVaultExists(vaultId);

    if (capability) {
      assertVaultCapability(config, capability);
    }

    return resolveVaultPath(config, relativePath);
  }

  private assertVaultExists(vaultId: string): VaultConfig {
    const config = this.get(vaultId);

    if (config === null) {
      throw new InvalidStateError(`Vault not found: ${vaultId}`);
    }
    return config;
  }
}
