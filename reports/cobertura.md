# Relatório de cobertura do catálogo

Gerado em 2026-11-15T04:18:10.307Z · dados baixados em 2026-11-15T04:17:27.307Z · `catalog.db` com 18.9 MB

Fontes: TCGdex (api.tcgdex.net) + PokéAPI (github.com/PokeAPI/pokeapi). Séries excluídas: 15 coleções do TCG Pocket (digital).

## Resumo

| Região | Coleções | Cartas | Pokémon | Treinador | Energia | Variantes |
|---|---|---|---|---|---|---|
| Internacional (EN/PT) | 202 | 21.432 | 17.963 | 2.890 | 579 | 35.323 |
| Japonês | 121 | 13.156 | 10.601 | 2.270 | 285 | 16.156 |

| Idioma | Cartas | Com imagem | % |
|---|---|---|---|
| en | 21.432 | 19.810 | 92.4% |
| pt | 14.189 | 13.032 | 91.8% |
| ja | 13.156 | 3.882 | 29.5% |

## Pokédex

Espécies na PokéAPI: **1025**. Espécies com pelo menos uma carta: internacional **1025/1025**, japonês **1018/1025**.

| Origem do número | Internacional | Japonês |
|---|---|---|
| TCGdex | 17.847 | 10.165 |
| Inferido pelo nome | 114 | 433 |
| Correção manual (overrides.json) | 3 | 3 |
| Pokémon sem número | 0 | 1 |
| Cartas com mais de um Pokémon | 130 | 136 |

**Espécies sem nenhuma carta (Internacional (EN/PT)): 0**
—

**Espécies sem nenhuma carta (Japonês): 7**
#856 Hatenna, #857 Hattrem, #865 Sirfetch’d, #867 Runerigus, #880 Dracozolt, #881 Arctozolt, #882 Dracovish

### Cartas por geração

| Geração | Espécies | Cartas intl | Cobertura intl | Cartas ja | Cobertura ja |
|---|---|---|---|---|---|
| Gen 1 | 151 | 4.856 | 100.0% | 2.790 | 100.0% |
| Gen 2 | 100 | 2.247 | 100.0% | 1.363 | 100.0% |
| Gen 3 | 135 | 2.690 | 100.0% | 1.209 | 100.0% |
| Gen 4 | 107 | 1.893 | 100.0% | 955 | 100.0% |
| Gen 5 | 156 | 2.385 | 100.0% | 1.278 | 100.0% |
| Gen 6 | 72 | 1.005 | 100.0% | 622 | 100.0% |
| Gen 7 | 88 | 1.020 | 100.0% | 926 | 100.0% |
| Gen 8 | 96 | 987 | 100.0% | 512 | 92.7% |
| Gen 9 | 120 | 951 | 100.0% | 1.028 | 100.0% |

### Conferência número x nome (inglês)

Nenhuma divergência (as correções de `overrides.json` já foram aplicadas).

### Números inferidos pelo nome (547)

Cartas de Pokémon sem número na TCGdex, deduzido pelo nome. Amostra para conferência (lista completa em `dist/build-diagnostics.json`):

