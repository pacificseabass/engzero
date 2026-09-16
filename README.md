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

On POSIX systems, state and setup config files are written with owner-only
permissions (`0600`), and newly created parent directories use `0700`. Saving
state or forcing config setup also replaces older file permissions. Existing
parent directories retain their permissions, including custom shared locations.
