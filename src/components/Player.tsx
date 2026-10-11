import { useEffect, useRef, useState } from 'react'
import { getTrack } from '../lib/deezer'

/** The page a card's QR code opens: plays the song without revealing what it is. */
export default function Player({ trackId }: { trackId: number }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState<string>()
  const [error, setError] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    getTrack(trackId)
      .then((t) => (t.preview ? setSrc(t.preview) : setError('No preview available for this song.')))
      .catch(() => setError('Could not load this song.'))
  }, [trackId])

  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) el.play()
    else el.pause()
  }

  return (
    <main className="player">
      {error ? (
        <p className="player-error">{error}</p>
      ) : (
        <>
          <button className="play-button" onClick={toggle} disabled={!src} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <div className="player-progress">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="player-hint">{src ? 'Guess the year!' : 'Loading…'}</p>
        </>
      )}
      <audio
        ref={audio}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 30))}
      />
    </main>
  )
}
