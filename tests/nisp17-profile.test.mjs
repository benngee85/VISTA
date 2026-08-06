import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const profile = JSON.parse(
  fs.readFileSync('config/nisp17/applicability-profile.json', 'utf8'),
);
const policy = JSON.parse(
  fs.readFileSync('config/nisp17/runtime-remediation-policy.json', 'utf8'),
);
const backlog = JSON.parse(
  fs.readFileSync(
    'docs/assurance/generated/runtime-remediation-backlog.json',
    'utf8',
  ),
);

test('NISP capabilities are unique', () => {
  const values = profile.entries.map((entry) => entry.capability);
  assert.equal(new Set(values).size, values.length);
});

test('NISP entries identify standards and target boundaries', () => {
  for (const entry of profile.entries) {
    assert.ok(entry.standards.length > 0, entry.capability);
    assert.ok(entry.targetBoundary, entry.capability);
  }
});

test('runtime backlog uses the approved decision vocabulary', () => {
  const allowed = new Set(policy.decisions);
  assert.ok(backlog.entries.length > 0);
  for (const entry of backlog.entries) {
    assert.ok(allowed.has(entry.proposedDecision), entry.id);
    assert.equal(entry.decisionStatus, 'proposed');
  }
});
