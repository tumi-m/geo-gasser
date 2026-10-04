/**
 * One shared pair of eyes-on-you for every bot on screen. A single pointer
 * listener aims each registered avatar's eyes at the pointer (or the last
 * touch), marks them `is-watching` while you are active, lets them drift back
 * to their own idle glances when you stop, and — for bots that are allowed to
 * — lets them doze off (`is-sleepy`) after a long quiet spell. Any pointer or
 * key wakes them.
 */

interface Watcher {
  el: SVGSVGElement;
  /** How far the eyes travel toward the pointer (1 = normal). */
  reach: number;
  /** May fall asleep when nothing happens for a while. */
  sleepy: boolean;
}

const WATCH_MS = 2400;
const SLEEP_MS = 28000;

const watchers = new Set<Watcher>();
let installed = false;
let px = -1;
let py = -1;
let lastActive = 0;
let raf = 0;
let restTimer = 0;
let sleepTimer = 0;

function aim(w: Watcher) {
  if (px < 0) return;
  const r = w.el.getBoundingClientRect();
  if (!r.width || r.bottom < -40 || r.top > window.innerHeight + 40) return;
  const dx = px - (r.left + r.width / 2);
  const dy = py - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy) || 1;
  // Close to the bot the eyes barely move; across the screen they reach the rim.
  const k = Math.min(1, d / 240) * w.reach;
  w.el.style.setProperty("--lx", `${((dx / d) * 3.4 * k).toFixed(2)}px`);
  w.el.style.setProperty("--ly", `${((dy / d) * 2.5 * k).toFixed(2)}px`);
}

function paint() {
  raf = 0;
  for (const w of watchers) aim(w);
}

function rest() {
  for (const w of watchers) {
    w.el.classList.remove("is-watching");
    w.el.style.setProperty("--lx", "0px");
    w.el.style.setProperty("--ly", "0px");
  }
}

function wake(watch: boolean) {
  lastActive = performance.now();
  for (const w of watchers) {
    w.el.classList.remove("is-sleepy");
    if (watch) w.el.classList.add("is-watching");
  }
  window.clearTimeout(sleepTimer);
  sleepTimer = window.setTimeout(() => {
    for (const w of watchers) if (w.sleepy) w.el.classList.add("is-sleepy");
  }, SLEEP_MS);
}

function onPointer(e: PointerEvent) {
  px = e.clientX;
  py = e.clientY;
  wake(true);
  if (!raf) raf = requestAnimationFrame(paint);
  window.clearTimeout(restTimer);
  restTimer = window.setTimeout(rest, WATCH_MS);
}

function onScroll() {
  if (performance.now() - lastActive < WATCH_MS && !raf) raf = requestAnimationFrame(paint);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  window.addEventListener("keydown", () => wake(false));
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  wake(false);
}

/** Start watching the pointer; returns the stop function. */
export function watchGaze(el: SVGSVGElement, opts: { reach?: number; sleepy?: boolean } = {}) {
  const w: Watcher = { el, reach: opts.reach ?? 1, sleepy: opts.sleepy ?? false };
  watchers.add(w);
  install();
  if (performance.now() - lastActive < WATCH_MS) {
    el.classList.add("is-watching");
    aim(w);
  }
  return () => {
    watchers.delete(w);
    el.classList.remove("is-watching", "is-sleepy");
  };
}
