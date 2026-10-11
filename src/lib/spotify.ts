// Spotify login (Authorization Code with PKCE, so no client secret is needed) and
// Spotify Connect playback: the player page tells the Spotify app on the phone what
// to play. The Web Playback SDK can't be used because it doesn't work in iOS Safari.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const SCOPES = 'user-read-playback-state user-modify-playback-state'
const TOKEN_KEY = 'spotify-token'
const VERIFIER_KEY = 'spotify-verifier'
const RETURN_KEY = 'spotify-return-to'

interface StoredToken {
  access: string
  refresh: string
  expiresAt: number
}

export const spotifyConfigured = Boolean(CLIENT_ID)

const redirectUri = () => `${window.location.origin}/`

function readToken(): StoredToken | undefined {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}

function saveToken(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  const previous = readToken()
  const token: StoredToken = {
    access: data.access_token,
    refresh: data.refresh_token ?? previous?.refresh ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

export const isLoggedIn = () => Boolean(readToken())

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Sends the browser to Spotify's login page; it comes back to `/?code=…`. */
export async function login() {
  if (!CLIENT_ID) throw new Error('Spotify client ID is not configured')
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

async function requestToken(body: Record<string, string>) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID!, ...body }),
  })
  if (!res.ok) throw new Error(`Spotify login failed (${res.status})`)
  saveToken(await res.json())
}

/** Finishes the login after Spotify redirects back. Returns the page to go back to. */
export async function handleLoginRedirect(code: string): Promise<string> {
  const verifier = localStorage.getItem(VERIFIER_KEY) ?? ''
  localStorage.removeItem(VERIFIER_KEY)
  await requestToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier })
  const returnTo = localStorage.getItem(RETURN_KEY) ?? '/'
  localStorage.removeItem(RETURN_KEY)
  return returnTo
}

async function accessToken(): Promise<string> {
  const token = readToken()
  if (!token) throw new NotLoggedInError()
  if (Date.now() < token.expiresAt) return token.access
  try {
    await requestToken({ grant_type: 'refresh_token', refresh_token: token.refresh })
  } catch {
    logout()
    throw new NotLoggedInError()
  }
  return readToken()!.access
}

export class NotLoggedInError extends Error {}
export class NoDeviceError extends Error {}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
  })
  if (res.status === 401) {
    logout()
    throw new NotLoggedInError()
  }
  return res
}

/** Finds the Spotify version of a song: by ISRC first, then by title and artist. */
export async function findSpotifyTrack(isrc: string | undefined, title: string, artist: string) {
  const queries = [isrc && `isrc:${isrc}`, `track:${title} artist:${artist}`].filter(Boolean) as string[]
  for (const q of queries) {
    const res = await api(`/search?type=track&limit=1&q=${encodeURIComponent(q)}`)
    if (!res.ok) continue
    const uri: string | undefined = (await res.json()).tracks?.items?.[0]?.uri
    if (uri) return uri
  }
  return undefined
}

interface Device {
  id: string
  is_active: boolean
  type: string
}

async function pickDevice(): Promise<string> {
  const res = await api('/me/player/devices')
  const devices: Device[] = res.ok ? (await res.json()).devices : []
  const device =
    devices.find((d) => d.is_active) ?? devices.find((d) => d.type === 'Smartphone') ?? devices[0]
  if (!device) throw new NoDeviceError()
  return device.id
}

export async function playTrack(uri: string) {
  const deviceId = await pickDevice()
  const res = await api(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri] }),
  })
  if (res.status === 404) throw new NoDeviceError()
  if (!res.ok) throw new Error(`Spotify couldn't start playback (${res.status})`)
}

export async function pause() {
  await api('/me/player/pause', { method: 'PUT' })
}
