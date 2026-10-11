import { useState } from "react";
import {
  applyRegion,
  ATLAS_PRESETS,
  atlasLabel,
  atlasPoolSize,
  nationCounts,
  nationLabel,
  NATION_LABEL,
  playableCities,
  REGION_NATIONS,
  regionFullyOn,
  sanitizeAtlas,
  streetViewUsable,
  toggleNation,
  type AtlasSpec,
} from "@/lib/game";
import { cn, plural } from "@/lib/utils";
import { useMono } from "@/lib/theme";

export function AtlasPicker({
  value,
  onChange,
  compact,
}: {
  value: AtlasSpec;
  onChange: (next: AtlasSpec) => void;
  compact?: boolean;
}) {
  const mono = useMono();
  const [cityQuery, setCityQuery] = useState("");
  const spec = sanitizeAtlas(value);
  // Only places a match can deal: the counts and cities here are a promise.
  const streetView = streetViewUsable();
  const playable = playableCities(spec.nations, streetView);
  // A city picked earlier stays listed so it can be switched off again.
  const cities = [...new Set([...playable, ...(spec.cities ?? [])])].sort((a, b) => a.localeCompare(b));
  const counts = nationCounts(streetView);
  const pool = atlasPoolSize(spec, streetView);
  const custom = spec.preset === "custom";
  const selected = new Set(spec.nations);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
        {ATLAS_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              onChange(
                p.id === "custom"
                  ? { preset: "custom", nations: spec.nations }
                  : sanitizeAtlas({ preset: p.id }),
              )
            }
            className={
              mono
                ? cn(
                    "min-h-11 border px-3 py-2 text-left transition-colors duration-[120ms]",
                    spec.preset === p.id
                      ? "border-rule bg-accent text-accent-fg"
                      : "border-rule bg-bg text-fg hover:bg-bg-subtle",
                  )
                : cn(
                    "min-h-11 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
                    spec.preset === p.id ? "border-accent bg-accent/15 text-fg" : "border-border bg-bg/40 text-muted",
                  )
            }
          >
            <span className={cn("block text-sm leading-tight", mono ? "font-bold" : "font-medium text-fg")}>
              {p.label}
            </span>
            <span
              className={
                mono
                  ? cn(
                      "mt-0.5 block font-mono text-[10px] leading-snug",
                      spec.preset === p.id ? "text-accent-fg" : "text-muted",
                    )
                  : "mt-0.5 block text-[11px] leading-snug text-muted"
              }
            >
              {p.hint}
            </span>
          </button>
        ))}
      </div>
      {custom ? (
        <div className={mono ? "border border-rule bg-bg p-3" : "rounded-[var(--radius-md)] border border-border bg-bg/50 p-3"}>
          <p className="text-[11px] uppercase tracking-wider text-subtle">Regions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(REGION_NATIONS).map(([id, region]) => {
              const on = regionFullyOn(spec, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(applyRegion(spec, id, !on))}
                  className={
                    mono
                      ? cn(
                          "min-h-9 border px-3 text-[11px] font-bold uppercase tracking-[0.08em]",
                          on ? "border-rule bg-accent text-accent-fg" : "border-rule text-fg",
                        )
                      : cn(
                          "min-h-9 rounded-full border px-3 text-xs",
                          on ? "border-accent bg-accent/15 text-fg" : "border-border text-muted",
                        )
                  }
                >
                  {region.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-subtle">Countries</p>
          <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {Object.keys(NATION_LABEL)
              .filter((code) => counts[code])
              .sort((a, b) => nationLabel(a).localeCompare(nationLabel(b)))
              .map((code) => {
                const on = selected.has(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(toggleNation(spec, code))}
                    className={cn(
                      "flex min-h-10 items-center justify-between gap-2 border px-2.5 text-left text-xs",
                      mono
                        ? on
                          ? "border-rule bg-accent text-accent-fg"
                          : "border-border text-fg"
                        : on
                          ? "rounded-[var(--radius-sm)] border-accent bg-accent/15 text-fg"
                          : "rounded-[var(--radius-sm)] border-border text-muted",
                    )}
                  >
                    <span className="truncate">{nationLabel(code)}</span>
                    <span className={cn("tabular text-[10px]", mono ? "font-mono" : "text-subtle")}>{counts[code]}</span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
      <details className={cn("mt-3 border p-3", mono ? "border-rule" : "rounded-xl border-border")}>
        <summary className="cursor-pointer text-sm text-muted">Choose cities {spec.cities?.length ? `(${spec.cities.length})` : "· optional"}</summary>
        <input className="atlas-search" aria-label="Find a city" placeholder="Find a city…" value={cityQuery} onChange={e=>setCityQuery(e.target.value)}/>
        <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
          <button type="button" className={cn("city-chip", !spec.cities?.length && "selected")} onClick={()=>onChange({...spec,cities:undefined})}>All cities</button>
          {cities.filter(c=>c.toLowerCase().includes(cityQuery.toLowerCase())).map(city=><button type="button" aria-pressed={spec.cities?.includes(city) ?? false} className={cn("city-chip",spec.cities?.includes(city)&&"selected")} key={city} onClick={()=>{const next=spec.cities?.includes(city)?spec.cities.filter(c=>c!==city):[...(spec.cities??[]),city];onChange({...spec,cities:next});}}>{city}</button>)}
        </div>
      </details>
      {!compact ? (
        <p className="text-xs text-subtle">
          {atlasLabel(spec)} · {plural(pool, "unique place")}
        </p>
      ) : null}
      {pool === 0 ? (
        <p className="text-xs text-muted">
          No place here can be played right now, so a match uses the whole map. Pick other cities or
          countries.
        </p>
      ) : null}
      {pool > 0 && pool < 5 ? (
        <p className="text-xs text-muted">
          A small map: a match here is only {plural(pool, "place")} long. Add countries or cities for more.
        </p>
      ) : null}
    </div>
  );
}