| Carta | Nome | Espécie |
|---|---|---|
| intl:me06-001 | Heracross | #214 Heracross |
| intl:me06-019 | Arcanine | #59 Arcanine |
| intl:me06-037 | Pawmi | #921 Pawmi |
| intl:me06-055 | Nidoran♀ | #29 Nidoran♀ |
| intl:me06-073 | Jangmo-o | #782 Jangmo-o |
| intl:me06-106 | Growlithe | #58 Growlithe |
| intl:me06-124 | Talonflame ex | #663 Talonflame |
| ja:SV1a-007 | マスカーニャex | #908 Meowscarada |
| ja:SV4K-015 | グレンアルマex | #936 Armarouge |
| ja:SV4K-022 | グソクムシャex | #768 Golisopod |
| ja:SV4K-031 | デスカーンex | #563 Cofagrigus |
| ja:SV1a-038 | デデンネex | #702 Dedenne |
| ja:SV8a-046 | イルカマンex | #964 Palafin |
| ja:SV4a-054 | パオジアンex | #1002 Chien-Pao |
| ja:SV1S-068 | パフュートンex | #916 Oinkologne |
| ja:M1S-076 | メガユキノオーex | #460 Abomasnow |
| ja:SV5a-079 | ヤバソチャex | #1013 Sinistcha |
| ja:SV4K-082 | デスカーンex | #563 Cofagrigus |
| ja:S9a-085 | ヒスイ バクフーンVSTAR | #157 Typhlosion |
| ja:SV2P-088 | ダイオウドウex | #879 Copperajah |
| ja:SV1a-090 | ルガルガンex | #745 Lycanroc |
| ja:SV2D-094 | ディンルーex | #1003 Ting-Lu |
| ja:S9-102 | リザードンV | #6 Charizard |
| ja:S9-107 | エルフーンV | #547 Whimsicott |
| ja:S12-115 | レジエレキVMAX | #894 Regieleki |
| ja:SV9-120 | ノココッチex | #982 Dudunsparce |
| ja:SV8a-126 | イーブイex | #133 Eevee |
| ja:SV8a-136 | テラパゴスex | #1024 Terapagos |
| ja:SV8a-216 | オーガポン いしずえのめんex | #1017 Ogerpon |
| ja:SV4a-322 | リククラゲex | #949 Toedscruel |

**Pokémon sem número mesmo após a inferência (1):** ja:E4-070 (埋もれた化石)

**Números fracionados na TCGdex (4):** ja:PCG7-015 レイカザ（デルタ種） [384.1], ja:PCG9-028 Rayquaza Ex（デルタ種） [384.1], ja:PCG6-043 レイカザ（デルタ種） [384.1], ja:PCG2-067 レイカザの星 [384.1] — arredondados para baixo.

