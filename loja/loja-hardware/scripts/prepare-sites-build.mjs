import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const distDir = resolve(projectRoot, 'dist')
const clientDir = resolve(distDir, 'client')
const serverDir = resolve(distDir, 'server')

await rm(clientDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
await rm(serverDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
await mkdir(clientDir, { recursive: true })

for (const entry of await readdir(distDir, { withFileTypes: true })) {
  if (entry.name === '.openai' || entry.name === 'client' || entry.name === 'server') continue
  await rename(resolve(distDir, entry.name), resolve(clientDir, entry.name))
}

await mkdir(serverDir, { recursive: true })
const workerTemplate = await readFile(resolve(projectRoot, 'sites', 'worker.js'), 'utf8')
const spaShellHtml = await readFile(resolve(clientDir, 'index.html'), 'utf8')
const spaShellMarker = 'const SPA_SHELL_HTML = null'

if (!workerTemplate.includes(spaShellMarker)) {
  throw new Error('O marcador do shell da SPA não foi encontrado no Worker.')
}

await writeFile(
  resolve(serverDir, 'index.js'),
  workerTemplate.replace(spaShellMarker, `const SPA_SHELL_HTML = ${JSON.stringify(spaShellHtml)}`),
  'utf8',
)

const wranglerConfig = {
  name: 'kicks-store',
  main: 'index.js',
  compatibility_date: '2026-05-15',
  compatibility_flags: ['nodejs_compat'],
  no_bundle: true,
  rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
  assets: {
    directory: '../client',
    binding: 'ASSETS',
    html_handling: 'none',
    not_found_handling: 'single-page-application',
    run_worker_first: true,
  },
  observability: { enabled: true },
}

await writeFile(
  resolve(serverDir, 'wrangler.json'),
  `${JSON.stringify(wranglerConfig, null, 2)}\n`,
  'utf8',
)
