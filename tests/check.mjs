import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire('D:/Yandex.Disk/lep-labs/30-products/1-porydok/Poryadok/package.json');
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/zahar/AppData/Local/Chromium/Application/chrome.exe'});
const origin=process.env.VIKA_URL||'http://127.0.0.1:8769/';
fs.mkdirSync('tmp/check',{recursive:true});
for(const width of [360,390,430,768,1024,1440,1920]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(origin))errors.push(r.status()+' '+r.url())});
  await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').count(),1);
  // speed switch
  await page.locator('#concept').scrollIntoViewIfNeeded();
  await page.locator('[data-set-speed="1"]').click();
  assert.equal(await page.locator('.speed').getAttribute('data-speed'),'1');
  assert.equal(await page.locator('[data-panel="1"]').isVisible(),true);
  await page.locator('[data-set-speed="1"]').press('ArrowRight');
  assert.equal(await page.locator('[data-set-speed="2"]').getAttribute('aria-pressed'),'true');
  // exclusive accordion
  await page.locator('.symptom').nth(2).locator('summary').click();
  assert.equal(await page.locator('.symptom[open]').count(),1);
  assert.match(await page.locator('.symptom[open] .truth').textContent(),/систему контроля/);
  // intent preselect from speaker CTA
  await page.locator('.speaker-actions a[data-intent="speaker"]').click();
  assert.equal(await page.locator('input[value="speaker"]').isChecked(),true);
  assert.equal(await page.locator('#f-msg-label').textContent(),'О мероприятии');
  // validation
  await page.locator('button[data-channel="telegram"]').click();
  assert.equal(await page.locator('#e-name').isVisible(),true);
  await page.locator('#f-name').fill('Анна');await page.locator('#f-contact').fill('@anna');await page.locator('#f-msg').fill('Конференция, 200 человек');
  const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('button[data-channel="telegram"]').click()]);
  assert.match(popup.url(),/t\.me\/vika_talkan/);await popup.close();
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/Приглашение выступить[\s\S]*Анна[\s\S]*200 человек/);
  // mobile menu
  if(width<=1020){await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);await page.locator('.menu-toggle').click();assert.equal(await page.locator('#mobile-nav').isVisible(),true);await page.locator('#mobile-nav a[href="#results"]').click();assert.equal(await page.locator('#mobile-nav').isVisible(),false)}
  // full scroll: reveals, counters, overflow
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=300){scrollTo(0,y);await new Promise(r=>setTimeout(r,40))}});
  await page.waitForTimeout(1800);
  assert.equal(await page.locator('.js .reveal:not(.in)').count(),0,'unrevealed blocks');
  assert.equal((await page.locator('.sales-num strong').textContent()).trim(),'49');
  for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();}
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth),null,{timeout:10000}).catch(async e=>{console.log(await page.evaluate(()=>[...document.images].map(i=>[i.currentSrc,i.complete,i.naturalWidth])));throw e});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(400);
  await page.screenshot({path:`tmp/check/${width}.png`,fullPage:false});
  assert.deepEqual(errors,[]);
  await ctx.close();console.log('ok',width);
}
// no-JS reading
const ctx=await browser.newContext({javaScriptEnabled:false});const p=await ctx.newPage();await p.goto(origin);
assert.equal(await p.locator('#results .case').nth(2).isVisible(),true);assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('.reveal')).opacity),'1');
console.log('ok no-js');await browser.close();
