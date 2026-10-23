const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const percent = value => `${(value * 100).toFixed(1)}%`;
const labels = ['Selected', 'Retained', '128 frames', '256 frames', '512 frames'];

export function evidenceCondition(index) {
  const stills = index < 2;
  const artwork = index === 0
    ? '<rect x="14" y="7" width="34" height="23" rx="3"/><path d="m19 24 8-8 7 6 5-4 5 6"/><circle cx="39" cy="13" r="2"/><path class="evidence-check" d="m43 8 4 4 8-9"/>'
    : index === 1
      ? '<rect x="21" y="4" width="31" height="21" rx="3"/><rect x="16" y="8" width="31" height="21" rx="3"/><rect x="11" y="12" width="31" height="21" rx="3"/><path d="m16 27 7-7 6 5 5-4 4 6"/>'
      : `<rect x="8" y="7" width="48" height="25" rx="3"/><path d="M8 13h48M8 26h48"/><path class="film-perforations" d="M13 10h2m6 0h2m6 0h2m6 0h2m6 0h2m-34 19h2m6 0h2m6 0h2m6 0h2m6 0h2"/><path d="m29 16 7 4-7 4z"/>`;
  return `<svg viewBox="0 0 64 38" aria-hidden="true">${artwork}</svg><span class="evidence-condition-label">${stills ? labels[index] : [128, 256, 512][index - 2]}</span><small>${stills ? (index === 0 ? 'Target-relevant images' : 'Broader image set') : 'video frames'}</small>`;
}

