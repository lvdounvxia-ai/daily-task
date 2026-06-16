const SAMPLE_NOVEL = window.IMPORTED_SAMPLE_SCRIPT || `《一夜未眠，冤家成了我孩子他爸》

第一章：醒来就当妈

苏晚星是被一通电话吵醒的。凌晨四点，手机屏幕在黑暗里发出刺眼的白光。她伸手摸过去，指尖还沾着昨夜命案现场的消毒水味。

“喂。”她的声音沙哑。

“苏小姐，您的儿子高烧39度8，请尽快来儿童医院。”

苏晚星愣了三秒，平静地回：“打错了。”挂断。

三秒后，电话再次响起。这次是个带着哭腔的护士：“孩子一直在喊妈妈，他爸爸傅先生还在手术台上下不来，孩子已经抽搐了一次，求您快点过来。”

啪地一声，床头的玻璃杯被她碰倒，碎在地板上。

傅。先。生。

第二章：亲子鉴定

儿童医院急诊灯白得刺眼。小男孩躺在病床上，烧得脸颊通红，却在看见苏晚星时伸出手，小声喊：“妈妈。”

苏晚星站在门口，脑子里所有推理都失效了。

傅沉舟从手术区赶来，白大褂还沾着血。他看见苏晚星，眼神比急诊室的灯更冷：“你终于肯出现了。”

苏晚星冷笑：“傅医生，造谣之前先做亲子鉴定。”

第三章：同居协议

鉴定结果出来那天，雨下得很大。苏晚星盯着报告最底下的百分比，第一次觉得自己可能活在一场荒唐的戏里。

傅沉舟把伞递到她面前：“孩子需要稳定环境。搬过来。”

“命令我？”苏晚星挑眉。

“合作。”傅沉舟把一份协议递给她，“三个月，查清当年的事，也给孩子一个答案。”`;

const PROMPT_POLICY = {
  role: "剧本格式校验与补丁规划",
  goal: "只补全剧本格式结构，输出严格 JSON",
  hardRules: [
    "绝不改写原文内容",
    "不输出最终全文，只输出当前场次 JSON",
    "仅补充集标题、场次信息、出场人物、场景前缀、角色内心OS、台词格式",
  ],
};

const state = {
  view: "upload",
  rawText: "",
  fileName: "",
  sourceLabel: "示例文本",
  episodes: [],
  activeEpisode: 0,
  activeScene: 0,
  toast: "",
  lastSaved: "未保存",
  loadingLabel: "",
  showValidationIssues: false,
  validationStatus: "idle",
};

const DEMO_VALIDATION_ISSUES = ["第 3 行：缺少场次头", "第 22 行：场号不连续"];

const app = document.querySelector("#app");
let loadingTimer = null;

function render() {
  app.innerHTML = state.view === "upload" ? uploadTemplate() : state.view === "loading" ? loadingTemplate() : editorTemplate();
  bindEvents();
}

function shell(inner, mode = "default") {
  return `
    <div class="app ${mode === "editor" ? "editor-mode" : ""}">
      ${
        mode === "editor"
          ? ""
          : `
        <header class="topbar">
          <div class="brand">
            <span class="brand-mark"></span>
            <span>漫剧脚本工坊</span>
          </div>
          <div class="top-actions">
            <span class="status-pill">创作状态｜国内推文</span>
            <span class="status-pill">任务队列 · 0 · 0</span>
            <span class="credit">19520</span>
          </div>
        </header>
      `
      }
      ${inner}
    </div>
  `;
}

function editorRouteTemplate() {
  return `
    <div class="editor-routebar">
      <button type="button" class="editor-back" data-action="back-upload">‹ 返回</button>
      <nav class="editor-flow" aria-label="创作步骤">
        <span class="editor-flow-item active">剧本内容</span>
        <span class="editor-flow-arrow">›</span>
        <span class="editor-flow-item">贡献要素</span>
        <span class="editor-flow-arrow">›</span>
        <span class="editor-flow-item">分镜视频</span>
      </nav>
    </div>
  `;
}

