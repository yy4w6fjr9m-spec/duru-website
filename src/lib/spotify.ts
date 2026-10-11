// Spotify login (Authorization Code with PKCE, so no client secret is needed) and
// playback. The page first tries to become a Spotify player itself (Web Playback SDK),
// because iOS keeps suspending the Spotify app, which breaks remote control of it.
// Spotify Connect (telling the Spotify app what to play) is the fallback.

// A client ID is public (it appears in the login URL); only the secret must stay private,
// and PKCE doesn't use one.
const CLIENT_ID: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '6ea77af63df04dca86eb4985466adb81'
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state'
const TOKEN_KEY = 'spotify-token'
const VERIFIER_KEY = 'spotify-verifier'
const RETURN_KEY = 'spotify-return-to'

interface StoredToken {
  access: string
  refresh: string
  expiresAt: number
  scope: string
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

function saveToken(data: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }) {
  const previous = readToken()
  const token: StoredToken = {
    access: data.access_token,
    refresh: data.refresh_token ?? previous?.refresh ?? '',
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    scope: data.scope ?? previous?.scope ?? '',
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

// Logins from before the web player was added lack the `streaming` scope; ask again.
export const isLoggedIn = () => Boolean(readToken()?.scope?.includes('streaming'))

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

export async function accessToken(): Promise<string> {
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

/** Spotify track id of a song, or undefined if it isn't on Spotify. */
export async function findSpotifyId(isrc: string | undefined, title: string, artist: string) {
  return (await findSpotifyTrack(isrc, title, artist))?.replace('spotify:track:', '')
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
  name: string
  is_active: boolean
  is_restricted: boolean
  type: string
}

export class NoDeviceError extends Error {}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body.error?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

async function getDevices(): Promise<Device[]> {
  const res = await api('/me/player/devices')
  return res.ok ? ((await res.json()).devices as Device[]).filter((d) => !d.is_restricted) : []
}

/**
 * Plays a track via Spotify Connect. First on whatever device is already active
 * (the phone, or a speaker it's connected to); if none is, on the best available one.
 * iOS only lists the Spotify app as a device after it has played something recently.
 */
export async function playTrack(uri: string) {
  const body = JSON.stringify({ uris: [uri] })
  let res = await api('/me/player/play', { method: 'PUT', body })
  if (res.ok) return
  if (res.status !== 404) throw new Error(`Spotify: ${await errorMessage(res)}`)

  const devices = await getDevices()
  const device = devices.find((d) => d.type === 'Smartphone') ?? devices[0]
  if (!device) throw new NoDeviceError()

  res = await api(`/me/player/play?device_id=${device.id}`, { method: 'PUT', body })
  if (res.ok) return
  if (res.status === 404) throw new NoDeviceError()
  throw new Error(`Spotify (${device.name}): ${await errorMessage(res)}`)
}

export async function resume() {
  const res = await api('/me/player/play', { method: 'PUT' })
  if (!res.ok) throw new Error(`Spotify: ${await errorMessage(res)}`)
}

export async function pause() {
  await api('/me/player/pause', { method: 'PUT' })
}

/** Plays a track on a specific device, such as the in-page web player. */
export async function playOnDevice(uri: string, deviceId: string) {
  const res = await api(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri] }),
  })
  if (!res.ok) throw new Error(`Spotify: ${await errorMessage(res)}`)
}
