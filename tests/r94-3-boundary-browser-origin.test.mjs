import assert from 'node:assert/strict';
import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const forbidden =
  'https://maps.worldmonitor.app/country-boundary-overrides.geojson';

function filesUnder(directory) {
  const results = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      results.push(...filesUnder(path));
    } else if (
      /\.(?:ts|tsx|js|mjs|html|json)$/.test(name)
    ) {
      results.push(path);
    }
  }

  return results;
}

describe('R94.3 boundary browser origin', () => {
  it('does not fetch the boundary override cross-origin', () => {
    for (const file of filesUnder('src')) {
      assert.doesNotMatch(
        readFileSync(file, 'utf8'),
        new RegExp(
          forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        ),
        file,
      );
    }
  });
});
