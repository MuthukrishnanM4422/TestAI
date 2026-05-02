// State
let testCases = [];
let currentTab = 'input';

// DOM Elements
const fileInput = document.getElementById('fileUpload');
const uploadZone = document.getElementById('uploadZone');
const brdTextarea = document.getElementById('brdText');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const progressBox = document.getElementById('progressBox');
const progressBar = document.getElementById('progressBar');
const errorBox = document.getElementById('errorBox');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const statsRow = document.getElementById('statsRow');
const filterCount = document.getElementById('filterCount');
const resultCountBadge = document.getElementById('result-count-badge');
const resultsTabBtn = document.getElementById('results-tab-btn');

// 🔴 SMART API URL - Works on both local and Render
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api/generate'
  : window.location.origin + '/api/generate';

console.log('Using API URL:', API_URL);

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Toggle test type cards
document.querySelectorAll('.type-card').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    card.classList.toggle('active');
  });
});

// File upload
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  uploadZone.classList.add('has-file');
  try {
    let text = '';
    if (file.name.endsWith('.txt')) text = await readFileAsText(file);
    else if (file.name.endsWith('.pdf')) text = await extractPdfText(file);
    else if (file.name.endsWith('.docx')) text = await extractDocxText(file);
    else { alert('Unsupported file. Use .txt, .pdf, or .docx'); return; }
    brdTextarea.value = text.trim();
    updateCharCount();
  } catch (err) { alert('Error reading file: ' + err.message); }
});

// Drag and drop
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.style.borderColor = 'var(--accent)'; });
uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  fileInput.files = e.dataTransfer.files;
  fileInput.dispatchEvent(new Event('change'));
});

// Character count
brdTextarea.addEventListener('input', updateCharCount);
function updateCharCount() { charCount.textContent = brdTextarea.value.length + ' characters'; }

// File readers
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return fullText;
}
async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Tab switching
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('tab-input').style.display = tab === 'input' ? 'block' : 'none';
  document.getElementById('tab-results').style.display = tab === 'results' ? 'block' : 'none';
}

// Progress animation
function updateProgress(step, percent) {
  progressBar.style.width = percent + '%';
  document.getElementById('step-parse').className = 'p-step' + (step >= 1 ? ' done' : step === 0 ? ' active' : '');
  document.getElementById('step-generate').className = 'p-step' + (step >= 2 ? ' done' : step === 1 ? ' active' : '');
  document.getElementById('step-format').className = 'p-step' + (step >= 3 ? ' done' : step === 2 ? ' active' : '');
}

// Main generate function
async function generateTestCases() {
  const brdText = brdTextarea.value.trim();
  if (!brdText) { showError('Please enter or upload requirements.'); return; }

  const posCard = document.querySelector('[data-type="positive"]');
  const negCard = document.querySelector('[data-type="negative"]');
  const posCases = posCard.classList.contains('active') ? parseInt(document.getElementById('posCases').value) || 3 : 0;
  const negCases = negCard.classList.contains('active') ? parseInt(document.getElementById('negCases').value) || 3 : 0;

  if (posCases + negCases === 0) { showError('Select at least one test case type.'); return; }

  // UI state
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="btn-spinner"></span> Generating...';
  progressBox.style.display = 'block';
  errorBox.style.display = 'none';
  updateProgress(0, 10);

  const prompt = `You are a senior QA engineer. Generate test cases based on these requirements:

"""
${brdText}
"""

Create exactly ${posCases} POSITIVE and ${negCases} NEGATIVE test cases.
Return ONLY a JSON array. Format:
[
  {
    "id": "TC-P01",
    "type": "Positive",
    "scenario": "short description",
    "testData": "inputs/preconditions",
    "expectedOutcome": "expected result",
    "comments": "notes"
  }
]
Use IDs: TC-P01.. for positive, TC-N01.. for negative. NO extra text.`;

  try {
    updateProgress(1, 35);
    
    // 🔴 USING SMART API URL HERE
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
    });
    
    updateProgress(2, 70);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API request failed');
    
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid JSON in response');
    
    testCases = JSON.parse(jsonMatch[0]);
    updateProgress(3, 100);
    
    setTimeout(() => {
      displayResults(testCases);
      progressBox.style.display = 'none';
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<span>✨ Generate Test Cases</span>';
      updateProgress(0, 0);
    }, 500);
  } catch (error) {
    showError(error.message);
    progressBox.style.display = 'none';
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>✨ Generate Test Cases</span>';
  }
}

// Display results
function displayResults(cases) {
  const posCount = cases.filter(t => t.type === 'Positive').length;
  const negCount = cases.filter(t => t.type === 'Negative').length;
  
  statsRow.innerHTML = `
    <div class="stat-card" style="--stat-color: var(--accent);"><div class="stat-val">${cases.length}</div><div class="stat-label">Total TCs</div></div>
    <div class="stat-card" style="--stat-color: var(--green);"><div class="stat-val">${posCount}</div><div class="stat-label">Positive</div></div>
    <div class="stat-card" style="--stat-color: var(--red);"><div class="stat-val">${negCount}</div><div class="stat-label">Negative</div></div>
  `;

  resultCountBadge.textContent = cases.length;
  resultCountBadge.style.display = 'inline';
  resultsTabBtn.disabled = false;
  emptyState.style.display = 'none';
  document.querySelector('.table-scroll').style.display = 'block';
  document.querySelector('.table-hint').style.display = 'block';
  filterCount.textContent = `Showing ${cases.length} of ${cases.length}`;

  renderTable(cases);
  switchTab('results');
}

