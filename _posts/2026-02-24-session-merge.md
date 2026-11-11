---
title: "session-merge: Fixing Claude Code's Split Session Problem"
date: 2026-02-24
permalink: /session-merge/
tags: [claude-code, tools, developer-experience]
excerpt: "Claude Code sessions silently fragment when you cd between directories or exit and resume. I built session-merge to detect split sessions and merge them back into one continuous conversation."
---

If you use Claude Code extensively, you've probably seen this happen. You're deep in a session, you `cd` to a different directory or `/exit` and `--resume`, and your single conversation has silently fragmented into two separate sessions. The older session holds all your context, while the newer one holds your latest work. Claude Code has no built-in way to recombine them.

I built **session-merge** to fix this. It's a Claude Code skill (and a standalone bash script) that detects split sessions and merges them back into one.

The quickest path is to run `--find-splits` to see all your groups of duplicate-named sessions, then `--merge-splits` to fix them all at once. For manual control, you can name exactly which sessions to combine by UUID.

Under the hood, session-merge works with the JSONL (JSON Lines) session files in `~/.claude/projects/`. It finds each session's main trunk (its longest `parentUuid` chain), orders the sessions chronologically, rewrites their session IDs to the merged one, and links the root of each session to the leaf of the one before, so Claude Code can resume one continuous chain.

[Read the full docs](https://qsimeon.github.io/session-merge) or [grab it from GitHub](https://github.com/qsimeon/session-merge).
