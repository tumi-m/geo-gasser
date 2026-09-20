import { validateLaunchPool } from "./validation.ts";
import { LAUNCH_LOCATIONS } from "./locations.ts";
import { planMatch } from "./selection.ts";

const issues = validateLaunchPool();
if (issues.length) {
  for (const issue of issues) console.error(`${issue.id ?? "-"}  ${issue.message}`);
  process.exitCode = 1;
} else {
  console.log(`ok  ${LAUNCH_LOCATIONS.length} locations`);
  const sample = planMatch(42);
  console.log(`sample seed=42  rounds=${sample.locationIds.join(",")}  env=${sample.envId}`);
}
