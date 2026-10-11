// Vercel serverless function: searches YouTube with the official Data API, so the
// API key stays on the server. Set YOUTUBE_API_KEY in the Vercel project settings.
// GET /api/youtube?q=<query>  ->  [{ id, title, channel, thumbnail }]

const decode = (s) =>
  s.replace(/&(amp|quot|#39|lt|gt);/g, (m, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[e])

export async function GET(request) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return Response.json({ error: 'YOUTUBE_API_KEY is not set' }, { status: 501 })

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q) return Response.json({ error: 'Missing q' }, { status: 400 })

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true', // SongSeeker plays songs in an embedded player
    maxResults: '5',
    q,
    key,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const data = await res.json()
  if (!res.ok) return Response.json({ error: data.error?.message ?? 'YouTube search failed' }, { status: 502 })

  return Response.json(
    data.items.map((item) => ({
      id: item.id.videoId,
      title: decode(item.snippet.title),
      channel: decode(item.snippet.channelTitle),
      thumbnail: item.snippet.thumbnails?.default?.url,
    })),
    { headers: { 'Cache-Control': 's-maxage=86400' } },
  )
}
