import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchHistory, recordSearch } from '../services/searchHistory.ts';

test('normalizes recent searches to unique non-empty values', () => {
  assert.deepEqual(normalizeSearchHistory([' React ', '', 'react', 'CloudNav']), ['React', 'CloudNav']);
});

test('records a query at the front and caps the history', () => {
  const history = Array.from({ length: 8 }, (_, index) => `q${index}`);
  assert.deepEqual(recordSearch(history, 'new'), ['new', 'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  assert.deepEqual(recordSearch(history, ' q3 '), ['q3', 'q0', 'q1', 'q2', 'q4', 'q5', 'q6', 'q7']);
});
