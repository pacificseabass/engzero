import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const compiler = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));

// Remove generated output so deleted source files cannot survive in a release.
await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });

const result = spawnSync(process.execPath, [compiler, "-p", "tsconfig.json"], {
  cwd: projectRoot,
  stdio: "inherit",
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
