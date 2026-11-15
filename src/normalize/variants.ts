/**
 * Acabamentos (variantes de impressão) de uma carta, a partir de `variants_detailed`.
 *
 * O ID da variante é montado só com os atributos dela, para continuar o mesmo
 * entre uma montagem e outra do catálogo (a coleção do usuário aponta para esse ID).
 *   intl:swsh3-136/reverse
 *   intl:sv03.5-001/reverse+pokeball
 *   intl:base1-4/holo+1st-edition
 */
import type { RawCard, RawDetailedVariant } from '../tcgdex-types.ts'

export interface Variant {
  id: string
  finish: string // normal | reverse | holo | lenticular | metal
  foil: string | null // padrão do reverse/holo: pokeball, masterball, cosmos, cracked-ice…
  subtype: string | null // shadowless, unlimited, erros de impressão…
  size: string // standard | jumbo
  stamps: string[] // 1st-edition, set-logo, staff, pre-release…
  sortOrder: number
}

const FINISH_ORDER = ['normal', 'holo', 'reverse', 'lenticular', 'metal']

/** Valores que aparecem traduzidos na TCGdex em português. */
const PT_VALUES: Record<string, string> = {
  'padrão': 'standard',
  'poké-bola': 'pokeball',
  'master-bola': 'masterball',
  ouro: 'gold',
  energia: 'energy',
  'galáxia': 'galaxy',
  'bola-crepúsculo': 'duskball',
  'bola-de-amor': 'loveball',
  'bola-de-amizade': 'friendball',
  'bola-rápida': 'quickball',
  'logo-da-coleção': 'set-logo',
  equipe: 'staff',
  'pré-lançamento': 'pre-release',
  'ditto-destacável': 'peelable-ditto',
}

/** "1st Edition" / "1st edition" / "1st-edition" → "1st-edition" */
export function slugValue(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return PT_VALUES[slug] ?? slug
}

function fromDetailed(cardId: string, detailed: RawDetailedVariant[]): Variant[] {
  return detailed.map((v) => {
    const finish = slugValue(v.type)
    const stamps = (v.stamp ?? []).map(slugValue).sort()
    return {
      id: '',
      finish,
      foil: v.foil ? slugValue(v.foil) : null,
      subtype: v.subtype ? slugValue(v.subtype) : null,
      size: slugValue(v.size || 'standard'),
      stamps,
      sortOrder: 0,
    }
  })
}

/** Usado quando a carta não tem `variants_detailed`: só os indicadores booleanos. */
function fromFlags(card: RawCard): Variant[] {
  const v = card.variants
  if (!v) return []
  const out: Variant[] = []
  const base = { id: '', foil: null, subtype: null, size: 'standard', sortOrder: 0 }
  if (v.normal) out.push({ ...base, finish: 'normal', stamps: [] })
  if (v.holo) out.push({ ...base, finish: 'holo', stamps: [] })
  if (v.reverse) out.push({ ...base, finish: 'reverse', stamps: [] })
  if (v.firstEdition) out.push({ ...base, finish: v.holo ? 'holo' : 'normal', stamps: ['1st-edition'] })
  if (v.wPromo) out.push({ ...base, finish: 'holo', stamps: ['w-promo'] })
  return out
}

export function buildVariants(cardId: string, card: RawCard): Variant[] {
  const variants = card.variants_detailed?.length ? fromDetailed(cardId, card.variants_detailed) : fromFlags(card)

  variants.sort((a, b) => {
    const fa = FINISH_ORDER.indexOf(a.finish)
    const fb = FINISH_ORDER.indexOf(b.finish)
    return (
      (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb) ||
      Number(!a.stamps.includes('1st-edition')) - Number(!b.stamps.includes('1st-edition')) ||
      (a.foil ?? '').localeCompare(b.foil ?? '') ||
      (a.subtype ?? '').localeCompare(b.subtype ?? '') ||
      a.stamps.join('+').localeCompare(b.stamps.join('+')) ||
      a.size.localeCompare(b.size)
    )
  })

  const seen = new Set<string>()
  const out: Variant[] = []
  for (const v of variants) {
    const parts = [v.finish, v.foil, v.subtype, ...v.stamps, v.size === 'standard' ? null : v.size].filter(Boolean)
    const id = `${cardId}/${parts.join('+')}`
    if (seen.has(id)) continue // duplicata exata na fonte
    seen.add(id)
    out.push({ ...v, id, sortOrder: out.length })
  }
  return out
}
