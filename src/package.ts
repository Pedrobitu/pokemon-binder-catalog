/**
 * Etapa 5: prepara a publicação do catálogo em dist/site/ (o conteúdo do GitHub Pages):
 *   - catalog-<hash>.db.gz: o catálogo inteiro compactado. O nome muda a cada versão, então
 *     nenhum cache mistura um manifest novo com um arquivo velho;
 *   - manifest.json: o que o app confere ao abrir (PLANEJAMENTO.md, seção 4.5).
 * Depois copia o catálogo para dist/published.db, a base da próxima conferência (npm run check).
 *
 * Só empacota um catálogo aprovado pela conferência (dist/check-result.json com o mesmo conteúdo).
 *   node src/package.ts --force   → pula essa exigência (testes)
 */
import { copyFile, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { constants, gunzipSync, gzipSync } from 'node:zlib'
import { PATHS } from './config.ts'
import { contentHash } from './lib/contentHash.ts'
import { readJson, writeFileAtomic } from './lib/files.ts'

const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } })

const dbPath = resolve(PATHS.dist, 'catalog.db')
const siteDir = resolve(PATHS.dist, 'site')
const publishedPath = resolve(PATHS.dist, 'published.db')
const resultPath = resolve(PATHS.dist, 'check-result.json')

const db = new DatabaseSync(dbPath, { readOnly: true })
const meta = Object.fromEntries(
  (db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[]).map((r) => [r.key, r.value]),
)
if (!meta.content_hash) throw new Error('O catalog.db não tem content_hash: monte de novo com `npm run build`.')
const computed = contentHash(db)
db.close()
if (computed !== meta.content_hash) throw new Error('O content_hash do catalog.db não confere com os dados: monte de novo com `npm run build`.')

const check = await readJson<{ status: string; ok: boolean; contentHash: string }>(resultPath).catch(() => null)
if (!args.force) {
  if (!check || check.contentHash !== computed) throw new Error('Rode `npm run check` antes: este catálogo ainda não foi conferido.')
  if (!check.ok) throw new Error('A conferência reprovou este catálogo (ver reports/mudancas.md). Nada foi empacotado.')
}

const raw = await readFile(dbPath)
const gz = gzipSync(raw, { level: constants.Z_BEST_COMPRESSION })
if (!gunzipSync(gz).equals(raw)) throw new Error('O arquivo compactado não volta igual ao original.')

const counts = JSON.parse(meta.counts ?? '{}') as { sets?: number; cards?: number; variants?: number }
const file = `catalog-${computed.slice(0, 12)}.db.gz`
const manifest = {
  schemaVersion: Number(meta.schema_version),
  builtAt: meta.built_at,
  fetchedAt: meta.fetched_at,
  contentHash: computed,
  file,
  bytes: gz.length,
  rawBytes: raw.length,
  counts: { sets: counts.sets, cards: counts.cards, variants: counts.variants },
}

await rm(siteDir, { recursive: true, force: true })
await writeFileAtomic(resolve(siteDir, file), gz)
await writeFileAtomic(resolve(siteDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await copyFile(dbPath, publishedPath)

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
console.log(`dist/site/: manifest.json + ${file} (${mb(gz.length)}; ${mb(raw.length)} sem compactar)`)
console.log('dist/published.db atualizado: é a base da próxima conferência.')
if (check?.status === 'unchanged') console.log('Aviso: este catálogo é igual ao já publicado.')
