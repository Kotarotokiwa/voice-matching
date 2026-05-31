export const maxDuration = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { artist } = req.body;
  if (!artist) return res.status(400).json({ error: 'artist is required' });

  try {
    // ── Step 1: iTunes APIで実在する曲名を取得 ──────────────
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=song&limit=50&country=jp`;
    const itunesRes = await fetch(itunesUrl);
    const itunesData = await itunesRes.json();

    // アーティスト名が一致する曲だけ抽出（大文字小文字無視）
    const artistLower = artist.toLowerCase();
    const matchedSongs = itunesData.results?.filter(r => 
      r.artistName?.toLowerCase().includes(artistLower) ||
      artistLower.includes(r.artistName?.toLowerCase())
    ) || [];

    // 重複タイトルを除去して最大15曲
    const uniqueTitles = [...new Set(matchedSongs.map(r => r.trackName))].slice(0, 15);

    if (uniqueTitles.length === 0) {
      return res.status(404).json({ error: `「${artist}」の曲がiTunesで見つかりませんでした。曲名を確認してください。` });
    }

    // ── Step 2: 取得した曲名リストをClaudeに渡して音域・難易度を分析 ──
    const songList = uniqueTitles.map((t, i) => `${i+1}. ${t}`).join('\n');
    
    const prompt = `以下は「${artist}」の実際の曲リストです。各曲の歌唱データをJSON配列で返してください。

曲リスト：
${songList}

以下のJSON配列形式のみで返してください（説明文・コードブロック不要）：
[
  {
    "title": "曲名（上記リストから正確に）",
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
全${uniqueTitles.length}曲分返してください。`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.map(c => c.text || '').join('') || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('JSON not found');
    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json({ songs: parsed });

  } catch (e) {
    console.error('Bulk API error:', e);
    return res.status(500).json({ error: '一括分析に失敗しました。もう一度試してください。' });
  }
}
