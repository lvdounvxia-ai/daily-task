const state = {
  category: "text",
  rows: [],
  taskInstruction: "",
  rowIdSeq: 0,
  modelId: "",
  availableModels: [],
  isLoading: false,
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  categoryBadge: document.getElementById("categoryBadge"),
  batchCount: document.getElementById("batchCount"),
  batchMeta: document.getElementById("batchMeta"),
  taskSelect: document.getElementById("taskSelect"),
  inputText: document.getElementById("inputText"),
  sampleRows: document.getElementById("sampleRows"),
  btnAddRow: document.getElementById("btnAddRow"),
  btnSyncPrompts: document.getElementById("btnSyncPrompts"),
  runEval: document.getElementById("runEval"),
  btnRun: document.getElementById("btnRun"),
  btnReloadConfig: document.getElementById("btnReloadConfig"),
};

const CATEGORY_LABEL = { text: "文本生成", image: "图片生成", video: "视频生成" };

function newRow(prompt = "") {
  return {
    id: ++state.rowIdSeq,
    prompt,
    imageFile: null,
    previewUrl: null,
    textFile: null,
    result: null,
  };
}

function initRows() {
  state.rows = [newRow()];
  renderRows();
  updateBatchCount();
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function getReadyRows() {
  return state.rows.filter(r => r.imageFile);
}

function updateBatchCount() {
  const ready = getReadyRows().length;
  const total = state.rows.length;
  els.batchCount.textContent = `${ready} 条就绪 / 共 ${total} 行`;
  updatePromptSyncButton();
}

function updatePromptSyncButton() {
  if (!els.btnSyncPrompts) return;
  const show = state.category === "text";
  els.btnSyncPrompts.classList.toggle("hidden", !show);
  if (show) {
    els.btnSyncPrompts.disabled = state.rows.length <= 1;
  }
}

function modelOptionsHtml(selectedId) {
  if (!state.availableModels.length) {
    return `<option value="">暂无可用模型</option>`;
  }
  return state.availableModels.map(m => {
    const label = m.display_name && m.display_name !== m.id
      ? `${m.display_name} · ${m.model}`
      : `${m.id} (${m.model})`;
    const sel = m.id === selectedId ? " selected" : "";
    return `<option value="${m.id}"${sel}>${escapeHtml(label)}</option>`;
  }).join("");
}

function setModelId(modelId) {
  state.modelId = modelId;
  els.sampleRows.querySelectorAll("[data-model-select]").forEach(sel => {
    if (sel.value !== modelId) sel.value = modelId;
  });
}

async function loadOptions() {
  const [models, tasks] = await Promise.all([
    fetchJSON(`/api/models?category=${state.category}`),
    fetchJSON(`/api/tasks?category=${state.category}`),
  ]);

  state.availableModels = models.models || [];
  if (!state.modelId && state.availableModels[0]) {
    state.modelId = state.availableModels[0].id;
  } else if (state.modelId && !state.availableModels.some(m => m.id === state.modelId)) {
    state.modelId = state.availableModels[0]?.id || "";
  }

  els.taskSelect.innerHTML = tasks.tasks.length
    ? tasks.tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join("")
    : `<option value="">暂无任务</option>`;

  const current = tasks.tasks.find(t => t.id === els.taskSelect.value) || tasks.tasks[0];
  state.taskInstruction = current?.instruction || "";
  state.rows.forEach(row => {
    if (!row.prompt.trim() && state.taskInstruction) {
      row.prompt = state.taskInstruction;
    }
  });
  renderRows();
  updateBatchCount();
}

function switchCategory(category) {
  state.category = category;
  state.modelId = "";
  state.rows.forEach(r => { r.result = null; });
  els.tabs.forEach(t => t.classList.toggle("active", t.dataset.category === category));
  els.categoryBadge.textContent = CATEGORY_LABEL[category] || category;
  els.batchMeta.classList.add("hidden");
  initRows();
  loadOptions();
}

function addRow() {
  state.rows.push(newRow(state.taskInstruction));
  renderRows();
  updateBatchCount();
}

function removeRow(rowId) {
  if (state.rows.length <= 1) return;
  const row = state.rows.find(r => r.id === rowId);
  if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
  state.rows = state.rows.filter(r => r.id !== rowId);
  renderRows();
  updateBatchCount();
}

function setRowPrompt(rowId, value) {
  const row = state.rows.find(r => r.id === rowId);
  if (row) {
    row.prompt = value;
    row.result = null;
  }
  updateBatchCount();
}

function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function syncPromptsFromFirst() {
  if (state.category !== "text" || state.rows.length <= 1) return;
  const firstPrompt = state.rows[0]?.prompt || "";
  state.rows.forEach((row, idx) => {
    if (idx === 0) return;
    row.prompt = firstPrompt;
    row.result = null;
  });
  renderRows();
  updateBatchCount();
}

function setRowImage(rowId, file) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row || !file) return;
  if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
  row.imageFile = file;
  row.previewUrl = URL.createObjectURL(file);
  row.result = null;
  renderRows();
  updateBatchCount();
}

