---
title: "GrowLab: Scaling Laws Assume Model Size Is Constant. What If It Grows?"
date: 2026-08-02
permalink: /blog/growlab/
tags: [machine-learning, scaling-laws, language-models, agents, autonomous-research, hackathon]
excerpt: "Training compute is the area under the parameter-count curve, and a rectangle is only one shape with a given area. We built a harness where the growth schedule is a searchable parameter, handed it to an autonomous research agent, and then spent the last hours of the build trying to break our own headline. Two of three claims did not survive."
---

A scaling law answers a narrow, useful question: given a fixed compute budget *C*, how many parameters *N* should the model have, and how many tokens *D* should it see? Chinchilla and its successors answer that well, and the answer shapes how essentially every modern language model is provisioned.

But look at what every one of those laws quietly assumes. *N* is a single number, fixed at step zero and held there until the run ends. That is not a finding — nobody ever ran the experiment that justified it. It is simply how models are built.

Now notice what compute actually costs. Each optimizer step spends roughly `6N` floating-point operations per token, so the bill for a run is the integral of *N* over the run: **training compute is the area under the parameter-count curve.** If *N* is constant, that area is a rectangle — one shape among infinitely many with the same area.

So the question underneath this project is not "how big should the model be?" It is:

> Given compute *C*, what **shape** should *N(t)* trace?

<figure style="display:block; margin:2.2em 0;">
<svg viewBox="0 0 760 300" width="100%" role="img" aria-labelledby="f1t" style="max-width:100%;height:auto;overflow:visible">
<title id="f1t">Two parameter-count trajectories with equal area under the curve</title>
<g fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-dasharray="4 5">
<line x1="40" y1="54.4" x2="730" y2="54.4"/>
<line x1="40" y1="210.9" x2="730" y2="210.9"/>
</g>
<g fill="currentColor" fill-opacity="0.55" font-size="11" font-family="inherit" text-anchor="end">
<text x="34" y="58">5.9M</text>
<text x="34" y="214">1.2M</text>
</g>
<rect x="40" y="54.4" width="247.3" height="195.6" fill="#3987e5" fill-opacity="0.16"/>
<path d="M40,250 L40,54.4 L287.3,54.4 L287.3,250" fill="none" stroke="#3987e5" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M410,250 L410,210.9 L430.3,210.9 L430.3,176.6 L450.7,176.6 L450.7,162 L471,162 L471,106.6 L491.3,106.6 L491.3,80.5 L511.6,80.5 L511.6,54.4 L705.6,54.4 L705.6,250 Z" fill="#d95926" fill-opacity="0.16"/>
<path d="M410,210.9 L430.3,210.9 L430.3,176.6 L450.7,176.6 L450.7,162 L471,162 L471,106.6 L491.3,106.6 L491.3,80.5 L511.6,80.5 L511.6,54.4 L705.6,54.4 L705.6,250" fill="none" stroke="#d95926" stroke-width="2.5" stroke-linejoin="round"/>
<g stroke="currentColor" stroke-opacity="0.4" stroke-width="1">
<line x1="40" y1="250" x2="350" y2="250"/>
<line x1="410" y1="250" x2="720" y2="250"/>
</g>
<g font-family="inherit" font-size="12.5" font-weight="600">
<text x="40" y="28" fill="#3987e5">CONSTANT N — the assumption</text>
<text x="410" y="28" fill="#d95926">GROWING N(t) — same compute</text>
</g>
<g fill="currentColor" fill-opacity="0.6" font-size="11" font-family="inherit">
<text x="46" y="72">5.9M parameters, 2,433 steps</text>
<text x="416" y="240">1.2M → 5.9M, 2,908 steps (+19%)</text>
<text x="40" y="270">training step →</text>
<text x="410" y="270">training step →</text>
</g>
<g fill="currentColor" fill-opacity="0.45" font-size="10.5" font-family="inherit" text-anchor="middle">
<text x="163" y="160">area = compute</text>
<text x="575" y="180">same area</text>
</g>
</svg>
<figcaption style="text-align:center;font-size:0.85em;font-style:italic;opacity:0.7;margin-top:0.7em;">The two shaded regions are the same size. Under the 6N approximation the areas of these two real trajectories agree to within 0.001% — both runs spent 4×10<sup>14</sup> FLOPs. Staying small early is what buys the growing run 2,908 optimizer steps instead of 2,433.</figcaption>
</figure>

