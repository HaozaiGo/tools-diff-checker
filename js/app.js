/* === Diff Checker - App Logic === */

function uiText(en, zh) {
  return document.documentElement.lang.startsWith('zh') ? zh : en;
}

document.addEventListener('DOMContentLoaded', () => {
  initViewTabs();
  initAutoDiff();
});

/* ---- State ---- */
let currentView = 'side';

/* ---- View Tabs ---- */
function initViewTabs() {
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
    t.tabIndex = t.dataset.view === view ? 0 : -1;
  });
  document.getElementById('diff-side').style.display = view === 'side' ? 'flex' : 'none';
  document.getElementById('diff-unified').style.display = view === 'unified' ? 'block' : 'none';
  runDiff();
}

/* ---- Auto Diff ---- */
function initAutoDiff() {
  ['text-left', 'text-right'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      updateLineCounts();
      scheduleDiff();
    });
  });
}

function updateLineCounts() {
  const left = document.getElementById('text-left').value;
  const right = document.getElementById('text-right').value;
  document.getElementById('lines-left').textContent = (left ? left.split('\n').length : 0) + uiText(' lines', ' 行');
  document.getElementById('lines-right').textContent = (right ? right.split('\n').length : 0) + uiText(' lines', ' 行');
}

/* ---- Debounced Diff ---- */
let diffTimer;
function scheduleDiff() {
  clearTimeout(diffTimer);
  diffTimer = setTimeout(runDiff, 200);
}

/* ---- Run Diff ---- */
function runDiff() {
  const leftText = document.getElementById('text-left').value;
  const rightText = document.getElementById('text-right').value;
  const ignoreCase = document.getElementById('opt-ignore-case').checked;
  const ignoreWhitespace = document.getElementById('opt-ignore-whitespace').checked;
  const showWordDiff = document.getElementById('opt-word-diff').checked;

  if (!leftText && !rightText) {
    resetDiff();
    return;
  }

  const leftLines = leftText ? leftText.split('\n') : [];
  const rightLines = rightText ? rightText.split('\n') : [];

  try {
    if (leftText.length + rightText.length > 1000000) throw new RangeError('DIFF_TOO_LARGE');
    const ops = computeDiff(leftLines, rightLines, { ignoreCase, ignoreWhitespace });
    renderSideBySide(ops, showWordDiff);
    renderUnified(ops, showWordDiff);
    renderSummary(ops);
  } catch (error) {
    resetDiff();
    document.getElementById('diff-summary').textContent = uiText('Input too large to compare. Use smaller text blocks.', '输入过大，请分段对比。');
  }
}

/* ---- Render Side-by-Side ---- */
function renderSideBySide(ops, showWordDiff) {
  let leftHtml = '', rightHtml = '';
  let added = 0, removed = 0, changed = 0;

  for (const op of ops) {
    const { leftLine, rightLine } = renderDiffLine(op, 0, showWordDiff);
    leftHtml += leftLine;
    rightHtml += rightLine;

    if (op.type === 'insert') added++;
    else if (op.type === 'delete') removed++;
    else if (op.type === 'replace') { changed++; added++; removed++; }
  }

  document.getElementById('diff-left').innerHTML = leftHtml;
  document.getElementById('diff-right').innerHTML = rightHtml;
  document.getElementById('added-count').textContent = added;
  document.getElementById('removed-count').textContent = removed;
}

/* ---- Render Unified ---- */
function renderUnified(ops, showWordDiff) {
  let html = '';
  let total = 0;

  for (const op of ops) {
    if (op.type !== 'equal') {
      html += renderUnifiedLine(op, showWordDiff);
      total++;
    }
  }

  if (!html) {
    html = '<div class="diff-line">' + uiText('Texts are identical', '文本完全一致，没有差异') + '</div>';
  }

  document.getElementById('diff-unified-content').innerHTML = html;
  document.getElementById('unified-count').textContent = total;
}

/* ---- Summary ---- */
function renderSummary(ops) {
  const summary = document.getElementById('diff-summary');
  
  if (ops.length === 0) {
    summary.innerHTML = '<span class="placeholder-text">在左右两侧输入文本，差异将自动对比</span>';
    return;
  }

  let equal = 0, added = 0, removed = 0, changed = 0;
  for (const op of ops) {
    if (op.type === 'equal') equal++;
    else if (op.type === 'insert') added++;
    else if (op.type === 'delete') removed++;
    else if (op.type === 'replace') changed++;
  }

  const total = added + removed + changed;
  document.getElementById('diff-stats').textContent = uiText('Diffs: ', '差异: ') + total;

  if (total === 0) {
    summary.textContent = uiText(`Identical: ${equal} matching lines`, `完全一致: ${equal} 行相同`);
    return;
  }

  let msg = `<strong>${total} ${uiText('differences', '处差异')}</strong>: `;
  if (added > 0) msg += `<span style="color:var(--success)">+${added} ${uiText('added', '新增')}</span> `;
  if (removed > 0) msg += `<span style="color:var(--error)">-${removed} ${uiText('removed', '删除')}</span> `;
  if (changed > 0) msg += `<span style="color:var(--warning)">~${changed} ${uiText('changed', '修改')}</span> `;
  msg += uiText(`· ${equal} matching lines`, `· ${equal} 行相同`);

  summary.innerHTML = msg;
}

/* ---- Reset ---- */
function resetDiff() {
  document.getElementById('diff-left').innerHTML = '';
  document.getElementById('diff-right').innerHTML = '';
  document.getElementById('diff-unified-content').innerHTML = '';
  document.getElementById('added-count').textContent = '0';
  document.getElementById('removed-count').textContent = '0';
  document.getElementById('unified-count').textContent = '0';
  document.getElementById('diff-stats').textContent = uiText('Diffs: 0', '差异: 0');
  document.getElementById('diff-summary').textContent = uiText('Enter text on both sides to compare', '在左右两侧输入文本，差异将自动对比');
}

/* ---- Actions ---- */
function swapInputs() {
  const left = document.getElementById('text-left');
  const right = document.getElementById('text-right');
  const tmp = left.value;
  left.value = right.value;
  right.value = tmp;
  updateLineCounts();
  runDiff();
}

function clearAll() {
  document.getElementById('text-left').value = '';
  document.getElementById('text-right').value = '';
  updateLineCounts();
  runDiff();
}

function toggleWrap() {
  const wrap = document.getElementById('opt-wrap').checked;
  document.querySelectorAll('.diff-content').forEach(el => {
    el.style.whiteSpace = wrap ? '' : 'pre';
  });
}

/* ---- Sample Data ---- */
function loadSamples() {
  document.getElementById('text-left').value = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["Alice", "Bob", "Charlie"];

for (const user of users) {
  greet(user);
}

// This is a comment
const PI = 3.14159;

function calculateArea(radius) {
  return PI * radius * radius;
}

console.log("Done!");`;

  document.getElementById('text-right').value = `function greet(name, title) {
  console.log("Hello, " + title + " " + name);
  return true;
}

const users = ["Alice", "Bob", "Charlie", "Diana"];

for (const user of users) {
  greet(user, "Mr.");
}

// Updated calculation
const PI = 3.1415926535;

function calculateArea(radius) {
  return PI * radius * radius;
}

function calculateCircumference(radius) {
  return 2 * PI * radius;
}

console.log("All calculations done!");`;

  updateLineCounts();
  runDiff();
  showToast(uiText('Sample loaded', '已加载示例数据'));
}

/* ---- Toast ---- */
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}
