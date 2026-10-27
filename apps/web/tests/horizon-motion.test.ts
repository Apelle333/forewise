import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horizonHistory, scenarioRows } from '../lib/horizon-data';
import {
  inspectHorizon,
  motionTime,
  particleAt,
  orbitAt,
  MOTION_PERIOD,
} from '../lib/horizon-motion';

test('scrubbing preserves the exact public scenario model and historical observations', () => {
  for (const spread of [15, 55, 65]) {
    for (const row of scenarioRows(28, spread)) {
      const point = inspectHorizon(row.day, 28, spread);
      assert.deepEqual(
        [point.date, point.value, point.low, point.high],
        [row.date, row.center, row.low, row.high],
      );
      assert.equal(point.kind, 'scenario');
    }
  }
  for (let i = 0; i < horizonHistory.length; i++) {
    const point = inspectHorizon(i - 27, 28, 55);
    assert.equal(point.value, horizonHistory[i]);
    assert.equal(point.low, null);
    assert.equal(point.high, null);
    assert.equal(point.kind, 'history');
  }
  assert.equal(inspectHorizon(28, 7, 55).day, 7);
});

test('a paused clock freezes and resume continues from the same phase', () => {
  const paused = { offset: 3.25, startedAt: null };
  assert.equal(motionTime(paused, 100), motionTime(paused, 99999999));
  const resumed = { offset: motionTime(paused, 100), startedAt: 1000 };
  assert.equal(motionTime(resumed, 1000), 3.25);
  assert.equal(motionTime(resumed, 1500), 3.75);
});

test('seeded light traces loop without accumulated drift or discontinuous births', () => {
  for (let i = 0; i < 32; i++) {
    const point = particleAt(i, 2.5, 209);
    assert.deepEqual(point, particleAt(i, 2.5, 209));
    const replay = particleAt(i, 2.5 + MOTION_PERIOD * 100000, 209);
    assert.ok(Math.abs(point.phase - replay.phase) < 1e-9);
    assert.ok(Math.abs(point.alpha - replay.alpha) < 1e-9);
    assert.equal(particleAt(i, point.birth, 209).alpha, 0);
    assert.ok(point.alpha >= 0 && point.alpha <= 1);
    assert.ok(point.velocity > 0 && point.lifetime === MOTION_PERIOD);
  }
  assert.notDeepEqual(particleAt(1, 1, 209), particleAt(1, 1, 210));
});

test('camera choreography is periodic, deterministic and motion-free under reduced motion', () => {
  assert.deepEqual(orbitAt(0, false), orbitAt(MOTION_PERIOD, false));
  assert.deepEqual(orbitAt(2.4, false), orbitAt(2.4, false));
  assert.deepEqual(orbitAt(1, true), { x: 0, y: 0 });
  assert.deepEqual(orbitAt(200, true), { x: 0, y: 0 });
});
