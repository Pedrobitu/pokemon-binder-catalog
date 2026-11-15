/**
 * Normalização de categoria, tipo TCG, estágio e mecânica.
 * Inglês e japonês já vêm com os valores em inglês; o português vem traduzido.
 */

/** Tipos TCG (energias impressas na carta). Fada deixou de existir a partir de Espada e Escudo. */
export const TCG_TYPES = {
  grass: { en: 'Grass', pt: 'Planta' },
  fire: { en: 'Fire', pt: 'Fogo' },
  water: { en: 'Water', pt: 'Água' },
  lightning: { en: 'Lightning', pt: 'Elétrico' },
  psychic: { en: 'Psychic', pt: 'Psíquico' },
  fighting: { en: 'Fighting', pt: 'Lutador' },
  darkness: { en: 'Darkness', pt: 'Escuridão' },
  metal: { en: 'Metal', pt: 'Metal' },
  fairy: { en: 'Fairy', pt: 'Fada' },
  dragon: { en: 'Dragon', pt: 'Dragão' },
  colorless: { en: 'Colorless', pt: 'Incolor' },
} as const
export type TcgType = keyof typeof TCG_TYPES

const TYPE_RAW: Record<string, TcgType> = {}
for (const [code, names] of Object.entries(TCG_TYPES) as [TcgType, { en: string; pt: string }][]) {
  TYPE_RAW[names.en.toLowerCase()] = code
  TYPE_RAW[names.pt.toLowerCase()] = code
}
TYPE_RAW['sombrio'] = 'darkness' // como vem na TCGdex em português

export function normalizeTcgType(raw: string): TcgType | undefined {
  return TYPE_RAW[raw.toLowerCase()]
}

export type Category = 'pokemon' | 'trainer' | 'energy'
const CATEGORY_RAW: Record<string, Category> = {
  pokemon: 'pokemon',
  'pokémon': 'pokemon',
  trainer: 'trainer',
  treinador: 'trainer',
  energy: 'energy',
  energia: 'energy',
}
export function normalizeCategory(raw: string): Category | undefined {
  return CATEGORY_RAW[raw.toLowerCase()]
}

const STAGE_RAW: Record<string, string> = {
  basic: 'basic',
  'básico': 'basic',
  stage1: 'stage1',
  'estágio 1': 'stage1',
  stage2: 'stage2',
  'estágio 2': 'stage2',
  baby: 'baby',
  vmax: 'vmax',
  vstar: 'vstar',
  'v-astro': 'vstar',
  'v-union': 'v_union',
  mega: 'mega',
  'level-up': 'level_up',
  break: 'break',
  turbo: 'break',
  restored: 'restored',
  restaurado: 'restored',
}
export function normalizeStage(raw: string | null): string | null | undefined {
  if (raw === null) return null
  return STAGE_RAW[raw.toLowerCase()]
}

/**
 * Mecânica da carta: o "selo" do Pokémon (ex, EX, GX, V, VMAX, Radiante…).
 * Vem do campo `suffix`, do estágio e, em último caso, do nome.
 */
const SUFFIX_RAW: Record<string, string> = {
  ex: 'ex',
  EX: 'EX',
  GX: 'GX',
  'TAG TEAM-GX': 'tag_team_gx',
  ALIADOS: 'tag_team_gx',
  V: 'V',
  SP: 'SP',
  Prime: 'prime',
  Legend: 'legend',
  LENDA: 'legend',
}
const STAGE_MECHANIC: Record<string, string> = {
  vmax: 'VMAX',
  vstar: 'VSTAR',
  v_union: 'V-UNION',
  break: 'BREAK',
  level_up: 'LV.X',
}
export function detectMechanic(suffix: string | null, stage: string | null, name: string): string | null {
  if (stage && STAGE_MECHANIC[stage]) return STAGE_MECHANIC[stage]!
  if (suffix && SUFFIX_RAW[suffix]) return SUFFIX_RAW[suffix]!
  if (/^Radiant |^かがやく/.test(name)) return 'radiant'
  if (/^Shining |^ひかる/.test(name)) return 'shining'
  if (/ δ$|（デルタ種）|\(δ\)/.test(name)) return 'delta'
  if (/☆|の星$/.test(name)) return 'star'
  if (/[\s-](ex)$|[ァ-ヶー]ex$/.test(name)) return 'ex'
  if (/[\s-](EX)$|[ァ-ヶー]EX$/.test(name)) return 'EX'
  if (/[\s-]?GX$/.test(name)) return 'GX'
  if (/[\s-]?VMAX$/.test(name)) return 'VMAX'
  if (/[\s-]?VSTAR$/.test(name)) return 'VSTAR'
  if (/[ァ-ヶー\s]V$/.test(name)) return 'V'
  return null
}

/**
 * Forma do Pokémon que muda a ordem dentro do mesmo número da Pokédex:
 * base → alola → galar → hisui → paldea → mega.
 */
export const FORM_ORDER = ['base', 'alola', 'galar', 'hisui', 'paldea', 'mega'] as const
export type Form = (typeof FORM_ORDER)[number]

/**
 * @param isMegaOf em japonês "メガ" pode ser parte do nome da espécie (メガヤンマ = Yanmega,
 *   メガニウム = Meganium). Recebe o nome e diz se é "メガ" + nome de outra espécie.
 */
export function detectForm(name: string, stage: string | null, isMegaOf: (name: string) => boolean): Form {
  if (/^Alolan |^アローラ/.test(name)) return 'alola'
  if (/^Galarian |^ガラル/.test(name)) return 'galar'
  if (/^Hisuian |^ヒスイ/.test(name)) return 'hisui'
  if (/^Paldean |^パルデア/.test(name)) return 'paldea'
  if (stage === 'mega' || /^Mega |^M [A-Z]|^M[ァ-ヶ]/.test(name)) return 'mega'
  if (/^メガ/.test(name) && isMegaOf(name)) return 'mega'
  return 'base'
}
