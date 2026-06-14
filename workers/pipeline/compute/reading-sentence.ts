/**
 * Generate the daily one-sentence reading via Claude.
 *
 * Constraints (in the prompt):
 *  - Always grammatically a weather report
 *  - Never names a party, person, or administration
 *  - Always under 18 words
 *  - Always describes geographic + atmospheric pattern, not specific events
 */

import type { Env } from '../index';

const MODEL = 'claude-haiku-4-5-20251001';

const FEW_SHOT_EXAMPLES = `
EXAMPLES (input → output):

Input: { feeling: "clear", indicators: { press: clear, courts: settled, sunlight: clear, chamber: in_session, streets: quiet, record: steady } }
Output: "Clear across the country. Steady ground beneath every system."

Input: { feeling: "overcast", indicators: { press: elevated, courts: unsettled, sunlight: opaque, chamber: in_session, streets: active, record: accelerating } }
Output: "Mostly overcast. Pressure building over the southeast."

Input: { feeling: "warning", indicators: { press: severe, courts: turbulent, sunlight: opaque, chamber: stalled, streets: turbulent, record: surging } }
Output: "Stormy through the deep south. Cold front sweeping across the capital."

Input: { feeling: "storm", indicators: { press: severe, sunlight: sealed, chamber: paralyzed } }
Output: "Severe weather nationwide. Visibility low. Take cover and stay informed."

Input: { feeling: "mild", indicators: { press: routine, courts: routine, sunlight: translucent, chamber: in_session, streets: quiet, record: steady } }
Output: "Mild and steady. A rare day of routine in every quarter."
`;

export async function writeSentence(indicators: any[], env: Env): Promise<string> {
  const summary = summarize(indicators);

  const prompt = `You are the daily forecaster for The Civic Forecast — a public-facing site that reports civic conditions in the United States the way a weather report describes weather.

Your job: write ONE sentence describing today's atmospheric reading.

CONSTRAINTS (every output must satisfy these):
- Always grammatically a weather report.
- Never names a party, person, or administration.
- Always under 18 words.
- Describes geographic + atmospheric pattern, not specific events.
- No exclamation marks. Calm, observational voice.

${FEW_SHOT_EXAMPLES}

NOW WRITE THE SENTENCE for these conditions:
${JSON.stringify(summary, null, 2)}

Reply with the sentence only. No quotes, no preamble.`;

  if (!env.ANTHROPIC) return fallbackSentence(summary);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 80,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`anthropic: ${r.status}`);
    const data: any = await r.json();
    const text = data.content?.[0]?.text?.trim() || '';
    // Validate: under 18 words, no party names
    if (validate(text)) return text;
    return fallbackSentence(summary);
  } catch (e) {
    console.error('[sentence]', e);
    return fallbackSentence(summary);
  }
}

function summarize(indicators: any[]) {
  const obj: Record<string, string> = {};
  indicators.forEach(i => { obj[i.id] = i.status; });
  return obj;
}

function validate(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length > 18) return false;
  const banned = /\b(democrat|republican|biden|trump|harris|gop|administration)\b/i;
  if (banned.test(text)) return false;
  return true;
}

function fallbackSentence(summary: any): string {
  const stormy = Object.values(summary).filter((s: any) =>
    ['severe', 'sealed', 'floodtide', 'paralyzed', 'turbulent'].includes(s)
  ).length;
  if (stormy >= 3) return 'Severe weather across multiple systems. Visibility low.';
  if (stormy >= 1) return 'Storms over part of the map. Mostly overcast elsewhere.';
  const elevated = Object.values(summary).filter((s: any) =>
    ['elevated', 'unsettled', 'active', 'accelerating', 'opaque', 'surging'].includes(s)
  ).length;
  if (elevated >= 2) return 'Mostly overcast. Pressure building in several regions.';
  return 'Mild and clear across most of the country.';
}
