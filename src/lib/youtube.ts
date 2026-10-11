export interface YoutubeVideo {
  id: string
  title: string
  channel: string
  thumbnail?: string
}

export class YoutubeSearchUnavailable extends Error {}

/** Searches YouTube through our serverless function (needs YOUTUBE_API_KEY on Vercel). */
export async function searchYoutube(query: string): Promise<YoutubeVideo[]> {
  const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`)
  if (res.status === 501 || res.status === 404) throw new YoutubeSearchUnavailable()
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(data.error ?? 'YouTube search failed')
  return data
}

/** Extracts the 11-character video id from a pasted YouTube link (or a bare id). */
export function parseYoutubeId(input: string): string | undefined {
  const text = input.trim()
  if (/^[\w-]{11}$/.test(text)) return text
  const match = text.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  return match?.[1]
}

export const youtubeSearchUrl = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
