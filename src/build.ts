/**
 * Etapa 2: transforma os dados brutos (raw/) no catálogo normalizado dist/catalog.db.
 * Também grava dist/build-diagnostics.json com tudo que não pôde ser normalizado,
 * para o relatório de cobertura.
 */
import { readFile, rename, rm, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { EXCLUDED_SERIES, PATHS, POKEAPI_LANG_MAP, SCHEMA_VERSION, type Lang, type Region } from './config.ts'
import { contentHash } from './lib/contentHash.ts'
import { parseCsv } from './lib/csv.ts'
import { readJson, writeFileAtomic } from './lib/files.ts'
import { inferDexFromName, normalizeName, type NameIndex } from './normalize/dex.ts'
import {
  detectForm,
  detectMechanic,
  normalizeCategory,
  normalizeStage,
  normalizeTcgType,
  type Form,
} from './normalize/fields.ts'
import { normalizeRarity, RARITIES, UNKNOWN_RARITY, type Rarity } from './normalize/rarity.ts'
import { buildVariants } from './normalize/variants.ts'
import { SCHEMA_SQL } from './schema.ts'
import type { RawCard, RawSet } from './tcgdex-types.ts'

/** Idiomas de cada região, em ordem de prioridade (o primeiro é a base dos dados da carta). */
const REGION_LANGS: Record<Region, Lang[]> = { intl: ['en', 'pt'], ja: ['ja'] }

interface Overrides {
  dex: Record<string, number[]>
  rarity: Record<string, string>
  form: Record<string, Form>
  excludeSets: string[]
}

const slugCode = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

// ---------- diagnóstico ----------
const tally = () => new Map<string, number>()
const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1)
const diag = {
  unmappedRarity: tally(),
  unmappedType: tally(),
  unmappedCategory: tally(),
  unmappedStage: tally(),
  excludedSets: [] as string[],
  emptySets: [] as { id: string; name: string; total: number }[],
  baseFromSecondaryLang: 0,
  inferredDex: [] as { id: string; name: string; dex: number; species: string }[],
  missingDex: [] as { id: string; name: string }[],
  fractionalDex: [] as { id: string; name: string; raw: number[] }[],
  outOfRangeDex: [] as { id: string; name: string; dex: number }[],
  dexMismatch: [] as { id: string; name: string; tcgdex: number; byName: number }[],
  jaNamesNotMatching: [] as { id: string; name: string; dex: number }[],
  overrides: { applied: 0, unknownIds: [] as string[] },
}

// ---------- leitura dos dados brutos ----------
const raw = {} as Record<Lang, { sets: RawSet[]; cards: RawCard[] }>
for (const lang of ['en', 'pt', 'ja'] as Lang[]) {
  raw[lang] = {
    sets: await readJson<RawSet[]>(resolve(PATHS.raw, 'tcgdex', lang, 'sets.json')),
    cards: await readJson<RawCard[]>(resolve(PATHS.raw, 'tcgdex', lang, 'cards.json')),
  }
}
const fetchManifest = await readJson<{ fetchedAt: string }>(resolve(PATHS.raw, 'fetch-manifest.json'))
const overrides = await readJson<Overrides>(PATHS.overrides)
const csv = async (name: string) => parseCsv(await readFile(resolve(PATHS.raw, 'pokeapi', `${name}.csv`), 'utf8'))

// ---------- banco ----------
await mkdir(PATHS.dist, { recursive: true })
const dbPath = resolve(PATHS.dist, 'catalog.db')
const tmpPath = `${dbPath}.tmp`
await rm(tmpPath, { force: true })
const db = new DatabaseSync(tmpPath)
db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = ON;')
db.exec(SCHEMA_SQL)
db.exec('BEGIN')

