import { logisticsReference } from './references'
import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { latLngBounds, type LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DeliveryRow } from './types'
import { quantity } from '@/modules/production/presentation'
function Fit({ loads, selectedIds }: { loads: DeliveryRow[]; selectedIds: string[] }) {
  const map = useMap()
  useEffect(() => {
    const focused = selectedIds.length ? loads.filter((load) => selectedIds.includes(load.id)) : loads
    const points = focused.flatMap((load) => [load.delivery?.origin.coordinates, load.delivery?.destination.coordinates]).filter((p) => !!p).map((p): LatLngTuple => [p.latitude, p.longitude])
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [30, 30], maxZoom: 13 })
  }, [map, loads, selectedIds])
  return null
}
export default function OperationalMap({ loads, selectedIds, onSelect }: { loads: DeliveryRow[]; selectedIds: string[]; onSelect: (id: string) => void }) {
  const [tileError, setTileError] = useState(false)
  return <div>{tileError && <p role="status" className="mb-3 text-sm text-amber-800">Mapa base indisponível. A operação logística continua disponível nas tabelas.</p>}
    <MapContainer center={[-22.9, -47.06]} zoom={10} scrollWheelZoom={false} className="relative z-0 h-[clamp(16rem,40dvh,24rem)] w-full overflow-hidden rounded-lg" aria-label="Mapa operacional de referências">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ tileerror: () => setTileError(true) }} />
      <Fit loads={loads} selectedIds={selectedIds} />
      {loads.map((load) => {
        const delivery = load.delivery
        if (!delivery) return null
        const active = selectedIds.includes(load.id)
        const points = [delivery.origin.coordinates, delivery.destination.coordinates]
        return <div key={load.id}>{points.map((point, index) => point && <CircleMarker key={`${load.id}-${index}`} center={[point.latitude, point.longitude]} radius={active ? 10 : 6} pathOptions={{ color: active ? '#164B35' : index === 0 ? '#16845B' : '#64736B', fillOpacity: active ? 0.8 : 0.4 }} eventHandlers={{ click: () => onSelect(load.id) }}><Popup><strong title={load.id}>{index === 0 ? 'Origem' : 'Destino'} · {logisticsReference(load.id)}</strong><br />{load.productName} · {quantity(load.quantityKg)}<br />{index === 0 ? delivery.origin.label : delivery.destination.label}<br />{point.source === 'synthetic' ? 'Ponto sintético de referência' : 'Referência informada, não verificada'}</Popup></CircleMarker>)}
          {active && points[0] && points[1] && <Polyline positions={points.map((p): LatLngTuple => [p!.latitude, p!.longitude])} pathOptions={{ color: '#16845B', dashArray: '6 8' }}><Popup>Conexão esquemática. Não representa trajeto rodoviário.</Popup></Polyline>}
        </div>
      })}
    </MapContainer>
  </div>
}
