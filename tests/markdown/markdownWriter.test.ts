import {
  link,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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

  it("updates an existing regular note without leaving old content", async () => {
    const vault = await createVault(["write"]);
    const writer = new MarkdownWriter(new VaultRegistry([vault]));
    await writeFile(join(vault.rootPath, "note.md"), "long original contents\n");

    await writer.writeNote({ vaultId: "agent", relativePath: "note.md", contents: "new\n" });

    await expect(readFile(join(vault.rootPath, "note.md"), "utf8")).resolves.toBe("new\n");
  });

  it("rejects a linked parent before creating directories outside the vault", async () => {
    const vault = await createVault(["write"]);
    const outside = await createVault(["write"]);
    await symlink(outside.rootPath, join(vault.rootPath, "redirect"), "junction");
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    await expect(writer.writeNote({
      vaultId: "agent", relativePath: "redirect/nested/note.md", contents: "escaped\n",
    })).rejects.toThrow(InvalidPath);

    await expect(readdir(outside.rootPath)).resolves.toEqual([]);
  });

  it.each([false, true])("rejects a destination symlink (dangling: %s)", async (dangling) => {
    const vault = await createVault(["write"]);
    const outside = await createVault(["write"]);
    const target = join(outside.rootPath, "target.md");
    if (!dangling) {
      await writeFile(target, "original\n");
    }
    await symlink(target, join(vault.rootPath, "note.md"), "file");
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    await expect(writer.writeNote({
      vaultId: "agent", relativePath: "note.md", contents: "escaped\n",
    })).rejects.toThrow(InvalidPath);

    if (dangling) {
      await expect(readdir(outside.rootPath)).resolves.toEqual([]);
    } else {
      await expect(readFile(target, "utf8")).resolves.toBe("original\n");
    }
  });

  it("rejects a hard-linked destination without truncating its target", async () => {
    const vault = await createVault(["write"]);
    const outside = await createVault(["write"]);
    const target = join(outside.rootPath, "target.md");
    await writeFile(target, "original\n");
    await link(target, join(vault.rootPath, "note.md"));
    const writer = new MarkdownWriter(new VaultRegistry([vault]));

    await expect(writer.writeNote({
      vaultId: "agent", relativePath: "note.md", contents: "escaped\n",
    })).rejects.toThrow(InvalidPath);

    await expect(readFile(target, "utf8")).resolves.toBe("original\n");
  });

  it("supports an explicitly configured symlink to the vault root", async () => {
    const vault = await createVault(["write"]);
    const holder = await createVault(["write"]);
    const rootLink = join(holder.rootPath, "vault");
    await symlink(vault.rootPath, rootLink, "junction");
    const writer = new MarkdownWriter(new VaultRegistry([{ ...vault, rootPath: rootLink }]));

    await writer.writeNote({ vaultId: "agent", relativePath: "nested/note.md", contents: "note\n" });

    await expect(readFile(join(vault.rootPath, "nested/note.md"), "utf8")).resolves.toBe("note\n");
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
  const rootPath = await mkdtemp(join(tmpdir(), "engzero-markdown-writer-"));
  tempDirs.push(rootPath);

  return {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities,
  };
}