function editorTitleTemplate(scene) {
  return `
    <section class="editor-titlebar">
      <div class="editor-title-left">
        <span class="editor-spark">✣</span>
        <div>
          <h1>剧本编辑</h1>
          <p>${escapeHtml(scene?.episodeTitle || "第一集")} · ${escapeHtml(scene?.title || "第一场")}｜${escapeHtml(scene?.summary || "已完成初步结构化")}</p>
        </div>
      </div>
      <div class="editor-actions">
        <button type="button" class="link-button" data-action="help">帮助文档</button>
        <select class="small-button" data-action="export">
          <option>导出剧本</option>
          <option>导出 TXT</option>
          <option>导出 JSON</option>
        </select>
        <button type="button" class="small-button" data-action="replace">替换剧本</button>
        <button type="button" class="primary-button" data-action="next-step">下一步</button>
      </div>
    </section>
  `;
}

function routeTemplate() {
  return `
    <div class="route">
      <button type="button" data-action="back-upload">‹ 返回</button>
      <strong>剧本编辑</strong>
      <span>${state.view === "upload" ? "导入小说并自动校验生成漫剧剧本" : "已生成可校验预览"}</span>
    </div>
  `;
}

function stepsTemplate(active = 1) {
  const steps = ["剧本内容", "贡献要素", "分镜视频"];
  return `
    <div class="steps">
      ${steps
        .map(
          (step, index) => `
            <div class="step ${index + 1 === active ? "active" : ""}">
              <span class="step-dot">${index + 1}</span>
              <span>${step}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function uploadTemplate() {
  return shell(`
    <main class="upload-page">
      ${routeTemplate()}
      ${stepsTemplate(1)}
      <section class="upload-workspace">
        <div class="upload-panel">
          <div class="upload-head">
            <p class="eyebrow">Novel To Drama Script</p>
            <h1>导入小说，自动拆集拆场并生成漫剧剧本</h1>
            <p class="support">三种导入方式都在当前页完成。导入后统一执行“剧本格式校验与补丁规划”Prompt：不改写原文，只补齐格式结构，并输出当前场次 JSON。</p>
          </div>

          <div class="import-body import-board">
            <div class="import-grid">
              ${fileImportTemplate()}
              ${linkImportTemplate()}
              ${pasteImportTemplate()}
            </div>
          </div>
        </div>
      </section>
    </main>
  `);
}

function loadingTemplate() {
  return shell(`
    <main class="loading-page">
      ${routeTemplate()}
      ${stepsTemplate(1)}
      <section class="loading-workspace">
        <div class="loading-card">
          <div class="loading-orbit" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p class="eyebrow">Script Parsing</p>
          <h1>拆解中</h1>
          <p class="support">正在识别集数、场次、人物与场景结构，并按格式校验 Prompt 生成修正预览。</p>
          <div class="loading-progress"><span></span></div>
          <p class="note">${escapeHtml(state.loadingLabel || "导入内容")} · 演示流程约 3 秒后自动完成</p>
          <button type="button" class="secondary-button loading-cancel-button" data-action="cancel-loading">取消拆解</button>
        </div>
      </section>
    </main>
  `);
}

function fileImportTemplate() {
  return `
    <section class="method-card method-upload">
      <div class="method-head">
        <span class="method-index">01</span>
        <div>
          <h2>本地上传</h2>
          <p>适合 TXT、Markdown；DOCX 在 demo 中使用同名样例脚本。</p>
        </div>
      </div>
      <div class="drop-zone" data-drop-zone>
        <div class="drop-inner">
        <div class="folder-symbol"></div>
        <h3>上传剧本文件</h3>
        <p class="support">点击选择文件，也可以把 TXT 文档拖入此区域。</p>
        <div class="upload-actions">
          <input class="hidden" id="fileInput" type="file" accept=".txt,.md,.doc,.docx" />
          <button type="button" class="secondary-button" data-action="pick-file">本地上传</button>
          <button type="button" class="primary-button" data-action="use-sample">使用示例导入</button>
        </div>
        <p class="note">支持格式：TXT | DOCX。DOCX 示例来自你提供的导入剧本。</p>
        ${state.fileName ? `<p class="selected-file">已选择：${escapeHtml(state.fileName)}</p>` : ""}
        </div>
      </div>
    </section>
  `;
}

function linkImportTemplate() {
  return `
    <section class="method-card method-link">
      <div class="method-head">
        <span class="method-index">02</span>
        <div>
          <h2>导入链接</h2>
          <p>粘贴在线文档或公开文本地址，一键拉取内容。</p>
        </div>
      </div>
      <div class="compact-zone">
        <div class="input-row">
          <input class="text-input" id="linkInput" placeholder="https://..." />
          <button type="button" class="secondary-button" data-action="import-link">导入链接</button>
        </div>
        <p class="note">支持公开可访问的 TXT 链接，其他文档源可在后端接入解析服务。</p>
      </div>
    </section>
  `;
}

function pasteImportTemplate() {
  return `
    <section class="method-card method-paste">
      <div class="method-head">
        <span class="method-index">03</span>
        <div>
          <h2>直接粘贴剧本</h2>
          <p>适合从小说正文、已有剧本或编辑器里快速复制。</p>
        </div>
      </div>
      <div class="paste-content">
        <textarea class="paste-input" id="pasteInput" placeholder="把小说正文或已有剧本文本粘贴到这里...">${escapeHtml(state.rawText)}</textarea>
        <button type="button" class="primary-button method-next-button" data-action="import-paste-next">下一步</button>
        <p class="note">粘贴内容会被自动识别为第几集，并继续拆成第几场。</p>
      </div>
    </section>
  `;
}

function editorTemplate() {
  const scene = currentScene();
  const displayText = scene?.display || scene?.generated || "";
  return shell(`
    <main class="editor-page">
      ${editorRouteTemplate()}
      ${editorTitleTemplate(scene)}
      <section class="editor-shell">
        <div class="workbench-tabs">
          <button type="button" class="tab-button active">剧本编辑</button>
          <button type="button" class="tab-button">剧本预览</button>
        </div>
        <div class="workbench-metrics">
          <div class="workbench-source">剧集 ｜ ${state.episodes.length} 集</div>
          <div class="metric-row">
            <span class="metric">字数 ${countCharacters(state.rawText)}</span>
            <span class="metric">对白 ${dialogueRatio()}%</span>
            <span class="metric">阅读 19分钟</span>
            <span class="metric">拍摄 约19分钟</span>
          </div>
          <div class="remote-save">
            <span>✓ 远程已保存 ${state.lastSaved === "未保存" ? "11:17:12" : escapeHtml(state.lastSaved.replace("已保存 ", ""))}</span>
            <button type="button" class="title-save-button" data-action="save-preview">保存</button>
            <button type="button" class="title-check-button" data-action="validate-preview">校验</button>
          </div>
        </div>
        <div class="editor-body">
          <aside class="sidebar">
          <div class="episode-list">
            ${state.episodes.map(episodeTemplate).join("")}
          </div>
          </aside>

          <section class="content">
          <div class="compare-grid">
            <section class="pane">
              <div class="script-box">
                <div class="script-editor-wrap">
                  <pre class="script-line-gutter" data-display-line-nos aria-hidden="true">${editorLineNumbers(displayText)}</pre>
                  <pre class="script-highlight" data-display-highlight aria-hidden="true">${highlightEditableScript(displayText)}</pre>
                  <textarea class="script-editor" data-display-editor spellcheck="false">${escapeHtml(displayText)}</textarea>
                </div>
              </div>
            </section>
          </div>
          </section>
        </div>
        ${state.showValidationIssues ? issuePopoverTemplate() : ""}
      </section>
    </main>
  `, "editor");
}

function episodeTemplate(episode, episodeIndex) {
  const isEpisodeActive = state.activeEpisode === episodeIndex;
  return `
    <div class="episode-block">
      <button type="button" class="episode-title ${isEpisodeActive ? "active" : ""}" data-episode="${episodeIndex}">
        <span>${escapeHtml(episode.title)}</span>
        <span class="episode-count">${episode.scenes.length} 场</span>
      </button>
      <div class="scene-list">
        ${episode.scenes
          .map(
            (scene, sceneIndex) => `
              <button type="button" class="scene-item ${isEpisodeActive && state.activeScene === sceneIndex ? "active" : ""}" data-scene="${episodeIndex}:${sceneIndex}">
                <span>${escapeHtml(scene.title)}</span>
                <span class="scene-time">${scene.minutes}分</span>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function issuePopoverTemplate() {
  if (state.validationStatus === "fixed") {
    return `
      <aside class="issue-popover issue-popover-success">
        <div class="issue-head">
          <span class="issue-success-mark">✓</span>
          <h3>AI 已自动补全</h3>
        </div>
        <p class="issue-tip">已补齐缺失场次头，并修正不连续场号。可继续保存或进入下一步。</p>
      </aside>
    `;
  }
  return `
    <aside class="issue-popover">
      <div class="issue-head">
        <span class="issue-warning">△</span>
        <h3>${DEMO_VALIDATION_ISSUES.length} 处格式问题</h3>
        <span class="issue-chevron">⌄</span>
      </div>
      <p class="issue-tip">修改错误后行号定位可能会有误差</p>
      <div class="issue-list">
        ${DEMO_VALIDATION_ISSUES
          .map(
            (issue) => `
              <div class="issue">
                <span class="issue-checkbox"></span>
                <span>${escapeHtml(issue)}</span>
              </div>
            `
          )
          .join("")}
      </div>
      <button type="button" class="ai-fix-button" data-action="ai-fix-issues">AI自动补全</button>
    </aside>
  `;
}

function scriptLines(text) {
  const lines = text.split("\n");
  if (!text.trim()) return [`<div class="empty-state">暂无内容</div>`];
  return lines
    .map((line, index) => {
      const className = classifyLine(line);
      return `
        <div class="line">
          <span class="line-no">${index + 1}</span>
          <span class="${className}">${line ? escapeHtml(line) : "&nbsp;"}</span>
        </div>
      `;
    })
    .join("");
}

function highlightEditableScript(text) {
  if (!text.trim()) return `<span class="editor-muted">暂无内容</span>`;
  return text
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line) || "&nbsp;";
      if (/^\d+-\d+/.test(line)) return `<span class="editor-scene-meta">${escaped}</span>`;
      if (/^出场人物/.test(line)) return `<span class="editor-people">${escaped}</span>`;
      return escaped;
    })
    .join("\n");
}

