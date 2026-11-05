// Smoke test for the plugin layer: mount it against a fake registry and check the contract.
//
//   node test/smoke.mjs        (Node 22+; DSH bundles one at
//                               ~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node)
//
// No framework, no dependencies. It proves the module exports what cordis expects, that every
// skill registered carries a valid runtime definition, that the Apache-2.0 attribution is
// present, and that no skill promises a host capability (hooks, stored mode, measured savings)
// that DSH does not have.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const mod = await import(new URL('../index.js', import.meta.url).href)

const checks = []
const check = (label, condition, detail = '') => {
  checks.push({ label, ok: Boolean(condition), detail })
  if (!condition) console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  else console.log(`ok    ${label}`)
}

check('exports a plugin name', typeof mod.name === 'string' && mod.name.length > 0, String(mod.name))
check('injects the skills service', Array.isArray(mod.inject) && mod.inject.includes('skills'))
check('exports apply()', typeof mod.apply === 'function')
check('exports the catalog contract', Array.isArray(mod.catalog) && mod.catalog.length > 0)

const registered = []
const ctx = {
  skills: { register: (skill) => { registered.push(skill); return () => {} } },
  logger: { warn: console.warn, info: () => {}, error: console.error },
}

mod.apply(ctx)

const EXPECTED = ['caveman', 'ultracave', 'megacave', 'caveman-commit', 'caveman-review', 'caveman-help', 'caveman-stats']
check('registers every caveman skill', registered.length === EXPECTED.length, `got ${registered.length}`)
for (const name of EXPECTED) {
  check(`registers ${name}`, registered.some((s) => s.name === name))
}
check('skill names are kebab-case', registered.every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.name ?? '')))
check(
  'descriptions fit the 500-char catalog cap',
  registered.every((s) => typeof s.description === 'string' && s.description.length > 0 && s.description.length <= 500),
  registered.map((s) => `${s.name}:${s.description?.length ?? 0}`).join(' '),
)
check('whenToUse present', registered.every((s) => typeof s.whenToUse === 'string' && s.whenToUse.length > 0))
check(
  'source is a non-empty string (load-time requirement)',
  registered.every((s) => typeof s.source === 'string' && s.source.length > 0),
)
check(
  'invocation policy is valid',
  registered.every(
    (s) =>
      s.invocation === undefined ||
      (typeof s.invocation === 'object' &&
        s.invocation !== null &&
        typeof s.invocation.modelInvocable === 'boolean' &&
        typeof s.invocation.userInvocable === 'boolean'),
  ),
)
check(
  'only the explicit modes are user-only',
  registered
    .filter((s) => s.invocation?.modelInvocable === false)
    .map((s) => s.name)
    .sort()
    .join(',') === 'megacave,ultracave',
)

for (const skill of registered) {
  const content = skill.content ?? ''
  const base = skill.resourceBase
  check(`${skill.name}: content is the SKILL.md body`, typeof content === 'string' && content.length > 200 && !content.startsWith('---'), String(content.slice(0, 40)))
  check(`${skill.name}: frontmatter stripped`, !content.startsWith('---'))
  check(`${skill.name}: DSH runtime note appended`, content.includes('## DSH runtime (DeepSeek Harness)'))
  check(`${skill.name}: note names the resource directory`, content.includes(base?.path ?? '\u0000'))
  check(`${skill.name}: attribution present`, content.includes('Apache-2.0') && content.includes('JuliusBrussee/caveman'))
  check(`${skill.name}: resourceBase is a directory of this package`, base?.kind === 'directory' && base.path.startsWith(root))
  check(`${skill.name}: resource base exists`, Boolean(base?.path) && existsSync(base.path) && statSync(base.path).isDirectory())
  check(`${skill.name}: SKILL.md ships with the payload`, existsSync(join(base?.path ?? '', 'SKILL.md')))
}

const voice = registered.find((s) => s.name === 'caveman')?.content ?? ''
check('voice skill says mode is not stored', voice.includes('Mode is conversational here, not stored'))
check('voice skill marks status as untracked', voice.includes('(not tracked by this host)'))
check('stats skill refuses to invent savings', (registered.find((s) => s.name === 'caveman-stats')?.content ?? '').includes('Savings stay unknown'))
// The upstream bodies talk about Claude Code hooks; that is fine as long as the note this port
// APPENDS does not promise a hook. Only the appended section is under our control.
check(
  'the appended note never claims a hook this host lacks',
  registered.every((s) => {
    const content = s.content ?? ''
    const note = content.slice(content.indexOf('## DSH runtime (DeepSeek Harness)'))
    return note.length > 0 && !/hookSpecificOutput|the hook supplies|hook will/.test(note)
  }),
)

// Mirror dsh-skill's LOAD-time validation on the definition the registry stores.
const loadProblems = []
for (const skill of registered) {
  const def = { ...skill, invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true }, provider: skill.provider ?? 'runtime' }
  if (typeof def.name !== 'string') loadProblems.push(`${skill.name}:name`)
  if (typeof def.description !== 'string' || def.description.length === 0) loadProblems.push(`${skill.name}:description`)
  if (typeof def.source !== 'string') loadProblems.push(`${skill.name}:source`)
  if (typeof def.provider !== 'string') loadProblems.push(`${skill.name}:provider`)
  if (typeof def.content !== 'string') loadProblems.push(`${skill.name}:content`)
}
check('passes dsh-skill load-time validation (source / provider / content)', loadProblems.length === 0, loadProblems.join(', '))

// Licensing: Apache-2.0 text + NOTICE must ship, and the manifest must say Apache-2.0.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
check('package declares Apache-2.0', pkg.license === 'Apache-2.0', pkg.license)
check('LICENSE ships', existsSync(join(root, 'LICENSE')))
check('LICENSE is the Apache-2.0 text', readFileSync(join(root, 'LICENSE'), 'utf8').includes('Apache License'))
check('NOTICE ships', existsSync(join(root, 'NOTICE')))
check('NOTICE states the modifications', readFileSync(join(root, 'NOTICE'), 'utf8').includes('state changes'))
check('upstream pin recorded', typeof pkg.caveman?.upstreamCommit === 'string' && pkg.caveman.upstreamCommit.length === 40)

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) process.exit(1)
