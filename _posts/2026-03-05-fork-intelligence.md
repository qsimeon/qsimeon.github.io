---
title: "Fork Intelligence: How I Exploited a Public-Fork Hackathon (and Why You Should Know About It)"
date: 2026-03-05
permalink: /blog/fork-intelligence/
tags: [AI, hackathon, claude-code, security, red-team, agents]
excerpt: "At a Google DeepMind x Cactus Compute hackathon, I used Claude Code to scrape every competitor's fork, benchmark all 45 modified solutions, and synthesize a top-scoring submission from the best of them. Here's how, and why hackathon organizers need to think about this."
---

I want to be upfront about what this post is. It's not a victory lap — I didn't win. I could have. My pipeline gave me access to the top-scoring solution in the entire field — I could have submitted it verbatim, or with trivial modifications, and taken first place. I chose not to. What interested me wasn't winning with someone else's code; it was the *meta-game* itself — the fact that I could systematically harvest, evaluate, and recombine every competitor's approach into something new. That felt like the more interesting story to tell.

So this is a disclosure. I found a strategy during a hackathon that felt clever, felt borderline, and felt like something people should know about. Not because I think everyone should do it, but because the tooling now exists for *anyone* to do it, and I think that changes the game in ways hackathon organizers haven't fully reckoned with.

Think of this as a red team report, except the system under test is the public-fork hackathon format itself.

---

## The Setup

