const MAX_PROMPT_LENGTH = 1200;
const PRIMARY_MODEL = 'openrouter/free';
const MAX_FALLBACK_MODELS = 5;

function getFreeFallbackModels() {
  // Operator-configured model IDs are accepted only when explicitly marked free.
  // This prevents accidental fallback to a paid model.
  return String(process.env.OPENROUTER_FREE_FALLBACK_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model && model.endsWith(':free') && /^[a-zA-Z0-9._/-]+:free$/.test(model))
    .filter((model, index, all) => all.indexOf(model) === index && model !== PRIMARY_MODEL)
    .slice(0, MAX_FALLBACK_MODELS);
}

function isQuotaLimited(status, payload) {
  const code = String(payload?.error?.code || payload?.error?.metadata?.provider_name || '').toLowerCase();
  const message = String(payload?.error?.message || '').toLowerCase();
  return status === 429 || code.includes('rate_limit') || code.includes('quota') ||
    message.includes('rate limit') || message.includes('quota');
}

function getResponseText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'Enter a prompt between 1 and 1200 characters.' });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'Text AI is not configured. Add OPENROUTER_API_KEY to the Vercel Preview environment.' });
  }

  const models = [PRIMARY_MODEL, ...getFreeFallbackModels()];
  let quotaLimited = false;

  for (const model of models) {
    let upstream;
    let payload;
    try {
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://crayons-ai-reel-studio.vercel.app',
          'X-Title': 'Crayons AI Reel Studio',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a creative short-form video producer. Create a practical 30-second vertical Reel package. Return: 1) concept logline, 2) timed 5-7 shot storyboard with visuals and camera motion, 3) voiceover/dialogue, 4) on-screen captions, 5) sound and music direction without quoting existing lyrics, 6) one polished text-to-video prompt. Be concise and clearly label each section. Do not claim a video has already been generated.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(45000),
      });
      payload = await upstream.json().catch(() => ({}));
    } catch {
      // Do not fan out to other providers on network errors; avoid duplicate work.
      return res.status(502).json({ error: 'Could not reach the AI provider. Please try again later.' });
    }

    if (!upstream.ok) {
      if (isQuotaLimited(upstream.status, payload)) {
        quotaLimited = true;
        continue;
      }
      // Do not fallback on authentication, configuration, policy, or general provider errors.
      return res.status(upstream.status === 401 || upstream.status === 403 ? 502 : 503).json({
        error: 'The AI provider could not complete this request. No paid fallback was attempted.',
      });
    }

    const text = getResponseText(payload);
    if (!text) {
      return res.status(502).json({ error: 'The AI provider returned an empty response. No other model was called.' });
    }
    return res.status(200).json({ text, model });
  }

  return res.status(429).json({
    error: quotaLimited
      ? 'Free AI limits were reached for all configured free models. Please wait for quota reset or configure another verified :free model. No paid model was called.'
      : 'No free AI model is currently available. No paid model was called.',
    code: 'FREE_QUOTA_EXHAUSTED',
  });
}
