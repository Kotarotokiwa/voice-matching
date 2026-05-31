export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, artist } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const prompt = `あなたは音楽の専門家です。以下の曲について、歌唱データをJSON形式で返してください。

曲名：${title}
アーティスト：${artist || "不明"}

以下のJSON形式のみで返してください（説明文は不要、コードブロックも不要）：
{
  "title": "曲名",
  "artist": "アーティスト名",
  "genre": "J-POP または 洋楽 または アニソン または その他",
  "vocalRange": {"low": MIDIノート番号(40-60の整数), "high": MIDIノート番号(60-85の整数)},
  "leap": メロディ跳躍度(1-5の整数),
  "highNoteFreq": 高音出現頻度(1-5の整数),
  "tempo": BPM(整数),
  "rhythmType": "straight または offbeat または complex",
  "rhythmDiff": リズム難易度(1-5の整数)
}

MIDIノート番号の目安：C3=48, E3=52, G3=55, C4=60, E4=64, G4=67, C5=72, E5=76`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: '曲の分析に失敗しました' });
  }
}
