/**
 * Baixa o último catálogo publicado (GitHub Pages) para dist/published.db, a base da conferência
 * (npm run check). Assim a conferência compara com o que os apps estão recebendo de fato.
 *
 *   npm run fetch-published                                  → site padrão (config.ts)
 *   node src/fetchPublished.ts --url <site> --keep-gz <pasta>
 *
 * Sem nada publicado (manifest com 404): apaga dist/published.db, e a conferência trata como
 * primeira publicação. `--keep-gz` guarda o .gz baixado para ele continuar no site ao lado do novo:
 * um app que leu o manifest anterior ainda consegue baixar o arquivo.
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseArgs } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { PATHS, PUBLISHED_SITE_URL } from './config.ts'
import { contentHash } from './lib/contentHash.ts'

const { values: args } = parseArgs({
  options: { url: { type: 'string', default: PUBLISHED_SITE_URL }, 'keep-gz': { type: 'string' } },
})
const base = args.url.endsWith('/') ? args.url : `${args.url}/`
const publishedPath = resolve(PATHS.dist, 'published.db')
const downloadPath = resolve(PATHS.dist, 'published.db.download')

/** GET com 3 tentativas (a CDN do GitHub Pages às vezes falha) e limite de 2 min. 404 volta sem erro. */
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      if (res.ok || res.status === 404 || attempt === 3) return res
      console.warn(`${url}: HTTP ${res.status}, tentando de novo`)
    } catch (e) {
      if (attempt === 3) throw e
      console.warn(`${url}: ${e instanceof Error ? e.message : String(e)}, tentando de novo`)
    }
    await new Promise((r) => setTimeout(r, attempt * 5000))
  }
}

// O parâmetro evita a cópia de até 10 min que a CDN guarda do manifest
const manifestRes = await get(`${base}manifest.json?t=${Date.now()}`)
if (manifestRes.status === 404) {
  await rm(publishedPath, { force: true })
  console.log(`Nada publicado ainda em ${base}: a conferência vai tratar como primeira publicação.`)
  process.exit(0)
}
if (!manifestRes.ok) throw new Error(`${base}manifest.json: HTTP ${manifestRes.status}`)
const manifest = (await manifestRes.json()) as { builtAt: string; contentHash: string; file: string; bytes: number; rawBytes: number }
if (!/^[\w.-]+$/.test(manifest.file)) throw new Error(`Nome de arquivo inesperado no manifest: ${manifest.file}`)

const fileRes = await get(`${base}${manifest.file}`)
if (!fileRes.ok) throw new Error(`${base}${manifest.file}: HTTP ${fileRes.status}`)
const body = new Uint8Array(await fileRes.arrayBuffer())
// Se o servidor entregar com Content-Encoding: gzip, o fetch já descompacta
const isGzip = body[0] === 0x1f && body[1] === 0x8b
if (isGzip && body.length !== manifest.bytes) throw new Error('O .gz publicado não tem o tamanho informado no manifest.')
const raw = isGzip ? gunzipSync(body) : body
if (raw.length !== manifest.rawBytes) throw new Error('O catálogo publicado não tem o tamanho informado no manifest.')

await mkdir(PATHS.dist, { recursive: true })
await writeFile(downloadPath, raw)
const db = new DatabaseSync(downloadPath, { readOnly: true })
const computed = contentHash(db)
db.close()
if (computed !== manifest.contentHash) {
  await rm(downloadPath, { force: true })
  throw new Error('O catálogo publicado não confere com a impressão digital do manifest.')
}
await rename(downloadPath, publishedPath)

if (args['keep-gz'] && isGzip) {
  await mkdir(args['keep-gz'], { recursive: true })
  await writeFile(resolve(args['keep-gz'], manifest.file), body)
}
console.log(`Último publicado: ${manifest.builtAt} (${computed.slice(0, 12)}) → dist/published.db`)
