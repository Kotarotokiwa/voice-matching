export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { artist } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  const prompt = `「${artist}」が実際にリリースした代表曲・人気曲を15曲調べてください。

ウェブ検索で「${artist} 代表曲 人気曲 ディスコグラフィー」を検索して、正確な曲名を確認してから回答してください。

以下のJSON配列形式のみで返してください（説明文・コードブロック不要）：
[
  {
    "title": "曲名",
    "artist": "${artist}",
    "genre": "J-POP または 洋楽 または アニソン",
    "vocalRange": {"low": MIDIノート番号(40-60の整数), "high": MIDIノート番号(60-85の整数)},
    "leap": メロディ跳躍度(1-5の整数),
    "highNoteFreq": 高音出現頻度(1-5の整数),
    "tempo": BPM(整数),
    "rhythmType": "straight または offbeat または complex",
    "rhythmDiff": リズム難易度(1-5の整数)
  }
]

MIDIノート番号の目安：C3=48, E3=52, G3=55, C4=60, E4=64, G4=67, C5=72, E5=76
必ず「${artist}」本人の曲のみ返すこと。他アーティストの曲は含めないこと。`;

  try {
    // ウェブ検索でアーティストの曲を調べるリクエスト
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3
          }
        ],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('API response error:', errData);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Response type:', data.stop_reason);
    
    // テキストブロックのみ抽出
    const textBlocks = data.content?.filter(c => c.type === 'text') || [];
    const text = textBlocks.map(c => c.text || '').join('');
    
    console.log('Text length:', text.length);
    
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('No JSON found in:', text.substring(0, 500));
      throw new Error('JSON not found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ songs: parsed });
  } catch (e) {
    console.error('Bulk API error:', e.message);
    return res.status(500).json({ error: '一括分析に失敗しました。もう一度試してください。' });
  }
}
