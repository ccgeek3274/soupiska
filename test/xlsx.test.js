// Test generování xlsx: fillSoupiska() vytažená z index.html se spustí
// nad reálnou šablonou načtenou přes ExcelJS (stejná knihovna jako v prohlížeči,
// jen z npm). Ověřuje doplnění hlavičky, řádků hráčů, zachování merge buněk
// i naklonování řádků při >20 hráčích. Nehýbe se s api.chess.cz.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ExcelJS = require('exceljs');

const ROOT = path.join(__dirname, '..');
const TPL = path.join(ROOT, 'E-soupiska_2026-2027.xlsx');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const ctx = { window: { addEventListener() {} }, console, btoa, setTimeout, Promise };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const fillSoupiska = ctx.fillSoupiska;

async function fillAndReload(header, players) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL);
  const ws = wb.getWorksheet('Soupiska');
  fillSoupiska(ws, header, players);
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  return wb2.getWorksheet('Soupiska');
}

const HEADER = { kraj: 'Středočeský šachový svaz (SŠS)', soutez: 'Krajský přebor', druzstvo: 'TJ Jawa A', oddil: 'TJ Jawa Brodce' };

test('hlavička jde do B3/B4/B5/B6', async () => {
  const ws = await fillAndReload(HEADER, [{ jmeno: 'Novák Radomír', rok: 1962, lok: 708, fide: 327298, ozn: 'K', z: true }]);
  assert.equal(ws.getCell('B3').value, HEADER.kraj);
  assert.equal(ws.getCell('B4').value, HEADER.soutez);
  assert.equal(ws.getCell('B5').value, HEADER.druzstvo);
  assert.equal(ws.getCell('B6').value, HEADER.oddil);
});

test('řádek hráče: B-G na řádku 14, čísla jako number, Základ→Z', async () => {
  const ws = await fillAndReload(HEADER, [{ jmeno: 'Novák Radomír', rok: 1962, lok: 708, fide: 327298, ozn: 'K', z: true }]);
  assert.equal(ws.getCell('A14').value, '1.');
  assert.equal(ws.getCell('B14').value, 'Novák Radomír');
  assert.equal(ws.getCell('C14').value, 1962);
  assert.equal(typeof ws.getCell('C14').value, 'number');
  assert.equal(ws.getCell('D14').value, 708);
  assert.equal(ws.getCell('E14').value, 327298);
  assert.equal(ws.getCell('F14').value, 'K');
  assert.equal(ws.getCell('G14').value, 'Z');
});

test('prázdné rok/FIDE → null (buňka zůstane prázdná), Z false → prázdné', async () => {
  const ws = await fillAndReload(HEADER, [{ jmeno: 'Ruční Hráč', rok: '', lok: '', fide: '', ozn: '', z: false }]);
  assert.equal(ws.getCell('C14').value, null);
  assert.equal(ws.getCell('E14').value, null);
  assert.ok(!ws.getCell('G14').value);
});

test('styl řádku se zachová (ohraničení na B14)', async () => {
  const ws = await fillAndReload(HEADER, [{ jmeno: 'Test', rok: 2000, lok: 1, fide: 0, ozn: '', z: false }]);
  const b = ws.getCell('B14').border || {};
  assert.ok(b.top && b.bottom && b.left && b.right, 'B14 nemá kompletní ohraničení');
});

test('merge buňky v patičce zůstávají (3)', async () => {
  const ws = await fillAndReload(HEADER, [{ jmeno: 'Test', rok: 2000, lok: 1, fide: 0, ozn: '', z: false }]);
  assert.equal(ws.model.merges.length, 3);
});

test('více než 20 hráčů → naklonují se řádky, 22. je na řádku 35', async () => {
  const players = [];
  for (let i = 1; i <= 22; i++) players.push({ jmeno: 'Hráč ' + i, rok: 1990, lok: 1000 + i, fide: 0, ozn: '', z: false });
  const ws = await fillAndReload(HEADER, players);
  assert.equal(ws.getCell('A14').value, '1.');
  assert.equal(ws.getCell('B33').value, 'Hráč 20');
  assert.equal(ws.getCell('A34').value, '21.');
  assert.equal(ws.getCell('B35').value, 'Hráč 22');
  // ohraničení se naklonovalo i na nový řádek
  const b = ws.getCell('B35').border || {};
  assert.ok(b.top && b.bottom && b.left && b.right, 'naklonovaný řádek nemá ohraničení');
});
