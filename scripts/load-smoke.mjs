// Bounded, unauthenticated local-only smoke load. Never targets hosted Auth.
const base = process.env.LOAD_BASE_URL || 'http://127.0.0.1:4000'
const target = new URL(base)
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('LOAD_BASE_URL must be loopback')
const paths = ['/v1/health', '/v1/jobs?limit=10', '/v1/freelancers?limit=10']
for (const path of paths) {
  const durations = []
  let next = 0
  let errors = 0
  const started = performance.now()
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < 40) {
      next++
      const tick = performance.now()
      try { const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(5000) }); if (!response.ok) errors++; await response.arrayBuffer() }
      catch { errors++ }
      durations.push(performance.now() - tick)
    }
  }))
  durations.sort((a, b) => a - b)
  const elapsed = (performance.now() - started) / 1000
  console.log(JSON.stringify({ path, requests: durations.length, concurrency: 4, rps: +(durations.length / elapsed).toFixed(1), p50Ms: +durations[Math.floor(durations.length * 0.5)].toFixed(1), p95Ms: +durations[Math.floor(durations.length * 0.95)].toFixed(1), errors }))
}
