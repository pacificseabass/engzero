import { access, constants, rm, stat, writeFile } from "node:fs/promises";
import type { VaultConfig } from "./vaultTypes.js";
import { join } from "node:path";
import type { Stats } from "node:fs";

export type VaultCheckStatus = 'ok' | 'error'

export type VaultCheck = {
  name: string;
  status: VaultCheckStatus;
  message: string;
}

export type VaultCheckResult = {
  vaultId: string;
  label: string;
  rootPath: string;
  status: VaultCheckStatus;
  checks: VaultCheck[];
}

function buildVaultCheckResult(vault: VaultConfig, checks: VaultCheck[]): VaultCheckResult {
  return {
    vaultId: vault.id,
    label: vault.label,
    rootPath: vault.rootPath,
    status: checks.every(({ status }) => status === 'ok') ? 'ok' : 'error',
    checks
  }
}

/**
 * Verify that each configured vault root exists
 * Verify root is directory
 * Check readable vaults can be read
 * Checks write/append vault can actually write a temporary probe file
 * report human-readable results for CLI output
 */
export async function checkVault(vault: VaultConfig): Promise<VaultCheckResult> {
  const checks: VaultCheck[] = [];
  let fileStat: Stats;
  try {
    fileStat = await stat(vault.rootPath);
    checks.push({
      name: 'root_exists',
      status: 'ok',
      message: `Vault ${vault.id} root exists: ${vault.rootPath}`,
    })
  } catch (error) {
    checks.push({
      name: 'root_exists',
      status: 'error',
      message: `Vault ${vault.id} root does not exist: ${vault.rootPath}: ${formatError(error)}`
    })
    return buildVaultCheckResult(vault, checks)
  }
  if (!fileStat.isDirectory()) {
    checks.push({
      name: 'root_is_directory',
      status: 'error',
      message: `Vault ${vault.id} root is not a directory: ${vault.rootPath}`
    })
    return buildVaultCheckResult(vault, checks);
  } else {
    checks.push({
      name: 'root_is_directory',
      status: 'ok',
      message: `Vault ${vault.id} root is a directory: ${vault.rootPath}`
    })
  }

  if (vault.capabilities.includes('read')) {
    try {
      await access(vault.rootPath, constants.R_OK)
      checks.push({
        name: 'read_access',
        status: 'ok',
        message: `Vault ${vault.id} root is readable: ${vault.rootPath}`
      })
    } catch (err) {
      checks.push({
        name: 'read_access',
        status: 'error',
        message: `Vault ${vault.id} root is not readable: ${vault.rootPath}`
      })
    }
  }
  if (vault.capabilities.includes('write') || vault.capabilities.includes('append')) {
    const probePath = join(vault.rootPath, `engzero-${process.pid}-${Date.now()}.tmp`)
    let probeCreated = false;

    try {
      await writeFile(probePath, 'engzero vault check\n', { flag: 'wx' });
      probeCreated = true;
      checks.push({
        name: 'write_probe',
        status: 'ok',
        message: 'Write probe succeeded',
      })
    } catch (err) {
      checks.push({
        name: 'write_probe',
        status: 'error',
        message: `Write probe failed: ${formatError(err)}`
      })
    } finally {
      if (probeCreated) {
        try {
          await rm(probePath, { force: true })
        } catch {
          checks.push({
            name: 'write_probe_cleanup',
            status: 'error',
            message: `Write probe cleanup failed: ${probePath}`
          })
        }
      }
    }
  }

  return buildVaultCheckResult(vault, checks);
}


export async function checkVaults(vaults: VaultConfig[]): Promise<VaultCheckResult[]> {
  return Promise.all(vaults.map(checkVault))
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
