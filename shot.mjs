import { chromium, devices } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ ...devices['iPhone 13'] });
const p = await c.newPage();
const base = 'http://localhost:3403';
async function go(path, file, full = false) {
  const r = await p.goto(base + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `/tmp/${file}`, fullPage: full });
  console.log(path, r.status());
}
await go('/demo', 'a.png');
await go('/demo/requests/new', 'b.png', true);
await go('/demo/requests', 'c.png');
await b.close();
