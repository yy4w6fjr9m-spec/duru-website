export interface Card {
  /** Deezer track id; the QR code points to the player with this id. */
  deezerId: number
  title: string
  artist: string
  year: number
  /** Spotify track id; when set (and the deck uses Spotify QR codes) the QR opens Spotify. */
  spotifyId?: string
  /** YouTube video id; the QR code for SongSeeker contains this video's link. */
  youtubeId?: string
}