**Nomes japoneses que não batem com a Pokédex japonesa: 1.435** de 10.164 cartas de Pokémon japonesas. O número está certo, mas o nome exibido pode ser uma tradução literal do inglês (ex.: "カリザード" em vez de "リザードン"). Exemplos: トラピンチ（デルタ種） (#328 Trapinch), ブルバサウルス (#1 Bulbasaur), ベルスプラウト (#69 Bellsprout), Zubat (#41 Zubat), ニドランm (#32 Nidoran♂), エカン (#23 Ekans), 奇妙な (#43 Oddish), Snorlax（デルタ種） (#143 Snorlax), 雑草 (#13 Weedle), Zubat (#41 Zubat), アイビサウルス (#2 Ivysaur), 雑草 (#13 Weedle)

## Coleções vazias ou incompletas na TCGdex

Coleções que a TCGdex lista mas sem nenhuma carta ficam **fora** do catalog.db e entram sozinhas quando forem preenchidas.

**Internacional (EN/PT):** 202 coleções no catálogo; 4 vazias (fora do catálogo) e 2 incompletas (cerca de 228 cartas faltando pelo total informado das coleções).

Vazias: wp W Promotional (7), jumbo Jumbo cards (160), sp Sample (10), rc Radiant Collection (25)

Mais incompletas: mfb My First Battle 34/48, tk-sm-l SM trainer Kit (Lycanroc) 18/30

**Japonês:** 121 coleções no catálogo; 83 vazias (fora do catálogo) e 2 incompletas (cerca de 6.105 cartas faltando pelo total informado das coleções).

Vazias: ADV1 拡張パック (55), ADV2 砂漠のきせき (53), ADV3 天空の覇者 (54), ADV4 強化拡張パックex1マグマVSアクア ふたつの野望 (80), ADV5 とかれた封印 (83), PCG10 ワールドチャンピオンズパック (108), L1a ハートゴールドコレクション (70), L1b ソウルシルバーコレクション (70), L2 よみがえる伝説 (70), LL 強化パック ロストリンク (40), L3 頂上大激突 (70), BW1b ホワイトコレクション (53), BW1a ブラックコレクション (53), BW2 レッドコレクション (66), BW3a サイコドライブ (52), BW3b ヘイルブリザード (52), BW4 ダークラッシュ (69), DS ドラゴンセレクション (20), BW5a リューズブラスト (50), BW5b リューノブレード (50), BW6b コールドフレア (59), BW6a フリーズボルト (59), BW7 プラズマゲイル (70), BW8b ライデンナックル (51), SC シャイニーコレクション (20), BW9 メガロキャノン (76), EBB EXバトルブースト (96), XY1b コレクションY (60), XY1a コレクションX (60), XY2 ワイルドブレイズ (80), XY3 ライジングフィスト (96), XY4 ファントムゲート (88), XY5a ガイアボルケーノ (70), XY5b タイダルストーム (70), XY6 エメラルドブレイク (78), XY7 バンデットリング (81), XY8b 赤い閃光 (59), XY8a 青い衝撃 (59), XY9 破天の怒り (80), CP3 ポケキュンコレクション (32), XY10 めざめる超王 (78), CP4 プレミアムチャンピオンパック EX×M×BREAK (131), XY11a 爆熱の闘士 (54), XY11b 冷酷の反逆者 (54), CP5 冷酷の反逆者 (36), CP6 ポケットモンスターカードゲーム 拡張パック 20th Anniversary (87), SM0 ピカチュウと新しい仲間たち (4), SM1+ サン＆ムーン (51), sm2+ 新たなる試練の向こう (49), SM3+ ひかる伝説 (72), SM4+ GXバトルブースト (114), SM5+ ウルトラフォース (50), SMP2 名探偵ピカチュウ (24), S1H シールド (60), S1W ソード (60), S1a VMAXライジング (70), S2 反逆クラッシュ (96), S3 ムゲンゾーン (100), S3a 伝説の鼓動 (76), CS4b トリプレットビート (101), CS3a トリプレットビート (101), CS3b トリプレットビート (101), CS3.5 トリプレットビート (101), CS4a トリプレットビート (101), CS2.5 トリプレットビート (101), CS3D トリプレットビート (101), CS1a トリプレットビート (101), CS4Da トリプレットビート (101), CS2b トリプレットビート (101), CSA トリプレットビート (101), CS4 トリプレットビート (101), CS2a トリプレットビート (101), CS1b トリプレットビート (101), CS1.5 トリプレットビート (101), S4 仰天のボルテッカー (100), S10b Pokémon GO (71), S10D タイムゲイザー (67), S4a シャイニースターV (190), S2a 爆炎ウォーカー (70), S5a 双璧のファイター (70), S6a イーブイヒーローズ (69), S7R 蒼空ストリーム (67), S8a 25th アニバーサリーコレクション (28)

Mais incompletas: WCS23 ポケモンワールドチャンピオンシップス2023横浜 記念デッキ「ピカチュウ」 1/30, web1 ポケモンカード★web 47/48


## Imagens por série

Porcentagem de cartas com imagem na TCGdex. A imagem é a base da URL; o app acrescenta `/low.webp` ou `/high.webp`.

| Série | Região | Cartas | Imagem EN | Cartas PT | Imagem PT | Imagem JA |
|---|---|---|---|---|---|---|
| Miscellaneous | intl | 1 | 0.0% | 0 | — | — |
| Base | intl | 494 | 100.0% | 0 | — | — |
| Gym | intl | 264 | 100.0% | 0 | — | — |
| Neo | intl | 383 | 100.0% | 0 | — | — |
| Legendary Collection | intl | 110 | 100.0% | 0 | — | — |
| E-Card | intl | 542 | 85.1% | 0 | — | — |
| EX | intl | 1.727 | 98.1% | 0 | — | — |
| POP | intl | 193 | 99.0% | 0 | — | — |
| Trainer kits | intl | 475 | 0.0% | 0 | — | — |
| Diamond & Pearl | intl | 900 | 100.0% | 0 | — | — |
| Platinum | intl | 533 | 99.8% | 0 | — | — |
| HeartGold & SoulSilver | intl | 439 | 97.9% | 0 | — | — |
| Call of Legends | intl | 106 | 100.0% | 0 | — | — |
| Black & White | intl | 1.437 | 99.8% | 1.175 | 100.0% | — |
| McDonald's Collection | intl | 166 | 0.0% | 0 | — | — |
| XY | intl | 1.932 | 99.5% | 1.593 | 96.1% | — |
| Sun & Moon | intl | 2.918 | 92.1% | 2.736 | 88.4% | — |
| Sword & Shield | intl | 3.675 | 90.2% | 3.640 | 83.9% | — |
| Scarlet & Violet | intl | 3.698 | 97.5% | 3.638 | 98.2% | — |
| Mega Evolution | intl | 1.439 | 89.0% | 1.407 | 91.0% | — |
| ポケットモンスターカードゲーム | ja | 457 | — | — | — | 0.0% |
| ポケモンカード★neo | ja | 323 | — | — | — | 0.0% |
| VS | ja | 143 | — | — | — | 0.0% |
| web | ja | 47 | — | — | — | 0.0% |
| ポケモンカードe | ja | 492 | — | — | — | 0.0% |
| PCG | ja | 722 | — | — | — | 0.0% |
| BW | ja | 58 | — | — | — | 0.0% |
| XY | ja | 61 | — | — | — | 0.0% |
| サン＆ムーン | ja | 3.139 | — | — | — | 0.0% |
| 剣と盾 | ja | 1.887 | — | — | — | 53.4% |
| ポケモンカードゲーム スカーレット&バイオレット | ja | 3.678 | — | — | — | 78.2% |
| ポケモンカードゲーム MEGA | ja | 2.149 | — | — | — | 0.0% |

## Raridades

| Código | Nome (PT) | Faixa | Intl | Ja |
|---|---|---|---|---|
| `none` | Sem raridade | 0 | 529 | 2.260 |
| `promo` | Promo | 0 | 1.134 | 420 |
| `unknown` | Não informada | 0 | 0 | 665 |
| `common` | Comum | 1 | 5.931 | 3.229 |
| `uncommon` | Incomum | 2 | 4.950 | 2.365 |
| `rare` | Rara | 3 | 3.899 | 966 |
| `rare_holo` | Rara Holo | 4 | 741 | 603 |
| `rare_holo_lvx` | Rara Holo LV.X | 5 | 59 | 0 |
| `rare_prime` | Rara Prime | 5 | 26 | 0 |
| `legend` | LENDA | 5 | 18 | 0 |
| `rare_holo_v` | Rara Holo V | 5 | 239 | 0 |
| `rare_holo_vmax` | Rara Holo VMAX | 5 | 89 | 0 |
| `rare_holo_vstar` | Rara Holo V-ASTRO | 5 | 33 | 0 |
| `double_rare` | Rara Dupla | 5 | 339 | 645 |
| `ace_spec` | Rara ACE SPEC | 5 | 33 | 14 |
| `radiant_rare` | Rara Radiante | 5 | 15 | 12 |
| `amazing_rare` | Rara Incrível | 5 | 9 | 0 |
| `classic_collection` | Coleção Clássica | 5 | 25 | 30 |
| `ultra_rare` | Ultra Rara | 6 | 1.523 | 760 |
| `triple_rare` | Rara Tripla | 6 | 0 | 68 |
| `illustration_rare` | Ilustração Rara | 6 | 525 | 407 |
| `character_rare` | Rara de Personagem | 6 | 0 | 52 |
| `shiny_rare` | Rara Brilhante | 6 | 310 | 20 |
| `shiny_rare_v` | Rara Brilhante V | 6 | 9 | 0 |
| `shiny_rare_vmax` | Rara Brilhante VMAX | 6 | 7 | 0 |
| `full_art_trainer` | Treinador Arte Completa | 6 | 6 | 0 |
| `pikachu_rare` | Rara Pikachu | 6 | 30 | 0 |
| `mega_attack_rare` | Rara Mega Ataque | 6 | 7 | 0 |
| `special_illustration_rare` | Ilustração Rara Especial | 7 | 238 | 163 |
| `character_super_rare` | Super Rara de Personagem | 7 | 0 | 46 |
| `shiny_ultra_rare` | Ultra Rara Brilhante | 7 | 12 | 8 |
| `secret_rare` | Rara Secreta | 7 | 604 | 184 |
| `black_white_rare` | Rara Preto e Branco | 7 | 4 | 2 |
| `rgb_rare` | Rara RGB | 7 | 3 | 3 |
| `futuristic_rare` | Rara Futurista | 7 | 2 | 2 |
| `hyper_rare` | Hiper Rara | 8 | 74 | 192 |
| `mega_hyper_rare` | Mega Hiper Rara | 8 | 9 | 40 |

Valores brutos sem mapeamento: nenhum.

## Acabamentos (variantes de impressão)

| Acabamento | Intl | Ja |
|---|---|---|
| holo | 7.473 | 4.449 |
| lenticular | 9 | 0 |
| metal | 2 | 0 |
| normal | 18.029 | 10.181 |
| reverse | 9.810 | 1.526 |

**Padrões de brilho (foil):** cosmos (intl) 477, pokeball (ja) 424, masterball (ja) 401, pokeball (intl) 303, energy (intl) 271, masterball (intl) 211, rainbow (intl) 164, gold (intl) 145, energy (ja) 118, cracked-ice (intl) 65, league (intl) 59, duskball (intl) 26, loveball (intl) 25, friendball (intl) 23, quickball (intl) 22, loveball (ja) 18, quickball (ja) 17, duskball (ja) 15, friendball (ja) 11, tinsel (intl) 11, team-rocket (intl) 10, team-rocket (ja) 9, galaxy (intl) 8, player-reward (intl) 6, mirror (intl) 2, professor-program (intl) 2, starlight (intl) 1

**Carimbos mais comuns:** 1st-edition 2.368, set-logo 1.257, player-rewards-program 216, 30th-anniversary 196, staff 166, 25th-celebration 84, pre-release 52, snowflake 50, jason-klaczynski 43, david-cohen 38, winner 35, regional-championships 34, professor-program 34, pokemon-center 29, michael-pramawat 29, tsubasa-nakamura 28, yuta-komatsuda 27, poke-ball-league 27, dylan-lefavour 27, chris-fulop 27

**Subtipos:** unlimited 1.191, shadowless 204, 1999-2000-copyright 150, no-rarity 102, no-e-reader 41, missing-expansion-symbol 16, blue-border 8, peelable-ditto 3, aoki-error 3, shadowless-red-cheek 2, rarity-error 2, phanphy-error 2, no-holo-error 2, japanese-back 2, text-error 1

**Jumbo:** 218

## Tipos TCG, formas e mecânicas

| Tipo | Intl | Ja |
|---|---|---|
| Planta (`grass`) | 2.470 | 1.476 |
| Fogo (`fire`) | 1.639 | 948 |
| Água (`water`) | 2.544 | 1.430 |
| Elétrico (`lightning`) | 1.641 | 919 |
| Psíquico (`psychic`) | 2.440 | 1.481 |
| Lutador (`fighting`) | 1.953 | 1.168 |
| Escuridão (`darkness`) | 1.375 | 882 |
| Metal (`metal`) | 1.000 | 588 |
| Fada (`fairy`) | 279 | 118 |
| Dragão (`dragon`) | 546 | 377 |
| Incolor (`colorless`) | 2.285 | 1.216 |

**Formas:** alola (intl) 122, alola (ja) 115, base (intl) 17.345, base (ja) 10.208, galar (intl) 140, galar (ja) 52, hisui (intl) 81, hisui (ja) 74, mega (intl) 247, mega (ja) 124, paldea (intl) 28, paldea (ja) 28

**Mecânicas:** EX 1.379, ex 1.038, GX 948, V 910, VMAX 330, delta 324, tag_team_gx 249, VSTAR 150, LV.X 78, BREAK 38, radiant 34, shining 31, prime 27, SP 26, star 22, legend 22, V-UNION 20

## Tamanho do catálogo

| Tabela | Linhas |
|---|---|
| species | 1.025 |
| species_name | 10.250 |
| series | 32 |
| card_set | 323 |
| card | 34.588 |
| card_dex | 28.860 |
| card_type | 28.775 |
| card_lang | 48.777 |
| card_variant | 51.479 |

Arquivo: 18.9 MB.
