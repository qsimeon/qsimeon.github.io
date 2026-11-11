---
title: "How We Won a BCI Hackathon: Decoding Brain Signals on the Edge"
date: 2026-03-04
tags: [neuroscience, machine-learning, bci, signal-processing, hackathon]
excerpt: "Team MindMeld placed 1st at BrainStorm 2026 by decoding 1024-channel brain recordings in real time on edge hardware. This post is the full technical breakdown of our winning approach."
---

Team **MindMeld** took first place in Track 1 of [BrainStorm 2026](https://brainstormhackathon.com), a two-day brain-computer interface (BCI) hackathon hosted by [Precision Neuroscience](https://www.precisionneuro.io/) at the Microsoft NERD Center in Boston. Ten teams of graduate students and postdocs competed. This post explains what we built and why it worked.

---

## The Problem

The input is a stream of voltage recordings from 1024 electrodes implanted on an animal's auditory cortex. The task is to classify which sound frequency the subject is hearing, one sample at a time and in real time.

Accuracy is only part of the challenge. The model must run on **edge hardware**, meaning a device with low power, limited memory and little compute. The final score combines three weighted metrics:

| Metric | Weight | Formula |
|---|---|---|
| Balanced Accuracy | 50% | `balanced_acc × 50` |
| Prediction Lag | 25% | `exp(-6 × lag_ms / 500) × 25` |
| Model Size (MB) | 25% | `exp(-4 × size_mb / 5) × 25` |

The exponential penalties on lag and size are steep on purpose. A 5 MB model instead of 1 MB costs ~12 points, and a 50ms lag instead of 10ms costs ~8 points. Every engineering decision therefore has to be weighed against all three metrics, with accuracy as only one of them.

The task adds one hard constraint, **strict causal inference**, because a real BCI cannot see the future. The evaluation harness feeds data one sample at a time. A model can keep a buffer of past samples but cannot use future data points or bidirectional filters.

---

## The Data

The training set holds 90,386 timesteps sampled at 1000 Hz, roughly 90 seconds of recording, across 1024 channels stored as float32.

The data has **9 target classes**: silence (0 Hz) and eight frequencies of the auditory stimulus, in Hz.

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

The 16.5:1 imbalance between silence and each tone class is the first trap for an unprepared model. A model that always predicts silence gets 67% raw accuracy but only 11% balanced accuracy. Balanced accuracy, which averages recall over the classes, is the metric the competition scores.

One signal-processing detail matters here: the sampling rate is 1000 Hz, so the Nyquist frequency is 500 Hz, and the highest stimulus (9736 Hz) aliases into the recordable band. The model does not need the physical frequency. It only needs to learn the distinct cortical response that each stimulus produces, including the aliased ones.

Signal characteristics that informed our preprocessing choices:
- Mean voltage: -0.23 µV, standard deviation: 112.66 µV
- 93.9% of signal power is in 0–30 Hz, where the local field potential (LFP) dominates
- Signal is spatially sparse: ~250 of the 1024 channels account for 50% of total power

---

## The Approach

Our pipeline has three parts: dimensionality reduction, a compact convolutional architecture and a training strategy tuned for this problem.

### 1. PCA Channel Reduction

Feeding all 1024 raw channels into a neural network causes two problems. The model gets large, because each weight matrix scales with the channel count. Generalization also suffers, because most channels carry redundant or irrelevant information for this task.

We fit principal component analysis (PCA) on the training data and project the 1024 channels down to 32 principal components (PCs). This does two useful things at once. First, it compresses the model by making downstream weight matrices 32 wide instead of 1024 wide, which sharply reduces the parameter count and file size. Second, it removes noise: the top 32 PCs capture the most structured and consistent covariance across the electrode array, so the noise-dominated directions drop out.

At inference, PCA is a single matrix multiply, which adds negligible latency.

### 2. EEGNet Architecture

We used EEGNet ([Lawhern et al., 2018](https://arxiv.org/abs/1611.08024)), a compact convolutional neural network (CNN) designed for BCIs based on electroencephalography (EEG) or electrocorticography (ECoG). Its key idea is to split the spatiotemporal convolution into two sequential steps. A temporal filter learns *when* features occur, and a depthwise spatial filter then learns *which channel combinations* matter. This factorization makes EEGNet parameter-efficient, since it avoids the explosion of parameters that a full spatiotemporal convolution would require.

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

The aggressive average pooling in Blocks 2 and 3 keeps latency low even with a large input window. It decimates the temporal dimension early, so the expensive operations run on a much smaller representation.

### 3. Training Strategy

**Class-weighted loss.** With a 16.5:1 imbalance, standard cross-entropy collapses to predicting silence. We weight the loss by the inverse of each class's frequency, which makes the model treat every class equally during training.

**Large temporal context window.** This was our most important finding. EEGNet reads a sliding causal window of past samples, and we set `window_size=1600`, which gives 1.6 seconds of context. The obvious choice for speed is a small window (128ms), but auditory cortex responses to sustained tones build slowly. A short window catches only the onset transient. A long window captures the full sustained oscillation, which makes classification much easier.

**Training on the full dataset for the final submission.** After choosing the best configuration on the provided validation split, we retrained on the combined training and validation data before the final push.

Final hyperparameters: `projected_channels=32`, `window_size=1600`, `F1=8`, `D=2`, `batch_size=64`.

---

## The Critical Insight: Window Size vs. Latency

Most teams assumed that a larger input window means higher latency. That assumption deserves a direct test, because for EEGNet it is false.

We compared two configurations directly:

| Configuration | Balanced Accuracy | Inference Latency |
|---|---|---|
| 128ms window | ~0.67 | <1ms |
| 1600ms window | ~0.87 | <1ms |

**Same latency, 20 points more balanced accuracy.**

The reason is that EEGNet's average pooling layers decimate the time dimension early in the network. By the time the input reaches the separable convolution block, a 1600-sample window has shrunk to 400 samples, and the classifier sees about 50. The cost of the forward pass is dominated by the initial convolution and the final linear layer, neither of which scales strongly with the input window length.

The PCA projection runs in constant time. At inference, memory bandwidth and a few matrix operations form the bottleneck, while window size contributes little.

This asymmetry, in which temporal history is cheap to include but critical for accuracy, applies beyond this problem. In any streaming BCI task where neural responses are slow relative to the sampling rate, it is worth profiling the actual latency before assuming that window size is a bottleneck.

---

## Results

**1st place, Track 1, BrainStorm 2026.** We finished with a final score of **91.7 / 100**, 22.5 points ahead of second place.

| | mindmeld | 2nd place (synapse) |
|---|---|---|
| **Total** | **91.7** | 69.2 |
| Accuracy (50 pts) | 47.1 | 30.9 |
| Latency (25 pts) | 23.8 | 15.4 |
| Size (25 pts) | 20.8 | 23.0 |

Our balanced accuracy was **94.2%** (47.1/50), inference latency was **<5ms**, and the model size was **~0.2 MB**.

The remaining headroom is in two places. The first is model size, since the serialized PCA components add weight to the checkpoint. The second is accuracy on the rarer tone classes, where limited training data makes generalization harder.

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

**Temporal context is cheap.** Profile latency before assuming that window size drives it. For convolutional architectures with pooling, the cost grows much less than linearly with window length.

**PCA is underrated for high-density arrays.** In micro-ECoG recordings, most of the structured signal lies in a low-dimensional subspace. PCA compression reduces model size, speeds up inference and often improves generalization, all at once.

**Balanced accuracy and class weighting are essential on imbalanced neural data.** Track balanced accuracy from the start alongside raw accuracy, and weight the loss to balance the classes.

**Domain-specific architectures beat general ones in the small-data regime.** EEGNet's inductive biases (temporal filtering before spatial filtering, and explicit pooling) directly match the structure of ECoG data. With 90 seconds of training data, that match matters more than raw model capacity.

---

**[Full illustrated version with architecture diagrams, charts, and leaderboard →](/brainstorm_bci_blog.html)**

---

*Authored by Quilee Simeon. Team MindMeld: Quilee Simeon, Dennis Loevlie, Raghav Gali, Rohan Bhatane, Shravankumar Janawade, Sriram G. We competed in BrainStorm 2026, Track 1: Neural Decoder Challenge, hosted by [Precision Neuroscience](https://www.precisionneuro.io/).*
