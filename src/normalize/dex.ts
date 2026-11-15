/**
 * Inferência do número da Pokédex pelo nome, para cartas de Pokémon que vêm sem `dexId`
 * (coleções muito novas, várias japonesas). O resultado é marcado como "inferred" e
 * listado no relatório para conferência.
 */

export type NameIndex = Map<string, number>

export function normalizeName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * Sufixos de mecânica. Exige espaço/hífen antes (para não cortar "Klang" → "Klan"),
 * exceto logo depois de um caractere japonês ("リザードンex") ou para δ/☆.
 */
const SUFFIX_RE =
  /(?:[\s-]+|(?<=[぀-ヿ一-鿿]))(ex|gx|tag team-gx|v|vmax|vstar|v-union|break|lv\.?\s?x|prime|legend|star|sp|fb|gl|c|g|4|e4|lv\.\s?\d+)$|\s*[δ☆★]$/i
const PARENS_RE = /[（(][^）)]*[）)]/g
const JA_PREFIXES = ['かがやく', 'ひかる', '暗い', 'わるい', 'ロケット団の', 'ダーク', 'ライト', 'メガ', 'M', 'アローラ', 'ガラル', 'ヒスイ', 'パルデア']

function stripSuffixes(name: string): string {
  let current = name.replace(PARENS_RE, '').replace(/の星$/, '').trim()
  for (let i = 0; i < 4; i++) {
    const next = current.replace(SUFFIX_RE, '').trim()
    if (next === current || next === '') break
    current = next
  }
  return current
}

/** Candidatos de nome de espécie, do mais específico para o menos. */
function candidates(rawName: string): string[] {
  const name = normalizeName(stripSuffixes(normalizeName(rawName)))
  const out = [name]
  // Inglês: tira palavras do começo ("Dark Charizard", "Brock's Onix", "Heat Rotom")
  const words = name.split(' ')
  for (let i = 1; i < words.length; i++) out.push(words.slice(i).join(' '))
  // Japonês: primeira parte antes do espaço, dono da carta ("Xの…"), prefixos conhecidos
  if (words.length > 1) out.push(words[0]!)
  if (name.includes('の')) out.push(name.slice(name.lastIndexOf('の') + 1))
  for (const prefix of JA_PREFIXES) {
    const p = normalizeName(prefix)
    if (name.startsWith(p) && name.length > p.length) out.push(name.slice(p.length))
  }
  return out.map((c) => c.trim()).filter(Boolean)
}

/**
 * @param strict só aceita nome exato (depois de tirar sufixos/prefixos conhecidos), sem a busca
 *   por "final do nome". Usado para conferir números: evita falsos alarmes como "アズマリル" → "マリル".
 */
export function inferDexFromName(name: string, indexes: NameIndex[], strict = false): number | undefined {
  const cands = candidates(name)
  for (const cand of cands) {
    for (const index of indexes) {
      const dex = index.get(cand)
      if (dex !== undefined) return dex
    }
  }
  if (strict) return undefined
  // Japonês sem espaços: maior nome de espécie que termina o nome da carta ("ブラックキュレム")
  const base = cands[0]!
  let best: { dex: number; len: number } | undefined
  for (const index of indexes) {
    for (const [speciesName, dex] of index) {
      if (speciesName.length >= 3 && base.endsWith(speciesName) && speciesName.length > (best?.len ?? 0)) {
        best = { dex, len: speciesName.length }
      }
    }
  }
  return best?.dex
}
