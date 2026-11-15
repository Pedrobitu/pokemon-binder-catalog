/**
 * Serve dist/site/ (o que vai para o GitHub Pages) para testar o app sem publicar nada.
 *
 *   npm run serve                                  → http://127.0.0.1:8091/manifest.json
 *   node src/serve.ts --dir <pasta> --port 8091    → outra pasta (ex.: um catálogo simulado)
 *   node src/serve.ts --host 0.0.0.0               → visível na rede local (celular)
 *
 * No app: EXPO_PUBLIC_CATALOG_MANIFEST_URL=http://127.0.0.1:8091/manifest.json
 * Como o GitHub Pages: Access-Control-Allow-Origin: * e o .gz entregue como está (sem Content-Encoding).
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, extname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PATHS } from './config.ts'

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: resolve(PATHS.dist, 'site') },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '8091' },
  },
})
const root = resolve(args.dir)
const TYPES: Record<string, string> = { '.json': 'application/json; charset=utf-8', '.gz': 'application/gzip' }

createServer((req, res) => {
  const name = basename(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)) // só arquivos da própria pasta
  const file = resolve(root, name)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  let size = -1
  try {
    if (name) size = statSync(file).isFile() ? statSync(file).size : -1
  } catch {
    // não existe
  }
  console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} /${name} → ${size >= 0 ? 200 : 404}`)
  if (size < 0) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado')
    return
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': name === 'manifest.json' ? 'no-cache' : 'max-age=600',
  })
  createReadStream(file).pipe(res)
}).listen(Number(args.port), args.host, () => {
  console.log(`Servindo ${root} em http://${args.host}:${args.port}/manifest.json (Ctrl+C para parar)`)
})
