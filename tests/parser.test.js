const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../avalaParser.js');

test('parses 2D annotation datasets from Avala URLs', () => {
  const parsed = parser.parseAvalaUrl('https://avala.ai/datasets/v1-batch-000l8-sf-bev/sequences/62a248b0-111a-487e-92ed-9cd68de26e3b?work_unit_uid=4418e138-8b3a-4475-a15d-12e1c82a2721');

  assert.ok(parsed);
  assert.equal(parsed.projectType, '2D Annotation');
  assert.equal(parsed.dataset, 'v1-batch-000l8-sf-bev');
  assert.equal(parsed.sequenceId, '62a248b0-111a-487e-92ed-9cd68de26e3b');
  assert.equal(parsed.workUnitUid, '4418e138-8b3a-4475-a15d-12e1c82a2721');
});

test('parses burro segmentation slice items from Avala URLs', () => {
  const parsed = parser.parseAvalaUrl('https://avala.ai/@burro/slices/20260402t103311-0400-label/items/76f27c64-cf81-4781-a19a-7b013df28e2e');

  assert.ok(parsed);
  assert.equal(parsed.projectType, 'Burro Segmentation');
  assert.equal(parsed.slice, '20260402t103311-0400-label');
  assert.equal(parsed.itemId, '76f27c64-cf81-4781-a19a-7b013df28e2e');
});

test('parses copied work-unit links and uses the batch name from the Avala title', () => {
  const parsed = parser.parseAvalaUrl(
    'https://avala.ai/wu/1f33250a-cb88-459f-96cb-c77d544a3485',
    undefined,
    { title: '8d8e64 · v1-batch-000ry-sf-bev' }
  );

  assert.ok(parsed);
  assert.equal(parsed.workUnitUid, '1f33250a-cb88-459f-96cb-c77d544a3485');
  assert.equal(parsed.dataset, 'v1-batch-000ry-sf-bev');
  assert.equal(parsed.id, '1f33250a-cb88-459f-96cb-c77d544a3485');
});
