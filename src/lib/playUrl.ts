import type { Card } from '../types'

/**
 * What a card's QR code contains:
 * - 'youtube': a YouTube link, to scan with SongSeeker (songseeker.grub3r.io), which
 *   plays the full song in a hidden player.
 * - 'spotify': a Spotify link; the phone camera opens the song in the Spotify app.
 * - 'player': this site's blind player (30-second preview).
 */
export type QrMode = 'youtube' | 'spotify' | 'player'

export const QR_MODES: QrMode[] = ['youtube', 'spotify', 'player']

export function playUrl(baseUrl: string, card: Card): string {
  return `${baseUrl.replace(/\/$/, '')}/?p=${card.deezerId}`
}

/** The QR content for a card, or undefined if the card lacks the link this mode needs. */
export function cardUrl(baseUrl: string, card: Card, mode: QrMode): string | undefined {
  // The exact link format tested with SongSeeker on an iPhone.
  if (mode === 'youtube') return card.youtubeId && `https://www.youtube.com/watch?v=${card.youtubeId}`
  if (mode === 'spotify') return card.spotifyId ? `https://open.spotify.com/track/${card.spotifyId}` : playUrl(baseUrl, card)
  return playUrl(baseUrl, card)
}
