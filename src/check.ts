/**
 * Etapa 4: confere o catálogo recém-montado contra o último publicado, antes de publicar.
 *
 *   npm run check                                → dist/catalog.db × dist/published.db
 *   node src/check.ts --previous outro.db        → contra outro arquivo
 *   node src/check.ts --allow-removals           → aceita coleções/cartas removidas de propósito
 *
 * Saídas:
 *   - reports/mudancas.md: o que mudou (coleções e cartas novas, IDs removidos…) e se pode publicar.
 *     Não é regravado quando nada mudou.
 *   - dist/check-result.json: o mesmo resultado para o empacotamento e o workflow.
 *   - código de saída 1 quando NÃO pode publicar.
 *
 * Por que barrar: a coleção de cada usuário aponta para os IDs das variantes. Um catálogo com cartas
 * a menos (TCGdex fora do ar, idioma que veio pela metade, IDs trocados) faria cartas sumirem dos
 * binders. Os limites estão em LIMITS.
 */
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { LANGS, PATHS } from './config.ts'
import { contentHash } from './lib/contentHash.ts'
import { readJson, writeFileAtomic } from './lib/files.ts'

/**
 * Limites da conferência. Acima deles, o catálogo não é publicado.
 * Idiomas e imagens são contados só nas cartas que continuam no catálogo: as que sumiram já
 * caem na regra de IDs removidos (que também cobre uma queda grande no total de cartas).
 */
const LIMITS = {
  /** Cartas que continuam mas perderam um idioma, em % das cartas daquele idioma: idioma que veio pela metade. */
  langDropPct: 0.5,
  /** Cartas que continuam mas perderam a imagem, em % das que tinham imagem naquele idioma. */
  imageDropPct: 1,
  /** Cartas ou variantes que sumiram. Até este número publica, com a lista no relatório. */
  removedIds: 20,
  /** Divergências novas entre o número da Pokédex da TCGdex e o nome da carta. */
  newDexMismatches: 20,
}

const { values: args } = parseArgs({
  options: {
    current: { type: 'string', default: resolve(PATHS.dist, 'catalog.db') },
    previous: { type: 'string', default: resolve(PATHS.dist, 'published.db') },
    diagnostics: { type: 'string', default: resolve(PATHS.dist, 'build-diagnostics.json') },
    report: { type: 'string', default: resolve(PATHS.reports, 'mudancas.md') },
    result: { type: 'string', default: resolve(PATHS.dist, 'check-result.json') },
    'allow-removals': { type: 'boolean', default: false },
    'allow-schema-change': { type: 'boolean', default: false },
  },
})

// ---------- leitura ----------
interface SetInfo {
  id: string
  region: string
  name: string
  namePt: string | null
  release: string | null
  cards: number
}
interface CardInfo {
  id: string
  setId: string
  name: string
  rarity: string
  dex: string
}
interface Snapshot {
  meta: Record<string, string>
  hash: string
  sets: Map<string, SetInfo>
  cards: Map<string, CardInfo>
  /** variante → carta */
  variants: Map<string, string>
  /** "carta|idioma" → tem imagem */
  cardLangs: Map<string, boolean>
  species: number
}

type Row = Record<string, any>

