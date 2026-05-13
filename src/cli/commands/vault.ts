import { type Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import { checkVaults } from "../../vaults/vaultChecker.js";
import { VaultRegistry } from "../../vaults/vaultRegistry.js";

export function addVaultSubcommand(program: Command): void {
  const vault = program
    .command("vault")
    .description("Manage configured Obsidian vaults");

  vault
    .command("list")
    .description("List configured vaults")
    .action(async () => {
      const config = await loadConfig();
      const registry = new VaultRegistry(config.vaults);

      for (const vault of registry.list()) {
        console.log(
          [
            vault.id,
            vault.capabilities.join(","),
            vault.rootPath,
            vault.label,
          ].join("\t"),
        );
      }
    });

  vault
    .command("check")
    .description("Check configured vault filesystem access")
    .action(async () => {
      const config = await loadConfig();
      const results = await checkVaults(config.vaults);

      for (const result of results) {
        console.log(`${result.vaultId}: ${result.status}`);

        for (const check of result.checks) {
          console.log(`  ${check.status}\t${check.name}\t${check.message}`);
        }
      }

      if (results.some((result) => result.status === "error")) {
        process.exitCode = 1;
      }
    });
}
