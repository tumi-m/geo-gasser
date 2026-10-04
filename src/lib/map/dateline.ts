/**
 * Rings that cross the date line (Russia, Fiji) jump from 180 to -180, and
 * Leaflet drew each jump as a band of land across the whole map. Split such a
 * ring into its east and west halves; each closes along the meridian. A ring
 * with an odd number of jumps goes round a pole (Antarctica) and is left as
 * is: its jump runs along the pole, off the map.
 */
export function splitAtDateLine(ring: number[][]): number[][][] {
  const jumps: number[] = [];
  for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) jumps.push(i);
  if (!jumps.length || jumps.length % 2) return [ring];
  // Drop the closing duplicate, start right after a jump, then walk runs.
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const start = jumps[0] % open.length;
  const cyc = [...open.slice(start), ...open.slice(0, start)];
  const east: number[][] = [];
  const west: number[][] = [];
  let run: number[][] = [cyc[0]];
  const flush = () => {
    const mean = run.reduce((n, p) => n + p[0], 0) / run.length;
    (mean >= 0 ? east : west).push(...run);
  };
  for (let i = 1; i < cyc.length; i++) {
    if (Math.abs(cyc[i][0] - cyc[i - 1][0]) > 180) {
      flush();
      run = [];
    }
    run.push(cyc[i]);
  }
  flush();
  return [east, west].filter((r) => r.length >= 3).map((r) => [...r, r[0]]);
}
