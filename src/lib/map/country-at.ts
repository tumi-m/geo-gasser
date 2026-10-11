import worldJson from "../../data/world.json" with { type: "json" };
import detailJson from "../../data/detail.json" with { type: "json" };
import { COUNTRY_BOUNDS, haversineKm, NATION_BOUNDS } from "../game/geo.ts";
import type { LatLng } from "../game/types.ts";
import { findContaining, type RegionCollection } from "./lookup.ts";

/**
 * Which country a point is in, from the same country shapes the map draws:
 * the 50 m shapes around South Africa and the Netherlands first, then the
 * 110 m world. Country Streak judges a pin with this.
 */

const WORLD = worldJson as unknown as RegionCollection;
const DETAIL = (detailJson as unknown as { countries: RegionCollection }).countries;

/** ISO 3166-1 alpha-2 for each 110 m shape (the data names most of them only). */
const WORLD_ISO: Record<string, string> = {
  Fiji: "FJ", Tanzania: "TZ", "W. Sahara": "EH", Canada: "CA", "United States of America": "US",
  Kazakhstan: "KZ", Uzbekistan: "UZ", "Papua New Guinea": "PG", Indonesia: "ID", Argentina: "AR",
  Chile: "CL", "Dem. Rep. Congo": "CD", Somalia: "SO", Kenya: "KE", Sudan: "SD", Chad: "TD",
  Haiti: "HT", "Dominican Rep.": "DO", Russia: "RU", Bahamas: "BS", "Falkland Is.": "FK",
  Norway: "NO", Greenland: "GL", "Fr. S. Antarctic Lands": "TF", "Timor-Leste": "TL",
  "South Africa": "ZA", Lesotho: "LS", Mexico: "MX", Uruguay: "UY", Brazil: "BR", Bolivia: "BO",
  Peru: "PE", Colombia: "CO", Panama: "PA", "Costa Rica": "CR", Nicaragua: "NI", Honduras: "HN",
  "El Salvador": "SV", Guatemala: "GT", Belize: "BZ", Venezuela: "VE", Guyana: "GY",
  Suriname: "SR", France: "FR", Ecuador: "EC", "Puerto Rico": "PR", Jamaica: "JM", Cuba: "CU",
  Zimbabwe: "ZW", Botswana: "BW", Namibia: "NA", Senegal: "SN", Mali: "ML", Mauritania: "MR",
  Benin: "BJ", Niger: "NE", Nigeria: "NG", Cameroon: "CM", Togo: "TG", Ghana: "GH",
  "Côte d'Ivoire": "CI", Guinea: "GN", "Guinea-Bissau": "GW", Liberia: "LR", "Sierra Leone": "SL",
  "Burkina Faso": "BF", "Central African Rep.": "CF", Congo: "CG", Gabon: "GA", "Eq. Guinea": "GQ",
  Zambia: "ZM", Malawi: "MW", Mozambique: "MZ", eSwatini: "SZ", Angola: "AO", Burundi: "BI",
  Israel: "IL", Lebanon: "LB", Madagascar: "MG", Palestine: "PS", Gambia: "GM", Tunisia: "TN",
  Algeria: "DZ", Jordan: "JO", "United Arab Emirates": "AE", Qatar: "QA", Kuwait: "KW", Iraq: "IQ",
  Oman: "OM", Vanuatu: "VU", Cambodia: "KH", Thailand: "TH", Laos: "LA", Myanmar: "MM",
  Vietnam: "VN", "North Korea": "KP", "South Korea": "KR", Mongolia: "MN", India: "IN",
  Bangladesh: "BD", Bhutan: "BT", Nepal: "NP", Pakistan: "PK", Afghanistan: "AF", Tajikistan: "TJ",
  Kyrgyzstan: "KG", Turkmenistan: "TM", Iran: "IR", Syria: "SY", Armenia: "AM", Sweden: "SE",
  Belarus: "BY", Ukraine: "UA", Poland: "PL", Austria: "AT", Hungary: "HU", Moldova: "MD",
  Romania: "RO", Lithuania: "LT", Latvia: "LV", Estonia: "EE", Germany: "DE", Bulgaria: "BG",
  Greece: "GR", Turkey: "TR", Albania: "AL", Croatia: "HR", Switzerland: "CH", Luxembourg: "LU",
  Belgium: "BE", Netherlands: "NL", Portugal: "PT", Spain: "ES", Ireland: "IE",
  "New Caledonia": "NC", "Solomon Is.": "SB", "New Zealand": "NZ", Australia: "AU",
  "Sri Lanka": "LK", China: "CN", Taiwan: "TW", Italy: "IT", Denmark: "DK", "United Kingdom": "GB",
  Iceland: "IS", Azerbaijan: "AZ", Georgia: "GE", Philippines: "PH", Malaysia: "MY", Brunei: "BN",
  Slovenia: "SI", Finland: "FI", Slovakia: "SK", Czechia: "CZ", Eritrea: "ER", Japan: "JP",
  Paraguay: "PY", Yemen: "YE", "Saudi Arabia": "SA", Antarctica: "AQ", "N. Cyprus": "CY",
  Cyprus: "CY", Morocco: "MA", Egypt: "EG", Libya: "LY", Ethiopia: "ET", Djibouti: "DJ",
  Somaliland: "SO", Uganda: "UG", Rwanda: "RW", "Bosnia and Herz.": "BA", Macedonia: "MK",
  Serbia: "RS", Montenegro: "ME", Kosovo: "XK", "Trinidad and Tobago": "TT", "S. Sudan": "SS",
};

