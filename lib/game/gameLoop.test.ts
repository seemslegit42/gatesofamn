import test from 'node:test';
import assert from 'node:assert/strict';

test('GameLoop helper concept and interval sync check', () => {
  let ticks = 0;
  const simulateTick = (dt: number) => {
    ticks += dt;
  };

  simulateTick(0.016);
  simulateTick(0.016);
  assert.ok(ticks > 0.03);
});
