import { resolve } from 'node:path'

/** Idiomas baixados da TCGdex. MVP: inglês + português + japonês. */
export const LANGS = ['en', 'pt', 'ja'] as const
export type Lang = (typeof LANGS)[number]

/**
 * Região do catálogo. As coleções internacionais (EN, PT, FR...) são a mesma
 * coleção traduzida e compartilham IDs; as asiáticas têm coleções e numeração próprias.
 */
export type Region = 'intl' | 'ja'
export const REGION_OF_LANG: Record<Lang, Region> = { en: 'intl', pt: 'intl', ja: 'ja' }

/** Séries ignoradas: TCG Pocket é um jogo digital, não tem carta física. */
export const EXCLUDED_SERIES = new Set(['tcgp'])

export const TCGDEX_GRAPHQL = 'https://api.tcgdex.net/v2/graphql'
export const TCGDEX_REST = 'https://api.tcgdex.net/v2'

export const POKEAPI_CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
export const POKEAPI_CSV_FILES = [
  'pokemon_species',
  'pokemon_species_names',
  'languages',
  'pokemon',
  'pokemon_types',
  'types',
  'pokemon_forms',
] as const

/** Idioma da PokéAPI (identifier em languages.csv, em minúsculas) → idioma do app. */
export const POKEAPI_LANG_MAP: Record<string, string> = {
  en: 'en',
  'ja-hrkt': 'ja', // katakana: é o nome impresso nas cartas japonesas
  'pt-br': 'pt',
  fr: 'fr',
  de: 'de',
  es: 'es',
  it: 'it',
  ko: 'ko',
  'zh-hant': 'zh-tw',
  'zh-hans': 'zh-cn',
}

/** Versão do esquema do catalog.db. Mude quando a estrutura das tabelas mudar. */
export const SCHEMA_VERSION = 1

/** Onde o catálogo é publicado (GitHub Pages deste repositório); o app lê o manifest.json daqui. */
export const PUBLISHED_SITE_URL = 'https://pedrobitu.github.io/pokemon-binder-catalog/'

const ROOT = resolve(import.meta.dirname, '..')
export const PATHS = {
  root: ROOT,
  raw: resolve(ROOT, 'raw'),
  dist: resolve(ROOT, 'dist'),
  reports: resolve(ROOT, 'reports'),
  overrides: resolve(ROOT, 'overrides.json'),
}