function editorLineNumbers(text) {
  const lineCount = Math.max(1, text.split("\n").length);
  return Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
}

function classifyLine(line) {
  if (/^第.+集/.test(line)) return "script-heading";
  if (/^\d+-\d+|^第.+场|^场景/.test(line)) return "script-scene";
  if (/^出场人物/.test(line)) return "script-heading";
  if (/^[^：:]{1,8}[：:]/.test(line)) return "script-role";
  if (/^▲|^\[|^（|^【/.test(line)) return "script-note";
  return "";
}

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const action = event.currentTarget.dataset.action;
      if (action === "pick-file") document.querySelector("#fileInput")?.click();
      if (action === "use-sample") importText(SAMPLE_NOVEL, "示例文本");
      if (action === "import-paste-next") {
        const value = document.querySelector("#pasteInput")?.value || "";
        importText(value || SAMPLE_NOVEL, value ? "粘贴文本" : "示例文本");
      }
      if (action === "import-link") importFromLink();
      if (action === "back-upload" || action === "replace") {
        clearLoadingTimer();
        state.view = "upload";
        render();
      }
      if (action === "cancel-loading") {
        clearLoadingTimer();
        state.loadingLabel = "";
        state.view = "upload";
        render();
      }
      if (action === "next-step") {
        state.toast = "已进入贡献要素步骤";
        render();
      }
      if (action === "save-preview") {
        syncDisplayEditor();
        state.lastSaved = "已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
        render();
      }
      if (action === "validate-preview") {
        syncDisplayEditor();
        state.showValidationIssues = true;
        state.validationStatus = "failed";
        render();
      }
      if (action === "ai-fix-issues") {
        syncDisplayEditor();
        state.showValidationIssues = true;
        state.validationStatus = "fixed";
        state.lastSaved = "已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
        render();
      }
      if (action === "help") alert("Demo 提示：左侧选择集和场，预览区展示结构化后的漫剧脚本，可直接修改并保存。");
    });
  });

  document.querySelector("#fileInput")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) readFile(file);
  });

  const displayEditor = document.querySelector("[data-display-editor]");
  const displayHighlight = document.querySelector("[data-display-highlight]");
  const displayLineNos = document.querySelector("[data-display-line-nos]");
  if (displayEditor) {
    displayEditor.addEventListener("input", () => {
      const scene = currentScene();
      if (scene) scene.display = displayEditor.value;
      if (displayHighlight) displayHighlight.innerHTML = highlightEditableScript(displayEditor.value);
      if (displayLineNos) displayLineNos.textContent = editorLineNumbers(displayEditor.value);
    });
    displayEditor.addEventListener("scroll", () => {
      if (displayHighlight) {
        displayHighlight.scrollTop = displayEditor.scrollTop;
        displayHighlight.scrollLeft = displayEditor.scrollLeft;
      }
      if (displayLineNos) displayLineNos.scrollTop = displayEditor.scrollTop;
    });
  }

  const dropZone = document.querySelector("[data-drop-zone]");
  if (dropZone) {
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragover");
      const file = event.dataTransfer.files?.[0];
      if (file) readFile(file);
    });
  }

  document.querySelectorAll("[data-episode]").forEach((button) => {
    button.addEventListener("click", () => {
      syncDisplayEditor();
      state.activeEpisode = Number(button.dataset.episode);
      state.activeScene = 0;
      state.showValidationIssues = false;
      state.validationStatus = "idle";
      render();
    });
  });

  document.querySelectorAll("[data-scene]").forEach((button) => {
    button.addEventListener("click", () => {
      syncDisplayEditor();
      const [episodeIndex, sceneIndex] = button.dataset.scene.split(":").map(Number);
      state.activeEpisode = episodeIndex;
      state.activeScene = sceneIndex;
      state.showValidationIssues = false;
      state.validationStatus = "idle";
      render();
    });
  });
}