/** Places too small to have a 110 m shape: judged by their box instead. */
const BOX_ONLY = new Set(["HK", "SG"]);

/**
 * A pin this close to the answer is in the right country whatever the shapes
 * say: at this scale a border town or a harbour can sit just outside its own
 * outline (Victoria Falls lands in Zimbabwe, Manhattan in the sea).
 */
export const NEAR_ANSWER_KM = 25;

type Box = { south: number; north: number; west: number; east: number };

function inBox(p: LatLng, b: Box): boolean {
  return p.latitude >= b.south && p.latitude <= b.north && p.longitude >= b.west && p.longitude <= b.east;
}

const shapeBoxes = new Map<string, Box>();
/** The country's box: a known one, else one measured from its shapes. */
function boxFor(code: string): Box | undefined {
  if (code === "ZA" || code === "NL") return COUNTRY_BOUNDS[code];
  if (NATION_BOUNDS[code]) return NATION_BOUNDS[code];
  if (shapeBoxes.has(code)) return shapeBoxes.get(code);
  let box: Box | undefined;
  for (const f of [...DETAIL.features, ...WORLD.features]) {
    if ((f.properties.c || WORLD_ISO[f.properties.n]) !== code) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys)
      for (const [lng, lat] of poly[0]) {
        box = box
          ? {
              south: Math.min(box.south, lat),
              north: Math.max(box.north, lat),
              west: Math.min(box.west, lng),
              east: Math.max(box.east, lng),
            }
          : { south: lat, north: lat, west: lng, east: lng };
      }
  }
  if (box) shapeBoxes.set(code, box);
  return box;
}

export interface CountryAtPoint {
  /** ISO 3166-1 alpha-2, when the point is on land with a known code. */
  code?: string;
  /** The shape's own name ("Belgium", "United States of America"). */
  name?: string;
}

/** The country under a point, or nothing at sea. */
export function countryAt(point: LatLng): CountryAtPoint {
  const { latitude: lat, longitude: lng } = point;
  const detail = findContaining(DETAIL, lng, lat);
  if (detail) return { code: detail.properties.c || WORLD_ISO[detail.properties.n], name: detail.properties.n };
  const world = findContaining(WORLD, lng, lat);
  if (world) return { code: world.properties.c || WORLD_ISO[world.properties.n], name: world.properties.n };
  return {};
}

/**
 * Whether a pin counts as being in the given country (ISO code):
 *  - within NEAR_ANSWER_KM of the answer, when the answer is given;
 *  - Hong Kong and Singapore have no shape at this scale: inside their box;
 *  - on land: the shape under the pin is that country;
 *  - at sea: inside the country's box, so a pin just off its coast counts.
 */
export function pinInNation(point: LatLng, nation: string, answer?: LatLng): boolean {
  const code = nation.toUpperCase();
  if (answer && haversineKm(point, answer) <= NEAR_ANSWER_KM) return true;
  if (BOX_ONLY.has(code)) {
    const b = NATION_BOUNDS[code];
    return Boolean(b && inBox(point, b));
  }
  const at = countryAt(point);
  if (at.code) return at.code === code;
  const box = boxFor(code);
  return Boolean(box && inBox(point, box));
}
