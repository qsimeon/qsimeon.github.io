---
title: "Homogenized C. elegans Neural Activity and Connectivity Data"
permalink: /publication/2024-11-18-homogenized-celegans
date: 2024-11-18
venue: arXiv:2411.12091 (q-bio.NC)
authors: Q. Simeon, A. Kashyap, K. P. Kording, E. S. Boyden
paperurl: https://arxiv.org/abs/2411.12091
links:
  - { label: Neural data, url: "https://huggingface.co/datasets/qsimeon/celegans_neural_data" }
  - { label: Connectome data, url: "https://huggingface.co/datasets/qsimeon/celegans_connectome_data" }
  - { label: Code, url: "https://github.com/qsimeon/worm-data-preprocess" }
excerpt: Eleven C. elegans neural-activity and connectivity datasets, about 900 worms, put into one consistent format.
citation: 'Simeon, Q., Kashyap, A., Kording, K. P., & Boyden, E. S. (2024). "Homogenized C. elegans Neural Activity and Connectivity Data." <i>arXiv:2411.12091</i>.'
---

Public *C. elegans* datasets differ in neuron naming, sampling rate, normalization, and file format, which makes it hard
to train one model across them. This work homogenizes neural activity from 11 sources (roughly 900 animals) and the
available connectomes into a shared format, released on Hugging Face with the preprocessing code.
