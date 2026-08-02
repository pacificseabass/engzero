import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { formatError, MarkdownWriteError } from "../util/errors.js";
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
    await mkdir(dirname(resolvedPath.absolutePath), { recursive: true });
    await writeFile(resolvedPath.absolutePath, contents, "utf8");
  } catch (error) {
    throw new MarkdownWriteError(
      `Failed to write Markdown note at ${resolvedPath.absolutePath}: ${formatError(error)}`,
      "markdown-write-failed",
      { cause: error },
    );
  }
}
