import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkVault,
  checkVaults,
  type VaultCheck,
} from "../../src/vaults/vaultChecker.js";
import type { VaultConfig } from "../../src/vaults/vaultTypes.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((path) => rm(path, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("checkVault", () => {
  it("returns ok checks for a readable and writable vault directory", async () => {
    const rootPath = await createTempDir();
    const vault = createVault(rootPath, ["read", "write", "append"]);

    const result = await checkVault(vault);

    expect(result).toMatchObject({
      vaultId: "agent",
      label: "Agent Vault",
      rootPath,
      status: "ok",
    });
    expect(checkStatus(result.checks, "root_exists")).toBe("ok");
    expect(checkStatus(result.checks, "root_is_directory")).toBe("ok");
    expect(checkStatus(result.checks, "read_access")).toBe("ok");
    expect(checkStatus(result.checks, "write_probe")).toBe("ok");
  });

  it("returns an error result when the vault root does not exist", async () => {
    const rootPath = join(await createTempDir(), "missing");
    const vault = createVault(rootPath, ["read"]);

    const result = await checkVault(vault);

    expect(result.status).toBe("error");
    expect(result.checks).toHaveLength(1);
    expect(checkStatus(result.checks, "root_exists")).toBe("error");
  });

  it("returns an error result when the vault root is not a directory", async () => {
    const dir = await createTempDir();
    const rootPath = join(dir, "vault-file");
    await writeFile(rootPath, "not a directory", "utf8");

    const result = await checkVault(createVault(rootPath, ["read", "write"]));

    expect(result.status).toBe("error");
    expect(checkStatus(result.checks, "root_exists")).toBe("ok");
    expect(checkStatus(result.checks, "root_is_directory")).toBe("error");
    expect(result.checks.map((check) => check.name)).not.toContain(
      "read_access",
    );
    expect(result.checks.map((check) => check.name)).not.toContain(
      "write_probe",
    );
  });

  it("does not run read or write checks for undeclared capabilities", async () => {
    const rootPath = await createTempDir();

    const result = await checkVault(createVault(rootPath, []));

    expect(result.status).toBe("ok");
    expect(result.checks.map((check) => check.name)).toEqual([
      "root_exists",
      "root_is_directory",
    ]);
  });

  it("removes the write probe file after a successful write check", async () => {
    const rootPath = await createTempDir();

    const result = await checkVault(createVault(rootPath, ["write"]));
    const entries = await readdir(rootPath);

    expect(result.status).toBe("ok");
    expect(checkStatus(result.checks, "write_probe")).toBe("ok");
    expect(entries.filter((entry) => entry.startsWith("3ng0-"))).toEqual([]);
  });
});

describe("checkVaults", () => {
  it("returns one result per vault even when one vault fails", async () => {
    const validRoot = await createTempDir();
    const missingRoot = join(await createTempDir(), "missing");

    const results = await checkVaults([
      createVault(validRoot, ["read"]),
      {
        ...createVault(missingRoot, ["read"]),
        id: "missing",
        label: "Missing Vault",
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.vaultId)).toEqual([
      "agent",
      "missing",
    ]);
    expect(results.map((result) => result.status)).toEqual(["ok", "error"]);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "3ng0-vault-checker-"));
  tempDirs.push(dir);
  await mkdir(dir, { recursive: true });

  return dir;
}

function createVault(
  rootPath: string,
  capabilities: VaultConfig["capabilities"],
): VaultConfig {
  return {
    id: "agent",
    label: "Agent Vault",
    rootPath,
    capabilities,
  };
}

function checkStatus(
  checks: VaultCheck[],
  name: string,
): VaultCheck["status"] | undefined {
  return checks.find((check) => check.name === name)?.status;
}