function syncDisplayEditor() {
  const displayEditor = document.querySelector("[data-display-editor]");
  const scene = currentScene();
  if (displayEditor && scene) scene.display = displayEditor.value;
}

function readFile(file) {
  state.fileName = file.name;
  if (!/\.(txt|md)$/i.test(file.name)) {
    importText(SAMPLE_NOVEL, `${file.name}（DOCX demo 使用内置同名样例）`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => importText(String(reader.result || ""), file.name);
  reader.readAsText(file, "utf-8");
}

async function importFromLink() {
  const input = document.querySelector("#linkInput");
  const url = input?.value.trim();
  if (!url) {
    importText(SAMPLE_NOVEL, "示例链接文本");
    return;
  }
  try {
    const response = await fetch(url);
    const text = await response.text();
    importText(text, "链接导入");
  } catch {
    importText(SAMPLE_NOVEL, "链接导入失败，使用示例文本");
  }
}

function importText(text, label) {
  const normalized = normalizeText(text || SAMPLE_NOVEL);
  clearLoadingTimer();
  state.rawText = normalized;
  state.sourceLabel = label;
  state.loadingLabel = label;
  state.episodes = [];
  state.activeEpisode = 0;
  state.activeScene = 0;
  state.view = "loading";
  state.lastSaved = "未保存";
  state.showValidationIssues = false;
  state.validationStatus = "idle";
  render();
  loadingTimer = setTimeout(() => completeImport(normalized, label), 3000);
}

function completeImport(normalized, label) {
  state.rawText = normalized;
  state.sourceLabel = label;
  state.episodes = parseEpisodes(normalized);
  state.activeEpisode = 0;
  state.activeScene = 0;
  state.view = "editor";
  state.loadingLabel = "";
  state.lastSaved = "远程已保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
  state.showValidationIssues = false;
  state.validationStatus = "idle";
  loadingTimer = null;
  render();
}

function clearLoadingTimer() {
  if (!loadingTimer) return;
  clearTimeout(loadingTimer);
  loadingTimer = null;
}

function parseEpisodes(text) {
  const structured = parseStructuredScript(text);
  if (structured.length) return structured;

  const titleMatch = text.match(/《([^》]+)》/);
  const novelTitle = titleMatch ? titleMatch[1] : "未命名故事";
  const matches = [...text.matchAll(/(^|\n)(第[一二三四五六七八九十百千万\d]+[章节集回][：:\s\S]*?)(?=\n第[一二三四五六七八九十百千万\d]+[章节集回][：:\s]|$)/g)];
  const chunks = matches.length ? matches.map((match) => match[2].trim()) : [text.trim()];

  return chunks.map((chunk, index) => {
    const heading = chunk.match(/^第[一二三四五六七八九十百千万\d]+[章节集回][：:\s]*(.*)/);
    const titleTail = heading?.[1]?.split("\n")[0].trim();
    const title = `第${toChineseNumber(index + 1)}集${titleTail ? `：${titleTail}` : ""}`;
    const body = heading ? chunk.replace(/^第[一二三四五六七八九十百千万\d]+[章节集回][^\n]*\n?/, "").trim() : chunk;
    const scenes = splitScenes(body, title, novelTitle);
    return { title, scenes };
  });
}

function splitScenes(body, episodeTitle, novelTitle) {
  const explicit = [...body.matchAll(/(^|\n)(第[一二三四五六七八九十百千万\d]+场[：:\s\S]*?)(?=\n第[一二三四五六七八九十百千万\d]+场[：:\s]|$)/g)];
  if (explicit.length) {
    return explicit.map((match, index) => buildScene(match[2].trim(), index, episodeTitle, novelTitle));
  }

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sceneCount = Math.max(1, Math.min(4, Math.ceil(paragraphs.length / 3)));
  const size = Math.ceil(paragraphs.length / sceneCount);
  const chunks = [];
  for (let i = 0; i < paragraphs.length; i += size) {
    chunks.push(paragraphs.slice(i, i + size).join("\n\n"));
  }
  return (chunks.length ? chunks : [body]).map((chunk, index) => buildScene(chunk, index, episodeTitle, novelTitle));
}

function buildScene(raw, index, episodeTitle, novelTitle) {
  const title = `第${toChineseNumber(index + 1)}场`;
  const firstSentence = raw.replace(/\s+/g, " ").split(/[。！？]/)[0] || "关键剧情推进";
  const sceneJson = buildPromptJson({
    episode: episodeTitle.replace(/[：:].*$/, ""),
    sceneNumber: `${state.episodes.length + 1}-${index + 1}`,
    time: inferTime(raw),
    location: inferLocation(raw),
    people: inferActor(raw),
    content: raw,
  });
  const generated = JSON.stringify(sceneJson, null, 2);
  const display = buildReadableScript({
    sceneNumber: sceneJson.scene_description.scene_number,
    time: sceneJson.scene_description.time_of_day,
    location: sceneJson.scene_description.location,
    people: sceneJson.persone,
    content: formatSceneContent(raw, sceneJson.persone),
  });
  return {
    title,
    raw,
    generated,
    display,
    summary: `${novelTitle} · ${firstSentence}`,
    minutes: Math.max(1, Math.ceil(countCharacters(raw) / 260)),
    issues: validateScene(raw, generated),
  };
}

function parseStructuredScript(text) {
  if (!/\n场次[：:]\s*\d+-\d+/.test(text)) return [];
  const chunks = text.split(/(?=\n?场次[：:]\s*\d+-\d+)/).map((chunk) => chunk.trim()).filter(Boolean);
  const preface = chunks[0] && !/^场次[：:]/.test(chunks[0]) ? chunks.shift() : "";
  const episodeTitles = [...text.matchAll(/第([一二三四五六七八九十百千万\d]+)[幕集章节回][：:：]?[^\n]*/g)].map((match) => ({
    index: match.index || 0,
    title: `第${match[1]}集`,
  }));
  const fallbackTitle = preface.match(/《([^》]+)》/)?.[1] || "导入剧本";
  const episodes = new Map();

  chunks.forEach((chunk) => {
    const absoluteIndex = text.indexOf(chunk);
    const sceneNumber = chunk.match(/场次[：:]\s*([0-9]+-[0-9]+)/)?.[1] || "";
    const episodeNo = Number(sceneNumber.split("-")[0]) || findEpisodeNumber(episodeTitles, absoluteIndex) || 1;
    const episode = `第${toChineseNumber(episodeNo)}集`;
    const sceneIndex = Number(sceneNumber.split("-")[1]) || 1;
    const meta = extractSceneMeta(chunk);
    const body = extractSceneBody(chunk);
    const content = formatSceneContent(body, meta.people);
    const sceneJson = buildPromptJson({
      episode,
      sceneNumber: sceneNumber || `${episodeNo}-${sceneIndex}`,
      time: normalizeTimeOfDay(meta.time),
      location: normalizeLocation(meta.location),
      people: meta.people || "未标注",
      content,
    });
    const display = buildReadableScript({
      sceneNumber: sceneJson.scene_description.scene_number,
      time: meta.time,
      location: meta.location,
      people: sceneJson.persone,
      content: sceneJson.scene_content,
    });
    const summary = meta.summary || body.split(/[。！？\n]/).find(Boolean) || fallbackTitle;
    const scene = {
      title: `第${toChineseNumber(sceneIndex)}场`,
      episodeTitle: episode,
      raw: chunk,
      generated: JSON.stringify(sceneJson, null, 2),
      display,
      summary,
      minutes: Math.max(1, Math.ceil(countCharacters(body) / 260)),
      issues: validateScene(chunk, JSON.stringify(sceneJson)),
    };
    if (!episodes.has(episodeNo)) episodes.set(episodeNo, { title: episode, scenes: [] });
    episodes.get(episodeNo).scenes.push(scene);
  });

  return [...episodes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, episode]) => episode);
}

