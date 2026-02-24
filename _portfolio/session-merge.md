---
title: "session-merge: Claude Code Session Merger"
excerpt: "A skill and CLI tool for merging split Claude Code sessions back into a single continuous conversation history."
collection: portfolio
---

**session-merge** is a Claude Code skill that solves a common frustration: sessions splitting unexpectedly after `cd` operations, exit/resume cycles, or version updates. You end up with multiple sessions sharing the same name but containing fragments of what was supposed to be one conversation.

The tool works directly with the JSONL session files in `~/.claude/projects/`, combining entries chronologically and producing a single unified session you can resume normally.

**Key features:**
- `--find-splits` — automatically detects all session groups that share the same name (i.e., sessions that split)
- `--merge-splits` — one-command fix to merge all split groups back together
- `--dry-run` — preview before committing
- Manual merge with `--name` for combining any sessions

**How it works:** Collects all JSONL entries from source sessions, sorts by timestamp, rewrites `sessionId` fields to a new merged UUID, copies subagent files, and updates the session index metadata.

[View the project site and documentation](https://qsimeon.github.io/session-merge) | [GitHub repo](https://github.com/qsimeon/session-merge)
