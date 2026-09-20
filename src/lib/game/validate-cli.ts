import { validateLaunchPool, validateRound4Pool } from "./validation.ts";
import { LAUNCH_LOCATIONS, ROUND4_LOCATIONS } from "./locations.ts";
import { planMatch } from "./selection.ts";

const issues = [...validateLaunchPool(), ...validateRound4Pool()];
if (issues.length) {
  for (const issue of issues) console.error(`${issue.id ?? "-"}  ${issue.message}`);
  process.exitCode = 1;
} else {
  console.log(`ok  ${LAUNCH_LOCATIONS.length} photos + ${ROUND4_LOCATIONS.length} reconstructions`);
  const sample = planMatch(42);
  console.log(`sample seed=42  questions=${sample.locationIds.length}  env=${sample.envIds.join(",")}`);
}