function validateScene(raw, generated) {
  const issues = [];
  try {
    const parsed = JSON.parse(generated);
    if (!parsed.episode) issues.push("缺少 episode 字段。");
    if (!parsed.scene_description?.scene_number) issues.push("缺少 scene_number。");
    if (!parsed.scene_description?.time_of_day) issues.push("缺少 time_of_day。");
    if (!parsed.scene_description?.location) issues.push("缺少 location。");
    if (!parsed.persone) issues.push("缺少 persone。");
    if (!parsed.scene_content) issues.push("缺少 scene_content。");
  } catch {
    issues.push("输出不是严格 JSON。");
  }
  if (!raw.trim()) issues.push("导入原文为空。");
  return issues;
}

function inferActor(text) {
  const names = ["苏晚星", "傅景珩", "傅念星", "沈知夏", "护士", "警察", "傅振邦", "神秘杀手", "老年苏晚星", "老年傅景珩"];
  return names.filter((name) => text.includes(name)).join("、") || "未标注";
}

function inferLocation(text) {
  if (/医院|急诊|病床/.test(text)) return "儿童医院";
  if (/床|床头|凌晨/.test(text)) return "卧室";
  if (/雨|伞/.test(text)) return "医院门口";
  return "核心场景";
}

function inferTime(text) {
  if (/凌晨|四点|黑暗/.test(text)) return "凌晨";
  if (/雨/.test(text)) return "雨夜";
  return "日内";
}

