/**
 * Operator briefing.
 *
 * The template briefing is the primary path: it is deterministic, instant, and
 * works with the phone in airplane mode. The Groq call is an enhancement layered
 * on top, raced against a 6 second timeout. The demo must never show a spinner
 * that never resolves.
 */

import { GROQ_API_KEY, GROQ_MODEL, GROQ_MODEL_FALLBACK, GROQ_MODEL_LABEL } from '../config.js';

export const MODEL_LABEL = GROQ_MODEL_LABEL;

/**
 * Whether an API key is configured at all.
 *
 * Distinct from whether any given call succeeded: a briefing can fall back to
 * the template because the network was slow, which says nothing about the key.
 * Conflating the two made the Ask panel claim "no key" on a working install.
 */
export const HAS_KEY = Boolean(GROQ_API_KEY);

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 6000;

const SYSTEM = (island) =>
  `You are the control system for a solar-powered desalination plant on ${island}, an ` +
  `isolated island. You speak to the plant operator: direct, concrete, no filler. Use the ` +
  `numbers you are given and never invent any. Two to three sentences maximum. If a leak ` +
  `is flagged, lead with it.`;

/** Compact context object. Never send the whole forecast. */
export function buildContext({ island, step, index, smart, timer, leak, hourly }) {
  const next6 = smart.steps.slice(index + 1, index + 7).map((s) => ({
    hour: s.time.slice(11, 16),
    solarKw: Math.round(s.solarKw),
    demandL: Math.round(s.demandL),
    action: s.action,
    source: s.source,
  }));

  const savedPct = timer.totals.dieselL > 0
    ? 100 * (1 - smart.totals.dieselL / timer.totals.dieselL)
    : 0;

  return {
    island,
    timeLocal: step.time.slice(11, 16),
    tankPct: Math.round(step.tankPct),
    tankL: Math.round(step.tankL),
    currentAction: step.action,
    currentSource: step.source,
    currentReason: step.reason,
    next6Hours: next6,
    dieselTodayL: Number(smart.steps.slice(0, 24).reduce((a, s) => a + s.dieselL, 0).toFixed(1)),
    savedVsFixedTimerPct: Math.round(savedPct),
    leak: leak.alert
      ? { rateLph: leak.estimatedRateLph, since: leak.startedAtTime.slice(11, 16), totalLostL: leak.totalLostL }
      : null,
  };
}

/** Deterministic briefing. Always available, no network, no key. */
export function templateBriefing(ctx, smart, index) {
  const ahead = smart.steps.slice(index + 1);
  const nextSolar = ahead.find((s) => s.source === 'solar');
  const plannedPumpHours = ahead.slice(0, 24).filter((s) => s.action === 'pump').length;

  const lead = ctx.leak
    ? `LEAK: losing ${ctx.leak.rateLph} L/h beyond forecast since ${ctx.leak.since} — ` +
      `${ctx.leak.totalLostL.toLocaleString()} L gone. Isolate the north line before anything else. `
    : '';

  const solarLine = nextSolar
    ? `Next full-solar window opens at ${nextSolar.time.slice(11, 16)} — planning ${plannedPumpHours} pump hours over the next 24. `
    : `No full-solar window in the forecast horizon — ${plannedPumpHours} pump hours planned on partial solar. `;

  return (
    `${lead}Tank at ${ctx.tankPct}% (${ctx.tankL.toLocaleString()} L). ${ctx.currentReason}. ` +
    solarLine +
    `${ctx.dieselTodayL} L of diesel today, ${ctx.savedVsFixedTimerPct}% below a fixed timer.`
  );
}

async function callModel(model, messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      // gpt-oss is a reasoning model: without a low effort cap it spends the
      // whole token budget thinking and returns empty content.
      reasoning_effort: 'low',
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq returned no content');
  return text;
}

/** Primary open-weight model, with a second model as backup before we give up. */
async function callGroq(messages) {
  try {
    return await callModel(GROQ_MODEL, messages);
  } catch {
    return await callModel(GROQ_MODEL_FALLBACK, messages);
  }
}

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/**
 * Returns { text, live }. `live` is false whenever we fell back, so the UI can
 * label the source honestly rather than pretending an LLM wrote the template.
 */
export async function getBriefing(ctx, smart, index) {
  const fallback = { text: templateBriefing(ctx, smart, index), live: false };
  if (!GROQ_API_KEY) return fallback;

  try {
    const text = await withTimeout(
      callGroq([
        { role: 'system', content: SYSTEM(ctx.island) },
        { role: 'user', content: `Current plant state:\n${JSON.stringify(ctx, null, 1)}\n\nWrite the shift briefing.` },
      ]),
    );
    return { text, live: true };
  } catch {
    return fallback;
  }
}

/**
 * The advisory is aimed at the village, not the operator, so it gets its own
 * voice: no plant jargon, no kilowatts, just what to do and when.
 */
const ADVISORY_SYSTEM = (island) =>
  `You write short public water notices for the community of ${island}, a small ` +
  `island served by one desalination plant. Speak to residents, not engineers: no ` +
  `kilowatts, no plant jargon. Say what to do and when, and why it saves the island ` +
  `money or fuel. Use only the numbers you are given. Three sentences maximum.`;

/**
 * Returns { text, live }. Falls back to the deterministic template on any
 * error, timeout or missing key, exactly like getBriefing.
 */
export async function getAdvisory(ctx, fallbackText) {
  const fallback = { text: fallbackText, live: false };
  if (!GROQ_API_KEY) return fallback;
  try {
    const text = await withTimeout(
      callGroq([
        { role: 'system', content: ADVISORY_SYSTEM(ctx.island) },
        {
          role: 'user',
          content:
            `Free-solar windows and supply position:\n${JSON.stringify(ctx, null, 1)}\n\n` +
            (ctx.rationing?.required
              ? 'Water is short. Write the public rationing notice.'
              : 'Write the notice telling residents when water is cheapest to use.'),
        },
      ]),
    );
    return { text, live: true };
  } catch {
    return fallback;
  }
}

/**
 * Multi-turn conversation with the operator.
 *
 * The plant state is re-sent as a system message on every turn rather than
 * being buried in the first question, so the model answers against the current
 * schedule even deep into a conversation. History is bounded: the last few
 * exchanges are enough for follow-ups like "why?" without growing the request
 * unboundedly.
 */
const MAX_HISTORY_MESSAGES = 8;

export async function askOperator(ctx, question, history = []) {
  if (!GROQ_API_KEY) {
    return 'No AI key configured. Everything else on this screen — the schedule, the alerts, the numbers — is computed on-device and unaffected.';
  }
  try {
    return await withTimeout(
      callGroq([
        { role: 'system', content: SYSTEM(ctx.island) },
        {
          role: 'system',
          content:
            `Current plant state, refreshed each turn:\n${JSON.stringify(ctx, null, 1)}\n\n` +
            'Answer follow-up questions in context. If asked something the data cannot answer, say so.',
        },
        ...history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.text })),
        { role: 'user', content: question },
      ]),
    );
  } catch {
    return 'Could not reach the AI service just now. All scheduling and detection continue to run on-device.';
  }
}
