#!/usr/bin/env node

import { Command } from "commander";

import { addVaultSubcommand } from "./commands/vault.js";
import { addDoctorSubcommand } from "./commands/doctor.js";
import { addSetupSubcommand } from "./commands/setup.js";
import { formatError, RuntimeError } from "../util/errors.js";

function handleCliError(error: unknown): void {
  process.exitCode = 1;

  if (error instanceof RuntimeError) {
    console.error(`${error.name}: ${error.message}`)
    return
  }

  console.error(formatError(error));

  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
}

async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name("3ng0")
    .description("Persistent AI engineering agent runtime")
    .version("0.1.0");

  addVaultSubcommand(program);
  addDoctorSubcommand(program);
  addSetupSubcommand(program);

  await program.parseAsync(process.argv);
}

runCli()
  .catch(handleCliError)

