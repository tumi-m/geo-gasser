# Handoff: blank + too-small guessing map (mobile Vercel)

Give this file to **Fable 5.1 / OpenCode / Kimi**. It is an implementation contract, not a brainstorm.

**Repo:** [tumi-m/geo-gasser](https://github.com/tumi-m/geo-gasser)  
**Live:** [geo-gasser.vercel.app](https://geo-gasser.vercel.app)  
**Latest related commits:** `2c732fc` (bundled world), `2dd8e7c` (city search), `7465968` (inlined GeoJSON + high-contrast land)

Work from `main`. Do not add tile CDNs (OpenFreeMap, Esri, OSM, Carto). They already failed in production.

---

## 1. Symptom (source of truth = phone screenshot)

On **mobile Chrome** at `geo-gasser.vercel.app`:

1. **Blank map.** Reveal is a dark rectangle with a **TRUE** HTML pin (sometimes one white dot). No countries, no green South Africa, no orange Netherlands, no water.
2. **Map is too small.** Collapsed height is `32vh`. Reveal is `min(46vh, 440px)`. On a phone that is ~180–280px of map, then Expand / SA / NL / search / zoom eat the rest. You cannot navigate.
3. **Reveal looks crashed even when scoring is correct.** Example: Sandton City, **3712 km**, ACC / TIME / ROUND all **0**. That is timeout + a very far pin (0 accuracy, 0 time bonus). Missing **YOU** pin makes it feel like the map failed.

**Critical distinction:** pins are **DOM overlays**. Land is **WebGL** (MapLibre). Pins without land means MapLibre mounted and **fills never painted** (or painted into a 0×0 canvas).

Desktop / local preview often looks fine. **Accept only a real-phone test.**

---

## 2. Root causes (most likely first)

| Rank | Cause | Why it matches the screenshot |
| --- | --- | --- |
| 1 | **Map canvas is 0×0 or tiny on mobile.** Container uses `vh` + `position: absolute`. MapLibre samples size at init. Android Chrome `vh` includes the URL bar; first layout is often 0 height. `ResizeObserver` / delayed `resize()` often miss the real size. Markers still show (CSS). Canvas stays black. | TRUE pin visible, land missing, sheet “too small” |
| 2 | **WebGL fill failure on the device.** MapLibre GL needs WebGL. Some Android GPUs / Chrome flags fail fills silently. Circles/markers can still appear. | Dark rect + pin, no polygons |
| 3 | **Stale Vercel deploy / SW cache.** Phone may still be on a build that fetches `/maps/world.json` or uses dark `#2c2c34` fills. | Same blank look after “we fixed it” |
| 4 | **Reveal `fitBounds` runs before the sheet grows.** Map goes 32vh → 46vh. Bounds computed on the old box; after CSS transition the camera is wrong and the canvas may not redraw. | Tight dark crop on TRUE only, no YOU pin |
| 5 | **CSS fight.** `.maplibregl-map { position: absolute; inset: 0 }` vs MapLibre’s own sizing. Host is `absolute inset-0` inside `overflow-hidden`. | Canvas not equal to the visible sheet |

Already ruled out as the *only* cause: Carto watermark, OpenFreeMap empty vector tiles (`x-ofm-debug: empty tile`), Esri/OSM CORS in the preview iframe. Those were real; the phone bug **survived** switching to **inlined** Natural Earth.

---

## 3. Files to touch

| File | Role |
| --- | --- |
| `src/components/game/guess-map.tsx` | MapLibre init, style, search, SA/NL, reveal framing. **This is the bug.** |
| `src/components/game/match-app.tsx` | Overlay layout; map is a corner sheet over the photo |
| `src/components/game/reveal-sequence.tsx` | Reveal card sits `bottom-[calc(46vh+0.75rem)]` — coupled to map height |
| `src/styles.css` | `.maplibregl-map { position: absolute; inset: 0 }` |
| `src/data/world.json` | Inlined Natural Earth 110m countries (~172KB). Keep this. Do not fetch it. |
| `src/lib/game/gazetteer.ts` | Offline city search (`joburg`, `den haag`, `port elizabeth`). Works. Keep it. |
| `src/lib/game/machine.ts` | Scoring / timeout. Re-test after map work. |

Current map init (simplified):

```ts
new maplibregl.Map({
  container: hostRef.current,
  style: MAP_STYLE, // inlined world.json + city dots
  maxZoom: 10,
});
```

Host: `absolute inset-0`.  
Wrap: collapsed `h-[32vh]`, reveal `h-[min(46vh,440px)]`, expanded `fixed inset-3`.

---

## 4. What to implement (this order)

### A. Mobile layout — do this first (fixes “too small”)

Stop using a 32vh mini-map on phones. **Split the screen.**

- **Portrait phone:** photo ~42%, map ~58%. Minimum map height `min(52dvh, 420px)`.
- **Reveal:** map ≥ 50dvh so country shape + YOU/TRUE pins fit.
- **Default expanded (or split) on `max-sm`.** Mini-map is a desktop pattern.
- Use **`dvh`**, not `vh`. Honour `env(safe-area-inset-*)`.
- After every size change: `map.resize()` then `fitBounds`, in `requestAnimationFrame` **twice** (layout + paint).

**Acceptance:** on a 390×844 phone, map canvas `getBoundingClientRect().height >= 360`.

Update `reveal-sequence.tsx` offsets so they are not hardcoded to `46vh`.

### B. Prove the canvas is alive (fixes silent blank)

After `load` / `idle`:

```js
const c = map.getCanvas();
const empty = c.width < 8 || c.height < 8;
const gl = c.getContext("webgl") || c.getContext("webgl2");
```

If empty or no GL: **do not keep a black MapLibre**. Swap renderer (section C).

Log once (dev or a `?debug=map` flag): container `clientWidth/Height`, canvas `width/height`, `map.loaded()`.

Wait until `host.getBoundingClientRect().height >= 80` **before** `new Map()`.

### C. Leaflet fallback — most reliable paint

MapLibre WebGL is the fragile bit. **Leaflet + `L.geoJSON(worldData)`** draws on a 2D canvas/SVG. No WebGL, no tile CDN.

- Same inlined `src/data/world.json`
- Same colours: water `#243044`, land `#8b93a3`, ZA `#3f9a70`, NL `#d96a32`
- Same search / SA / NL chips / pins
- Optional raster tiles later; **not required to play**

If MapLibre still blanks on a Pixel/Samsung after A+B, **switch `GuessMap` to Leaflet**. Keep gazetteer, scoring, machine, photos.

### D. If you keep MapLibre

1. `preserveDrawingBuffer: true`
2. `failIfMajorPerformanceCaveat: false`
3. Do **not** CSS-force `.maplibregl-map { position: absolute; inset: 0 }` until `map.resize()` has run on a non-zero box
4. `maxZoom` ~10–12. Natural Earth 110m looks empty if you over-zoom inland
5. On reveal: `resize → fitBounds([guess, truth], { padding: 48, maxZoom: 5.5, minZoom: 3 })`. Never frame a single point at z8
6. Always draw **YOU** and **TRUE** on reveal
7. Re-fit after the CSS size transition (~80ms and ~360ms)

### E. Do not depend on Vercel for tiles

Keep world data **in the JS bundle** (`src/data/world.json`).

Do **not** reintroduce:

- `/api/tiles/...`
- `/maps/world.json` as the only source
- OpenFreeMap, Esri, OSM.de, Carto `dark_all`

Those already produced blank canvases or watermarks in this project.

---

## 5. Other bugs to fix in the same pass

| Bug | Where | Fix |
| --- | --- | --- |
| Reveal ACC/TIME/ROUND = 0 on timeout looks like a crash | reveal overlay + `applyScores` | Show **Timed out** + distance. Keep 0 time bonus. If a pin exists, still show accuracy (even if 0) with copy that is not three zeros |
| YOU pin missing on reveal | `GuessMap` reveal effect | Place YOU before `fitBounds`; include it in bounds |
| Search focus auto-expands, then shrinks on round change | `match-app` `setExpanded(false)` on `round_active` | On `max-sm`, stay expanded / split |
| `Lock guess` `disabled:hidden` on mobile | `guess-map` | Keep a compact Lock on the map chrome |
| Round 4 3D + tiny map | `round4-scene` + map sheet | Same 50/50 split |
| Hardcoded `32vh` in round-4 caption | `match-app.tsx` | Tie to real map height |
| Duel lock / timeout fairness | `machine.ts` | Re-test two-tab lock + timeout (patched once already) |
| Lesotho hole / Drakensberg as ZA | `validation.ts` / `locations.ts` | Keep ZA hole; do not count Lesotho as South Africa |

---

## 6. Product / UX improvements (do after the map paints)

1. **Phone-first map.** Map is half the screen. Photo is the clue, not 80% of the viewport.
2. **Search is the nav.** Offline gazetteer already works. Make it the primary control; SA/NL as chips beside it.
3. **Do not drop a pin on search.** Fly only (current behaviour). Correct.
4. **HTML country labels** at ZA/NL centroids so a zoomed-out view is readable without glyph fonts.
5. **Reveal copy:** geodesic arc + both pins + `3712 km · timed out` instead of three zeros.
6. **Toolbar:** one 48px row (Expand, SA, NL, search). Stop wrapping over the canvas.
7. **Leaflet > MapLibre** for this game. No pitch/3D needed on the guess map. Round 4 can stay Three.js.

---

## 7. Acceptance tests (real phone, Android Chrome)

Hard-refresh or unregister SW so you are not on a stale deploy.

1. Cold load `/play`. Map shows **blue water, grey land, green SA** within 2s. Canvas height ≥ 360px.
2. Type `sandton` → fly → whole view is **green**, not black.
3. Drop a pin in the Netherlands, let the timer hit 0. Reveal: **YOU + TRUE + line + km**. Map still painted.
4. Expand / shrink / rotate: land stays, no black flash.
5. Airplane mode after first JS load: map still paints (inlined GeoJSON).
6. Desktop: pin + lock + next round still works.

---

## 8. Out of scope / do not do

- Google Maps / Street View scraping
- New provider API keys
- Higgsfield / extra 3D asset pipelines
- Ranked play, tournaments, extra countries
- Rewriting scoring math unless you are fixing timeout copy

---

## 9. Suggested commit

```
Fix mobile map: split layout, non-zero canvas, Leaflet fallback
```

Push to `tumi-m/geo-gasser` `main`. Confirm Vercel is on that SHA, then hard-refresh the phone.
