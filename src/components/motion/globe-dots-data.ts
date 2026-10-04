const DEG = Math.PI / 180;

let dotsCache: Float32Array | null = null;
/** Land dots as [lat, lon] radian pairs, decoded once and shared. */
export async function loadGlobeDots(): Promise<Float32Array> {
  if (dotsCache) return dotsCache;
  const { GLOBE_DOTS } = await import("@/lib/map/globe-dots");
  const bin = atob(GLOBE_DOTS);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ints = new Int16Array(bytes.buffer);
  const out = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) out[i] = (ints[i] / 100) * DEG;
  dotsCache = out;
  return out;
}
