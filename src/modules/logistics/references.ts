/** Display-only references. IDs sent to services and persisted in the domain stay unchanged. */
export function logisticsReference(id: string, kind: 'order' | 'operation' = 'order') {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
  return `${kind === 'order' ? 'Pedido' : 'Frete'} ${code}`
}
