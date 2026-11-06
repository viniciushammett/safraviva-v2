import type { Profile, Workspace } from '@/types/workspace'

export const profileLabels: Record<Profile, string> = {
  producer: 'Produtor Rural', buyer: 'Comprador Comercial',
}
export const workspaces: readonly Workspace[] = [
  { id: 'santa-clara', name: 'Fazenda Santa Clara', profile: 'producer', location: 'Campinas, São Paulo', initials: 'SC', user: { name: 'João Oliveira', initials: 'JO', role: 'Administrador' } },
  { id: 'bom-preco', name: 'Mercado Bom Preço', profile: 'buyer', location: 'Campinas, São Paulo', initials: 'BP', user: { name: 'Mariana Costa', initials: 'MC', role: 'Administradora' } },
]
