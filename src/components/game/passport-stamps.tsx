import { avatarSeed, getLocation, nationLabel, nationOf, type RoundRecord } from "@/lib/game";

/**
 * One ink stamp per country the match visited, in the order you got there.
 * Each lands at its own slight angle (from a hash, so it is the same every
 * time) when the card scrolls into view.
 */
const INKS = ["#d8f36a", "#4fbf8b", "#e07a43", "#8fb4ff", "#f0a6c8"];

export function PassportStamps({ history }: { history: RoundRecord[] }) {
  const nations: string[] = [];
  for (const r of history) {
    const loc = getLocation(r.locationId);
    if (!loc || loc.country === "SPACE") continue;
    const n = nationOf(loc);
    if (!nations.includes(n)) nations.push(n);
  }
  if (!nations.length) return null;
  const date = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  return (
    <section
      className="passport"
      data-reveal
      aria-label={`Countries visited: ${nations.map(nationLabel).join(", ")}`}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Passport</p>
      <ul className="passport-stamps">
        {nations.map((n, i) => {
          const seed = avatarSeed(`stamp:${n}`);
          return (
            <li
              key={n}
              className="passport-stamp"
              style={
                {
                  "--i": i,
                  "--tilt": `${((seed - 0.5) * 18).toFixed(1)}deg`,
                  "--ink": INKS[Math.floor(seed * INKS.length) % INKS.length],
                } as React.CSSProperties
              }
            >
              <span className="passport-code">{n}</span>
              <span className="passport-name">{nationLabel(n)}</span>
              <span className="passport-date">{date}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
