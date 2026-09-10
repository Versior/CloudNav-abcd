import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WORKBENCH_TOOLS, normalizeWorkbenchTools } from '../services/workbenchTools.ts';

test('normalizes workbench data and clears retired note modules', () => {
  const result = normalizeWorkbenchTools({ todos: Array.from({ length: 60 }, (_, id) => ({ id: String(id), text: `todo-${id}`, done: false })), note: 'x'.repeat(10000), markdown: '# ok' });
  assert.equal(result.todos.length, DEFAULT_WORKBENCH_TOOLS.maxTodos);
  assert.equal(result.note, '');
  assert.equal(result.markdown, '');
});

test('falls back to safe defaults for malformed workbench data', () => {
  assert.deepEqual(normalizeWorkbenchTools(null), { todos: [], note: '', markdown: '', weather: null });
});
