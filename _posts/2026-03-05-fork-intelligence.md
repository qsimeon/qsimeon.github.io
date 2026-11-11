---
title: "Fork Intelligence: Red-Teaming the Public-Fork Hackathon Format"
date: 2026-03-05
permalink: /blog/fork-intelligence/
tags: [AI, hackathon, claude-code, security, red-team, agents]
excerpt: "At a Google DeepMind x Cactus Compute hackathon, I used Claude Code to scrape every competitor's fork, benchmark all 45 modified solutions, and synthesize a top-scoring submission from the best of them. This is a vulnerability disclosure."
---

This is a vulnerability disclosure for a class of competition I'll call the **public-fork hackathon**: any coding competition where participants submit by forking a public GitHub repository and pushing their solutions to their fork.

I didn't win this hackathon. My pipeline surfaced a solution that scored 100% on the local benchmark, the same pure-regex approach that topped the final leaderboard, and I could have submitted it with trivial modifications. I chose not to, because the meta-game interested me more. I could systematically harvest, evaluate and recombine every competitor's approach into something new, and I wanted to see what that looked like in practice.

I'm writing about it because I think hackathon organizers need to know it's possible. I am not encouraging anyone to go do it. If this post has a genre, it is a red team report whose system under test is the public-fork hackathon format.


## The Hackathon

