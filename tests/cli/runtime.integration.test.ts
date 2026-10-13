import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { renderChangeSetNote } from "../../src/changeSets/changeSetRenderer.js";
import type { ChangeSet } from "../../src/changeSets/changeSetTypes.js";
import { renderProjectManifestNote } from "../../src/projects/projectManifest.js";
import type { ProjectManifest } from "../../src/projects/projectTypes.js";

const execute = promisify(execFile);
const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
// Run the TypeScript source directly through tsx, as `pnpm dev` does, so the
// suite never rebuilds compiled output or depends on it.
const tsxCli = require.resolve("tsx/cli");
const cliPath = join(projectRoot, "src", "cli", "index.ts");
const { version } = require(join(projectRoot, "package.json")) as { version: string };
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((path) => rm(path, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createFixture() {
  const rootPath = await mkdtemp(join(tmpdir(), "engzero-cli-runtime-"));
  tempDirs.push(rootPath);
  const vaultPath = join(rootPath, "vault");
  const statePath = join(rootPath, "state", "state.json");
  const configPath = join(rootPath, "config.yaml");
  await mkdir(vaultPath);
  await writeFile(configPath, stringify({
    state: { type: "json", path: statePath },
    vaults: [{
      id: "agent",
      label: "Agent Vault",
      root_path: vaultPath,
      capabilities: ["read", "write", "append"],
    }],
  }));

  async function run(...args: string[]) {
    try {
      const result = await execute(process.execPath, [tsxCli, cliPath, ...args], {
        cwd: rootPath,
        env: { ...process.env, ENGZERO_CONFIG: configPath },
      });
      return { code: 0, ...result };
    } catch (error) {
      const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
      if (typeof failure.code !== "number") throw error;
      return { code: failure.code, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
    }
  }

  async function json<T>(...args: string[]): Promise<T> {
    const result = await run(...args, "--json");
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    return JSON.parse(result.stdout) as T;
  }

  return { rootPath, vaultPath, statePath, configPath, run, json };
}

describe("built CLI with shared runtime", () => {
  it("preserves project and change-set JSON, persisted state, and Markdown across commands", async () => {
    const { vaultPath, statePath, json } = await createFixture();
    const project = await json<ProjectManifest>(
      "project", "init", "demo", "--name", "Demo Project", "--type", "internal",
      "--memory-namespace", "demo-memory", "--vault", "agent", "--risk", "high",
    );
    expect(project).toEqual({
      projectId: "demo",
      name: "Demo Project",
      projectType: "internal",
      memoryNamespace: "demo-memory",
      vaultNamespace: "agent",
      riskProfile: "high",
      repos: [],
      deploymentTargets: [],
      toolsAllowed: [],
    });
    expect(await json("project", "show", "demo")).toEqual(project);
    expect(await json("project", "list")).toEqual([project]);
    await expect(readFile(join(vaultPath, "04-Projects/demo/ProjectManifest.md"), "utf8"))
      .resolves.toBe(renderProjectManifestNote(project));

    const created = await json<ChangeSet>(
      "change-set", "create", "--project", "demo", "--goal", "Refactor runtime", "--risk", "low",
    );
    expect(created).toMatchObject({ projectId: "demo", source: "cli", status: "created", riskLevel: "low" });
    expect(await json("change-set", "show", created.id)).toEqual(created);
    expect(await json("change-set", "list", "--project", "demo", "--status", "created")).toEqual([created]);

    const planning = await json<ChangeSet>("change-set", "status", created.id, "planning");
    expect(planning.status).toBe("planning");
    await json("change-set", "event", created.id, "--message", "Started refactor");
    await json("change-set", "plan", "add", created.id, "--item", "Extract factory");
    await json("change-set", "file", "add", created.id, "--path", "src/runtime/createRuntime.ts");
    await json(
      "change-set", "validation", "add", created.id, "--kind", "test", "--status", "passed",
      "--summary", "Tests passed", "--command", "pnpm test",
    );
    const closed = await json<ChangeSet>("change-set", "close", created.id, "--summary", "Refactor verified");
    expect(closed).toMatchObject({
      status: "closed",
      reviewSummary: "Refactor verified",
      plan: ["Extract factory"],
      filesChanged: ["src/runtime/createRuntime.ts"],
      testsRun: [{ kind: "test", status: "passed", summary: "Tests passed", command: "pnpm test" }],
    });
    expect(closed.events.some((event) => event.message === "Started refactor")).toBe(true);
    const state = JSON.parse(await readFile(statePath, "utf8"));
    expect(state).toEqual({
      version: 1,
      projects: { demo: project },
      changeSets: { [closed.id]: closed },
      memoryUpdates: {},
    });
    await expect(readFile(join(vaultPath, closed.obsidianPath), "utf8"))
      .resolves.toBe(renderChangeSetNote(closed).contents);
  });

  it("preserves human-readable output and vault diagnostics", async () => {
    const { vaultPath, statePath, run } = await createFixture();
    expect(await run("--version")).toEqual({ code: 0, stdout: `${version}\n`, stderr: "" });
    expect(await run("project", "list")).toEqual({ code: 0, stdout: "No projects registered.\n", stderr: "" });
    expect(await run("change-set", "list")).toEqual({ code: 0, stdout: "No change sets found.\n", stderr: "" });
    expect(await run("vault", "list")).toEqual({
      code: 0,
      stdout: `agent\tread,write,append\t${vaultPath}\tAgent Vault\n`,
      stderr: "",
    });
    const check = await run("vault", "check");
    expect(check.code).toBe(0);
    expect(check.stderr).toBe("");
    expect(check.stdout).toContain("agent: ok\n");
    expect(check.stdout).toContain("ok\twrite_probe\tWrite probe succeeded\n");
    await expect(readdir(vaultPath)).resolves.toEqual([]);
    await expect(readFile(statePath)).rejects.toMatchObject({ code: "ENOENT" });

    expect(await run("project", "init", "demo")).toEqual({
      code: 0,
      stdout: "Created project: demo\nManifest note: 04-Projects/demo/ProjectManifest.md (vault: agent)\n",
      stderr: "",
    });
    expect(await run("project", "list")).toEqual({
      code: 0, stdout: "demo\tmedium\tagent\tdemo\n", stderr: "",
    });
  });

  it("preserves domain errors, parser errors, and vault failure exit codes", async () => {
    const { vaultPath, run, json } = await createFixture();
    expect(await run("project", "show", "missing")).toEqual({
      code: 1, stdout: "", stderr: "ProjectNotFoundError: Project not found: missing\n",
    });
    expect(await run("project", "init", "demo", "--risk", "invalid")).toEqual({
      code: 1, stdout: "", stderr: "RuntimeError: Invalid risk profile: invalid. Expected low, medium, or high.\n",
    });
    const missingGoal = await run("change-set", "create", "--project", "demo");
    expect(missingGoal).toEqual({
      code: 1, stdout: "", stderr: "error: required option '--goal <goal>' not specified\n",
    });
    await json("project", "init", "demo");
    expect(await run("project", "init", "demo")).toEqual({
      code: 1, stdout: "", stderr: "ProjectAlreadyExistsError: Project already exists: demo\n",
    });
    const created = await json<ChangeSet>("change-set", "create", "--project", "demo", "--goal", "Test errors");
    expect(await run("change-set", "status", created.id, "deployed")).toEqual({
      code: 1, stdout: "", stderr: "InvalidStatusTransitionError: Invalid change-set status transition: created -> deployed\n",
    });
    expect(await json("change-set", "show", created.id)).toEqual(created);

    await rm(vaultPath, { recursive: true });
    const check = await run("vault", "check");
    expect(check.code).toBe(1);
    expect(check.stderr).toBe("");
    expect(check.stdout).toContain("agent: error\n");
    expect(check.stdout).toContain("error\troot_exists\t");
  });
});
