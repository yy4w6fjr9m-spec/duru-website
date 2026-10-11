// Spotify Web Playback SDK: turns this page into a Spotify Connect device, so the full
// song plays in the browser and the Spotify app on the phone isn't needed.
// https://developer.spotify.com/documentation/web-playback-sdk

import { accessToken } from './spotify'

interface SdkPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  togglePlay(): Promise<void>
  pause(): Promise<void>
  addListener(event: string, cb: (data: { device_id?: string; message?: string; paused?: boolean }) => void): void
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (options: object) => SdkPlayer }
  }
}

let sdkLoaded: Promise<void> | undefined

function loadSdk(): Promise<void> {
  sdkLoaded ??= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.onerror = () => reject(new Error('Could not load the Spotify web player'))
    document.body.appendChild(script)
  })
  return sdkLoaded
}

export interface WebPlayer {
  deviceId: string
  /** Must be called synchronously inside the tap handler, or iOS blocks the audio. */
  activate(): Promise<void>
  togglePlay(): Promise<void>
  onPlayingChange(cb: (playing: boolean) => void): void
  disconnect(): void
}

/** Connects the in-page player. Rejects with Spotify's reason if it can't run here. */
export async function createWebPlayer(): Promise<WebPlayer> {
  await loadSdk()
  const player = new window.Spotify!.Player({
    name: 'Hitster Card Maker',
    getOAuthToken: (cb: (token: string) => void) => {
      accessToken()
        .then(cb)
        .catch(() => {}) // Not logged in; the player reports an authentication_error.
    },
    volume: 1,
  })

  const deviceId = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The Spotify web player took too long to start')), 15000)
    const fail = (data: { message?: string }) => {
      clearTimeout(timeout)
      reject(new Error(data.message ?? 'The Spotify web player failed to start'))
    }
    player.addListener('ready', (data) => {
      clearTimeout(timeout)
      resolve(data.device_id!)
    })
    player.addListener('initialization_error', fail)
    player.addListener('authentication_error', fail)
    player.addListener('account_error', fail)
    player.connect().then((ok) => {
      if (!ok) fail({ message: 'The Spotify web player could not connect' })
    })
  })

  return {
    deviceId,
    activate: () => player.activateElement(),
    togglePlay: () => player.togglePlay(),
    onPlayingChange: (cb) => player.addListener('player_state_changed', (state) => state && cb(!state.paused)),
    disconnect: () => player.disconnect(),
  }
}
