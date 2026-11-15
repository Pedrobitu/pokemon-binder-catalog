/** Formato bruto devolvido pela TCGdex (GraphQL), do jeito que é salvo em raw/. */

export interface RawSet {
  id: string
  name: string
  releaseDate: string | null
  serie: { id: string; name: string }
  cardCount: { official: number | null; total: number | null }
  logo: string | null
  symbol: string | null
}

export interface RawVariants {
  normal: boolean | null
  reverse: boolean | null
  holo: boolean | null
  firstEdition: boolean | null
  wPromo: boolean | null
}

export interface RawDetailedVariant {
  type: string
  subtype: string | null
  size: string
  stamp: string[] | null
  foil: string | null
}

export interface RawCard {
  id: string
  localId: string
  name: string
  category: string
  /** null quando a TCGdex não tem a raridade da carta (comum no japonês). */
  rarity: string | null
  dexId: number[] | null
  types: string[] | null
  stage: string | null
  suffix: string | null
  trainerType: string | null
  energyType: string | null
  illustrator: string | null
  image: string | null
  hp: number | null
  regulationMark: string | null
  variants: RawVariants | null
  variants_detailed: RawDetailedVariant[] | null
  set: { id: string }
}

/** Campos pedidos na consulta em lote (GraphQL) e copiados da resposta REST (ver pickRawCard). */
export const CARD_FIELDS = `
  id localId name category rarity dexId types stage suffix trainerType energyType
  illustrator image hp regulationMark
  variants { normal reverse holo firstEdition wPromo }
  variants_detailed { type subtype size stamp foil }
  set { id }
`

/** Converte a resposta REST de uma carta (que traz campos a mais, como preços) para RawCard. */
export function pickRawCard(json: Record<string, unknown>): RawCard {
  const get = <T>(key: string): T | null => (json[key] ?? null) as T | null
  const set = json.set as { id: string }
  const detailed = get<RawDetailedVariant[]>('variants_detailed')
  return {
    id: json.id as string,
    localId: json.localId as string,
    name: json.name as string,
    category: json.category as string,
    rarity: get('rarity'),
    dexId: get('dexId'),
    types: get('types'),
    stage: get('stage'),
    suffix: get('suffix'),
    trainerType: get('trainerType'),
    energyType: get('energyType'),
    illustrator: get('illustrator'),
    image: get('image'),
    hp: get('hp'),
    regulationMark: get('regulationMark'),
    variants: get('variants'),
    variants_detailed:
      detailed?.map((v) => ({
        type: v.type,
        subtype: v.subtype ?? null,
        size: v.size,
        stamp: v.stamp ?? null,
        foil: v.foil ?? null,
      })) ?? null,
    set: { id: set.id },
  }
}

export const SET_FIELDS = `
  id name releaseDate serie { id name } cardCount { official total } logo symbol
`
