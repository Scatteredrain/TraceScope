import { publication } from './config.js';
import { mountAxis2Radar, stateColors } from './axis2-radar.js';
import { mountAxis1Evidence, evidenceCondition } from './axis1-evidence.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => new Intl.NumberFormat('en-US').format(value);
const percent = value => `${(value * 100).toFixed(1)}%`;

if (publication.paper) for (const link of $$('[data-paper]')) link.href = publication.paper;
for (const link of $$('[data-repository]')) link.href = publication.repository;
if (publication.authors.length || publication.venue) {
  const meta = $('#publication-meta');
  meta.textContent = [publication.authors.join(' · '), publication.venue].filter(Boolean).join(' / ');
  meta.hidden = false;
}
if (publication.dataset) {
  const link = $('#dataset-link');
  link.href = publication.dataset;
  link.textContent = 'Explore the dataset ↗';
  link.target = '_blank';
  link.rel = 'noopener';
  link.hidden = false;
}

const menu = $('.menu-toggle');
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  menu.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  $('#primary-nav').classList.toggle('open', expanded);
});
for (const link of $$('#primary-nav a')) link.addEventListener('click', () => {
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
  $('#primary-nav').classList.remove('open');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    menu.click();
    menu.focus();
  }
});

const dialog = $('#figure-dialog');
let figureZoom = 1;
function setFigureZoom(value) {
  figureZoom = Math.max(.5, Math.min(3, value));
  const image = $('#dialog-image');
  image.style.width = `${figureZoom * 100}%`;
  image.style.maxWidth = 'none';
  $('#zoom-level').textContent = `${Math.round(figureZoom * 100)}%`;
  $('#zoom-out').disabled = figureZoom <= .5;
  $('#zoom-in').disabled = figureZoom >= 3;
}
function showFigure(src, title, evidenceOnly = false) {
  $('#dialog-image').src = src;
  $('#dialog-image').alt = title;
  $('#figure-dialog-title').textContent = title;
  $('.dialog-image-wrap').classList.toggle('evidence-only', evidenceOnly);
  dialog.showModal();
  setFigureZoom(window.innerWidth < 681 && !evidenceOnly ? 2 : 1);
  dialog.scrollTop = 0;
  $('.dialog-image-wrap').scrollLeft = 0;
  document.documentElement.style.overflow = 'hidden';
}
$('#zoom-out').addEventListener('click', () => setFigureZoom(figureZoom - .5));
$('#zoom-in').addEventListener('click', () => setFigureZoom(figureZoom + .5));
$('#zoom-fit').addEventListener('click', () => setFigureZoom(1));
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.documentElement.style.overflow = ''; });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
for (const button of $$('[data-figure]')) button.addEventListener('click', () => showFigure(button.dataset.figure, button.dataset.caption));

function tabKeyboard(container) {
  container.addEventListener('keydown', event => {
    const buttons = [...container.querySelectorAll('[role="tab"]')];
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next].click();
    buttons[next].focus();
  });
}