The hackathon was [Cactus Compute](https://cactuscompute.com/) x [Google DeepMind](https://deepmind.google/), hosted by AI Tinkerers in Boston. The challenge: design an optimal hybrid inference strategy for function calling, routing between FunctionGemma (a 270M parameter on-device model running through Cactus) and Gemini 2.0 Flash in the cloud. You're scored on a composite of accuracy (F1), latency, and on-device ratio — the question being, when should you trust the tiny local model and when should you call the cloud?

The format: everyone forks the same GitHub repo, modifies one function — `generate_hybrid` — and submits. There's a local benchmark with 30 test cases (10 easy, 10 medium, 10 hard) and a remote leaderboard that runs your code on its own evaluation server.

Standard stuff. Fork, hack, submit, repeat.

Except.

## The Vulnerability

Every participant's fork is public by default. GitHub forks of public repos are public. Which means every participant's implementation — their entire strategy — is visible to every other participant, in real time, throughout the competition.

In a traditional hackathon this barely matters. You'd have to manually visit each fork, read each person's code, understand their approach, maybe try running it. The information is technically public but practically inaccessible — there are too many forks, the code varies too much, and the effort of evaluating each one by hand would consume more time than just building your own thing.

But I had Claude Code open in my terminal. And the calculus changed.

## The Pipeline

Here's what I built, in about 90 minutes, with Claude Code doing most of the heavy lifting.

### Step 1: Scrape every fork

A Python script ([`01_fetch_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/01_fetch_forks.py)) hits the GitHub API, enumerates every fork of the hackathon repo, fetches each fork's `main.py` via the Contents API, and compares it against the baseline `generate_hybrid`. If someone modified the function, their file gets saved. If it's identical to the template, skip.

152 forks existed. 45 had actually modified their solution.

```
$ python 01_fetch_forks.py
Fetching fork list for cactus-compute/functiongemma-hackathon ...
Found 152 forks, checking each for modified main.py ...
Saved: 45 modified solutions to fork_solutions/
Skipped: 107 (unchanged from baseline)
```

### Step 2: Benchmark every fork

A second script ([`02_benchmark_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/02_benchmark_forks.py)) takes each saved `main.py`, drops it into a temporary directory with a symlink to the Cactus SDK and model weights, runs the full 30-case benchmark against it, parses the output, and records the score. Four forks run in parallel. The whole sweep takes about 20 minutes on my M3 MacBook.

The output is a ranked leaderboard of every competitor's local benchmark score, along with their average F1, latency, on-device ratio, and a rough characterization of their strategy.

```
$ python 02_benchmark_forks.py
[1/45] Benchmarking Rosh2403 ... 100.0% (0ms avg, 100% on-device)
[2/45] Benchmarking SahilSaxena007 ... 100.0% (0ms avg, 100% on-device)
[3/45] Benchmarking ishaanvijai ... 91.6% (270ms avg, 100% on-device)
...
```

### Step 3: Analyze and synthesize

This is where it gets interesting. Once you have a ranked list of every approach, sorted by score, you can read the top implementations and understand *why* they work. Claude Code makes this part trivial — "read the top 5 fork solutions and explain what each one does differently" is a single prompt.

The top 10 looked like this:

| # | Who | Score | Avg Time | Strategy |
|---|-----|-------|----------|----------|
| 1 | Rosh2403 | 100.0% | 0ms | Pure regex, no model call |
| 2 | SahilSaxena007 | 100.0% | 0ms | Pure regex, no model call |
| 3 | ishaanvijai | 91.6% | 270ms | Regex-guided prompt compression |
| 4 | elena-kalinina | 89.0% | 343ms | Model-heavy with normalization |
| 5 | avimallick | 88.5% | 344ms | Cross-validates regex vs model |
| 6 | wnwoghd22 | 88.2% | 429ms | Model-heavy |
| 7 | adi-suresh01 | 87.3% | 357ms | Model-heavy |

The pattern was immediately clear. The top two scored 100% with 0ms inference time — they never call FunctionGemma at all. They just regex-match the user's text against the 7 known tool types in the benchmark. It works perfectly on the local test suite. Whether it generalizes to the hidden evaluation set is another question, but on the known cases, regex is unbeatable.

The third-place solution (ishaanvijai, 91.6%) was the most genuinely clever: use regex to *identify* which tools are likely needed, then pass only those tools to FunctionGemma with stripped-down descriptions and a tiny token budget. The model still runs — so you get the on-device credit — but regex narrows the context so the model runs faster and more accurately. Regex as a lens, not a replacement.

### Step 4: Build my own

With all of this intelligence, the final step was synthesis. I took:

- **Model caching** from ishaanvijai (load the model once per process, not per call — saves ~600ms per invocation after the first)
- **Regex extraction** covering all 7 tool types, with clause splitting for multi-intent queries and pronoun resolution
- **Prompt compression** from ishaanvijai (when regex is confident, pass only matched tools with stripped descriptions)
- **Score-based selection**: run both regex and model, compare structural quality, pick the better result
- **Type coercion and validation** from multiple forks (fixing string-to-int mismatches, normalizing time formats)

The result: **94% on the local benchmark**, 100% F1 on all 30 cases, 100% on-device, ~200ms average latency. Better than every individual fork I drew from.

No single competitor's code was copied wholesale. But the final solution wouldn't exist without reading all of them.

---

## The Part Where I Think About Whether This Is OK

I've been going back and forth on this. Let me lay out both sides honestly.

**The case that this is fine:** Every fork is public. GitHub's entire ethos is open source — you can see anyone's code, learn from it, build on it. Reading other people's implementations and combining good ideas is basically how all of software engineering works. Nobody signed an NDA. Nobody was promised their code would be private. And I still had to understand each approach, evaluate the tradeoffs, and build something that integrated them coherently. There's real engineering in the synthesis step.

**The case that this is sketchy:** The implicit social contract of a hackathon is that you're competing on your own ideas. When everyone else is heads-down writing original code, and you're systematically surveilling their work and cherry-picking the best parts, you're playing a different game than they think they're playing. The information asymmetry is the issue — not whether the data is technically public, but whether anyone expected it to be exploited this way.

I genuinely don't think there's a clean answer. What I *do* think is that the question is now unavoidable, because of the next part.

---

## Why This Is New

Everything I described could theoretically have been done by hand before AI coding agents. You could have opened 45 browser tabs, read each fork, taken notes, tried to synthesize. In practice, nobody would. The cognitive and time cost was prohibitive, which meant the vulnerability was latent — present but unexploitable.

AI agents changed the economics. Here's what Claude Code made trivial:

- **Scraping at scale**: "Write a script that fetches every fork's main.py from the GitHub API and saves the ones that differ from baseline." One prompt, working script.
- **Automated benchmarking**: "Write a harness that runs each fork's code against the benchmark in isolated temp directories, four at a time." One prompt.
- **Comparative analysis**: "Read the top 5 solutions and explain what each does differently." Instant architectural understanding of code I've never seen before.
- **Directed synthesis**: "Combine the model caching from this fork, the regex extraction from that one, and the prompt compression technique from that one into a single generate_hybrid function." This is the part that would have taken a skilled engineer hours. It took minutes.

The total elapsed time from "I wonder what everyone else is doing" to "I have a 94% solution synthesized from the field" was about two hours. Most of that was waiting for benchmarks to run.

This isn't a Claude Code flex. Cursor, Copilot Workspace, Windsurf, Devin — any of them could do this. The point is that **coding agents turn public code into a queryable, executable knowledge base**. The barrier between "information is technically accessible" and "information is practically exploitable" has collapsed.

---

## What I Actually Submitted

To be clear about what I *didn't* do: I had Rosh2403's 100% solution sitting in my `fork_solutions/` directory. I could have submitted it as-is — or changed some variable names and called it mine — and placed at the top of the leaderboard. That wasn't the point. I wasn't trying to win by laundering someone else's work. I wanted to see what happens when you treat an entire field of competitors as a dataset and run selection and recombination over their ideas.

Even the 94% synthesized version felt off. The hackathon's stated goal was to explore intelligent routing between on-device and cloud inference — to help Cactus Compute understand how developers think about the edge-cloud boundary. Submitting a regex Frankenstein felt like missing the point.

So I also built a principled version. FunctionGemma runs on every request as the primary decision-maker. Tool relevance ranking narrows the model's context. The model's confidence score drives the cloud routing decision — high confidence stays on-device, low confidence escalates to Gemini. Regex is used only as a surgical supplement: when the model produces structurally valid output but gets a numeric argument wrong (the 270M model sometimes hallucinates "15 minutes" when you said "5 minutes"), direct text extraction corrects the value.

That version scored 88.6%. Lower, but defensible. The model is actually making decisions. The routing is actually intelligent. It's the version I'd want to present to the Cactus team and say "here's what I learned about when FunctionGemma needs help."

I submitted both. Neither won. The leaderboard was topped by two teams with 100% scores and 0ms inference times — pure regex, no model, same strategy as the top two forks I'd benchmarked. Make of that what you will.

---

## Recommendations (the Responsible Disclosure Part)

If you're organizing a hackathon that uses public GitHub forks as the submission mechanism, here's what I'd think about now:

**1. Private repos or private submission channels.** The simplest fix. If forks are private, the attack surface disappears. GitHub doesn't support private forks of public repos natively, but you can have participants clone (not fork) into private repos and submit via a form or CI pipeline.

**2. Delayed visibility.** Forks could be created in a GitHub Organization with restricted visibility until after the deadline. Participants can push freely; others can't browse.

**3. Hidden evaluation sets.** The hackathon already had a remote leaderboard with (presumably) different test cases. This is good. But if the local benchmark covers enough of the problem space that regex can ace it, participants will optimize for the local benchmark — and fork surveillance lets you see who cracked it.

**4. Originality checks.** Diff submitted code against all other submissions. High similarity between two teams that didn't collaborate is a signal. AST-level comparison would catch refactored copies.

**5. Acknowledge the new threat model.** Hackathon rules were written for an era where reading 45 codebases in two hours was humanly impossible. That era ended. Rules and honor codes should explicitly address automated analysis of other participants' public submissions. Not because it's necessarily wrong — but because everyone should be playing the same game.

---

## Coda

I keep thinking about a line from [Gwern](https://gwern.net/): "The best way to predict the future is to look at what the nerds are doing on weekends." The nerds now have agents that can write scrapers, run benchmarks, and synthesize code while they eat lunch. Any system that depends on practical obscurity — "yes, the data is public, but nobody would actually go through all of it" — is living on borrowed time.

I don't think what I did was cheating, exactly. But I don't think it was entirely *not* cheating either. It was an alternative strategy that exploits a structural vulnerability in the competition format, made newly viable by AI tooling that didn't exist a year ago. I'm writing about it because I think the right response isn't embarrassment or denial — it's adaptation. Know what's possible. Design accordingly.

If you're a hackathon organizer: the forks are public, and the agents are watching.

---

*Code for the full pipeline (scraper, benchmarker, synthesizer) is on [GitHub](https://github.com/qsimeon/functiongemma-hackathon). The hackathon was organized by [AI Tinkerers Boston](https://boston.aitinkerers.com/) in partnership with [Cactus Compute](https://cactuscompute.com/) and [Google DeepMind](https://deepmind.google/).*
