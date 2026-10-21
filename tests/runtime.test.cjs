const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/diff.js'), 'utf8'), context);
test('ignore options actually suppress differences', () => {
  assert.equal(context.computeDiff(['HELLO'], ['hello'], {ignoreCase:true})[0].type, 'equal');
  assert.equal(context.computeDiff(['  a   b '], ['a b'], {ignoreWhitespace:true})[0].type, 'equal');
});
test('insertions, deletions and repeated lines preserve content', () => {
  const a = ['a', 'b', 'a'], b = ['b', 'a', 'c'];
  const ops = context.computeDiff(a, b);
  assert.deepEqual(Array.from(ops.filter(o => o.type !== 'insert'), o => o.oldText), a);
  assert.deepEqual(Array.from(ops.filter(o => o.type !== 'delete'), o => o.newText), b);
  assert.equal(context.computeDiff([], ['a'])[0].type, 'insert');
});
test('quadratic allocation is bounded before allocating', () => {
  assert.throws(() => context.computeDiff(Array(3000).fill('a'), Array(3000).fill('b')), /DIFF_TOO_LARGE/);
});
test('changed lines are paired for word highlighting', () => {
  const ops = context.computeDiff(['hello old'], ['hello new']);
  assert.equal(ops.length, 1); assert.equal(ops[0].type, 'replace');
  assert.equal(context.wordDiff(ops[0].oldText, ops[0].newText).left.at(-1).type, 'remove');
});
