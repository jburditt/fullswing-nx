import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectName } from '../src/index.js';

test('getProjectName should identify the project', () => {
  assert.equal(getProjectName(), 'fullswing-cms');
});
