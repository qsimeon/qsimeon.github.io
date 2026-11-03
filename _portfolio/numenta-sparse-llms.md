---
title: "Growing Sparse Large Language Models"
excerpt: "Knowledge-preserving model expansion from 70M to 1.2B parameters at Numenta."
collection: portfolio
---

During my internship at [Numenta](https://www.numenta.com/), I worked on this question: *can we start with a small pretrained language model and gradually expand it into a larger, sparse model that retains performance while using fewer active parameters?*

Standard approaches train a large dense model first, then prune it post-training. We called our approach "reverse distillation." It starts small instead: transplant the weights of a small pretrained model (e.g. 70M parameters) into a larger architecture (up to 1.2B), then apply multi-sparse training to leverage both higher dimensionality and sparsity simultaneously. The hypothesis is that this knowledge-preserving expansion reaches target perplexity faster and with less compute than training the large sparse model from scratch.

[View slides (PDF)](/files/numenta_growing_sparse_llms.pdf)
