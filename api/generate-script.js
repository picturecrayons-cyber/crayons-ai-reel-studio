const MAX_PROMPT_LENGTH = 1200;

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

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crayons-ai-reel-studio.vercel.app',
        'X-Title': 'Crayons AI Reel Studio',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
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
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return res.status(status).json({
        error: upstream.status === 429
          ? 'The free AI model is rate-limited. Please wait and try again.'
          : 'The AI provider could not complete this request. Check the provider dashboard and model availability.',
      });
    }
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(502).json({ error: 'The AI provider returned an empty response.' });
    }
    return res.status(200).json({ text: text.trim(), model: 'openrouter/free' });
  } catch {
    return res.status(502).json({ error: 'Could not reach the AI provider. Please try again later.' });
  }
}
