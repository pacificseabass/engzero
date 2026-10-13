# Plan: engzero MCP server

Status: proposed (2026-10-09)

The MCP server is the remaining in-progress piece of MVP 1. The CLI is already a thin
wrapper over service classes, and CONTRIBUTING.md states that the same services should
be exposed over MCP without rework. This plan does exactly that.

## Decisions up front

- **SDK:** the v2 server package `@modelcontextprotocol/server` (2.3.1 on npm, stable,
  implements the 2026-07-28 spec) with `zod/v4` for schemas. The v1 line
  (`@modelcontextprotocol/sdk`, 1.32.1) is in maintenance mode; greenfield code should
  start on v2.
- **Transport:** stdio only. engzero is local-first and one agent drives it, so Streamable
  HTTP buys nothing yet. Add it later if a remote harness needs it.
- **Entry point:** a new `engzero mcp serve` subcommand on the existing binary. No second
  bin, no separate package. Claude Code registers it with:

  ```sh
  claude mcp add engzero -- engzero mcp serve
  ```

- **Process model:** stateless per call, exactly like the CLI. Each tool call loads config,
  builds the services, runs, writes. No state is cached in the server process, so the CLI
  and Obsidian stay consistent with it.

## Phase 0: prep refactors (no behavior change)

- **Extract a shared runtime factory.** `src/cli/commands/project.ts` and
  `src/cli/commands/changeSet.ts` each build a state store and vault registry from config.
  Move that into one `src/runtime/createRuntime.ts` that the CLI and MCP both call.
- **Move the enum arrays out of the CLI.** The status, event type, source, and validation
  lists live in `src/cli/commands/changeSet.ts`. Move them to
  `src/changeSets/changeSetTypes.ts` as exported `as const` arrays and derive the union
  types from them. Zod enums and commander validation then share one source of truth.
- **Move the text formatters** from the command files into `src/cli/formatters.ts`, which
  is currently an empty placeholder. The MCP tools reuse them for human-readable text
  alongside structured JSON.
- **Add `"mcp"` to the change-set `source` union.** Provenance is the whole point of the
  ledger, so calls over MCP should not be recorded as `cli` or `chat`. This touches the
  type, the CLI list, and the template tests.

## Phase 1: the server

New module `src/mcp/`:

- `server.ts` builds the `McpServer`, registers tools, and exports a factory for tests.
- `tools/projects.ts`, `tools/changeSets.ts`, `tools/vaults.ts`: one `registerTool` per
  service operation.
- `errors.ts` maps `RuntimeError` subclasses to a tool result with `isError: true` and
  text of the form `InvalidStatusTransitionError (invalid-status-transition): ...`.
  Unknown errors return a generic message and log the stack to stderr.
- `src/cli/commands/mcp.ts` adds `mcp serve`. It loads config once at startup so a
  missing config fails fast with a clear stderr message and exit code 1.

### Tool surface

Mapping 1:1 to existing service methods:

| Tool | Notes |
|---|---|
| `project_list`, `project_show` | readOnly |
| `project_init` | writes state and the manifest note |
| `change_set_list`, `change_set_show` | readOnly |
| `change_set_create` | defaults `source` to `mcp` and `projectId` to `config.projects.defaultProjectId` |
| `change_set_set_status` | enforces lifecycle transitions via the service |
| `change_set_add_event` | |
| `change_set_add_plan_item` | |
| `change_set_add_file_changed` | idempotent (service already dedupes paths) |
| `change_set_add_validation` | |
| `change_set_close` | |
| `vault_list`, `config_show` | readOnly |
| `vault_check` | not readOnly, since it writes a probe file |

Every mutating tool returns `structuredContent` with the full change set or project JSON,
plus a one-line text summary from the shared formatters.

### Cross-cutting rules

- **Nothing in the server path may write to stdout.** The stdio transport owns it.
  Services already don't log, but a test should assert the server's stdout contains only
  JSON-RPC frames. Diagnostics go to stderr.
- **Serialize tool handlers in-process.** Claude Code issues parallel tool calls, and
  `JsonStateStore.transaction` is load, mutate, save with no lock. Two concurrent writes
  in one server process would lose one. A promise-chain mutex around every handler fixes
  the in-process case. The cross-process race with a CLI invocation already exists today
  and stays out of scope; note it in the README.

## Phase 2: polish and ship

- Resources: `engzero://projects/{id}` and `engzero://change-sets/{id}` returning JSON,
  and `engzero://change-sets/{id}/note` returning the rendered Markdown. Useful for agents
  that want to read without a tool round-trip.
- Add a `.mcp.json` to the repo so engzero dogfoods its own server inside Claude Code,
  with `ENGZERO_CONFIG` pointed at a dev config.
- README section on registering with Claude Code.
- Flip the site's MCP card from "in progress" to shipped.
- Release 0.2.0.

## Tests

- Unit tests per tool handler using the existing `tests/helpers/inMemoryStateStore.ts`
  and a temp vault directory, matching how `tests/changeSets/changeSetService.test.ts`
  already works.
- One end-to-end test that spawns `tsx src/cli/index.ts mcp serve` with `ENGZERO_CONFIG`
  set to a temp config, connects via `@modelcontextprotocol/client` over stdio, lists
  tools, creates a project and change set, and asserts the note landed in the temp vault.
- A test that the error mapping preserves the error code for every `RuntimeError`
  subclass.

## Risks and open items

- The v2 package version and the `registerTool` plus `serveStdio` shape are verified, but
  not its tool annotation field names or its Node engine requirement. Confirm both on
  install. `.nvmrc` says Node 24 while the dev shell currently runs 22; pin whichever the
  SDK needs.
- Adds two runtime dependencies (`@modelcontextprotocol/server`, `zod`) to a package that
  currently ships only `commander` and `yaml`. Acceptable, but keep `npm pack --dry-run`
  in the release checklist as the README already asks.
- This server is the natural enforcement point for the MVP 2 policy boundary. Phase 1
  should keep tool handlers thin so a policy check can wrap them later without
  restructuring.

## References

- MCP TypeScript SDK v1 server docs: https://ts.sdk.modelcontextprotocol.io/server
- MCP TypeScript SDK v2 docs: https://ts.sdk.modelcontextprotocol.io/v2/
