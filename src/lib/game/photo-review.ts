import { PHOTO_EXTRAS } from "./photo-manifest.ts";

/**
 * Plates that cannot be played as photographs, found by looking at every one
 * of them. Each either shows something that is not the place (a seagull, a
 * pair of hornbills, a plaque, a guard) or is an AI "cinematic
 * reconstruction" that invents what the place looks like. They are never
 * dealt as photos. Where Street View is configured the place still plays,
 * in Street View; and a real photograph fetched for it
 * (`node --experimental-strip-types scripts/fetch-new-photos.mjs --unfit`)
 * lifts it from this list automatically.
 */
export const UNFIT_PHOTOS: Record<string, string> = {
  // Shows something other than the place.
  loc_47: "a close-up of an elephant (Addo Elephant Park)",
  loc_79: "two hornbills on a branch (Hluhluwe)",
  loc_84: "a stone plaque of police names (Mahikeng)",
  loc_93: "a black-and-white shot of grass and trees (Assen)",
  loc_116: "a guard in a sentry box (Prague Castle)",
  loc_126: "a close-up of a seagull (Edinburgh Castle)",
  loc_141: "a gazelle on grassland (Serengeti)",
  loc_143: "a close-up of rock texture (Uluru)",
  // AI-generated "cinematic reconstructions", not photographs.
  loc_42: "AI-generated reconstruction (Boulders Beach)",
  loc_43: "AI-generated reconstruction (Chapman’s Peak)",
  loc_48: "AI-generated reconstruction (Moses Mabhida Stadium)",
  loc_49: "AI-generated reconstruction (Pietermaritzburg City Hall)",
  loc_51: "AI-generated reconstruction (Hillbrow Tower)",
  loc_52: "AI-generated reconstruction (Voortrekker Monument)",
  loc_53: "AI-generated reconstruction with an invented sign (Vilakazi Street)",
  loc_54: "AI-generated reconstruction (God’s Window)",
  loc_57: "AI-generated reconstruction (Magere Brug)",
  loc_58: "AI-generated reconstruction (Alkmaar Waag)",
  loc_59: "AI-generated reconstruction (Volendam Harbor)",
  loc_61: "AI-generated reconstruction (Gouda Markt)",
  loc_62: "AI-generated reconstruction (Grote Kerk, Breda)",
  loc_64: "AI-generated reconstruction (John Frost Bridge)",
  loc_65: "AI-generated reconstruction (Koppelpoort)",
  loc_67: "AI-generated reconstruction (Muiderslot)",
  loc_68: "AI-generated reconstruction (Oldehove)",
};

/** True when the place's plate shows the place, as a real photograph. */
export function photoFit(id: string): boolean {
  if (!(id in UNFIT_PHOTOS)) return true;
  // Re-fetched from Commons: the new photo replaced the unfit one.
  return Boolean(PHOTO_EXTRAS[id]?.source);
}