async function initialize() {
  const response = await fetch(new URL('./data/benchmark.json', import.meta.url));
  if (!response.ok) throw new Error(`Could not load benchmark data (${response.status}).`);
  const data = await response.json();
  let selectedTask = 1;
  let selectedAxis = 1;
  let axisState = 0;
  let sortMetric = null;
  let sortDescending = true;
  let radar = null;
  let evidenceChart = null;
  let playbackTimer = null;
  let playing = false;

  $('#example-tabs').innerHTML = data.tasks.map((task, i) => `<button type="button" id="example-tab-${i}" role="tab" aria-controls="example-panel" data-task="${i}"><span>${escapeHTML(task.id)}</span>${escapeHTML(task.name)}</button>`).join('');
  for (const button of $$('#example-tabs button')) button.addEventListener('click', () => renderExample(Number(button.dataset.task)));
  tabKeyboard($('#example-tabs'));

  function renderExample(index) {
    selectedTask = index;
    const task = data.tasks[index];
    for (const button of $$('#example-tabs button')) {
      const active = Number(button.dataset.task) === index;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    $('#example-panel').setAttribute('aria-labelledby', `example-tab-${index}`);
    $('#evidence-label').textContent = task.label;
    $('#evidence-number').textContent = task.id;
    $('#example-image').src = `./${task.image}`;
    $('#example-image').alt = `${task.name} example: ${task.caption}`;
    $('.evidence-view').classList.toggle('single-frame', index === 0);
    $('#evidence-caption').textContent = task.caption;
    $('#example-task-id').textContent = task.id;
    $('#example-form').textContent = task.form;
    $('#example-title').textContent = task.title;
    $('#example-question').textContent = task.question;
    $('#example-options').className = task.options.length ? 'question-options' : '';
    $('#example-options').innerHTML = task.options.map((option, i) => `<div><span>${String.fromCharCode(65 + i)}</span>${escapeHTML(option)}</div>`).join('');
    $('#reference-answer').innerHTML = `<b>${escapeHTML(task.reference)}</b>${escapeHTML(task.explanation)}`;
    $('#reference-answer').hidden = true;
    $('#reveal-answer').setAttribute('aria-expanded', 'false');
    $('#reveal-answer').innerHTML = 'Reveal reference <span aria-hidden="true">↗</span>';
    $('#example-metric').textContent = task.metric;
  }
  $('#reveal-answer').addEventListener('click', () => {
    const open = $('#reference-answer').hidden;
    $('#reference-answer').hidden = !open;
    $('#reveal-answer').setAttribute('aria-expanded', String(open));
    $('#reveal-answer').innerHTML = `${open ? 'Hide reference' : 'Reveal reference'} <span aria-hidden="true">${open ? '−' : '↗'}</span>`;
  });
  $('#expand-evidence').addEventListener('click', () => {
    const task = data.tasks[selectedTask];
    showFigure(`./${task.image}`, `${task.id} · ${task.caption}`, true);
  });
  $('#full-example').addEventListener('click', () => {
    const task = data.tasks[selectedTask];
    showFigure(`./${task.example}`, `${task.id} · Paper example and model responses`);
  });
  renderExample(selectedTask);

  const axes = {
    1: {
      kicker: 'Vary the visual context', question: 'Can the model find the evidence?',
      description: 'Re-evaluate the same diagnosis with selected images, retained images, or uniformly sampled video frames.',
      fixed: 'Fixed: examination, question, diagnostic target, answer space and scoring.',
      labels: ['Selected', 'Retained', 'Video-128', 'Video-256', 'Video-512'],
      descriptions: [
        'Compact, target-relevant selected images provide the diagnostic evidence.',
        'The retained examination image set adds broader, less selected visual context.',
        'The video is represented by 128 uniformly sampled frames.',
        'The video is represented by 256 uniformly sampled frames.',
        'The video is represented by 512 uniformly sampled frames.',
      ],
      chartTitle: 'Diagnostic-impression accuracy', population: '193 examinations · 9 models',
      takeaway: '<b>Selection matters beyond frame count.</b> In a separate equal-count comparison, replacing selected images with uniformly sampled video frames reduces accuracy for all nine models—by 8.8 percentage points on average.',
    },
    2: {
      kicker: 'Make clinical state explicit', question: 'Can the model use the clinical state?',
      description: 'Keep images fixed. Progressively supply clinical state and guideline information for the same pathology-backed H. pylori decision.',
      fixed: 'Fixed: images, examination, question, pathology-backed target and scoring.',
      labels: ['Images', '+ Anatomy', '+ Findings', '+ Sign polarity', '+ Threshold'],
      descriptions: [
        'The model makes the downstream decision from images alone.',
        'Anatomical locations are added to the unchanged visual evidence.',
        'Clinical findings are supplied along with the anatomical information.',
        'The guideline mapping makes infection-associated and infection-negative signs explicit.',
        'The added decision rule predicts infection when positive signs outnumber negative signs by at least two. This intervention belongs to Axis 2.',
      ],
      chartTitle: 'Balanced accuracy', population: '1,220 examinations · 19 models',
      takeaway: '<b>Sign polarity produces the largest fleet-level gain.</b> Its adjacent transition changes Cohen’s κ by +0.076. The final state reaches 61.9% balanced accuracy, so access to the rule still leaves room for improvement in its application.',
    },
  };
  for (const button of $$('.axis-switch button')) button.addEventListener('click', () => {
    stopPlayback();
    selectedAxis = Number(button.dataset.axis);
    axisState = selectedAxis === 2 ? 4 : 0;
    renderAxis();
  });
  tabKeyboard($('.axis-switch'));
  function updatePlaybackButton() {
    $('#axis-play').setAttribute('aria-pressed', String(playing));
    $('#axis-play').innerHTML = playing ? '<span aria-hidden="true">Ⅱ</span> Pause' : `<span aria-hidden="true">▷</span> ${axisState === 4 ? 'Replay' : 'Play'} ${selectedAxis === 2 ? 'cascade' : 'conditions'}`;
  }
  function stopPlayback() {
    clearTimeout(playbackTimer);
    playbackTimer = null;
    playing = false;
    updatePlaybackButton();
  }
  $('#axis-play').addEventListener('click', () => {
    if (playing) { stopPlayback(); return; }
    playing = true;
    if (axisState === 4) axisState = 0;
    updateAxisState();
    const advance = () => {
      if (axisState < 4) {
        axisState++;
        updateAxisState();
        if (axisState < 4) playbackTimer = setTimeout(advance, 1700);
        else stopPlayback();
      } else stopPlayback();
    };
    playbackTimer = setTimeout(advance, 1700);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
  new IntersectionObserver(entries => {
    if (entries.some(entry => !entry.isIntersecting)) stopPlayback();
  }).observe($('#axis-panel'));
  function renderAxis() {
    radar?.destroy();
    radar = null;
    evidenceChart?.destroy();
    evidenceChart = null;
    const info = axes[selectedAxis];
    for (const button of $$('.axis-switch button')) {
      const active = Number(button.dataset.axis) === selectedAxis;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    $('#axis-panel').setAttribute('aria-labelledby', `axis-tab-${selectedAxis}`);
    $('#axis-panel').classList.toggle('cascade', selectedAxis === 2);
    $('#axis-panel').classList.toggle('presentation', selectedAxis === 1);
    for (const key of ['kicker', 'question', 'description', 'fixed']) $(`#axis-${key}`).textContent = info[key];
    $('#axis-chart-title').textContent = info.chartTitle;
    $('#axis-chart-population').textContent = info.population;
    $('#axis-takeaway').innerHTML = info.takeaway;
    $('#axis-states').innerHTML = info.labels.map((label, i) => `<button type="button" data-state="${i}" aria-pressed="${i === axisState}" aria-label="${escapeHTML(label)}">${selectedAxis === 2 ? `<i class="state-swatch" style="--state-color:${stateColors[i]}" aria-hidden="true"></i>${escapeHTML(label)}` : evidenceCondition(i)}</button>`).join('');
    for (const button of $$('#axis-states button')) button.addEventListener('click', () => {
      stopPlayback();
      axisState = Number(button.dataset.state);
      updateAxisState();
    });
    $('#axis-playback').hidden = false;
    $('#cascade-mean').hidden = selectedAxis !== 2;
    $('#presentation-mean').hidden = selectedAxis !== 1;
    $('#axis-chart-key').innerHTML = selectedAxis === 1 ? '<span><i class="key-line"></i>Mean across nine models</span><span><i class="key-line grey"></i>Individual models</span>' : '<span><i class="family-dot general"></i>General · 9</span><span><i class="family-dot video"></i>Video · 2</span><span><i class="family-dot medical"></i>Medical · 8</span>';
    $('#axis-chart-note').textContent = selectedAxis === 1 ? 'Ordinary model means; the equal-count contrast is a separate analysis.' : 'Each spoke is a model; colours follow the five states. Radial range: 30–80% BA. Dashed ring: 50% chance.';
    updateAxisState();
  }
  function updateAxisState() {
    const info = axes[selectedAxis];
    for (const button of $$('#axis-states button')) button.setAttribute('aria-pressed', String(Number(button.dataset.state) === axisState));
    let delta = '';
    if (selectedAxis === 2 && axisState > 0) {
      const states = data.axis2.states;
      const value = states[axisState].mean_kappa - states[axisState - 1].mean_kappa;
      delta = ` Adjacent Δκ: ${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3)}.`;
    }
    $('#axis-state-detail').innerHTML = `<b>${escapeHTML(info.labels[axisState])}</b>${escapeHTML(info.descriptions[axisState] + delta)}`;
    if (selectedAxis === 2) {
      $('#axis-state-mean').textContent = percent(data.axis2.states[axisState].mean_balanced_accuracy);
    } else {
      $('#axis1-state-mean').textContent = percent(data.axis1.means[axisState]);
      const delta = (data.axis1.means[axisState] - data.axis1.means[0]) * 100;
      $('#axis1-delta').textContent = axisState === 0 ? 'Selected-image baseline' : `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)} pp vs selected images`;
    }
    $('#axis-step-count').textContent = `${axisState + 1} / 5 ${selectedAxis === 2 ? 'states' : 'conditions'}`;
    updatePlaybackButton();
    drawChart();
  }
  function drawChart() {
    if (selectedAxis === 2) {
      radar ??= mountAxis2Radar($('#axis-chart'), data.axis2);
      radar.setState(axisState);
      return;
    }
    evidenceChart ??= mountAxis1Evidence($('#axis-chart'), data.axis1, index => {
      stopPlayback();
      axisState = index;
      updateAxisState();
    });
    evidenceChart.setState(axisState);
  }
  renderAxis();

  // The default viewing order balances the six tasks. Average tied ranks within
  // each deterministic readout, then within each task, then across tasks.
  // SEFR and ELRC are descriptive judge readouts, so they do not set this order.
  const judgeMetrics = new Set([15, 18]);
  const metricRanks = data.models.map(model => data.metrics.map((_, index) => {
    const higher = data.models.filter(other => other.scores[index] > model.scores[index]).length;
    const tied = data.models.filter(other => other.scores[index] === model.scores[index]).length;
    return 1 + higher + (tied - 1) / 2;
  }));
  const overallRanks = new Map(data.models.map((model, position) => {
    const taskRanks = data.tasks.map(task => {
      const indices = task.indices.filter(index => !judgeMetrics.has(index));
      return indices.reduce((sum, index) => sum + metricRanks[position][index], 0) / indices.length;
    });
    return [model.name, taskRanks.reduce((sum, rank) => sum + rank, 0) / taskRanks.length];
  }));
  const indices = data.tasks.flatMap(task => task.indices);
  const taskStarts = new Set(data.tasks.map(task => task.indices[0]));
  const compactLabels = { 4: 'Enum. · single', 5: 'Enum. · exact set', 8: 'Position / dist.', 14: 'BioBERT' };
  const maxima = data.metrics.map((_, index) => Math.max(...data.models.map(model => model.scores[index] ?? -1)));

  $('#overall-sort').addEventListener('click', () => {
    sortMetric = null;
    renderResults();
  });
  for (const id of ['model-search', 'family-filter', 'show-physician']) $(`#${id}`).addEventListener(id === 'model-search' ? 'input' : 'change', renderResults);
  function renderResults() {
    const query = $('#model-search').value.trim().toLocaleLowerCase();
    const family = $('#family-filter').value;
    const matches = data.models.filter(model => (family === 'all' || model.family === family) && model.name.toLocaleLowerCase().includes(query));
    const compareOverall = (a, b) => overallRanks.get(a.name) - overallRanks.get(b.name);
    matches.sort((a, b) => sortMetric === null ? compareOverall(a, b) : (sortDescending ? -1 : 1) * (a.scores[sortMetric] - b.scores[sortMetric]) || compareOverall(a, b));
    $('#overall-sort').setAttribute('aria-pressed', String(sortMetric === null));
    $('#results-head').innerHTML = `<tr class="task-groups"><th scope="col" rowspan="2" class="model-heading">Model<small>Family</small></th>${data.tasks.map(task => `<th scope="colgroup" colspan="${task.indices.length}" class="task-group task-${task.id.toLowerCase()}" id="group-${task.id}"><span>${escapeHTML(task.id)}</span>${escapeHTML(task.name)}<small>${number(task.count)} items</small></th>`).join('')}</tr><tr class="metric-headings">${indices.map(index => `<th scope="col" id="metric-${index}" class="${taskStarts.has(index) ? 'task-start' : ''}" aria-sort="${sortMetric === index ? (sortDescending ? 'descending' : 'ascending') : 'none'}"><button type="button" data-sort="${index}" title="${escapeHTML(data.metrics[index].label)}: ${escapeHTML(data.metrics[index].description)}. Click to sort.">${escapeHTML(compactLabels[index] || data.metrics[index].label)}<span class="sort-indicator" aria-hidden="true">${sortMetric === index ? (sortDescending ? '↓' : '↑') : '↕'}</span></button></th>`).join('')}</tr>`;
    const scoreCells = (model, highlight = false) => indices.map(index => {
      const score = model.scores[index];
      return `<td class="score-cell ${taskStarts.has(index) ? 'task-start' : ''} ${highlight && score === maxima[index] ? 'best' : ''}"><span style="--heat:${score === null ? 0 : .08 + score * .5}">${score === null ? '—' : score.toFixed(3)}</span></td>`;
    }).join('');
    $('#results-body').innerHTML = matches.length ? matches.map(model => `<tr><th class="model-cell" scope="row"><span class="model-name">${escapeHTML(model.name)}</span><small>${escapeHTML(model.family)}</small></th>${scoreCells(model, true)}</tr>`).join('') : `<tr class="empty-row"><td colspan="${indices.length + 1}"><span>No models match. Try another name or model family.</span></td></tr>`;
    $('#results-foot').innerHTML = `<tr><th scope="row">Random reference</th>${scoreCells(data.random)}</tr>` + ($('#show-physician').checked ? `<tr><th scope="row">Physician · reader-study subset</th>${scoreCells(data.physician)}</tr>` : '');
    $('#model-count').textContent = `${matches.length} of ${data.models.length} models · ${sortMetric === null ? 'Overall performance' : `${data.metrics[sortMetric].label} ${sortDescending ? '↓' : '↑'}`}`;
    for (const button of $$('[data-sort]')) button.addEventListener('click', () => {
      const index = Number(button.dataset.sort);
      sortDescending = sortMetric === index ? !sortDescending : true;
      sortMetric = index;
      renderResults();
      $(`[data-sort="${index}"]`).focus({ preventScroll: true });
    });
  }
  renderResults();

  for (const link of $$('a[href="#results"]')) link.addEventListener('click', () => { $('#results').open = true; });

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      for (const link of $$('#primary-nav a[href^="#"]')) {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
  for (const id of ['benchmark', 'construction', 'results', 'axes']) observer.observe($(`#${id}`));
}

initialize().catch(error => {
  console.error(error);
  for (const selector of ['#example-panel', '#axis-panel', '#results-body']) {
    const target = $(selector);
    if (selector === '#results-body') target.innerHTML = '<tr><td>Interactive results could not load. Read the paper for the complete results.</td></tr>';
    else target.textContent = 'Interactive content could not load. The paper contains the complete examples and results.';
  }
});
