const express = require('express');
const { chromium } = require('playwright');
const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS (frontend dilayani Cloudflare; proxy juga jalan, ini untuk jaga-jaga)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check (Render ping + cold-start wake)
app.get('/', (req, res) => res.json({ ok: true, service: 'laz-checker-backend' }));
app.get('/health', (req, res) => res.json({ ok: true }));

// Cache browser per-proxy (key 'default' = tanpa proxy)
const browsers = {};
function parseProxy(str){
  if(!str) return null;
  let s = String(str).trim();
  if(!s) return null;
  if(!/^\w+:\/\//.test(s)) s = 'http://' + s;
  try{
    const u = new URL(s);
    const out = { server: u.protocol + '//' + u.host };
    if(u.username) out.username = decodeURIComponent(u.username);
    if(u.password) out.password = decodeURIComponent(u.password);
    return out;
  }catch(e){ return null; }
}
async function getBrowser(proxyObj){
  const key = proxyObj ? proxyObj.server + '|' + (proxyObj.username||'') : 'default';
  if(!browsers[key] || !browsers[key].isConnected()){
    const opts = { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage'] };
    if(proxyObj) opts.proxy = proxyObj;
    browsers[key] = await chromium.launch(opts);
  }
  return browsers[key];
}

app.post('/api/lazada/check', async (req, res) => {
  const { uid, password, useProxy, proxy } = req.body || {};
  if(!uid || !password) return res.json({ uid, status:'ERROR', catatan:'uid/password kosong' });
  const proxyObj = (useProxy && proxy) ? parseProxy(proxy) : null;
  if(useProxy && proxy && !proxyObj) return res.json({ uid, status:'ERROR', catatan:'Format proxy tidak valid' });
  let ctx;
  try{
    const b = await getBrowser(proxyObj);
    ctx = await b.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
    const page = await ctx.newPage();
    let apiResp = null;
    page.on('response', async (r) => {
      try {
        if (/\/user\/api\/login/.test(r.url())) {
          const txt = await r.text();
          try { apiResp = JSON.parse(txt); } catch(_) { apiResp = { _raw: String(txt).slice(0,800) }; }
        }
      } catch(e){}
    });
    await page.goto('https://member.lazada.co.id/user/login', { waitUntil:'domcontentloaded', timeout:30000 });
    await page.waitForTimeout(2500);
    const userSel = 'input[placeholder*="Phone or Email"]';
    const passSel = 'input[placeholder*="password"]';
    await page.click(userSel);
    await page.type(userSel, uid, { delay: 70 });
    await page.click(passSel);
    await page.type(passSel, password, { delay: 70 });
    await page.waitForTimeout(400);
    await page.click('button:has-text("LOGIN")');

    const deadline = Date.now() + 18000;
    let captcha = false;
    while (Date.now() < deadline) {
      const u = page.url();
      if (/\/user\/profile/.test(u) || /member-m\.lazada/.test(u)) break;
      if (apiResp) break;
      captcha = await page.evaluate(() => {
        const sel = ['.baxia-dialog','#baxia-dialog','.nc_iframe','#nc_1_n1z','.J_MIDDLEWARE_FRAME','iframe[src*="captcha"]','iframe[src*="punish"]','iframe[src*="_____tmd_____"]'];
        if (sel.some(s => document.querySelector(s))) return true;
        const t = (document.body && document.body.innerText || '').toLowerCase();
        return /geser|slide to verify|verifikasi keamanan|please slide|drag the slider/.test(t);
      }).catch(() => false);
      if (captcha) break;
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(800);

    const url = page.url();
    const respStr = apiResp ? JSON.stringify(apiResp).toLowerCase() : '';
    let status='ERROR', catatan='', nama='';
    const captchaResp = /captcha|nocaptcha|punish|x5sec|slide|iv-?token|risk|fail_sys_user_validate|need.?validate|sm-?validate|_____tmd_____/.test(respStr);
    if (captcha || captchaResp) {
      status='WARN'; catatan='Perlu verifikasi manual (captcha/risk control)';
    }
    else if (/\/user\/profile/.test(url) || /member-m\.lazada/.test(url) || /"success"\s*:\s*true/.test(respStr)) {
      status='AKTIF'; catatan='Login berhasil';
    }
    else if (/"success"\s*:\s*false/.test(respStr) || /incorrect|password.*salah|invalid|not.?registered|tidak terdaftar|frozen|banned|disabled|nonaktif|diblokir|suspend|dibekukan|account.*not.*exist/.test(respStr)) {
      status='DISABLE';
      catatan = /frozen|banned|disabled|nonaktif|diblokir|suspend|dibekukan/.test(respStr) ? 'Akun bermasalah/nonaktif' : 'Password salah / akun tidak valid';
    }
    else if (/login-signup|\/user\/login/.test(url)) {
      status='DISABLE'; catatan='Login gagal (tetap di halaman login)';
    }
    else {
      status='ERROR'; catatan='Tidak pasti, url='+url + (apiResp? ' resp='+respStr.slice(0,120):'');
    }
    res.json({ uid, status, catatan, nama });
  }catch(e){ res.json({ uid, status:'ERROR', catatan:String(e.message).slice(0,150) }); }
  finally{ try{ if(ctx) await ctx.close(); }catch(_){ } }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, ()=>console.log('LAZ backend on port ' + PORT));
