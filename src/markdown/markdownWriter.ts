import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import { dirname, join, sep } from "node:path";

import {
  formatError,
  InvalidPath,
  isNodeError,
  MarkdownWriteError,
} from "../util/errors.js";
import type { ResolvedVaultPath } from "../vaults/vaultPathResolver.js";
import type { VaultRegistry } from "../vaults/vaultRegistry.js";

export type WriteNoteInput = {
  vaultId: string;
  relativePath: string;
  contents: string;
};

export type WriteNoteResult = {
  vaultId: string;
  relativePath: string;
  absolutePath: string;
};

export class MarkdownWriter {
  constructor(private readonly vaultRegistry: VaultRegistry) {}

  async writeNote(input: WriteNoteInput): Promise<WriteNoteResult> {
    const resolvedPath = this.vaultRegistry.resolvePath(
      input.vaultId,
      input.relativePath,
      "write",
    );

    await writeResolvedNote(resolvedPath, input.contents);

    return {
      vaultId: resolvedPath.vaultId,
      relativePath: resolvedPath.relativePath,
      absolutePath: resolvedPath.absolutePath,
    };
  }
}

async function writeResolvedNote(
  resolvedPath: ResolvedVaultPath,
  contents: string,
): Promise<void> {
  try {
    const path = await prepareNotePath(resolvedPath);
    try {
      const entry = await lstat(path);
      if (entry.isSymbolicLink()) {
        throw new InvalidPath(path, undefined, {
          reason: "Note must not be a symlink",
        });
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }
    }

    // Do not truncate until the opened file has been checked. O_NOFOLLOW also
    // rejects a symlink substituted after lstat on platforms that support it.
    const file = await open(
      path,
      constants.O_WRONLY |
        constants.O_CREAT |
        (constants.O_NOFOLLOW ?? 0) |
        (constants.O_NONBLOCK ?? 0),
    );
    try {
      const entry = await file.stat();
      if (!entry.isFile() || entry.nlink !== 1) {
        throw new InvalidPath(path, undefined, {
          reason: "Note must be a regular file without hard links",
        });
      }
      await file.truncate(0);
      await file.writeFile(contents, "utf8");
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof InvalidPath) {
      throw error;
    }
    throw new MarkdownWriteError(
      `Failed to write Markdown note at ${resolvedPath.absolutePath}: ${formatError(error)}`,
      "markdown-write-failed",
      { cause: error },
    );
  }
}

async function prepareNotePath(path: ResolvedVaultPath): Promise<string> {
  // The configured root is trusted and may itself be a symlink. Below its
  // canonical location, reject links before creating any child directories.
  await mkdir(path.vault.rootPath, { recursive: true });
  const root = await realpath(path.vault.rootPath);
  let parent = root;
  for (const part of dirname(path.relativePath).split(sep)) {
    if (part === ".") {
      continue;
    }
    parent = join(parent, part);
    try {
      await mkdir(parent);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }
    }
    const entry = await lstat(parent);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new InvalidPath(parent, undefined, {
        reason: "Note parent must be a directory without symlinks",
      });
    }
  }
  return join(root, path.relativePath);
}
