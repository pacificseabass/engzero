# 3ng0 Agent Runtime

MVP 1 establishes the local memory and change-set ledger for 3ng0.

This scaffold follows the technical spec for:

- vault registration
- project capsules
- change-set lifecycle records
- Markdown memory notes
- JSON-backed machine state

## Getting started

3ng0 uses the `engzero` npm package and CLI. With [nvm](https://github.com/nvm-sh/nvm)
installed, install the reviewed release under Node 24 (no `sudo` needed):

```sh
nvm install 24
nvm use 24
npm install --global --ignore-scripts engzero@0.1.1
engzero --version
```

Create a dedicated vault, then run setup. Enter `demo` for the default project
ID and press Enter to accept the other defaults. Setup creates your config
without overwriting an existing one.

```sh
mkdir -p "$HOME/Obsidian/agent-vault"
engzero setup --vault-path "$HOME/Obsidian/agent-vault"
engzero vault check
```

Register a project and record your first piece of work:

```sh
engzero project init demo --name "My first project"
engzero change-set create --project demo --goal "Try 3ng0"
engzero change-set list --project demo
```

Open the vault folder in Obsidian to see notes under `04-Projects` and
`02-Change-Sets`. This release provides a local project and change-set ledger.
Config lives at `~/.config/engzero/config.yaml`; state defaults to
`~/.local/share/engzero/state.json`. Use `engzero --help` or
`engzero change-set --help` to explore more commands.

## File safety

Vault writes reject symlinks in note paths and files with multiple hard links.
The configured vault root may itself be a symlink. Keep the vault and its parent
directories under trusted ownership: these checks are not an operating-system
sandbox against another process concurrently replacing directories.

On POSIX systems, state and setup config files are written with owner-only
permissions (`0600`), and newly created parent directories use `0700`. Saving
state or forcing config setup also replaces older file permissions. Existing
parent directories retain their permissions, including custom shared locations.

## Development and packaging

`pnpm build` recreates the generated `dist` directory. Packing or publishing also
runs this clean build through `prepack`. The npm archive includes only `dist`,
the package manifest, README, licence, and notice; local settings, source, tests,
and the website are excluded. Inspect the archive with `npm pack --dry-run`
before publishing a new version.
