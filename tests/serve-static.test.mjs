import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveSafe } from '../tools/serve-static.mjs';

const root = path.resolve('some', 'root');

test('đường dẫn hợp lệ nằm trong root', () => {
  const p = resolveSafe(root, '/js/a.js');
  assert.equal(p, path.join(root, 'js', 'a.js'));
  assert.ok(p.startsWith(root + path.sep));
});

test('thoát khỏi root bị từ chối', () => {
  assert.equal(resolveSafe(root, '/../package.json'), null);
  assert.equal(resolveSafe(root, '/%2e%2e/package.json'), null);
  assert.equal(resolveSafe(root, '/%2E%2E/package.json'), null);
  assert.equal(resolveSafe(root, '/a/..%2f..%2fpackage.json'), null);
});

test('ký tự NUL bị từ chối', () => {
  assert.equal(resolveSafe(root, '/js/a.js\0.png'), null);
  assert.equal(resolveSafe(root, '/js/a.js%00.png'), null);
});

test('mã hóa phần trăm sai bị từ chối', () => {
  assert.equal(resolveSafe(root, '/%E0%A4%A'), null);
});

test('"/" không liệt kê thư mục', () => {
  assert.equal(resolveSafe(root, '/'), null);
});
