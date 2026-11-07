// Contract test against the REAL dsh-skill module shipped inside the installed app.
//
//   node test/dsh-contract.mjs
//
// The smoke test asserts the shape we *think* DSH wants. This test loads the dsh-skill
// module straight out of the running app's app.asar, extracts its own validateRuntimeSkill /
// validateDefinition / validateInvocation source text, and runs those on our registered
// definitions. So it fails when the installed DSH version tightens a rule — which is exactly
// when a plugin would break at load time with no other warning.
//
// Requires the DeepSeek Harness app to be installed. Set DSH_ASAR to point elsewhere.
// No dependencies: the asar header is parsed by hand.
import { existsSync, readFileSync } from 'node:fs'

const ASAR = process.env.DSH_ASAR || '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
const SKILL_MODULE = '/dsh/node_modules/@deepseek-ai/dsh-skill/lib/index.js'

const checks = []
const check = (label, condition, detail = '') => {
  checks.push({ label, ok: Boolean(condition), detail })
  if (!condition) console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  else console.log(`ok    ${label}`)
}

/** Minimal asar reader: header is a pickle of uint32s followed by JSON. */
function readAsarEntry(asarPath, entryPath) {
  const fd = readFileSync(asarPath)
  const headerJsonLength = fd.readUInt32LE(12)
  const headerSize = fd.readUInt32LE(8)
  const dataStart = 8 + headerSize
  const header = JSON.parse(fd.subarray(16, 16 + headerJsonLength).toString('utf8'))
  let node = header
  for (const part of entryPath.split('/').filter(Boolean)) {
    node = node.files?.[part]
    if (!node) throw new Error(`asar entry not found: ${entryPath}`)
  }
  const offset = Number(node.offset)
  const size = Number(node.size)
  return fd.subarray(dataStart + offset, dataStart + offset + size).toString('utf8')
}

// This suite can only run where DeepSeek Harness is actually installed. CI runners have no
// app.asar, so skip there — loudly, and exit 0 so the rest of `npm test` stays meaningful.
// A corrupt or partially readable asar still fails hard below.
if (!existsSync(ASAR)) {
  console.log(`SKIP  dsh-contract: no DeepSeek Harness build at ${ASAR}`)
  console.log('      Set DSH_ASAR to the app.asar of an installed build to run this suite.')
  process.exit(0)
}

let source
try {
  source = readAsarEntry(ASAR, SKILL_MODULE)
} catch (error) {
  console.error(`cannot read dsh-skill from ${ASAR}: ${error.message}`)
  console.error('Set DSH_ASAR to the app.asar of an installed DeepSeek Harness build.')
  process.exit(1)
}

/** Pull one function/const declaration out of the shipped module by brace matching. */
function extractDeclaration(text, startPattern) {
  const match = startPattern.exec(text)
  if (!match) return undefined
  const start = match.index
  if (match[0].trimEnd().endsWith(';')) return match[0]
  // Walk to the matching closing brace of the function body.
  let depth = 0
  let seenBrace = false
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') {
      depth += 1
      seenBrace = true
    } else if (ch === '}') {
      depth -= 1
      if (seenBrace && depth === 0) return text.slice(start, i + 1)
    }
  }
  return undefined
}

const parts = {
  skillName: extractDeclaration(source, /const SKILL_NAME = [^\n]+;/),
  runtimeProvider: extractDeclaration(source, /const RUNTIME_PROVIDER = [^\n]+;/),
  validateInvocation: extractDeclaration(source, /function validateInvocation\(/),
  validateRuntimeSkill: extractDeclaration(source, /function validateRuntimeSkill\(/),
  validateDefinition: extractDeclaration(source, /function validateDefinition\(/),
}
check('found dsh-skill validators in the installed app', Object.values(parts).every(Boolean), Object.entries(parts).filter(([, v]) => !v).map(([k]) => k).join(', '))
if (Object.values(parts).some((v) => !v)) {
  console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} checks passed`)
  process.exit(1)
}

const factory = new Function(
  `${parts.skillName}\n${parts.runtimeProvider}\n${parts.validateInvocation}\n${parts.validateRuntimeSkill}\n${parts.validateDefinition}\nreturn { validateRuntimeSkill, validateDefinition, RUNTIME_PROVIDER }`,
)
const { validateRuntimeSkill, validateDefinition, RUNTIME_PROVIDER } = factory()

const mod = await import(new URL('../index.js', import.meta.url).href)
const registered = []
mod.apply({ skills: { register: (skill) => { registered.push(skill); return () => {} } }, logger: { warn() {}, info() {}, error() {} } })

for (const skill of registered) {
  // register() fills these two defaults before it validates, so mirror that.
  const filled = {
    ...skill,
    invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
    provider: skill.provider ?? RUNTIME_PROVIDER,
  }
  let registrationError = ''
  try {
    validateRuntimeSkill(filled)
  } catch (error) {
    registrationError = error.message
  }
  check(`${skill.name}: passes dsh-skill validateRuntimeSkill()`, registrationError === '', registrationError)

  let loadError = ''
  try {
    validateDefinition(filled)
  } catch (error) {
    loadError = error.message
  }
  check(`${skill.name}: passes dsh-skill validateDefinition()`, loadError === '', loadError)
}

// A definition that the installed validator must reject — proves the harness is really running
// the shipped rules and not a no-op copy of our own optimism.
let rejected = false
try {
  validateDefinition({ name: 'Bad Name', description: 'x', source: 'plugin', provider: 'runtime', content: 'y' })
} catch {
  rejected = true
}
check('installed validator rejects an invalid name (harness is live)', rejected)

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed against dsh ${SKILL_MODULE}`)
if (failed.length > 0) process.exit(1)
