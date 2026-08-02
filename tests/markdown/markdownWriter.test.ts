import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { MarkdownWriter } from "../../src/markdown/markdownWriter.js";
import {
  InvalidPath,
  MarkdownWriteError,
  VaultPermissionError,
} from "../../src/util/errors.js";
import { VaultRegistry } from "../../src/vaults/vaultRegistry.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("MarkdownWriter", () => {
  it("writes a note inside a vault", async () => {
    const vault = await createVault(["read", "write", "append"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    const result = await writer.writeNote({
      vaultId: "agent",
      relativePath: "Projects/agent-runtime.md",
      contents: "# Agent Runtime\n",
    });

    expect(result).toEqual({
      vaultId: "agent",
      relativePath: "Projects/agent-runtime.md",
      absolutePath: join(vault.rootPath, "Projects", "agent-runtime.md"),
    });
    await expect(readFile(result.absolutePath, "utf8")).resolves.toBe(
      "# Agent Runtime\n",
    );
  });

  it("creates nested parent directories before writing", async () => {
    const vault = await createVault(["write"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    const result = await writer.writeNote({
      vaultId: "agent",
      relativePath: "02-Change-Sets/2026-05/example.md",
      contents: "# Change Set\n",
    });

    await expect(readFile(result.absolutePath, "utf8")).resolves.toBe(
      "# Change Set\n",
    );
  });

  it("rejects vaults without write capability", async () => {
    const vault = await createVault(["read"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    await expect(
      writer.writeNote({
        vaultId: "agent",
        relativePath: "note.md",
        contents: "# Note\n",
      }),
    ).rejects.toThrow(VaultPermissionError);
  });

  it("rejects paths that escape the vault root", async () => {
    const vault = await createVault(["write"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    await expect(
      writer.writeNote({
        vaultId: "agent",
        relativePath: "../outside.md",
        contents: "# Outside\n",
      }),
    ).rejects.toThrow(InvalidPath);
  });

  it("wraps filesystem write failures", async () => {
    const vault = await createVault(["write"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    const error = await writer
      .writeNote({
        vaultId: "agent",
        relativePath: ".",
        contents: "# Cannot overwrite directory\n",
      })
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(MarkdownWriteError);
    expect(error).toMatchObject({
      code: "markdown-write-failed",
    });
    expect((error as MarkdownWriteError).cause).toBeInstanceOf(Error);
  });
});

async function createVault(
  capabilities: VaultConfig["capabilities"],
): Promise<VaultConfig> {
  const rootPath = await mkdtemp(join(tmpdir(), "3ng0-markdown-writer-"));
  tempDirs.push(rootPath);

  return {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities,
  };
}
