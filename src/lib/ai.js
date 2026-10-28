const DEFAULT_SCENES = [
  { title: 'The opening frame', caption: 'Every journey begins with a feeling.', visual: 'A wide establishing shot, soft morning light, cinematic atmosphere.' },
  { title: 'The moment', caption: 'Find the detail that makes it yours.', visual: 'A closer, more intimate shot with gentle movement and warm highlights.' },
  { title: 'The finish', caption: 'Leave them with something to remember.', visual: 'A calm final frame, strong silhouette, space for a short closing line.' }
];

export function makeLocalStoryboard(prompt) {
  const subject = prompt.trim().replace(/[.!?]+$/, '') || 'A small story worth sharing';
  return DEFAULT_SCENES.map((scene, index) => ({
    ...scene,
    title: ['Set the scene', 'Show the feeling', 'Leave a memory'][index],
    caption: [
      subject.length > 70 ? `${subject.slice(0, 67)}…` : subject,
      'A small detail turns a moment into a story.',
      'Your story. Your point of view.'
    ][index],
    visual: scene.visual,
    seconds: 5
  }));
}

export async function createStoryboard(prompt) {
  try {
    const response = await fetch('/api/storyboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.message || 'Free AI is currently unavailable.');
      error.code = data.code || 'AI_UNAVAILABLE';
      throw error;
    }
    const data = await response.json();
    if (!Array.isArray(data.scenes) || data.scenes.length < 1) throw new Error('AI returned an invalid storyboard.');
    return { scenes: data.scenes, provider: data.provider || 'free AI', fallback: false };
  } catch (error) {
    return {
      scenes: makeLocalStoryboard(prompt),
      provider: 'local template fallback',
      fallback: true,
      reason: error.code === 'QUOTA_EXHAUSTED'
        ? 'Free AI quotas are exhausted. A local storyboard template was used; no paid provider was called.'
        : 'Free AI is not configured or reachable. A local storyboard template was used; no paid provider was called.'
    };
  }
}