The event was a [Cactus Compute](https://cactuscompute.com/) x [Google DeepMind](https://deepmind.google/) hackathon hosted by AI Tinkerers in Boston. The challenge was to design a hybrid inference strategy for function calling that routes between FunctionGemma, a 270M-parameter on-device model running through Cactus, and Gemini 2.0 Flash in the cloud. Scoring is a weighted composite of accuracy (F1 score), latency and on-device ratio. The core question is when to trust the tiny local model and when to call the cloud.

Everyone forks the same GitHub repo, modifies one function (`generate_hybrid`) and submits. The repo includes a local benchmark of 30 test cases, and a remote leaderboard evaluates your code server-side.

That is a normal hackathon workflow: fork, hack, submit.

## The Vulnerability

GitHub forks of public repos are public, so every participant's implementation is visible to every other participant, in real time, throughout the competition.

This is less obvious than it sounds, because GitHub's web interface doesn't show a browsable list of all forks. Clicking the fork count on a repo brings up a network graph and your own forks. I wasn't able to find any page where you can scroll through every fork and read its code. The information is public through the API, but someone casually browsing GitHub would be unlikely to stumble into it.

The [GitHub REST API](https://docs.github.com/en/rest/repos/forks) will happily enumerate every fork for you. Once you have the list, the [Contents API](https://docs.github.com/en/rest/repos/contents) will fetch any file from any fork. The core of the scraper is just this:

```python
def get_all_forks():
    """Use the GitHub CLI to paginate through every fork."""
    r = subprocess.run(
        ["gh", "api", f"repos/{REPO}/forks",
         "--paginate", "-q", ".[].full_name"],
        capture_output=True, text=True
    )
    return [l.strip() for l in r.stdout.strip().splitlines() if l.strip()]

def fetch_main_py(repo):
    """Grab a single file from a fork via the Contents API."""
    r = subprocess.run(
        ["gh", "api", f"repos/{repo}/contents/main.py",
         "-q", ".content"],
        capture_output=True, text=True, timeout=15
    )
    if r.returncode != 0 or not r.stdout.strip():
        return None
    return base64.b64decode(r.stdout.strip()).decode("utf-8")
```

Those two functions, a few lines each, return every participant's code. I didn't write them by hand. I described what I wanted to Claude Code, which produced a working script on the first try.

In a pre-agent world none of this would have been worth the effort. Even if you knew the API existed, manually visiting 152 forks, reading each implementation, comparing approaches in your head and trying to run them locally would take more time than writing your own solution. The information was technically accessible but practically useless until AI coding agents changed that equation.

## The Pipeline

The whole pipeline took about 90 minutes to build, with Claude Code writing most of the code.

### Step 1: Scrape every fork

The full script ([`01_fetch_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/01_fetch_forks.py)) paginates through every fork, fetches each fork's `main.py`, diffs the `generate_hybrid` function against the baseline and saves only the forks that actually modified it.

The repo had 152 forks, of which 45 had modified their solution.

```
$ python 01_fetch_forks.py
Fetching fork list for cactus-compute/functiongemma-hackathon ...
Found 152 forks, checking each for modified main.py ...
Saved: 45 modified solutions to fork_solutions/
Skipped: 107 (unchanged from baseline)
```

### Step 2: Benchmark every fork

A second script ([`02_benchmark_forks.py`](https://github.com/qsimeon/functiongemma-hackathon/blob/main/02_benchmark_forks.py)) takes each saved `main.py` and drops it into a temporary directory with a symlink to the Cactus SDK and model weights. It then runs the full 30-case benchmark, parses the output and records the score. With four forks running in parallel, the whole sweep finished in about 20 minutes on my M3 MacBook.

The output is a ranked leaderboard of every competitor's local benchmark performance.

```
$ python 02_benchmark_forks.py
[1/45] Benchmarking Rosh2403 ... 100.0% (0ms avg, 100% on-device)
[2/45] Benchmarking SahilSaxena007 ... 100.0% (0ms avg, 100% on-device)
[3/45] Benchmarking ishaanvijai ... 91.6% (270ms avg, 100% on-device)
...
```

### Step 3: Analyze and synthesize

Once you have a ranked list, you can read the top implementations and understand *why* they scored well. Claude Code makes this fast, since "Read the top 5 fork solutions and explain what each one does differently" is a single prompt.

The top seven:

| # | Who | Score | Avg Time | Strategy |
|---|-----|-------|----------|----------|
| 1 | Rosh2403 | 100.0% | 0ms | Pure regex, no model call |
| 2 | SahilSaxena007 | 100.0% | 0ms | Pure regex, no model call |
| 3 | ishaanvijai | 91.6% | 270ms | Regex-guided prompt compression |
| 4 | elena-kalinina | 89.0% | 343ms | Model-heavy with normalization |
| 5 | avimallick | 88.5% | 344ms | Cross-validates regex vs model |
| 6 | wnwoghd22 | 88.2% | 429ms | Model-heavy |
| 7 | adi-suresh01 | 87.3% | 357ms | Model-heavy |

The two top scorers hit 100% with 0ms inference time. They never call FunctionGemma at all. They match the user's text against the 7 known tool types in the benchmark with regular expressions (regex). That works perfectly on the local test suite. Whether it generalizes to the hidden evaluation set is a different question, but on the known cases regex is unbeatable.

The third-place solution from ishaanvijai interested me most. It uses regex to *identify* which tools are likely needed, then passes only those tools to FunctionGemma with stripped-down descriptions and a tiny token budget. The model still runs, so the solution earns the on-device credit, while regex narrows the context so that the model runs faster and more accurately. In this design regex serves as a lens for the model and leaves the model in place.

### Step 4: Build my own

With full intelligence on the field, the last step was synthesis. I pulled in these pieces:

- **Model caching** from ishaanvijai (load the model once per process instead of once per call, which saves ~600ms per invocation after the first)
- **Regex extraction** covering all 7 tool types, with clause splitting for multi-intent queries and pronoun resolution
- **Prompt compression** from ishaanvijai (when regex is confident, pass only the matched tools with stripped descriptions)
- **Score-based selection**, which runs both regex and the model, compares the structural quality of their outputs and picks the better result
- **Type coercion and validation** from multiple forks (fixing string-to-int mismatches and normalizing time formats)

The result scored **94% on the local benchmark**, with 100% F1 on all 30 cases, 100% on-device and ~200ms average latency. That beats every fork that still called the model. The best of those, ishaanvijai's, scored 91.6%.

I copied no single competitor's code wholesale, yet the final solution wouldn't exist without reading all of them.


## Threat Assessment

In security terms, this is a low-skill, high-impact exploit. You don't need to know how the GitHub API works or how to write a benchmarking harness. You don't even need to be a particularly good programmer. The agent builds it from a plain-English description of what you want. Someone who has never written a scraper before could reproduce the entire pipeline.

The vulnerability is structural. Participants aren't doing anything wrong, since they are following the competition's own instructions to fork the repo and push their code. The format makes every submission visible to every other participant by design. Only the cost of exploiting that visibility has changed. It used to be high enough that nobody would bother. Now it's two hours, most of which is idle.

There are two ways to think about the ethics.

Every fork is public, and GitHub's whole thing is open source. Reading other people's implementations and combining good ideas is how software engineering works. Nobody signed a non-disclosure agreement (NDA), and nobody was promised that their code would be private. The synthesis step also involves real engineering.

The implicit contract of a hackathon, though, is that you compete on your own ideas. Everyone else was heads-down writing original code while I was systematically surveilling their work and cherry-picking the best parts. The ethical question turns on whether anyone expected their public code to be used like this, and technical availability does not settle it. I was playing a different game from the one everyone else thought we were playing.

I don't think there's a clean answer. I do think the question matters, which is why I'm disclosing it instead of keeping it to myself.


## The Role of AI Coding Agents

Everything I described could in theory have been done by hand before AI coding agents existed. You would open 45 browser tabs (assuming you even found the forks, which GitHub's UI doesn't make easy), read each implementation, take notes and try to synthesize. Nobody would actually do that. The time cost was high enough to keep the vulnerability dormant.

AI coding agents have gotten good enough to collapse that barrier. The prompts were almost comically simple:

- "Write a script that fetches every fork's main.py from the GitHub API and saves the ones that differ from baseline." That one prompt produced a working script.
- "Write a harness that runs each fork's code against the benchmark in isolated temp directories, four at a time." This also took one prompt.
- "Read the top 5 solutions and explain what each does differently." The answer gave me an instant architectural understanding of code I'd never seen.
- "Combine the model caching from this fork, the regex extraction from that one, and the prompt compression technique from that one into a single function." This took minutes, where a skilled engineer would have needed hours.

The total elapsed time from "I wonder what everyone else is doing" to "I have a 94% solution synthesized from the field" was about two hours. Most of that time went to waiting for benchmarks to run.

Claude Code is one of several tools that can do this. Cursor, Copilot Workspace and Windsurf could all do it too. The tooling keeps getting better and cheaper. If this was possible in two hours today, it'll be possible in thirty minutes next year.


## My Submissions

I had Rosh2403's 100% solution sitting in my `fork_solutions/` directory. I could have submitted it as-is or with a few variable names changed, and likely tied for the top of the leaderboard. I didn't, because I wasn't interested in laundering someone else's work. I wanted to see what happens when you treat a field of competitors as a dataset and run selection and recombination over their ideas.

Even the 94% synthesized version didn't feel right to submit. The hackathon was about exploring intelligent routing between on-device and cloud inference, and about helping Cactus Compute understand how developers reason about the edge-cloud boundary. Submitting a regex Frankenstein missed the spirit of the thing.

So I also built a principled version. FunctionGemma runs on every request as the primary decision-maker. Tool relevance ranking narrows the model's context. The model's confidence score drives cloud routing: high-confidence requests stay on-device, and low-confidence requests escalate to Gemini. Regex serves only as a surgical supplement for one failure mode, in which the 270M model picks the right tool but hallucinates the wrong argument value ("15 minutes" when you said "5 minutes"). Direct text extraction corrects those cases.

That version scored 88.6%. The score is lower but defensible, because the model makes real decisions and the routing is actually intelligent. It's the version I'd want to walk through with the Cactus team.

I submitted both versions. Neither won. Two teams topped the leaderboard with 100% scores and 0ms inference times by using pure regex and no model, the same approach as the top two forks I had already benchmarked.


## Recommended Mitigations

If you're organizing a hackathon that uses public GitHub forks as the submission mechanism, here are five mitigations, ranked roughly by effectiveness:

**1. Use private repos or private submission channels.** Private forks remove the attack surface. GitHub doesn't natively support private forks of public repos, but you can have participants clone the repo (instead of forking it) into private repos and submit through a form or a continuous integration (CI) pipeline.

**2. Delay visibility.** Create forks in a GitHub Organization with restricted visibility until after the deadline. Participants can push freely while others can't browse their work.

**3. Use hidden evaluation sets.** This hackathon already had a remote leaderboard with (presumably) different test cases, which is good. If the local benchmark covers enough of the problem space for regex to ace it, though, people will optimize for the local benchmark, and fork surveillance tells them who already cracked it.

**4. Run originality checks.** Diff submitted code against all other submissions. High similarity between teams that did not collaborate is a signal. A comparison at the level of the abstract syntax tree (AST) would catch refactored copies.

**5. Update your rules.** Hackathon honor codes were written when reading 45 codebases in two hours was humanly impractical. That assumption no longer holds. Rules should explicitly address automated analysis of other participants' public submissions. Such analysis is not necessarily wrong. The rules should still address it so that everyone plays the same game with the same understanding of what's allowed.


## Coda

Any system that depends on practical obscurity is on borrowed time. AI agents created no new information here. They made existing public information operationally useful at a speed that nobody planned for.

I don't think what I did was cheating. I also don't think it was entirely clean. It exploits a structural vulnerability in the competition format, made practical by AI tooling that has gotten dramatically better in the last year or two. I'm disclosing it because I think the right move is to talk about it openly so organizers can adapt, instead of keeping it quiet and letting it keep working.

Someone else will do this at the next public-fork hackathon and at the one after that. The question for organizers is whether the format evolves before that happens.

If you run hackathons, know that the forks are public and that the agents can read all of them.


*Code for the full pipeline (scraper, benchmarker, synthesizer) is on [GitHub](https://github.com/qsimeon/functiongemma-hackathon). The hackathon was organized by [AI Tinkerers Boston](https://boston.aitinkerers.com/) in partnership with [Cactus Compute](https://cactuscompute.com/) and [Google DeepMind](https://deepmind.google/).*
