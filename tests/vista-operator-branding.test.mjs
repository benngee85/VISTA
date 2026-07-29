import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('visible VISTA surfaces use operator-controlled identity', () => {
  const panel = read('src/app/panel-layout.ts');
  const map = read('src/components/DeckGLMap.ts');
  const index = read('index.html');
  const pro = [
    'pro-test/index.html',
    'pro-test/welcome.html',
    'pro-test/prerender.mjs',
    'pro-test/src/App.tsx',
    'pro-test/src/components/Footer.tsx',
    'pro-test/src/components/Logo.tsx',
    'pro-test/src/welcome/Hero.tsx',
  ].map(read).join('\n');

  assert.doesNotMatch(panel, />MONITOR</u);
  assert.doesNotMatch(panel, /x\.com\/eliehabib|@eliehabib/u);
  assert.doesNotMatch(panel, /github\.com\/koala73\/worldmonitor/u);
  assert.doesNotMatch(panel, /x\.com\/worldmonitorai/u);
  assert.match(panel, /VISTA_PRODUCT_IDENTITY/u);

  assert.doesNotMatch(map, /Someone(?:™|\.ceo)?/u);
  assert.doesNotMatch(map, /Elie Habib/u);
  assert.match(map, /VISTA_PRODUCT_IDENTITY\.vendor/u);

  assert.doesNotMatch(
    index,
    /x\.com\/eliehabib|x\.com\/worldmonitorai|github\.com\/koala73/u,
  );
  assert.match(index, /https:\/\/github\.com\/benngee85\/VISTA/u);

  assert.doesNotMatch(
    pro,
    /Someone(?:™|\.ceo)?|x\.com\/eliehabib|x\.com\/worldmonitorai/u,
  );
  assert.doesNotMatch(pro, /github\.com\/koala73\/worldmonitor/u);
  assert.match(pro, /https:\/\/github\.com\/benngee85\/VISTA/u);
});
