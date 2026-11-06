import { expect as baseExpect } from 'playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
const ObjectId = Types.ObjectId;
const expect = baseExpect.configure({ timeout: 45000 });

export async function verifyOperatorFlow({ browser, url, db, evidence }) {
 const context = await browser.newContext();
 await context.route('**/*', route => {
   if (new URL(route.request().url()).origin !== url) {
     evidence.externalRequests.push(new URL(route.request().url()).hostname);
     return route.abort();
   }
   return route.continue();
 });
 const page = await context.newPage(); page.setDefaultTimeout(60000);
 page.on('pageerror', error => evidence.errors.push(error.message));
 page.on('request', request => {
   if(request.method()==='POST' && request.url().endsWith('/workflow')) evidence.workflowRequests.push(request.postDataJSON());
 });
 const check = name => { evidence.checks.push(name); console.log('PASS:', name); };
  await page.goto(url+'/signin');
  await page.getByLabel('Email', {exact:true}).fill('operator@agencyos.local');
  await page.getByLabel('Password', {exact:true}).fill('operator-dev');
  await page.getByRole('button',{name:'Sign in to local demo'}).click();
  await page.waitForURL(/\/dashboard/);
  check('Existing local-demo operator auth via login UI');
  async function fixture(name,email) {
   return page.evaluate(async ({name,email}) => {
    const response = await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,contactEmail:email})});
    if(response.status!==201) throw Error('Fixture create failed: '+response.status);
    return (await response.json()).id;
   },{name,email});
  }
  const clientId = await fixture('Example Browser Main','browser-main@example.test');
  evidence.clientId=clientId;
  await page.goto(url+'/dashboard/clients/'+clientId);
  const form = page.getByRole('form',{name:'Durable dry-run client pipeline'});
  await expect(form.getByRole('button',{name:'Run dry-run pipeline'})).toBeEnabled();
  await form.getByLabel('Lead score (0–100)').fill('70');
  await form.getByRole('button',{name:'Run dry-run pipeline'}).evaluate(el=>{el.click();el.click();});
  await expect(form.getByText('Paused at human approval.',{exact:false})).toBeVisible();
  assert.equal(evidence.workflowRequests.filter(r=>r.operation==='start').length,1);
  const requestId=evidence.workflowRequests.find(r=>r.operation==='start').runId;
  evidence.requestId=requestId;
  await expect(form.getByRole('button',{name:'Resume after decision'})).toBeDisabled();
  check('Double click sends one start, reaches pending gate, resume disabled');
  const gateHref=await form.getByRole('link',{name:/Review gate/}).getAttribute('href');
  const gateId=new URL(url+gateHref).searchParams.get('gateId'); evidence.gateId=gateId;
  await page.reload();
  await expect(form.getByText('Paused at human approval.',{exact:false})).toBeVisible();
  await expect(form.getByText('Saved request ID: '+requestId,{exact:false})).toBeVisible();
  assert.equal(evidence.workflowRequests.filter(r=>r.operation==='start').length,1);
  check('Reload restores identical request UUID and inspects without another start');
  await form.getByRole('link',{name:/Review gate/}).click();
  await page.locator('#gate-'+gateId).getByRole('button',{name:'Approve',exact:true}).click();
  await expect(page.locator('#gate-'+gateId)).toContainText('approved');
  await page.goto(url+'/dashboard/clients/'+clientId);
  await expect(form.getByRole('button',{name:'Resume after decision'})).toBeEnabled();
  await expect(form.getByText('approved',{exact:false})).toBeVisible();
  await form.getByRole('button',{name:'Resume after decision'}).click();
  await expect(form.getByText('Workflow completed.',{exact:false})).toBeVisible();
  await expect(page.getByText('onboard · score 70',{exact:true})).toBeVisible();

  await expect(form.getByRole('button',{name:'Start new run with this score'})).toHaveCount(0);
  check('Approval receipt then real engine resume; no same-Client new-run control');
  const forbidden = await page.evaluate(async ({clientId,runId}) => {
   const r=await fetch('/api/clients/'+clientId+'/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'start',runId,leadScore:45})});return r.status;
  },{clientId,runId:randomUUID()});
  assert.equal(forbidden,409); check('New identity for completed Client rejected by backend');
  const deniedClient = await fixture('Example Browser Denied','denied@example.test');
  await page.goto(url+'/dashboard/clients/'+deniedClient);
  await expect(form.getByRole('button',{name:'Run dry-run pipeline'})).toBeEnabled();
  await form.getByLabel('Lead score (0–100)').fill('45');
  await form.getByRole('button',{name:'Run dry-run pipeline'}).click();
  await expect(form.getByText('Paused at human approval.',{exact:false})).toBeVisible();
  const deniedGateHref=await form.getByRole('link',{name:/Review gate/}).getAttribute('href');
  const deniedGateId=new URL(url+deniedGateHref).searchParams.get('gateId');
  await form.getByRole('link',{name:/Review gate/}).click();
  await page.locator('#gate-'+deniedGateId).getByRole('button',{name:'Deny',exact:true}).click();
  await expect(page.locator('#gate-'+deniedGateId)).toContainText('denied');
  await page.goto(url+'/dashboard/clients/'+deniedClient);
  await expect(form.getByRole('button',{name:'Resume after decision'})).toBeEnabled();
  await form.getByRole('button',{name:'Resume after decision'}).click();
  await expect(form.getByText('Workflow completed.',{exact:false})).toBeVisible();
  check('Second synthetic Client denial and engine resume with zero effect');
  const retryClient=await fixture('Example Browser Retry','retry@example.test');
  await page.goto(url+'/dashboard/clients/'+retryClient);
  let lost=false;
  await page.route('**/api/clients/'+retryClient+'/workflow',async route=>{
    const body=route.request().postDataJSON();
    if(body.operation==='start'&&!lost){lost=true;await route.fetch();return route.abort();}
    return route.continue();
  });
  await expect(form.getByRole('button',{name:'Run dry-run pipeline'})).toBeEnabled();
  await form.getByRole('button',{name:'Run dry-run pipeline'}).click();
  await expect(form.getByRole('alert')).toBeVisible();
  const lostRequest=evidence.workflowRequests.filter(r=>r.operation==='start').at(-1);
  await form.getByRole('button',{name:'Retry same run'}).click();
  await expect(form.getByText('Paused at human approval.',{exact:false})).toBeVisible();
  assert.deepEqual(evidence.workflowRequests.filter(r=>r.operation==='start').at(-1),lostRequest);
  await page.reload();await expect(form.getByText('Saved request ID: '+lostRequest.runId,{exact:false})).toBeVisible();
  check('Committed start with lost browser response retries and reloads same UUID');
  const failedGateHref=await form.getByRole('link',{name:/Review gate/}).getAttribute('href');
  const failedGateId=new URL(url+failedGateHref).searchParams.get('gateId');
  const injected = await db.collection('policygates').updateOne({_id: new ObjectId(failedGateId), tenantId:'tenant-default'}, {$set:{status:'approved',effectStatus:'failed',effectRan:false}});
  assert.equal(injected.modifiedCount, 1);
  await form.getByRole('button',{name:'Inspect saved run'}).click();
  await expect(form.getByText('resume blocked',{exact:false})).toBeVisible();
  await expect(form.getByRole('button',{name:'Resume after decision'})).toBeDisabled();
  await form.getByRole('link',{name:/Review gate/}).click();
  await page.locator('#gate-'+failedGateId).getByRole('button',{name:'Recover dry run',exact:true}).click();
  await expect(page.locator('#gate-'+failedGateId)).toContainText('succeeded');
  await page.goto(url+'/dashboard/clients/'+retryClient);
  await expect(form.getByRole('button',{name:'Resume after decision'})).toBeEnabled();
  await form.getByRole('button',{name:'Resume after decision'}).click();
  await expect(form.getByText('Workflow completed.',{exact:false})).toBeVisible();
  check('Approved without receipt blocked; explicit recovery records receipt before resume');
  const countBefore=evidence.workflowRequests.filter(r=>r.operation==='start').length;
  const savedStorage = await page.evaluate(()=>Object.entries(localStorage));
  await page.evaluate(()=>localStorage.clear());
  await form.getByRole('button',{name:'Inspect saved run'}).click();
  await expect(form.getByRole('alert')).toContainText('removed');
  await form.getByRole('button',{name:'Retry same run'}).click();
  await expect(form.getByRole('alert')).toContainText('another tab');
  await expect(form).toHaveAttribute('aria-busy', 'false');
  assert.equal(evidence.workflowRequests.filter(r=>r.operation==='start').length,countBefore);
  check('Removed storage cannot create a replacement identity');
  assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.externalRequests,[]);
  await page.evaluate(entries => { for (const [key,value] of entries) localStorage.setItem(key,value); }, savedStorage);
  await page.goto(url+'/dashboard/clients/'+clientId);
  await expect(form.getByText('Workflow completed.',{exact:false})).toBeVisible();
  return { clientIds: [clientId, deniedClient, retryClient], page };

}
