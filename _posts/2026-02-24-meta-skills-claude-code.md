---
title: "Using Claude Code to Improve Claude Code: Two Skills That Keep Me Sane"
date: 2026-02-24
tags: [claude-code, tools, skills, developer-experience, AI]
---

I've been using Claude Code heavily for the past few months — for research projects, web apps, scripts, even writing. And I completely get it now when the creators say they're using Claude Code to build Claude Code. Once you start working with it seriously, the meta-loop becomes impossible to ignore.

The thing that changed my workflow the most wasn't a prompting trick or a model upgrade. It was **custom skills** — instruction sets you give the agent so it handles specific workflows the way *you* want. Skills compound. The more you teach it about how you work, the more effective every session becomes.

What gets trippy is when you start writing skills that improve how you use Claude Code itself. You're using the tool to make the tool better, which makes you more productive, which lets you build more tools... you see where this goes.

Here are two "meta-skills" I built — meta because they don't help with any specific project, they help with the *experience* of using Claude Code. Both were written with Claude Code's help. Both have saved me real time.

## deepscan — "Where Were We?"

**The problem:** Claude Code sessions have limited context windows. When you compact context or start a new session on an existing project, you lose the thread. What was finished? What's half-done? What was the user even trying to do? You end up re-exploring the same codebase, re-reading the same files, sometimes re-doing work that was already done.

I realized "where were we?" is probably the most expensive question in agentic coding.

**What it does:** deepscan runs a five-phase audit of your project:

1. **Understand intent** — reads CLAUDE.md, README, git log, conversation history
2. **Audit the repo** — scans for stale docs, unused files, dead code, naming inconsistencies
3. **Assess progress** — categorizes every feature as Complete, In Progress, Pending (Claude can do), Pending (human needed), or Unclear
4. **Generate STATUS.md** — writes a structured handoff document in the project root
5. **Present and discuss** — gives you a conversational recap and asks before changing anything

The output is a STATUS.md that any future session (or person) can read and immediately know what's going on. I run it before every context compaction and at the start of sessions on existing projects.

**Try it:** [qsimeon.github.io/deepscan](https://qsimeon.github.io/deepscan)

## session-merge — Fixing the Split Problem

**The problem:** If you use Claude Code for extended sessions — exiting and resuming, changing directories with `cd`, updating versions — your session silently fragments. You think you're in one continuous conversation, but Claude Code has split it into two (or more) separate sessions. The older one has all your context and history; the newer one has your latest work. And there's no built-in way to put them back together.

This happens because Claude Code scopes sessions to working directories. Change your `cwd` and it may create a new session, inheriting the name but not the history. Over time I accumulated dozens of duplicate-named sessions that were supposed to be one conversation.

**What it does:** session-merge is a skill + bash script that works directly with the JSONL session files in `~/.claude/projects/`. The key commands:

- `--find-splits` detects all session groups that share the same name (i.e., sessions that were silently split)
- `--merge-splits` auto-fixes all of them with one command
- `--dry-run` for previewing before committing

Under the hood: it finds the main conversation trunk of each session (the longest `parentUuid` chain), then stitches them together — linking the root of session N+1 to the leaf of session N — so Claude Code can walk one continuous chain when resuming. All merged sessions land in your home directory project, so they're always resumable from `~` regardless of where the source sessions lived.

**Try it:** [qsimeon.github.io/session-merge](https://qsimeon.github.io/session-merge)

## The Recursive Loop

The part that still feels strange: I used Claude Code to build both of these skills. Claude Code helped me reverse-engineer its own session storage format, write the bash script that merges its own sessions, and design the audit process that reviews projects it helped build. It's turtles all the way down.

I don't think this is a novelty. I think this is where developer tooling is heading — tools that are expressive enough to improve themselves, guided by the people who use them. Skills are a simple version of this: you notice a friction, you describe a solution, and the tool absorbs it.

I know there are whole skill marketplaces now, so these are drops in a large bucket. But if you're using Claude Code (or similar tools), I'm genuinely curious: **what are your meta-workflows?** How are you using the tool to improve the tool?

---

Both skills are open source: [deepscan](https://github.com/qsimeon/deepscan) | [session-merge](https://github.com/qsimeon/session-merge)
