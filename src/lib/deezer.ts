const API = '/api/deezer'

export interface DeezerTrack {
  id: number
  title: string
  title_short: string
  preview: string
  release_date?: string
  artist: { name: string }
  album: { title: string; cover_small: string; release_date?: string }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`Deezer request failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? 'Deezer error')
  return data
}

export async function searchTracks(query: string): Promise<DeezerTrack[]> {
  const data = await get<{ data: DeezerTrack[] }>(`/search?q=${encodeURIComponent(query)}&limit=10`)
  return data.data
}

/** Full track info; also returns a fresh preview URL (they expire after ~15 min). */
export function getTrack(id: number): Promise<DeezerTrack> {
  return get<DeezerTrack>(`/track/${id}`)
}

export function yearOf(date?: string): number | undefined {
  const year = Number(date?.slice(0, 4))
  return year > 0 ? year : undefined
}
