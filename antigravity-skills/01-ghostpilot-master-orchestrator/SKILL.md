---
name: ghostpilot-master-orchestrator
description: End-to-end $0 daily operating system for GhostPilot inside Antigravity IDE. Works reliably on fast/weak local models by chaining research, anti-AI-slop copywriting, magazine-grade PDF lead magnets, and Telegram delivery.
---

# GhostPilot Master Orchestrator ($0 Antigravity Workflow)

Use this skill whenever the user asks Antigravity to run GhostPilot's daily or weekly content engine for their active X account.

## Strict Golden Rules (Even for Fast / Weak Models)
1. **Always check `antigravity-sync/tasks.json` first.** Read the active `accountId`, `niche`, `whopOffer`, and `goal`. Never mix data from different X accounts.
2. **Never write generic advice.** Anchor every post and PDF in at least 1 real buyer pain-point, concrete number, or live signal from `POST /api/radar/scan`.
3. **Never put external URLs in Tweet 1.** X's Heavy Ranker suppresses external links in Tweet 1. Put the Whop or Free PDF link inside `autoPlugText` (sent 30 minutes later via Telegram).
4. **Always run the Anti-AI-Slop Checklist** (Skill 03) before outputting JSON. Zero banned buzzwords (`delve`, `game-changer`, `tapestry`, `testament`, `cutting-edge`, `not just X, but Y`).
5. **Output strictly valid JSON to `antigravity-sync/results.json`** matching this exact schema:
```json
{
  "posts": [
    {
      "blocks": ["Tweet 1 text under 275 chars (no URL)", "Optional Tweet 2"],
      "frameworkName": "S-Tier Comment-to-PDF Giveaway",
      "autoPlugText": "Grab the free PDF + full playbook here: https://..."
    }
  ],
  "leadMagnets": [
    {
      "title": "The 2026 [Specific Outcome] Playbook",
      "subtitle": "Word-for-word scripts, checklist, and system breakdown.",
      "format": "Playbook",
      "giveawayKeyword": "PLAYBOOK",
      "sections": [
        { "type": "takeaway", "heading": "...", "body": "...", "bullets": ["...", "..."] },
        { "type": "framework", "heading": "...", "body": "...", "bullets": ["...", "..."] },
        { "type": "script", "heading": "...", "body": "...", "bullets": ["...", "..."] },
        { "type": "checklist", "heading": "...", "body": "...", "bullets": ["...", "..."] },
        { "type": "offer-callout", "heading": "...", "body": "...", "bullets": ["...", "..."] }
      ]
    }
  ]
}
```
6. After writing `antigravity-sync/results.json`, instruct the user (or call `POST http://localhost:3000/api/antigravity/sync`) so GhostPilot immediately queues the posts and pushes them to Telegram on schedule.
