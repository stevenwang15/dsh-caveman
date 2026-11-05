---
name: caveman-compress
description: >
  Compress a memory or instruction file (AGENTS.md, CLAUDE.md, todo list,
  preferences) into caveman prose to save input tokens, keeping a readable
  backup outside the source tree. Trigger: /caveman-compress <filepath>.
---

# Caveman Compress (DSH port)

<!-- ADAPTED FOR DEEPSEEK HARNESS. Upstream (JuliusBrussee/caveman, Apache-2.0) ships this skill
     with a Python CLI that sends the file to the `claude` CLI, the Anthropic API or an
     OpenAI-compatible endpoint. This host already has a model in the session, so this port drops
     the external endpoint and the Python script, and states the backup and validation rules in
     terms DSH can actually keep. The compression rules below are upstream's. -->

## Purpose

Compress natural-language files (AGENTS.md, CLAUDE.md, todo lists, preferences) into caveman
prose to reduce input tokens. The compressed text overwrites the original file; a readable
backup is written OUTSIDE the source tree so agents do not re-read it as a live instruction file.

**No file leaves this machine for compression.** The running session's own model does the rewrite.
Nothing is uploaded to a third-party endpoint and no API key is involved.

## Trigger

`/caveman-compress <filepath>` or the user asks to compress a memory file.

**Requires an explicit filepath.** If the user pastes text instead of naming a file, do not
compress it inline: ask for the path, or offer to save the pasted text to a file first. Never let
your own commentary about the request ("user pasted text, not a path") end up in a saved file.

## Refuse before reading

Refuse and explain, without reading the file, when the name looks like a secret or credential:
`.env`, `.env.*`, `credentials*`, `secrets*`, `*.key`, `*.pem`, `.netrc`, `*.p12`, `id_rsa*`,
anything under `.ssh/`, and any file whose first line is a private key header.

Refuse when the file is not natural language. Compress only `.md`, `.txt`, `.typ`, `.typst`,
`.tex`, or an extensionless text file. Never compress `.py`, `.js`, `.ts`, `.json`, `.yaml`,
`.yml`, `.toml`, `.env`, `.lock`, `.css`, `.html`, `.xml`, `.sql`, `.sh`, or any file with a code
file's extension. If unsure whether content is code or prose, leave it unchanged.

Never compress a `*.original` / `*.original.md` backup. Skip a file that is already under
`.caveman/backups/`.

## Process

1. Resolve the path against the session workspace. Read the file.
2. Choose the backup path: `.caveman/backups/<path relative to the workspace>/<name>.original.md`.
   Create the directories. Write the ORIGINAL bytes there before touching the source file.
   Keep the backup out of the source directory: an `AGENTS.md.original.md` next to `AGENTS.md`
   is itself an instruction file that agents will read.
3. Rewrite only the prose, following the rules below. Keep the file's language.
4. Validate with the helper that ships with this skill:

   `node <skill dir>/scripts/verify-compress.mjs <backup> <compressed>`

   It checks that every fenced code block and inline code span survived byte-identical, that all
   headings survived, that the file got smaller, and that no secret-looking path was written.
   A failing check means: fix the compressed file and re-run; do not overwrite.

5. Overwrite the original only after the check passes. Report before/after byte sizes, the backup
   path, and what was preserved. Never report token counts or money saved: this host records no
   measured comparison, so savings stay unknown.

If validation fails twice, restore the original from the backup and report the failure. Leave the
file as it was.

## Compression Rules

### Remove

- Articles: a, an, the (when the sentence still reads in one pass)
- Filler: just, really, basically, actually, simply, essentially, generally
- Pleasantries: "sure", "certainly", "of course", "happy to", "I'd recommend"
- Hedging: "it might be worth", "you could consider", "it would be good to"
- Redundant phrasing: "in order to" → "to", "make sure to" → "ensure", "the reason is because" → "because"
- Connective fluff: "however", "furthermore", "additionally", "in addition"

### Preserve EXACTLY (never modify)

- Code blocks (fenced ``` and indented)
- Inline code (`backtick content`)
- URLs and links (full URLs, markdown links)
- File paths, commands, environment variables (`$HOME`, `NODE_ENV`)
- Technical terms (library, API, protocol, algorithm names), proper nouns
- Dates, version numbers, numeric values, negative words (not, never, no, only, except)

### Preserve structure

- All markdown headings: keep the exact heading text, compress only the body below
- Bullet nesting, numbered list numbering, table structure, frontmatter / YAML headers

### Compress

- Short synonyms: "big" not "extensive", "fix" not "implement a solution for", "use" not "utilize"
- Fragments fine: "Run tests before commit" not "You should always run tests before committing"
- Merge bullets that say the same thing twice; keep one example where several show one pattern

**CRITICAL:** anything inside ``` ... ``` or `...` is copied exactly. Do not remove comments,
spacing, order, or shorten commands. If the file mixes prose and code, compress only prose; do not
merge sections around code blocks.

## Example

Original:
> You should always make sure to run the test suite before pushing any changes to the main branch. This is important because it helps catch bugs early and prevents broken builds from being deployed to production.

Compressed:
> Run tests before push to main. Catch bugs early, prevent broken prod deploys.
