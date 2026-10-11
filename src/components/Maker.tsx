import { useEffect, useState } from 'react'
import { searchTracks, getTrack, yearOf, type DeezerTrack } from '../lib/deezer'
import { findOriginalYear } from '../lib/musicbrainz'
import { cardUrl, type QrMode } from '../lib/playUrl'
import * as spotify from '../lib/spotify'
import type { Card } from '../types'

const STORAGE_KEY = 'hitster-deck'
const QR_MODE_KEY = 'hitster-qr-mode'
const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin
const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)

function loadDeck(): Card[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function loadQrMode(): QrMode {
  try {
    return localStorage.getItem(QR_MODE_KEY) === 'player' ? 'player' : 'spotify'
  } catch {
    return 'spotify'
  }
}

/** Looks up Spotify ids for cards that don't have one yet. Needs a Spotify login. */
async function withSpotifyIds(cards: Card[]): Promise<Card[]> {
  const out: Card[] = []
  for (const card of cards) {
    if (card.spotifyId) {
      out.push(card)
      continue
    }
    const full = await getTrack(card.deezerId).catch(() => undefined)
    const spotifyId = await spotify.findSpotifyId(full?.isrc, card.title, card.artist).catch(() => undefined)
    out.push({ ...card, spotifyId })
  }
  return out
}

interface Draft extends Card {
  loadingYear: boolean
  streamingYear?: number
  originalYear?: number
  spotifyLookup?: 'pending' | 'found' | 'missing' | 'skipped'
}

export default function Maker() {
  const [deck, setDeck] = useState<Card[]>(loadDeck)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DeezerTrack[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<Draft>()
  const [busy, setBusy] = useState(false)
  const [qrMode, setQrMode] = useState<QrMode>(loadQrMode)
  const loggedIn = spotify.isLoggedIn()
  const useSpotify = qrMode === 'spotify'

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
    } catch {
      // Storage unavailable (private mode); the deck just won't persist.
    }
  }, [deck])

  useEffect(() => {
    try {
      localStorage.setItem(QR_MODE_KEY, qrMode)
    } catch {
      // Not persisted; fine.
    }
  }, [qrMode])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError(undefined)
    try {
      setResults(await searchTracks(query))
    } catch {
      setError('Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  async function pick(track: DeezerTrack) {
    setResults([])
    const base = { deezerId: track.id, title: track.title_short, artist: track.artist.name }
    setDraft({ ...base, year: 0, loadingYear: true, spotifyLookup: loggedIn ? 'pending' : 'skipped' })

    const fullTrack = getTrack(track.id).catch(() => undefined)
    if (loggedIn) {
      fullTrack
        .then((full) => spotify.findSpotifyId(full?.isrc, base.title, base.artist))
        .catch(() => undefined)
        .then((spotifyId) =>
          setDraft((d) =>
            d?.deezerId === track.id ? { ...d, spotifyId, spotifyLookup: spotifyId ? 'found' : 'missing' } : d,
          ),
        )
    }

    const [full, original] = await Promise.all([
      fullTrack,
      findOriginalYear(base.artist, base.title).catch(() => undefined),
    ])
    const streamingYear = yearOf(full?.release_date) ?? yearOf(full?.album.release_date)
    const year = Math.min(original ?? Infinity, streamingYear ?? Infinity)
    setDraft((d) =>
      d?.deezerId === track.id
        ? { ...d, loadingYear: false, streamingYear, originalYear: original, year: Number.isFinite(year) ? year : 0 }
        : d,
    )
  }

  function addDraft() {
    if (!draft || !draft.year) return
    const { deezerId, title, artist, year, spotifyId } = draft
    setDeck((d) => [...d, { deezerId, title, artist, year, spotifyId }])
    setDraft(undefined)
    setQuery('')
  }

  const updateCard = (i: number, patch: Partial<Card>) =>
    setDeck((d) => d.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  async function download() {
    setBusy(true)
    try {
      let cards = deck
      if (useSpotify && loggedIn && deck.some((c) => !c.spotifyId)) {
        cards = await withSpotifyIds(deck)
        setDeck(cards)
      }
      const { generateDeckPdf } = await import('../lib/pdf')
      const bytes = await generateDeckPdf(cards, baseUrl, qrMode)
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'hitster-cards.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="maker">
      <h1>Hitster Card Maker</h1>

      <section className="settings">
        <div className="segmented" role="radiogroup" aria-label="What the QR code opens">
          <button
            role="radio"
            aria-checked={useSpotify}
            className={useSpotify ? 'active' : ''}
            onClick={() => setQrMode('spotify')}
          >
            QR opens Spotify app
          </button>
          <button
            role="radio"
            aria-checked={!useSpotify}
            className={!useSpotify ? 'active' : ''}
            onClick={() => setQrMode('player')}
          >
            QR opens blind player
          </button>
        </div>
        <p className="hint">
          {useSpotify
            ? 'Full song in Spotify. The title shows on screen, so turn the phone face down.'
            : 'Plays on this site without showing the title (30-second preview, or full song if Spotify works).'}
        </p>
        {useSpotify && !loggedIn && (
          <div className="notice">
            <span>Connect Spotify so the site can find each song’s Spotify link.</span>
            <button onClick={() => spotify.login()}>Connect Spotify</button>
          </div>
        )}
      </section>

      <form className="search" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a song, e.g. Mr. Brightside"
          autoFocus
        />
        <button disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <ul className="results">
          {results.map((t) => (
            <li key={t.id}>
              <button onClick={() => pick(t)}>
                <img src={t.album.cover_small} alt="" width={40} height={40} />
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.artist.name} · {t.album.title}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <section className="draft">
          <CardBack card={draft} />
          <div className="draft-fields">
            <label>
              Artist
              <input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} />
            </label>
            <label>
              Title
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label>
              Year
              <input
                type="number"
                value={draft.year || ''}
                placeholder={draft.loadingYear ? 'Looking up…' : ''}
                onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })}
              />
            </label>
            {!draft.loadingYear && (
              <p className="hint">
                Deezer says {draft.streamingYear ?? '?'}, MusicBrainz (original release) says{' '}
                {draft.originalYear ?? '?'}. Check it if they differ.
              </p>
            )}
            {useSpotify && draft.spotifyLookup !== 'skipped' && (
              <p className="hint">
                {draft.spotifyLookup === 'pending' && 'Finding it on Spotify…'}
                {draft.spotifyLookup === 'found' && 'Found on Spotify ✓'}
                {draft.spotifyLookup === 'missing' && 'Not found on Spotify; this card’s QR opens the blind player.'}
              </p>
            )}
            <div className="row">
              <button onClick={addDraft} disabled={!draft.year}>
                Add to deck
              </button>
              <button className="secondary" onClick={() => setDraft(undefined)}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="deck">
        <h2>Your deck ({deck.length})</h2>
        {deck.length === 0 ? (
          <p className="hint">Search a song above to add your first card.</p>
        ) : (
          <table>
            <tbody>
              {deck.map((c, i) => (
                <tr key={`${c.deezerId}-${i}`}>
                  <td>
                    <input
                      type="number"
                      className="year-input"
                      value={c.year}
                      onChange={(e) => updateCard(i, { year: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <strong>{c.title}</strong>
                    <br />
                    <small>
                      {c.artist}
                      {useSpotify && loggedIn && !c.spotifyId && ' · no Spotify link yet'}
                    </small>
                  </td>
                  <td className="actions">
                    <a href={cardUrl(baseUrl, c, qrMode)} target="_blank" rel="noreferrer">
                      Test
                    </a>
                    <button className="secondary" onClick={() => setDeck((d) => d.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="download" onClick={download} disabled={!deck.length || busy}>
          {busy ? 'Making PDF…' : 'Download PDF'}
        </button>
        {isLocal && !useSpotify && deck.length > 0 && (
          <p className="hint">
            Note: QR codes point to {baseUrl}, which a phone can't reach. Make the PDF from the live site (or set
            VITE_PUBLIC_URL) before printing.
          </p>
        )}
        <p className="hint">
          Print double-sided, flip on the long edge, at 100% scale (no “fit to page”). 12 cards per sheet.
        </p>
      </section>
    </main>
  )
}

function CardBack({ card }: { card: Card }) {
  return (
    <div className="card-back">
      <span className="card-artist">{card.artist}</span>
      <span className="card-year">{card.year || '····'}</span>
      <span className="card-title">{card.title}</span>
    </div>
  )
}
