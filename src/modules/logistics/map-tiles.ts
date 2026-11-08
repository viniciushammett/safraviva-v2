// Keep the provider URL, attribution and request policy together when changing providers.
export const operationalTileProvider = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOrigin: 'anonymous',
} as const

// SHA-256 of the decoded RGBA pixels, independent of PNG compression/metadata.
// Official 256px block images (403 and 403r), retrieved 2026-11-08:
// https://wiki.openstreetmap.org/wiki/File:403_tile.png
// https://wiki.openstreetmap.org/wiki/File:403r_tile.png
const blockedTileDigests = new Set([
  'f8b5710e22e355be2e2867058c3cff2f762ecfd32ffa0416fbe568ebf7d9ee7f',
  'f7f64bc84eb5dfd741fe35f95f4c9b0e2abef6ed19c15ce387a9f8f07a23297a',
])

export async function isBlockedTile(tile: HTMLImageElement): Promise<boolean> {
  if (tile.naturalWidth !== 256 || tile.naturalHeight !== 256) throw new Error('Unexpected tile dimensions')
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Tile validation unavailable')
  context.drawImage(tile, 0, 0)
  const pixels = context.getImageData(0, 0, 256, 256).data
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels))
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return blockedTileDigests.has(hex)
}
