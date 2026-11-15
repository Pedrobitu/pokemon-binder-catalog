import { TCGDEX_GRAPHQL, TCGDEX_REST } from '../config.ts'

const USER_AGENT = 'pokemon-binder-catalog/0.1'

class NonRetryableError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fetch com timeout e novas tentativas (backoff exponencial) para erros 5xx/429/rede. */
export async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(180_000),
      })
      if (res.ok) return res
      const error = new Error(`HTTP ${res.status} em ${url}`)
      if (res.status < 500 && res.status !== 429) throw new NonRetryableError(error.message)
      lastError = error
    } catch (err) {
      if (err instanceof NonRetryableError) throw err
      lastError = err
    }
    if (attempt < tries) await sleep(1000 * 2 ** (attempt - 1))
  }
  throw lastError
}

/** Busca uma carta pela API REST da TCGdex (os IDs podem vir já codificados, ex.: "exu-%3F"). */
export async function tcgdexRestCard(lang: string, id: string): Promise<Record<string, unknown>> {
  let decoded = id
  try {
    decoded = decodeURIComponent(id)
  } catch {
    // ID com "%" literal: usa como está
  }
  const res = await fetchWithRetry(`${TCGDEX_REST}/${lang}/cards/${encodeURIComponent(decoded)}`)
  return (await res.json()) as Record<string, unknown>
}

/** Roda `fn` sobre os itens com no máximo `limit` chamadas em paralelo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Executa uma consulta GraphQL na TCGdex. Por padrão falha se a resposta trouxer qualquer erro.
 * Com `allowPartial`, aceita erros desde que venha `data` e devolve quantos erros houve
 * (a TCGdex anula o item inteiro quando um campo obrigatório vem vazio, ex.: `rarity`).
 */
export async function tcgdexQuery<T>(query: string): Promise<T>
export async function tcgdexQuery<T>(query: string, opts: { allowPartial: true }): Promise<{ data: T; errorCount: number }>
export async function tcgdexQuery<T>(query: string, opts?: { allowPartial: true }) {
  const res = await fetchWithRetry(TCGDEX_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = (await res.json()) as { data?: T | null; errors?: { message: string }[] }
  const errorCount = body.errors?.length ?? 0
  if (errorCount > 0 && !(opts?.allowPartial && body.data)) {
    const sample = body.errors!.slice(0, 5).map((e) => e.message)
    throw new Error(`TCGdex GraphQL retornou ${errorCount} erro(s): ${sample.join(' | ')}`)
  }
  if (!body.data) throw new Error('TCGdex GraphQL: resposta sem "data"')
  return opts?.allowPartial ? { data: body.data, errorCount } : body.data
}
