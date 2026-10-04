import { NEW_PHOTOS } from "./photo-manifest.ts";
import type { GeoLocation } from "./types.ts";

/**
 * Fifty more places: 12 in South Africa, 12 in the Netherlands and 26 around
 * the world, many in countries that had a single site. Photos come from
 * Wikimedia Commons through scripts/fetch-new-photos.mjs, which looks in each
 * `commons` category (then near the coordinates) for a large, landscape,
 * freely licensed photo plus extra viewpoints. A place joins the pool only
 * once its photo is in the manifest, so a missing download never breaks a
 * round.
 */

const V = "2026-10-04";

type Draft = Omit<GeoLocation, "verifiedAt" | "enabled" | "sceneUrl" | "sceneKind" | "attribution"> & {
  /** Commons category to pick photos from. */
  commons: string;
};

function loc(draft: Draft): GeoLocation & { commons: string } {
  const photo = NEW_PHOTOS[draft.id];
  return {
    ...draft,
    attribution: photo?.attribution ?? "Photo: Wikimedia Commons.",
    verifiedAt: V,
    enabled: Boolean(photo),
    sceneUrl: `/locations/${draft.id}.jpg`,
    sceneKind: "wikimedia",
    views: photo?.views
      ? Array.from({ length: photo.views }, (_, i) => `/locations/views/${draft.id}-${i + 2}.jpg`)
      : undefined,
  };
}

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

