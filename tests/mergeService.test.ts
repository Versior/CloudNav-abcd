import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeThreeWay } from '../services/mergeService.ts';

const base = {
  links: [{ id: '1', title: '旧标题', url: 'https://old.example', categoryId: 'common', createdAt: 1, updatedAt: 10 }],
  categories: [{ id: 'common', name: '常用', icon: 'Star' }],
};

test('takes remote when local kept the base value and local when remote kept the base value', () => {
  const result = mergeThreeWay(
    base,
    { links: [{ ...base.links[0] }], categories: base.categories },
    { links: [{ ...base.links[0], title: '云端标题' }], categories: base.categories },
  );
  assert.equal(result.data.links[0].title, '云端标题');
  assert.equal(result.conflicts, 0);
});

test('merges independent fields and counts a true same-field conflict', () => {
  const result = mergeThreeWay(
    base,
    { links: [{ ...base.links[0], title: '本地标题', updatedAt: 20 }], categories: base.categories },
    { links: [{ ...base.links[0], url: 'https://cloud.example', updatedAt: 30 }], categories: base.categories },
  );
  assert.equal(result.data.links[0].title, '本地标题');
  assert.equal(result.data.links[0].url, 'https://cloud.example');
  assert.equal(result.conflicts, 0);

  const conflict = mergeThreeWay(
    base,
    { links: [{ ...base.links[0], title: '本地标题', updatedAt: 20 }], categories: base.categories },
    { links: [{ ...base.links[0], title: '云端标题', updatedAt: 30 }], categories: base.categories },
  );
  assert.equal(conflict.data.links[0].title, '云端标题');
  assert.equal(conflict.conflicts, 1);
});

test('keeps additions from both sides and merges categories by id', () => {
  const result = mergeThreeWay(
    base,
    { links: [...base.links, { id: 'local', title: '本地新增', url: 'https://local.example', categoryId: 'common', createdAt: 2 }], categories: [...base.categories, { id: 'local-cat', name: '本地', icon: 'Folder' }] },
    { links: [...base.links, { id: 'cloud', title: '云端新增', url: 'https://cloud.example', categoryId: 'common', createdAt: 3 }], categories: [...base.categories, { id: 'cloud-cat', name: '云端', icon: 'Folder' }] },
  );
  assert.deepEqual(result.data.links.map(link => link.id).sort(), ['1', 'cloud', 'local']);
  assert.deepEqual(result.data.categories.map(category => category.id).sort(), ['cloud-cat', 'common', 'local-cat']);
});
