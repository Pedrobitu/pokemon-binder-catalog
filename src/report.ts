/**
 * Etapa 3: gera reports/cobertura.md a partir de dist/catalog.db e dist/build-diagnostics.json.
 */
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { PATHS } from './config.ts'
import { readJson, writeFileAtomic } from './lib/files.ts'
import { TCG_TYPES } from './normalize/fields.ts'
import { RARITIES } from './normalize/rarity.ts'

const dbPath = resolve(PATHS.dist, 'catalog.db')
const db = new DatabaseSync(dbPath, { readOnly: true })
const diag = await readJson<any>(resolve(PATHS.dist, 'build-diagnostics.json'))

type Row = Record<string, any>
const all = (sql: string, ...params: any[]) => db.prepare(sql).all(...params) as Row[]
const one = (sql: string, ...params: any[]) => db.prepare(sql).get(...params) as Row
const meta = Object.fromEntries(all('SELECT key, value FROM meta').map((r) => [r.key, r.value]))
const n = (x: number) => x.toLocaleString('pt-BR')
const pct = (part: number, total: number) => (total ? `${((100 * part) / total).toFixed(1)}%` : '—')
const table = (headers: string[], rows: (string | number)[][]) =>
  [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
const REGIONS = [
  ['intl', 'Internacional (EN/PT)'],
  ['ja', 'Japonês'],
] as const
const speciesName = (dex: number) => one("SELECT name FROM species_name WHERE dex_number = ? AND lang = 'en'", dex)?.name ?? '?'

const out: string[] = []
const h = (title: string) => out.push('', `## ${title}`, '')

const dbSize = (await stat(dbPath)).size
out.push(
  '# Relatório de cobertura do catálogo',
  '',
  `Gerado em ${meta.built_at} · dados baixados em ${meta.fetched_at} · \`catalog.db\` com ${(dbSize / 1024 / 1024).toFixed(1)} MB`,
  '',
  `Fontes: ${meta.sources}. Séries excluídas: ${diag.excludedSets.length} coleções do TCG Pocket (digital).`,
)

// ---------- resumo ----------
h('Resumo')
out.push(
  table(
    ['Região', 'Coleções', 'Cartas', 'Pokémon', 'Treinador', 'Energia', 'Variantes'],
    REGIONS.map(([region, label]) => {
      const c = one(
        `SELECT count(*) total, sum(category='pokemon') p, sum(category='trainer') t, sum(category='energy') e
         FROM card WHERE region = ?`,
        region,
      )
      const sets = one('SELECT count(*) n FROM card_set WHERE region = ?', region).n
      const variants = one('SELECT count(*) n FROM card_variant v JOIN card c ON c.id = v.card_id WHERE c.region = ?', region).n
      return [label, n(sets), n(c.total), n(c.p), n(c.t), n(c.e), n(variants)]
    }),
  ),
  '',
  table(
    ['Idioma', 'Cartas', 'Com imagem', '%'],
    ['en', 'pt', 'ja'].map((lang) => {
      const r = one('SELECT count(*) total, count(image_url) img FROM card_lang WHERE lang = ?', lang)
      return [lang, n(r.total), n(r.img), pct(r.img, r.total)]
    }),
  ),
)

// ---------- Pokédex ----------
h('Pokédex')
const maxDex = Number(meta.max_dex)
const covered = (region: string) =>
  one('SELECT count(DISTINCT d.dex_number) n FROM card_dex d JOIN card c ON c.id = d.card_id WHERE c.region = ?', region).n
out.push(
  `Espécies na PokéAPI: **${maxDex}**. Espécies com pelo menos uma carta: ` +
    `internacional **${covered('intl')}/${maxDex}**, japonês **${covered('ja')}/${maxDex}**.`,
  '',
  table(
    ['Origem do número', 'Internacional', 'Japonês'],
    [
      ['TCGdex', 'tcgdex'],
      ['Inferido pelo nome', 'inferred'],
      ['Correção manual (overrides.json)', 'override'],
    ]
      .map(([label, src]) => [
        label!,
        n(one("SELECT count(*) n FROM card WHERE region='intl' AND dex_source = ?", src).n),
        n(one("SELECT count(*) n FROM card WHERE region='ja' AND dex_source = ?", src).n),
      ])
      .concat([
        [
          'Pokémon sem número',
          n(one("SELECT count(*) n FROM card WHERE region='intl' AND category='pokemon' AND primary_dex IS NULL").n),
          n(one("SELECT count(*) n FROM card WHERE region='ja' AND category='pokemon' AND primary_dex IS NULL").n),
        ],
        [
          'Cartas com mais de um Pokémon',
          n(one("SELECT count(*) n FROM (SELECT card_id FROM card_dex d JOIN card c ON c.id=d.card_id WHERE c.region='intl' GROUP BY card_id HAVING count(*) > 1)").n),
          n(one("SELECT count(*) n FROM (SELECT card_id FROM card_dex d JOIN card c ON c.id=d.card_id WHERE c.region='ja' GROUP BY card_id HAVING count(*) > 1)").n),
        ],
      ]),
  ),
)

for (const [region, label] of REGIONS) {
  const missing = all(
    `SELECT s.dex_number FROM species s
     WHERE NOT EXISTS (SELECT 1 FROM card_dex d JOIN card c ON c.id = d.card_id WHERE d.dex_number = s.dex_number AND c.region = ?)
     ORDER BY s.dex_number`,
    region,
  ).map((r) => r.dex_number as number)
  out.push(
    '',
    `**Espécies sem nenhuma carta (${label}): ${missing.length}**`,
    missing.length ? missing.slice(0, 80).map((d) => `#${d} ${speciesName(d)}`).join(', ') + (missing.length > 80 ? ', …' : '') : '—',
  )
}

out.push(
  '',
  '### Cartas por geração',
  '',
  table(
    ['Geração', 'Espécies', 'Cartas intl', 'Cobertura intl', 'Cartas ja', 'Cobertura ja'],
    all('SELECT generation g, count(*) species FROM species GROUP BY generation ORDER BY generation').map((g) => {
      const stats = (region: string) =>
        one(
          `SELECT count(DISTINCT c.id) cards, count(DISTINCT d.dex_number) dex FROM card_dex d
           JOIN card c ON c.id = d.card_id JOIN species s ON s.dex_number = d.dex_number
           WHERE c.region = ? AND s.generation = ?`,
          region,
          g.g,
        )
      const i = stats('intl')
      const j = stats('ja')
      return [`Gen ${g.g}`, g.species, n(i.cards), pct(i.dex, g.species), n(j.cards), pct(j.dex, g.species)]
    }),
  ),
)

out.push(
  '',
  '### Conferência número x nome (inglês)',
  '',
  diag.dexMismatch.length
    ? 'Cartas em que o número da TCGdex não bate com o nome. Confira e corrija em `overrides.json`.\n\n' +
        table(
          ['Carta', 'Nome', 'TCGdex', 'Pelo nome'],
          diag.dexMismatch.map((m: any) => [m.id, m.name, `#${m.tcgdex} ${speciesName(m.tcgdex)}`, `#${m.byName} ${speciesName(m.byName)}`]),
        )
    : 'Nenhuma divergência (as correções de `overrides.json` já foram aplicadas).',
  '',
  `### Números inferidos pelo nome (${diag.inferredDex.length})`,
  '',
  'Cartas de Pokémon sem número na TCGdex, deduzido pelo nome. Amostra para conferência (lista completa em `dist/build-diagnostics.json`):',
  '',
  table(
    ['Carta', 'Nome', 'Espécie'],
    diag.inferredDex
      .filter((_: any, i: number, arr: any[]) => i % Math.max(1, Math.floor(arr.length / 30)) === 0)
      .slice(0, 30)
      .map((x: any) => [x.id, x.name, `#${x.dex} ${x.species}`]),
  ),
  '',
  `**Pokémon sem número mesmo após a inferência (${diag.missingDex.length}):** ` +
    (diag.missingDex.map((x: any) => `${x.id} (${x.name})`).join(', ') || '—'),
  '',
  `**Números fracionados na TCGdex (${diag.fractionalDex.length}):** ` +
    (diag.fractionalDex.map((x: any) => `${x.id} ${x.name} [${x.raw.join(', ')}]`).join(', ') || '—') +
    ' — arredondados para baixo.',
  '',
  `**Nomes japoneses que não batem com a Pokédex japonesa: ${n(diag.jaNamesNotMatching.length)}** ` +
    `de ${n(one("SELECT count(*) n FROM card WHERE region='ja' AND category='pokemon' AND dex_source='tcgdex'").n)} ` +
    'cartas de Pokémon japonesas. O número está certo, mas o nome exibido pode ser uma tradução literal do inglês ' +
    '(ex.: "カリザード" em vez de "リザードン"). Exemplos: ' +
    diag.jaNamesNotMatching
      .slice(0, 12)
      .map((x: any) => `${x.name} (#${x.dex} ${speciesName(x.dex)})`)
      .join(', '),
)

// ---------- coleções vazias / incompletas ----------
h('Coleções vazias ou incompletas na TCGdex')
const setCompleteness = all(
  `SELECT cs.id, cs.region, sn.name, cs.total_count total, count(c.id) cards
   FROM card_set cs
   JOIN set_name sn ON sn.set_id = cs.id AND sn.lang = CASE cs.region WHEN 'ja' THEN 'ja' ELSE 'en' END
   LEFT JOIN card c ON c.set_id = cs.id
   GROUP BY cs.id ORDER BY cs.region, cs.release_date`,
)
out.push(
  'Coleções que a TCGdex lista mas sem nenhuma carta ficam **fora** do catalog.db e entram sozinhas quando forem preenchidas.',
  '',
)
for (const [region, label] of REGIONS) {
  const rows = setCompleteness.filter((r) => r.region === region)
  const empty = (diag.emptySets as { id: string; name: string; total: number }[]).filter((s) => s.id.startsWith(`${region}:`))
  const partial = rows.filter((r) => r.cards > 0 && r.total && r.cards < r.total)
  const missingCards = empty.reduce((s, r) => s + r.total, 0) + partial.reduce((s, r) => s + (r.total - r.cards), 0)
  out.push(
    `**${label}:** ${rows.length} coleções no catálogo; ${empty.length} vazias (fora do catálogo) e ${partial.length} incompletas ` +
      `(cerca de ${n(missingCards)} cartas faltando pelo total informado das coleções).`,
    '',
  )
  if (empty.length) out.push(`Vazias: ${empty.map((r) => `${r.id.split(':')[1]} ${r.name} (${r.total})`).join(', ')}`, '')
  if (partial.length) {
    out.push(
      'Mais incompletas: ' +
        partial
          .sort((a, b) => b.total - b.cards - (a.total - a.cards))
          .slice(0, 15)
          .map((r) => `${r.id.split(':')[1]} ${r.name} ${r.cards}/${r.total}`)
          .join(', '),
      '',
    )
  }
}

// ---------- imagens ----------
h('Imagens por série')
out.push(
  'Porcentagem de cartas com imagem na TCGdex. A imagem é a base da URL; o app acrescenta `/low.webp` ou `/high.webp`.',
  '',
  table(
    ['Série', 'Região', 'Cartas', 'Imagem EN', 'Cartas PT', 'Imagem PT', 'Imagem JA'],
    all(
      `SELECT sr.id, sr.region, sn.name, count(DISTINCT c.id) cards,
              sum(l.lang='en' AND l.image_url IS NOT NULL) en_img,
              sum(l.lang='pt') pt_cards, sum(l.lang='pt' AND l.image_url IS NOT NULL) pt_img,
              sum(l.lang='ja' AND l.image_url IS NOT NULL) ja_img
       FROM series sr
       JOIN series_name sn ON sn.series_id = sr.id AND sn.lang = CASE sr.region WHEN 'ja' THEN 'ja' ELSE 'en' END
       JOIN card_set cs ON cs.series_id = sr.id
       JOIN card c ON c.set_id = cs.id
       JOIN card_lang l ON l.card_id = c.id
       GROUP BY sr.id ORDER BY sr.region, sr.sort_order`,
    ).map((r) => [
      r.name,
      r.region,
      n(r.cards),
      r.region === 'intl' ? pct(r.en_img, r.cards) : '—',
      r.region === 'intl' ? n(r.pt_cards) : '—',
      r.region === 'intl' ? pct(r.pt_img, r.pt_cards) : '—',
      r.region === 'ja' ? pct(r.ja_img, r.cards) : '—',
    ]),
  ),
)

// ---------- raridades ----------
h('Raridades')
const rarityCount = (region: string) =>
  new Map(all('SELECT rarity, count(*) n FROM card WHERE region = ? GROUP BY rarity', region).map((r) => [r.rarity, r.n]))
const ri = rarityCount('intl')
const rj = rarityCount('ja')
out.push(
  table(
    ['Código', 'Nome (PT)', 'Faixa', 'Intl', 'Ja'],
    [...RARITIES, { code: 'unknown', pt: 'Não informada', rank: 0 }]
      .filter((r) => ri.has(r.code) || rj.has(r.code))
      .sort((a, b) => a.rank - b.rank)
      .map((r) => [`\`${r.code}\``, r.pt, r.rank, n(ri.get(r.code) ?? 0), n(rj.get(r.code) ?? 0)]),
  ),
  '',
  `Valores brutos sem mapeamento: ${Object.keys(diag.unmappedRarity).length ? JSON.stringify(diag.unmappedRarity) : 'nenhum'}.`,
)

// ---------- acabamentos ----------
h('Acabamentos (variantes de impressão)')
const byRegion = (sql: string) => (region: string) => new Map(all(sql, region).map((r) => [r.k, r.n]))
const finish = byRegion(
  'SELECT v.finish k, count(*) n FROM card_variant v JOIN card c ON c.id = v.card_id WHERE c.region = ? GROUP BY 1',
)
const fi = finish('intl')
const fj = finish('ja')
out.push(
  table(
    ['Acabamento', 'Intl', 'Ja'],
    [...new Set([...fi.keys(), ...fj.keys()])].map((k) => [k, n(fi.get(k) ?? 0), n(fj.get(k) ?? 0)]),
  ),
)
const foil = all(
  'SELECT v.foil k, c.region, count(*) n FROM card_variant v JOIN card c ON c.id = v.card_id WHERE v.foil IS NOT NULL GROUP BY 1, 2 ORDER BY 3 DESC',
)
out.push('', `**Padrões de brilho (foil):** ${foil.map((r) => `${r.k} (${r.region}) ${n(r.n)}`).join(', ')}`)
const stamps = all(
  `SELECT j.value k, count(*) n FROM card_variant v, json_each(v.stamps) j GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
)
out.push('', `**Carimbos mais comuns:** ${stamps.map((r) => `${r.k} ${n(r.n)}`).join(', ')}`)
const subtypes = all('SELECT subtype k, count(*) n FROM card_variant WHERE subtype IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15')
out.push('', `**Subtipos:** ${subtypes.map((r) => `${r.k} ${n(r.n)}`).join(', ')}`)
out.push('', `**Jumbo:** ${n(one("SELECT count(*) n FROM card_variant WHERE size = 'jumbo'").n)}`)

// ---------- tipos, formas, mecânicas ----------
h('Tipos TCG, formas e mecânicas')
const typeCount = byRegion('SELECT t.type k, count(*) n FROM card_type t JOIN card c ON c.id = t.card_id WHERE c.region = ? GROUP BY 1')
const ti = typeCount('intl')
const tj = typeCount('ja')
out.push(
  table(
    ['Tipo', 'Intl', 'Ja'],
    Object.entries(TCG_TYPES).map(([code, names]) => [`${names.pt} (\`${code}\`)`, n(ti.get(code) ?? 0), n(tj.get(code) ?? 0)]),
  ),
)
const formCount = all("SELECT form k, region, count(*) n FROM card WHERE category='pokemon' GROUP BY 1, 2 ORDER BY 1, 2")
out.push('', `**Formas:** ${formCount.map((r) => `${r.k} (${r.region}) ${n(r.n)}`).join(', ')}`)
const mech = all("SELECT mechanic k, count(*) n FROM card WHERE mechanic IS NOT NULL GROUP BY 1 ORDER BY 2 DESC")
out.push('', `**Mecânicas:** ${mech.map((r) => `${r.k} ${n(r.n)}`).join(', ')}`)

// ---------- tamanho ----------
h('Tamanho do catálogo')
out.push(
  table(
    ['Tabela', 'Linhas'],
    ['species', 'species_name', 'series', 'card_set', 'card', 'card_dex', 'card_type', 'card_lang', 'card_variant'].map((t) => [
      t,
      n(one(`SELECT count(*) n FROM ${t}`).n),
    ]),
  ),
  '',
  `Arquivo: ${(dbSize / 1024 / 1024).toFixed(1)} MB.`,
)

await writeFileAtomic(resolve(PATHS.reports, 'cobertura.md'), out.join('\n') + '\n')
console.log(`Relatório gerado: reports/cobertura.md (${out.length} linhas)`)
