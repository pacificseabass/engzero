# Contributing to engzero

engzero is pre-1.0 and under active development. Issues, questions, and pull requests are
welcome — but read the two short sections below first, because this project asks something
slightly unusual about provenance.

## Licence and sign-off

engzero is licensed under the [Apache License 2.0](LICENSE). Contributions are accepted
under those same terms.

We use a **Developer Certificate of Origin** (DCO) rather than a CLA. There is nothing to
sign and no account to create — you certify the [DCO](DCO) by adding a `Signed-off-by:`
line to each commit:

```sh
git commit -s -m "fix: handle empty change-set plan"
```

That appends a line matching your git `user.name` and `user.email`:

```
Signed-off-by: Jane Doe <jane@example.com>
```

If you forget, `git commit --amend -s` fixes the last commit, and
`git rebase --signoff main` fixes a whole branch. CI checks every commit in a pull request
and will tell you which ones are missing the line.

By signing off you are certifying the four points in the [DCO](DCO): in plain terms, that
you wrote the contribution or otherwise have the right to submit it, that you're submitting
it under this project's licence, and that you understand the contribution is public and
permanently recorded.

**Why a DCO and not a CLA.** A CLA's real purpose is to let the project owner relicense
your contribution later. engzero's business model puts the moat in the private operational
layer — credentials, manifests, deploy profiles — rather than in the engine code, so we
don't need that option and would rather not impose the friction on you. The trade-off is
deliberate: it means engzero cannot be unilaterally relicensed without contacting
contributors.

## AI-assisted contributions

engzero is built with AI assistance and is *about* making AI-made changes accountable, so
let's be direct about it: **AI-assisted contributions are welcome.** There is no penalty
for using an agent, and no requirement to disclose which tool you used.

What does not change is the sign-off. When you add `Signed-off-by:`, you are personally
certifying that you have the right to submit the code — regardless of what generated it.
That means you are responsible for:

- Having actually reviewed the diff and being able to explain what it does and why.
- Not submitting code your tool reproduced from a source you have no right to relicense.
- Not pasting in proprietary code from an employer or client.

A PR whose author can't explain their own diff will be closed regardless of whether a human
or a model wrote it. The bar is comprehension, not authorship.

## Practical notes

```sh
pnpm install
pnpm test          # vitest, must be green
pnpm build         # tsc
pnpm dev -- --help # run the CLI without building
```

Point the runtime at a throwaway vault while developing so you never write to a real one:

```sh
export ENGZERO_CONFIG=/tmp/engzero-dev/config.yaml
```

A few conventions worth matching:

- **Service layer first.** The CLI is a thin wrapper over service functions, so the same
  operations can be exposed over MCP without rework. Put logic in the service, not the
  command.
- **Every operation is shaped like a future tool call.** Avoid CLI-specific assumptions
  leaking into `src/changeSets`, `src/projects`, or `src/memory`.
- Keep the naming split straight: **engzero** is the project, `3ng0`-style names belong to
  a user's own agent instance. A fresh install must never be named after someone else's.
- **Build services through the runtime.** `loadRuntime()` in `src/runtime/createRuntime.ts`
  loads config and assembles the services; `createRuntime(config)` does the same from an
  already normalized config. Construction never writes files or prints output. Use
  `runtime.projects.init()` for project creation: it registers the project and writes its
  manifest note. Registration is persisted first, so a failed note write leaves the project
  registered without a note. That partial-failure behavior is known and intentional for now.

## Reporting a security issue

Please do not open a public issue for a vulnerability, particularly one touching the vault
capability boundary, the policy layer, or anything that could expose credentials. Report it
privately through GitHub's **Security → Report a vulnerability** on the repository.
