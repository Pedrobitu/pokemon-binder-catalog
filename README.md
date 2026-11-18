# Catálogo do Pokémon Binder

Monta o catálogo de cartas do Pokémon TCG usado pelo app Pokémon Binder (`dist/catalog.db`, SQLite) a partir da **TCGdex** (cartas, coleções, imagens) e da **PokéAPI** (Pokédex). Um workflow do GitHub Actions monta o catálogo todo dia e o publica no GitHub Pages quando os dados mudam. O app confere o `manifest.json` publicado e baixa o catálogo novo sozinho.

**Catálogo publicado:** https://pedrobitu.github.io/pokemon-binder-catalog/manifest.json

Requer **Node 24+** (o workflow usa o 26). O Node roda os arquivos `.ts` direto, sem etapa de compilação. Não há dependências em tempo de execução: usa `fetch` e `node:sqlite`, que já vêm no Node.

```bash
npm run all              # fetch + build + report (~45 s)
npm run fetch            # baixa os dados brutos para raw/
npm run build            # raw/ → dist/catalog.db + dist/build-diagnostics.json
npm run report           # → reports/cobertura.md
npm run fetch-published  # baixa o último catálogo publicado → dist/published.db
npm run check            # confere dist/catalog.db contra o último publicado → reports/mudancas.md
npm run package          # → dist/site/ (manifest.json + catalog-<hash>.db.gz) e dist/published.db
npm run serve            # serve dist/site/ em http://127.0.0.1:8091, para testar o app sem publicar
npm run typecheck        # checagem de tipos (precisa de npm install)
```

## Etapas

| Etapa | Arquivo | O que faz |
|---|---|---|
| 1. Download | `src/fetch.ts` | Busca todas as coleções e cartas de cada idioma (`en`, `pt`, `ja`) numa consulta GraphQL em lote. Cartas que a API derruba do lote (raridade vazia, número da Pokédex "384.1") são baixadas uma a uma pela REST. Também baixa os CSVs da PokéAPI. |
| 2. Montagem | `src/build.ts` | Junta EN+PT (mesmas cartas, IDs iguais) e o japonês (catálogo próprio). Normaliza raridade, tipo, estágio, mecânica, forma e acabamentos. Infere o número da Pokédex pelo nome quando falta e confere número x nome. Aplica `overrides.json`. Grava a impressão digital dos dados em `meta.content_hash`. |
| 3. Relatório | `src/report.ts` | Gera `reports/cobertura.md`: cobertura da Pokédex, imagens por série, coleções vazias, raridades, acabamentos, divergências. |
| 4. Conferência | `src/check.ts` | Compara com o último catálogo publicado (`dist/published.db`) e diz se pode publicar. Ver abaixo. |
| 5. Pacote | `src/package.ts` | Só para um catálogo aprovado na conferência: gera o que vai para o GitHub Pages (`dist/site/`) e guarda o catálogo em `dist/published.db`, a base da próxima conferência. |

## Publicação automática (GitHub Actions)

`.github/workflows/catalogo.yml`, todo dia às 09:17 UTC (06:17 em Brasília; o GitHub pode atrasar algumas horas) e pelo botão **Run workflow** em Actions → Catálogo:

1. `fetch-published`: baixa o catálogo publicado agora, a base da conferência (sem nada publicado, é a primeira publicação);
2. `npm run all`: monta o catálogo com os dados do dia. Cada pedido à TCGdex tenta por ~1 min quando ela responde 5xx/429; se a montagem ainda falhar, é refeita até 3 vezes, com 10 min entre elas;
3. `check`: compara com o publicado. Reprovado, o workflow falha, nada é publicado e o GitHub manda e-mail ao dono do repositório. O motivo fica no resumo da execução;
4. sem mudanças, para aqui;
5. com mudanças: `package`, publicação no GitHub Pages (o `.gz` anterior continua no site ao lado do novo) e um commit com `reports/cobertura.md` e `reports/mudancas.md`.

- **Remoção proposital ou esquema novo:** no Run workflow, marque "Publicar mesmo com coleções ou mais de 20 cartas removidas" ou "Publicar com schema_version novo".
- **Agendamento:** o GitHub desliga workflows agendados de repositórios públicos depois de 60 dias sem atividade. Cada publicação faz um commit; se passar 50 dias sem publicar, o workflow faz um commit vazio para manter o agendamento.
- **Configuração do repositório:** Settings → Pages → Source: **GitHub Actions**.

## Conferência e pacote

A montagem é feita todo dia, mas só é publicada quando os dados mudam e passam na conferência.

