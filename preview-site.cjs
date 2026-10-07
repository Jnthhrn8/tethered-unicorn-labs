const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = __dirname, out = path.join(root, 'preview-output');
  fs.mkdirSync(out, { recursive: true });
  const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg' };
  let server, browser;
  const results = [];
  try {
    let base = process.env.PREVIEW_BASE_URL;
    if (!base) {
      server = http.createServer((req, res) => {
        const target = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!target.startsWith(root + path.sep) && target !== root) { res.writeHead(403).end(); return; }
        const file = target === root ? path.join(root, 'index.html') : target;
        fs.readFile(file, (error, data) => {
          if (error) { res.writeHead(404).end(); return; }
          res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data);
        });
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${server.address().port}/`;
    }
    browser = await chromium.launch({ headless: true });
    const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
    for (const width of [1440, 390, 320]) for (const file of pages) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(new URL(file, base).href, { waitUntil: 'networkidle' });
      // Exercise below-the-fold images before checking image delivery.
      for (const lazy of await page.locator('img[loading="lazy"]').all()) {
        await lazy.scrollIntoViewIfNeeded();
        await lazy.evaluate(img => img.decode());
      }
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').textContent(), 'Skip to content', `${file}: first focus`);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'main', `${file}: skip target`);
      const menu = page.locator('.menu-button');
      if (await menu.count() && await menu.isVisible()) {
        await menu.click(); assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        await page.locator('#site-nav a').first().focus(); await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      }
      const findings = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return { title: document.title, scrollWidth: document.documentElement.scrollWidth, width,
          overflow: [...document.querySelectorAll('h1,h2,p,article,a,button,img')].filter(e => {
            const r=e.getBoundingClientRect(), c=getComputedStyle(e);
            return r.width>0 && c.visibility!=='hidden' && (r.right>width+2 || r.left < -2) && !e.classList.contains('skip-link');
          }).map(e=>`${e.tagName}.${e.className}`).slice(0,15),
          brokenImages: [...document.images].filter(i=>!i.complete || !i.naturalWidth).map(i=>i.src),
          missingAlt: [...document.images].filter(i=>!i.hasAttribute('alt')).length,
          h1: document.querySelectorAll('h1').length,
          canonical: document.querySelector('link[rel=canonical]')?.href,
          brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash)
        };
      });
      assert.equal(findings.h1,1,file); assert.equal(findings.missingAlt,0,file);
      assert.deepEqual(findings.brokenImages,[],file); assert.deepEqual(findings.brokenAnchors,[],file);
      assert.deepEqual(errors,[],file); results.push({file,width,...findings});
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({ path:path.join(out,`${file.replace('.html','')}-${width}.png`), fullPage:true });
      await page.close();
    }
    const context = await browser.newContext({ permissions: ['clipboard-read','clipboard-write'] });
    const contact = await context.newPage(); await contact.goto(new URL('contact.html?topic=sponsor',base).href);
    assert.match(await contact.locator('#contact-email').getAttribute('href'), /subject=Sponsorship/);
    await contact.locator('[data-copy]').first().click();
    await contact.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('copied.'));
    await contact.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied');}},configurable:true}));
    await contact.locator('[data-copy]').first().click();
    await contact.waitForFunction(()=>document.querySelector('#copy-status').textContent.includes('Copy is unavailable'));
    await contact.goto(new URL('contact.html?topic=pilot',base).href);
    assert.match(await contact.locator('#contact-email').getAttribute('href'), /subject=2027%20software%20pilot/);
    assert.match(await contact.locator('#contact-whatsapp').getAttribute('href'), /2027%20software%20pilot/);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    const overflow=results.filter(r=>r.overflow.length || r.scrollWidth>r.width);
    console.log(JSON.stringify({checks:results.length,contact:'success and denied clipboard checked',overflow},null,2));
    assert.equal(overflow.length,0,'Responsive overflow detected');
  } finally {
    await browser?.close(); if(server) await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