function clearRowImage(rowId) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
  row.imageFile = null;
  row.previewUrl = null;
  row.result = null;
  renderRows();
  updateBatchCount();
}

function setRowTextFile(rowId, file) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row || !file) return;
  row.textFile = file;
  row.result = null;
  renderRows();
  updateBatchCount();
}

function clearRowTextFile(rowId) {
  const row = state.rows.find(r => r.id === rowId);
  if (!row) return;
  row.textFile = null;
  row.result = null;
  renderRows();
  updateBatchCount();
}

function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
}

function isTextFile(file) {
  return file.type.startsWith("text/")
    || /\.(txt|md|json|csv|tsv|log|yaml|yml)$/i.test(file.name);
}

function renderResultCell(row) {
  if (state.isLoading && row.imageFile) {
    return `<div class="row-result loading"><div class="spinner small"></div><span>处理中...</span></div>`;
  }
  if (!row.result) {
    return `<div class="row-result empty"><span class="empty-icon-sm">📄</span><span>执行后显示结果</span></div>`;
  }
  const r = row.result;
  const score = r.eval?.score ?? "-";
  let body = "-";
  if (r.output_text) {
    body = escapeHtml(r.output_text);
  } else if (r.output_image_url) {
    body = `<img class="output-image" src="${escapeHtml(r.output_image_url)}" alt="output" />`;
  }
  const evalBlock = r.eval?.diagnosis
    ? `<div class="row-result-eval">${escapeHtml(r.eval.diagnosis)}</div>`
    : "";
  const statusCls = r.status === "ok" ? "ok" : "fail";
  return `
    <div class="row-result ${statusCls}">
      <div class="row-result-head">
        <span class="score-tag">${escapeHtml(String(score))}</span>
        ${r.error ? `<span class="row-result-err">失败</span>` : ""}
      </div>
      <div class="row-result-body">${body}</div>
      ${evalBlock}
      ${r.error ? `<div class="row-result-error">${escapeHtml(r.error)}</div>` : ""}
    </div>`;
}

