# MCP 0.1.2: Shared Runtime Refactor

The first step toward an MCP server is to give the CLI and future MCP server one shared way to construct the runtime and initialize projects. The deliverable is a working CLI backed by reusable application code.

Implement this as one focused PR. Estimated effort: half a day to one engineering day, including review.

## 1. Define the runtime boundary

Add `src/runtime/createRuntime.ts` with two entry points:

```ts
// Builds services from an already validated configuration.
createRuntime(config: AgentRuntimeConfig): Runtime

// Loads configuration using the existing path/env/default rules.
loadRuntime(options?: LoadConfigOptions): Promise<Runtime>
```

The returned runtime exposes:

```ts
type Runtime = {
  config: AgentRuntimeConfig;
  projects: ProjectOperations;
  changeSets: ChangeSetService;
  vaults: VaultRegistry;
};
```

Internally, the factory constructs one `JsonStateStore` and one `VaultRegistry`, then passes those same instances to the services.

Construction loads configuration and assembles dependencies without creating projects, writing files, checking vault access, or printing output. This supports both CLI commands and a long-running MCP connection.

Keep runtime instances explicit, with no global singleton. The CLI creates one for the command being executed; the future MCP server creates one when it starts.

## 2. Move project initialization into application code

Project initialization is currently split across three places:

- `ProjectService.init()` validates and saves the project.
- `createProjectManifest()` retrieves it and writes its Markdown note.
- `runProjectInit()` in the CLI coordinates those operations.

Move that coordination into a small `ProjectOperations` class under `src/projects/`, exposing:

```ts
init(input: InitProjectInput): Promise<{
  project: ProjectManifest;
  note: WriteNoteResult;
}>

get(projectId: string): Promise<ProjectManifest | null>

list(): Promise<ProjectManifest[]>
```

Its `init()` method calls the existing registration and manifest-writing code in the same order. Its read methods delegate to `ProjectService`.

This preserves the existing state-only `ProjectService.init()` contract while giving both adapters a complete initialization operation. It also avoids introducing a circular dependency: `projectManifest.ts` currently imports `ProjectService`, so moving note creation directly into that service would require additional restructuring.

The CLI becomes:

```ts
const runtime = await loadRuntime();
const { project, note } = await runtime.projects.init(input);

console.log(formatProjectInit(project, options, note));
```

## 3. Migrate the CLI to the shared factory

| File | Change |
|---|---|
| `src/cli/commands/project.ts` | Replace local runtime construction and `runProjectInit()` with shared runtime calls |
| `src/cli/commands/changeSet.ts` | Replace its local service factory with `runtime.changeSets` |
| `src/cli/commands/vault.ts` | Use the shared registry and loaded configuration |

Argument parsing, human-readable formatting, JSON formatting, and exit handling remain in the CLI. Runtime and project application code return data or throw existing domain errors.

Commands that only manage configuration—such as `setup`, `config`, and the current `doctor`—continue using configuration functions directly. They do not need to construct application services.

## 4. Preserve observable behavior

Preserve:

- Configuration precedence and default paths.
- Project defaults, validation, and duplicate-project errors.
- State format and Markdown paths/content.
- Vault capability and filesystem safety checks.
- CLI arguments, JSON shapes, human-readable output, and error behavior.

One known limitation needs an explicit characterization test: project registration currently persists before the Markdown write. If writing fails, the project remains registered. This PR preserves and documents that behavior; subsequent reliability work will address recovery and concurrent writes.

## 5. Verify behavior at the new boundary

Move the existing test that registers a project and writes its manifest from the CLI suite to the project operations suite. Keep formatting tests in the CLI suite.

Add focused integration coverage for:

- Creating a runtime from temporary configuration and completing project initialization.
- Creating a change set for that project through the same runtime, proving the services share state.
- Reading those records through a newly constructed runtime, proving persistence.
- Duplicate initialization and note-write failure.
- A built CLI smoke test using a temporary config and vault, checking JSON output and resulting files.

Run:

```sh
pnpm test
pnpm build
```

Reuse existing configuration and filesystem safety tests rather than duplicating them.

## Acceptance criteria

- Project and change-set commands use shared runtime construction.
- The complete project initialization workflow lives outside the CLI.
- Application code has no dependency on Commander or console output.
- Existing behavior remains verified.

This refactor creates the boundary where the MCP adapter can connect in the next step. MCP protocol implementation, concurrent-write protection, and partial-failure recovery are subsequent work for the 0.1.2 release.