export function mountAxis1Evidence(container, board, onSelect) {
  const left = 56, right = 668, top = 66, bottom = 296;
  const xs = [102, 240, 392, 510, 628];
  const y = value => bottom - (value - .2) / .6 * (bottom - top);
  const coordinates = values => values.map((value, index) => `${xs[index]},${y(value)}`).join(' ');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let state = -1, selectedModel = 'all', frame = null;
  let focus = { x: xs[0], y: y(board.means[0]) };

  const grid = [.2, .4, .6, .8].map(value => `<line class="evidence-grid" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/><text class="evidence-tick" x="${left - 14}" y="${y(value) + 4}" text-anchor="end">${value * 100}</text>`).join('');
  const traces = board.models.map(model => `<polyline class="evidence-model-trace" data-model="${model.id}" points="${coordinates(model.scores)}"><title>${escapeHTML(model.name)}</title></polyline>`).join('');
  const selectors = board.means.map((value, index) => `<g class="evidence-chart-condition" data-chart-state="${index}" role="button" tabindex="0" aria-label="${labels[index]}: ${percent(value)} mean accuracy"><rect x="${xs[index] - 38}" y="${top}" width="76" height="${bottom - top + 53}" fill="transparent"/><circle class="evidence-mean-point" cx="${xs[index]}" cy="${y(value)}" r="4.5"/><text class="evidence-point-label" x="${xs[index]}" y="${y(value) + 23}" text-anchor="middle">${percent(value)}</text><text class="evidence-condition-tick" x="${xs[index]}" y="${bottom + 29}" text-anchor="middle">${index < 2 ? labels[index] : [128, 256, 512][index - 2]}</text><text class="evidence-condition-unit" x="${xs[index]}" y="${bottom + 44}" text-anchor="middle">${index < 2 ? 'images' : 'frames'}</text></g>`).join('');
  container.innerHTML = `<div class="evidence-comparison" data-state="0" data-animating="false"><svg viewBox="0 0 724 366" role="group" aria-labelledby="evidence-chart-title evidence-chart-desc"><title id="evidence-chart-title">Axis 1 · Diagnostic accuracy across five evidence presentations</title><desc id="evidence-chart-desc">The same 193 examinations and nine models. Selected images and retained images are compared with 128, 256 and 512 uniformly sampled video frames. Green is the model mean; thin lines show individual models. The dashed line is 25 percent chance. The vertical scale runs from 20 to 80 percent.</desc><rect class="evidence-image-zone" x="${left}" y="${top - 7}" width="234" height="${bottom - top + 7}" rx="7"/><rect class="evidence-video-zone" x="344" y="${top - 7}" width="${right - 344}" height="${bottom - top + 7}" rx="7"/><text class="evidence-group-label" x="173" y="32" text-anchor="middle">IMAGE CONTEXT</text><path class="evidence-group-rule" d="M66 43H280M354 43H658"/><text class="evidence-group-label video" x="506" y="32" text-anchor="middle">UNIFORMLY SAMPLED VIDEO</text>${grid}<line class="evidence-chance" x1="${left}" x2="${right}" y1="${y(.25)}" y2="${y(.25)}"/><text class="evidence-chance-label" x="${right - 5}" y="${y(.25) - 7}" text-anchor="end">25% chance</text><rect class="evidence-focus-band" x="${focus.x - 29}" y="${top - 7}" width="58" height="${bottom - top + 7}" rx="6"/>${traces}<polyline class="evidence-selected-trace" points=""/><g class="evidence-selected-points"></g><polyline class="evidence-mean-trace" points="${coordinates(board.means)}"/>${selectors}<g class="evidence-focus" transform="translate(${focus.x},${focus.y})"><circle class="evidence-focus-halo" r="13"/><circle class="evidence-focus-point" r="7"/><g class="evidence-focus-label" transform="translate(0,-32)"><rect x="-30" y="-12" width="60" height="24" rx="12"/><text text-anchor="middle" dominant-baseline="middle">${percent(board.means[0])}</text></g></g></svg><div class="evidence-model-control"><label for="evidence-model">Follow a model</label><select id="evidence-model" aria-label="Axis 1 model"><option value="all">Mean across nine models</option>${board.models.map(model => `<option value="${model.id}">${escapeHTML(model.name)}</option>`).join('')}</select></div><div class="evidence-values" aria-live="polite"></div><p class="evidence-chart-hint">Choose a model to highlight its trajectory across the same five conditions.</p></div>`;
  const root = container.querySelector('.evidence-comparison');
  const beam = root.querySelector('.evidence-focus-band');
  const focusNode = root.querySelector('.evidence-focus');
  const conditionNodes = [...root.querySelectorAll('[data-chart-state]')];

  function updateReadout() {
    const model = board.models.find(model => model.id === selectedModel);
    const values = model ? model.scores : board.means;
    root.classList.toggle('has-model', Boolean(model));
    root.querySelector('.evidence-values').innerHTML = values.map((value, i) => `<div class="${i === state ? 'is-active' : ''}" data-evidence-value="${value}"><span>${labels[i]}</span><b>${percent(value)}</b></div>`).join('');
    for (const trace of root.querySelectorAll('.evidence-model-trace')) trace.classList.toggle('is-selected', trace.dataset.model === selectedModel);
    root.querySelector('.evidence-selected-trace').setAttribute('points', model ? coordinates(model.scores) : '');
    root.querySelector('.evidence-selected-points').innerHTML = model ? model.scores.map((value, index) => `<circle cx="${xs[index]}" cy="${y(value)}" r="4" data-value="${value}"/>`).join('') : '';
  }
  function draw(position) {
    focus = position;
    beam.setAttribute('x', position.x - 29);
    focusNode.setAttribute('transform', `translate(${position.x},${position.y})`);
  }
  function setState(index, animate = true) {
    if (state === index) return;
    state = index;
    if (frame !== null) cancelAnimationFrame(frame);
    root.dataset.state = String(index);
    root.classList.toggle('is-video', index > 1);
    root.querySelector('.evidence-focus-label text').textContent = percent(board.means[index]);
    for (const node of conditionNodes) {
      const current = Number(node.dataset.chartState) === index;
      node.classList.toggle('is-active', current);
      node.setAttribute('aria-pressed', String(current));
    }
    updateReadout();
    const from = { ...focus }, to = { x: xs[index], y: y(board.means[index]) };
    if (!animate || motion.matches) {
      draw(to);
      frame = null;
      root.dataset.animating = 'false';
      return;
    }
    const start = performance.now();
    root.dataset.animating = 'true';
    const tick = now => {
      const t = Math.min(1, (now - start) / 600), eased = 1 - (1 - t) ** 3;
      draw({ x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased });
      if (t < 1) frame = requestAnimationFrame(tick);
      else { frame = null; root.dataset.animating = 'false'; }
    };
    frame = requestAnimationFrame(tick);
  }
  for (const node of conditionNodes) {
    const index = Number(node.dataset.chartState);
    node.addEventListener('click', () => onSelect(index));
    node.addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(index); }
      else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const next = (index + (event.key === 'ArrowRight' ? 1 : 4)) % 5;
        onSelect(next);
        conditionNodes[next].focus();
      }
    });
  }
  root.querySelector('select').addEventListener('change', event => {
    selectedModel = event.target.value;
    updateReadout();
  });
  const finishMotion = () => {
    if (!motion.matches || state < 0) return;
    if (frame !== null) cancelAnimationFrame(frame);
    draw({ x: xs[state], y: y(board.means[state]) });
    frame = null;
    root.dataset.animating = 'false';
  };
  motion.addEventListener('change', finishMotion);
  return {
    setState,
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      motion.removeEventListener('change', finishMotion);
    },
  };
}
