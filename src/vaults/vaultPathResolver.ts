import { isAbsolute, relative, resolve, sep } from "node:path";

import { InvalidPath } from "../util/errors.js";
import type { VaultConfig } from "./vaultTypes.js";

export type ResolvedVaultPath = {
  vault: VaultConfig;
  vaultId: string;
  relativePath: string;
  absolutePath: string;
};

export function resolveVaultPath(
  vault: VaultConfig,
  relativePath: string,
): ResolvedVaultPath {
  if (isAbsolute(relativePath)) {
    throw new InvalidPath(relativePath, undefined, {
      reason: "resolveVaultPath expects relative path",
    });
  }

  const rootPath = resolve(vault.rootPath);
  const absolutePath = resolve(rootPath, relativePath);
  const relativeFromRoot = relative(rootPath, absolutePath);

  if (
    relativeFromRoot === ".." ||
    relativeFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(relativeFromRoot)
  ) {
    throw new InvalidPath(relativePath, undefined, {
      reason: `Path escapes vault ${vault.id}`,
    });
  }

  return {
    vault,
    vaultId: vault.id,
    relativePath: relativeFromRoot || ".",
    absolutePath,
  };
}
