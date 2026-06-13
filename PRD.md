Implementuj automaticovaný webový formulář (jedna html) podle vzoru aplikace zpravodaj v /home/ccuser/git/sscr-zpravodaj
Hlavní cíl: genrování xlsx Soupiscky podle vzoru /home/ccuser/git/sscr-soupiska/E-soupiska_2026-2027.xlsx
Hlavní funkce:
 - Využívá API /home/ccuser/git/sscr-soupiska/apichesscz.openapi.yaml
 - Našeptání oddílu z endpointu /clubs/all a následně načítá jeho hráče z /clubs/číslo/members
 - Umožňuje přednastavit soupisku podle existující soutěže a kterou půjde vyhledat jako v projektu /home/ccuser/git/pgn-base
  - výběr kraje a soutěže z api chess.cz
- Umožňuje přidat hráče z vybraného klubu
  - Defultně je zapnut filtr na Aktivní hráč ale jde vypnout a tím se zobrazí všichni hráči které vrátilo api
- Umožňuje našeptat hráče z celé databáze jako v projektu /home/ccuser/git/pgn-base (včetně odpovídající nastavení backoff, rate limit)
  - lokální cache requestů našeptávání (trvanlivost 24h)
- Umožňuje i manuální vkládání hráčů
- Umožňuje měnit pořadí hráčů
- Bude nasazeno na claudflare
