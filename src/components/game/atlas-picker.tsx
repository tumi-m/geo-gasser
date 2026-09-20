import { useState } from "react";
import {
  applyRegion,
  enabledLocations,
  nationOf,
  ATLAS_PRESETS,
  atlasLabel,
  atlasPoolSize,
  nationCounts,
  nationLabel,
  NATION_LABEL,
  REGION_NATIONS,
  regionFullyOn,
  sanitizeAtlas,
  toggleNation,
  type AtlasSpec,
} from "@/lib/game";
import { cn } from "@/lib/utils";

export function AtlasPicker({
  value,
  onChange,
  compact,
}: {
  value: AtlasSpec;
  onChange: (next: AtlasSpec) => void;
  compact?: boolean;
}) {
  const [cityQuery, setCityQuery] = useState("");
  const spec = sanitizeAtlas(value);
  const cities = [...new Set(enabledLocations().filter(l=>spec.nations.includes(nationOf(l))).map(l=>l.city).filter((c):c is string=>!!c))].sort();
  const counts = nationCounts();
  const pool = atlasPoolSize(spec);
  const custom = spec.preset === "custom";
  const selected = new Set(spec.nations);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
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
            className={cn(
              "min-h-11 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
              spec.preset === p.id ? "border-accent bg-accent/15 text-fg" : "border-border bg-bg/40 text-muted",
            )}
          >
            <span className="block text-sm font-medium text-fg">{p.label}</span>
            <span className="mt-0.5 block text-[11px] text-muted">{p.hint}</span>
          </button>
        ))}
      </div>
      {custom ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-bg/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-subtle">Regions</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(REGION_NATIONS).map(([id, region]) => {
              const on = regionFullyOn(spec, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(applyRegion(spec, id, !on))}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-xs",
                    on ? "border-accent bg-accent/15 text-fg" : "border-border text-muted",
                  )}
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
                      "flex min-h-10 items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2.5 text-left text-xs",
                      on ? "border-accent bg-accent/15 text-fg" : "border-border text-muted",
                    )}
                  >
                    <span className="truncate">{nationLabel(code)}</span>
                    <span className="tabular text-[10px] text-subtle">{counts[code]}</span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
      <details className="mt-3 rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm text-muted">Choose cities {spec.cities?.length ? `(${spec.cities.length})` : "· optional"}</summary>
        <input className="atlas-search" aria-label="Find a city" placeholder="Find a city…" value={cityQuery} onChange={e=>setCityQuery(e.target.value)}/>
        <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
          <button type="button" className={cn("city-chip", !spec.cities?.length && "selected")} onClick={()=>onChange({...spec,cities:undefined})}>All cities</button>
          {cities.filter(c=>c.toLowerCase().includes(cityQuery.toLowerCase())).map(city=><button type="button" aria-pressed={spec.cities?.includes(city) ?? false} className={cn("city-chip",spec.cities?.includes(city)&&"selected")} key={city} onClick={()=>{const next=spec.cities?.includes(city)?spec.cities.filter(c=>c!==city):[...(spec.cities??[]),city];onChange({...spec,cities:next});}}>{city}</button>)}
        </div>
      </details>
      {!compact ? (
        <p className="text-xs text-subtle">
          {atlasLabel(spec)} · {pool} unique places
        </p>
      ) : null}
    </div>
  );
}
