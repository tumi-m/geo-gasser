import { validateFullPool, validateLaunchPool, validateRound4Pool } from "./validation.ts";
import { enabledLocations, LAUNCH_LOCATIONS, ROUND4_LOCATIONS } from "./locations.ts";
import { planMatch } from "./selection.ts";

const issues = [...validateLaunchPool(), ...validateRound4Pool(), ...validateFullPool()];
if (issues.length) {
  for (const issue of issues) console.error(`${issue.id ?? "-"}  ${issue.message}`);
  process.exitCode = 1;
} else {
  const pool = enabledLocations();
  console.log(`ok  ${LAUNCH_LOCATIONS.length} launch + ${ROUND4_LOCATIONS.length} reconstructions + pack = ${pool.length}`);
  const sample = planMatch(42, "full");
  console.log(`sample full seed=42  questions=${sample.locationIds.length}`);
}
