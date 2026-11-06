import { z } from 'zod'
// Navigation carries only an intent. The completed simulation stays in its existing session store.
export const planningHandoffSchema = z.object({ source: z.literal('market-planning'), organizationId: z.string().min(1) })
export type PlanningHandoff = z.infer<typeof planningHandoffSchema>
export const productionPlanningPath = '/producer/production' as const
export function planningHandoff(organizationId: string): PlanningHandoff { return { source: 'market-planning', organizationId } }
