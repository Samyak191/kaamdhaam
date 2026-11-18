import { chromium } from 'playwright-core'

const base = 'http://localhost:4173'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] })
const routes = ['/', '/jobs', '/jobs/shopify-storefront', '/talent', '/talent/aarav-mehta', '/login', '/dashboard/client', '/dashboard/client/projects/new', '/dashboard/client/proposals', '/dashboard/client/milestones', '/dashboard/client/payments', '/dashboard/freelancer', '/dashboard/freelancer/earnings', '/dashboard/admin', '/dashboard/admin/users', '/dashboard/admin/reports', '/contracts/contract-active', '/messages', '/notifications']
let failed = false
for (const width of [390, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 850 }, deviceScaleFactor: 1 })
  await page.addInitScript(() => localStorage.clear())
  for (const route of routes) {
    await page.goto(base + route)
    await page.waitForTimeout(200)
    const size = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
    const overflow = Math.max(size.scroll, size.body) > size.viewport + 1
    console.log(`${width}px ${route}: viewport ${size.viewport}, scroll ${size.scroll}${overflow ? ' OVERFLOW' : ''}`)
    if (overflow) failed = true
    if (width === 390 && route === '/jobs') await page.screenshot({ path: 'tmp/qa/jobs-playwright-mobile.png' })
  }
  await page.close()
}
await browser.close()
if (failed) process.exitCode = 1
