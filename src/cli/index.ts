#!/usr/bin/env node

import { Command } from "commander";

const program = new Command();

program
  .name("3ng0")
  .description("Persistent AI engineering agent runtime")
  .version("0.1.0");

program.parse();
