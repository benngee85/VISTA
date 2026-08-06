import assert from 'node:assert/strict';
import {
  execFileSync,
} from 'node:child_process';
import test from 'node:test';

const classifierFile =
  'scripts/seeder-outcome-classifier.sh';

function classify(
  outputText,
  lastLine = outputText,
) {
  const script = `
    . "$1"
    classify_zero_exit_seed_output "$2" "$3"
  `;

  return execFileSync(
    'sh',
    [
      '-c',
      script,
      'classifier-test',
      classifierFile,
      outputText,
      lastLine,
    ],
    {
      encoding: 'utf8',
    },
  ).trim();
}

test(
  'seed_complete skipped false is successful',
  () => {
    assert.equal(
      classify(
        '{"event":"seed_complete","domain":"resilience:scores","skipped":false,"total":196}',
      ),
      'ok',
    );
  },
);

test(
  'seed_complete skipped true is skipped',
  () => {
    assert.equal(
      classify(
        '{"event":"seed_complete","domain":"example","skipped":true}',
      ),
      'skipped',
    );
  },
);

test(
  'persisted records with no failures are successful',
  () => {
    assert.equal(
      classify(
        '[regional-snapshots] Done in 21.3s: persisted=8 skipped=0 failed=0',
      ),
      'ok',
    );
  },
);

test(
  'generated records with no failures are successful',
  () => {
    assert.equal(
      classify(
        '[regional-briefs] Done: generated=4 skipped=4 failed=0',
      ),
      'ok',
    );
  },
);

test(
  'zero generated with explicit skips is skipped',
  () => {
    assert.equal(
      classify(
        '[regional-briefs] Done in 0.1s: generated=0 skipped=8 failed=0',
      ),
      'skipped',
    );
  },
);

test(
  'explicit skipped publish remains skipped',
  () => {
    assert.equal(
      classify(
        'military:flights:v1 returned no flights — skipped publish',
      ),
      'skipped',
    );
  },
);

test(
  'successful text containing not found is not automatically skipped',
  () => {
    assert.equal(
      classify(
        'Completed successfully; optional prior record not found',
      ),
      'ok',
    );
  },
);
