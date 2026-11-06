import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MarketAnalysis } from '@/types/domain'
import { number } from './presentation'
export function MarketChart({ analysis }: { analysis: MarketAnalysis }) {
  const data = [{ period: `${analysis.periodDays} dias`, demand: analysis.estimatedDemandKg, supply: analysis.estimatedSupplyKg }]
  return <figure aria-label={`Comparativo de demanda e oferta em ${analysis.periodDays} dias`}>
    <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 288 }}>
      <BarChart data={data} margin={{ top: 20, right: 12, bottom: 8, left: 12 }} accessibilityLayer>
        <CartesianGrid stroke="#E2E8E4" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 12 }} /><YAxis tickFormatter={number} tick={{ fontSize: 11 }} width={72} unit=" kg" />
        <Tooltip formatter={(value) => `${number(Number(value))} kg`} /><Legend />
        <Bar dataKey="demand" name="Demanda estimada" fill="#164B35" radius={[4, 4, 0, 0]} maxBarSize={90} isAnimationActive={false} />
        <Bar dataKey="supply" name="Oferta regional" fill="#16845B" radius={[4, 4, 0, 0]} maxBarSize={90} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer></div>
    <figcaption className="mt-3 text-xs text-muted-foreground">Valores agregados: demanda {number(analysis.estimatedDemandKg)} kg e oferta {number(analysis.estimatedSupplyKg)} kg em {analysis.periodDays} dias.</figcaption>
  </figure>
}
