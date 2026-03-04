---
title: "How We Won a BCI Hackathon: Decoding Brain Signals on the Edge"
date: 2026-01-24
tags: [neuroscience, machine-learning, bci, signal-processing, hackathon]
excerpt: "Team MindMeld placed 1st at BrainStorm 2026 by decoding 1024-channel brain recordings in real-time on edge hardware. Here's the full technical breakdown of our winning approach."
---

Team **MindMeld** took first place in Track 1 of [BrainStorm 2026](https://brainstormhackathon.com), a two-day BCI hackathon hosted by [Precision Neuroscience](https://www.precisionneuro.io/) at the Microsoft NERD Center in Boston. Ten teams of graduate students and postdocs competed. This is the technical breakdown of what we built and why it worked.

---

## The Problem

Given a stream of voltage recordings from 1024 electrodes implanted on an animal's auditory cortex, classify what sound frequency the subject is hearing — one sample at a time, in real time.

The challenge runs deeper than accuracy. Your model must operate on **edge hardware**: low power, limited memory, compute-constrained. The final score is a composite of three weighted metrics:

| Metric | Weight | Formula |
|---|---|---|
| Balanced Accuracy | 50% | `balanced_acc × 50` |
| Prediction Lag | 25% | `exp(-6 × lag_ms / 500) × 25` |
| Model Size (MB) | 25% | `exp(-4 × size_mb / 5) × 25` |

The exponential penalties on lag and size are aggressive on purpose. A 5 MB model instead of 1 MB costs ~12 points. A 50ms lag instead of 10ms costs ~8 points. You can't just maximize accuracy — every engineering decision has to be weighed against all three dimensions.

One additional hard constraint: **strict causal inference**. Real BCIs can't see the future. The evaluation harness feeds data sample by sample; your model can maintain a history buffer but cannot use any future data points or bidirectional filters.

---

## The Data

The training set is 90,386 timesteps at 1000 Hz — roughly 90 seconds of recording — across 1024 channels, stored as float32.

**9 target classes**, representing the frequency of the auditory stimulus in Hz:

```
0 Hz    (silence): 60,454 samples — 67%
120 Hz:             3,670 samples —  4%
224 Hz:             3,668 samples —  4%
421 Hz:             3,674 samples —  4%
789 Hz:             3,853 samples —  4%
1479 Hz:            3,851 samples —  4%
2772 Hz:            3,853 samples —  4%
5195 Hz:            3,697 samples —  4%
9736 Hz:            3,666 samples —  4%
```

The 16.5:1 imbalance between silence and each tone class is the first thing that will destroy an unprepared model. A model that predicts silence constantly gets 67% raw accuracy but 11% balanced accuracy — and the competition scores balanced accuracy.

One signal processing note worth flagging: the sampling rate is 1000 Hz, so the Nyquist frequency is 500 Hz. The highest stimulus (9736 Hz) aliases into the recordable band. The model doesn't need to know the physical frequency — it just needs to learn the distinct cortical response pattern that each stimulus produces, including the aliased ones.

Signal characteristics that informed our preprocessing choices:
- Mean voltage: -0.23 µV, std: 112.66 µV
- 93.9% of signal power is in 0–30 Hz (LFP dominates)
- Signal is spatially sparse: ~250 of the 1024 channels account for 50% of total power

---

## The Approach

Our pipeline has three components: dimensionality reduction, a compact convolutional architecture, and a training strategy tuned for this specific problem.

### 1. PCA Channel Reduction

Feeding all 1024 raw channels into a neural network creates two problems: the model becomes large (each weight matrix scales with channel count) and generalization suffers (most channels carry redundant or irrelevant information on this task).

We fit PCA on the training data and project from 1024 channels down to 32 principal components. This does two useful things simultaneously. First, it compresses the model: downstream weight matrices are 32-wide instead of 1024-wide, dramatically reducing parameter count and file size. Second, it denoises: the top 32 PCs capture the most structured, consistent covariance across the electrode array, effectively filtering out noise-dominated directions.

At inference, PCA is a single matrix multiply — negligible latency overhead.

### 2. EEGNet Architecture

We used EEGNet ([Lawhern et al., 2018](https://arxiv.org/abs/1611.08024)), a compact CNN designed specifically for EEG/ECoG-based BCIs. The key idea is factoring the spatiotemporal convolution into two sequential steps: a temporal filter that learns *when* features occur, followed by a depthwise spatial filter that learns *which channel combinations* matter. This factorization gives EEGNet its parameter efficiency — it avoids the explosion of parameters that a full spatiotemporal convolution would require.

```
Input: (batch, 1, channels=32, time=1600)
    ↓
Block 1 — Temporal conv (1 × 800): learn spectrotemporal patterns
    ↓
Block 2 — Depthwise spatial conv (32 × 1): learn channel combinations
    ↓  AvgPool(1, 4)
Block 3 — Separable conv + pointwise: combine learned features
    ↓  AvgPool(1, 8)
Flatten → Linear → 9 classes
```

The aggressive average pooling in Blocks 2 and 3 is what keeps latency low even with a large input window — the temporal dimension is decimated early, so the expensive operations operate on a much smaller representation.

### 3. Training Strategy

**Class-weighted loss.** With 16:1 imbalance, standard cross-entropy collapses to predicting silence. We weight the loss inversely proportional to class frequency, which forces the model to treat each class equally during training.

**Large temporal context window.** This was our most important finding. EEGNet operates on a sliding causal window of past samples. We set `window_size=1600` — 1.6 seconds of context. The naive choice is a small window (128ms) for speed, but auditory cortex responses to sustained tones are slow-building patterns. A short window catches only the onset transient; a long window captures the full sustained oscillatory response, making classification substantially easier.

**Training on the full dataset for the final submission.** Once we settled on the best configuration using the provided validation split, we retrained on the combined train + validation data before the final push.

Final hyperparameters: `projected_channels=32`, `window_size=1600`, `F1=8`, `D=2`, `batch_size=64`.

---

## The Critical Insight: Window Size vs. Latency

The assumption most teams made — and the one worth directly challenging — is that a larger input window means higher latency.

For EEGNet, that's not true.

We tested two configurations directly:

| Configuration | Balanced Accuracy | Inference Latency |
|---|---|---|
| 128ms window | ~0.67 | <1ms |
| 1600ms window | ~0.87 | <1ms |

**Same latency. +20% accuracy.**

Why? EEGNet's average pooling layers decimate the time dimension early in the network. By the time the input reaches the separable convolution block, a 1600-sample window has been reduced to ~25 samples. The forward pass cost is dominated by the initial convolution and the final linear layer — neither of which scales strongly with input window length.

The PCA projection runs in constant time. The bottleneck at inference is memory bandwidth and a few matrix operations, not window size.

This asymmetry — where temporal history is cheap to include but critical for accuracy — generalizes beyond this specific problem. In any streaming BCI task where neural responses are slow relative to the sampling rate, it is worth profiling the actual latency before assuming that window size is a bottleneck.

---

## Results

**1st place, Track 1, BrainStorm 2026.** Final score: **91.7 / 100** — 22.5 points ahead of second place.

| | mindmeld | 2nd place (synapse) |
|---|---|---|
| **Total** | **91.7** | 69.2 |
| Accuracy (50 pts) | 47.1 | 30.9 |
| Latency (25 pts) | 23.8 | 15.4 |
| Size (25 pts) | 20.8 | 23.0 |

Balanced accuracy: **94.2%** (47.1/50). Inference latency: **<5ms**. Model size: **~0.2 MB**.

The remaining headroom is in model size — the serialized PCA components add weight to the checkpoint — and in accuracy on the rarer tone classes where limited training data makes generalization harder.

Code: [github.com/qsimeon/brainstorm-track1-public](https://github.com/qsimeon/brainstorm-track1-public)

```bash
git clone https://github.com/qsimeon/brainstorm-track1-public
cd brainstorm-track1-public
make install
uv run python examples/train_eegnet.py \
    --window-size 1600 \
    --projected-channels 32 \
    --batch-size 64
```

---

## Takeaways

**Temporal context is cheap.** Don't assume window size drives latency. Profile it. For convolutional architectures with pooling, the cost scales much less than linearly.

**PCA is underrated for high-density arrays.** In micro-ECoG recordings, most structured signal lives in a low-dimensional subspace. PCA compression simultaneously reduces model size, speeds up inference, and often improves generalization.

**Balanced accuracy and class weighting are non-negotiable on imbalanced neural data.** Track balanced accuracy from the start, not just raw accuracy. Weight your loss accordingly.

**Domain-specific architectures beat general ones in the small-data regime.** EEGNet's inductive biases — temporal before spatial, explicit pooling — are directly matched to the structure of ECoG data. With 90 seconds of training data, that match matters more than raw model capacity.

---

**[Full illustrated version with architecture diagrams, charts, and leaderboard →](/brainstorm_bci_blog.html)**

---

*Authored by Quilee Simeon. Team MindMeld: Quilee Simeon, Dennis Loevlie, Raghav Gali, Rohan Bhatane, Shravankumar Janawade, Sriram G. — BrainStorm 2026, Track 1 Neural Decoder Challenge, hosted by [Precision Neuroscience](https://www.precisionneuro.io/).*
