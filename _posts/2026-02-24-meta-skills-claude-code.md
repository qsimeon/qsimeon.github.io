---
title: "Using Claude Code to Improve Claude Code: Two Skills That Keep Me Sane"
date: 2026-02-24
tags: [claude-code, tools, skills, developer-experience, AI]
---

I've been using Claude Code heavily for the past few months for research projects, web apps, scripts and even writing. I now completely understand why its creators say they use Claude Code to build Claude Code. Once you work with it seriously, the meta-loop becomes impossible to ignore.

The biggest change to my workflow came from **custom skills**, more than from any prompting trick or model upgrade. A skill is an instruction set you give the agent so that it handles a specific workflow the way *you* want. Skills compound: the more you teach the agent about how you work, the more effective every session becomes.

It gets trippy when you start writing skills that improve how you use Claude Code itself. You use the tool to make the tool better, which makes you more productive, which lets you build more tools... you see where this goes.

Here are two "meta-skills" I built. I call them meta because they help with the *experience* of using Claude Code instead of with any specific project. Both were written with Claude Code's help and have saved me real time.

## deepscan: Recovering the Thread

**The problem:** Claude Code sessions have limited context windows. When you compact context or start a new session on an existing project, you lose the thread. You no longer know what was finished, what is half-done, or even what the user was trying to do. You end up re-exploring the same codebase, re-reading the same files, and sometimes redoing work that was already done.

I realized that "where were we?" is probably the most expensive question in agentic coding.

**The fix:** deepscan runs a five-phase audit of your project:

1. **Understand intent:** reads CLAUDE.md, the README, the git log and the conversation history
2. **Audit the repo:** scans for stale docs, unused files, dead code and naming inconsistencies
3. **Assess progress:** sorts every feature into Complete, In Progress, Pending (Claude can do), Pending (human needed), or Unclear
4. **Generate STATUS.md:** writes a structured handoff document in the project root
5. **Present and discuss:** gives you a conversational recap and asks before changing anything

The output is a STATUS.md file that any future session (or person) can read to know immediately what's going on. I run deepscan before every context compaction and at the start of sessions on existing projects.

**Try it:** [qsimeon.github.io/deepscan](https://qsimeon.github.io/deepscan)

## session-merge: Repairing Split Sessions

**The problem:** If you use Claude Code for long sessions, exit and resume, `cd` into other directories, or update versions, your session silently fragments. You think you're in one continuous conversation, but Claude Code has split it into two or more separate sessions. The older session holds all your context and history, while the newer one holds your latest work. Claude Code has no built-in way to put them back together.

This happens because Claude Code scopes sessions to working directories. When you change your `cwd`, it may create a new session that inherits the name but not the history. Over time I collected dozens of sessions with duplicate names that were supposed to be one conversation.

**The fix:** session-merge is a skill plus a bash script that works directly with the JSONL (JSON Lines) session files in `~/.claude/projects/`. Its key commands are:

- `--find-splits` detects every group of sessions that share the same name, which is the sign of a silent split
- `--merge-splits` fixes all of them with one command
- `--dry-run` previews the result before you commit to it

Under the hood, the script finds the main conversation trunk of each session, which is its longest `parentUuid` chain. It then stitches the trunks together by linking the root of session N+1 to the leaf of session N, so Claude Code can walk one continuous chain when it resumes. All merged sessions land in your home directory project, so you can always resume them from `~`, wherever the source sessions lived.

**Try it:** [qsimeon.github.io/session-merge](https://qsimeon.github.io/session-merge)

## The Recursive Loop

One part still feels strange: I used Claude Code to build both of these skills. Claude Code helped me reverse-engineer its own session storage format, write the bash script that merges its own sessions, and design the audit process that reviews projects it helped build. It's turtles all the way down.

I think this is where developer tooling is heading: tools expressive enough to improve themselves, guided by the people who use them. Skills are a simple version of this: you notice a friction, you describe a solution, and the tool absorbs it.

I know there are whole skill marketplaces now, so these two are drops in a large bucket. But if you use Claude Code (or a similar tool), I'm genuinely curious: **what are your meta-workflows?** How are you using the tool to improve the tool?


Both skills are open source: [deepscan](https://github.com/qsimeon/deepscan) | [session-merge](https://github.com/qsimeon/session-merge)
