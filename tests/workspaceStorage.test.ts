import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSPACE_DATA_CHANGED_EVENT } from '../services/workspaceStorage.ts';

test('uses one stable event name for workspace data refreshes', () => {
  assert.equal(WORKSPACE_DATA_CHANGED_EVENT, 'cloudnav-workspace-data-changed');
});