The intuition for why the rectangle might be the wrong shape is simple. Early in training a model is learning cheap statistics — which tokens are frequent, that a space usually follows a word — and that knowledge needs almost no capacity. Carrying 5.9M parameters through those steps is paying for a machine you are not yet able to use. Start smaller, buy more steps with the same operations, and add capacity later, when there is something worth spending it on.

## The system, which is really the point

The scientific question is old-fashioned. How we attacked it is not.

**GrowLab** is a small FLOP-budgeted training harness. The one line of code that matters is the loop condition: it accumulates `flops_per_token(model) × tokens` each step and stops when the budget is exhausted, so step count is an *output* of the trajectory rather than an input. Budget by wall-clock and you measure how well your hardware packs small matmuls; budget by steps and you have silently handicapped the growing arm, which is smaller for part of the run and therefore spends strictly less compute. Only a FLOP budget asks the question we meant to ask.

The second design decision: the growth schedule is a **parameter**, not a preset. A string like `200:width:192,400:depth,600:width:256,800:depth,1000:depth` means *widen to 192 dimensions at step 200, add a layer at step 400*, and so on. That string is a search space, and search spaces are things you can hand to an agent.

Which is exactly what happened. Two platforms were involved, doing two completely different jobs.

**[AutoLab](https://app.autolab.ai/projects/qsimeon/growlab) was the researcher.** Its control node holds an LLM agent, an objective ("minimise mean validation loss at a fixed 4×10<sup>14</sup> FLOP budget by choosing the trajectory *N(t)*"), and a set of constraints. The agent writes a schedule into `grow/experiment.py`, commits it, and queues the job. My laptop — attached as an execution node — picks it up, trains three seeds, and prints one line: `OBJECTIVE 4.07450`. The agent reads that float, marks the experiment merged or discarded, and writes the next hypothesis. It ran **eight experiments autonomously**; after the first, no human chose what to try. It reproduced our hand-built schedule exactly, beat it by shifting growth 50 steps earlier, then stopped itself with the status *"remaining variation is seed noise."* An agent that declines to keep optimising below the noise floor is doing the right thing.

What AutoLab does **not** do: it supplies no compute — the laptop is the only silicon in the project — and it never sees a loss curve, a growth event, or a trajectory. Its entire view of a seven-minute run is one number on the last line of stdout.

**[Maritime](https://api.maritime.sh/a/961c500c-7530-4c1a-b8cd-d276b7bec384/) was the front door.** It builds the repo's Dockerfile into a serverless micro-VM and serves the results dashboard on a public URL. That is the whole job, and it is the reason the demo survives a laptop lid closing or a conference-room wifi outage. What Maritime does **not** do: no training, no GPU, no LLM, no AutoLab credentials, no knowledge that an experiment exists.

The structurally important fact is that **the two platforms never talk to each other.** They are not two halves of a pipeline; they are independent consumers of the same repository, and the only thing crossing between them is a single JSON file the laptop writes. If Maritime is down the science continues. If the agent has finished or the login expired, the dashboard still renders.

<figure style="display:block; margin:2.2em 0;">
<svg viewBox="0 0 760 430" width="100%" role="img" aria-labelledby="f3t" style="max-width:100%;height:auto;overflow:visible">
<title id="f3t">System diagram: AutoLab, the laptop execution node, and Maritime</title>
<defs>
<marker id="glArrO" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#d95926"/></marker>
<marker id="glArrN" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0f9d8f"/></marker>
<marker id="glArrB" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#3987e5"/></marker>
</defs>
<rect x="14" y="26" width="290" height="112" rx="10" fill="#d95926" fill-opacity="0.1" stroke="#d95926" stroke-opacity="0.5"/>
<text x="32" y="52" fill="#d95926" font-size="12.5" font-weight="600" font-family="inherit">AUTOLAB — the researcher</text>
<g fill="currentColor" fill-opacity="0.65" font-size="11" font-family="inherit">
<text x="32" y="74">LLM agent holding the objective.</text>
<text x="32" y="92">Proposes N(t), dispatches, reads</text>
<text x="32" y="110">one scalar, decides what is next.</text>
<text x="32" y="130" fill-opacity="0.75">No GPU. No curves. No dashboard.</text>
</g>
<rect x="456" y="26" width="290" height="112" rx="10" stroke="currentColor" stroke-opacity="0.4" fill="currentColor" fill-opacity="0.03"/>
<text x="474" y="52" fill="currentColor" font-size="12.5" font-weight="600" font-family="inherit">LAPTOP — the only compute</text>
<g fill="currentColor" fill-opacity="0.65" font-size="11" font-family="inherit">
<text x="474" y="74">FLOP-budgeted training loop.</text>
<text x="474" y="92">3 seeds, ~2,900 steps, ~7 min.</text>
<text x="474" y="110">Writes runs/*.jsonl trajectories.</text>
<text x="474" y="130" fill-opacity="0.75">Attached with `autolab serve`.</text>
</g>
<path d="M306,62 L450,62" stroke="#d95926" stroke-width="1.8" fill="none" marker-end="url(#glArrO)"/>
<text x="378" y="54" fill="#d95926" font-size="10" text-anchor="middle" font-family="inherit">writes SCHEDULE, queues run</text>
<path d="M450,104 L308,104" stroke="#d95926" stroke-width="1.8" fill="none" marker-end="url(#glArrO)"/>
<text x="379" y="122" fill="#d95926" font-size="10" text-anchor="middle" font-family="inherit">OBJECTIVE 4.07450</text>
<path d="M601,140 L601,196" stroke="#0f9d8f" stroke-width="1.8" fill="none" marker-end="url(#glArrN)"/>
<rect x="466" y="202" width="270" height="52" rx="9" fill="#0f9d8f" fill-opacity="0.1" stroke="#0f9d8f" stroke-opacity="0.5"/>
<text x="601" y="224" fill="#0f9d8f" font-size="12" font-weight="600" text-anchor="middle" font-family="inherit">web/data.json</text>
<text x="601" y="242" fill="currentColor" fill-opacity="0.6" font-size="10.5" text-anchor="middle" font-family="inherit">the only artifact that crosses</text>
<path d="M601,256 L601,306" stroke="#3987e5" stroke-width="1.8" fill="none" marker-end="url(#glArrB)"/>
<rect x="456" y="312" width="290" height="98" rx="10" fill="#3987e5" fill-opacity="0.1" stroke="#3987e5" stroke-opacity="0.5"/>
<text x="474" y="338" fill="#3987e5" font-size="12.5" font-weight="600" font-family="inherit">MARITIME — the front door</text>
<g fill="currentColor" fill-opacity="0.65" font-size="11" font-family="inherit">
<text x="474" y="360">Micro-VM built from the Dockerfile.</text>
<text x="474" y="378">Serves the dashboard on a public URL.</text>
<text x="474" y="398" fill-opacity="0.75">No training. No GPU. No LLM.</text>
</g>
<path d="M159,146 L159,361 L448,361" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="5 5" fill="none"/>
<circle cx="240" cy="361" r="13" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5"/>
<path d="M231,352 L249,370" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.5"/>
<text x="264" y="381" fill="currentColor" fill-opacity="0.55" font-size="11" font-family="inherit">the two platforms</text>
<text x="264" y="397" fill="currentColor" fill-opacity="0.55" font-size="11" font-family="inherit">never talk to each other</text>
</svg>
<figcaption style="text-align:center;font-size:0.85em;font-style:italic;opacity:0.7;margin-top:0.7em;">Three machines, three jobs. A cloud agent decides <em>what</em> to run; a laptop runs it; a micro-VM shows the result to strangers. Nothing about the science depends on the third, and nothing about the demo depends on the first.</figcaption>
</figure>

## What we measured, and what happened when we checked it

The control is a straight A/B. One arm starts at 6 layers, 256 dimensions (5.9M parameters) and stays there; the other starts at 3 layers, 128 dimensions (1.2M parameters) and grows into the identical final architecture across five events. Both get the same FLOP budget, the same WikiText-103 token stream in the same order, the same fixed evaluation slice, and three seeds.

| arm | val loss | seeds | steps bought |
|---|---|---|---|
| flat (constant *N*) | 4.509 ± 0.015 | 4.525, 4.496, 4.506 | 2,433 |
| **grown** (1.2M → 5.9M) | **4.111** ± 0.053 | 4.080, 4.172, 4.082 | **2,908** |

A gap of 0.397 nats with complete seed separation: the worst grown seed (4.172) still beats the best flat seed (4.496), no overlap. The mechanism is visible in the last column — being small early buys 19% more optimizer steps for the same operations.

That is the number we report now. It is not the number we had at first. **Our first headline was a 0.913-nat gap and "102× more stable".** Both were artifacts of our own design, found by spending the last hours of the build attacking our result instead of polishing it.

The first artifact was the learning rate. Both arms ran at 1e-3, a value inherited from the growing preset. The grown arm begins at 3 layers and 128 dimensions, where 1e-3 is near optimal; the flat arm is 6 layers and 256 dimensions from step zero, where 1e-3 is roughly twice its stable limit. So the "controlled" learning rate was one arm's setting imposed on the other. Given its own best rate, 5e-4, the flat arm scores 4.509 ± 0.015 rather than 5.024 ± 0.532 — the gap halves, and the stability claim does not merely shrink, it **reverses**: at each arm's own learning rate the flat arm is about 3.6× *more* stable than the grown one. What we had reported as "growth buys learning-rate robustness" was one flat seed half-diverging at a rate that model could not take.

The second artifact was worse, because it was baked into the question. Both arms were pinned to finish at 5.9M parameters — same finish line, fair race. But for a 4×10<sup>14</sup> FLOP budget compute-optimal is around 0.6M parameters, so the mandated endpoint is roughly **ten times larger than the budget wants**. Lift the constraint and run a plain flat 1.2M model at the same budget: it scores **3.905**, beating our growth trajectory outright, because at that size the same FLOPs buy 11,811 steps instead of 2,908. (A later per-arm learning-rate sweep put the same model at 3.775 ± 0.008, which only widens the margin.)

<figure style="display:block; margin:2.2em 0;">
<svg viewBox="0 0 760 400" width="100%" role="img" aria-labelledby="f2t" style="max-width:100%;height:auto;overflow:visible">
<title id="f2t">Validation loss against cumulative compute for three runs at an identical FLOP budget</title>
<g stroke="currentColor" stroke-opacity="0.13" stroke-width="1">
<line x1="72" y1="283.3" x2="730" y2="283.3"/><line x1="72" y1="244.7" x2="730" y2="244.7"/>
<line x1="72" y1="206.1" x2="730" y2="206.1"/><line x1="72" y1="167.5" x2="730" y2="167.5"/>
<line x1="72" y1="128.9" x2="730" y2="128.9"/><line x1="72" y1="90.3" x2="730" y2="90.3"/>
<line x1="72" y1="51.7" x2="730" y2="51.7"/>
</g>
<g fill="currentColor" fill-opacity="0.5" font-size="10.5" font-family="inherit" text-anchor="end">
<text x="64" y="287">4.0</text><text x="64" y="248">4.5</text><text x="64" y="210">5.0</text>
<text x="64" y="171">5.5</text><text x="64" y="132">6.0</text><text x="64" y="94">6.5</text><text x="64" y="56">7.0</text>
</g>
<line x1="72" y1="322" x2="730" y2="322" stroke="currentColor" stroke-opacity="0.4"/>
<g fill="currentColor" fill-opacity="0.5" font-size="10.5" font-family="inherit" text-anchor="middle">
<text x="72" y="340">0</text><text x="234" y="340">1e14</text><text x="396" y="340">2e14</text>
<text x="558" y="340">3e14</text><text x="720" y="340">4e14</text>
</g>
<text x="396" y="360" fill="currentColor" fill-opacity="0.6" font-size="11" text-anchor="middle" font-family="inherit">cumulative compute spent (FLOPs)</text>
<text x="18" y="185" fill="currentColor" fill-opacity="0.6" font-size="11" text-anchor="middle" font-family="inherit" transform="rotate(-90 18 185)">validation loss (nats)</text>
<path d="M85.3,57.8 L98.6,58.8 L112,75.6 L125.3,101.8 L138.6,121.8 L151.9,134.1 L165.2,140.1 L178.5,146.8 L191.9,151.5 L205.2,156.2 L218.5,160.5 L231.8,162.9 L245.1,167.0 L258.5,169.6 L271.8,172.8 L285.1,176.7 L298.4,179.8 L311.7,182.0 L325,186.1 L338.4,190.0 L351.7,191.7 L365,196.0 L378.3,198.6 L391.6,200.2 L405,203.0 L418.3,206.2 L431.6,208.2 L444.9,210.5 L458.2,213.0 L471.5,214.2 L484.9,215.7 L498.2,219.1 L511.5,220.0 L524.8,222.7 L538.1,224.3 L551.5,225.3 L564.8,227.5 L578.1,230.4 L591.4,232.9 L604.7,235.0 L618,236.3 L631.4,238.3 L644.7,239.7 L658,241.9 L671.3,243.4 L684.6,244.3 L698,245.5 L711.3,246.3" fill="none" stroke="#3987e5" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M74.7,58.0 L77.5,70.7 L80.2,100.2 L83,119.5 L88,133.0 L93,144.4 L98,151.4 L102.9,159.1 L109,164.5 L115.1,169.4 L121.2,174.1 L127.2,177.9 L136.9,181.3 L146.6,184.3 L165.9,191.6 L177.4,193.4 L188.9,197.5 L200.4,201.2 L211.8,204.7 L225.2,207.0 L238.5,210.3 L251.8,213.3 L265.1,215.3 L278.4,218.4 L291.8,220.6 L305.1,223.5 L318.4,225.5 L331.7,228.4 L345,230.8 L358.3,232.0 L371.7,235.2 L385,235.2 L398.3,238.6 L411.6,240.3 L424.9,242.2 L438.3,243.6 L451.6,246.8 L464.9,247.6 L478.2,249.0 L491.5,249.5 L504.8,251.5 L518.2,252.9 L544.8,257.1 L558.1,259.1 L571.4,262.7 L584.8,265.0 L598.1,266.3 L611.4,269.2 L624.7,270.9 L638,273.0 L651.3,274.6 L664.7,276.6 L678,278.0 L691.3,279.6 L704.6,280.7 L717.9,281.3" fill="none" stroke="#d95926" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M74.7,58.0 L85.7,132.0 L99.4,165.5 L110.4,183.7 L121.4,198.2 L132.3,209.7 L146.1,218.9 L157,223.1 L168,228.4 L179,232.5 L192.7,236.2 L203.7,240.5 L214.6,241.8 L228.3,245.1 L239.3,246.8 L250.3,250.1 L261.3,251.4 L275,253.3 L285.9,254.8 L296.9,256.3 L307.9,257.3 L321.6,258.1 L332.6,259.7 L343.5,260.7 L357.3,262.6 L368.2,263.6 L379.2,264.2 L390.2,265.2 L403.9,265.6 L414.9,267.4 L425.8,268.0 L436.8,268.6 L450.5,269.0 L461.5,270.4 L472.4,271.5 L486.2,272.1 L497.1,273.0 L508.1,274.6 L519.1,275.0 L532.8,275.5 L543.8,277.0 L554.7,277.7 L565.7,278.6 L579.4,280.6 L590.4,282.4 L601.4,282.8 L615.1,284.6 L626,286.3 L637,287.3 L648,289.1 L661.7,290.3 L672.7,291.3 L683.6,292.6 L694.6,293.4 L708.3,294.5 L719.3,294.9" fill="none" stroke="#0f9d8f" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="711.3" cy="246.3" r="3.8" fill="#3987e5"/>
<circle cx="717.9" cy="281.3" r="3.8" fill="#d95926"/>
<circle cx="719.3" cy="294.9" r="3.8" fill="#0f9d8f"/>
<g font-size="11" font-family="inherit">
<rect x="306" y="72" width="24" height="3" rx="1.5" fill="#3987e5"/>
<text x="340" y="78" fill="currentColor" fill-opacity="0.75">flat, 5.9M params — 2,433 steps — final 4.509</text>
<rect x="306" y="98" width="24" height="3" rx="1.5" fill="#d95926"/>
<text x="340" y="104" fill="currentColor" fill-opacity="0.75">grown, 1.2M → 5.9M — 2,908 steps — final 4.111</text>
<rect x="306" y="124" width="24" height="3" rx="1.5" fill="#0f9d8f"/>
<text x="340" y="130" fill="currentColor" fill-opacity="0.75">flat, 1.2M params, unconstrained — 11,811 steps — 3.905</text>
</g>
<text x="340" y="152" fill="currentColor" fill-opacity="0.45" font-size="10.5" font-family="inherit">all three spend exactly 4×10¹⁴ FLOPs; lower is better</text>
</svg>
<figcaption style="text-align:center;font-size:0.85em;font-style:italic;opacity:0.7;margin-top:0.7em;">Growth beats the flat model <em>at the same 5.9M endpoint</em> (orange below blue). Both lose to a flat 1.2M model that was never told where to finish (teal). Curves are the in-run evaluations logged every 50 steps over 20 batches; the quoted final numbers use a 50-batch evaluation and run about 0.05 higher. Seed 0 shown for each arm.</figcaption>
</figure>

So the claim that survives is real but much narrower than the one we started the day with:

> At a fixed FLOP budget, with both arms required to end at 5.9M parameters and each arm at its own best learning rate, **growing into a target size beats starting at that size** — 0.397 nats, with complete seed separation.

The conditions it is hostage to belong in the same breath. It is conditional on an endpoint about ten times larger than compute-optimal. It is 5.9M parameters, roughly 2,900 steps, one laptop. It is three seeds against a kernel-nondeterminism floor of about 0.05 nats on Apple Silicon, which means our four-decimal figures carry about two significant figures of real signal. Growth is not shown to be compute-optimal in general — only to be the better way to *arrive at an oversized model*.

There is a sting in that. The endpoint constraint was enforced in code: any trajectory not ending at exactly 5.9M raises `SystemExit` before its loss is ever reported. So the configuration that actually wins was **structurally unreachable by the agent**. However well it searched, it could not have found it. We handed our researcher a search space that excluded the best known answer.

## The lesson, which is the most valuable thing here

Both errors are the same species. The instinct to hold everything constant and vary one thing is correct as a default, but **fixing a variable only controls it when that variable's optimum does not interact with the treatment.** When the optimum moves with the treatment, fixing it does not neutralise the variable — it silently picks a winner.

Optimal learning rate depends on model size, and our two arms were different sizes for most of training. Sharing a learning rate between them was therefore not a control; it was a handicap applied to whichever arm the shared value fit worse. Fixing the endpoint was the same mistake one level up: the question was *what shape should N(t) trace*, and pinning the terminal value of *N(t)* assumed part of the answer before measuring it.

The practical rule: for any claim of the form "X beats Y," **tune each arm independently and compare best to best.** Anything else measures "X beats Y at Y's bad settings." Safe to fix are the things whose optimum genuinely does not move — dataset, data order, evaluation set, compute budget, seed count. Tuned per arm: learning rate, warmup length, probably batch size.

## What is still open

**Does growth ever beat the compute-optimal flat model, or only oversized endpoints?** This decides whether there is a general result at all. Settling it means sweeping the endpoint and asking whether the grown curve ever dips beneath the flat frontier or merely approaches it from above. Our one probe is inconclusive: a trajectory ending at 2.7M scores 3.787 ± 0.018 against 3.911 ± 0.032 for a flat 2.7M model — a real win at a matched endpoint — but it only ties the best flat model overall (3.775 ± 0.008), inside the noise floor.

**Does any of it survive at real scale?** Chinchilla predicts where growth should fail: at roughly 20 tokens per parameter, a grown model reaches its final size having seen far fewer than 20·*N* tokens *at* that size, so it is structurally undertrained for what it has become. Whether time spent smaller substitutes for those missing tokens is unknown.

**Should growth be triggered rather than scheduled?** Our step numbers have no justification beyond "they worked," and the agent's most productive move was shifting them 50 steps earlier — so timing matters and we did not know the right timing. But "step 200" is not a *reason* to grow. A model should grow when its current size stops being the thing limiting it: a condition, not a clock. Turning that into a measurable trigger would make growth a policy rather than a hyperparameter you must search.

Beyond those: should the model choose width versus depth for itself, and what about **sparsity** — growing into a larger but sparser model, so parameter count rises faster than FLOP count? And one a practitioner asks first: at matched FLOPs the grown arm is **6 to 11% slower in wall-clock**, because small matmuls underutilise the device. The operations are genuinely saved; the seconds are not. Probably a scale artifact, but we have not shown where the wall-clock curve crosses, and reporting only FLOPs would be choosing the metric that flatters us.

---

Built at Sundai Hack #133. The claim we can defend is smaller than the one we announced at hour six, and the project is more interesting for it.

**Code:** [github.com/qsimeon/growlab](https://github.com/qsimeon/growlab) · **The agent's search:** [app.autolab.ai/projects/qsimeon/growlab](https://app.autolab.ai/projects/qsimeon/growlab) · **Live dashboard:** [api.maritime.sh](https://api.maritime.sh/a/961c500c-7530-4c1a-b8cd-d276b7bec384/)
