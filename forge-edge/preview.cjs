const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390,320]){
   const page=await browser.newPage({viewport:{width,height:900}});let online=false;
   await page.route('https://tetheredunicorn.com/assets/unicorn-logo.webp',r=>r.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(__dirname,'../assets/unicorn-logo.webp'))}));
   await page.route('https://forge.tetheredunicorn.com/**',r=>r.fulfill({status:online?200:503,contentType:'text/html',body:online?'<h1>Forge is available</h1>':fs.readFileSync(path.join(__dirname,'unavailable.html'),'utf8')}));
   await page.goto('https://forge.tetheredunicorn.com/');
   await page.locator('img').evaluate(img=>img.decode());
   assert(await page.getByRole('heading',{name:'A brief pause at the Forge.'}).isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   fs.mkdirSync(path.join(__dirname,'../preview-output'),{recursive:true});
   await page.screenshot({path:path.join(__dirname,`../preview-output/forge-unavailable-${width}.png`),fullPage:true});
   online=true;await page.getByRole('link',{name:'Try Forge again'}).click();
   assert(await page.getByRole('heading',{name:'Forge is available'}).isVisible());
   await page.close();
  }
  console.log('PASS: fallback layout at 1440, 390 and 320px; retry returns to recovered Forge.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
