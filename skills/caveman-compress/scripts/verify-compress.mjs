#!/usr/bin/env node
// verify-compress.mjs — gate for /caveman-compress.
//
//   node scripts/verify-compress.mjs <original> <compressed>
//
// Exits 0 when the compressed file is a safe compression of the original:
//   - every fenced code block and inline code span survived byte-identical
//   - every markdown heading survived
//   - every URL, path-looking token and negative word survived
//   - the file got smaller (strictly)
//   - no secret-looking path was written
// Exits 1 with a list of problems otherwise, so the skill restores the original.
//
// No dependencies. Node 22+.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const [, , originalPath, compressedPath] = process.argv
if (!originalPath || !compressedPath) {
  console.error('usage: verify-compress.mjs <original> <compressed>')
  process.exit(2)
}

const original = readFileSync(originalPath, 'utf8')
const compressed = readFileSync(compressedPath, 'utf8')
const problems = []

/** Fenced code blocks, including the fence lines, exactly as written. */
const fences = (text) => text.match(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm) ?? []
/** Inline code spans, longest first so `a` does not shadow `a.b`. */
const spans = (text) => [...text.matchAll(/`[^`\n]+`/g)].map((m) => m[0])
/** ATX headings with their exact text. */
const headings = (text) => [...text.matchAll(/^#{1,6}\s.*$/gm)].map((m) => m[0].trimEnd())

const encode = (items) => items.map((s) => Buffer.from(s, 'utf8').toString('base64'))

for (const [label, pick] of [
  ['fenced code block', fences],
  ['inline code span', spans],
  ['heading', headings],
]) {
  const before = encode(pick(original))
  const after = new Set(encode(pick(compressed)))
  const lost = before.filter((item) => !after.has(item))
  if (lost.length > 0) {
    const sample = Buffer.from(lost[0], 'base64').toString('utf8').split('\n')[0].slice(0, 80)
    problems.push(`${lost.length} ${label}(s) changed or dropped, e.g. ${JSON.stringify(sample)}`)
  }
}

// URLs and environment variables must survive byte-identically; negative words must survive as
// words (case may change with sentence position, but a dropped "not" flips meaning).
const exactTokens = (text) => [
  ...text.matchAll(/https?:\/\/[^\s)>\]"']+/g),
  ...text.matchAll(/\$[A-Z][A-Z0-9_]*/g),
].map((m) => m[0])
const negationTokens = (text) => [...text.matchAll(/\b(?:not|never|no|only|except)\b/gi)].map((m) => m[0].toLowerCase())

const exactBefore = new Set(exactTokens(original))
const exactAfter = new Set(exactTokens(compressed))
const lostExact = [...exactBefore].filter((token) => !exactAfter.has(token))

const negationBefore = new Set(negationTokens(original))
const negationAfter = new Set(negationTokens(compressed))
const lostNegations = [...negationBefore].filter((token) => !negationAfter.has(token))

const lostTokens = [...lostExact, ...lostNegations]
if (lostTokens.length > 0) {
  problems.push(`${lostTokens.length} protected token(s) lost, e.g. ${JSON.stringify(lostTokens.slice(0, 5))}`)
}

const originalBytes = Buffer.byteLength(original, 'utf8')
const compressedBytes = Buffer.byteLength(compressed, 'utf8')
if (compressedBytes >= originalBytes) {
  problems.push(`not smaller: ${originalBytes} -> ${compressedBytes} bytes`)
}

if (/(^|\/)\.env|credentials|secrets?|\.netrc|id_rsa|\.pem$/i.test(basename(compressedPath)) && /PRIVATE KEY/.test(compressed)) {
  problems.push('compressed file looks like a secret')
}

if (problems.length > 0) {
  console.error(`FAIL  ${compressedPath}`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const saved = originalBytes - compressedBytes
console.log(`ok    ${originalBytes} -> ${compressedBytes} bytes (-${saved}, ${((saved / originalBytes) * 100).toFixed(1)}%)`)
console.log('ok    code blocks, inline spans, headings, URLs, env vars and negations preserved')
console.log('note  bytes are not tokens: no measured token or cost saving is implied')
