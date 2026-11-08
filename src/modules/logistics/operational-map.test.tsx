import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { MapContainerProps, TileLayerProps } from 'react-leaflet'
const { fitBounds, layer, container } = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  layer: { props: {} as TileLayerProps },
  container: { props: {} as MapContainerProps },
}))
vi.mock('react-leaflet', () => ({
  MapContainer: (props: MapContainerProps) => { container.props = props; return <div data-testid="map">{props.children}</div> },
  TileLayer: (props: TileLayerProps) => { layer.props = props; return <img alt="Tile de teste" /> },
  CircleMarker: ({ children, eventHandlers }: { children: ReactNode; eventHandlers: { click: () => void } }) => <button onClick={eventHandlers.click}>{children}</button>,
  Popup: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Polyline: ({ children }: { children: ReactNode }) => <section aria-label="Conexão esquemática">{children}</section>,
  useMap: () => ({ fitBounds }),
}))
vi.mock('./map-tiles', async (importOriginal) => ({ ...await importOriginal<typeof import('./map-tiles')>(), isBlockedTile: vi.fn() }))
import OperationalMap from './operational-map'
import { isBlockedTile } from './map-tiles'
import { createInitialScenario } from '@/data/commercial-scenario'
import { addLogisticsReferenceScenario } from '@/data/logistics-demo'
const data = createInitialScenario()
addLogisticsReferenceScenario(data, '2026-11-06T12:00:00.000Z')
const order = data.orders.find((o) => o.id === 'reference-4a-order-0')!
const loads = [{ id: order.id, producerOrganizationId: order.producerOrganizationId, producerName: 'Fazenda Santa Clara', buyerName: 'Comprador', productName: 'Tomate', quantityKg: order.quantityKg, status: order.status, delivery: order.delivery }]

function tileEvent(name: 'tileerror' | 'tileloadstart' | 'tileload', tile = screen.getByAltText('Tile de teste')) {
  // The mock supplies only the fields consumed by the Leaflet event handler.
  const handler = layer.props.eventHandlers?.[name] as (event: { tile: HTMLElement }) => void
  handler({ tile })
}
beforeEach(() => { vi.mocked(isBlockedTile).mockResolvedValue(false) })
afterEach(cleanup)
describe('map references', () => {
  it('shows origins/destinations, synthetic identification and schematic connections', () => {
    const select = vi.fn()
    render(<OperationalMap loads={loads} selectedIds={[order.id]} onSelect={select} />)
    expect(screen.getAllByText(/Ponto sintético de referência/)).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Conexão esquemática' })).toBeTruthy()
    fireEvent.click(screen.getByText(/Origem · Pedido/))
    expect(select).toHaveBeenCalledWith(order.id)
    expect(fitBounds).toHaveBeenCalled()
  })
  it('uses official HTTPS tiles, visible OSM attribution and a layer-specific referrer policy', () => {
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    expect(layer.props.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    const attribution = document.createElement('div')
    attribution.innerHTML = layer.props.attribution!
    expect(attribution.textContent).toBe('© OpenStreetMap contributors')
    expect(attribution.querySelector('a')?.href).toBe('https://www.openstreetmap.org/copyright')
    expect(layer.props.referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(layer.props.crossOrigin).toBe('anonymous')
    expect(container.props.attributionControl).not.toBe(false)
    expect(layer.props.updateWhenIdle).toBe(true)
    expect(layer.props.updateWhenZooming).toBe(false)
    expect(layer.props.keepBuffer).toBe(1)
  })
  it('removes failed tiles and preserves markers, selection and the map instance', () => {
    const select = vi.fn()
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={select} />)
    const map = screen.getByTestId('map')
    act(() => tileEvent('tileerror'))
    expect(screen.getByRole('status').textContent).toContain('Mapa base indisponível')
    expect(screen.queryByAltText('Tile de teste')).toBeNull()
    expect(screen.getByTestId('map')).toBe(map)
    fireEvent.click(screen.getByText(/Origem · Pedido/))
    expect(select).toHaveBeenCalledWith(order.id)
    expect(screen.queryByRole('region', { name: 'Conexão esquemática' })).toBeNull()
  })
  it('only reveals successfully validated tiles', async () => {
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    const tile = screen.getByAltText('Tile de teste')
    act(() => tileEvent('tileloadstart'))
    expect(tile.style.visibility).toBe('hidden')
    await act(async () => tileEvent('tileload'))
    expect(tile.style.visibility).toBe('')
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('hides a block image even when it fires tileload (HTTP 200)', async () => {
    vi.mocked(isBlockedTile).mockResolvedValue(true)
    render(<OperationalMap loads={loads} selectedIds={[order.id]} onSelect={() => {}} />)
    const tile = screen.getByAltText('Tile de teste')
    act(() => tileEvent('tileloadstart'))
    await act(async () => tileEvent('tileload'))
    expect(tile.style.visibility).toBe('hidden')
    expect(screen.queryByAltText('Tile de teste')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Mapa base indisponível')
    expect(screen.getByRole('region', { name: 'Conexão esquemática' })).toBeTruthy()
  })
  it('falls back if the browser cannot validate tiles', async () => {
    vi.mocked(isBlockedTile).mockRejectedValue(new Error('Canvas unavailable'))
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    await act(async () => tileEvent('tileload'))
    expect(screen.queryByAltText('Tile de teste')).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })
  it('retries only on request and allows hiding unrecognized error images', () => {
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    act(() => tileEvent('tileerror'))
    expect(screen.queryByAltText('Tile de teste')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar base novamente' }))
    expect(screen.getByAltText('Tile de teste')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar base cartográfica' }))
    expect(screen.queryByAltText('Tile de teste')).toBeNull()
  })
  it('ignores validation completed after a tile has been removed', async () => {
    let resolve!: (blocked: boolean) => void
    vi.mocked(isBlockedTile).mockReturnValue(new Promise((done) => { resolve = done }))
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    act(() => tileEvent('tileload'))
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar base cartográfica' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar base novamente' }))
    await act(async () => resolve(true))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByAltText('Tile de teste')).toBeTruthy()
  })
})
