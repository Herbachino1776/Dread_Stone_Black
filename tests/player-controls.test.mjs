import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileControls, MOBILE_LOOK_SENSITIVITY_SCALE, MOBILE_STRAFE_INPUT_SCALE, scaleMobileLookStick, scaleMobileMoveStick } from '../src/game/MobileControls.js';
import { PlayerController } from '../src/game/PlayerController.js';

test('outdoor traversal uses the same speed profile as indoor traversal', () => {
  assert.equal(PlayerController.OUTDOOR_MOVE_SPEED, PlayerController.DUNGEON_MOVE_SPEED);
  assert.equal(PlayerController.OUTDOOR_STRAFE_SPEED, PlayerController.DUNGEON_STRAFE_SPEED);
});

test('left stick attenuates strafing without reducing forward or backward travel', () => {
  assert.equal(MOBILE_STRAFE_INPUT_SCALE, 0.72);
  assert.deepEqual(scaleMobileMoveStick({ x: 1, y: -1 }), { x: 0.72, y: 1 });
  assert.deepEqual(scaleMobileMoveStick({ x: -1, y: 1 }), { x: -0.72, y: -1 });
});

test('right stick look sensitivity is reduced by exactly fifteen percent after its vertical deadzone', () => {
  assert.equal(MOBILE_LOOK_SENSITIVITY_SCALE, 0.85);
  assert.deepEqual(scaleMobileLookStick({ x: 1, y: -1 }), { x: 0.85, y: 0.85 });
  assert.deepEqual(scaleMobileLookStick({ x: 0.5, y: -0.2 }, (value) => Math.abs(value) >= 0.24 ? value : 0), { x: 0.425, y: 0 });
  assert.equal(typeof MobileControls, 'function');
});
