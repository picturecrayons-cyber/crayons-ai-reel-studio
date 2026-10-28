const FREE_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];
const hits = new Map();

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function isQuotaError(status, body) {
  const message = String(body?.error?.message || '').toLowerCase();
  return status === 429 || status === 503 ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return send(res, 403, { code: 'ORIGIN_REJECTED', message: 'Cross-origin requests are not accepted.' });
      }
    } catch {
      return send(res, 403, { code: 'ORIGIN_REJECTED', message: 'Invalid request origin.' });
    }
  }

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) {
    return send(res, 429, { code: 'RATE_LIMITED', message: 'Please wait a minute before trying again.' });
  }
  recent.push(now);
  hits.set(ip, recent);

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt || prompt.length > 1200) {
    return send(res, 400, { code: 'INVALID_PROMPT', message: 'Prompt must contain 1–1200 characters.' });
  }

  // Fail closed unless the operator explicitly confirms this key belongs to a
  // Google AI Studio Free Tier project with billing disabled. Never add a paid fallback.
  if (process.env.GEMINI_FREE_TIER_CONFIRMED !== 'true') {
    return send(res, 503, {
      code: 'FREE_AI_NOT_CONFIGURED',
      message: 'Free AI is not enabled. Configure a verified free-tier project first.'
    });
  }
  if (!process.env.GEMINI_API_KEY) {
    return send(res, 503, {
      code: 'FREE_AI_NOT_CONFIGURED',
      message: 'No server-side free AI key is configured. No key is required for local MP4 export.'
    });
  }

  let lastQuota = false;
  for (const model of FREE_MODELS) {
    let upstream;
    let payload;
    try {
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text:
            `Create a 3-scene vertical social reel storyboard for this idea: ${prompt}\n` +
            'Return only JSON: {"scenes":[{"title":"...","caption":"...","visual":"...","seconds":5}]}.' +
            ' Each scene must have a short caption and visual description. Keep it safe, original, and concise.'
          }]}],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 900 }
        })
      });
      payload = await upstream.json().catch(() => ({}));
    } catch {
      return send(res, 503, { code: 'AI_NETWORK_ERROR', message: 'Free AI is temporarily unreachable. Try again later.' });
    }

    if (!upstream.ok) {
      if (isQuotaError(upstream.status, payload)) {
        lastQuota = true;
        continue;
      }
      // Never try another model after auth/config errors or unknown failures.
      return send(res, upstream.status >= 500 ? 503 : 502, {
        code: 'AI_PROVIDER_ERROR',
        message: 'The free AI provider rejected the request. No paid fallback was attempted.'
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    let parsed;
    try {
      const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return send(res, 502, { code: 'INVALID_AI_OUTPUT', message: 'Free AI returned an unreadable storyboard. Try again.' });
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 1 || parsed.scenes.length > 6) {
      return send(res, 502, { code: 'INVALID_AI_OUTPUT', message: 'Free AI returned an invalid storyboard.' });
    }
    const scenes = parsed.scenes.map((scene, index) => ({
      title: String(scene.title || `Scene ${index + 1}`).slice(0, 80),
      caption: String(scene.caption || '').slice(0, 140),
      visual: String(scene.visual || '').slice(0, 400),
      seconds: Math.max(3, Math.min(8, Number(scene.seconds) || 5))
    }));
    return send(res, 200, { scenes, provider: model });
  }

  return send(res, 429, {
    code: 'QUOTA_EXHAUSTED',
    message: lastQuota
      ? 'Free quotas are exhausted on the available models. Please wait for quota reset. No paid provider was called.'
      : 'Free AI is temporarily unavailable.'
  });
}
