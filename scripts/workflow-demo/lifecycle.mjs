import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp } from "node:fs/promises";
import path from "node:path";

export async function copyDemoSource(root, destination) {
  // Next generates next-env.d.ts; neither it nor .next/.env files are inputs.
  for (const entry of ["src", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs"]) {
    await cp(path.join(root, entry), path.join(destination, entry), { recursive: true });
  }
  await cp(path.join(root, "public"), path.join(destination, "public"), { recursive: true }).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export function browserLaunchOptions(options) {
  return { headless: !options.headed, chromiumSandbox: !options.noSandbox, ...(options.chromium ? { executablePath: options.chromium } : {}) };
}

const exited = child => child.exitCode !== null || child.signalCode !== null;

function waitForExit(child, timeoutMs) {
  if (exited(child)) return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = value => { clearTimeout(timer); child.off("exit", onExit); resolve(value); };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(exited(child)), timeoutMs);
    child.once("exit", onExit);
    if (exited(child)) finish(true);
  });
}

export function ownedProcessGroup(pid) {
  if (!Number.isInteger(pid) || pid < 2) throw new Error("Invalid owned app process group");
  return {
    signal(signal) {
      try { process.kill(-pid, signal); } catch (error) { if (error.code !== "ESRCH") throw error; }
    },
    async alive() {
      const { stdout } = await promisify(execFile)("ps", ["-eo", "pgid=,stat="], { timeout: 1000 });
      // Defunct processes cannot serve requests or hold application resources.
      return stdout.split("\n").some(line => {
        const [group, state] = line.trim().split(/\s+/);
        return Number(group) === pid && state && !state.startsWith("Z");
      });
    },
  };
}

export async function stopApp(child, timeoutMs = 5000, group) {
  if (!child) return;
  const stopped = async () => exited(child) && (!group || !await group.alive());
  const waitStopped = async () => {
    const deadline = Date.now() + timeoutMs;
    if (!await waitForExit(child, timeoutMs)) return false;
    while (!await stopped()) {
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => setTimeout(resolve, Math.min(25, timeoutMs)));
    }
    return true;
  };
  if (await stopped()) return;
  if (group) group.signal("SIGTERM"); else child.kill("SIGTERM");
  if (await waitStopped()) return;
  if (group) group.signal("SIGKILL"); else child.kill("SIGKILL");
  if (!await waitStopped()) throw new Error("App process-group exit was not verified after SIGTERM and SIGKILL");
}

export async function bounded(label, action, timeoutMs = 5000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + " timed out")), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function cleanupRuntime({ browser, child, group, storage, disconnect, timeoutMs = 5000 }) {
  const errors = [];
  const attempt = async (label, action) => {
    try { await action(); } catch (error) { errors.push(label + ": " + error.message); }
  };
  if (browser) await attempt("Browser shutdown", async () => {
    await bounded("Browser shutdown", () => browser.close(), timeoutMs);
    if (browser.isConnected?.()) throw new Error("Browser remains connected");
  });
  await attempt("App shutdown", () => stopApp(child, timeoutMs, group));
  if (storage) await attempt("Engine storage shutdown", () => bounded("Engine storage shutdown", () => storage.close(), timeoutMs));
  if (disconnect) await attempt("Mongo client shutdown", () => bounded("Mongo client shutdown", disconnect, timeoutMs));
  return errors;
}
