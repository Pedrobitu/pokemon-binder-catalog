/**
 * Etapa 1: baixa os dados brutos para catalog/raw/.
 *   - TCGdex: todas as coleções e cartas de cada idioma
 *   - PokéAPI: CSVs da Pokédex (espécies, nomes, tipos, formas)
 *
 * Cartas: uma consulta GraphQL em lote traz quase tudo. A TCGdex anula a carta inteira
 * quando um campo vem fora do esquema (raridade vazia, dexId "384.1"...). Essas cartas
 * são baixadas uma a uma pela API REST, que devolve o dado como está.
 */
import { resolve } from 'node:path'
import { LANGS, PATHS, POKEAPI_CSV_BASE, POKEAPI_CSV_FILES } from './config.ts'
import { writeFileAtomic } from './lib/files.ts'
import { fetchWithRetry, mapLimit, tcgdexQuery, tcgdexRestCard } from './lib/http.ts'
import { CARD_FIELDS, SET_FIELDS, pickRawCard, type RawCard, type RawSet } from './tcgdex-types.ts'

const manifest = {
  fetchedAt: new Date().toISOString(),
  tcgdex: {} as Record<string, { sets: number; cards: number; viaRest: string[] }>,
  pokeapi: {} as Record<string, number>,
}

for (const lang of LANGS) {
  const t0 = Date.now()
  const { sets } = await tcgdexQuery<{ sets: RawSet[] }>(`{ sets @locale(lang: "${lang}") { ${SET_FIELDS} } }`)

  const bulk = await tcgdexQuery<{ cards: (RawCard | null)[] }>(`{ cards @locale(lang: "${lang}") { ${CARD_FIELDS} } }`, {
    allowPartial: true,
  })
  const { cards: allIds } = await tcgdexQuery<{ cards: { id: string }[] }>(`{ cards @locale(lang: "${lang}") { id } }`)

  const byId = new Map<string, RawCard>()
  for (const card of bulk.data.cards) {
    // dexId fora do esquema (ex.: 384.1) volta como null dentro da lista: rebaixa pela REST
    if (card && !card.dexId?.some((d) => d === null)) byId.set(card.id, card)
  }
  const missing = allIds.map((c) => c.id).filter((id) => !byId.has(id))
  const recovered = await mapLimit(missing, 4, async (id) => pickRawCard(await tcgdexRestCard(lang, id)))
  for (const card of recovered) byId.set(card.id, card)

  // Mantém a ordem original da API
  const cards = allIds.map((c) => byId.get(c.id)!).filter(Boolean)

  await writeFileAtomic(resolve(PATHS.raw, 'tcgdex', lang, 'sets.json'), JSON.stringify(sets))
  await writeFileAtomic(resolve(PATHS.raw, 'tcgdex', lang, 'cards.json'), JSON.stringify(cards))
  manifest.tcgdex[lang] = { sets: sets.length, cards: cards.length, viaRest: missing }
  console.log(
    `TCGdex [${lang}]: ${sets.length} coleções, ${cards.length} cartas ` +
      `(${missing.length} via REST, ${bulk.errorCount} erros no lote) em ${Date.now() - t0} ms`,
  )
}

for (const name of POKEAPI_CSV_FILES) {
  const res = await fetchWithRetry(`${POKEAPI_CSV_BASE}${name}.csv`)
  const text = await res.text()
  await writeFileAtomic(resolve(PATHS.raw, 'pokeapi', `${name}.csv`), text)
  manifest.pokeapi[name] = text.length
  console.log(`PokéAPI: ${name}.csv (${(text.length / 1024).toFixed(0)} KB)`)
}

await writeFileAtomic(resolve(PATHS.raw, 'fetch-manifest.json'), JSON.stringify(manifest, null, 2))
console.log('Download concluído.')