function renderRows() {
  els.sampleRows.innerHTML = state.rows.map((row, idx) => {
    const hasImage = !!row.imageFile;
    const hasTextFile = !!row.textFile;
    const imagePart = hasImage
      ? `<div class="row-image-preview">
           <img src="${row.previewUrl}" alt="${escapeHtml(row.imageFile.name)}" />
           <button type="button" class="btn-clear-image" data-clear-image="${row.id}">更换</button>
         </div>`
      : `<div class="row-dropzone" data-dropzone="${row.id}">
           <span class="row-dropzone-icon">⬆</span>
           <span>点击或拖入</span>
           <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif" hidden data-file-input="${row.id}" />
         </div>`;
    const textFilePart = hasTextFile
      ? `<div class="row-text-file">
           <div class="row-text-file-summary">
             <div class="row-text-file-name">${escapeHtml(row.textFile.name)}</div>
             <div class="row-text-file-meta">${escapeHtml(formatFileSize(row.textFile.size))}</div>
             <div class="row-text-file-actions">
               <button type="button" class="btn-file-action" data-replace-text-file="${row.id}">更换</button>
               <button type="button" class="btn-file-action" data-clear-text-file="${row.id}">移除</button>
             </div>
           </div>
           <input type="file" accept=".txt,.md,.json,.csv,.tsv,.log,.yaml,.yml,text/*" hidden data-text-file-input="${row.id}" />
         </div>`
      : `<div class="row-text-file empty">
           <div class="row-dropzone" data-text-dropzone="${row.id}">
             <span class="row-dropzone-icon">TXT</span>
             <span>点击或拖入</span>
             <span>非必填</span>
             <input type="file" accept=".txt,.md,.json,.csv,.tsv,.log,.yaml,.yml,text/*" hidden data-text-file-input="${row.id}" />
           </div>
         </div>`;

    const removeBtn = state.rows.length > 1
      ? `<button type="button" class="btn-remove-row" data-remove-row="${row.id}" title="删除此行">×</button>`
      : `<span class="btn-remove-row placeholder"></span>`;

    return `
      <div class="sample-row" data-row-id="${row.id}">
        <div class="sample-row-index">${idx + 1}</div>
        <div class="sample-row-model">
          <select data-model-select data-row-id="${row.id}">${modelOptionsHtml(state.modelId)}</select>
        </div>
        <div class="sample-row-prompt">
          <textarea rows="4" placeholder="输入本条 Prompt..." data-prompt-input="${row.id}">${escapeHtml(row.prompt)}</textarea>
        </div>
        <div class="sample-row-image">${imagePart}</div>
        <div class="sample-row-text-file">${textFilePart}</div>
        <div class="sample-row-result">${renderResultCell(row)}</div>
        ${removeBtn}
      </div>`;
  }).join("");

  els.sampleRows.querySelectorAll("[data-model-select]").forEach(sel => {
    sel.addEventListener("change", e => setModelId(e.target.value));
  });

  els.sampleRows.querySelectorAll("[data-prompt-input]").forEach(el => {
    el.addEventListener("input", e => setRowPrompt(Number(el.dataset.promptInput), e.target.value));
  });

  els.sampleRows.querySelectorAll("[data-file-input]").forEach(input => {
    input.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (file && isImageFile(file)) setRowImage(Number(input.dataset.fileInput), file);
      e.target.value = "";
    });
  });

  els.sampleRows.querySelectorAll("[data-dropzone]").forEach(zone => {
    const rowId = Number(zone.dataset.dropzone);
    const input = zone.querySelector(`[data-file-input="${rowId}"]`);
    zone.addEventListener("click", () => input?.click());
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const file = [...e.dataTransfer.files].find(isImageFile);
      if (file) setRowImage(rowId, file);
    });
  });

  els.sampleRows.querySelectorAll("[data-text-file-input]").forEach(input => {
    input.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (file && isTextFile(file)) setRowTextFile(Number(input.dataset.textFileInput), file);
      e.target.value = "";
    });
  });

  els.sampleRows.querySelectorAll("[data-text-dropzone]").forEach(zone => {
    const rowId = Number(zone.dataset.textDropzone);
    const input = zone.querySelector(`[data-text-file-input="${rowId}"]`);
    zone.addEventListener("click", () => input?.click());
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const file = [...e.dataTransfer.files].find(isTextFile);
      if (file) setRowTextFile(rowId, file);
    });
  });

  els.sampleRows.querySelectorAll("[data-clear-image]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      clearRowImage(Number(btn.dataset.clearImage));
    });
  });

  els.sampleRows.querySelectorAll("[data-replace-text-file]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const rowId = Number(btn.dataset.replaceTextFile);
      const input = els.sampleRows.querySelector(`[data-text-file-input="${rowId}"]`);
      input?.click();
    });
  });

  els.sampleRows.querySelectorAll("[data-clear-text-file]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      clearRowTextFile(Number(btn.dataset.clearTextFile));
    });
  });

  els.sampleRows.querySelectorAll("[data-remove-row]").forEach(btn => {
    btn.addEventListener("click", () => removeRow(Number(btn.dataset.removeRow)));
  });
}

