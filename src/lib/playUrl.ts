import type { Card } from '../types'

/**
 * What a card's QR code opens. 'spotify': a page on this site that starts the song in
 * Spotify (or opens it in the Spotify app). 'player': this site's blind player.
 * Both point at this site, so the behaviour can improve without reprinting cards.
 */
export type QrMode = 'spotify' | 'player'

export function playUrl(baseUrl: string, card: Card): string {
  return `${baseUrl.replace(/\/$/, '')}/?p=${card.deezerId}`
}

export function cardUrl(baseUrl: string, card: Card, mode: QrMode): string {
  return mode === 'spotify' && card.spotifyId
    ? `${baseUrl.replace(/\/$/, '')}/?s=${card.spotifyId}`
    : playUrl(baseUrl, card)
}
