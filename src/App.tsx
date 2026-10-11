import Maker from './components/Maker'
import Player from './components/Player'

export default function App() {
  const playId = Number(new URLSearchParams(window.location.search).get('p'))
  return playId ? <Player trackId={playId} /> : <Maker />
}
