import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertRepeatCallCooldown, repeatCallCooldownRemaining, REPEAT_CALL_COOLDOWN_MS } from './call-cooldown.js';

describe('repeatCallCooldown', () => {
  it('allows repeat after cooldown elapsed', () => {
    const last = new Date(Date.now() - REPEAT_CALL_COOLDOWN_MS - 100);
    assert.equal(repeatCallCooldownRemaining(last), 0);
    assert.doesNotThrow(() => assertRepeatCallCooldown(last));
  });

  it('blocks repeat within cooldown window', () => {
    const last = new Date();
    assert.ok(repeatCallCooldownRemaining(last) > 0);
    assert.throws(() => assertRepeatCallCooldown(last), /Espere/);
  });
});
