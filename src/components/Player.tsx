import { useEffect, useRef, useState } from 'react'
import { getTrack, type DeezerTrack } from '../lib/deezer'
import * as spotify from '../lib/spotify'

type Mode = 'spotify' | 'preview'

/**
 * The page a card's QR code opens: plays the song without revealing what it is.
 * With Spotify connected it plays the full song in the Spotify app; otherwise it
 * plays Deezer's 30-second preview right here.
 */
export default function Player({ trackId }: { trackId: number }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<DeezerTrack>()
  const [mode, setMode] = useState<Mode>(spotify.spotifyConfigured && spotify.isLoggedIn() ? 'spotify' : 'preview')
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    getTrack(trackId)
      .then(setTrack)
      .catch(() => setError('Could not load this song.'))
  }, [trackId])

  async function toggleSpotify() {
    if (!track) return
    setBusy(true)
    setMessage(undefined)
    try {
      if (playing) {
        await spotify.pause()
        setPlaying(false)
        return
      }
      const uri = await spotify.findSpotifyTrack(track.isrc, track.title_short, track.artist.name)
      if (!uri) {
        setMessage('This song isn’t on Spotify. Playing a preview instead.')
        setMode('preview')
        return
      }
      await spotify.playTrack(uri)
      setPlaying(true)
    } catch (e) {
      if (e instanceof spotify.NotLoggedInError) setMode('preview')
      else if (e instanceof spotify.NoDeviceError)
        setMessage('Open the Spotify app for a moment so it wakes up, then come back and tap play again.')
      else setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function togglePreview() {
    const el = audio.current
    if (!el) return
    if (el.paused) el.play()
    else el.pause()
  }

  if (error) {
    return (
      <main className="player">
        <p className="player-error">{error}</p>
      </main>
    )
  }

  const ready = Boolean(track) && !busy
  return (
    <main className="player">
      <button
        className="play-button"
        onClick={mode === 'spotify' ? toggleSpotify : togglePreview}
        disabled={!ready}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      {mode === 'preview' && (
        <div className="player-progress">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <p className="player-hint">{track ? 'Guess the year!' : 'Loading…'}</p>
      {message && <p className="player-message">{message}</p>}

      {spotify.spotifyConfigured && mode === 'preview' && (
        <button className="secondary" onClick={() => spotify.login()}>
          Connect Spotify for the full song
        </button>
      )}

      {mode === 'preview' && (
        <audio
          ref={audio}
          src={track?.preview}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 30))}
        />
      )}
    </main>
  )
}
