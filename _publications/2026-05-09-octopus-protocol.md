---
title: "Octopus Protocol: One-Shot Hardware Discovery and Control for AI Agents via Infrastructure-as-Prompts"
permalink: /publication/2026-05-09-octopus-protocol
date: 2026-05-09
venue: NeurIPS 2026 Workshop on Agentic Web (accepted) · arXiv:2605.09055
authors: Q. Simeon, J. M. Wei, Y. Fan
paperurl: https://arxiv.org/abs/2605.09055
links:
  - { label: Website, url: "https://octopusprotocol.ai" }
  - { label: Code, url: "https://github.com/qsimeon/octopus-hw" }
  - { label: Blog post, url: "/octopus-coding-agent-is-software/" }
excerpt: A coding agent discovers connected hardware and writes, tests, and serves an MCP server for it, so the agent becomes the driver.
citation: 'Simeon, Q., Wei, J. M., & Fan, Y. (2026). "Octopus Protocol: One-Shot Hardware Discovery and Control for AI Agents via Infrastructure-as-Prompts." <i>arXiv:2605.09055</i>.'
---

Instead of shipping drivers, Octopus ships a prompt. At install time a coding agent identifies whatever hardware is
plugged in, generates a complete MCP server for it, tests it against the real device, and exposes it to other agents.
The write-up and design principles are in the [blog post](/octopus-coding-agent-is-software/).
