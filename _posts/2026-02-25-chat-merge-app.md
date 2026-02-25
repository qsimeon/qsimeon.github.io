---
title: "ChatMerge: What If You Could Merge AI Conversations?"
date: 2026-02-25
permalink: /blog/chat-merge-app/
tags: [AI, tools, RAG, vector-databases, full-stack, proof-of-concept]
---

If you use AI chat tools regularly, you've run into this. You have two or three conversations going in parallel, maybe originally about different things, and at some point you realize they've converged. You want one chat to be able to see what you discussed in another. But there's no way to do that. The conversations are siloed. You can copy-paste context across windows, but that's tedious and lossy. You can try to summarize one chat and feed it to another, but you lose nuance.

Think of it like branches in a git repo. You started separate threads for separate ideas, and now you want to merge them. Git has merge. AI chat tools don't.

Some providers have recently introduced "memories" — a shared memory layer that lets context bleed across conversations. That's a step in the right direction, but it's indirect. What I wanted was something more native: select two chats, merge them, and get a new conversation that actually has the full context of both.

So I built [ChatMerge](https://chat-merge-app-production.up.railway.app/).

**[Try it](https://chat-merge-app-production.up.railway.app/) | [Code](https://github.com/qsimeon/chat-merge-app) | [Demo Video](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov)**

I should be upfront: this is me exploring an idea, not shipping a product. I wanted this to exist, I think the friction is real and widespread, and I wanted to see if the approach could work. It can.

## How the merge works

The naive approach would be message concatenation — dump all messages from both chats into one long thread. The problem is obvious once you try it. Context windows explode, there's redundant content everywhere, and the model receives a wall of text with no structure. It doesn't scale.

Here's the thing: ChatMerge gives every conversation its own Pinecone vector namespace. As you chat, each message gets embedded (via OpenAI's `text-embedding-3-small`) and stored asynchronously. The vector database grows with the conversation. It's a dynamic memory that evolves as the discussion deepens.

When you merge two chats, the namespaces are *fused*. For each vector in the second namespace, we compute cosine similarity against all vectors in the first. If the best match exceeds a similarity threshold, those vectors get averaged together — embeddings blended, metadata merged. If they're semantically distinct, both survive. The result sits somewhere between `max(|A|, |B|)` and `|A| + |B|` vectors. The more overlapping the conversations were, the more compression you get.

The merged chat starts with zero copied messages. None. It opens with a brief AI-generated intro summarizing what was discussed, and from there, every query runs RAG against the fused namespace. The most relevant fragments get pulled into the system prompt, the model sees your recent exchange plus contextually relevant history from both source conversations, and the conversation just works. It scales regardless of how long the original threads were because you're always retrieving selectively.

The [demo video](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov) shows this end to end. I had one conversation about rap music and math, another about personal identity and a brain visualization image. After merging, the model correctly recalled my age, my musical preferences, and the fact that it had previously written rap lyrics for me. Those details lived in completely separate chats.

## Multi-provider support

The app happens to support multiple providers — OpenAI (GPT-4o, o4-mini, o3), Anthropic (Claude Sonnet 4, Haiku 4, Opus 4), and Google Gemini (2.0 Flash, 1.5 Pro, 1.5 Flash). This wasn't really the point of the project; I just wanted people to be able to use whichever model they prefer. All streaming via SSE, all with file and image upload support.

Building multi-provider streaming was educational in its own right though. Every provider has quirks. Anthropic and Gemini both require conversations to start with a user message. OpenAI's o-series reasoning models reject a `temperature` parameter and need `developer` role instead of `system`. Gemini's current SDK is `google-genai` (the older `google-generativeai` is deprecated). None of this is documented in one place.

## Your keys, your conversations

You bring your own API keys. The app stores them encrypted on the server using Fernet symmetric encryption — they power your conversations and the app doesn't use them for anything else. This is a demo, not an enterprise service, so if you'd rather not trust the deployment, clone the repo and run it locally. The whole thing is open source and the backend is small enough to audit in an afternoon.

## Deployment

The app runs on Railway: FastAPI backend serving a Vite-built React frontend from a single container. I started with Vercel and hit a wall immediately — Vercel runs Python as serverless functions with cold starts and hard timeouts, which breaks SSE streaming in a fundamental way. Railway gives you a persistent process, which is what you need for long-running streamed AI responses.

The stack is Python 3.11 + FastAPI + SQLAlchemy 2.0 async on the backend, React 18 + TypeScript + Zustand on the frontend. SQLite locally, PostgreSQL in production (Railway auto-injects `DATABASE_URL`). Pinecone serverless for vectors. Python deps managed with `uv`, frontend with npm.

## Why this matters to me

I've been working on a related problem with [session-merge](https://qsimeon.github.io/session-merge/), a Claude Code skill that stitches split terminal sessions back together at the JSONL level. That tool treats merging as a repair operation: your conversation fragmented, let's fix it. ChatMerge takes the same instinct somewhere more interesting. What if merging conversations was a *feature*? What if you could intentionally combine threads and get a result that's semantically richer than either source?

Most RAG systems treat their vector store as a static knowledge base you query against. Here, the vectors *are* the conversation. They grow with each message, they compress intelligently when fused, and they make merged conversations that actually remember what was said. I'd like to see this pattern in production AI tools. For now, it's a proof of concept that the approach works.

If you try it, I'd like to hear what breaks. And if you want to extend it — better fusion algorithms, multimodal embeddings for images, smarter deduplication — the [repo is open](https://github.com/qsimeon/chat-merge-app).

---

**Links:** [Live App](https://chat-merge-app-production.up.railway.app/) | [GitHub](https://github.com/qsimeon/chat-merge-app) | [Demo](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov)
