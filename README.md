# Hitster Card Maker

Search a song, check its year, and download a printable PDF of Hitster-style cards.

- **Front:** a QR code. Three modes:
  - **SongSeeker (default):** a YouTube link. Scan it in [SongSeeker](https://songseeker.grub3r.io)
    on the phone; it plays the full song in a hidden player. No Spotify needed.
  - **Spotify app:** a Spotify link; the phone camera opens the song in Spotify (title visible).
  - **Preview player:** this site's blind player (`/?p=<deezer track id>`), 30-second preview.
- **Back:** artist, year and title. Backs are mirrored so they line up when printed
  double-sided (flip on the long edge, 100% scale).

Song search and previews come from the Deezer API (no key needed). The original release
year comes from MusicBrainz, because streaming services often list a remaster's year.

## YouTube search

The card maker suggests YouTube videos for each song through `api/youtube.js`, a Vercel function
that calls the YouTube Data API. Set `YOUTUBE_API_KEY` in the Vercel project settings (free key from
Google Cloud; each search costs 100 of the 10,000 daily quota units, so about 100 songs a day).
Without a key you can paste a YouTube link per song instead.

## Develop

```sh
npm install
npm run dev
```

Deezer's API has no CORS headers, so `/api/deezer/*` is proxied: by Vite in development and by
`vercel.json` in production.

QR codes point to the address the site is opened from. PDFs made on `localhost` won't scan
on a phone; make them from the live site, or set `VITE_PUBLIC_URL` (see `.env.example`).

## Full songs with Spotify (optional)

The Spotify client ID is set in `src/lib/spotify.ts` (override with `VITE_SPOTIFY_CLIENT_ID`). The player page then offers "Connect Spotify":
it logs in with PKCE (no client secret) and plays the full song on the phone's Spotify app via
Spotify Connect, matching the Deezer track to Spotify by ISRC. Without it, the 30-second preview plays.

In the Spotify developer dashboard, add the site address with a trailing slash as a Redirect URI
(e.g. `https://your-site.vercel.app/`; for local dev use `http://127.0.0.1:5173/`, since Spotify
rejects `localhost`), and add each player's Spotify account under User Management (max 5).
