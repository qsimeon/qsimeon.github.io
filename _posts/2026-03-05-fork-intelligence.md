---
title: "Fork Intelligence: How I Exploited a Public-Fork Hackathon (and Why You Should Know About It)"
date: 2026-03-05
permalink: /blog/fork-intelligence/
tags: [AI, hackathon, claude-code, security, red-team, agents]
excerpt: "At a Google DeepMind x Cactus Compute hackathon, I used Claude Code to scrape every competitor's fork, benchmark all 45 modified solutions, and synthesize a top-scoring submission from the best of them. This is a vulnerability disclosure."
---

This is a vulnerability disclosure for a class of competition I'll call the **public-fork hackathon**: any coding competition where participants submit by forking a public GitHub repository and pushing their solutions to their fork.

I didn't win this hackathon. I could have. My pipeline surfaced the top-scoring solution in the entire competition, and I could have submitted it with trivial modifications and taken first place. I chose not to. What interested me more than winning with someone else's code was the meta-game: the fact that I could systematically harvest, evaluate, and recombine every competitor's approach into something new. The strategy itself was the interesting part, not the points.

I'm writing about it because I think hackathon organizers need to know it's possible, not because I think people should go do it. If this has a genre, it's a red team report. The system under test is the public-fork hackathon format. The finding is that AI coding agents reduce the cost of exploiting publicly visible submissions from "practically infeasible" to "about two hours of mostly idle time."

---

## The Hackathon

