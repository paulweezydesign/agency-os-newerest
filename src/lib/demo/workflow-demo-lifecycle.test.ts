import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { copyDemoSource, browserLaunchOptions, cleanupRuntime, stopApp, ownedProcessGroup, bounded } from "../../../scripts/workflow-demo/lifecycle.mjs";

describe("demo lifecycle regressions", () => {
  it("copies tracked inputs without generated declarations, cache or env files", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "demo-copy-test-"));
    const destination = path.join(root, "output");
    try {
      await mkdir(path.join(root, "src"));
      for (const file of ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs"]) await writeFile(path.join(root, file), "{}");
      await writeFile(path.join(root, ".env.local"), "DO_NOT_COPY=secret");
      await copyDemoSource(root, destination);
      await expect(access(path.join(destination, "package.json"))).resolves.toBeUndefined();
      await expect(access(path.join(destination, "next-env.d.ts"))).rejects.toThrow();
      await expect(access(path.join(destination, ".env.local"))).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("explicitly enables sandbox unless opted out", () => {
    expect(browserLaunchOptions({ headed: false, noSandbox: false })).toMatchObject({ chromiumSandbox: true });
    expect(browserLaunchOptions({ headed: false, noSandbox: true })).toMatchObject({ chromiumSandbox: false });
  });
  it("reports browser rejection and still closes other resources", async () => {
    let disconnected = false;
    const errors = await cleanupRuntime({ group: undefined, child: undefined, storage: undefined, browser: { close: async () => { throw Error("close rejected"); } }, disconnect: async () => { disconnected = true; }, timeoutMs: 20 });
    expect(errors.join()).toContain("close rejected");
    expect(disconnected).toBe(true);
  });
  it("bounds a hanging browser shutdown", async () => {
    const errors = await cleanupRuntime({ group: undefined, child: undefined, storage: undefined, disconnect: undefined, browser: { close: () => new Promise(() => {}) }, timeoutMs: 10 });
    expect(errors.join()).toContain("timed out");
  });
  it("awaits process exit after SIGKILL escalation", async () => {
    const emitter = new EventEmitter();
    const child = Object.assign(emitter, { exitCode: null, signalCode: null as string | null, signals: [] as string[], kill(signal: string) { this.signals.push(signal); if (signal === "SIGKILL") setTimeout(() => { this.signalCode = signal; emitter.emit("exit", null, signal); }, 2); return true; } });
    await stopApp(child, 10, undefined);
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(child.signalCode).toBe("SIGKILL");
    expect(child.listenerCount("exit")).toBe(0);
  });
  it("does not accept parent exit while its server descendant remains alive", async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: 0, signalCode: null, kill: () => true });
    let alive = true;
    const signals: string[] = [];
    const group = { alive: async () => alive, signal: (signal: string) => { signals.push(signal); if (signal === "SIGKILL") alive = false; } };
    await stopApp(child, 10, group);
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(alive).toBe(false);
  });
  it.skipIf(process.platform === "win32")("kills and verifies a real owned parent/server group after ignored SIGTERM", async () => {
    const server = 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000);process.stdout.write("ready\\n");';
    const parent = 'process.on("SIGTERM",()=>{});const c=require("node:child_process").spawn(process.execPath,["-e",'+JSON.stringify(server)+'],{stdio:["ignore","pipe","ignore"]});c.stdout.pipe(process.stdout);setInterval(()=>{},1000);';
    const child = spawn(process.execPath, ["-e", parent], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
    const group = ownedProcessGroup(child.pid);
    try {
      await bounded("Test server ready", () => once(child.stdout!, "data"), 3000);
      await stopApp(child, 100, group);
      expect(child.signalCode).toBe("SIGKILL");
      expect(await group.alive()).toBe(false);
    } finally { group.signal("SIGKILL"); }
  });
  it("fails when process exit cannot be verified after escalation", async () => {
    const child = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null, kill: () => false });
    await expect(stopApp(child, 10, undefined)).rejects.toThrow(/exit was not verified/);
    expect(child.listenerCount("exit")).toBe(0);
  });
});
