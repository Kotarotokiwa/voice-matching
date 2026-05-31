export const maxDuration = 30; // タイムアウトを30秒に延長

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { artist } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const prompt = `あなたは音楽の専門家です。「${artist}」が実際にリリースした代表曲・人気曲を15曲リストアップして、各曲の歌唱データをJSON配列で返してください。

【重要なルール】
- 「${artist}」が実際にリリースした曲のみを返してください
- 他のアーティストの曲は絶対に含めないでください
- 曲名とアーティスト名が正確に一致することを確認してください
- 不確かな曲は含めないでください

以下のJSON配列形式のみで返してください（説明文・コードブロック不要）：
[
  {
    "title": "曲名",
    "artist": "${artist}",
    "genre": "J-POP または 洋楽 または アニソン または その他",
    "vocalRange": {"low": MIDIノート番号(40-60の整数), "high": MIDIノート番号(60-85の整数)},
    "leap": メロディ跳躍度(1-5の整数),
    "highNoteFreq": 高音出現頻度(1-5の整数),
    "tempo": BPM(整数),
    "rhythmType": "straight または offbeat または complex",
    "rhythmDiff": リズム難易度(1-5の整数)
  }
]

MIDIノート番号の目安：C3=48, E3=52, G3=55, C4=60, E4=64, G4=67, C5=72, E5=76
必ず15曲返してください。`;

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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
 
    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({ songs: parsed });
  } catch (e) {
    console.error('Bulk API error:', e);
    return res.status(500).json({ error: '一括分析に失敗しました' });
  }
}
