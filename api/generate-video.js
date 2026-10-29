import { InferenceClient } from '@huggingface/inference';

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
  if (process.env.HF_VIDEO_FREE_TIER_CONFIRMED !== 'true') {
    return res.status(503).json({ error: 'Video generation is disabled until the owner confirms that the selected provider/model has a genuine no-cost allowance. Video providers may charge per generation.' });
  }
  if (!process.env.HF_TOKEN || !process.env.HF_VIDEO_PROVIDER) {
    return res.status(503).json({ error: 'Video AI is not configured. Add HF_TOKEN and a compatible HF_VIDEO_PROVIDER in the Vercel Preview environment.' });
  }

  try {
    const client = new InferenceClient(process.env.HF_TOKEN);
    const video = await client.textToVideo({
      inputs: prompt,
      model: process.env.HF_VIDEO_MODEL || 'Wan-AI/Wan2.2-TI2V-5B',
      provider: process.env.HF_VIDEO_PROVIDER,
      parameters: { num_frames: 33 },
    });
    const bytes = Buffer.from(await video.arrayBuffer());
    if (!bytes.length) return res.status(502).json({ error: 'The video provider returned an empty file.' });
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Content-Disposition', 'inline; filename="crayons-reel.mp4"');
    return res.status(200).send(bytes);
  } catch {
    return res.status(502).json({ error: 'Video generation failed. Check the selected model/provider compatibility, provider quota, and server-side logs without exposing credentials.' });
  }
}
