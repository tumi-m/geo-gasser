export type Place = {
  name: string;
  aliases: string[];
  country: "ZA" | "NL";
  region: string;
  latitude: number;
  longitude: number;
  zoom: number;
  major: boolean;
};

function p(
  name: string,
  country: "ZA" | "NL",
  region: string,
  latitude: number,
  longitude: number,
  aliases: string[] = [],
  major = false,
  zoom = 8,
): Place {
  return { name, aliases, country, region, latitude, longitude, zoom, major };
}

/** Offline gazetteer — SA + NL cities, towns, and well-known spots. */
export const PLACES: Place[] = [
  p("Cape Town", "ZA", "Western Cape", -33.9249, 18.4241, ["kaapstad", "ct", "cape"], true, 9),
  p("Johannesburg", "ZA", "Gauteng", -26.2041, 28.0473, ["joburg", "jozi", "jhb", "egoli"], true, 9),
  p("Pretoria", "ZA", "Gauteng", -25.7479, 28.1879, ["tshwane"], true, 9),
  p("Durban", "ZA", "KwaZulu-Natal", -29.8587, 31.0218, ["ethekwini"], true, 9),
  p("Gqeberha", "ZA", "Eastern Cape", -33.9608, 25.6022, ["port elizabeth", "pe"], true, 9),
  p("Bloemfontein", "ZA", "Free State", -29.0852, 26.1596, ["mangaung"], true),
  p("East London", "ZA", "Eastern Cape", -33.0153, 27.9116, ["buffalo city"]),
  p("Kimberley", "ZA", "Northern Cape", -28.7282, 24.7499, ["big hole"]),
  p("Polokwane", "ZA", "Limpopo", -23.9045, 29.4688, ["pietersburg"]),
  p("Mbombela", "ZA", "Mpumalanga", -25.4753, 30.9694, ["nelspruit"]),
  p("Pietermaritzburg", "ZA", "KwaZulu-Natal", -29.6006, 30.3794, ["pmb"]),
  p("Rustenburg", "ZA", "North West", -25.667, 27.242),
  p("Stellenbosch", "ZA", "Western Cape", -33.9321, 18.8602, [], true, 10),
  p("Paarl", "ZA", "Western Cape", -33.734, 18.9756),
  p("Franschhoek", "ZA", "Western Cape", -33.912, 19.12),
  p("George", "ZA", "Western Cape", -33.964, 22.4617),
  p("Knysna", "ZA", "Western Cape", -34.036, 23.049, [], true, 10),
  p("Plettenberg Bay", "ZA", "Western Cape", -34.0527, 23.3716, ["plet"]),
  p("Mossel Bay", "ZA", "Western Cape", -34.1831, 22.146),
  p("Hermanus", "ZA", "Western Cape", -34.4187, 19.2345),
  p("Oudtshoorn", "ZA", "Western Cape", -33.5906, 22.2014),
  p("Worcester", "ZA", "Western Cape", -33.6465, 19.4485),
  p("Soweto", "ZA", "Gauteng", -26.2678, 27.8585, [], true, 10),
  p("Sandton", "ZA", "Gauteng", -26.1076, 28.0567, [], true, 10),
  p("Centurion", "ZA", "Gauteng", -25.8603, 28.1894),
  p("Randburg", "ZA", "Gauteng", -26.0936, 27.9804),
  p("Midrand", "ZA", "Gauteng", -25.975, 28.128),
  p("Roodepoort", "ZA", "Gauteng", -26.1625, 27.8725),
  p("Vereeniging", "ZA", "Gauteng", -26.6731, 27.9261),
  p("eMalahleni", "ZA", "Mpumalanga", -25.8738, 29.2332, ["witbank"]),
  p("Richards Bay", "ZA", "KwaZulu-Natal", -28.7807, 32.0383),
  p("Newcastle", "ZA", "KwaZulu-Natal", -27.758, 29.9318),
  p("Upington", "ZA", "Northern Cape", -28.4478, 21.2561),
  p("Springbok", "ZA", "Northern Cape", -29.6643, 17.8856),
  p("Mahikeng", "ZA", "North West", -25.86, 25.644, ["mmabatho", "mafikeng"]),
  p("Makhanda", "ZA", "Eastern Cape", -33.3106, 26.5256, ["grahamstown"]),
  p("Cape Point", "ZA", "Western Cape", -34.3568, 18.4973, ["cape of good hope"], false, 10),
  p("Table Mountain", "ZA", "Western Cape", -33.9625, 18.4107, [], false, 11),
  p("Drakensberg", "ZA", "KwaZulu-Natal", -28.7519, 28.8958, ["royal natal", "amphitheatre"], false, 9),
  p("Kruger National Park", "ZA", "Mpumalanga", -24.011, 31.485, ["kruger", "skukuza"], false, 7),
  p("Addo", "ZA", "Eastern Cape", -33.443, 25.745, ["addo elephant"]),

  p("Amsterdam", "NL", "North Holland", 52.3676, 4.9041, ["ams"], true, 10),
  p("Rotterdam", "NL", "South Holland", 51.9244, 4.4777, ["rdam"], true, 10),
  p("The Hague", "NL", "South Holland", 52.0705, 4.3007, ["den haag", "s-gravenhage", "hague"], true, 10),
  p("Utrecht", "NL", "Utrecht", 52.0907, 5.1214, [], true, 10),
  p("Eindhoven", "NL", "North Brabant", 51.4416, 5.4697, [], true, 10),
  p("Groningen", "NL", "Groningen", 53.2194, 6.5665, [], true, 10),
  p("Tilburg", "NL", "North Brabant", 51.5555, 5.0913),
  p("Almere", "NL", "Flevoland", 52.3508, 5.2647),
  p("Breda", "NL", "North Brabant", 51.5719, 4.7683),
  p("Nijmegen", "NL", "Gelderland", 51.8126, 5.8372),
  p("Apeldoorn", "NL", "Gelderland", 52.2112, 5.9699),
  p("Haarlem", "NL", "North Holland", 52.3874, 4.6462, [], true, 10),
  p("Arnhem", "NL", "Gelderland", 51.9851, 5.8987),
  p("Enschede", "NL", "Overijssel", 52.2215, 6.8937),
  p("Amersfoort", "NL", "Utrecht", 52.1561, 5.3878),
  p("Zaandam", "NL", "North Holland", 52.438, 4.829, ["zaanstad"], true, 10),
  p("Den Bosch", "NL", "North Brabant", 51.6978, 5.3037, ["s-hertogenbosch", "'s-hertogenbosch"]),
  p("Zwolle", "NL", "Overijssel", 52.5168, 6.083),
  p("Leiden", "NL", "South Holland", 52.1601, 4.497, [], true, 10),
  p("Maastricht", "NL", "Limburg", 50.8514, 5.691, [], true, 10),
  p("Dordrecht", "NL", "South Holland", 51.8133, 4.6901),
  p("Delft", "NL", "South Holland", 52.0116, 4.3571, [], true, 10),
  p("Leeuwarden", "NL", "Friesland", 53.2012, 5.7999),
  p("Alkmaar", "NL", "North Holland", 52.6324, 4.7534),
  p("Hilversum", "NL", "North Holland", 52.2292, 5.1669),
  p("Amstelveen", "NL", "North Holland", 52.3089, 4.8639),
  p("Deventer", "NL", "Overijssel", 52.255, 6.1639),
  p("Venlo", "NL", "Limburg", 51.3704, 6.1724),
  p("Gouda", "NL", "South Holland", 52.0115, 4.7105),
  p("Middelburg", "NL", "Zeeland", 51.4988, 3.6105),
  p("Vlissingen", "NL", "Zeeland", 51.4508, 3.5701, ["flushing"]),
  p("Assen", "NL", "Drenthe", 52.9926, 6.5642),
  p("Emmen", "NL", "Drenthe", 52.7792, 6.9069),
  p("Heerlen", "NL", "Limburg", 50.8882, 5.9795),
  p("Scheveningen", "NL", "South Holland", 52.1044, 4.2754, [], false, 11),
  p("Zaanse Schans", "NL", "North Holland", 52.4736, 4.8166, ["zaanse"], false, 12),
  p("Kinderdijk", "NL", "South Holland", 51.883, 4.649, [], false, 12),
  p("Giethoorn", "NL", "Overijssel", 52.74, 6.077, [], false, 12),
  p("Volendam", "NL", "North Holland", 52.495, 5.0706),
  p("Marken", "NL", "North Holland", 52.4584, 5.1022),
  p("Edam", "NL", "North Holland", 52.5122, 5.0467),
  p("Hoorn", "NL", "North Holland", 52.6425, 5.0597),
  p("Keukenhof", "NL", "South Holland", 52.271, 4.546, ["lisse"], false, 12),
  p("Schiphol", "NL", "North Holland", 52.3105, 4.7683, ["amsterdam airport"]),
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function haystack(place: Place) {
  return [place.name, place.region, place.country, ...place.aliases].map(normalize);
}

export function searchPlaces(query: string, limit = 8): Place[] {
  const q = normalize(query);
  if (q.length < 1) return [];
  return PLACES.map((place) => {
    const fields = haystack(place);
    const name = fields[0];
    const rest = fields.slice(1);
    let score = 0;
    if (name === q) score = 100;
    else if (rest.some((f) => f === q)) score = 90;
    else if (name.startsWith(q)) score = 80;
    else if (rest.some((f) => f.startsWith(q))) score = 72;
    else if (name.includes(q)) score = 50;
    else if (rest.some((f) => f.includes(q))) score = 30;
    if (place.major && score > 0) score += 4;
    return { place, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, limit)
    .map((row) => row.place);
}

export function cityDots() {
  return {
    type: "FeatureCollection" as const,
    features: PLACES.filter((place) => place.major).map((place) => ({
      type: "Feature" as const,
      properties: { n: place.name },
      geometry: { type: "Point" as const, coordinates: [place.longitude, place.latitude] },
    })),
  };
}
