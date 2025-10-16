---
title: "Towards the Platonic Representation via Multimodal Contrastive Alignment"
excerpt: "MIT Deep Learning final project exploring multimodal representation learning through contrastive alignment of frozen encoders.<br/><img src='/images/deep_learning_project/conceptual_contrastive.jpg'>"
collection: portfolio
---

## Project Overview

This project, completed as part of MIT's Deep Learning course (6.7960), explores whether representations from disparate pre-trained unimodal neural networks can be aligned into a shared multimodal latent space. Inspired by CLIP and the Platonic Representation Hypothesis, we use lightweight adapters to align frozen encoders without expensive joint retraining.

## Key Contributions

- **Novel Framework**: Align pre-trained unimodal encoders (ResNet-18, DistilBERT) using simple linear adapters
- **Theoretical Validation**: Empirical evidence supporting the Platonic Representation Hypothesis
- **Strong Results**: Multimodal representations outperform unimodal ones when compared to DINOv2 embeddings

## Resources

- **[Full Technical Blog Post](/blog/multimodal-alignment/)**
- **[Google Colab Notebook](https://colab.research.google.com/drive/1tguG-THn52pPGcU9KIkmVBzYbhiPfw1w?usp=sharing)**
- **[Weights & Biases Logs](https://wandb.ai/gmanso-mit/multimodal-proj)**

*Collaboration with Gabe Manso*