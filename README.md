# 3ng0 Agent Runtime

MVP 1 establishes the local memory and change-set ledger for 3ng0.

This scaffold follows the technical spec for:

- vault registration
- project capsules
- change-set lifecycle records
- Markdown memory notes
- JSON-backed machine state

Vault writes reject symlinks in note paths and files with multiple hard links.
The configured vault root may itself be a symlink. Keep the vault and its parent
directories under trusted ownership: these checks are not an operating-system
sandbox against another process concurrently replacing directories.
