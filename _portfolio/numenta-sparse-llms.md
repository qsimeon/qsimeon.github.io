---
title: "Growing Sparse Large Language Models"
excerpt: "Knowledge-preserving model expansion from 70M to 1.2B parameters at Numenta.<br/><img src='/images/numenta_sparse_llms.png'>"
collection: portfolio
---

During my internship at [Numenta](https://www.numenta.com/), I worked on a key question in efficient deep learning: *can we start with a small pretrained language model and gradually expand it into a larger, sparse model that retains performance while using fewer active parameters?*

Standard approaches train a large dense model first, then prune it post-training. Our approach — which we called "reverse distillation" — flips this: transplant the weights of a small pretrained model (e.g. 70M parameters) into a larger architecture (up to 1.2B), then apply multi-sparse training to leverage both higher dimensionality and sparsity simultaneously. The hypothesis is that this knowledge-preserving expansion reaches target perplexity faster and with less compute than training the large sparse model from scratch.

This work sits at the intersection of transfer learning and continual learning, and is especially relevant given recent industry interest in sparse circuits and efficient LLM architectures.

[View slides (PDF)](/files/numenta_growing_sparse_llms.pdf)
