import type { GeoLocation } from "./types.ts";

/**
 * Thirty places played only in Google Street View: you start on the street
 * and walk. Each is a street, square or waterfront with official Google
 * coverage (car imagery, not user photospheres), picked so none repeats a
 * photo place. They are dealt only when Street View is configured
 * (VITE_GOOGLE_MAPS_KEY); without it the game never offers them.
 */

const V = "2026-10-06";
const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

type Draft = Omit<GeoLocation, "verifiedAt" | "enabled" | "sceneUrl" | "sceneKind" | "attribution">;

function street(draft: Draft): GeoLocation {
  return {
    ...draft,
    attribution: "Imagery: Google Street View.",
    verifiedAt: V,
    enabled: true,
    sceneUrl: "",
    sceneKind: "street",
  };
}

export const STREET_LOCATIONS: GeoLocation[] = [
  // South Africa
  street({ id: "st_01", country: "ZA", title: "Long Street", city: "Cape Town", region: "Western Cape", latitude: -33.9233, longitude: 18.4174, difficulty: 3, tags: ["street", "urban"], sourceUrl: wiki("Long_Street,_Cape_Town") }),
  street({ id: "st_02", country: "ZA", title: "Sea Point Promenade", city: "Cape Town", region: "Western Cape", latitude: -33.9147, longitude: 18.388, difficulty: 3, tags: ["promenade", "coast"], sourceUrl: wiki("Sea_Point") }),
  street({ id: "st_03", country: "ZA", title: "Church Square", city: "Pretoria", region: "Gauteng", latitude: -25.7462, longitude: 28.1881, difficulty: 3, tags: ["square", "historic"], sourceUrl: wiki("Church_Square,_Pretoria") }),
  street({ id: "st_04", country: "ZA", title: "Maboneng Precinct", city: "Johannesburg", region: "Gauteng", latitude: -26.2043, longitude: 28.0578, difficulty: 4, tags: ["street", "urban"], sourceUrl: wiki("Maboneng_Precinct") }),
  street({ id: "st_05", country: "ZA", title: "Florida Road", city: "Durban", region: "KwaZulu-Natal", latitude: -29.8345, longitude: 31.015, difficulty: 4, tags: ["street", "urban"], sourceUrl: wiki("Morningside,_Durban") }),
  street({ id: "st_06", country: "ZA", title: "Church Street", city: "Graaff-Reinet", region: "Eastern Cape", latitude: -32.2521, longitude: 24.5308, difficulty: 4, tags: ["town", "karoo"], sourceUrl: wiki("Graaff-Reinet") }),
  street({ id: "st_07", country: "ZA", title: "Main Street", city: "Plettenberg Bay", region: "Western Cape", latitude: -34.0533, longitude: 23.3709, difficulty: 4, tags: ["town", "coast"], sourceUrl: wiki("Plettenberg_Bay") }),
  street({ id: "st_08", country: "ZA", title: "Baron van Reede Street", city: "Oudtshoorn", region: "Western Cape", latitude: -33.592, longitude: 22.203, difficulty: 4, tags: ["town", "karoo"], sourceUrl: wiki("Oudtshoorn") }),
  street({ id: "st_09", country: "ZA", title: "Muller Street", city: "Bethlehem", region: "Free State", latitude: -28.2308, longitude: 28.3071, difficulty: 5, tags: ["town", "highveld"], sourceUrl: wiki("Bethlehem,_Free_State") }),
  street({ id: "st_10", country: "ZA", title: "Danie Joubert Street", city: "Tzaneen", region: "Limpopo", latitude: -23.833, longitude: 30.163, difficulty: 5, tags: ["town", "subtropical"], sourceUrl: wiki("Tzaneen") }),
  // Netherlands
  street({ id: "st_11", country: "NL", title: "Korenmarkt", city: "Arnhem", region: "Gelderland", latitude: 51.9811, longitude: 5.9067, difficulty: 3, tags: ["square", "urban"], sourceUrl: wiki("Arnhem") }),
  street({ id: "st_12", country: "NL", title: "Willemsoord", city: "Den Helder", region: "North Holland", latitude: 52.961, longitude: 4.77, difficulty: 4, tags: ["harbour", "naval"], sourceUrl: wiki("Willemsoord") }),
  street({ id: "st_13", country: "NL", title: "Munsterplein", city: "Roermond", region: "Limburg", latitude: 51.1932, longitude: 5.9855, difficulty: 4, tags: ["square", "historic"], sourceUrl: wiki("Roermond") }),
  street({ id: "st_14", country: "NL", title: "Kerkbrink", city: "Hilversum", region: "North Holland", latitude: 52.2235, longitude: 5.1755, difficulty: 4, tags: ["square", "town"], sourceUrl: wiki("Hilversum") }),
  street({ id: "st_15", country: "NL", title: "Raadhuisplein", city: "Emmen", region: "Drenthe", latitude: 52.7852, longitude: 6.897, difficulty: 5, tags: ["square", "town"], sourceUrl: wiki("Emmen,_Netherlands") }),
  street({ id: "st_16", country: "NL", title: "Boulevard", city: "Zandvoort", region: "North Holland", latitude: 52.374, longitude: 4.527, difficulty: 3, tags: ["beachfront", "coast"], sourceUrl: wiki("Zandvoort") }),
  street({ id: "st_17", country: "NL", title: "Urk Harbour", city: "Urk", region: "Flevoland", latitude: 52.663, longitude: 5.601, difficulty: 4, tags: ["harbour", "fishing"], sourceUrl: wiki("Urk") }),
  street({ id: "st_18", country: "NL", title: "Bataviahaven", city: "Lelystad", region: "Flevoland", latitude: 52.517, longitude: 5.438, difficulty: 4, tags: ["harbour", "new town"], sourceUrl: wiki("Lelystad") }),
  street({ id: "st_19", country: "NL", title: "Grote Markt", city: "Goes", region: "Zeeland", latitude: 51.5045, longitude: 3.889, difficulty: 5, tags: ["square", "town"], sourceUrl: wiki("Goes") }),
  street({ id: "st_20", country: "NL", title: "Waterpoort", city: "Sneek", region: "Friesland", latitude: 53.03, longitude: 5.662, difficulty: 4, tags: ["canal", "historic"], sourceUrl: wiki("Waterpoort_(Sneek)") }),
  // The world
  street({ id: "st_21", country: "WORLD", nation: "JP", title: "Shibuya Crossing", city: "Tokyo", region: "Japan", latitude: 35.6595, longitude: 139.7005, difficulty: 2, tags: ["crossing", "urban"], sourceUrl: wiki("Shibuya_Crossing") }),
  street({ id: "st_22", country: "WORLD", nation: "US", title: "Michigan Avenue", city: "Chicago", region: "United States", latitude: 41.8917, longitude: -87.6243, difficulty: 3, tags: ["avenue", "urban"], sourceUrl: wiki("Magnificent_Mile") }),
  street({ id: "st_23", country: "WORLD", nation: "AR", title: "Caminito", city: "Buenos Aires", region: "Argentina", latitude: -34.6393, longitude: -58.3626, difficulty: 3, tags: ["street", "color"], sourceUrl: wiki("Caminito") }),
  street({ id: "st_24", country: "WORLD", nation: "NZ", title: "Queenstown Waterfront", city: "Queenstown", region: "New Zealand", latitude: -45.0329, longitude: 168.66, difficulty: 3, tags: ["lake", "town"], sourceUrl: wiki("Queenstown,_New_Zealand") }),
  street({ id: "st_25", country: "WORLD", nation: "PT", title: "Ribeira", city: "Porto", region: "Portugal", latitude: 41.1407, longitude: -8.6131, difficulty: 3, tags: ["riverfront", "historic"], sourceUrl: wiki("Ribeira_(Porto)") }),
  street({ id: "st_26", country: "WORLD", nation: "TH", title: "Tha Phae Gate", city: "Chiang Mai", region: "Thailand", latitude: 18.7877, longitude: 98.9933, difficulty: 3, tags: ["gate", "old city"], sourceUrl: wiki("Tha_Phae_Gate") }),
  street({ id: "st_27", country: "WORLD", nation: "MX", title: "Zócalo", city: "Mexico City", region: "Mexico", latitude: 19.4326, longitude: -99.1332, difficulty: 2, tags: ["square", "historic"], sourceUrl: wiki("Z%C3%B3calo") }),
  street({ id: "st_28", country: "WORLD", nation: "TR", title: "İstiklal Avenue", city: "Istanbul", region: "Turkey", latitude: 41.0337, longitude: 28.9779, difficulty: 3, tags: ["avenue", "urban"], sourceUrl: wiki("%C4%B0stiklal_Avenue") }),
  street({ id: "st_29", country: "WORLD", nation: "AU", title: "Flinders Street", city: "Melbourne", region: "Australia", latitude: -37.818, longitude: 144.967, difficulty: 3, tags: ["station", "urban"], sourceUrl: wiki("Flinders_Street_railway_station") }),
  street({ id: "st_30", country: "WORLD", nation: "BR", title: "Avenida Paulista", city: "São Paulo", region: "Brazil", latitude: -23.5614, longitude: -46.6559, difficulty: 3, tags: ["avenue", "urban"], sourceUrl: wiki("Avenida_Paulista") }),
];
