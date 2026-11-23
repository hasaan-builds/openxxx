import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractJsonFromModelOutput,
  normalizeAntigravityResults,
} from './antigravityNormalizer';

test('extractJsonFromModelOutput recovers JSON wrapped in markdown fences and trailing commas', () => {
  const messy = `Here is your output!

\`\`\`json
{
  "posts": [
    { "text": "Stop guessing on cold calls. Diagnose the leak in 60 seconds.", },
  ],
}
\`\`\`

Hope this helps!`;

  const parsed = extractJsonFromModelOutput(messy);
  const normalized = normalizeAntigravityResults(parsed);
  assert.equal(normalized.posts.length, 1);
  assert.equal(
    normalized.posts[0].blocks[0],
    'Stop guessing on cold calls. Diagnose the leak in 60 seconds.'
  );
  assert.equal(normalized.posts[0].format, 'single');
});

test('extractJsonFromModelOutput falls back gracefully when weaker model writes plain text', () => {
  const plain = `Most founders waste 10 hours a week on manual X posting.\n\n---\n\nComment "PLAYBOOK" and I will send you the exact $0 checklist.`;
  const parsed = extractJsonFromModelOutput(plain);
  const normalized = normalizeAntigravityResults(parsed);
  assert.equal(normalized.posts.length, 2);
  assert.ok(normalized.posts[1].blocks[0].includes('PLAYBOOK'));
});

test('extractJsonFromModelOutput splits numbered plain-text tweets from weaker models cleanly', () => {
  const numbered = `1. Most closers pitch too early on Zoom calls. Let the buyer quantify the cost of waiting.\n\n2. Never put an external link in Tweet 1. Drop it in your 30-min Auto-Plug reply instead.`;
  const parsed = extractJsonFromModelOutput(numbered);
  const normalized = normalizeAntigravityResults(parsed);
  assert.equal(normalized.posts.length, 2);
  assert.ok(!normalized.posts[0].blocks[0].startsWith('1.'));
  assert.ok(normalized.posts[1].blocks[0].startsWith('Never put an external link'));
});

