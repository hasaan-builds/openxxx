---
name: open-reply-x-direct
description: >-
  GhostPilot Open Reply Power for Antigravity IDE. Directly replies to X (Twitter) posts
  through your logged-in Chrome/Antigravity browser OR plans high-signal human replies into
  GhostPilot's local Open Reply queue with anti-shadowban safety pacing and zero X API cost.
---

# Power 08: Open Reply — Direct X Replying & Reply Planner ($0)

Use this Antigravity Power whenever the user says:
- "Run my Open Reply queue on X"
- "Open Reply on X for 10 minutes"
- "Reply directly to this tweet URL using my voice"
- "Plan 10 Open Replies from my X feed into GhostPilot"

## Local Endpoints (GhostPilot on `http://localhost:3000`)

1. **Read Pending Open Reply Queue**:
   - HTTP: `GET http://localhost:3000/api/open-reply/queue`
   - Disk Mirror: `antigravity-sync/open-reply-queue.json`
2. **Generate 4 Context-Locked Human Replies (Gemini 4)**:
   - `POST http://localhost:3000/api/open-reply/generate`
   - Body: `{ "targetTweetUrl": "...", "targetAuthorHandle": "@...", "targetTweetText": "...", "goal": "authority" | "author-reply" | "soft-pdf-bridge" | "contrarian" }`
3. **Plan a New Reply into GhostPilot (Plan-First Mode)**:
   - `POST http://localhost:3000/api/open-reply/plan`
   - Body: `{ "targetTweetUrl": "...", "targetAuthorHandle": "@...", "targetTweetText": "...", "replyText": "...", "angle": "Tactical Addition", "goal": "authority", "executionMode": "approve-first" }`
4. **Mark a Reply Completed After Posting on X**:
   - `POST http://localhost:3000/api/open-reply/complete`
   - Body: `{ "id": "<openReplyItemId>", "replyPostUrl": "https://x.com/..." }`

## Mode A — Execute Planned Replies Directly on X
1. Fetch `GET http://localhost:3000/api/open-reply/queue`.
2. Check `safety.safeToSendNow` and `safety.repliesLastHour` (HARD LIMIT: never exceed 12 replies/hour; wait 45–110 seconds randomly between replies).
3. For each item in `planned`:
   - Navigate the user's logged-in Chrome browser directly to `item.targetTweetUrl` (or `https://x.com/intent/tweet?in_reply_to=<targetTweetId>&text=<encoded>`).
   - Read the live tweet and top existing replies to confirm `item.replyText` is fresh, relevant, and not duplicating an existing top comment.
   - Click the X reply textarea and type `item.replyText` naturally.
   - **Approval Check**:
     - If `item.executionMode === "approve-first"`, STOP after typing the reply into X and ask the user: *"Reply is typed and ready — click Reply or tell me 'send' to post it."*
     - If `item.executionMode === "antigravity-direct"`, click the **Reply** button, capture the posted reply URL if visible, wait 45–110s before the next item, and call `POST /api/open-reply/complete`.

## Mode B — Live X Feed Scan & Direct Reply / Plan
1. Open `https://x.com/home` or the user's target Reply-Guy accounts from `GET http://localhost:3000/api/store`.
2. Pick high-leverage recent tweets (posted < 4 hours ago, strong engagement velocity, relevant to the active account's locked Brand Brain niche).
3. For each tweet, extract the exact tweet URL, author `@handle`, and full tweet text, then call `POST http://localhost:3000/api/open-reply/generate`.
4. Pick the sharpest non-sycophantic option (NEVER "Great post!", "100% agree!", or generic praise; MUST react to a specific claim/number in the tweet).
5. Either post directly (if user requested Direct Reply mode) or save via `POST /api/open-reply/plan` (if user requested Plan mode) so the user can review and 1-tap send from GhostPilot or Telegram.

## Hard Anti-Shadowban Safety Rules
- Max **12 replies per hour**, **40 replies per day** on accounts under 5,000 followers.
- Never drop external URLs or affiliate links inside cold replies (keep your Free Paid-Worth PDF in your X Bio & Pinned Tweet so curious profile clickers convert organically).
- Randomize delay between **45 and 110 seconds** when running sequential direct replies.
