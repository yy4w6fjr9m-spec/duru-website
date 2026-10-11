// Streaming services often date a song by its remaster or compilation. MusicBrainz
// tracks the first release date of each recording, which is what Hitster wants.

interface Recording {
  title: string
  'first-release-date'?: string
  'artist-credit'?: { name: string }[]
  releases?: unknown[]
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]|-\s.*$/g, '') // drop "(Remastered 2011)", "- Live" etc.
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '')

const escape = (s: string) => s.replace(/[\\"]/g, '\\$&')

export async function findOriginalYear(artist: string, title: string): Promise<number | undefined> {
  const query = encodeURIComponent(`recording:"${escape(title)}" AND artist:"${escape(artist)}"`)
  const res = await fetch(`https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=100`)
  if (!res.ok) return undefined
  const { recordings } = (await res.json()) as { recordings: Recording[] }

  const wantTitle = normalize(title)
  const wantArtist = normalize(artist)
  const matches = recordings.filter(
    (r) =>
      Number(r['first-release-date']?.slice(0, 4)) > 0 &&
      normalize(r.title) === wantTitle &&
      r['artist-credit']?.some((a) => normalize(a.name) === wantArtist),
  )

  // A hit song has many recordings: demos, live versions, wrongly dated bootlegs.
  // The original is the one that appears on by far the most releases.
  const main = matches.reduce<Recording | undefined>(
    (best, r) => ((r.releases?.length ?? 0) > (best?.releases?.length ?? -1) ? r : best),
    undefined,
  )
  return main ? Number(main['first-release-date']!.slice(0, 4)) : undefined
}
