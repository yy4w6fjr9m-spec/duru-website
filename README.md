# Hitster Card Maker

Search a song, check its year, and download a printable PDF of Hitster-style cards.

- **Front:** a QR code that opens this site's blind player (`/?p=<deezer track id>`), which plays
  a 30-second Deezer preview without showing the title.
- **Back:** artist, year and title. Backs are mirrored so they line up when printed
  double-sided (flip on the long edge, 100% scale).

Song search and previews come from the Deezer API (no key needed). The original release
year comes from MusicBrainz, because streaming services often list a remaster's year.

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

Set `VITE_SPOTIFY_CLIENT_ID` (see `.env.example`). The player page then offers "Connect Spotify":
it logs in with PKCE (no client secret) and plays the full song on the phone's Spotify app via
Spotify Connect, matching the Deezer track to Spotify by ISRC. Without it, the 30-second preview plays.

In the Spotify developer dashboard, add the site address with a trailing slash as a Redirect URI
(e.g. `https://your-site.vercel.app/`; for local dev use `http://127.0.0.1:5173/`, since Spotify
rejects `localhost`), and add each player's Spotify account under User Management (max 5).
