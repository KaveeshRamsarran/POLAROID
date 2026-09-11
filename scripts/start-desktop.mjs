import { spawn } from "node:child_process";
import electron from "electron";
const env = { ...process.env };
// Integrated editor terminals may set this for their own Node helpers.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], {
  env,
  stdio: "inherit",
  windowsHide: false,
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