const DRAFTS = [
  // ── South Africa ────────────────────────────────────────────────────────
  loc({ id: "loc_150", country: "ZA", title: "Constitution Hill", city: "Johannesburg", region: "Gauteng", latitude: -26.1897, longitude: 28.0428, difficulty: 3, tags: ["historic", "urban"], sourceUrl: wiki("Constitution_Hill,_Johannesburg"), commons: "Constitution Hill, Johannesburg" }),
  loc({ id: "loc_151", country: "ZA", title: "Nelson Mandela Bridge", city: "Johannesburg", region: "Gauteng", latitude: -26.1965, longitude: 28.0386, difficulty: 3, tags: ["bridge", "urban"], sourceUrl: wiki("Nelson_Mandela_Bridge"), commons: "Nelson Mandela Bridge" }),
  loc({ id: "loc_152", country: "ZA", title: "Clifton Beach", city: "Cape Town", region: "Western Cape", latitude: -33.9389, longitude: 18.377, difficulty: 2, tags: ["beach", "coast"], sourceUrl: wiki("Clifton,_Cape_Town"), commons: "Clifton, Cape Town" }),
  loc({ id: "loc_153", country: "ZA", title: "Muizenberg Beach", city: "Cape Town", region: "Western Cape", latitude: -34.108, longitude: 18.471, difficulty: 2, tags: ["beach", "color"], sourceUrl: wiki("Muizenberg"), commons: "Muizenberg Beach" }),
  loc({ id: "loc_154", country: "ZA", title: "Kalk Bay Harbour", city: "Cape Town", region: "Western Cape", latitude: -34.1279, longitude: 18.4498, difficulty: 3, tags: ["harbour", "coast"], sourceUrl: wiki("Kalk_Bay"), commons: "Kalk Bay Harbour" }),
  loc({ id: "loc_155", country: "ZA", title: "Lion’s Head", city: "Cape Town", region: "Western Cape", latitude: -33.9352, longitude: 18.389, difficulty: 2, tags: ["mountain", "nature"], sourceUrl: wiki("Lion%27s_Head_(Cape_Town)"), commons: "Lion's Head (Cape Town)" }),
  loc({ id: "loc_156", country: "ZA", title: "Golden Gate Highlands", city: "Clarens", region: "Free State", latitude: -28.5099, longitude: 28.6107, difficulty: 3, tags: ["mountains", "nature"], sourceUrl: wiki("Golden_Gate_Highlands_National_Park"), commons: "Golden Gate Highlands National Park" }),
  loc({ id: "loc_157", country: "ZA", title: "Bourke’s Luck Potholes", city: "Graskop", region: "Mpumalanga", latitude: -24.6741, longitude: 30.8109, difficulty: 3, tags: ["canyon", "river"], sourceUrl: wiki("Bourke%27s_Luck_Potholes"), commons: "Bourke's Luck Potholes" }),
  loc({ id: "loc_158", country: "ZA", title: "Hole in the Wall", city: "Coffee Bay", region: "Eastern Cape", latitude: -32.0333, longitude: 29.15, difficulty: 4, tags: ["coast", "rock"], sourceUrl: wiki("Hole_in_the_Wall_(South_Africa)"), commons: "Hole in the Wall (South Africa)" }),
  loc({ id: "loc_159", country: "ZA", title: "Palace of the Lost City", city: "Sun City", region: "North West", latitude: -25.3355, longitude: 27.0907, difficulty: 3, tags: ["resort", "architecture"], sourceUrl: wiki("The_Palace_of_the_Lost_City"), commons: "The Palace of the Lost City" }),
  loc({ id: "loc_160", country: "ZA", title: "Durban Golden Mile", city: "Durban", region: "KwaZulu-Natal", latitude: -29.8546, longitude: 31.0388, difficulty: 2, tags: ["beachfront", "urban"], sourceUrl: wiki("Golden_Mile_(Durban)"), commons: "Golden Mile (Durban)" }),
  loc({ id: "loc_161", country: "ZA", title: "Paternoster", city: "Paternoster", region: "Western Cape", latitude: -32.812, longitude: 17.892, difficulty: 4, tags: ["village", "coast"], sourceUrl: wiki("Paternoster,_Western_Cape"), commons: "Paternoster, Western Cape" }),

  // ── Netherlands ─────────────────────────────────────────────────────────
  loc({ id: "loc_162", country: "NL", title: "Markthal", city: "Rotterdam", region: "South Holland", latitude: 51.92, longitude: 4.4866, difficulty: 2, tags: ["architecture", "urban"], sourceUrl: wiki("Markthal_Rotterdam"), commons: "Markthal Rotterdam" }),
  loc({ id: "loc_163", country: "NL", title: "Amsterdam Centraal", city: "Amsterdam", region: "North Holland", latitude: 52.3789, longitude: 4.9004, difficulty: 2, tags: ["station", "urban"], sourceUrl: wiki("Amsterdam_Centraal_station"), commons: "Amsterdam Centraal railway station" }),
  loc({ id: "loc_164", country: "NL", title: "Molen de Valk", city: "Leiden", region: "South Holland", latitude: 52.1626, longitude: 4.4872, difficulty: 3, tags: ["windmill", "historic"], sourceUrl: wiki("De_Valk,_Leiden"), commons: "Molen De Valk (Leiden)" }),
  loc({ id: "loc_165", country: "NL", title: "Oudegracht", city: "Utrecht", region: "Utrecht", latitude: 52.0888, longitude: 5.1196, difficulty: 3, tags: ["canal", "urban"], sourceUrl: wiki("Oudegracht"), commons: "Oudegracht (Utrecht)" }),
  loc({ id: "loc_166", country: "NL", title: "Kasteel de Haar", city: "Haarzuilens", region: "Utrecht", latitude: 52.1214, longitude: 4.9906, difficulty: 3, tags: ["castle", "historic"], sourceUrl: wiki("Castle_De_Haar"), commons: "Kasteel de Haar" }),
  loc({ id: "loc_167", country: "NL", title: "Fort Bourtange", city: "Bourtange", region: "Groningen", latitude: 53.0067, longitude: 7.1919, difficulty: 4, tags: ["fortress", "village"], sourceUrl: wiki("Bourtange"), commons: "Bourtange" }),
  loc({ id: "loc_168", country: "NL", title: "Afsluitdijk", city: "Den Oever", region: "North Holland", latitude: 53.0741, longitude: 5.1298, difficulty: 4, tags: ["dike", "water"], sourceUrl: wiki("Afsluitdijk"), commons: "Afsluitdijk" }),
  loc({ id: "loc_169", country: "NL", title: "Maeslantkering", city: "Hoek van Holland", region: "South Holland", latitude: 51.955, longitude: 4.165, difficulty: 4, tags: ["storm barrier", "water"], sourceUrl: wiki("Maeslantkering"), commons: "Maeslantkering" }),
  loc({ id: "loc_170", country: "NL", title: "Zierikzee Harbour", city: "Zierikzee", region: "Zeeland", latitude: 51.6483, longitude: 3.918, difficulty: 4, tags: ["harbour", "historic"], sourceUrl: wiki("Zierikzee"), commons: "Oude Haven (Zierikzee)" }),
  loc({ id: "loc_171", country: "NL", title: "Thorn", city: "Thorn", region: "Limburg", latitude: 51.1617, longitude: 5.8424, difficulty: 4, tags: ["village", "historic"], sourceUrl: wiki("Thorn,_Netherlands"), commons: "Thorn (Limburg)" }),
  loc({ id: "loc_172", country: "NL", title: "Valkenburg Castle", city: "Valkenburg", region: "Limburg", latitude: 50.8644, longitude: 5.8307, difficulty: 4, tags: ["castle", "ruin"], sourceUrl: wiki("Valkenburg_Castle"), commons: "Kasteel Valkenburg" }),
  loc({ id: "loc_173", country: "NL", title: "Edam", city: "Edam", region: "North Holland", latitude: 52.5131, longitude: 5.048, difficulty: 3, tags: ["town", "canal"], sourceUrl: wiki("Edam"), commons: "Edam" }),

  // ── World ───────────────────────────────────────────────────────────────
  loc({ id: "loc_174", country: "WORLD", nation: "IN", title: "Gateway of India", city: "Mumbai", region: "India", latitude: 18.922, longitude: 72.8347, difficulty: 2, tags: ["monument", "coast"], sourceUrl: wiki("Gateway_of_India"), commons: "Gateway of India" }),
  loc({ id: "loc_175", country: "WORLD", nation: "IN", title: "Hawa Mahal", city: "Jaipur", region: "India", latitude: 26.9239, longitude: 75.8267, difficulty: 2, tags: ["palace", "historic"], sourceUrl: wiki("Hawa_Mahal"), commons: "Hawa Mahal" }),
  loc({ id: "loc_176", country: "WORLD", nation: "IN", title: "Dashashwamedh Ghat", city: "Varanasi", region: "India", latitude: 25.3069, longitude: 83.0107, difficulty: 3, tags: ["river", "religious"], sourceUrl: wiki("Dashashwamedh_Ghat"), commons: "Dashashwamedh Ghat" }),
  loc({ id: "loc_177", country: "WORLD", nation: "JP", title: "Fushimi Inari Taisha", city: "Kyoto", region: "Japan", latitude: 34.9671, longitude: 135.7727, difficulty: 2, tags: ["shrine", "religious"], sourceUrl: wiki("Fushimi_Inari-taisha"), commons: "Fushimi Inari-taisha" }),
  loc({ id: "loc_178", country: "WORLD", nation: "JP", title: "Itsukushima Shrine", city: "Hatsukaichi", region: "Japan", latitude: 34.2959, longitude: 132.3198, difficulty: 2, tags: ["shrine", "coast"], sourceUrl: wiki("Itsukushima_Shrine"), commons: "Itsukushima Shrine" }),
  loc({ id: "loc_179", country: "WORLD", nation: "CN", title: "The Bund", city: "Shanghai", region: "China", latitude: 31.2397, longitude: 121.4904, difficulty: 2, tags: ["skyline", "urban"], sourceUrl: wiki("The_Bund"), commons: "The Bund" }),
  loc({ id: "loc_180", country: "WORLD", nation: "CN", title: "Li River at Yangshuo", city: "Yangshuo", region: "China", latitude: 24.7783, longitude: 110.4964, difficulty: 3, tags: ["river", "karst"], sourceUrl: wiki("Yangshuo_County"), commons: "Li River" }),
  loc({ id: "loc_181", country: "WORLD", nation: "PE", title: "Plaza de Armas, Cusco", city: "Cusco", region: "Peru", latitude: -13.5165, longitude: -71.9786, difficulty: 3, tags: ["square", "historic"], sourceUrl: wiki("Plaza_de_Armas_(Cusco)"), commons: "Plaza de Armas (Cusco)" }),
  loc({ id: "loc_182", country: "WORLD", nation: "FR", title: "Mont-Saint-Michel", city: "Le Mont-Saint-Michel", region: "France", latitude: 48.6361, longitude: -1.5115, difficulty: 1, tags: ["abbey", "island"], sourceUrl: wiki("Mont-Saint-Michel"), commons: "Mont-Saint-Michel" }),
  loc({ id: "loc_183", country: "WORLD", nation: "ES", title: "Alhambra", city: "Granada", region: "Spain", latitude: 37.1761, longitude: -3.5881, difficulty: 2, tags: ["palace", "historic"], sourceUrl: wiki("Alhambra"), commons: "Alhambra" }),
  loc({ id: "loc_184", country: "WORLD", nation: "GB", title: "Stonehenge", city: "Amesbury", region: "United Kingdom", latitude: 51.1789, longitude: -1.8262, difficulty: 1, tags: ["prehistoric", "monument"], sourceUrl: wiki("Stonehenge"), commons: "Stonehenge" }),
  loc({ id: "loc_185", country: "WORLD", nation: "DE", title: "Brandenburg Gate", city: "Berlin", region: "Germany", latitude: 52.5163, longitude: 13.3777, difficulty: 1, tags: ["monument", "urban"], sourceUrl: wiki("Brandenburg_Gate"), commons: "Brandenburger Tor" }),
  loc({ id: "loc_186", country: "WORLD", nation: "BE", title: "Grand-Place", city: "Brussels", region: "Belgium", latitude: 50.8467, longitude: 4.3524, difficulty: 2, tags: ["square", "historic"], sourceUrl: wiki("Grand-Place"), commons: "Grand-Place (Brussels)" }),
  loc({ id: "loc_187", country: "WORLD", nation: "AT", title: "Hallstatt", city: "Hallstatt", region: "Austria", latitude: 47.5622, longitude: 13.6493, difficulty: 2, tags: ["village", "lake"], sourceUrl: wiki("Hallstatt"), commons: "Hallstatt" }),
  loc({ id: "loc_188", country: "WORLD", nation: "DK", title: "Nyhavn", city: "Copenhagen", region: "Denmark", latitude: 55.6798, longitude: 12.5911, difficulty: 2, tags: ["canal", "color"], sourceUrl: wiki("Nyhavn"), commons: "Nyhavn" }),
  loc({ id: "loc_189", country: "WORLD", nation: "PL", title: "Main Market Square", city: "Kraków", region: "Poland", latitude: 50.0617, longitude: 19.9373, difficulty: 3, tags: ["square", "historic"], sourceUrl: wiki("Main_Square,_Krak%C3%B3w"), commons: "Main Market Square in Kraków" }),
  loc({ id: "loc_190", country: "WORLD", nation: "AE", title: "Burj Khalifa", city: "Dubai", region: "United Arab Emirates", latitude: 25.1972, longitude: 55.2744, difficulty: 1, tags: ["skyscraper", "urban"], sourceUrl: wiki("Burj_Khalifa"), commons: "Burj Khalifa" }),
  loc({ id: "loc_191", country: "WORLD", nation: "NA", title: "Deadvlei", city: "Sossusvlei", region: "Namibia", latitude: -24.7593, longitude: 15.2925, difficulty: 3, tags: ["desert", "dunes"], sourceUrl: wiki("Deadvlei"), commons: "Deadvlei" }),
  loc({ id: "loc_192", country: "WORLD", nation: "CA", title: "Horseshoe Falls", city: "Niagara Falls", region: "Canada", latitude: 43.0779, longitude: -79.0752, difficulty: 1, tags: ["waterfall", "nature"], sourceUrl: wiki("Horseshoe_Falls"), commons: "Horseshoe Falls" }),
  loc({ id: "loc_193", country: "WORLD", nation: "US", title: "Horseshoe Bend", city: "Page", region: "United States", latitude: 36.8791, longitude: -111.5104, difficulty: 2, tags: ["canyon", "river"], sourceUrl: wiki("Horseshoe_Bend_(Arizona)"), commons: "Horseshoe Bend (Arizona)" }),
  loc({ id: "loc_194", country: "WORLD", nation: "BR", title: "Pelourinho", city: "Salvador", region: "Brazil", latitude: -12.9727, longitude: -38.5087, difficulty: 3, tags: ["historic", "color"], sourceUrl: wiki("Pelourinho"), commons: "Pelourinho" }),
  loc({ id: "loc_195", country: "WORLD", nation: "AR", title: "Perito Moreno Glacier", city: "El Calafate", region: "Argentina", latitude: -50.4967, longitude: -73.1377, difficulty: 2, tags: ["glacier", "nature"], sourceUrl: wiki("Perito_Moreno_Glacier"), commons: "Perito Moreno Glacier" }),
  loc({ id: "loc_196", country: "WORLD", nation: "NZ", title: "Church of the Good Shepherd", city: "Lake Tekapo", region: "New Zealand", latitude: -44.0047, longitude: 170.4777, difficulty: 3, tags: ["church", "lake"], sourceUrl: wiki("Church_of_the_Good_Shepherd,_Lake_Tekapo"), commons: "Church of the Good Shepherd (Lake Tekapo)" }),
  loc({ id: "loc_197", country: "WORLD", nation: "ID", title: "Borobudur", city: "Magelang", region: "Indonesia", latitude: -7.6079, longitude: 110.2038, difficulty: 2, tags: ["temple", "historic"], sourceUrl: wiki("Borobudur"), commons: "Borobudur" }),
  loc({ id: "loc_198", country: "WORLD", nation: "VN", title: "Hội An Ancient Town", city: "Hội An", region: "Vietnam", latitude: 15.8771, longitude: 108.3268, difficulty: 3, tags: ["historic", "river"], sourceUrl: wiki("H%E1%BB%99i_An"), commons: "Hội An Ancient Town" }),
  loc({ id: "loc_199", country: "WORLD", nation: "MY", title: "Petronas Towers", city: "Kuala Lumpur", region: "Malaysia", latitude: 3.1579, longitude: 101.7116, difficulty: 1, tags: ["skyscraper", "urban"], sourceUrl: wiki("Petronas_Towers"), commons: "Petronas Towers" }),
];

/** Commons category per new place, for the photo fetch script. */
export const NEW_LOCATION_SOURCES: Record<string, string> = Object.fromEntries(
  DRAFTS.map((d) => [d.id, d.commons]),
);

export const NEW_LOCATIONS: GeoLocation[] = DRAFTS.map(({ commons: _commons, ...rest }) => rest);
