import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBlockedTile } from './map-tiles'

function imageWithPixels(pixels: Uint8ClampedArray) {
  vi.stubGlobal('crypto', webcrypto)
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  const tile = new Image()
  Object.defineProperties(tile, { naturalWidth: { value: 256 }, naturalHeight: { value: 256 } })
  return { tile, context }
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('OSM tile validation', () => {
  it.each(['403', '403r'])('recognizes the official %s block image independently of HTTP status', async (code) => {
    const pixels = new Uint8ClampedArray(inflateSync(readFileSync(`src/modules/logistics/__fixtures__/osm-${code}.rgba.deflate`)))
    const { tile, context } = imageWithPixels(pixels)
    expect(await isBlockedTile(tile)).toBe(true)
    expect(context.drawImage).toHaveBeenCalledWith(tile, 0, 0)
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, 256, 256)
  })
  it('accepts an ordinary tile including a single-color ocean tile', async () => {
    const { tile } = imageWithPixels(new Uint8ClampedArray(256 * 256 * 4).fill(200))
    expect(await isBlockedTile(tile)).toBe(false)
  })
  it('rejects unavailable canvas access so the map can fall back safely', async () => {
    const { tile } = imageWithPixels(new Uint8ClampedArray())
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    await expect(isBlockedTile(tile)).rejects.toThrow('Tile validation unavailable')
  })
  it('rejects unreadable cross-origin pixels', async () => {
    const { tile, context } = imageWithPixels(new Uint8ClampedArray())
    context.getImageData.mockImplementation(() => { throw new DOMException('Tainted canvas', 'SecurityError') })
    await expect(isBlockedTile(tile)).rejects.toThrow('Tainted canvas')
  })
  it('rejects an invalid image size', async () => {
    await expect(isBlockedTile(new Image())).rejects.toThrow('Unexpected tile dimensions')
  })
})