function load(path: string): Snapshot {
  const db = new DatabaseSync(path, { readOnly: true })
  const all = (sql: string) => db.prepare(sql).all() as Row[]
  const meta = Object.fromEntries(all('SELECT key, value FROM meta').map((r) => [r.key, r.value]))

  const sets = new Map<string, SetInfo>()
  for (const r of all(
    `SELECT cs.id, cs.region, cs.release_date,
            coalesce((SELECT name FROM set_name WHERE set_id = cs.id AND lang = CASE cs.region WHEN 'ja' THEN 'ja' ELSE 'en' END),
                     (SELECT name FROM set_name WHERE set_id = cs.id), cs.id) AS name,
            (SELECT name FROM set_name WHERE set_id = cs.id AND lang = 'pt') AS name_pt,
            (SELECT count(*) FROM card WHERE set_id = cs.id) AS cards
     FROM card_set cs`,
  )) {
    sets.set(r.id, { id: r.id, region: r.region, name: r.name, namePt: r.name_pt, release: r.release_date, cards: r.cards })
  }

  const names = new Map<string, Map<string, string>>()
  const cardLangs = new Map<string, boolean>()
  for (const r of all('SELECT card_id, lang, name, image_url IS NOT NULL AS img FROM card_lang')) {
    const m = names.get(r.card_id) ?? new Map<string, string>()
    m.set(r.lang, r.name)
    names.set(r.card_id, m)
    cardLangs.set(`${r.card_id}|${r.lang}`, r.img === 1)
  }
  const dex = new Map<string, number[]>()
  for (const r of all('SELECT card_id, dex_number FROM card_dex ORDER BY card_id, position')) {
    const list = dex.get(r.card_id) ?? []
    list.push(r.dex_number)
    dex.set(r.card_id, list)
  }
  const cards = new Map<string, CardInfo>()
  for (const r of all('SELECT id, set_id, rarity FROM card')) {
    const n = names.get(r.id)
    cards.set(r.id, {
      id: r.id,
      setId: r.set_id,
      name: n?.get('en') ?? n?.get('pt') ?? n?.get('ja') ?? '?',
      rarity: r.rarity,
      dex: (dex.get(r.id) ?? []).join('+'),
    })
  }
  const variants = new Map(all('SELECT id, card_id FROM card_variant').map((r) => [r.id as string, r.card_id as string]))
  const species = Number(all('SELECT count(*) AS n FROM species')[0]?.n ?? 0)
  const hash = contentHash(db)
  db.close()
  return { meta, hash, sets, cards, variants, cardLangs, species }
}

const langStats = (s: Snapshot) => {
  const stats = new Map<string, { cards: number; images: number }>()
  for (const [key, img] of s.cardLangs) {
    const lang = key.slice(key.lastIndexOf('|') + 1)
    const st = stats.get(lang) ?? { cards: 0, images: 0 }
    st.cards++
    if (img) st.images++
    stats.set(lang, st)
  }
  return stats
}

const currentPath = resolve(args.current!)
const previousPath = resolve(args.previous!)
if (!existsSync(currentPath)) throw new Error(`Catálogo não encontrado: ${currentPath} (rode npm run build)`)
const cur = load(currentPath)
const prev = existsSync(previousPath) ? load(previousPath) : null

// ---------- comparação ----------
const problems: string[] = []
const warnings: string[] = []
const n = (x: number) => x.toLocaleString('pt-BR')
const signed = (x: number) => (x > 0 ? `+${n(x)}` : x < 0 ? `−${n(-x)}` : '0')
const pct = (x: number) => `${x.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const share = (part: number, total: number) => (total > 0 ? (100 * part) / total : 0)
const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1)
const langOf = (key: string) => key.slice(key.lastIndexOf('|') + 1)
const cardOf = (key: string) => key.slice(0, key.lastIndexOf('|'))
const fmtDate = (iso: string | undefined) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '?')
const setLabel = (s: SetInfo) => {
  const code = s.id.slice(s.id.indexOf(':') + 1)
  const pt = s.namePt && s.namePt !== s.name ? ` / ${s.namePt}` : ''
  return `${s.name}${pt} (\`${code}\`${s.region === 'ja' ? ', japonês' : ''})`
}

if (cur.meta.content_hash && cur.meta.content_hash !== cur.hash) {
  warnings.push('O `content_hash` gravado no catálogo não confere com os dados. Monte de novo com `npm run build`.')
}

const curLangs = langStats(cur)
for (const lang of LANGS) {
  if (!curLangs.get(lang)?.cards) problems.push(`Nenhuma carta em **${lang}**: o download desse idioma falhou?`)
}
if (!cur.species) problems.push('A Pokédex veio vazia (PokéAPI).')

