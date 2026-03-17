export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { systemPrompt, userPrompt, maxTokens = 8192 } = req.body;

  if (!systemPrompt || !userPrompt) {
    return res.status(400).json({ error: 'systemPrompt and userPrompt are required' });
  }

  const API_KEY = process.env.LLM_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'LLM_API_KEY not configured' });
  }

  const API_BASE = 'https://gateway.letsur.ai/v1';
  const MODEL = 'gemini-2.5-flash';

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LLM API Error:', response.status, errText);
      return res.status(502).json({ error: 'LLM API request failed' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    return res.status(200).json({ content });
  } catch (err) {
    console.error('LLM proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
