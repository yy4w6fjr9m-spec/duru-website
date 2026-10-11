import { useEffect, useState } from 'react'
import * as spotify from '../lib/spotify'

type State = 'starting' | 'playing' | 'paused' | 'open'

/**
 * The page a Spotify card's QR code opens. Spotify links never autoplay, so this page
 * asks Spotify to start the song on the phone. That works whenever Spotify is awake,
 * which during a game it is (the previous song is still playing). Otherwise it offers
 * to open the song in the Spotify app, where one tap starts it.
 */
export default function Launcher({ spotifyId }: { spotifyId: string }) {
  const loggedIn = spotify.spotifyConfigured && spotify.isLoggedIn()
  const [state, setState] = useState<State>(loggedIn ? 'starting' : 'open')
  const [reason, setReason] = useState<string>()
  const appLink = `https://open.spotify.com/track/${spotifyId}`

  useEffect(() => {
    if (!loggedIn) return
    spotify
      .playTrack(`spotify:track:${spotifyId}`)
      .then(() => setState('playing'))
      .catch((e: Error) => {
        setReason(e instanceof spotify.NoDeviceError ? 'Spotify isn’t awake on this phone yet.' : e.message)
        setState('open')
      })
  }, [loggedIn, spotifyId])

  const toggle = () => {
    const next = state === 'playing' ? spotify.pause() : spotify.resume()
    next.then(() => setState(state === 'playing' ? 'paused' : 'playing')).catch((e: Error) => setReason(e.message))
  }

  return (
    <main className="player">
      {state === 'starting' && <p className="player-hint">Starting the song…</p>}

      {(state === 'playing' || state === 'paused') && (
        <>
          <button className="play-button" onClick={toggle} aria-label={state === 'playing' ? 'Pause' : 'Play'}>
            {state === 'playing' ? '❚❚' : '▶'}
          </button>
          <p className="player-hint">Playing in Spotify. Guess the year!</p>
        </>
      )}

      {state === 'open' && (
        <>
          <a className="play-button play-link" href={appLink} aria-label="Open in Spotify">
            ▶
          </a>
          <p className="player-message">
            Tap to open the song in Spotify, then press play there and turn the phone face down.
            {loggedIn && ' The next cards will start by themselves while Spotify is playing.'}
          </p>
          {reason && <p className="player-debug">{reason}</p>}
          {!loggedIn && spotify.spotifyConfigured && (
            <button className="secondary" onClick={() => spotify.login()}>
              Connect Spotify so songs start by themselves
            </button>
          )}
        </>
      )}
    </main>
  )
}