type Status = 'unchanged' | 'changed' | 'first' | 'failed'
let status: Status
const diff = {
  addedSets: [] as SetInfo[],
  removedSets: [] as SetInfo[],
  grownSets: [] as { set: SetInfo; before: number }[],
  shrunkSets: [] as { set: SetInfo; before: number }[],
  addedCards: [] as CardInfo[],
  removedCards: [] as CardInfo[],
  removedVariants: [] as string[],
  dexChanged: [] as { card: CardInfo; before: string }[],
  rarityChanged: [] as { card: CardInfo; before: string }[],
  imagesGained: new Map<string, number>(),
  imagesLost: new Map<string, number>(),
  /** Cartas que continuam e ganharam/perderam um idioma (ex.: tradução PT que chegou). */
  langsGained: new Map<string, number>(),
  langsLost: new Map<string, number>(),
  newDexMismatches: [] as { id: string; name: string; tcgdex: number; byName: number }[],
}

if (!prev) {
  status = 'first'
  warnings.push(`Sem catálogo anterior para comparar (${relative(PATHS.root, previousPath)} não existe): primeira publicação.`)
} else {
  if (prev.meta.schema_version !== cur.meta.schema_version) {
    const msg = `O esquema mudou: versão ${prev.meta.schema_version} → ${cur.meta.schema_version}. Apps instalados podem não saber ler o catálogo novo.`
    if (args['allow-schema-change']) warnings.push(`${msg} Aceito com --allow-schema-change.`)
    else problems.push(`${msg} Se o app já estiver preparado, rode com --allow-schema-change.`)
  }

  for (const [id, s] of cur.sets) {
    const before = prev.sets.get(id)
    if (!before) diff.addedSets.push(s)
    else if (s.cards > before.cards) diff.grownSets.push({ set: s, before: before.cards })
    else if (s.cards < before.cards) diff.shrunkSets.push({ set: s, before: before.cards })
  }
  for (const [id, s] of prev.sets) if (!cur.sets.has(id)) diff.removedSets.push(s)

  for (const [id, c] of cur.cards) {
    const before = prev.cards.get(id)
    if (!before) {
      diff.addedCards.push(c)
      continue
    }
    if (before.dex !== c.dex) diff.dexChanged.push({ card: c, before: before.dex })
    if (before.rarity !== c.rarity) diff.rarityChanged.push({ card: c, before: before.rarity })
  }
  for (const [id, c] of prev.cards) if (!cur.cards.has(id)) diff.removedCards.push(c)
  for (const id of prev.variants.keys()) if (!cur.variants.has(id)) diff.removedVariants.push(id)

  // Idiomas e imagens das cartas que continuam
  for (const [key, img] of cur.cardLangs) {
    const before = prev.cardLangs.get(key)
    if (before === undefined) {
      if (prev.cards.has(cardOf(key))) bump(diff.langsGained, langOf(key))
    } else if (before !== img) bump(img ? diff.imagesGained : diff.imagesLost, langOf(key))
  }
  for (const key of prev.cardLangs.keys()) {
    if (cur.cards.has(cardOf(key)) && !cur.cardLangs.has(key)) bump(diff.langsLost, langOf(key))
  }

  // Limites
  for (const [lang, before] of langStats(prev)) {
    if (!curLangs.get(lang)?.cards) continue // idioma inteiro faltando: já apontado acima
    const lost = diff.langsLost.get(lang) ?? 0
    if (share(lost, before.cards) > LIMITS.langDropPct) {
      problems.push(
        `${n(lost)} cartas que continuam no catálogo perderam o idioma **${lang}** (${pct(share(lost, before.cards))} das ${n(before.cards)}); ` +
          `o limite é ${pct(LIMITS.langDropPct)}. O download desse idioma veio pela metade?`,
      )
    }
    const lostImg = diff.imagesLost.get(lang) ?? 0
    if (share(lostImg, before.images) > LIMITS.imageDropPct) {
      problems.push(
        `${n(lostImg)} cartas em **${lang}** perderam a imagem (${pct(share(lostImg, before.images))} das ${n(before.images)} que tinham); ` +
          `o limite é ${pct(LIMITS.imageDropPct)}.`,
      )
    }
  }
  if (cur.species < prev.species) problems.push(`A Pokédex diminuiu: ${prev.species} → ${cur.species} espécies.`)

  const removalNote = 'Se a remoção for proposital (ex.: coleção excluída no `overrides.json`), rode com --allow-removals.'
  if (diff.removedSets.length) {
    const msg = `${diff.removedSets.length === 1 ? 'Uma coleção sumiu' : `${diff.removedSets.length} coleções sumiram`}: ${diff.removedSets.map(setLabel).join(', ')}.`
    if (args['allow-removals']) warnings.push(`${msg} Aceito com --allow-removals.`)
    else problems.push(`${msg} ${removalNote}`)
  }
  const removedIds = Math.max(diff.removedCards.length, diff.removedVariants.length)
  if (removedIds > LIMITS.removedIds && !args['allow-removals']) {
    problems.push(
      `Sumiram ${n(diff.removedCards.length)} cartas e ${n(diff.removedVariants.length)} variantes; o limite é ${LIMITS.removedIds}. ` +
        `Coleções de usuários que apontam para esses IDs perderiam as cartas. ${removalNote}`,
    )
  } else if (removedIds > 0) {
    warnings.push(
      `Sumiram ${n(diff.removedCards.length)} cartas e ${n(diff.removedVariants.length)} variantes (lista abaixo). ` +
        'Quem tiver essas cartas vai vê-las em "Cartas fora do catálogo".',
    )
  }

  // Divergências número × nome só das cartas novas ou que mudaram de número (as antigas já eram conhecidas)
  const diag = existsSync(args.diagnostics!) ? await readJson<{ builtAt: string; dexMismatch: typeof diff.newDexMismatches }>(args.diagnostics!) : null
  if (diag && diag.builtAt === cur.meta.built_at) {
    const touched = new Set([...diff.addedCards.map((c) => c.id), ...diff.dexChanged.map((d) => d.card.id)])
    diff.newDexMismatches = diag.dexMismatch.filter((m) => touched.has(m.id))
    if (diff.newDexMismatches.length > LIMITS.newDexMismatches) {
      problems.push(`${diff.newDexMismatches.length} divergências novas entre número da Pokédex e nome; o limite é ${LIMITS.newDexMismatches}. A normalização quebrou?`)
    } else if (diff.newDexMismatches.length) {
      warnings.push(`${diff.newDexMismatches.length} carta(s) nova(s) com número da Pokédex que não bate com o nome (lista abaixo). Corrija no \`overrides.json\`.`)
    }
  } else {
    warnings.push('Sem o diagnóstico desta montagem (`dist/build-diagnostics.json`): a conferência número × nome das cartas novas foi pulada.')
  }

  status = cur.hash === prev.hash && cur.meta.schema_version === prev.meta.schema_version ? 'unchanged' : 'changed'
}
if (problems.length) status = 'failed'
const ok = status !== 'failed'

