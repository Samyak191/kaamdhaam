import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'

await mkdir('tmp/qa', { recursive: true })
const out = resolve('tmp/qa/service-flow.test.mjs')
await build({ entryPoints: ['scripts/service-flow.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent' })
await import(pathToFileURL(out).href)