function findEpisodeNumber(episodeTitles, index) {
  const matched = episodeTitles.filter((item) => item.index <= index).at(-1);
  if (!matched) return null;
  return chineseNumberToArabic(matched.title.match(/第(.+)集/)?.[1] || "一");
}

function extractSceneMeta(chunk) {
  return {
    sceneNumber: chunk.match(/场次[：:]\s*([^\n]+)/)?.[1]?.trim() || "",
    location: chunk.match(/场景[：:]\s*([^\n]+)/)?.[1]?.trim() || "",
    time: chunk.match(/时间[：:]\s*([^\n]+)/)?.[1]?.trim() || "",
    people: chunk.match(/人物[：:]\s*([^\n]+)/)?.[1]?.trim() || "",
    summary: chunk.match(/【剧情梗概】[：:]\s*([^\n]+)/)?.[1]?.trim() || "",
  };
}

function extractSceneBody(chunk) {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^(场次|场景|时间|人物)[：:]/.test(line) && !/^【剧情梗概】/.test(line) && line !== "（正文开始）")
    .join("\n");
}

function buildPromptJson({ episode, sceneNumber, time, location, people, content }) {
  return {
    episode,
    scene_description: {
      scene_number: sceneNumber,
      time_of_day: time,
      location,
    },
    persone: people,
    scene_content: content,
  };
}

