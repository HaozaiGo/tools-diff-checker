/* === Diff Engine - LCS-based line diff and word diff === */

/**
 * Compute the longest common subsequence of two arrays.
 * Returns the LCS indices from 'a' that are preserved in 'b'.
 */
function lcsIndices(a, b) {
  const m = a.length, n = b.length;
  // Use a single-row approach for the DP table
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find common indices
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(i - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

/**
 * Main diff function.
 * Returns an array of operations: { type: 'equal'|'insert'|'delete'|'replace', leftLine, rightLine, oldText, newText }
 */
function computeDiff(leftLines, rightLines, options = {}) {
  const { ignoreCase = false, ignoreWhitespace = false } = options;

  // Normalize for comparison
  const normalize = (s) => {
    let r = s;
    if (ignoreCase) r = r.toLowerCase();
    if (ignoreWhitespace) r = r.replace(/\s+/g, ' ').trim();
    return r;
  };

  const a = leftLines.map(normalize);
  const b = rightLines.map(normalize);

  const common = lcsIndices(a, b);
  const commonSet = new Set(common);

  const ops = [];
  let li = 0, ri = 0;

  for (const ci of common) {
    // Lines deleted from left before this common line
    while (li < ci) {
      ops.push({ type: 'delete', leftLine: li, rightLine: -1, oldText: leftLines[li], newText: '' });
      li++;
    }
    // Lines inserted in right before this common line
    while (ri < b.length && normalize(b[ri]) !== a[ci]) {
      ops.push({ type: 'insert', leftLine: -1, rightLine: ri, oldText: '', newText: rightLines[ri] });
      ri++;
    }
    // Equal line
    if (leftLines[ci] === rightLines[ri]) {
      ops.push({ type: 'equal', leftLine: ci, rightLine: ri, oldText: leftLines[ci], newText: rightLines[ri] });
    } else {
      // Content changed but normalized matches - word-level diff needed
      ops.push({ type: 'replace', leftLine: ci, rightLine: ri, oldText: leftLines[ci], newText: rightLines[ri] });
    }
    li = ci + 1;
    ri++;
  }

  // Remaining deletes
  while (li < leftLines.length) {
    ops.push({ type: 'delete', leftLine: li, rightLine: -1, oldText: leftLines[li], newText: '' });
    li++;
  }
  // Remaining inserts
  while (ri < rightLines.length) {
    ops.push({ type: 'insert', leftLine: -1, rightLine: ri, oldText: '', newText: rightLines[ri] });
    ri++;
  }

  return ops;
}

/**
 * Word-level diff for changed lines.
 * Returns left and right arrays with { text, type: 'same'|'add'|'remove' } markers.
 */
function wordDiff(oldText, newText) {
  if (!oldText || !newText) {
    return {
      left: oldText ? [{ text: oldText, type: 'remove' }] : [],
      right: newText ? [{ text: newText, type: 'add' }] : []
    };
  }

  // Tokenize into words (including whitespace)
  const tokenize = (s) => s.split(/(\s+)/).filter(Boolean);
  const leftWords = tokenize(oldText);
  const rightWords = tokenize(newText);

  const common = lcsIndices(leftWords, rightWords);
  const commonSet = new Set(common);

  const leftResult = [];
  const rightResult = [];

  let li = 0, ri = 0;
  for (const ci of common) {
    while (li < ci) {
      leftResult.push({ text: leftWords[li], type: 'remove' });
      li++;
    }
    while (ri < rightWords.length && rightWords[ri] !== leftWords[ci]) {
      rightResult.push({ text: rightWords[ri], type: 'add' });
      ri++;
    }
    leftResult.push({ text: leftWords[ci], type: 'same' });
    rightResult.push({ text: rightWords[ci], type: 'same' });
    li = ci + 1;
    ri++;
  }
  while (li < leftWords.length) {
    leftResult.push({ text: leftWords[li], type: 'remove' });
    li++;
  }
  while (ri < rightWords.length) {
    rightResult.push({ text: rightWords[ri], type: 'add' });
    ri++;
  }

  return { left: leftResult, right: rightResult };
}

/**
 * Generate HTML for a single diff line.
 */
function renderDiffLine(op, idx, showWordDiff) {
  let lineClass, lineNumLeft = '', lineNumRight = '';

  switch (op.type) {
    case 'equal':
      lineClass = 'line-unchanged';
      lineNumLeft = op.leftLine + 1;
      lineNumRight = op.rightLine + 1;
      break;
    case 'delete':
      lineClass = 'line-removed';
      lineNumLeft = op.leftLine + 1;
      lineNumRight = '';
      break;
    case 'insert':
      lineClass = 'line-added';
      lineNumLeft = '';
      lineNumRight = op.rightLine + 1;
      break;
    case 'replace':
      lineClass = 'line-changed-left';
      lineNumLeft = op.leftLine + 1;
      lineNumRight = op.rightLine + 1;
      break;
  }

  let contentLeft = escapeHtml(op.oldText || '');
  let contentRight = escapeHtml(op.newText || '');

  // Word-level diff for replacements
  if (showWordDiff && op.type === 'replace' && op.oldText && op.newText) {
    const wd = wordDiff(op.oldText, op.newText);
    contentLeft = wd.left.map(w => 
      w.type === 'same' ? escapeHtml(w.text) : `<span class="word-removed">${escapeHtml(w.text)}</span>`
    ).join('');
    contentRight = wd.right.map(w => 
      w.type === 'same' ? escapeHtml(w.text) : `<span class="word-added">${escapeHtml(w.text)}</span>`
    ).join('');
  }

  const leftLine = `<div class="diff-line ${op.type === 'insert' ? 'line-context' : lineClass}">
    <span class="diff-line-num">${op.type !== 'insert' ? lineNumLeft : ''}</span>
    <span class="diff-line-content">${op.type === 'insert' ? '⏎' : contentLeft}</span>
  </div>`;

  const rightLine = `<div class="diff-line ${op.type === 'delete' ? 'line-context' : (op.type === 'replace' ? 'line-changed-right' : lineClass)}">
    <span class="diff-line-num">${op.type !== 'delete' ? lineNumRight : ''}</span>
    <span class="diff-line-content">${op.type === 'delete' ? '⏎' : contentRight}</span>
  </div>`;

  return { leftLine, rightLine };
}

/**
 * Render unified view line.
 */
function renderUnifiedLine(op, showWordDiff) {
  let prefix, lineClass, lineNum;

  switch (op.type) {
    case 'equal':
      prefix = ' '; lineClass = 'line-unchanged'; lineNum = op.leftLine + 1; break;
    case 'delete':
      prefix = '<span style="color:var(--error)">−</span>'; lineClass = 'line-removed'; lineNum = op.leftLine + 1; break;
    case 'insert':
      prefix = '<span style="color:var(--success)">+</span>'; lineClass = 'line-added'; lineNum = op.rightLine + 1; break;
    case 'replace':
      prefix = '<span style="color:var(--warning)">~</span>'; lineClass = 'line-changed-left'; lineNum = '';
      break;
  }

  if (op.type === 'replace') {
    // Show old line then new line
    let oldContent = escapeHtml(op.oldText || '');
    let newContent = escapeHtml(op.newText || '');
    if (showWordDiff) {
      const wd = wordDiff(op.oldText || '', op.newText || '');
      oldContent = wd.left.map(w => 
        w.type === 'same' ? escapeHtml(w.text) : `<span class="word-removed">${escapeHtml(w.text)}</span>`
      ).join('');
      newContent = wd.right.map(w => 
        w.type === 'same' ? escapeHtml(w.text) : `<span class="word-added">${escapeHtml(w.text)}</span>`
      ).join('');
    }
    return `<div class="diff-line line-removed"><span class="diff-line-num"></span><span class="diff-line-content">${prefix} ${oldContent}</span></div>
<div class="diff-line line-added"><span class="diff-line-num"></span><span class="diff-line-content">${prefix.replace('−', '+')} ${newContent}</span></div>`;
  }

  const text = op.type === 'delete' ? escapeHtml(op.oldText || '') : 
               op.type === 'insert' ? escapeHtml(op.newText || '') : 
               escapeHtml(op.oldText || '');
  return `<div class="diff-line ${lineClass}"><span class="diff-line-num">${lineNum || ''}</span><span class="diff-line-content">${prefix} ${text}</span></div>`;
}

/* ---- Helpers ---- */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
