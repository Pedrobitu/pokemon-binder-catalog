/**
 * Esquema do catalog.db (somente leitura no app).
 *
 * IDs:
 *   - coleção: "<região>:<id TCGdex>"        → intl:swsh3, ja:SV2a
 *   - carta:   "<região>:<id TCGdex>"        → intl:swsh3-136, ja:SV2a-001
 *   - variante: "<carta>/<atributos>"        → intl:swsh3-136/reverse
 * O prefixo de região é necessário porque a TCGdex reutiliza IDs (ex.: neo1 existe no inglês e no japonês).
 *
 * Imagens: `image_url` é a base da TCGdex; o app acrescenta "/low.webp" (grade) ou "/high.webp" (detalhe).
 */
export const SCHEMA_SQL = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ===== Pokédex (PokéAPI) =====
CREATE TABLE species (
  dex_number INTEGER PRIMARY KEY,
  identifier TEXT NOT NULL,              -- slug em inglês: "bulbasaur"
  generation INTEGER NOT NULL
);
CREATE TABLE species_name (
  dex_number INTEGER NOT NULL REFERENCES species,
  lang       TEXT NOT NULL,
  name       TEXT NOT NULL,
  PRIMARY KEY (dex_number, lang)
) WITHOUT ROWID;
CREATE TABLE species_type (               -- tipo dos jogos (18), da forma padrão
  dex_number INTEGER NOT NULL REFERENCES species,
  slot       INTEGER NOT NULL,
  type       TEXT NOT NULL,
  PRIMARY KEY (dex_number, slot)
) WITHOUT ROWID;

-- ===== Coleções =====
CREATE TABLE series (
  id         TEXT PRIMARY KEY,           -- intl:swsh, ja:S
  region     TEXT NOT NULL,              -- intl | ja
  sort_order INTEGER NOT NULL            -- pela data da primeira coleção
);
CREATE TABLE series_name (
  series_id TEXT NOT NULL REFERENCES series,
  lang      TEXT NOT NULL,
  name      TEXT NOT NULL,
  PRIMARY KEY (series_id, lang)
) WITHOUT ROWID;
CREATE TABLE card_set (
  id             TEXT PRIMARY KEY,
  region         TEXT NOT NULL,
  series_id      TEXT NOT NULL REFERENCES series,
  release_date   TEXT,                   -- AAAA-MM-DD
  official_count INTEGER,                -- número impresso: 136/189 → 189
  total_count    INTEGER,                -- inclui as secretas
  symbol_url     TEXT
);
CREATE TABLE set_name (
  set_id   TEXT NOT NULL REFERENCES card_set,
  lang     TEXT NOT NULL,
  name     TEXT NOT NULL,
  logo_url TEXT,
  PRIMARY KEY (set_id, lang)
) WITHOUT ROWID;

-- ===== Cartas =====
CREATE TABLE card (
  id              TEXT PRIMARY KEY,
  region          TEXT NOT NULL,
  set_id          TEXT NOT NULL REFERENCES card_set,
  local_number    TEXT NOT NULL,         -- "136", "TG01", "SV001"
  sort_number     INTEGER,               -- parte numérica do local_number (ordenação)
  category        TEXT NOT NULL,         -- pokemon | trainer | energy
  rarity          TEXT NOT NULL,         -- código normalizado (normalize/rarity.ts)
  rarity_rank     INTEGER NOT NULL,      -- faixa 0–8 para ordenar/agrupar
  stage           TEXT,                  -- basic | stage1 | stage2 | vmax | vstar | mega | ...
  mechanic        TEXT,                  -- ex | EX | GX | V | VMAX | VSTAR | radiant | ...
  form            TEXT NOT NULL,         -- base | alola | galar | hisui | paldea | mega
  trainer_type    TEXT,                  -- supporter | item | tool | stadium | ...
  energy_type     TEXT,                  -- normal | special
  hp              INTEGER,
  illustrator     TEXT,
  regulation_mark TEXT,
  primary_dex     INTEGER,               -- Pokémon principal (posição no binder)
  dex_source      TEXT                   -- tcgdex | inferred | override
);
CREATE TABLE card_dex (                   -- N:N, Tag Teams têm mais de um
  card_id    TEXT NOT NULL REFERENCES card,
  dex_number INTEGER NOT NULL,
  position   INTEGER NOT NULL,
  PRIMARY KEY (card_id, dex_number)
) WITHOUT ROWID;
CREATE TABLE card_type (                  -- tipo TCG (11)
  card_id TEXT NOT NULL REFERENCES card,
  slot    INTEGER NOT NULL,
  type    TEXT NOT NULL,
  PRIMARY KEY (card_id, slot)
) WITHOUT ROWID;
CREATE TABLE card_lang (                  -- idiomas em que a carta existe
  card_id   TEXT NOT NULL REFERENCES card,
  lang      TEXT NOT NULL,
  name      TEXT NOT NULL,
  image_url TEXT,
  PRIMARY KEY (card_id, lang)
) WITHOUT ROWID;
CREATE TABLE card_variant (
  id         TEXT PRIMARY KEY,
  card_id    TEXT NOT NULL REFERENCES card,
  finish     TEXT NOT NULL,              -- normal | reverse | holo | lenticular | metal
  foil       TEXT,                       -- pokeball | masterball | cosmos | ...
  subtype    TEXT,                       -- shadowless | unlimited | erros de impressão
  size       TEXT NOT NULL,              -- standard | jumbo
  stamps     TEXT NOT NULL,              -- JSON: ["1st-edition"]
  sort_order INTEGER NOT NULL
);

CREATE INDEX card_set_idx        ON card (set_id, sort_number, local_number);
CREATE INDEX card_primary_dex    ON card (primary_dex);
CREATE INDEX card_rarity_idx     ON card (rarity);
CREATE INDEX card_dex_number_idx ON card_dex (dex_number);
CREATE INDEX card_type_idx       ON card_type (type);
CREATE INDEX card_lang_name_idx  ON card_lang (lang, name);
CREATE INDEX card_variant_card   ON card_variant (card_id);
CREATE INDEX species_name_idx    ON species_name (name);
`
