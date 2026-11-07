import { validateDomainData } from '@/domain/integrity'
import { referencePartners } from '@/data/logistics-reference'
/** Additive migration. No guessed destinations, new orders, financial edits or overwrites. */
export function migrateDomainV1(input: unknown) {
  const data = validateDomainData(input)
  for (const organization of data.organizations) {
    if (organization.type === 'logistics_partner' && !organization.logisticsProfile && referencePartners[organization.id]) organization.logisticsProfile = structuredClone(referencePartners[organization.id])
  }
  return validateDomainData(data)
}
