---
title: "session-merge: Fixing Claude Code's Split Session Problem"
date: 2026-02-24
tags: [claude-code, tools, developer-experience]
---

If you use Claude Code extensively, you've probably noticed this: you're deep in a session, you `cd` to a different directory or `/exit` and `--resume`, and your single conversation has silently fragmented into two separate sessions. The older one has all your context; the newer one has your latest work. No built-in way to recombine them.

I built **session-merge** to fix this. It's a Claude Code skill (and standalone bash script) that detects split sessions and merges them back into one.

The quickest path: run `--find-splits` to see all your duplicate-named session groups, then `--merge-splits` to auto-fix them all. For manual control, you can specify exactly which sessions to combine by UUID.

Under the hood, it works with the JSONL files in `~/.claude/projects/`, sorting entries chronologically and rewriting session IDs. Message threading is preserved — only the session-level identity changes.

[Read the full docs](https://qsimeon.github.io/session-merge) or [grab it from GitHub](https://github.com/qsimeon/session-merge).
