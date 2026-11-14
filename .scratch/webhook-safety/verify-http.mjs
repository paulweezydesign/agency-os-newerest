import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const root = fileURLToPath(new URL('../..', import.meta.url));
for (const filename of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
  if (existsSync(root + '/' + filename)) throw new Error('Use a clean synthetic checkout with no local environment files');
}
const port = 3326;
const url = `http://127.0.0.1:${port}`;
const evidence = { mode: 'loopback only; synthetic requests; no Mongo or provider credentials', checks: [], ownedAppsStopped: [], passed: false };
const tracker = { action: 'update', data: { id: 'synthetic', title: 'Synthetic', description: 'Synthetic', status: 'started', assignee: null } };
const checkout = { id: 'evt_synthetic', type: 'checkout.session.completed', data: { object: { id: 'cs_synthetic', amount_total: 25, currency: 'usd', metadata: { tenantId: 'tenant-synthetic', projectId: 'project-synthetic' } } } };
async function phase(mode) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: mode, NEXT_TELEMETRY_DISABLED: '1', AUTH_URL: url, AUTH_SECRET: randomBytes(32).toString('hex'), AGENCYOS_AGENT_RUN_ENABLED: 'false', NEXT_FONT_GOOGLE_MOCKED_RESPONSES: root + '/scripts/workflow-demo/fonts.cjs' };
  const child = spawn(process.execPath, [root + '/node_modules/next/dist/bin/next', mode === 'production' ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env, detached: true, stdio: ['ignore','pipe','pipe'] });
  const log = createWriteStream(`/tmp/agencyos-webhook-${mode}.log`); child.stdout.pipe(log); child.stderr.pipe(log);
  try {
    let ready = false;
    for(let attempt=0; attempt<100; attempt++) {
      if(child.exitCode !== null) throw new Error(`${mode} server exited`);
      try { const response = await fetch(url + '/api/webhooks/linear', { signal: AbortSignal.timeout(1500) }); if(response.status === 405) { ready = true; break; } } catch { }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    assert.ok(ready, 'Owned app should be ready');
    for(const provider of ['linear','monday','stripe']) {
      const cases = mode === 'production' ? ['valid-fixture','malformed'] : ['malformed'];
      for(const kind of cases) {
        const body = provider === 'stripe' ? checkout : { ...tracker, data: { ...tracker.data, status: provider === 'monday' ? 'working_on_it' : 'started' } };
        const start = performance.now();
        const response = await fetch(`${url}/api/webhooks/${provider}`, { method: 'POST', headers: { 'content-type':'application/json', 'stripe-signature': kind === 'valid-fixture' ? 'whsec_test' : 'wrong' }, body: kind === 'valid-fixture' ? JSON.stringify(body) : '{}', signal: AbortSignal.timeout(30000) });
        const actual = await response.json();
        const expected = mode === 'production' ? { status:503, error:'Live webhooks are not configured' } : { status:400, error:provider === 'stripe' ? 'Invalid webhook signature' : 'Invalid webhook payload' };
        const entry = { mode, provider, kind, status:response.status, body:actual, durationMs:Math.round(performance.now()-start) };
        evidence.checks.push(entry); console.log(JSON.stringify(entry));
        assert.equal(response.status,expected.status); assert.deepEqual(actual,{error:expected.error});
      }
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid,'SIGTERM');
      await new Promise((resolve,reject) => { const timeout=setTimeout(()=>reject(new Error('Owned app cleanup timed out')),15000); child.once('exit',()=>{clearTimeout(timeout);resolve();}); });
    }
    evidence.ownedAppsStopped.push({mode,stopped:child.exitCode !== null || child.signalCode !== null});
  }
}
try { await phase('production'); await phase('development'); evidence.passed=true; }
catch(error) { evidence.failure=error.stack; process.exitCode=1; }
finally { await mkdir(root+'/.scratch/webhook-safety',{recursive:true}); await writeFile(root+'/.scratch/webhook-safety/http-evidence.json',JSON.stringify(evidence,null,2)); console.log(JSON.stringify({passed:evidence.passed,checks:evidence.checks.length,ownedAppsStopped:evidence.ownedAppsStopped,failure:evidence.failure})); }
