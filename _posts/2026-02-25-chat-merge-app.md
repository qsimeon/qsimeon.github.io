---
title: "ChatMerge: What If You Could Merge AI Conversations?"
date: 2026-02-25
permalink: /blog/chat-merge-app/
tags: [AI, tools, RAG, vector-databases, full-stack, proof-of-concept]
---

If you use AI chat tools regularly, you've run into this. You have two or three conversations going in parallel, perhaps about different things at first, and at some point you realize they've converged. You want one chat to see what you discussed in another, which current tools can't do. The conversations are siloed. You can copy and paste context across windows, but that's tedious and loses information. You can summarize one chat and feed the summary to another, but you lose nuance.

Think of it like branches in a git repo. You started separate threads for separate ideas, and now you want to merge them. Git has merge. AI chat tools don't.

Some providers have recently introduced "memories," a shared memory layer that lets context bleed across conversations. That's a step in the right direction, but it's indirect. I wanted something more native: select two chats, merge them, and get a new conversation that has the full context of both.

So I built [ChatMerge](https://chat-merge-app-production.up.railway.app/).

**[Try it](https://chat-merge-app-production.up.railway.app/) | [Code](https://github.com/qsimeon/chat-merge-app) | [Demo Video](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov)**

I should be upfront: this is an experiment with an idea, and I'm not shipping it as a product. I wanted this to exist, I think the friction is real and widespread, and I wanted to see whether the approach could work. It can.

## The merge algorithm

The naive approach would be message concatenation, which dumps all messages from both chats into one long thread. The problem is obvious once you try it. Context windows explode, redundant content appears everywhere, and the model receives a wall of text with no structure, so the approach doesn't scale.

ChatMerge instead gives every conversation its own Pinecone vector namespace. As you chat, each message is embedded (with OpenAI's `text-embedding-3-small`) and stored asynchronously. The vector database grows with the conversation, so it acts as a dynamic memory that evolves as the discussion deepens.

When you merge two chats, their namespaces are *fused*. For each vector in the second namespace, the app computes cosine similarity against every vector in the first. If the best match exceeds a similarity threshold, the two vectors are averaged together, with their embeddings blended and their metadata merged. If they're semantically distinct, both survive. The result holds somewhere between `max(|A|, |B|)` and `|A| + |B|` vectors. The more the conversations overlapped, the more compression you get.

The merged chat starts with zero copied messages. It opens with a brief AI-generated intro that summarizes what was discussed. From then on, every query runs RAG (retrieval-augmented generation) against the fused namespace. The most relevant fragments are pulled into the system prompt, so the model sees your recent exchange plus relevant history from both source conversations, and the conversation just works. This scales regardless of how long the original threads were, because retrieval is always selective.

The [demo video](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov) shows this end to end. I had one conversation about rap music and math, and another about personal identity and a brain visualization image. After the merge, the model correctly recalled my age, my musical preferences, and the fact that it had previously written rap lyrics for me. Those details lived in completely separate chats.

## Multi-provider support

The app also supports multiple providers: OpenAI (GPT-4o, o4-mini, o3), Anthropic (Claude Sonnet 4, Haiku 4, Opus 4), and Google Gemini (2.0 Flash, 1.5 Pro, 1.5 Flash). That support was a side goal of the project. I just wanted people to be able to use whichever model they prefer. Every provider streams through SSE (server-sent events), and every one supports file and image uploads.

Building multi-provider streaming taught me a lot on its own, though. Every provider has quirks. Anthropic and Gemini both require a conversation to start with a user message. OpenAI's o-series reasoning models reject a `temperature` parameter and need the `developer` role instead of `system`. Gemini's current SDK is `google-genai`, since the older `google-generativeai` is deprecated. None of this is documented in one place.

## Your keys, your conversations

You bring your own API keys. The app stores them on the server, encrypted with Fernet symmetric encryption. They power your conversations and serve no other purpose in the app. This is a demo without enterprise guarantees, so if you'd rather not trust the deployment, clone the repo and run it locally. The whole thing is open source, with a backend small enough to audit in an afternoon.

## Deployment

The app runs on Railway, with a FastAPI backend serving a Vite-built React frontend from a single container. I started with Vercel and hit a wall immediately. Vercel runs Python as serverless functions with cold starts and hard timeouts, which fundamentally breaks SSE streaming. Railway gives you a persistent process, which long-running streamed AI responses need.

The backend stack is Python 3.11, FastAPI and SQLAlchemy 2.0 async. The frontend uses TypeScript, Zustand and React 18. The database is SQLite locally and PostgreSQL in production, where Railway injects `DATABASE_URL` automatically. Pinecone serverless stores the vectors, `uv` manages the Python dependencies, and npm manages the frontend.

## Merging as a feature

I've been working on a related problem with [session-merge](https://qsimeon.github.io/session-merge/), a Claude Code skill that stitches split terminal sessions back together at the JSONL level. That tool treats merging as a repair: your conversation fragmented, so you fix it. ChatMerge takes the same instinct somewhere more interesting. What if merging conversations were a *feature*? What if you could combine threads on purpose and get a result that's semantically richer than either source?

Most RAG systems treat their vector store as a static knowledge base you query against. In ChatMerge, the vectors *are* the conversation. They grow with each message, compress intelligently when fused, and give merged conversations a real memory of what was said. I'd like to see this pattern in production AI tools. For now, it's a proof of concept that shows the approach works.

If you try it, I'd like to hear what breaks. If you want to extend it with better fusion algorithms, multimodal embeddings for images or smarter deduplication, the [repo is open](https://github.com/qsimeon/chat-merge-app).


**Links:** [Live App](https://chat-merge-app-production.up.railway.app/) | [GitHub](https://github.com/qsimeon/chat-merge-app) | [Demo](https://github.com/qsimeon/chat-merge-app/blob/main/demo.mov)
