# ATLAS DUEL — Mobile map handoff

**For:** Fable 5.1 / OpenCode / Kimi K2 (or any implementer)  
**Repo:** [tumi-m/geo-gasser](https://github.com/tumi-m/geo-gasser) (`main`)  
**Live:** [geo-gasser.vercel.app](https://geo-gasser.vercel.app)  
**Date:** 2026-09-20

Treat this as an implementation contract. The live **Android Chrome** screenshot is the source of truth, not the desktop preview.

---

## Mission

Fix the guessing map on real phones so it is **large enough to use** and **always paints land**. Then push to `tumi-m/geo-gasser` `main`.

Do **not** add another tile CDN. Do **not** wait on OpenFreeMap, Esri, OSM, or Carto. Country polygons already live in the JS bundle.

---

## Symptom (user-visible)

On **mobile Chrome** at geo-gasser.vercel.app:

1. **Blank map.** Reveal shows a dark rectangle, a **TRUE** HTML pin, sometimes one white dot. No countries, no green South Africa, no orange Netherlands, no water. Desktop/local preview often looks fine.
2. **Map is too small.** Collapsed height is `32vh`. Reveal is `min(46vh, 440px)`. On a phone that is ~180–280px tall; Expand / SA / NL / search / zoom eat the rest. You cannot navigate.
3. **Reveal looks crashed even when scoring is correct.** Example: Sandton City, **3712 km**, ACC / TIME / ROUND all **0**. That is timeout + a very far pin (0 accuracy, 0 time bonus). Missing **YOU** pin makes it feel like the map failed.

**Critical distinction:** pins are **DOM overlays**. Land is **WebGL**. Pins without land means MapLibre is mounted and **fills never painted** (or painted into a 0×0 canvas).

---

## What we already tried (do not repeat)

| Attempt | Result |
|---|---|
| Carto `dark_all` raster | `API KEY REQUIRED` watermark |
| OpenFreeMap vector `dark` style | HTTP 200, **empty tiles** (`x-ofm-debug: empty tile`, cached for years) |
| Direct Esri / OSM rasters | Browser `transferSize: 0` in preview; black canvas |
| Same-origin `/api/tiles/esri/{z}/{y}/{x}` proxy | Worked in sandbox; still blank on the user’s phone |
| Fetch `/maps/world.json` + MapLibre fill | Land still missing on phone |
| **Current (`7465968`):** inlined `src/data/world.json`, high-contrast water/land/ZA/NL, city search | User: *“it’s too small and issue still persists”* |

If the phone is on a stale Vercel deploy, hard-refresh / unregister SW. **Do not assume that explains the screenshot.** Implement A + B, then C if still blank.

---

## Root causes (most likely first)

| Rank | Cause | Why it matches the screenshot |
|---|---|---|
| 1 | **Map canvas is 0×0 or tiny on mobile.** Container uses `vh` + `position:absolute`. MapLibre samples size at init. Android Chrome `vh` includes the URL bar; first layout is often 0 height. `ResizeObserver` / delayed `resize()` often miss the real size. Markers still show (CSS). Canvas stays black. | TRUE pin visible, land missing, sheet “too small” |
| 2 | **WebGL fill failure on the device.** MapLibre GL needs WebGL. Some Android GPUs / Chrome flags fail fills silently. Circles/markers can still appear. | Dark rect + pin, no polygons |
| 3 | **Stale Vercel deploy.** Phone may still be on an older build (`/maps/world.json` fetch, dark `#2c2c34` fill). | Same blank look after “we fixed it” |
| 4 | **Reveal `fitBounds` runs before the sheet grows.** Map goes 32vh → 46vh. Bounds computed on the old box; after CSS transition the camera is wrong and the canvas may not redraw. | Tight dark crop on TRUE only, no YOU pin |
| 5 | **CSS fight.** `.maplibregl-map { position:absolute; inset:0 }` vs MapLibre’s own sizing. Host is `absolute inset-0` inside `overflow-hidden`. | Canvas not equal to the visible sheet |

---

## Files to touch

| File | Role |
|---|---|
| `src/components/game/guess-map.tsx` | MapLibre init, style, search, SA/NL, reveal framing. **This is the bug.** |
| `src/components/game/match-app.tsx` | Overlay layout; map is a corner sheet over the photo |
| `src/components/game/reveal-sequence.tsx` | Reveal card sits `bottom-[calc(46vh+0.75rem)]` — coupled to map height |
| `src/styles.css` | `.maplibregl-map { position:absolute; inset:0 }` |
| `src/data/world.json` | Inlined Natural Earth 110m countries (~172KB). Keep this. |
| `src/lib/game/gazetteer.ts` | Offline city search (`joburg`, `den haag`, `port elizabeth`). Works. Keep it. |
| `src/lib/game/machine.ts` | Scoring / timeout. Re-test after map work. |
| `src/routes/api/tiles.$kind.$z.$y.$x.ts` | Esri proxy. Optional to delete. Do not depend on it for first paint. |

Current map init (simplified):

```ts
new maplibregl.Map({
  container: hostRef.current, // absolute inset-0
  style: MAP_STYLE,           // inlined GeoJSON, ZA green / NL orange
  maxZoom: 10,
});
```

Wrap sizing today:

- collapsed: `h-[32vh] w-[min(100%-1.5rem,400px)]` and `max-sm:inset-x-3`
- reveal: `h-[min(46vh,440px)]`
- expanded: `fixed inset-3`

---

## Solutions (implement in this order)

### A. Mobile layout — do this first (fixes “too small”)

Stop using a 32vh mini-map on phones. **Split the screen.**

- **Portrait phone:** photo ~42%, map ~58% (min map height `min(52dvh, 420px)`). Map is always the guessing surface.
- **Reveal:** map ≥ 50dvh so country shape + YOU/TRUE pins fit.
- **Default expanded on `max-sm`.** Mini-map is a desktop pattern.
- Use **`dvh`**, not `vh`. Account for `env(safe-area-inset-*)`.
- After every size change: `map.resize()` then `fitBounds`, in `requestAnimationFrame` **twice** (layout + paint).
- Update `reveal-sequence.tsx` offsets so they are not hardcoded to `46vh`.

**Acceptance:** on a 390×844 phone, map canvas `getBoundingClientRect().height >= 360`.

### B. Prove the canvas is alive (fixes silent blank)

After `load` / `idle`:

```js
const el = map.getContainer();
const c = map.getCanvas();
const gl = c.getContext("webgl") || c.getContext("webgl2");
const empty =
  el.clientWidth < 80 ||
  el.clientHeight < 80 ||
  c.width < 8 ||
  c.height < 8 ||
  !gl;
```

If empty or no GL: **do not keep a black MapLibre**. Swap renderer (C).

Log once in dev: `container.clientWidth/Height`, `canvas.width/height`, `map.loaded()`.

Wait for `host.getBoundingClientRect().height >= 80` **before** `new Map()`.

### C. Leaflet fallback — most reliable paint

MapLibre WebGL is the fragile bit. **Leaflet + `L.geoJSON(worldData)`** draws on a 2D canvas/SVG. No WebGL, no tile CDN.

- Same inlined `src/data/world.json`
- Same SA green `#3f9a70` / NL orange `#d96a32` / land `#8b93a3` / water `#243044`
- Same gazetteer search / SA / NL chips / lock / pins
- Optional raster tiles later; **not required to play**

This is the recommended end state if MapLibre is still blank on a Pixel/Samsung after A+B.

Suggested API: keep `GuessMap` props unchanged; swap the engine inside the component.

### D. If you keep MapLibre

1. `preserveDrawingBuffer: true` (debug + some Android compositors).
2. `failIfMajorPerformanceCaveat: false` if the MapLibre version supports it.
3. **Do not** CSS-force `.maplibregl-map { position:absolute; inset:0 }` until `map.resize()` has run on a non-zero box.
4. `maxZoom: 12` is enough for this gazetteer; 110m data looks empty if you over-zoom a single point.
5. On reveal: `resize → fitBounds([guess, truth], { padding: 48, maxZoom: 5.5, minZoom: 3 })`. Never frame a single point at z8 (inland SA becomes a flat colour; on a broken canvas it’s just black).
6. Always draw **YOU** and **TRUE** on reveal.
7. Keep world data **in the JS bundle**. No `/api/tiles`, no `/maps/world.json` for first paint.

### E. Do not

- Do not add Google Maps, Mapbox tokens, or Carto keys in the client.
- Do not scrape Street View.
- Do not block merge on Higgsfield / 3D round-4 assets.
- Do not “fix” the blank map by lightening CSS on an empty canvas.

---

## Other bugs to fix while you’re in there

| Bug | Where | Fix |
|---|---|---|
| Reveal ACC/TIME/ROUND = 0 on timeout looks like a crash | reveal overlay + `applyScores` | Show **Timed out** + distance; keep 0 time bonus; if a pin exists, still show accuracy even when tiny |
| YOU pin missing on reveal | `GuessMap` reveal effect | Place YOU before `fitBounds`; include it in bounds |
| Search focus auto-expands, then shrinks on round change | `match-app` `setExpanded(false)` on `round_active` | On `max-sm`, stay expanded / use the split layout |
| `Lock guess` hidden until pin on mobile (`disabled:hidden`) | `guess-map.tsx` | Keep a compact Lock on the map chrome |
| Round 4 3D + tiny map | `round4-scene` + map sheet | Same 50/50 split |
| Duel timer / lock fairness | `machine.ts` | Already patched once; re-test two-tab lock + timeout |
| Lesotho hole / Drakensberg country | `validation.ts` / `locations.ts` | Keep ZA hole; don’t count Lesotho as SA |
| Scene `onLoad` vs cached image | `match-app` | Verify no blank photo on iOS (`img.complete`) |
| Hardcoded `32vh` in round-4 caption | `match-app.tsx` ~582 | Tie to real map height |

Scoring note (do not “fix” this into giving points for a miss):

- Timeout **with no pin** → 0 accuracy, 0 time, huge distance for ranking.
- Timeout **with a pin** → accuracy from geodesic distance, **0 time bonus**.
- 3712 km from Sandton is correctly **0 accuracy**. The UI should say that, not look like a zeroed HUD bug.

---

## Product / UX improvements (worth doing)

1. **Phone-first map.** Map is half the screen. Photo is the clue, not 80% of the viewport.
2. **Search is the nav.** Offline gazetteer already works. Make it the primary control; SA/NL as chips beside it.
3. **Don’t drop a pin on search.** Fly only (current). Keep that.
4. **Country labels** as HTML markers at ZA/NL centroids so a zoomed-out view is readable without WebGL glyphs.
5. **Reveal copy:** geodesic arc + both pins + `3712 km · timed out` instead of three zeros.
6. **Hit targets.** 44px already; map buttons wrap — put them in one 48px toolbar.
7. **Leaflet > MapLibre** for the guess map. You don’t need pitch/3D there. Round 4 can stay Three.js.
8. After the map works, then consider PWA “Add to Home Screen”.

---

## Acceptance tests (real phone, not only desktop)

1. Cold load `/play` on Android Chrome. Map shows **blue water, grey land, green SA** within 2s. Canvas height ≥ 360px.
2. Type `sandton` → fly → whole view is **green**, not black.
3. Drop pin in the Netherlands, let timer hit 0. Reveal: **YOU + TRUE + line + km**. Map still painted.
4. Expand / shrink / rotate: land stays, no black flash.
5. Airplane mode after first JS load: map still paints (inlined GeoJSON).
6. Desktop: still pin + lock + search.

---

## Implementation plan

1. Change mobile layout **(A)**. Hardcoded `32vh` / `46vh` must die.
2. Add canvas-size + WebGL guard **(B)**.
3. If MapLibre still blanks on a Pixel/Samsung: **switch GuessMap to Leaflet (C)**. Keep gazetteer, scoring, machine, photos.
4. Fix reveal pins + timeout copy.
5. `npx tsc --noEmit` and `node --test --experimental-strip-types src/lib/game/*.test.ts` (currently 33 passing).
6. Commit + push `tumi-m/geo-gasser` `main`.
7. Hard-refresh `geo-gasser.vercel.app` (old service worker / cache has bitten this app). Confirm on a phone.

---

## Commands

```bash
npx tsc --noEmit
node --test --experimental-strip-types src/lib/game/*.test.ts
git push origin main
```

---

## One-sentence summary

Give the inlined world polygons a **surface large enough to see**, on a **renderer that paints on Android Chrome**; stop overlaying a 32vh WebGL sheet that comes up black with a floating TRUE pin.
