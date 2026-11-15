/**
 * Raridade normalizada. A TCGdex já entrega as raridades do inglês e do japonês com os
 * mesmos nomes (ex.: o "AR" japonês vem como "Illustration rare"); o português vem traduzido.
 *
 * `rank` agrupa e ordena as raridades em faixas:
 *   0 sem raridade / promo · 1 comum · 2 incomum · 3 rara · 4 rara holo
 *   5 especiais (ex/EX/GX/V, Prime, LV.X, Radiante…) · 6 ultra / ilustração / brilhante
 *   7 secretas e ilustração especial · 8 hiper raras
 */
export interface Rarity {
  code: string
  rank: number
  en: string
  pt: string
}

/** [código, faixa, nome EN, nome PT, valores brutos aceitos] */
const TABLE: [string, number, string, string, string[]][] = [
  ['none', 0, 'No rarity', 'Sem raridade', ['None']],
  ['promo', 0, 'Promo', 'Promo', ['Promo']],
  ['common', 1, 'Common', 'Comum', ['Common', 'Comum']],
  ['uncommon', 2, 'Uncommon', 'Incomum', ['Uncommon', 'Incomum']],
  ['rare', 3, 'Rare', 'Rara', ['Rare', 'Rara']],
  ['rare_holo', 4, 'Rare Holo', 'Rara Holo', ['Holo Rare', 'Rare Holo', 'Rara Holo']],
  ['rare_holo_lvx', 5, 'Rare Holo LV.X', 'Rara Holo LV.X', ['Rare Holo LV.X']],
  ['rare_prime', 5, 'Rare Prime', 'Rara Prime', ['Rare PRIME']],
  ['legend', 5, 'LEGEND', 'LENDA', ['LEGEND']],
  ['rare_holo_v', 5, 'Rare Holo V', 'Rara Holo V', ['Holo Rare V', 'Rara Holo V']],
  ['rare_holo_vmax', 5, 'Rare Holo VMAX', 'Rara Holo VMAX', ['Holo Rare VMAX', 'Rara Holo VMAX']],
  ['rare_holo_vstar', 5, 'Rare Holo VSTAR', 'Rara Holo V-ASTRO', ['Holo Rare VSTAR', 'Rara Holo VSTAR']],
  ['double_rare', 5, 'Double Rare', 'Rara Dupla', ['Double rare', 'Rara Dupla']],
  ['ace_spec', 5, 'ACE SPEC Rare', 'Rara ACE SPEC', ['ACE SPEC Rare', 'ACE SPEC Raro']],
  ['radiant_rare', 5, 'Radiant Rare', 'Rara Radiante', ['Radiant Rare', 'Rara Radiante']],
  ['amazing_rare', 5, 'Amazing Rare', 'Rara Incrível', ['Amazing Rare', 'Raras Incríveis']],
  ['classic_collection', 5, 'Classic Collection', 'Coleção Clássica', ['Classic Collection']],
  ['ultra_rare', 6, 'Ultra Rare', 'Ultra Rara', ['Ultra Rare', 'Ultra Rara']],
  ['triple_rare', 6, 'Triple Rare', 'Rara Tripla', ['Triple Rare']],
  ['illustration_rare', 6, 'Illustration Rare', 'Ilustração Rara', ['Illustration rare', 'Ilustração Rara']],
  ['character_rare', 6, 'Character Rare', 'Rara de Personagem', ['Character Rare']],
  ['shiny_rare', 6, 'Shiny Rare', 'Rara Brilhante', ['Shiny rare', 'Shiny rara']],
  ['shiny_rare_v', 6, 'Shiny Rare V', 'Rara Brilhante V', ['Shiny rare V', 'Shiny rara V']],
  ['shiny_rare_vmax', 6, 'Shiny Rare VMAX', 'Rara Brilhante VMAX', ['Shiny rare VMAX', 'Shiny rara VMAX']],
  ['full_art_trainer', 6, 'Full Art Trainer', 'Treinador Arte Completa', ['Full Art Trainer', 'Arte Completa de Treinador']],
  ['pikachu_rare', 6, 'Pikachu Rare', 'Rara Pikachu', ['Pikachu Rare']],
  ['mega_attack_rare', 6, 'Mega Attack Rare', 'Rara Mega Ataque', ['Mega Attack Rare']],
  ['special_illustration_rare', 7, 'Special Illustration Rare', 'Ilustração Rara Especial', ['Special illustration rare', 'Ilustração Rara Especial']],
  ['character_super_rare', 7, 'Character Super Rare', 'Super Rara de Personagem', ['Character Super Rare']],
  ['shiny_ultra_rare', 7, 'Shiny Ultra Rare', 'Ultra Rara Brilhante', ['Shiny Ultra Rare', 'Brilhante Ultra Rara']],
  ['secret_rare', 7, 'Secret Rare', 'Rara Secreta', ['Secret Rare', 'Rare Secreta']],
  ['black_white_rare', 7, 'Black White Rare', 'Rara Preto e Branco', ['Black White Rare', 'Rara Preto e Branco']],
  ['rgb_rare', 7, 'RGB Rare', 'Rara RGB', ['RGB Rare']],
  ['futuristic_rare', 7, 'Futuristic Rare', 'Rara Futurista', ['Futuristic Rare']],
  ['hyper_rare', 8, 'Hyper Rare', 'Hiper Rara', ['Hyper rare', 'Hiper rara']],
  ['mega_hyper_rare', 8, 'Mega Hyper Rare', 'Mega Hiper Rara', ['Mega Hyper Rare', 'Mega Hiper Raro']],
]

export const RARITIES: Rarity[] = TABLE.map(([code, rank, en, pt]) => ({ code, rank, en, pt }))

/** Usada quando a fonte não informa a raridade (comum em cartas japonesas). */
export const UNKNOWN_RARITY: Rarity = { code: 'unknown', rank: 0, en: 'Unknown', pt: 'Não informada' }

const BY_RAW = new Map<string, Rarity>()
TABLE.forEach(([, , , , raws], i) => {
  for (const raw of raws) BY_RAW.set(raw.toLowerCase(), RARITIES[i]!)
})

/** Devolve a raridade normalizada; `undefined` quando o valor bruto não está na tabela. */
export function normalizeRarity(raw: string | null): Rarity | undefined {
  if (raw === null || raw === '') return UNKNOWN_RARITY
  return BY_RAW.get(raw.toLowerCase())
}