- **Impressão digital (`content_hash`):** SHA-256 de todas as tabelas, menos o `meta` (`src/lib/contentHash.ts`). Duas montagens com os mesmos dados dão o mesmo valor, então "sem mudanças" não publica nada. O app compara o valor do manifest com o do catálogo que tem.
- **A conferência barra** (código de saída 1, nada é empacotado) quando:
  - mais de 20 cartas ou variantes somem, ou alguma coleção some. A coleção dos usuários aponta para esses IDs. Até 20, publica e lista os IDs no relatório;
  - um idioma vem vazio, ou mais de 0,5% das cartas que continuam perdem um idioma (download pela metade);
  - mais de 1% das cartas que continuam perdem a imagem;
  - a Pokédex diminui;
  - mais de 20 cartas novas têm número da Pokédex que não bate com o nome (até 20, só aviso: corrija no `overrides.json`);
  - o `schema_version` muda.
- **Remoção proposital** (ex.: coleção excluída no `overrides.json`): `node src/check.ts --allow-removals`. **Esquema novo** com o app já preparado: `--allow-schema-change`.
- **Saídas da conferência:**
  - `reports/mudancas.md`: coleções novas, coleções com cartas novas, IDs que sumiram, números e raridades que mudaram, idiomas e imagens. Não é regravado quando nada mudou;
  - `dist/check-result.json`: o mesmo resultado para o pacote e o workflow.
- **Testar o app sem publicar:** `npm run serve` (`src/serve.ts`) serve o `dist/site/` com `Access-Control-Allow-Origin: *`, como o GitHub Pages. O app aponta para ele com a variável `EXPO_PUBLIC_CATALOG_MANIFEST_URL`. `--dir` serve outra pasta e `--host 0.0.0.0` deixa o celular da mesma rede acessar.
- **Sem `dist/published.db`**, a conferência trata como primeira publicação. No PC, `npm run fetch-published` traz o publicado.
- **`manifest.json`:**
  ```json
  { "schemaVersion": 1, "builtAt": "…", "fetchedAt": "…", "contentHash": "<sha256>",
    "file": "catalog-<12 primeiros do hash>.db.gz", "bytes": 4820002, "rawBytes": 19861504,
    "counts": { "sets": 323, "cards": 34588, "variants": 51479 } }
  ```

## Arquivos

- `src/schema.ts`: esquema do `catalog.db`, com os comentários do formato dos IDs e das imagens
- `src/normalize/`: tabelas de normalização (raridade, campos, variantes, inferência da Pokédex)
- `overrides.json`: correções manuais (número da Pokédex, raridade, forma, coleções excluídas), cada uma com o motivo em `$notes`
- `reports/`: `cobertura.md` (toda montagem) e `mudancas.md` (conferência com mudanças). No repositório, são os da última publicação
- `raw/` e `dist/`: gerados, fora do git

## IDs (estáveis entre montagens: a coleção do usuário aponta para eles)

- Coleção: `intl:swsh3`, `ja:SV2a`
- Carta: `intl:swsh3-136`, `ja:SV2a-001`
- Variante: `intl:swsh3-136/reverse`, `ja:SV2a-001/reverse+masterball`, `intl:base1-4/holo+shadowless+1st-edition`

O prefixo de região é obrigatório: a TCGdex usa `neo1` tanto para a coleção inglesa quanto para a japonesa.

## Exemplo: todas as cartas de um Pokémon na ordem do binder

```sql
SELECT c.id, l.name, c.form, cs.release_date, c.local_number, c.rarity
FROM card_dex d
JOIN card c      ON c.id = d.card_id
JOIN card_set cs ON cs.id = c.set_id
JOIN card_lang l ON l.card_id = c.id AND l.lang = 'en'
WHERE d.dex_number = 26 AND c.region = 'intl'
ORDER BY CASE c.form WHEN 'base' THEN 0 WHEN 'alola' THEN 1 WHEN 'galar' THEN 2
                     WHEN 'hisui' THEN 3 WHEN 'paldea' THEN 4 WHEN 'mega' THEN 5 END,
         cs.release_date, c.sort_number, c.local_number;
```

## Créditos

- Cartas, coleções e links das imagens: [TCGdex](https://tcgdex.dev). As imagens não são copiadas: o catálogo guarda só o endereço delas na TCGdex.
- Pokédex: [PokéAPI](https://pokeapi.co).
- Projeto de fã, sem fins comerciais e sem afiliação com The Pokémon Company, Nintendo, Creatures ou GAME FREAK. Pokémon e os nomes, imagens e marcas relacionados pertencem aos seus donos.
