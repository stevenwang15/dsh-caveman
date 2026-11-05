// dsh-caveman — DeepSeek Harness plugin layer.
//
// Registers the caveman skill family as native DSH skills:
//   output      caveman / ultracave / megacave / caveman-commit / caveman-review / caveman-help / caveman-stats
//   compression caveman-compress (rewritten for DSH: no Python, no external endpoint)
//   native      investigate-first / lean-build / migration / safe-refactor / surgical-patch / verify-and-stop
//
// Upstream SKILL.md bodies ship verbatim under skills/<name>/ and are licensed Apache-2.0
// (see LICENSE + NOTICE). caveman-compress is the one adapted file; its header says so.
// Everything DSH-specific in this file is APPENDED to a body at load time under a clearly
// marked "DSH runtime" section, so upstream text stays byte-identical and can be re-synced by
// replacing skills/*/SKILL.md.
//
// Why a note at all: upstream's skills assume a host with hooks and a task classifier that
// persist the active mode and enforce workflow guardrails. DSH has neither, so the note states
// the facts the model would otherwise guess wrong instead of pretending the host has them.

import { readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'caveman'
export const inject = ['skills']

const SKILLS_DIR = fileURLToPath(new URL('./skills/', import.meta.url)).replace(/[\\/]+$/, '')
const NATIVE_CORE = join(SKILLS_DIR, 'native-core.md')

/**
 * The catalog contract, one entry per skill.
 *
 * `description` is what the model sees in the skill catalog (dsh-tool-skill caps it at 500
 * chars — the smoke test guards that). `whenToUse` is the routing hint. `invocation` mirrors
 * upstream's `disable-model-invocation: true` on the two extreme modes: the model may not reach
 * for them on its own, only the user can.
 */
const SKILLS = [
  // ---------------------------------------------------------------- output suite
  {
    name: 'caveman',
    suite: 'output',
    description:
      'Terse caveman voice for chat output: answer first, ceremony gone, every technical fact kept. Use for "/caveman", "caveman mode", "talk like caveman", "be brief", "less tokens". Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user asks for shorter, terser replies or fewer tokens, invokes /caveman, or says the answers are too verbose. Code, commands, paths, numbers and error strings stay verbatim.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'ultracave',
    suite: 'output',
    description:
      'Caveman at maximum compression: fragments, one word when one word is enough, each fact once. Invoke only with /ultracave or /caveman ultra. Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user explicitly asks for maximum compression with /ultracave or /caveman ultra. The model must not pick this mode on its own.',
    invocation: { modelInvocable: false, userInvocable: true },
  },
  {
    name: 'megacave',
    suite: 'output',
    description:
      'Caveman in Classical Chinese: 文言文 register, fewer characters on screen, technical terms verbatim. Invoke only with /megacave or /caveman wenyan. Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user explicitly asks for 文言文 compression with /megacave or /caveman wenyan. The model must not pick this mode on its own.',
    invocation: { modelInvocable: false, userInvocable: true },
  },
  {
    name: 'caveman-commit',
    suite: 'output',
    description:
      'Write a Conventional Commits message compressed to intent only: imperative subject, why over what, no AI attribution. Use for "write a commit", "commit message", /caveman-commit.',
    whenToUse: 'The user asks for a commit message, invokes /caveman-commit, or asks to commit the change.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-review',
    suite: 'output',
    description:
      'Compressed code review: one line per finding with location, problem and fix. Use for /caveman-review, "review this PR", "review the diff".',
    whenToUse: 'The user asks to review a diff, PR or patch and wants terse, actionable findings.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-help',
    suite: 'output',
    description:
      'Quick-reference card for the caveman skills, their commands and how to switch modes. Trigger: /caveman-help or "caveman help".',
    whenToUse: 'The user asks what caveman commands exist, or how to turn it on or off.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-stats',
    suite: 'output',
    description:
      'Report token usage for the current DSH session honestly: point at the host usage view, state that caveman-specific savings are unmeasured. Trigger: /caveman-stats.',
    whenToUse: 'The user asks how many tokens caveman saved, or wants usage numbers for the current session.',
    invocation: { modelInvocable: true, userInvocable: true },
  },

  // ---------------------------------------------------------- compression suite
  {
    name: 'caveman-compress',
    suite: 'compression',
    description:
      'Compress a memory or instruction file (AGENTS.md, CLAUDE.md, todo list) into caveman prose to save input tokens, keeping a readable backup outside the source tree. Refuses secrets and code files. Trigger: /caveman-compress <filepath>.',
    whenToUse:
      'The user asks to compress, shrink or caveman-ify a memory/instruction file or todo list, or invokes /caveman-compress.',
    invocation: { modelInvocable: true, userInvocable: true },
  },

  // ------------------------------------------------------------ native suite
  {
    name: 'investigate-first',
    suite: 'native',
    description:
      'Diagnose ambiguous failures before editing: separate symptom from cause, rank evidence-backed hypotheses, name the cause or the exact blocker before any edit. Use for unknown causes, intermittent behavior, performance regressions.',
    whenToUse:
      'A failure has an ambiguous cause, or the user asks to investigate, diagnose or reproduce something before changing code.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'lean-build',
    suite: 'native',
    description:
      'Build feature work with high overbuilding risk: reuse what exists, keep scope strict, state an explicit stop condition, avoid speculative abstraction. Use for new behavior, product slices, integrations.',
    whenToUse:
      'The user asks to build a new feature or integration where scope creep is the main risk.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'migration',
    suite: 'native',
    description:
      'Implement reversible, compatibility-safe transitions: map current readers/writers, data shape, compatibility window and ownership before editing; prove rollback. Use for schema, data, API, protocol, config or dependency migrations.',
    whenToUse:
      'The change is a migration of schema, data, API, protocol, configuration or a dependency, and rollback must be provable.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'safe-refactor',
    suite: 'native',
    description:
      'Restructure code while preserving behavior: bracket structural edits with verification, keep the diff reviewable, prove the same behavior after. Use for extraction, consolidation, ownership moves, cleanup.',
    whenToUse:
      'The user asks to refactor, extract, consolidate or clean up code and behavior must stay identical.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'surgical-patch',
    suite: 'native',
    description:
      'Fix bugs and small behavior changes at the narrowest responsible layer, with regression proof and preserved surrounding behavior. Use when the fix location is contested or the blast radius matters.',
    whenToUse:
      'The user asks for a bug fix or a small behavior change where a wide diff would be a defect.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'verify-and-stop',
    suite: 'native',
    description:
      'Prove existing work meets its acceptance conditions without expanding scope: run the focused gate, report evidence, stop. Use for validation-only tasks, completion checks, last-mile proof.',
    whenToUse:
      'The user asks to verify, check, validate or prove that work is done, without asking for more changes.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
]

const SKILL_MD = 'SKILL.md'

function skillDir(skillName) {
  return join(SKILLS_DIR, skillName)
}

function present(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---')) return markdown
  const end = markdown.indexOf('\n---', 3)
  return end === -1 ? markdown : markdown.slice(end + 4).trimStart()
}

/** Everything the model would otherwise guess wrong about this host. */
function runtimeNote(entry) {
  const dir = skillDir(entry.name).split(sep).join('/')
  const lines = [
    '---',
    '',
    '## DSH runtime (DeepSeek Harness)',
    '',
    "This skill runs inside DeepSeek Harness. The facts below replace guessing about the host; they do not change the skill's rules.",
    '',
    `- **This skill's folder.** \`${dir}\`. Resolve any relative path in the text above against it. Your working directory is the session workspace, not this folder.`,
  ]

  if (entry.suite === 'output' && ['caveman', 'ultracave', 'megacave'].includes(entry.name)) {
    lines.push(
      '- **Mode is conversational here, not stored.** This host has no caveman hook. Once this skill is loaded the voice stays on until the user says "stop caveman" / "normal mode", switches mode, or the session ends. Never read or write a mode file, flag, env var or transcript: there is none.',
      '- **Status answers.** For `/caveman status`, report the mode the conversation was last following (or `off` if caveman was never active), then append `(not tracked by this host)`. Loading a skill to answer status is not activation.',
      '- **Switching.** `/caveman` = this skill, `/ultracave` (alias `/caveman ultra`) = `ultracave`, `/megacave` (alias `/caveman wenyan`) = `megacave`. Confirm a switch-off in one line.',
      '- **Chat output only.** The voice applies to the reply text. Files, commits, docs, issues and PRs you write keep their own register — see "When to break the rules".',
    )
  } else if (entry.name === 'caveman-stats') {
    lines.push(
      '- **No hook, no transcript reader.** This host does not run a caveman-mode tracker and does not expose a caveman-specific usage command. Do not invent token counts, percentages, dollars or a "saved" figure.',
      '- **Where the host does show usage.** DSH surfaces per-session token usage in its own usage/session UI (and in whatever usage plugin the user has installed). Point the user there instead of computing numbers yourself. Read the panel only if the user asks you to and the numbers are actually visible; never recompute or re-round them.',
      '- **Savings stay unknown.** There is no measured caveman/plain comparison on this host. Say so in one line. A shorter answer is not evidence of a measured saving.',
    )
  } else if (entry.suite === 'compression') {
    lines.push(
      '- **Local model, no endpoint.** The rewrite is done by the model already running this session. Do not call the `claude` CLI, an API, or any external endpoint; do not read an API key. No file content leaves the machine for this.',
      '- **Backup outside the source tree.** Write the untouched original to `.caveman/backups/<relative path>.original.md` in the workspace before overwriting. Never place `<name>.original.md` next to `<name>`: agents auto-read instruction files and would ingest it.',
      '- **Gate before overwrite.** Run `node <this skill dir>/scripts/verify-compress.mjs <backup> <compressed>` and overwrite only when it exits 0. On failure, restore from the backup and report.',
      '- **Report bytes, not savings.** Say the before/after byte sizes and the backup path. Bytes are not tokens and this host records no measured comparison, so state that savings are unknown.',
    )
  } else if (entry.suite === 'native') {
    lines.push(
      '- **No classifier, no guardrail runtime.** Upstream gates these skills with a task classifier and hook-enforced guardrails. DSH has neither: this is a model-invocable skill, so apply it when the task matches the description, and say so if you deliberately depart from it.',
      '- **The shared default still applies.** The `## Shared default (native-core)` section below is part of the upstream native pack and applies in full.',
      '- **No task file, no state.** Do not create upstream experiment/mode files. Do the work in the session and report evidence in the reply.',
    )
  } else {
    lines.push(
      '- **One-shot skill.** It does not change the chat voice and does not persist. Invoke it, do the job, stop.',
      '- **Invocation.** The user calls it as `/caveman-commit` or `/caveman-review`; the matching commands are also reachable through the normal DSH skill catalog.',
    )
  }

  lines.push(
    '',
    '**License.** Ported from JuliusBrussee/caveman (Apache-2.0). Unofficial DSH port; "Caveman" is a trademark of Julius Brussee.',
    '',
  )
  return lines.join('\n')
}

/**
 * Mount the skills.
 * @param ctx - Cordis context carrying the skill registry.
 */
export function apply(ctx) {
  const nativeCore = present(NATIVE_CORE) ? readFileSync(NATIVE_CORE, 'utf8').trim() : ''
  if (SKILLS.some((entry) => entry.suite === 'native') && nativeCore.length === 0) {
    throw new Error(`dsh-caveman: missing shared native pack core at ${NATIVE_CORE}`)
  }

  for (const entry of SKILLS) {
    const dir = skillDir(entry.name)
    const file = join(dir, SKILL_MD)
    if (!present(file)) {
      throw new Error(`dsh-caveman: missing ${file}`)
    }
    const body = stripFrontmatter(readFileSync(file, 'utf8')).trimEnd()
    const sections = [body]
    if (entry.suite === 'native') {
      sections.push('## Shared default (native-core)\n\n' + nativeCore)
    }
    sections.push(runtimeNote(entry))
    ctx.skills.register({
      name: entry.name,
      description: entry.description,
      whenToUse: entry.whenToUse,
      invocation: entry.invocation,
      // Validated by dsh-skill at LOAD time, not at registration.
      source: 'plugin',
      content: sections.join('\n\n'),
      resourceBase: { kind: 'directory', path: dir.split(sep).join('/') },
    })
  }
}

/** Exported for tests: the catalog contract without mounting. */
export const catalog = SKILLS
