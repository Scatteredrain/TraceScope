const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const percent = value => `${(value * 100).toFixed(1)}%`;

// State colours and family blocks follow the frozen paper radar.
export const stateColors = ['#A0CAE9', '#6680DB', '#5843D0', '#7230B0', '#7F218E'];
const stateLabels = ['Images', '+ Anatomy', '+ Findings', '+ Sign polarity', '+ Threshold'];
const familyColors = { General: '#1F7A75', Video: '#B44A3C', Medical: '#5B7B9A' };
const shortNames = { minicpm_v45_8b: 'MiniCPM-V-4.5', llava_next_video_7b_video: 'LLaVA-NeXT-Video', videochat_flash_7b: 'VideoChat-Flash' };

export function mountAxis2Radar(container, board) {
  const { roster: models, radial_scale: scale } = board;
  const cx = 380, cy = 314, radius = 213;
  const angle = index => -Math.PI / 2 + index * Math.PI * 2 / models.length;
  const point = (index, r) => [cx + Math.cos(angle(index)) * r, cy + Math.sin(angle(index)) * r];
  const radial = value => (value - scale.min) / (scale.max - scale.min) * radius;
  const points = values => values.map((value, i) => point(i, radial(value)).map(n => n.toFixed(3)).join(',')).join(' ');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 680px)');
  let state = -1, selectedModel = 0, frame = null;
  let displayed = models.map(model => model.scores[0]);

  const rings = [.4, .5, .6, .7, .8].map(value => `<circle class="radar-ring ${value === scale.chance ? 'radar-chance' : ''}" cx="${cx}" cy="${cy}" r="${radial(value)}"/>`).join('');
  const spokes = models.map((_, i) => {
    const [x, y] = point(i, radius);
    return `<line class="radar-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  }).join('');
  const families = Object.entries(familyColors).map(([family, color]) => {
    const indices = models.flatMap((model, i) => model.family === family ? [i] : []);
    const first = indices[0] - .42, last = indices.at(-1) + .42;
    const [x1, y1] = point(first, radius + 10), [x2, y2] = point(last, radius + 10);
    return `<path class="radar-family-arc" stroke="${color}" d="M ${x1},${y1} A ${radius + 10},${radius + 10} 0 0 1 ${x2},${y2}"/>`;
  }).join('');
  const profiles = board.states.map((_, index) => {
    const values = models.map(model => model.scores[index]);
    return `<g class="radar-profile" data-profile="${index}" style="--state-color:${stateColors[index]}"><polygon points="${points(values)}"/>${values.map((value, i) => {
      const [x, y] = point(i, radial(value));
      return `<circle cx="${x}" cy="${y}" r="1.9" data-value="${value}"/>`;
    }).join('')}</g>`;
  }).join('');
  const labels = models.map((model, i) => {
    const [x, y] = point(i, radius + 30), [nx, ny] = point(i, radius + 31);
    const cosine = Math.cos(angle(i));
    const anchor = cosine > .15 ? 'start' : cosine < -.15 ? 'end' : 'middle';
    const [x1, y1] = point(i - .42, radius + 17), [x2, y2] = point(i + .42, radius + 17);
    return `<g class="radar-model ${i === 0 ? 'is-selected' : ''}" data-radar-model="${i}" role="button" tabindex="0" aria-label="${escapeHTML(model.name)}"><title>${escapeHTML(model.name)}</title><path class="radar-model-hit" d="M ${cx},${cy} L ${x1},${y1} A ${radius + 17},${radius + 17} 0 0 1 ${x2},${y2} Z"/><text class="radar-model-label" x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHTML(shortNames[model.id] || model.name)}</text><text class="radar-spoke-number" x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="middle">${String(i + 1).padStart(2, '0')}</text></g>`;
  }).join('');
  const ringLabels = [.4, .5, .6, .7, .8].map(value => `<text class="radar-ring-label" x="${cx + 6}" y="${cy - radial(value) + 3}">${Math.round(value * 100)}%${value === scale.chance ? ' · chance' : ''}</text>`).join('');

  container.innerHTML = `<div class="radar" data-state="0" data-animating="false"><svg viewBox="0 0 760 614" role="group" aria-labelledby="radar-title radar-description"><title id="radar-title">Axis 2 · Balanced accuracy across 19 models</title><desc id="radar-description">Each spoke is one model. Five polygons represent cumulative information states. Radial range: 30 to 80 percent; the dashed ring is 50 percent chance. Select a model for its five exact values.</desc>${rings}${spokes}${families}${profiles}<line class="radar-selected-spoke" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - radius}"/><polygon class="radar-active" points="${points(displayed)}"/>${models.map((model, i) => `<circle class="radar-active-point" data-model="${model.id}" r="3.6"/>`).join('')}${ringLabels}<text class="radar-center-label" x="${cx}" y="${cy + 4}" text-anchor="middle">30%</text>${labels}</svg><div class="radar-model-control"><label for="radar-model">Explore a model</label><select id="radar-model" aria-label="Radar model">${models.map((model, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} · ${escapeHTML(model.name)}</option>`).join('')}</select></div><div class="radar-values" aria-live="polite"></div><p class="radar-hint">Select a spoke or choose a model to compare its five states.</p></div>`;
  const root = container.querySelector('.radar');
  const active = root.querySelector('.radar-active');
  const markers = [...root.querySelectorAll('.radar-active-point')];
  const modelNodes = [...root.querySelectorAll('[data-radar-model]')];
  const select = root.querySelector('select');
  function fitView() {
    root.querySelector('svg').setAttribute('viewBox', compact.matches ? '100 34 560 560' : '0 0 760 614');
  }
  fitView();
  compact.addEventListener('change', fitView);

  function draw(values) {
    displayed = values;
    active.setAttribute('points', points(values));
    for (let i = 0; i < markers.length; i++) {
      const [x, y] = point(i, radial(values[i]));
      markers[i].setAttribute('cx', x);
      markers[i].setAttribute('cy', y);
    }
  }
  function updateReadout() {
    const model = models[selectedModel];
    root.querySelector('.radar-values').innerHTML = model.scores.map((value, i) => `<div class="${state === i ? 'is-active' : ''}" data-readout-state="${i}" style="--state-color:${stateColors[i]}"><span>${stateLabels[i]}</span><b>${percent(value)}</b></div>`).join('');
    for (const node of modelNodes) node.classList.toggle('is-selected', Number(node.dataset.radarModel) === selectedModel);
    const [x, y] = point(selectedModel, radius + 9);
    const line = root.querySelector('.radar-selected-spoke');
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);
    line.style.stroke = familyColors[model.family];
    select.value = String(selectedModel);
  }
  function chooseModel(index) {
    selectedModel = index;
    updateReadout();
  }
  for (const node of modelNodes) {
    const index = Number(node.dataset.radarModel);
    node.addEventListener('pointerenter', () => chooseModel(index));
    node.addEventListener('focus', () => chooseModel(index));
    node.addEventListener('click', () => chooseModel(index));
    node.addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); chooseModel(index); }
      else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        modelNodes[(index + (event.key === 'ArrowRight' ? 1 : models.length - 1)) % models.length].focus();
      }
    });
  }
  select.addEventListener('change', () => chooseModel(Number(select.value)));

  function setState(index, animate = true) {
    if (index === state) return;
    state = index;
    if (frame !== null) cancelAnimationFrame(frame);
    const from = [...displayed], to = models.map(model => model.scores[index]);
    root.dataset.state = String(index);
    root.style.setProperty('--active-color', stateColors[index]);
    for (const profile of root.querySelectorAll('.radar-profile')) profile.classList.toggle('is-current', Number(profile.dataset.profile) === index);
    for (let i = 0; i < models.length; i++) {
      markers[i].dataset.value = String(to[i]);
      modelNodes[i].setAttribute('aria-label', `${models[i].name}: ${stateLabels[index]}, ${percent(to[i])} balanced accuracy`);
    }
    updateReadout();
    if (!animate || motion.matches) {
      draw(to);
      root.dataset.animating = 'false';
      frame = null;
      return;
    }
    const start = performance.now();
    root.dataset.animating = 'true';
    const tick = now => {
      const t = Math.min(1, (now - start) / 650), eased = 1 - (1 - t) ** 3;
      draw(to.map((value, i) => from[i] + (value - from[i]) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else { root.dataset.animating = 'false'; frame = null; }
    };
    frame = requestAnimationFrame(tick);
  }
  function finishMotion() {
    if (!motion.matches || state < 0) return;
    if (frame !== null) cancelAnimationFrame(frame);
    draw(models.map(model => model.scores[state]));
    root.dataset.animating = 'false';
    frame = null;
  }
  motion.addEventListener('change', finishMotion);
  draw(displayed);
  return {
    setState,
    destroy() {
      if (frame !== null) cancelAnimationFrame(frame);
      motion.removeEventListener('change', finishMotion);
      compact.removeEventListener('change', fitView);
    },
  };
}
