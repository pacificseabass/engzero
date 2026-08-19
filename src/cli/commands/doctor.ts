import { type Command } from "commander";
import { loadConfig } from "../../config/loadConfig.js";
import { ConfigError } from "../../util/errors.js";

export function addDoctorSubcommand(program: Command) {
  program.command('doctor')
    .description("Diagnose possible environment issues")
    .action(async () => {
      try {
        await loadConfig();
      } catch (error) {
        if (error instanceof ConfigError) {
          if (error.code === 'file-does-not-exist') {
            console.error('Config file not found. Run "engzero setup" to create one.');
            return;
          }
          throw error;
        }
      }
    })
}
