import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TileLayer, type Map as LeafletMap } from 'leaflet'
import OperationalMap from './operational-map'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('real Leaflet integration (without network requests)', () => {
  it('sets policy on tile images and preserves zoom/pan through tile failure and retry', () => {
    let map!: LeafletMap
    let layer!: TileLayer
    const onAdd = TileLayer.prototype.onAdd
    vi.spyOn(TileLayer.prototype, 'onAdd').mockImplementation(function (this: TileLayer, nextMap) {
      map = nextMap
      return onAdd.call(this, nextMap)
    })
    const { container } = render(<OperationalMap loads={[]} selectedIds={[]} onSelect={() => {}} />)
    map.eachLayer((candidate) => { if (candidate instanceof TileLayer) layer = candidate })
    const tile = container.querySelector<HTMLImageElement>('.leaflet-tile')!
    expect(tile).toBeTruthy()
    expect(tile.src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/10\/\d+\/\d+\.png$/)
    expect(tile.referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(tile.crossOrigin).toBe('anonymous')
    expect(tile.style.visibility).toBe('hidden')
    expect(screen.getByRole('link', { name: 'OpenStreetMap' }).getAttribute('href')).toBe('https://www.openstreetmap.org/copyright')
    const zoom = map.getZoom()
    fireEvent.click(screen.getByTitle('Zoom in'))
    expect(map.getZoom()).toBe(zoom + 1)
    const previousCenter = map.getCenter()
    act(() => { map.panBy([100, 0], { animate: false }) })
    expect(map.getCenter().equals(previousCenter)).toBe(false)
    const center = map.getCenter()
    act(() => { layer.fire('tileerror', { tile }) })
    expect(container.querySelector('.leaflet-tile')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Mapa base indisponível')
    fireEvent.click(screen.getByTitle('Zoom out'))
    expect(map.getZoom()).toBe(zoom)
    expect(map.getCenter().equals(center)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar base novamente' }))
    expect(map.getZoom()).toBe(zoom)
    expect(map.getCenter().equals(center)).toBe(true)
    expect(container.querySelector('.leaflet-tile')).toBeTruthy()
  })
})
