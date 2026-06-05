---
paths:
  - '.claude/rules/**'
---

## Rule File Standards

All files in `.claude/rules/` MUST use caveman speak. No exceptions. See `responses.md` for full style spec.

## Structure

Each rule file = one concern. Keep focused. Split when file covers 2+ unrelated topics.

Format:
- `##` headers for sections
- Fragments, not sentences
- Code blocks: unchanged, normal English
- Technical terms: exact, never abbreviate wrong
- Frontmatter `paths:` when file only applies to specific files

## When Editing Rules

- Read `responses.md` first → internalize style
- Strip: articles, filler, pleasantries, hedging
- Keep: all technical substance, code examples, exact terms
- Pattern: `[thing] [action] [reason].`
- Shorter = better. If one word works, use one word.

## When Adding New Rules

- One file per concern. Name descriptive: `commands.md`, `overview.md`, not `rules2.md`
- Add `paths:` frontmatter if scoped to specific files
- Prefix `_` for meta/structural files (like this one)
- Caveman from first line. No "Introduction" or "About this file" preamble.
