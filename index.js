// dsh-caveman — DeepSeek Harness plugin layer.
//
// Registers the caveman voice skills (caveman / ultracave / megacave / caveman-commit /
// caveman-review / caveman-help / caveman-stats) as native DSH skills.
//
// The upstream SKILL.md bodies ship verbatim under skills/<name>/ and are licensed
// Apache-2.0 (see LICENSE + NOTICE). Everything DSH-specific lives in this file and is
// APPENDED to the body at load time under a clearly marked "DSH runtime" section, so the
// upstream text stays byte-identical and can be re-synced by replacing skills/*/SKILL.md.
//
// Why a note at all: upstream's skills assume a host with hooks that persist the active
// mode across turns (Claude Code, Codex, Gemini CLI…). DSH has no such hook, so the note
// tells the model the two facts it would otherwise guess wrong:
//   1. mode is conversational here — there is no stored state to read or write;
//   2. status answers must be marked "(not tracked by this host)".

import { readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'caveman'
export const inject = ['skills']

const SKILLS_DIR = fileURLToPath(new URL('./skills/', import.meta.url)).replace(/[\\/]+$/, '')

/**
 * The catalog contract, one entry per skill.
 *
 * `description` is what the model sees in the skill catalog (dsh-tool-skill caps it at
 * 500 chars — the smoke test guards that). `whenToUse` is the routing hint. `invocation`
 * mirrors upstream's `disable-model-invocation: true` on the two extreme modes: the model
 * may not reach for them on its own, only the user can.
 */
const SKILLS = [
  {
    name: 'caveman',
    description:
      'Terse caveman voice for chat output: answer first, ceremony gone, every technical fact kept. Use for "/caveman", "caveman mode", "talk like caveman", "be brief", "less tokens". Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user asks for shorter, terser replies or fewer tokens, invokes /caveman, or says the answers are too verbose. Code, commands, paths, numbers and error strings stay verbatim.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'ultracave',
    description:
      'Caveman at maximum compression: fragments, one word when one word is enough, each fact once. Invoke only with /ultracave or /caveman ultra. Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user explicitly asks for maximum compression with /ultracave or /caveman ultra. The model must not pick this mode on its own.',
    invocation: { modelInvocable: false, userInvocable: true },
  },
  {
    name: 'megacave',
    description:
      'Caveman in Classical Chinese: 文言文 register, fewer characters on screen, technical terms verbatim. Invoke only with /megacave or /caveman wenyan. Stays on until "stop caveman" or "normal mode".',
    whenToUse:
      'The user explicitly asks for 文言文 compression with /megacave or /caveman wenyan. The model must not pick this mode on its own.',
    invocation: { modelInvocable: false, userInvocable: true },
  },
  {
    name: 'caveman-commit',
    description:
      'Write a Conventional Commits message compressed to intent only: imperative subject, why over what, no AI attribution. Use for "write a commit", "commit message", /caveman-commit.',
    whenToUse:
      'The user asks for a commit message, invokes /caveman-commit, or asks to commit the change.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-review',
    description:
      'Compressed code review: one line per finding with location, problem and fix. Use for /caveman-review, "review this PR", "review the diff".',
    whenToUse:
      'The user asks to review a diff, PR or patch and wants terse, actionable findings.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-help',
    description:
      'Quick-reference card for the caveman skills, their commands and how to switch modes. Trigger: /caveman-help or "caveman help".',
    whenToUse: 'The user asks what caveman commands exist, or how to turn it on or off.',
    invocation: { modelInvocable: true, userInvocable: true },
  },
  {
    name: 'caveman-stats',
    description:
      'Report token usage for the current DSH session honestly: point at the host usage view, state that caveman-specific savings are unmeasured. Trigger: /caveman-stats.',
    whenToUse:
      'The user asks how many tokens caveman saved, or wants usage numbers for the current session.',
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

  if (entry.name === 'caveman' || entry.name === 'ultracave' || entry.name === 'megacave') {
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
  } else {
    lines.push(
      '- **One-shot skill.** It does not change the chat voice and does not persist. Invoke it, do the job, stop.',
      '- **Invocation.** The user calls it as `/caveman-commit` or `/caveman-review`; the matching commands are also reachable through the normal DSH skill catalog.',
    )
  }

  lines.push('', '**License.** Ported from JuliusBrussee/caveman (Apache-2.0). Unofficial DSH port; "Caveman" is a trademark of Julius Brussee.', '')
  return lines.join('\n')
}

/**
 * Mount the skills.
 * @param ctx - Cordis context carrying the skill registry.
 */
export function apply(ctx) {
  for (const entry of SKILLS) {
    const dir = skillDir(entry.name)
    const file = join(dir, SKILL_MD)
    if (!present(file)) {
      throw new Error(`dsh-caveman: missing ${file}`)
    }
    const body = stripFrontmatter(readFileSync(file, 'utf8'))
    ctx.skills.register({
      name: entry.name,
      description: entry.description,
      whenToUse: entry.whenToUse,
      invocation: entry.invocation,
      // Validated by dsh-skill at LOAD time, not at registration.
      source: 'plugin',
      content: `${body.trimEnd()}\n\n${runtimeNote(entry)}`,
      resourceBase: { kind: 'directory', path: dir.split(sep).join('/') },
    })
  }
}

/** Exported for the smoke test: the catalog contract without mounting. */
export const catalog = SKILLS
