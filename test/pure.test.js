// Testy čistých funkcí z index.html (běží bez prohlížeče).
// Vytáhneme první bezatributový inline <script> (ExcelJS má <script src=…>)
// a spustíme ho ve vm-kontextu, kde window.addEventListener je no-op,
// takže init() se nespustí a žádná funkce nesáhne na DOM při načtení.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'inline <script> v index.html nenalezen');

const ctx = { window: { addEventListener() {} }, console, btoa, setTimeout, Promise };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);

const {
  normArr, fold, matchName, isActiveMember, numOrBlank,
  memberToPlayer, rosterToPlayer, parseCompetitions, addPlayerDedup, resolveFname,
  toggleOzn, parseFlags,
} = ctx;

// Objekty vytvořené ve vm-kontextu mají jiný prototyp (jiný realm) → deepStrictEqual
// by selhal na referenci. Porovnáváme jejich „plain" podobu.
function plain(o) { return JSON.parse(JSON.stringify(o)); }

test('normArr — single → pole, pole → beze změny, null → []', () => {
  assert.deepEqual(plain(normArr(null)), []);
  assert.deepEqual(plain(normArr({ a: 1 })), [{ a: 1 }]);
  assert.deepEqual(plain(normArr([1, 2])), [1, 2]);
});

test('matchName — bez diakritiky, všechna slova musí sednout', () => {
  assert.ok(matchName('1. Novoborský ŠK', 'novobor'));
  assert.ok(matchName('TJ Jawa Brodce', 'brodce jawa'));   // pořadí slov nezáleží
  assert.ok(matchName('Antoš Bořivoj', 'antos bor'));      // diakritika se ignoruje
  assert.ok(!matchName('TJ Jawa Brodce', 'brno'));
  assert.ok(matchName('cokoliv', ''));                     // prázdný dotaz = vše
});

test('isActiveMember — jen „Aktivní" (bez ohledu na diakritiku/velikost)', () => {
  assert.ok(isActiveMember({ registration: 'Aktivní' }));
  assert.ok(isActiveMember({ registration: 'aktivni' }));
  assert.ok(!isActiveMember({ registration: 'Neaktivní' }));
  assert.ok(!isActiveMember({}));
});

test('numOrBlank — kladné číslo, jinak prázdno (0/null/NaN)', () => {
  assert.equal(numOrBlank(708), 708);
  assert.equal(numOrBlank('1962'), 1962);
  assert.equal(numOrBlank(0), '');     // FIDE 0 = nemá
  assert.equal(numOrBlank(null), '');
  assert.equal(numOrBlank(undefined), '');
});

test('memberToPlayer — mapování členů oddílu', () => {
  const p = memberToPlayer({ fullName: 'Antoš Bořivoj ', birthYear: 1962, czeId: 708, fideId: 327298, czeStdElo: 2028, fideStdElo: 2058 }, 'club');
  assert.deepEqual(plain(p), { jmeno: 'Antoš Bořivoj', rok: 1962, lok: 708, fide: 327298, ozn: '', z: false, eloLok: 2028, eloFide: 2058, source: 'club' });
  const p2 = memberToPlayer({ fullName: 'X Y', birthYear: null, czeId: 5, fideId: 0 }, 'db');
  assert.equal(p2.rok, ''); assert.equal(p2.fide, ''); assert.equal(p2.lok, 5);
});

test('rosterToPlayer — playerId → LOK, rok/FIDE prázdné', () => {
  const p = rosterToPlayer({ rosterPosition: 1, playerId: 708, playerName: 'Novák Radomír', playerCzeElo: 2028, playerFideElo: 2058 });
  assert.deepEqual(plain(p), { jmeno: 'Novák Radomír', rok: '', lok: 708, fide: '', ozn: '', z: false, eloLok: 2028, eloFide: 2058, source: 'roster' });
  // playerFlags se předvyplní do Označení a Z
  const p2 = rosterToPlayer({ playerId: 5, playerName: 'X Y', playerFlags: ' H Z' });
  assert.equal(p2.ozn, 'H'); assert.equal(p2.z, true);
  const p3 = rosterToPlayer({ playerId: 6, playerName: 'A B', playerFlags: 'K' });
  assert.equal(p3.ozn, 'K'); assert.equal(p3.z, false);
});

test('toggleOzn — skupinová pravidla (K|ZK, H|V|C), toggle, řazení', () => {
  assert.equal(toggleOzn('', 'K'), 'K');
  assert.equal(toggleOzn('K', 'ZK'), 'ZK');        // K a ZK ne současně
  assert.equal(toggleOzn('K', 'H'), 'K H');        // kombinace skupin OK
  assert.equal(toggleOzn('K H', 'V'), 'K V');      // max jedna z H/V/C
  assert.equal(toggleOzn('K H', 'H'), 'K');        // klik na zvolené = odznačit
  assert.equal(toggleOzn('K H', 'K'), 'H');
  assert.equal(toggleOzn('H', 'K'), 'K H');        // řazení K/ZK před H/V/C
  assert.equal(toggleOzn('K', 'X'), 'K');          // neznámý kód ignorován
});

test('parseFlags — Označení + Z z playerFlags', () => {
  assert.deepEqual(plain(parseFlags(' H Z')), { ozn: 'H', z: true });
  assert.deepEqual(plain(parseFlags('ZK V')), { ozn: 'ZK V', z: false });
  assert.deepEqual(plain(parseFlags('')), { ozn: '', z: false });
  assert.deepEqual(plain(parseFlags(null)), { ozn: '', z: false });
});

test('parseCompetitions — regiony seřazené, soutěže dle úrovně', () => {
  const regs = parseCompetitions({
    '98': { regionCode: 'ŠSČR', regionName: 'Šachový svaz České republiky',
      competitions: [{ compName: 'Extraliga', compId: 1, compLevel: 0 }] },
    '11': { regionCode: 'SŠS', regionName: 'Středočeský šachový svaz (SŠS)',
      competitions: [{ compName: 'B', compId: 3, compLevel: 2 }, { compName: 'A', compId: 2, compLevel: 1 }] },
  });
  assert.equal(regs.length, 2);
  assert.equal(regs[0].regionName, 'Středočeský šachový svaz (SŠS)'); // S < Š
  assert.deepEqual(regs[0].competitions.map(c => c.compName), ['A', 'B']); // dle compLevel
});

test('addPlayerDedup — duplicitní LOK se nepřidá, prázdný LOK vždy', () => {
  const list = [];
  assert.ok(addPlayerDedup(list, { lok: 708 }));
  assert.ok(!addPlayerDedup(list, { lok: 708 }));  // duplicita
  assert.ok(addPlayerDedup(list, { lok: '' }));    // ruční bez LOK
  assert.ok(addPlayerDedup(list, { lok: '' }));    // druhý ruční taky projde
  assert.equal(list.length, 3);
});

test('resolveFname — placeholdery, diakritika, sanitizace, přípona, první písmeno velké', () => {
  assert.equal(resolveFname('soupiska_[druzstvo]', { druzstvo: 'TJ Jawa A' }), 'Soupiska_TJ_Jawa_A.xlsx');
  assert.equal(resolveFname('[oddil]', { oddil: 'Nový Bor' }), 'Novy_Bor.xlsx');
  assert.equal(resolveFname('a/b:c', {}), 'A_b_c.xlsx');
  assert.equal(resolveFname('', {}), 'Soupiska.xlsx');
  assert.equal(resolveFname('hotovo.xlsx', {}), 'Hotovo.xlsx'); // přípona se nepřidá 2×
});
