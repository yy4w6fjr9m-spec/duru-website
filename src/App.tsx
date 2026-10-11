import { useEffect, useState } from 'react'
import Maker from './components/Maker'
import Player from './components/Player'
import { handleLoginRedirect } from './lib/spotify'

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const [loginError, setLoginError] = useState<string>()

  useEffect(() => {
    if (!code) return
    handleLoginRedirect(code)
      .then((returnTo) => window.location.replace(returnTo))
      .catch((e: Error) => setLoginError(e.message))
  }, [code])

  if (code) return <main className="player">{loginError ?? 'Logging in to Spotify…'}</main>
  const playId = Number(params.get('p'))
  return playId ? <Player trackId={playId} /> : <Maker />
}
