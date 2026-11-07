import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
const { fitBounds } = vi.hoisted(() => ({ fitBounds: vi.fn() }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ attribution, eventHandlers }: { attribution: string; eventHandlers: { tileerror: () => void } }) => <button onClick={eventHandlers.tileerror}>{attribution}</button>,
  CircleMarker: ({ children, eventHandlers }: { children: ReactNode; eventHandlers: { click: () => void } }) => <button onClick={eventHandlers.click}>{children}</button>,
  Popup: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Polyline: ({ children }: { children: ReactNode }) => <section aria-label="Conexão esquemática">{children}</section>,
  useMap: () => ({ fitBounds }),
}))
import OperationalMap from './operational-map'
import { createInitialScenario } from '@/data/commercial-scenario'
import { addLogisticsReferenceScenario } from '@/data/logistics-demo'
const data = createInitialScenario()
addLogisticsReferenceScenario(data, '2026-11-06T12:00:00.000Z')
const order = data.orders.find((o) => o.id === 'reference-4a-order-0')!
const loads = [{ id: order.id, producerOrganizationId: order.producerOrganizationId, producerName: 'Fazenda Santa Clara', buyerName: 'Comprador', productName: 'Tomate', quantityKg: order.quantityKg, status: order.status, delivery: order.delivery }]
afterEach(cleanup)
describe('map references', () => {
  it('shows origins/destinations, synthetic identification, attribution and schematic connections', () => {
    const select = vi.fn()
    render(<OperationalMap loads={loads} selectedIds={[order.id]} onSelect={select} />)
    expect(screen.getAllByText(/Ponto sintético de referência/)).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Conexão esquemática' })).toBeTruthy()
    fireEvent.click(screen.getByText(/Origem · Pedido/))
    expect(select).toHaveBeenCalledWith(order.id)
    expect(fitBounds).toHaveBeenCalled()
    expect(screen.getByText(/OpenStreetMap/)).toBeTruthy()
  })
  it('handles base tile failure without preventing reference selection', () => {
    render(<OperationalMap loads={loads} selectedIds={[]} onSelect={() => {}} />)
    fireEvent.click(screen.getByText(/OpenStreetMap/))
    expect(screen.getByText(/Mapa base indisponível/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Conexão esquemática' })).toBeNull()
  })
})