// ---------- relatório ----------
const table = (headers: string[], rows: (string | number)[][]) =>
  [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
const LIST_MAX = 100
const more = (total: number) => (total > LIST_MAX ? `\n\n… e mais ${n(total - LIST_MAX)}.` : '')
const setName = (s: Snapshot, setId: string) => {
  const set = s.sets.get(setId)
  return set ? setLabel(set) : setId
}
const STATUS_TEXT: Record<Status, string> = {
  unchanged: 'sem mudanças, nada a publicar',
  changed: '**pode publicar**',
  first: '**pode publicar** (primeira publicação)',
  failed: '**NÃO publicar**',
}

const out: string[] = ['# Mudanças no catálogo', '']
out.push(
  `Catálogo montado em ${fmtDate(cur.meta.built_at)} (dados baixados em ${fmtDate(cur.meta.fetched_at)}), ` +
    (prev ? `comparado com o publicado, montado em ${fmtDate(prev.meta.built_at)}.` : 'sem catálogo anterior para comparar.'),
  '',
  `Resultado: ${STATUS_TEXT[status]}.`,
)
if (problems.length) out.push('', '## Problemas (impedem a publicação)', '', ...problems.map((p) => `- ${p}`))
if (warnings.length) out.push('', '## Avisos', '', ...warnings.map((w) => `- ${w}`))

out.push('', '## Resumo', '')
const imagesOf = (s: Snapshot | null, lang: string) => (s ? langStats(s).get(lang)?.images ?? 0 : 0)
const summaryRows: [string, number, number][] = [
  ['Coleções', prev?.sets.size ?? 0, cur.sets.size],
  ['Cartas', prev?.cards.size ?? 0, cur.cards.size],
  ['Variantes', prev?.variants.size ?? 0, cur.variants.size],
  ...LANGS.map((lang): [string, number, number] => [`Cartas com imagem (${lang})`, imagesOf(prev, lang), imagesOf(cur, lang)]),
  ['Espécies na Pokédex', prev?.species ?? 0, cur.species],
]
out.push(
  prev
    ? table(['', 'Publicado', 'Agora', 'Diferença'], summaryRows.map(([label, a, b]) => [label, n(a), n(b), signed(b - a)]))
    : table(['', 'Agora'], summaryRows.map(([label, , b]) => [label, n(b)])),
)

if (prev) {
  // Cartas com imagem em pelo menos um idioma, por coleção (as de pré-lançamento costumam vir sem)
  const cardsWithImage = new Set<string>()
  for (const [key, img] of cur.cardLangs) if (img) cardsWithImage.add(cardOf(key))
  const withImageOfSet = new Map<string, number>()
  for (const id of cardsWithImage) {
    const card = cur.cards.get(id)
    if (card) bump(withImageOfSet, card.setId)
  }
  if (diff.addedSets.length) {
    out.push(
      '',
      `## Coleções novas (${diff.addedSets.length})`,
      '',
      table(
        ['Coleção', 'Lançamento', 'Cartas', 'Com imagem'],
        diff.addedSets
          .sort((a, b) => (a.release ?? '').localeCompare(b.release ?? ''))
          .map((s) => [setLabel(s), s.release ?? '—', n(s.cards), n(withImageOfSet.get(s.id) ?? 0)]),
      ),
    )
  }
  if (diff.grownSets.length) {
    out.push(
      '',
      `## Coleções com cartas novas (${diff.grownSets.length})`,
      '',
      table(
        ['Coleção', 'Antes', 'Agora'],
        diff.grownSets.sort((a, b) => b.set.cards - b.before - (a.set.cards - a.before)).map((g) => [setLabel(g.set), n(g.before), `${n(g.set.cards)} (${signed(g.set.cards - g.before)})`]),
      ),
    )
  }
  if (diff.shrunkSets.length || diff.removedSets.length) {
    out.push(
      '',
      '## Coleções com menos cartas ou removidas',
      '',
      table(
        ['Coleção', 'Antes', 'Agora'],
        [
          ...diff.shrunkSets.map((g): (string | number)[] => [setLabel(g.set), n(g.before), `${n(g.set.cards)} (${signed(g.set.cards - g.before)})`]),
          ...diff.removedSets.map((s): (string | number)[] => [setLabel(s), n(s.cards), 'removida']),
        ],
      ),
    )
  }
  if (diff.removedCards.length) {
    out.push(
      '',
      `## Cartas que sumiram (${n(diff.removedCards.length)})`,
      '',
      'A coleção dos usuários aponta para estes IDs. Quem tiver alguma delas vai vê-la em "Cartas fora do catálogo".',
      '',
      table(
        ['Carta', 'Nome', 'Coleção'],
        diff.removedCards.slice(0, LIST_MAX).map((c) => [`\`${c.id}\``, c.name, setName(prev, c.setId)]),
      ) + more(diff.removedCards.length),
    )
  }
  const orphanVariants = diff.removedVariants.filter((v) => cur.cards.has(prev.variants.get(v) ?? ''))
  if (orphanVariants.length) {
    out.push(
      '',
      `## Variantes que sumiram de cartas que continuam (${n(orphanVariants.length)})`,
      '',
      orphanVariants.slice(0, LIST_MAX).map((v) => `\`${v}\``).join(', ') + more(orphanVariants.length),
    )
  }
  if (diff.newDexMismatches.length) {
    out.push(
      '',
      '## Cartas novas com número da Pokédex que não bate com o nome',
      '',
      table(['Carta', 'Nome', 'TCGdex', 'Pelo nome'], diff.newDexMismatches.map((m) => [`\`${m.id}\``, m.name, `#${m.tcgdex}`, `#${m.byName}`])),
    )
  }
  if (diff.dexChanged.length) {
    out.push(
      '',
      `## Número da Pokédex mudou (${n(diff.dexChanged.length)})`,
      '',
      table(
        ['Carta', 'Nome', 'Antes', 'Agora'],
        diff.dexChanged.slice(0, LIST_MAX).map((d) => [`\`${d.card.id}\``, d.card.name, d.before ? `#${d.before}` : '—', d.card.dex ? `#${d.card.dex}` : '—']),
      ) + more(diff.dexChanged.length),
    )
  }
  if (diff.rarityChanged.length) {
    out.push(
      '',
      `## Raridade mudou (${n(diff.rarityChanged.length)})`,
      '',
      table(
        ['Carta', 'Nome', 'Antes', 'Agora'],
        diff.rarityChanged.slice(0, LIST_MAX).map((d) => [`\`${d.card.id}\``, d.card.name, `\`${d.before}\``, `\`${d.card.rarity}\``]),
      ) + more(diff.rarityChanged.length),
    )
  }
  const perLang = (m: Map<string, number>) => [...m].map(([lang, k]) => `${lang} ${n(k)}`).join(', ') || '—'
  if (diff.imagesGained.size || diff.imagesLost.size || diff.langsGained.size || diff.langsLost.size) {
    out.push(
      '',
      '## Idiomas e imagens em cartas que já existiam',
      '',
      table(
        ['', 'Por idioma'],
        [
          ['Ganharam o idioma (tradução nova)', perLang(diff.langsGained)],
          ['Perderam o idioma', perLang(diff.langsLost)],
          ['Ganharam imagem', perLang(diff.imagesGained)],
          ['Perderam a imagem', perLang(diff.imagesLost)],
        ],
      ),
    )
  }
  if (diff.addedCards.length && !diff.addedSets.length && !diff.grownSets.length) {
    out.push('', `## Cartas novas (${n(diff.addedCards.length)})`, '', diff.addedCards.slice(0, LIST_MAX).map((c) => `\`${c.id}\` ${c.name}`).join(', ') + more(diff.addedCards.length))
  }
}

const result = {
  status,
  ok,
  checkedAt: new Date().toISOString(),
  contentHash: cur.hash,
  previousHash: prev?.hash ?? null,
  builtAt: cur.meta.built_at,
  previousBuiltAt: prev?.meta.built_at ?? null,
  problems,
  warnings,
  summary: {
    sets: cur.sets.size,
    cards: cur.cards.size,
    variants: cur.variants.size,
    addedSets: diff.addedSets.map((s) => s.id),
    addedCards: diff.addedCards.length,
    removedSets: diff.removedSets.map((s) => s.id),
    removedCards: diff.removedCards.length,
    removedVariants: diff.removedVariants.length,
  },
}
await writeFileAtomic(resolve(args.result!), JSON.stringify(result, null, 2) + '\n')
const reportPath = resolve(args.report!)
if (status !== 'unchanged') await writeFileAtomic(reportPath, out.join('\n') + '\n')

// ---------- console ----------
console.log(`Conferência do catálogo: ${STATUS_TEXT[status].replace(/\*\*/g, '')}`)
if (prev) {
  console.log(
    `  coleções ${n(prev.sets.size)} → ${n(cur.sets.size)} (${signed(cur.sets.size - prev.sets.size)}), ` +
      `cartas ${n(prev.cards.size)} → ${n(cur.cards.size)} (+${n(diff.addedCards.length)} −${n(diff.removedCards.length)}), ` +
      `variantes ${n(prev.variants.size)} → ${n(cur.variants.size)}`,
  )
  if (diff.addedSets.length) console.log(`  coleções novas: ${diff.addedSets.map((s) => s.id).join(', ')}`)
}
for (const p of problems) console.log(`  PROBLEMA: ${p.replace(/\*\*|`/g, '')}`)
for (const w of warnings) console.log(`  aviso: ${w.replace(/\*\*|`/g, '')}`)
if (status !== 'unchanged') console.log(`  relatório: ${relative(process.cwd(), reportPath)}`)
if (!ok) process.exitCode = 1