// Render table
function renderTable(cases) {
  tableBody.innerHTML = cases.map((tc, idx) => {
    const badgeColor = tc.type === 'Positive' ? 'var(--green)' : 'var(--red)';
    return `
      <tr data-index="${idx}">
        <td><span class="id-chip">${escapeHtml(tc.id)}</span></td>
        <td><span class="type-badge" style="color:${badgeColor};border-color:${badgeColor}33;background:${badgeColor}11;">${tc.type}</span></td>
        <td class="editable" data-field="scenario">${escapeHtml(tc.scenario)}</td>
        <td class="editable" data-field="testData">${escapeHtml(tc.testData)}</td>
        <td class="editable" data-field="expectedOutcome">${escapeHtml(tc.expectedOutcome)}</td>
        <td class="editable" data-field="comments">${escapeHtml(tc.comments)}</td>
        <td><button class="expand-row-btn" onclick="toggleExpand(${idx})">↗</button></td>
      </tr>`;
  }).join('');

  // Make cells editable
  document.querySelectorAll('.editable').forEach(cell => {
    cell.addEventListener('dblclick', function() {
      const current = this.textContent;
      const input = document.createElement('input');
      input.value = current;
      input.className = 'cell-edit-input';
      input.addEventListener('blur', function() {
        const rowIdx = this.closest('tr').dataset.index;
        const field = this.parentElement.dataset.field;
        testCases[rowIdx][field] = this.value;
        this.parentElement.textContent = this.value;
      });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') this.blur(); });
      this.textContent = '';
      this.appendChild(input);
      input.focus();
    });
  });
}

// Expand row
function toggleExpand(idx) {
  const existing = document.querySelector('.expand-panel');
  if (existing) existing.remove();
  
  const tc = testCases[idx];
  const panel = document.createElement('div');
  panel.className = 'expand-panel';
  panel.innerHTML = `
    <div class="expand-header">
      <span>${tc.id} — Details</span>
      <button class="expand-close" onclick="this.closest('.expand-panel').remove()">✕</button>
    </div>
    <div class="expand-grid">
      <div><div class="expand-section-label">Test Data</div><div class="expand-body">${escapeHtml(tc.testData)}</div></div>
      <div><div class="expand-section-label">Expected Outcome</div><div class="expand-body">${escapeHtml(tc.expectedOutcome)}</div></div>
    </div>
    <div class="expand-footer">
      <span class="expand-meta">Type: ${tc.type} | ID: ${tc.id}</span>
      <button class="del-btn" onclick="deleteTestCase(${idx})">🗑 Delete</button>
    </div>
  `;
  const row = document.querySelector(`tr[data-index="${idx}"]`);
  row.after(panel);
}

// Delete test case
function deleteTestCase(idx) {
  testCases.splice(idx, 1);
  if (testCases.length === 0) {
    emptyState.style.display = 'block';
    document.querySelector('.table-scroll').style.display = 'none';
    document.querySelector('.table-hint').style.display = 'none';
    resultCountBadge.style.display = 'none';
    statsRow.innerHTML = '';
    filterCount.textContent = '';
  }
  renderTable(testCases);
  document.querySelector('.expand-panel')?.remove();
  updateStats();
}

function updateStats() {
  const posCount = testCases.filter(t => t.type === 'Positive').length;
  const negCount = testCases.filter(t => t.type === 'Negative').length;
  statsRow.innerHTML = statsRow.innerHTML.replace(/>\d+</, `>${testCases.length}<`).replace(/>\d+</, `>${posCount}<`).replace(/>\d+</, `>${negCount}<`);
  resultCountBadge.textContent = testCases.length;
  filterCount.textContent = `Showing ${testCases.length} of ${testCases.length}`;
}

// Search/Filter
function filterTable() {
  const term = document.getElementById('searchInput').value.toLowerCase();
  const filtered = testCases.filter(tc => 
    Object.values(tc).some(v => String(v).toLowerCase().includes(term))
  );
  renderTable(filtered);
  filterCount.textContent = term ? `Showing ${filtered.length} of ${testCases.length}` : `Showing ${testCases.length} of ${testCases.length}`;
}

// Export
function downloadCSV() {
  const header = ['ID','Type','Scenario','Test Data','Expected Outcome','Comments'];
  const rows = testCases.map(tc => [tc.id, tc.type, tc.scenario, tc.testData, tc.expectedOutcome, tc.comments]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, `test_cases_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
}
function downloadJSON() {
  downloadFile(JSON.stringify(testCases, null, 2), `test_cases_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
}
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Helpers
function showError(msg) {
  errorBox.textContent = '⚠️ ' + msg;
  errorBox.style.display = 'block';
  setTimeout(() => { errorBox.style.display = 'none'; }, 6000);
}
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