function buildReadableScript({ sceneNumber, time, location, people, content }) {
  return [
    `${sceneNumber} ${displayDayPart(time)} ${displaySceneType(location)} ${normalizeLocation(location)}`,
    `出场人物：${people || "未标注"}`,
    displaySceneContent(content),
  ]
    .filter(Boolean)
    .join("\n");
}

function displaySceneContent(content) {
  return content
    .split("\n")
    .map((line) => line.replace(/\sOS[：:]/g, "os："))
    .join("\n");
}

function formatSceneContent(body, people = "") {
  const peopleList = people.split(/[、,，]/).map((name) => name.trim()).filter(Boolean);
  return body
    .split("\n")
    .map((line) => formatSceneLine(line.trim(), peopleList))
    .filter(Boolean)
    .join("\n");
}

function formatSceneLine(line, peopleList) {
  if (!line) return "";
  if (/^▲/.test(line)) return line;

  const osMatch = line.match(/^【?([^】：:]{1,12})(旁白|内心|OS|os)】?[：:](.+)$/);
  if (osMatch) return `${osMatch[1]}os：${osMatch[3].trim()}`;

  const namedDialogue = line.match(/^([^“”：:]{1,18}?)([^“”：:]{0,18})[：:]?[“"](.+)[”"]$/);
  if (namedDialogue) {
    const speaker = namedDialogue[1].trim();
    const action = namedDialogue[2].trim();
    const dialogue = namedDialogue[3].trim();
    if (peopleList.some((name) => speaker.includes(name)) || /^[\u4e00-\u9fa5]{2,6}$/.test(speaker)) {
      return `${speaker}${action ? `（${action}）` : ""}：${dialogue}`;
    }
  }

  const directDialogue = line.match(/^[“"](.+)[”"]([^“”"]*)$/);
  if (directDialogue && peopleList.length === 1) {
    if (directDialogue[1].length <= 2 && /声|响|碎|倒/.test(directDialogue[2])) {
      return shouldUseScenePrefix(line) ? `▲${line}` : line;
    }
    const action = directDialogue[2].trim().replace(/^。/, "");
    return `${peopleList[0]}${action ? `（${action}）` : ""}：${directDialogue[1].trim()}`;
  }

  return shouldUseScenePrefix(line) ? `▲${line}` : line;
}

function shouldUseScenePrefix(line) {
  if (/^【[^】]*(特写|镜头|画面|环境|动作|音效)[^】]*】/.test(line)) return true;
  if (/^(桌上|墙上|门口|窗外|屋内|房间|客厅|走廊|医院|街道|灯光|镜头|画面|场内|天空|雨|阳光|黑暗|电梯|办公室|档案室|地下室|婚礼现场)/.test(line)) return true;

  const visualAction = /(走|坐|站|躲|伸出|递|拿|推开|打开|关上|抱|握|抬头|低头|看着|盯着|笑|哭|拍|倒|碎|响起|亮起|端着|走进|走出|冲出|踩过|翻开|合上|放下|塞进|戴上|吻上|靠在)/;
  const innerOrExposition = /(以为|觉得|知道|明白|想起来|不记得|应该|可以|一定|必须|这不正常|真相|秘密|意思|为什么|她是|他是)/;
  return visualAction.test(line) && !innerOrExposition.test(line);
}

function normalizeTimeOfDay(time) {
  if (/夜|凌晨|晚/.test(time)) return "夜景";
  if (/晨|早|日|下午|阳光|白天/.test(time)) return "日景";
  return time || "日景/夜景";
}

function normalizeLocation(location) {
  return location.split("/").pop()?.trim() || location || "场景名称";
}

function displayDayPart(time) {
  if (/夜|凌晨|晚/.test(time)) return "夜";
  if (/晨|早/.test(time)) return "晨";
  if (/日|下午|阳光|白天/.test(time)) return "日";
  if (/夜景/.test(time)) return "夜";
  if (/日景/.test(time)) return "日";
  return "日";
}

function displaySceneType(location) {
  if (/外景/.test(location)) return "外景";
  if (/内景/.test(location)) return "内景";
  return "内景";
}

function chineseNumberToArabic(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (digits[value[1]] || 0);
  if (value.includes("十")) {
    const [ten, one] = value.split("十");
    return (digits[ten] || 1) * 10 + (digits[one] || 0);
  }
  return digits[value] || 1;
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function currentScene() {
  return state.episodes[state.activeEpisode]?.scenes[state.activeScene] || null;
}

function countScenes() {
  return state.episodes.reduce((total, episode) => total + episode.scenes.length, 0);
}

function countIssues() {
  const scene = currentScene();
  return scene?.issues.length || 0;
}

function countCharacters(text) {
  return (text || "").replace(/\s/g, "").length;
}

function dialogueRatio() {
  const scene = currentScene();
  if (!scene) return 0;
  const dialogue = (scene.generated.match(/[：:]/g) || []).length;
  const lines = scene.generated.split("\n").filter(Boolean).length;
  return Math.min(100, Math.round((dialogue / Math.max(1, lines)) * 100));
}

function toChineseNumber(number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (number <= 10) return number === 10 ? "十" : digits[number];
  if (number < 20) return `十${digits[number % 10]}`;
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  return `${digits[tens]}十${ones ? digits[ones] : ""}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

render();
