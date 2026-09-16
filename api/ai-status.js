export default function handler(req, res) {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  return res.json({
    aiAvailable: hasKey,
    model: 'gemini-3.1-flash-image',
  });
}
