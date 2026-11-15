import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`

/**
 * Impressão digital (SHA-256) dos DADOS do catálogo: muda só quando alguma carta, coleção,
 * variante ou espécie muda. Duas montagens com os mesmos dados dão o mesmo valor.
 *
 * - Fica de fora a tabela `meta` (data da montagem, data do download...) e as tabelas internas
 *   do SQLite (`sqlite_stat1`, criada pelo ANALYZE).
 * - Entram o nome e as colunas de cada tabela, então uma mudança de estrutura também muda o valor.
 * - As linhas vão em ordem de chave primária: o resultado não depende da ordem de inserção.
 *
 * Usada pelo build (grava em meta.content_hash), pela conferência e pelo empacotamento.
 * O app compara o valor do manifest com o do catálogo que tem para saber se há novidade.
 */
export function contentHash(db: DatabaseSync): string {
  const hash = createHash('sha256')
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'meta' ORDER BY name")
    .all() as { name: string }[]
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${quote(name)})`).all() as { name: string; pk: number }[]
    const pk = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk)
    const order = (pk.length ? pk : cols).map((c) => quote(c.name)).join(', ')
    hash.update(`${name}(${cols.map((c) => c.name).join(',')})\n`)
    for (const row of db.prepare(`SELECT * FROM ${quote(name)} ORDER BY ${order}`).iterate()) {
      hash.update(JSON.stringify(Object.values(row as object)) + '\n')
    }
  }
  return hash.digest('hex')
}
