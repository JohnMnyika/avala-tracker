async function getProjects() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_PROJECTS' });
  return res?.projects || {};
}

function renderProjects(projects) {
  const list = document.getElementById('projectList');
  list.innerHTML = '';
  const keys = Object.keys(projects).sort();
  if (!keys.length) {
    list.textContent = 'No projects stored.';
    return;
  }
  for (const k of keys) {
    const p = projects[k];
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <label><input type="checkbox" data-key="${k}"> <strong>${escapeHtml(p.title || k)}</strong> <small>(${escapeHtml(p.dataset||'')})</small></label>
      <div><small>Sequences: ${escapeHtml((p.sequences||[]).join(', '))}</small></div>
      <div><small>URL: <a href="${escapeHtml(p.url||'')}" target="_blank">link</a></small></div>
    `;
    list.appendChild(div);
  }
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function refresh() {
  document.getElementById('projectList').textContent = 'Loading…';
  const projects = await getProjects();
  renderProjects(projects);
}

async function getSelectedKeys(){
  const boxes = Array.from(document.querySelectorAll('input[type=checkbox][data-key]'));
  return boxes.filter(b=>b.checked).map(b=>b.getAttribute('data-key'));
}

async function mergeSelected(){
  const keys = await getSelectedKeys();
  if (keys.length < 2) { alert('Select at least two projects to merge.'); return; }
  const target = prompt('Enter key to merge into (dataset key), or leave blank to use first selected:');
  const resp = await chrome.runtime.sendMessage({ type: 'MERGE_PROJECTS', keys, targetKey: (target && target.trim()) || undefined });
  if (resp?.ok) { alert('Merged.'); await refresh(); }
}

async function deleteSelected(){
  const keys = await getSelectedKeys();
  if (!keys.length) { alert('Select projects to delete.'); return; }
  if (!confirm(`Delete ${keys.length} projects?`)) return;
  for (const k of keys) {
    await chrome.runtime.sendMessage({ type: 'DELETE_PROJECT', key: k });
  }
  await refresh();
}

document.getElementById('mergeBtn').addEventListener('click', mergeSelected);
document.getElementById('deleteBtn').addEventListener('click', deleteSelected);
document.getElementById('refreshBtn').addEventListener('click', refresh);

refresh();
