import { z } from 'zod'
const text = z.string().trim().min(1, 'Preencha o local e o município.').max(300)
const state = z.string().regex(/^[A-Z]{2}$/, 'Informe a UF com duas letras maiúsculas.')
const restriction = z.enum(['ambient', 'refrigerated', 'fragile'])
export const deliveryLocationSchema = z.object({ label: text, city: text, state, coordinates: z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), source: z.enum(['synthetic', 'provided_reference']) }).strict().optional() }).strict()
export const deliveryInformationSchema = z.object({
  origin: deliveryLocationSchema, destination: deliveryLocationSchema,
  windowStart: z.iso.date(), windowEnd: z.iso.date(),
  weightKg: z.number().finite().positive().max(1e9).refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001),
  restrictions: z.array(restriction).min(1).refine((items) => new Set(items).size === items.length && !(items.includes('ambient') && items.includes('refrigerated')), 'Selecione um regime de temperatura compatível.'),
  referenceDistanceKm: z.number().finite().positive().max(10000),
}).strict().refine((d) => d.windowStart <= d.windowEnd, { path: ['windowEnd'], message: 'Fim da janela anterior ao início.' })
export const logisticsPartnerProfileSchema = z.object({ vehicleType: text, capacityKg: z.number().finite().positive().max(1e9), serviceStates: z.array(state).min(1), available: z.boolean(), capabilities: z.array(restriction).min(1), source: z.enum(['synthetic', 'provided_reference']) }).strict()
