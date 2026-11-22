---
name: seven-source-research-scraper
description: Zero-cost ($0) live market research engine combining Reddit, Google News, Bluesky Public API, GitHub Trending, Hacker News, Dev.to, Product Hunt RSS, Jina Reader, and YouTube Transcript extraction.
---

# 7-Source $0 Research & URL/YouTube Extraction Skill

Never pay for Apify, Perplexity API, or X Search API. GhostPilot includes all 7 live $0 endpoints locally:

## Live Multi-Source Scan (`POST http://localhost:3000/api/radar/scan`)
Pulls live signals simultaneously from:
1. **Reddit Buyer Pain-Points** (direct `.json` + cloud-safe Google News `site:reddit.com` bypass)
2. **Bluesky Public Firehose Search** (`public.api.bsky.app` — real social conversations, $0, no API key)
3. **Google News RSS** (real-time breaking industry headlines)
4. **GitHub Trending Search** (fast-growing open-source repos)
5. **Hacker News Algolia API** (high-signal builder debates)
6. **Dev.to Public API** (trending deep-dive guides)
7. **Product Hunt RSS + Custom RSS Feeds** (breakout tool launches)

## Deep URL & YouTube Transcript Extraction (`POST http://localhost:3000/api/tools/extract-url`)
- **YouTube Videos (`youtube.com` / `youtu.be`)**: Automatically extracts title, creator, and public captions/transcript with ZERO YouTube API key.
- **Any Whop Page, Competitor Blog, or GitHub Repo**: Uses `jina-ai/reader` (`r.jina.ai`) to convert the full page into clean LLM-ready Markdown + top 5 key takeaways.