[Cactus Compute](https://cactuscompute.com/) x [Google DeepMind](https://deepmind.google/), hosted by AI Tinkerers in Boston. The challenge: design a hybrid inference strategy for function calling that routes between FunctionGemma (a 270M parameter on-device model running through Cactus) and Gemini 2.0 Flash in the cloud. Scoring is a weighted composite of accuracy (F1), latency, and on-device ratio. When do you trust the tiny local model? When do you call the cloud?

The format: everyone forks the same GitHub repo, modifies one function (`generate_hybrid`), and submits. There's a local benchmark of 30 test cases and a remote leaderboard that evaluates your code server-side.

Normal hackathon stuff. Fork, hack, submit.

## The Vulnerability

GitHub forks of public repos are public. Every participant's implementation is visible to every other participant, in real time, throughout the competition.

In a pre-agent world this barely matters. You'd have to visit each fork manually, read each person's code, try to understand their approach, maybe run it locally. The information is technically public but practically buried. There are too many forks, the code varies too much, and the effort of evaluating each one by hand would eat more time than just building your own thing.

I had Claude Code open in my terminal. That changed the math.

## The Pipeline

The whole thing took about 90 minutes to build, with Claude Code writing most of the code.

### Step 1: Scrape every fork

A Python script ([`01_fetch_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/01_fetch_forks.py)) hits the GitHub API, enumerates every fork of the hackathon repo, fetches each fork's `main.py` via the Contents API, and diffs it against the baseline `generate_hybrid`. Modified solutions get saved. Unchanged ones get skipped.

152 forks existed. 45 had actually modified their solution.

```
$ python 01_fetch_forks.py
Fetching fork list for cactus-compute/functiongemma-hackathon ...
Found 152 forks, checking each for modified main.py ...
Saved: 45 modified solutions to fork_solutions/
Skipped: 107 (unchanged from baseline)
```

### Step 2: Benchmark every fork

A second script ([`02_benchmark_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/02_benchmark_forks.py)) takes each saved `main.py`, drops it into a temporary directory with a symlink to the Cactus SDK and model weights, runs the full 30-case benchmark, parses the output, and records the score. Four forks run in parallel. The whole sweep finishes in about 20 minutes on my M3 MacBook.

Out comes a ranked leaderboard of every competitor's local benchmark performance: F1, latency, on-device ratio, and a rough characterization of their approach.

```
$ python 02_benchmark_forks.py
[1/45] Benchmarking Rosh2403 ... 100.0% (0ms avg, 100% on-device)
[2/45] Benchmarking SahilSaxena007 ... 100.0% (0ms avg, 100% on-device)
[3/45] Benchmarking ishaanvijai ... 91.6% (270ms avg, 100% on-device)
...
```

### Step 3: Analyze and synthesize

Once you have a ranked list, you can read the top implementations and understand *why* they scored well. Claude Code makes this fast. "Read the top 5 fork solutions and explain what each one does differently" is one prompt.

The top 10:

| # | Who | Score | Avg Time | Strategy |
|---|-----|-------|----------|----------|
| 1 | Rosh2403 | 100.0% | 0ms | Pure regex, no model call |
| 2 | SahilSaxena007 | 100.0% | 0ms | Pure regex, no model call |
| 3 | ishaanvijai | 91.6% | 270ms | Regex-guided prompt compression |
| 4 | elena-kalinina | 89.0% | 343ms | Model-heavy with normalization |
| 5 | avimallick | 88.5% | 344ms | Cross-validates regex vs model |
| 6 | wnwoghd22 | 88.2% | 429ms | Model-heavy |
| 7 | adi-suresh01 | 87.3% | 357ms | Model-heavy |

The two top scorers hit 100% with 0ms inference time. They never call FunctionGemma at all. They just regex-match the user's text against the 7 known tool types in the benchmark. It works perfectly on the local test suite. Whether it generalizes to the hidden evaluation set is a different question, but on the known cases, regex is unbeatable.

The third-place solution from ishaanvijai was the most interesting to me. It uses regex to *identify* which tools are likely needed, then passes only those tools to FunctionGemma with stripped-down descriptions and a tiny token budget. The model still runs (you get the on-device credit) but regex narrows the context so the model runs faster and more accurately. Regex as a lens for the model, not a replacement for it.

### Step 4: Build my own

With full intelligence on the field, the last step was synthesis. I pulled:

- **Model caching** from ishaanvijai (load the model once per process instead of per call, saves ~600ms per invocation after the first)
- **Regex extraction** covering all 7 tool types, with clause splitting for multi-intent queries and pronoun resolution
- **Prompt compression** from ishaanvijai (when regex is confident, pass only matched tools with stripped descriptions)
- **Score-based selection**: run both regex and model, compare structural quality, pick the better result
- **Type coercion and validation** from multiple forks (fixing string-to-int mismatches, normalizing time formats)

The result: **94% on the local benchmark**, 100% F1 on all 30 cases, 100% on-device, ~200ms average latency. Higher than any individual fork I drew from.

No single competitor's code was copied wholesale. But the final solution wouldn't exist without reading all of them.

---

## Threat Assessment

In security terminology, this is a low-skill, high-impact exploit. The attack requires no specialized knowledge. The tooling is commercially available to anyone with a terminal. The prompts are natural language. The entire pipeline can be reproduced by someone who has never written a scraper before, because the agent writes it for them.

The vulnerability is structural, not behavioral. It doesn't depend on participants being careless. They're following the competition's own instructions: fork the repo, push your code. The problem is that the format makes every submission visible to every other participant by design, and the cost of exploiting that visibility just dropped by orders of magnitude.

Two ways to frame the ethics:

Every fork is public. GitHub's whole thing is open source. Reading other people's implementations and combining good ideas is how software engineering works. Nobody signed an NDA. Nobody was promised their code would be private. There's real engineering in the synthesis step.

But the implicit contract of a hackathon is that you're competing on your own ideas. Everyone else was heads-down writing original code while I was systematically surveilling their work and cherry-picking the best parts. The issue isn't whether the data is technically public. It's whether anyone expected it to be exploited like this. I was playing a different game than the other participants thought we were all playing.

I don't think there's a clean answer. But I think the question is now inescapable, and that's why I'm disclosing it.

---

## What Made This Possible

Everything I described could theoretically have been done by hand before AI coding agents. Open 45 browser tabs, read each fork, take notes, try to synthesize. Nobody would actually do that. The time cost was too high, which kept the vulnerability dormant. Present but unexploitable.

AI agents collapsed that barrier. The prompts were almost comically simple:

- "Write a script that fetches every fork's main.py from the GitHub API and saves the ones that differ from baseline." One prompt, working script.
- "Write a harness that runs each fork's code against the benchmark in isolated temp directories, four at a time." One prompt.
- "Read the top 5 solutions and explain what each does differently." Instant architectural understanding of code I'd never seen.
- "Combine the model caching from this fork, the regex extraction from that one, and the prompt compression technique from that one into a single function." The part that would have taken a skilled engineer hours took minutes.

Total elapsed time from "I wonder what everyone else is doing" to "I have a 94% solution synthesized from the field" was about two hours. Most of that was waiting for benchmarks to run.

This is not specific to Claude Code. Cursor, Copilot Workspace, Windsurf, any of them could do it. Coding agents turn public code into a queryable, executable knowledge base. The gap between "information is technically accessible" and "information is practically exploitable" is gone.

---

## What I Actually Submitted

I had Rosh2403's 100% solution sitting in my `fork_solutions/` directory. I could have submitted it as-is, changed some variable names, and placed at the top of the leaderboard. I didn't. I wasn't interested in laundering someone else's work. I wanted to see what happens when you treat a field of competitors as a dataset and run selection and recombination over their ideas.

Even the 94% synthesized version didn't feel right. The hackathon was about exploring intelligent routing between on-device and cloud inference, about helping Cactus Compute understand how developers reason about the edge-cloud boundary. Submitting a regex Frankenstein missed the spirit of the thing.

So I also built a principled version. FunctionGemma runs on every request as the primary decision-maker. Tool relevance ranking narrows the model's context. The model's confidence score drives cloud routing: high confidence stays on-device, low confidence escalates to Gemini. Regex is used only as a surgical supplement for a specific failure mode where the 270M model gets the right tool but hallucinates the wrong argument value ("15 minutes" when you said "5 minutes"). Direct text extraction corrects those.

That version scored 88.6%. Lower, but defensible. The model is making real decisions. The routing is actually intelligent. It's the version I'd want to walk through with the Cactus team.

I submitted both. Neither won. The leaderboard was topped by two teams with 100% scores and 0ms inference times: pure regex, no model. Same approach as the top two forks I'd already benchmarked weeks earlier.

---

## Recommended Mitigations

If you're organizing a hackathon that uses public GitHub forks as the submission mechanism, here are five mitigations ranked roughly by effectiveness:

**1. Use private repos or private submission channels.** If forks are private, the attack surface disappears. GitHub doesn't support private forks of public repos natively, but you can have participants clone (not fork) into private repos and submit through a form or CI pipeline.

**2. Delay visibility.** Create forks in a GitHub Organization with restricted visibility until after the deadline. Participants push freely; others can't browse.

**3. Use hidden evaluation sets.** The hackathon already had a remote leaderboard with (presumably) different test cases. Good. But if the local benchmark covers enough of the problem space that regex can ace it, people will optimize for the local benchmark, and fork surveillance tells them who already cracked it.

**4. Run originality checks.** Diff submitted code against all other submissions. High similarity between non-collaborating teams is a signal. AST-level comparison would catch refactored copies.

**5. Update your threat model.** Hackathon rules were written when reading 45 codebases in two hours was humanly impossible. That constraint is gone. Rules and honor codes should explicitly address automated analysis of other participants' public submissions. Not because it's necessarily wrong, but because everyone should know what game is being played.

---

## Coda

Any system that depends on practical obscurity ("yes the data is public, but nobody would actually go through all of it") is operating on borrowed time. AI agents didn't create new information here. They made existing public information *operationally useful* at a speed that changes the threat model.

I don't think what I did was cheating. I also don't think it was entirely clean. It was an alternative strategy that exploits a structural vulnerability in the competition format, made feasible by AI tooling that didn't exist a year ago. I'm disclosing it because I think the responsible move is to talk about it openly so organizers can adapt, not to keep it quiet and let it keep working.

This is not a novel attack. Someone else will do it at the next public-fork hackathon, and the next one after that. The question is whether competition formats evolve to account for it.

If you organize hackathons: the forks are public, and the agents can read all of them.

---

*Code for the full pipeline (scraper, benchmarker, synthesizer) is on [GitHub](https://github.com/qsimeon/functiongemma-hackathon). The hackathon was organized by [AI Tinkerers Boston](https://boston.aitinkerers.com/) in partnership with [Cactus Compute](https://cactuscompute.com/) and [Google DeepMind](https://deepmind.google/).*
