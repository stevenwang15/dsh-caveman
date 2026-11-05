// Gate test for the caveman-compress helper.
//
//   node test/compress-gate.mjs
//
// Feeds scripts/verify-compress.mjs a safe compression and several unsafe ones, so the gate
// that stands between a memory file and its overwrite is proven to actually reject.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const gate = join(root, 'skills', 'caveman-compress', 'scripts', 'verify-compress.mjs')
const dir = mkdtempSync(join(tmpdir(), 'caveman-compress-'))

const checks = []
const check = (label, condition, detail = '') => {
  checks.push({ label, ok: Boolean(condition), detail })
  if (!condition) console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  else console.log(`ok    ${label}`)
}

const original = `# Project rules

You should always make sure to run the test suite before pushing any changes to the main branch.
This is important because it helps catch bugs early. However, you should never skip the lint step.

## Commands

Use \`npm run test\` and \`npm run lint\`. Docs live at https://example.com/docs and the config is
at \`./config/app.yaml\`.

\`\`\`bash
npm run test -- --watch=false
\`\`\`

Do not commit secrets. Set $NODE_ENV before running.
`
const safe = `# Project rules

Run tests before push to main. Catch bugs early. Never skip lint.

## Commands

Use \`npm run test\` and \`npm run lint\`. Docs live at https://example.com/docs and the config is
at \`./config/app.yaml\`.

\`\`\`bash
npm run test -- --watch=false
\`\`\`

Do not commit secrets. Set $NODE_ENV before running.
`
const write = (name, text) => {
  const path = join(dir, name)
  writeFileSync(path, text)
  return path
}
const run = (a, b) => {
  try {
    const out = execFileSync(process.execPath, [gate, a, b], { encoding: 'utf8' })
    return { ok: true, out }
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

const originalPath = write('AGENTS.md', original)

const safeResult = run(originalPath, write('AGENTS.safe.md', safe))
check('accepts a safe compression', safeResult.ok, safeResult.out.split('\n').slice(0, 3).join(' | '))
check('reports byte delta', /-\d+/.test(safeResult.out), safeResult.out.split('\n')[0])

const codeBroken = run(originalPath, write('AGENTS.code-broken.md', safe.replace('--watch=false', '--watch')))
check('rejects a changed code block', !codeBroken.ok, codeBroken.out.split('\n')[1] ?? '')

const headingLost = run(originalPath, write('AGENTS.heading-lost.md', safe.replace('## Commands\n\n', '')))
check('rejects a dropped heading', !headingLost.ok, headingLost.out.split('\n')[1] ?? '')

const urlLost = run(originalPath, write('AGENTS.url-lost.md', safe.replace('https://example.com/docs', 'the docs')))
check('rejects a dropped URL', !urlLost.ok, urlLost.out.split('\n')[1] ?? '')

const negationLost = run(originalPath, write('AGENTS.negation-lost.md', safe.replace('Never skip lint', 'Skip lint')))
check('rejects a dropped negation', !negationLost.ok, negationLost.out.split('\n')[1] ?? '')

const envLost = run(originalPath, write('AGENTS.env-lost.md', safe.replace('$NODE_ENV', 'the env')))
check('rejects a dropped env var', !envLost.ok, envLost.out.split('\n')[1] ?? '')

const bigger = run(originalPath, write('AGENTS.bigger.md', `${safe}\n\n${'padding '.repeat(200)}`))
check('rejects a file that did not shrink', !bigger.ok, bigger.out.split('\n')[1] ?? '')

check('original untouched by every run', readFileSync(originalPath, 'utf8') === original)

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} gate checks passed`)
if (failed.length > 0) process.exit(1)
