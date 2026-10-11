import type { Card } from '../types'

/** What a card's QR code opens: the song in the Spotify app, or this site's blind player. */
export type QrMode = 'spotify' | 'player'

export function playUrl(baseUrl: string, card: Card): string {
  return `${baseUrl.replace(/\/$/, '')}/?p=${card.deezerId}`
}

export function cardUrl(baseUrl: string, card: Card, mode: QrMode): string {
  return mode === 'spotify' && card.spotifyId
    ? `https://open.spotify.com/track/${card.spotifyId}`
    : playUrl(baseUrl, card)
}
