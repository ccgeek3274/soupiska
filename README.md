# Soupiska družstva — generátor xlsx (ŠSČR)

Jednosouborová webová aplikace (`index.html`), která pomůže vedoucímu družstva
sestavit **soupisku pro sezónu 2026/2027** a vygenerovat ji do oficiální
šablony `E-soupiska_2026-2027.xlsx`. Data o oddílech, hráčích a soutěžích se
berou z veřejného API `https://api.chess.cz/api`.

## Co umí

1. **Hlavička** — výběr *kraje* a *soutěže* z API (`/competitions/{rok}`), našeptávač
   *oddílu* z `/clubs/all`, název družstva.
2. **Předvyplnění z existující soutěže** — vybereš tým ve zvolené soutěži a
   aplikace načte jeho loňskou soupisku (`/competitions/{compId}/team/{teamId}/roster`)
   a předvyplní hráče (rok narození a č. FIDE doplní z členů oddílu).
3. **Hráči** — tabulka odpovídající šabloně (Příjmení Jméno · Rok · Číslo LOK ·
   Číslo FIDE · Označení K/ZK/H/V/C · Z?). Hráče lze přidat třemi způsoby:
   - **z oddílu** (`/clubs/{clubCode}/members`) s přepínačem *jen aktivní hráči*,
   - **z celé databáze ŠSČR** našeptávačem (`/members/name`, min. 4 znaky),
   - **ručně** (prázdný řádek).
   Pořadí se mění tažením `⠿` nebo šipkami ▲▼, duplicity (dle čísla LOK) se nepřidají.
4. **Generování xlsx** — doplní oficiální šablonu přes [ExcelJS](https://github.com/exceljs/exceljs)
   (zachová styly, ohraničení i vizuální „přetékání" textu z buněk). Při více než
   20 hráčích se řádky tabulky naklonují.

## Šetrnost k API chess.cz

API agresivně blokuje IP při nárazovém přístupu. Aplikace proto:

- volá API **serializovaně s rozestupem ≥ 1,1 s** (~1 požadavek/s),
- má **lokální cache** odpovědí v `localStorage` s **24h** platností
  (našeptávání, seznam oddílů, členové, tabulky soutěží),
- po `429`/timeoutu se **sama na 10 minut zablokuje** a oznámí to,
- našeptávač v DB má **min. 4 znaky a 1s debounce**.

Tlačítko *Vymazat cache* lokální cache promaže (např. po změně dat na webu ŠSČR).

## Spuštění lokálně

Aplikace načítá šablonu přes `fetch('./E-soupiska_2026-2027.xlsx')`, takže ji
nelze otevřít přímo přes `file://` (prohlížeč fetch lokálního souboru zablokuje).
Spusť jednoduchý statický server v adresáři projektu:

```bash
npx serve .         # nebo: python3 -m http.server
```

a otevři vypsanou adresu (např. `http://localhost:3000`).

## Nasazení (Cloudflare Pages)

Statická stránka bez build kroku:

1. **Workers & Pages → Create → Pages → Connect to Git** a vyber tento repozitář.
2. **Build command** nech prázdné, **Build output directory** nastav na `/` (root).
3. Deploy. Každý push do `main` se nasadí automaticky.

Repozitář musí obsahovat `index.html` i `E-soupiska_2026-2027.xlsx` v rootu.
API chess.cz posílá `Access-Control-Allow-Origin: *`, takže frontend volá API
napřímo — žádný backend ani proxy není potřeba.

## Testy

```bash
npm install      # exceljs + jsdom (jen pro testy)
npm test
```

- `test/pure.test.js` — čisté funkce (mapování dat, dedup, název souboru,
  parsování soutěží) spuštěné nad inline `<script>` z `index.html` bez DOM.
- `test/xlsx.test.js` — generování přes ExcelJS nad reálnou šablonou: hlavička,
  řádky hráčů, zachování merge buněk, klonování řádků při >20 hráčích.

Žádný test nevolá `api.chess.cz`.

## Pozor na identifikátory API

`api.chess.cz` má nekonzistentní ID (viz `apichesscz.openapi.yaml`): pro volání
oddílových endpointů se používá **`clubCode`** z `/clubs/all` (ne `clubId`!).
Číslo LOK hráče = `czeId`. To je v kódu ošetřeno.
