module.exports = async (page, assert, lang) => {
  await page.fill('#text-left','Hello\nworld'); await page.fill('#text-right','hello\nworld');
  await page.check('#opt-ignore-case');
  await page.waitForFunction(() => document.querySelector('#diff-stats').textContent.endsWith('0'));
  assert.match(await page.textContent('#diff-summary'), lang === 'en' ? /Identical/ : /完全一致/);
  await page.uncheck('#opt-ignore-case');
  assert.doesNotMatch(await page.textContent('#diff-stats'), /: 0$/);
  await page.click('[data-view="unified"]');
  assert.match(await page.textContent('#diff-unified-content'), /hello/);
  await page.fill('#text-left',''); await page.fill('#text-right','added');
  await page.waitForFunction(() => document.querySelector('#added-count').textContent === '1' && document.querySelector('#removed-count').textContent === '0');
  assert.equal(await page.textContent('#removed-count'),'0');
  await page.fill('#text-left', 'a\n'.repeat(2100)); await page.fill('#text-right','b\n'.repeat(2100));
  await page.waitForFunction(() => /too large|过大/.test(document.querySelector('#diff-summary').textContent));
  await page.click('[onclick="clearAll()"]');
  assert.equal(await page.textContent('#lines-left'),lang === 'en' ? '0 lines' : '0 行');
};