const insert = {
  meta: db.prepare('INSERT INTO meta VALUES (?, ?)'),
  species: db.prepare('INSERT INTO species VALUES (?, ?, ?)'),
  speciesName: db.prepare('INSERT OR IGNORE INTO species_name VALUES (?, ?, ?)'),
  speciesType: db.prepare('INSERT INTO species_type VALUES (?, ?, ?)'),
  series: db.prepare('INSERT INTO series VALUES (?, ?, ?)'),
  seriesName: db.prepare('INSERT OR IGNORE INTO series_name VALUES (?, ?, ?)'),
  set: db.prepare('INSERT INTO card_set VALUES (?, ?, ?, ?, ?, ?, ?)'),
  setName: db.prepare('INSERT INTO set_name VALUES (?, ?, ?, ?)'),
  card: db.prepare('INSERT INTO card VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  cardDex: db.prepare('INSERT OR IGNORE INTO card_dex VALUES (?, ?, ?)'),
  cardType: db.prepare('INSERT INTO card_type VALUES (?, ?, ?)'),
  cardLang: db.prepare('INSERT INTO card_lang VALUES (?, ?, ?, ?)'),
  variant: db.prepare('INSERT INTO card_variant VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
}

// ---------- Pokédex ----------
const speciesRows = await csv('pokemon_species')
const langByPokeapiId = new Map<string, string>()
for (const row of await csv('languages')) {
  const lang = POKEAPI_LANG_MAP[row.identifier!.toLowerCase()]
  if (lang) langByPokeapiId.set(row.id!, lang)
}
const typeById = new Map((await csv('types')).map((r) => [r.id!, r.identifier!]))
const defaultPokemonOfSpecies = new Map<string, string>()
for (const row of await csv('pokemon')) if (row.is_default === '1') defaultPokemonOfSpecies.set(row.species_id!, row.id!)
const typesOfPokemon = new Map<string, { slot: number; type: string }[]>()
for (const row of await csv('pokemon_types')) {
  const list = typesOfPokemon.get(row.pokemon_id!) ?? []
  list.push({ slot: Number(row.slot), type: typeById.get(row.type_id!)! })
  typesOfPokemon.set(row.pokemon_id!, list)
}

const enIndex: NameIndex = new Map()
const jaIndex: NameIndex = new Map()
const speciesEnName = new Map<number, string>()
const pendingPtFallback: [number, string][] = []
let maxDex = 0
for (const row of speciesRows) {
  const dex = Number(row.id)
  maxDex = Math.max(maxDex, dex)
  insert.species.run(dex, row.identifier!, Number(row.generation_id))
  for (const t of typesOfPokemon.get(defaultPokemonOfSpecies.get(row.id!)!) ?? []) insert.speciesType.run(dex, t.slot, t.type)
}
for (const row of await csv('pokemon_species_names')) {
  const lang = langByPokeapiId.get(row.local_language_id!)
  if (!lang || !row.name) continue
  const dex = Number(row.pokemon_species_id)
  insert.speciesName.run(dex, lang, row.name)
  if (lang === 'en') {
    // Nomes em português = inglês; serve de reserva se a PokéAPI não tiver o pt-BR (INSERT OR IGNORE)
    pendingPtFallback.push([dex, row.name])
    enIndex.set(normalizeName(row.name), dex)
    speciesEnName.set(dex, row.name)
  }
  if (lang === 'ja') jaIndex.set(normalizeName(row.name), dex)
}
for (const [dex, name] of pendingPtFallback) insert.speciesName.run(dex, 'pt', name)

/** "メガユキノオーex" → Mega Abomasnow; "メガヤンマex" → Yanmega (o nome inteiro já é uma espécie). */
function isJaMegaName(name: string): boolean {
  const whole = inferDexFromName(name, [jaIndex], true)
  const rest = inferDexFromName(name.replace(/^メガ/, ''), [jaIndex], true)
  return rest !== undefined && (whole === undefined || whole === rest)
}

// ---------- coleções e séries ----------
interface SetInfo {
  region: Region
  seriesId: string
  releaseDate: string | null
  official: number | null
  total: number | null
  symbol: string | null
  names: Map<Lang, { name: string; logo: string | null }>
}
const sets = new Map<string, SetInfo>()
const seriesNames = new Map<string, Map<Lang, string>>()
const seriesRegion = new Map<string, Region>()

for (const region of ['intl', 'ja'] as Region[]) {
  for (const lang of REGION_LANGS[region]) {
    for (const s of raw[lang].sets) {
      const setId = `${region}:${s.id}`
      if (EXCLUDED_SERIES.has(s.serie.id) || overrides.excludeSets.includes(setId)) {
        if (!diag.excludedSets.includes(setId)) diag.excludedSets.push(setId)
        continue
      }
      const seriesId = `${region}:${s.serie.id}`
      seriesRegion.set(seriesId, region)
      const sn = seriesNames.get(seriesId) ?? new Map()
      if (!sn.has(lang)) sn.set(lang, s.serie.name)
      seriesNames.set(seriesId, sn)

      const info = sets.get(setId) ?? {
        region,
        seriesId,
        releaseDate: s.releaseDate,
        official: s.cardCount.official,
        total: s.cardCount.total,
        symbol: s.symbol,
        names: new Map(),
      }
      info.releaseDate ??= s.releaseDate
      info.official ??= s.cardCount.official
      info.total ??= s.cardCount.total
      info.symbol ??= s.symbol
      info.names.set(lang, { name: s.name, logo: s.logo })
      sets.set(setId, info)
    }
  }
}

// Coleções sem nenhuma carta na fonte ficam fora do catálogo (o app não mostraria nada nelas).
// Entram sozinhas quando a TCGdex preencher as cartas.
const setsWithCards = new Set<string>()
for (const region of ['intl', 'ja'] as Region[]) {
  for (const lang of REGION_LANGS[region]) for (const c of raw[lang].cards) setsWithCards.add(`${region}:${c.set.id}`)
}
for (const [id, info] of sets) {
  if (setsWithCards.has(id)) continue
  const names = [...info.names.values()]
  diag.emptySets.push({ id, name: names[0]?.name ?? id, total: info.total ?? 0 })
  sets.delete(id)
}

const seriesFirstDate = new Map<string, string>()
for (const info of sets.values()) {
  const d = info.releaseDate ?? '9999'
  if (!seriesFirstDate.has(info.seriesId) || d < seriesFirstDate.get(info.seriesId)!) seriesFirstDate.set(info.seriesId, d)
}
const seriesOrdered = [...seriesFirstDate.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
seriesOrdered.forEach(([id], i) => {
  insert.series.run(id, seriesRegion.get(id)!, i)
  for (const [lang, name] of seriesNames.get(id)!) insert.seriesName.run(id, lang, name)
})
for (const [id, info] of sets) {
  insert.set.run(id, info.region, info.seriesId, info.releaseDate, info.official, info.total, info.symbol)
  for (const [lang, n] of info.names) insert.setName.run(id, lang, n.name, n.logo)
}

// ---------- cartas ----------
const rarityByCode = new Map(RARITIES.map((r) => [r.code, r]))
const knownCardIds = new Set<string>()
const counts = { cards: 0, variants: 0, cardLangs: 0 }

for (const region of ['intl', 'ja'] as Region[]) {
  const merged = new Map<string, { base: RawCard; perLang: Map<Lang, RawCard> }>()
  for (const lang of REGION_LANGS[region]) {
    for (const card of raw[lang].cards) {
      if (!sets.has(`${region}:${card.set.id}`)) continue
      const entry = merged.get(card.id)
      if (entry) entry.perLang.set(lang, card)
      else {
        if (lang !== REGION_LANGS[region][0]) diag.baseFromSecondaryLang++
        merged.set(card.id, { base: card, perLang: new Map([[lang, card]]) })
      }
    }
  }

  for (const [tcgdexId, { base, perLang }] of merged) {
    const id = `${region}:${tcgdexId}`
    knownCardIds.add(id)

    const category = normalizeCategory(base.category)
    if (!category) bump(diag.unmappedCategory, base.category)

    let rarity: Rarity | undefined
    if (overrides.rarity[id]) {
      rarity = rarityByCode.get(overrides.rarity[id]!)
      diag.overrides.applied++
    } else {
      rarity = normalizeRarity(base.rarity)
      if (!rarity) bump(diag.unmappedRarity, base.rarity!)
    }
    rarity ??= { ...UNKNOWN_RARITY, code: slugCode(base.rarity ?? 'unknown') }

    let stage = normalizeStage(base.stage)
    if (stage === undefined) {
      bump(diag.unmappedStage, base.stage!)
      stage = slugCode(base.stage!)
    }

    const mechanic = detectMechanic(base.suffix, stage, base.name)
    let form = detectForm(base.name, stage, isJaMegaName)
    if (overrides.form[id]) {
      form = overrides.form[id]!
      diag.overrides.applied++
    }

    // Número(s) da Pokédex
    let dexList: number[] = []
    let dexSource: string | null = null
    if (overrides.dex[id]) {
      dexList = overrides.dex[id]!
      dexSource = 'override'
      diag.overrides.applied++
    } else if (base.dexId?.some((d) => d !== null)) {
      const rawDex = base.dexId.filter((d): d is number => d !== null)
      if (rawDex.some((d) => !Number.isInteger(d))) diag.fractionalDex.push({ id, name: base.name, raw: rawDex })
      dexList = [...new Set(rawDex.map(Math.floor))]
      dexSource = 'tcgdex'
    } else if (category === 'pokemon') {
      const indexes = region === 'ja' ? [jaIndex, enIndex] : [enIndex]
      let inferred: number | undefined
      for (const c of perLang.values()) {
        inferred = inferDexFromName(c.name, indexes)
        if (inferred !== undefined) break
      }
      if (inferred !== undefined) {
        dexList = [inferred]
        dexSource = 'inferred'
        diag.inferredDex.push({ id, name: base.name, dex: inferred, species: speciesEnName.get(inferred) ?? '?' })
      } else {
        diag.missingDex.push({ id, name: base.name })
      }
    }
    for (const dex of dexList) {
      if (dex < 1 || dex > maxDex) diag.outOfRangeDex.push({ id, name: base.name, dex })
    }

    // Conferência: número da TCGdex x número deduzido do nome
    if (dexSource === 'tcgdex' && category === 'pokemon' && dexList.length === 1) {
      const enName = perLang.get('en')?.name
      if (region === 'intl' && enName) {
        // Em inglês o nome é confiável: divergência costuma ser erro da TCGdex
        const byName = inferDexFromName(enName, [enIndex])
        if (byName !== undefined && byName !== dexList[0]) {
          diag.dexMismatch.push({ id, name: enName, tcgdex: dexList[0]!, byName })
        }
      } else if (region === 'ja') {
        const byName = inferDexFromName(base.name, [jaIndex], true)
        if (byName === undefined) {
          // Nome que não é de nenhuma espécie: tradução literal do inglês na TCGdex ("カリザード")
          diag.jaNamesNotMatching.push({ id, name: base.name, dex: dexList[0]! })
        } else if (byName !== dexList[0]) {
          // Nome japonês correto, número diferente: provável erro de número na TCGdex
          diag.dexMismatch.push({ id, name: base.name, tcgdex: dexList[0]!, byName })
        }
      }
    }

    const sortMatch = /^\d+/.exec(base.localId)
    insert.card.run(
      id,
      region,
      `${region}:${base.set.id}`,
      base.localId,
      sortMatch ? Number(sortMatch[0]) : null,
      category ?? slugCode(base.category),
      rarity.code,
      rarity.rank,
      stage,
      mechanic,
      form,
      base.trainerType ? slugCode(base.trainerType) : null,
      base.energyType ? slugCode(base.energyType) : null,
      base.hp,
      base.illustrator,
      base.regulationMark,
      dexList[0] ?? null,
      dexSource,
    )
    dexList.forEach((dex, i) => insert.cardDex.run(id, dex, i))

    let slot = 0
    for (const t of base.types ?? []) {
      const type = normalizeTcgType(t)
      if (!type) bump(diag.unmappedType, t)
      insert.cardType.run(id, slot++, type ?? slugCode(t))
    }

    for (const [lang, c] of perLang) {
      insert.cardLang.run(id, lang, c.name, c.image)
      counts.cardLangs++
    }

    for (const v of buildVariants(id, base)) {
      insert.variant.run(v.id, id, v.finish, v.foil, v.subtype, v.size, JSON.stringify(v.stamps), v.sortOrder)
      counts.variants++
    }
    counts.cards++
  }
}

for (const key of [...Object.keys(overrides.dex), ...Object.keys(overrides.rarity), ...Object.keys(overrides.form)]) {
  if (!knownCardIds.has(key)) diag.overrides.unknownIds.push(key)
}

// ---------- metadados ----------
const builtAt = new Date().toISOString()
// Calculado antes de gravar o meta, que fica de fora (lib/contentHash.ts)
const dataHash = contentHash(db)
const metaRows: Record<string, string> = {
  schema_version: String(SCHEMA_VERSION),
  built_at: builtAt,
  fetched_at: fetchManifest.fetchedAt,
  content_hash: dataHash,
  sources: 'TCGdex (api.tcgdex.net) + PokéAPI (github.com/PokeAPI/pokeapi)',
  langs: JSON.stringify(REGION_LANGS),
  max_dex: String(maxDex),
  counts: JSON.stringify({ sets: sets.size, ...counts }),
  image_suffixes: JSON.stringify({ grid: '/low.webp', detail: '/high.webp' }),
}
for (const [k, v] of Object.entries(metaRows)) insert.meta.run(k, v)

db.exec('COMMIT')
db.exec('ANALYZE; VACUUM;')
db.close()
await rename(tmpPath, dbPath)

const toObj = (m: Map<string, number>) => Object.fromEntries([...m].sort((a, b) => b[1] - a[1]))
await writeFileAtomic(
  resolve(PATHS.dist, 'build-diagnostics.json'),
  JSON.stringify(
    {
      builtAt,
      maxDex,
      ...diag,
      unmappedRarity: toObj(diag.unmappedRarity),
      unmappedType: toObj(diag.unmappedType),
      unmappedCategory: toObj(diag.unmappedCategory),
      unmappedStage: toObj(diag.unmappedStage),
    },
    null,
    2,
  ),
)

console.log(
  `catalog.db: ${sets.size} coleções, ${counts.cards} cartas, ${counts.variants} variantes, ${counts.cardLangs} cartas×idioma` +
    ` (conteúdo ${dataHash.slice(0, 12)})`,
)
console.log(
  `Pokédex: ${diag.inferredDex.length} inferidas pelo nome, ${diag.missingDex.length} sem número, ` +
    `${diag.fractionalDex.length} fracionadas, ${diag.outOfRangeDex.length} fora da faixa 1–${maxDex}`,
)
const unmapped = [diag.unmappedRarity, diag.unmappedType, diag.unmappedCategory, diag.unmappedStage].reduce((n, m) => n + m.size, 0)
console.log(`Valores sem normalização: ${unmapped} (ver dist/build-diagnostics.json)`)