function applyBatchResults(data) {
  const readyRows = getReadyRows();
  const results = data.results || [];
  readyRows.forEach((row, idx) => {
    row.result = results[idx] || null;
  });
  const s = data.summary || {};
  els.batchMeta.innerHTML = `Batch ${escapeHtml(data.batch_id || "")} · 成功 ${s.success || 0}/${s.total || 0} · 均分 ${escapeHtml(String(s.avg_score ?? "-"))}`;
  els.batchMeta.classList.remove("hidden");
  state.isLoading = false;
  els.btnRun.disabled = false;
  renderRows();
}

function applyBatchError(message) {
  const readyRows = getReadyRows();
  readyRows.forEach(row => {
    row.result = { status: "failed", error: message };
  });
  els.batchMeta.innerHTML = `<span class="error-text">批量执行失败</span>`;
  els.batchMeta.classList.remove("hidden");
  state.isLoading = false;
  els.btnRun.disabled = false;
  renderRows();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

async function parseResponse(r) {
  const text = await r.text();
  if (!text) throw new Error(`服务器返回空响应 (HTTP ${r.status})`);
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`响应解析失败 (HTTP ${r.status}): ${text.slice(0, 300)}`);
  }
}

async function runTest() {
  if (state.category === "video") {
    alert("视频生成评测即将上线");
    return;
  }
  const modelId = state.modelId;
  const taskId = els.taskSelect.value;
  if (!modelId || !taskId) {
    alert("请选择模型和任务");
    return;
  }

  const readyRows = getReadyRows();
  if (!readyRows.length) {
    alert("请至少为一行上传参考图片");
    return;
  }

  const prompts = readyRows.map(r => (r.prompt || "").trim() || state.taskInstruction);
  const fd = new FormData();
  fd.append("category", state.category);
  fd.append("model_id", modelId);
  fd.append("task_id", taskId);
  fd.append("default_instruction", state.taskInstruction);
  fd.append("batch_prompts", prompts.join("\n---\n"));
  fd.append("input_text", els.inputText.value);
  fd.append("run_eval", els.runEval.checked ? "true" : "false");
  readyRows.forEach((r, idx) => {
    fd.append("images", r.imageFile, r.imageFile.name);
    if (r.textFile) {
      fd.append("prompt_files", r.textFile, `${String(idx).padStart(3, "0")}__${r.textFile.name}`);
      fd.append("prompt_file_indices", String(idx));
    }
  });

  state.isLoading = true;
  readyRows.forEach(r => { r.result = null; });
  els.btnRun.disabled = true;
  renderRows();

  try {
    const r = await fetch("/api/run_batch", { method: "POST", body: fd });
    const data = await parseResponse(r);
    if (!r.ok) {
      const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
      throw new Error(detail || `请求失败 (HTTP ${r.status})`);
    }
    applyBatchResults(data);
  } catch (err) {
    console.error("runBatch failed:", err);
    applyBatchError(err.message || String(err));
  }
}

els.tabs.forEach(t => t.addEventListener("click", () => switchCategory(t.dataset.category)));
els.btnRun.addEventListener("click", runTest);
els.btnAddRow.addEventListener("click", addRow);
els.btnSyncPrompts?.addEventListener("click", syncPromptsFromFirst);
els.taskSelect.addEventListener("change", () => loadOptions());
els.btnReloadConfig.addEventListener("click", async () => {
  await fetch("/api/reload-config", { method: "POST" });
  await loadOptions();
  alert("模型配置已刷新");
});

initRows();
loadOptions();
