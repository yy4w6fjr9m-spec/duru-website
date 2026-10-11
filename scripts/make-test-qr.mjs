// Generates test QR codes to check whether the Hitster app accepts custom codes.
import QRCode from 'qrcode'

const trackId = '003vvx7Niy0yvhvHt4a68B' // Mr. Brightside – The Killers
const codes = {
  'spotify-link': `https://open.spotify.com/track/${trackId}`,
  'spotify-uri': `spotify:track:${trackId}`,
}

for (const [name, text] of Object.entries(codes)) {
  await QRCode.toFile(`test-qr/${name}.png`, text, { width: 600, margin: 4 })
  console.log(`test-qr/${name}.png -> ${text}`)
}
