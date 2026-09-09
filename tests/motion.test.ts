import test from 'node:test';
import assert from 'node:assert/strict';
import { getDetailsOriginClass, getSpatialViewClass, motionTokens } from '../services/motion.ts';

test('uses stable spatial timing tokens', () => {
  assert.equal(motionTokens.fast, 160);
  assert.equal(motionTokens.normal, 260);
  assert.equal(motionTokens.spatial, 360);
  assert.equal(motionTokens.stagger, 28);
});

test('maps view direction to a deterministic transition class', () => {
  assert.equal(getSpatialViewClass('forward'), 'cloudnav-spatial-forward');
  assert.equal(getSpatialViewClass('backward'), 'cloudnav-spatial-backward');
  assert.equal(getSpatialViewClass('same'), 'cloudnav-spatial-same');
});

test('maps detail trigger origin to a supported origin class', () => {
  assert.equal(getDetailsOriginClass('left'), 'cloudnav-details-from-left');
  assert.equal(getDetailsOriginClass('right'), 'cloudnav-details-from-right');
  assert.equal(getDetailsOriginClass('bottom'), 'cloudnav-details-from-bottom');
});
