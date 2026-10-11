import { useEffect, useRef, useState } from 'react'
import { getTrack, type DeezerTrack } from '../lib/deezer'
import * as spotify from '../lib/spotify'
import { createWebPlayer, type WebPlayer } from '../lib/webPlayer'

type Mode = 'spotify' | 'preview'

/**
 * The page a card's QR code opens: plays the song without revealing what it is.
 * With Spotify connected it plays the full song, preferably right in this page via
 * Spotify's web player, otherwise in the Spotify app. Without Spotify it plays
 * Deezer's 30-second preview.
 */
export default function Player({ trackId }: { trackId: number }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [track, setTrack] = useState<DeezerTrack>()
  const [mode, setMode] = useState<Mode>(spotify.spotifyConfigured && spotify.isLoggedIn() ? 'spotify' : 'preview')
  const [error, setError] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [needsWakeUp, setNeedsWakeUp] = useState(false)
  const [progress, setProgress] = useState(0)

  // Spotify state: the matching Spotify track and the in-page web player.
  const [uri, setUri] = useState<string | null>()
  const [webPlayer, setWebPlayer] = useState<WebPlayer | null>()
  const [webPlayerError, setWebPlayerError] = useState<string>()
  const started = useRef(false)

  useEffect(() => {
    getTrack(trackId)
      .then(setTrack)
      .catch(() => setError('Could not load this song.'))
  }, [trackId])

  // Find the song on Spotify ahead of time, so tapping play can start it immediately.
  useEffect(() => {
    if (mode !== 'spotify' || !track) return
    spotify
      .findSpotifyTrack(track.isrc, track.title_short, track.artist.name)
      .then((found) => {
        setUri(found ?? null)
        if (!found) {
          setMessage('This song isn’t on Spotify. Playing a preview instead.')
          setMode('preview')
        }
      })
      .catch((e) => {
        if (e instanceof spotify.NotLoggedInError) setMode('preview')
        else setMessage((e as Error).message)
      })
  }, [mode, track])

  useEffect(() => {
    if (mode !== 'spotify') return
    let player: WebPlayer | undefined
    let cancelled = false
    createWebPlayer()
      .then((p) => {
        player = p
        if (cancelled) return p.disconnect()
        p.onPlayingChange(setPlaying)
        setWebPlayer(p)
      })
      .catch((e: Error) => {
        setWebPlayer(null)
        setWebPlayerError(e.message)
      })
    return () => {
      cancelled = true
      player?.disconnect()
    }
  }, [mode])

  function toggleSpotify() {
    if (!uri) return
    setMessage(undefined)
    setNeedsWakeUp(false)

    if (webPlayer) {
      if (started.current) {
        webPlayer.togglePlay()
        return
      }
      // iOS only allows audio that starts from a tap, so this must run before any await.
      webPlayer.activate()
      setBusy(true)
      spotify
        .playOnDevice(uri, webPlayer.deviceId)
        .then(() => {
          started.current = true
        })
        .catch((e: Error) => setMessage(e.message))
        .finally(() => setBusy(false))
      return
    }

    // The web player isn't available here; control the Spotify app instead.
    setBusy(true)
    const action = playing ? spotify.pause().then(() => setPlaying(false)) : spotify.playTrack(uri).then(() => setPlaying(true))
    action
      .catch((e) => {
        if (e instanceof spotify.NotLoggedInError) setMode('preview')
        else if (e instanceof spotify.NoDeviceError) setNeedsWakeUp(true)
        else setMessage((e as Error).message)
      })
      .finally(() => setBusy(false))
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

  const spotifyReady = Boolean(uri) && webPlayer !== undefined
  const ready = Boolean(track) && !busy && (mode === 'preview' || spotifyReady)

  let status = 'Loading…'
  if (mode === 'preview' && track) status = 'Guess the year!'
  if (mode === 'spotify' && spotifyReady)
    status = webPlayer ? 'Guess the year!' : 'Guess the year! (plays in the Spotify app)'
  else if (mode === 'spotify' && track) status = 'Connecting to Spotify…'

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
      <p className="player-hint">{status}</p>
      {message && <p className="player-message">{message}</p>}
      {needsWakeUp && (
        <div className="player-message">
          <p>
            Spotify isn’t awake on this phone. Open Spotify, <strong>play any song for a second</strong>, then come
            back here and tap ▶ again.
          </p>
          <a className="button-link" href="spotify:">
            Open Spotify
          </a>
        </div>
      )}
      {webPlayerError && <p className="player-debug">Web player unavailable: {webPlayerError}</p>}

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
