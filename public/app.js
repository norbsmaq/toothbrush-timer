(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TEETH_PER_ARCH = 16;
  const STORAGE_KEY = 'toothbrush-timer-settings';

  // Names for each arch section, ordered from the user's right to their left.
  const PART_NAMES = {
    1: [''],
    2: ['right', 'left'],
    3: ['right', 'front', 'left'],
    4: ['right back', 'right front', 'left front', 'left back'],
  };

  // Geometry of the two arches in the SVG viewBox (300 x 370).
  const ARCHES = {
    upper: { cx: 150, cy: 172, rx: 108, ry: 128, dir: -1, scale: 1 },
    lower: { cx: 150, cy: 200, rx: 98, ry: 118, dir: 1, scale: 0.9 },
  };

  // ---------- Settings ----------

  const defaults = {
    duration: 120,
    zones: 4,
    sound: true,
    voice: false,
    vibrate: true,
    countdown: true,
    mirror: true,
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode etc.) - settings just won't persist.
    }
  }

  const settings = loadSettings();

  // ---------- Zones ----------

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Brushing order: upper arch right -> left, then lower arch left -> right.
  function buildZones(count) {
    const perArch = count / 2;
    const parts = PART_NAMES[perArch];
    const zones = [];
    for (let j = 0; j < perArch; j++) {
      zones.push({ arch: 'upper', seg: j, name: `Upper ${parts[j]}`.trim() });
    }
    for (let j = perArch - 1; j >= 0; j--) {
      zones.push({ arch: 'lower', seg: j, name: `Lower ${parts[j]}`.trim() });
    }
    if (perArch === 1) {
      zones[0].name = 'Upper teeth';
      zones[1].name = 'Lower teeth';
    }
    return zones;
  }

  function zoneIndexFor(arch, seg, perArch) {
    return arch === 'upper' ? seg : perArch + (perArch - 1 - seg);
  }

  // ---------- Diagram ----------

  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Tooth size by position counted from the back of the mouth.
  function toothSize(i) {
    const d = Math.min(i, TEETH_PER_ARCH - 1 - i);
    if (d === 0) return [19, 22];      // third molar
    if (d <= 2) return [21, 24];       // molars
    if (d <= 4) return [16, 20];       // premolars
    if (d === 5) return [15, 20];      // canine
    if (d === 6) return [13, 16];      // lateral incisor
    return [15, 17];                   // central incisor
  }

  function archPoint(a, theta, side, radiusFactor = 1) {
    return {
      x: a.cx + side * a.rx * radiusFactor * Math.cos(theta),
      y: a.cy + a.dir * a.ry * radiusFactor * Math.sin(theta),
    };
  }

  let toothEls = [];   // [{ node, zone }]
  let zoneNumEls = []; // indexed by zone

  function drawDiagram() {
    const svg = $('teeth');
    svg.replaceChildren();
    toothEls = [];
    zoneNumEls = [];

    const perArch = settings.zones / 2;
    // In mirror view the user's right appears on the right of the screen.
    const side = settings.mirror ? 1 : -1;

    for (const [archName, a] of Object.entries(ARCHES)) {
      // Gum line
      const pts = [];
      for (let t = 0.04; t <= Math.PI - 0.04; t += Math.PI / 60) {
        const p = archPoint(a, t, side);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      el('polyline', { points: pts.join(' '), class: 'gum', 'stroke-width': 30 }, svg);

      // Teeth, i = 0 is the user's right back molar
      const segAngles = Array.from({ length: perArch }, () => []);
      for (let i = 0; i < TEETH_PER_ARCH; i++) {
        const theta = ((i + 0.5) * Math.PI) / TEETH_PER_ARCH;
        const p = archPoint(a, theta, side);
        const dx = -side * a.rx * Math.sin(theta);
        const dy = a.dir * a.ry * Math.cos(theta);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const [w, h] = toothSize(i).map((v) => v * a.scale);
        const seg = Math.floor(((i + 0.5) * perArch) / TEETH_PER_ARCH);
        const zone = zoneIndexFor(archName, seg, perArch);
        segAngles[seg].push(theta);

        const rect = el('rect', {
          x: -w / 2, y: -h / 2, width: w, height: h, rx: Math.min(w, h) / 3,
          transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
          class: 'tooth' + (zone % 2 ? ' alt' : ''),
        }, svg);
        toothEls.push({ node: rect, zone });
      }

      // Zone number inside the arch at the middle of each section
      segAngles.forEach((angles, seg) => {
        const mid = angles.reduce((s, t) => s + t, 0) / angles.length;
        const p = archPoint(a, mid, side, perArch === 1 ? 0.45 : 0.68);
        const zone = zoneIndexFor(archName, seg, perArch);
        const text = el('text', { x: p.x, y: p.y, class: 'zone-num' }, svg);
        text.textContent = zone + 1;
        zoneNumEls[zone] = text;
      });
    }

    const upperLabel = el('text', { x: 150, y: 150, class: 'arch-label' }, svg);
    upperLabel.textContent = 'UPPER';
    const lowerLabel = el('text', { x: 150, y: 222, class: 'arch-label' }, svg);
    lowerLabel.textContent = 'LOWER';

    const right = el('text', { x: 150 + side * 132, y: 186, class: 'side-label' }, svg);
    right.textContent = 'R';
    const left = el('text', { x: 150 - side * 132, y: 186, class: 'side-label' }, svg);
    left.textContent = 'L';

    updateDiagram();
  }

  function updateDiagram() {
    const active = state === 'running' || state === 'paused' ? currentZone : -1;
    const allDone = state === 'done';
    for (const { node, zone } of toothEls) {
      node.classList.toggle('active', zone === active);
      node.classList.toggle('done', allDone || (active >= 0 && zone < active));
    }
    zoneNumEls.forEach((node, zone) => {
      node.classList.toggle('active', zone === active);
      node.classList.toggle('done', allDone || (active >= 0 && zone < active));
    });
  }

  // ---------- Audio / voice / vibration ----------

  let audioCtx = null;

  function unlockAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function tone(freq, start, dur, vol = 0.3, type = 'sine') {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  const sounds = {
    tick: () => tone(1000, 0, 0.08, 0.15, 'triangle'),
    go: () => { tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.35); },
    switch: () => { tone(784, 0, 0.2, 0.35); tone(1047, 0.2, 0.4, 0.35); },
    done: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, i === 4 ? 0.9 : 0.3)),
  };

  function play(name) {
    if (settings.sound) sounds[name]();
  }

  function say(text) {
    if (!settings.voice || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function buzz(pattern) {
    if (settings.vibrate && navigator.vibrate) navigator.vibrate(pattern);
  }

  function flash(small, big) {
    const f = $('flash');
    $('flashSmall').textContent = small;
    $('flashBig').textContent = big;
    f.classList.remove('show');
    void f.offsetWidth; // restart the animation
    f.classList.add('show');
  }

  // Keep the screen awake while brushing (needs HTTPS or localhost).
  let wakeLock = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release();
    wakeLock = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (state === 'running' || state === 'lead-in')) {
      requestWakeLock();
    }
  });

  // ---------- Timer ----------

  // idle | lead-in | running | paused | done
  let state = 'idle';
  let zones = buildZones(settings.zones);
  let currentZone = -1;
  let elapsed = 0;
  let leadIn = 0;
  let lastTick = 0;
  let interval = null;
  let lastTickSecond = null;

  const totalMs = () => settings.duration * 1000;
  const zoneMs = () => totalMs() / zones.length;

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function start() {
    unlockAudio();
    requestWakeLock();
    elapsed = 0;
    currentZone = -1;
    lastTickSecond = null;
    if (settings.countdown) {
      state = 'lead-in';
      leadIn = 3000;
    } else {
      beginBrushing();
    }
    lastTick = performance.now();
    clearInterval(interval);
    interval = setInterval(tick, 100);
    render();
  }

  function beginBrushing() {
    state = 'running';
    play('go');
    buzz(150);
    switchZone(0, true);
  }

  function switchZone(index, first = false) {
    currentZone = index;
    lastTickSecond = null;
    const name = zones[index].name;
    if (!first) {
      play('switch');
      buzz([200, 100, 200]);
    }
    flash(first ? 'Start with' : 'Switch to', name);
    say(first ? `Start with ${name}` : `Switch to ${name}`);
    updateDiagram();
  }

  function tick() {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;

    if (state === 'lead-in') {
      leadIn -= dt;
      const sec = Math.ceil(leadIn / 1000);
      if (sec > 0 && sec !== lastTickSecond) {
        lastTickSecond = sec;
        play('tick');
      }
      if (leadIn <= 0) beginBrushing();
    } else if (state === 'running') {
      elapsed += dt;
      if (elapsed >= totalMs()) {
        finish();
        return;
      }
      const idx = Math.min(zones.length - 1, Math.floor(elapsed / zoneMs()));
      if (idx !== currentZone) {
        switchZone(idx);
      } else {
        // Soft ticks during the last 3 seconds of each zone.
        const left = zoneMs() * (idx + 1) - elapsed;
        const sec = Math.ceil(left / 1000);
        if (sec <= 3 && sec !== lastTickSecond) {
          lastTickSecond = sec;
          play('tick');
        }
      }
    }
    render();
  }

  function finish() {
    state = 'done';
    elapsed = totalMs();
    clearInterval(interval);
    play('done');
    buzz([300, 100, 300, 100, 500]);
    flash('All done!', 'Great job 🎉');
    say('All done. Great job!');
    releaseWakeLock();
    render();
    updateDiagram();
  }

  function togglePause() {
    if (state === 'running') {
      state = 'paused';
      releaseWakeLock();
    } else if (state === 'paused') {
      unlockAudio();
      requestWakeLock();
      state = 'running';
      lastTick = performance.now();
    }
    render();
    updateDiagram();
  }

  function reset() {
    clearInterval(interval);
    state = 'idle';
    elapsed = 0;
    currentZone = -1;
    releaseWakeLock();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    render();
    updateDiagram();
  }

  function render() {
    const startBtn = $('startBtn');
    const zMs = zoneMs();
    let label, step, zoneLeft, zoneFrac;

    switch (state) {
      case 'idle':
        step = `${zones.length} zones × ${fmt(zMs)}`;
        label = 'Ready to brush';
        zoneLeft = zMs;
        zoneFrac = 0;
        startBtn.textContent = 'Start';
        break;
      case 'lead-in':
        step = `First: ${zones[0].name}`;
        label = 'Get ready…';
        zoneLeft = leadIn;
        zoneFrac = 1 - leadIn / 3000;
        startBtn.textContent = 'Pause';
        break;
      case 'done':
        step = `${zones.length} of ${zones.length}`;
        label = 'All done! 🎉';
        zoneLeft = 0;
        zoneFrac = 1;
        startBtn.textContent = 'Brush again';
        break;
      default: {
        const zoneElapsed = elapsed - currentZone * zMs;
        step = `Zone ${currentZone + 1} of ${zones.length}${state === 'paused' ? ' · paused' : ''}`;
        label = zones[currentZone].name;
        zoneLeft = zMs - zoneElapsed;
        zoneFrac = zoneElapsed / zMs;
        startBtn.textContent = state === 'paused' ? 'Resume' : 'Pause';
      }
    }

    $('zoneStep').textContent = step;
    $('zoneLabel').textContent = label;
    $('zoneTime').textContent = fmt(zoneLeft);
    $('zoneBar').style.width = `${Math.min(100, zoneFrac * 100)}%`;
    $('totalTime').textContent = `${fmt(totalMs() - elapsed)} left`;
    $('totalBar').style.width = `${Math.min(100, (elapsed / totalMs()) * 100)}%`;

    const busy = state === 'running' || state === 'paused' || state === 'lead-in';
    $('settings').classList.toggle('locked', busy);
    $('settings').inert = busy;
  }

  // ---------- Wiring ----------

  $('startBtn').addEventListener('click', () => {
    if (state === 'idle' || state === 'done') start();
    else if (state === 'lead-in') reset();
    else togglePause();
  });
  $('resetBtn').addEventListener('click', reset);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.target.closest('input, button')) {
      e.preventDefault();
      $('startBtn').click();
    }
  });

  const zoneHints = { 2: 'Top, then bottom', 4: '2 top, 2 bottom', 6: '3 top, 3 bottom', 8: '4 top, 4 bottom' };

  function applySettings() {
    $('duration').value = settings.duration;
    $('durationOut').textContent = fmt(settings.duration * 1000);
    document.querySelectorAll('input[name="zones"]').forEach((r) => {
      r.checked = Number(r.value) === settings.zones;
    });
    $('zoneHint').textContent = zoneHints[settings.zones];
    $('optSound').checked = settings.sound;
    $('optVoice').checked = settings.voice;
    $('optVibrate').checked = settings.vibrate;
    $('optCountdown').checked = settings.countdown;
    $('optMirror').checked = settings.mirror;
    zones = buildZones(settings.zones);
    if (state === 'done') {
      state = 'idle';
      elapsed = 0;
    }
    drawDiagram();
    render();
  }

  function onSettingChange() {
    settings.duration = Number($('duration').value);
    settings.zones = Number(document.querySelector('input[name="zones"]:checked').value);
    settings.sound = $('optSound').checked;
    settings.voice = $('optVoice').checked;
    settings.vibrate = $('optVibrate').checked;
    settings.countdown = $('optCountdown').checked;
    settings.mirror = $('optMirror').checked;
    saveSettings();
    applySettings();
  }

  $('settings').addEventListener('input', onSettingChange);
  $('optVoice').addEventListener('change', () => {
    if (settings.voice) say('Voice on');
  });

  if (!('speechSynthesis' in window)) $('optVoice').closest('label').hidden = true;
  if (!navigator.vibrate) $('optVibrate').closest('label').hidden = true;
  if (![2, 4, 6, 8].includes(settings.zones)) settings.zones = defaults.zones;

  applySettings();
})();
