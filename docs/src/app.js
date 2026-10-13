// Product UI around the pixel-stretch canvas engine.
let currentScreen = 'home';
let currentTool = 'stretch';
let uiReady = false;
let exportSnapshot = null;
let maskSnapshot = null;
const previewCopies = new Map();
const loadingButtons = $$('[data-project], [data-demo], #import-photo');
loadingButtons.forEach(button => button.disabled = true);

function cloneCanvas(source) {
  const result = canvas(source.width, source.height);
  result.getContext('2d').drawImage(source, 0, 0);
  return result;
}

function freezeExport() {
  const project = P();
  if (!project) return null;
  return {
    ...project,
    state: copy(project.state),
    fg: cloneCanvas(project.fg),
    mask: canvas(),
    protected: canvas(),
    tint: canvas(),
    maskStamp: null,
    stripStamp: null,
  };
}

function exportProject() { return exportSnapshot || P(); }

function refreshExport() {
  if (exportSnapshot) draw($('save-canvas'), exportSnapshot);
}

function showScreen(screen, scroll = true, recordHistory = true) {
  if ((screen === 'edit' || screen === 'export') && !P()) return;
  const previousScreen = currentScreen;
  if (screen === 'export' && currentScreen !== 'export') {
    exportSnapshot = freezeExport();
    clearDownload();
  }
  else if (screen !== 'export') exportSnapshot = null;

  currentScreen = screen;
  document.body.dataset.screen = screen;
  $$('[data-step]').forEach(item => item.classList.toggle('active', item.dataset.step === screen));
  if (screen === 'edit') {
    if (!S().effect) setTool('shape');
    sync(); render(); renderThumbnails();
  }
  if (screen === 'export') refreshExport();
  if (recordHistory && screen !== previousScreen) history.pushState({yourcolorScreen: screen}, '');
  if (scroll) {
    const labels = {home: '시작', pick: '사진 선택', edit: '편집', export: '저장'};
    const target = document.querySelector(`[data-step="${screen}"] .screen`);
    target.tabIndex = -1;
    target.focus({preventScroll: true});
    $('screen-announcement').textContent = `${labels[screen]} 화면`;
    $('editor').scrollIntoView({block: 'start'});
  }
}

function setTool(tool) {
  if (tool === 'subject') { openMaskEditor(); return; }
  currentTool = tool;
  for (const key of ['stretch', 'shape', 'background']) $('panel-' + key).hidden = key !== tool;
  $$('[data-tool]').forEach(button => button.setAttribute('aria-pressed', button.dataset.tool === tool));
  if (tool === 'shape' && P()) renderThumbnails();
}

function openMaskEditor() {
  if (!P() || $('mask-dialog').open) return;
  const project = P();
  maskSnapshot = {project, state: copy(project.state), history: copy(project.history), future: copy(project.future)};
  $('mask-dialog').showModal();
  sync(); renderMask();
}

function closeMaskEditor(apply) {
  if (!apply && maskSnapshot) {
    const {project, state, history, future} = maskSnapshot;
    project.state = state;
    project.history = history;
    project.future = future;
    project.maskStamp = null;
    sync(); queue(); renderThumbnails();
  }
  maskSnapshot = null;
  $('mask-dialog').close();
}

function demoState(key) {
  const state = initial(key);
  if (key === 'car') state.length = 100;
  if (key === 'portrait') Object.assign(state, {effect: 'fan', direction: 'up', amount: 48, length: 100});
  if (key === 'flower') Object.assign(state, {effect: 'curve', direction: 'down', amount: 44, length: 100});
  return state;
}

function renderPreviews() {
  for (const key of ['portrait', 'car', 'flower']) {
    const project = projects[key];
    if (!project) continue;
    let item = previewCopies.get(key);
    if (!item || item.maskReady !== project.maskReady) {
      item = {maskReady: project.maskReady, project: {
        ...project, state: demoState(key), mask: canvas(), protected: canvas(), tint: canvas(),
        maskStamp: null, stripStamp: null,
      }};
      previewCopies.set(key, item);
    }
    $$(`[data-preview="${key}"]`).forEach(target => draw(target, item.project));
  }
}

const selectOriginal = selectProject;
selectProject = function (key) {
  selectOriginal(key);
  if (!uiReady) return;
  if (key === 'custom') {
    const button = document.querySelector('[data-project="custom"]');
    button.classList.add('sample-card');
    const image = button.querySelector('img');
    if (!button.querySelector('.sample-art')) {
      const frame = document.createElement('div');
      frame.className = 'sample-art';
      button.prepend(frame);
      frame.append(image);
    }
  }
  showScreen('edit');
  setTool(S().effect ? 'stretch' : 'shape');
};

const renderOriginal = render;
render = function () {
  renderOriginal();
  if (uiReady && currentScreen === 'export') refreshExport();
};

$$('[data-jump]').forEach(button => button.onclick = () => showScreen(button.dataset.jump));
$$('[data-tool]').forEach(button => button.onclick = () => setTool(button.dataset.tool));
$$('[data-demo]').forEach(button => button.onclick = () => {
  if (!uiReady) return;
  const key = button.dataset.demo;
  selectProject(key);
  mutate(state => Object.assign(state, demoState(key)));
  renderThumbnails();
  setTool('stretch');
});
$('save-open').onclick = () => showScreen('export');
$('model-status').onclick = openMaskEditor;
$$('[data-close="mask-dialog"]').forEach(button => {
  button.onclick = () => closeMaskEditor(button.classList.contains('primary-button'));
});
$('mask-dialog').onclick = () => {};
$('mask-dialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeMaskEditor(false);
});
window.addEventListener('popstate', event => {
  if (event.state?.yourcolorScreen) showScreen(event.state.yourcolorScreen, true, false);
});

function initializeV4() {
  uiReady = true;
  loadingButtons.forEach(button => button.disabled = false);
  $('loading-status').hidden = true;
  document.documentElement.style.setProperty('--font', 'Paperlogy');
  document.body.classList.add('live-mode');
  document.body.dataset.uiReady = 'true';
  history.replaceState({...history.state, yourcolorScreen: currentScreen}, '');
  showScreen(currentScreen, false, false);
  renderPreviews();
}
