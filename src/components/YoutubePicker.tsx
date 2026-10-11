import { useEffect, useState } from 'react'
import {
  parseYoutubeId,
  searchYoutube,
  youtubeSearchUrl,
  youtubeWatchUrl,
  YoutubeSearchUnavailable,
  type YoutubeVideo,
} from '../lib/youtube'

interface Props {
  artist: string
  title: string
  value?: string
  onChange: (youtubeId: string | undefined) => void
  /** Smaller version for cards already in the deck: no automatic search. */
  compact?: boolean
}

/** Picks the YouTube video a card's QR code points to: from search results or a pasted link. */
export default function YoutubePicker({ artist, title, value, onChange, compact }: Props) {
  const query = `${artist} ${title}`
  const [videos, setVideos] = useState<YoutubeVideo[]>()
  const [status, setStatus] = useState<'idle' | 'loading' | 'unavailable' | 'error'>('idle')
  const [error, setError] = useState<string>()
  const [pasted, setPasted] = useState('')

  async function search() {
    setStatus('loading')
    try {
      const found = await searchYoutube(query)
      setVideos(found)
      setStatus('idle')
      if (!value && found[0]) onChange(found[0].id)
    } catch (e) {
      setStatus(e instanceof YoutubeSearchUnavailable ? 'unavailable' : 'error')
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (!compact) search()
    // Search once per song; the artist/title fields can still be edited afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function paste(text: string) {
    setPasted(text)
    const id = parseYoutubeId(text)
    if (id) onChange(id)
  }

  return (
    <div className={compact ? 'yt-picker compact' : 'yt-picker'}>
      {!compact && <span className="yt-label">YouTube video for the QR code</span>}

      {status === 'loading' && <p className="hint">Searching YouTube…</p>}
      {status === 'error' && <p className="error">YouTube search failed: {error}</p>}
      {status === 'unavailable' && (
        <p className="hint">Automatic YouTube search isn’t set up yet (needs a YouTube API key). Paste a link below.</p>
      )}

      {videos && videos.length > 0 && (
        <ul className="yt-results">
          {videos.map((v) => (
            <li key={v.id}>
              <label className={value === v.id ? 'selected' : ''}>
                <input type="radio" name={`yt-${query}`} checked={value === v.id} onChange={() => onChange(v.id)} />
                {v.thumbnail && <img src={v.thumbnail} alt="" width={64} height={48} />}
                <span>
                  <strong>{v.title}</strong>
                  <small>{v.channel}</small>
                </span>
                <a href={youtubeWatchUrl(v.id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  ▶
                </a>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="yt-paste">
        <input
          value={pasted}
          onChange={(e) => paste(e.target.value)}
          placeholder={value && !pasted ? `Chosen: ${value}` : 'Paste a YouTube link'}
        />
        <a href={youtubeSearchUrl(query)} target="_blank" rel="noreferrer">
          Find on YouTube
        </a>
        {compact && status !== 'loading' && (
          <button type="button" className="secondary" onClick={search}>
            Search
          </button>
        )}
      </div>
      {pasted && !parseYoutubeId(pasted) && <p className="error">That doesn’t look like a YouTube link.</p>}
    </div>
  )
}
