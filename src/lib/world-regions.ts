// Worldwide country + state/region targeting data for boost segmentation.
// Country names are localized at runtime via Intl.DisplayNames.
// Subdivisions are shipped only for countries where geo-targeting is most useful.

export interface Subdivision {
  code: string; // ISO 3166-2 subdivision code (without country prefix)
  name: string;
}

// ISO 3166-1 alpha-2 country codes — full list (249 entries).
export const ALL_COUNTRIES: string[] = [
  "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
  "BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR",
  "IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC",
  "CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO",
  "EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF",
  "GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY",
  "HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM",
  "JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY",
  "LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX",
  "FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI",
  "NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH",
  "PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC",
  "WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS",
  "SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK",
  "TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU",
  "VE","VN","VG","VI","WF","EH","YE","ZM","ZW",
];

// Curated subdivisions (ISO 3166-2) for the most-targeted countries.
// Other countries default to "country-wide" (no subdivision picker).
export const SUBDIVISIONS: Record<string, Subdivision[]> = {
  BR: [
    { code: "AC", name: "Acre" }, { code: "AL", name: "Alagoas" }, { code: "AP", name: "Amapá" },
    { code: "AM", name: "Amazonas" }, { code: "BA", name: "Bahia" }, { code: "CE", name: "Ceará" },
    { code: "DF", name: "Distrito Federal" }, { code: "ES", name: "Espírito Santo" },
    { code: "GO", name: "Goiás" }, { code: "MA", name: "Maranhão" }, { code: "MT", name: "Mato Grosso" },
    { code: "MS", name: "Mato Grosso do Sul" }, { code: "MG", name: "Minas Gerais" },
    { code: "PA", name: "Pará" }, { code: "PB", name: "Paraíba" }, { code: "PR", name: "Paraná" },
    { code: "PE", name: "Pernambuco" }, { code: "PI", name: "Piauí" }, { code: "RJ", name: "Rio de Janeiro" },
    { code: "RN", name: "Rio Grande do Norte" }, { code: "RS", name: "Rio Grande do Sul" },
    { code: "RO", name: "Rondônia" }, { code: "RR", name: "Roraima" }, { code: "SC", name: "Santa Catarina" },
    { code: "SP", name: "São Paulo" }, { code: "SE", name: "Sergipe" }, { code: "TO", name: "Tocantins" },
  ],
  US: [
    { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
    { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
    { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
    { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
    { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
    { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
    { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
    { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
    { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
    { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
    { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
    { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
    { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
    { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
    { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
    { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
    { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "District of Columbia" },
  ],
  MX: [
    { code: "AGU", name: "Aguascalientes" }, { code: "BCN", name: "Baja California" },
    { code: "BCS", name: "Baja California Sur" }, { code: "CAM", name: "Campeche" },
    { code: "CHP", name: "Chiapas" }, { code: "CHH", name: "Chihuahua" }, { code: "COA", name: "Coahuila" },
    { code: "COL", name: "Colima" }, { code: "CMX", name: "Ciudad de México" }, { code: "DUR", name: "Durango" },
    { code: "GUA", name: "Guanajuato" }, { code: "GRO", name: "Guerrero" }, { code: "HID", name: "Hidalgo" },
    { code: "JAL", name: "Jalisco" }, { code: "MEX", name: "México" }, { code: "MIC", name: "Michoacán" },
    { code: "MOR", name: "Morelos" }, { code: "NAY", name: "Nayarit" }, { code: "NLE", name: "Nuevo León" },
    { code: "OAX", name: "Oaxaca" }, { code: "PUE", name: "Puebla" }, { code: "QUE", name: "Querétaro" },
    { code: "ROO", name: "Quintana Roo" }, { code: "SLP", name: "San Luis Potosí" }, { code: "SIN", name: "Sinaloa" },
    { code: "SON", name: "Sonora" }, { code: "TAB", name: "Tabasco" }, { code: "TAM", name: "Tamaulipas" },
    { code: "TLA", name: "Tlaxcala" }, { code: "VER", name: "Veracruz" }, { code: "YUC", name: "Yucatán" },
    { code: "ZAC", name: "Zacatecas" },
  ],
  AR: [
    { code: "C", name: "Ciudad Autónoma de Buenos Aires" }, { code: "B", name: "Buenos Aires" },
    { code: "K", name: "Catamarca" }, { code: "H", name: "Chaco" }, { code: "U", name: "Chubut" },
    { code: "X", name: "Córdoba" }, { code: "W", name: "Corrientes" }, { code: "E", name: "Entre Ríos" },
    { code: "P", name: "Formosa" }, { code: "Y", name: "Jujuy" }, { code: "L", name: "La Pampa" },
    { code: "F", name: "La Rioja" }, { code: "M", name: "Mendoza" }, { code: "N", name: "Misiones" },
    { code: "Q", name: "Neuquén" }, { code: "R", name: "Río Negro" }, { code: "A", name: "Salta" },
    { code: "J", name: "San Juan" }, { code: "D", name: "San Luis" }, { code: "Z", name: "Santa Cruz" },
    { code: "S", name: "Santa Fe" }, { code: "G", name: "Santiago del Estero" },
    { code: "V", name: "Tierra del Fuego" }, { code: "T", name: "Tucumán" },
  ],
  CA: [
    { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" }, { code: "MB", name: "Manitoba" },
    { code: "NB", name: "New Brunswick" }, { code: "NL", name: "Newfoundland and Labrador" },
    { code: "NS", name: "Nova Scotia" }, { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" },
    { code: "QC", name: "Quebec" }, { code: "SK", name: "Saskatchewan" }, { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" }, { code: "YT", name: "Yukon" },
  ],
  GB: [
    { code: "ENG", name: "England" }, { code: "SCT", name: "Scotland" },
    { code: "WLS", name: "Wales" }, { code: "NIR", name: "Northern Ireland" },
  ],
  DE: [
    { code: "BW", name: "Baden-Württemberg" }, { code: "BY", name: "Bayern" }, { code: "BE", name: "Berlin" },
    { code: "BB", name: "Brandenburg" }, { code: "HB", name: "Bremen" }, { code: "HH", name: "Hamburg" },
    { code: "HE", name: "Hessen" }, { code: "MV", name: "Mecklenburg-Vorpommern" }, { code: "NI", name: "Niedersachsen" },
    { code: "NW", name: "Nordrhein-Westfalen" }, { code: "RP", name: "Rheinland-Pfalz" }, { code: "SL", name: "Saarland" },
    { code: "SN", name: "Sachsen" }, { code: "ST", name: "Sachsen-Anhalt" }, { code: "SH", name: "Schleswig-Holstein" },
    { code: "TH", name: "Thüringen" },
  ],
  FR: [
    { code: "ARA", name: "Auvergne-Rhône-Alpes" }, { code: "BFC", name: "Bourgogne-Franche-Comté" },
    { code: "BRE", name: "Bretagne" }, { code: "CVL", name: "Centre-Val de Loire" }, { code: "COR", name: "Corse" },
    { code: "GES", name: "Grand Est" }, { code: "HDF", name: "Hauts-de-France" }, { code: "IDF", name: "Île-de-France" },
    { code: "NOR", name: "Normandie" }, { code: "NAQ", name: "Nouvelle-Aquitaine" }, { code: "OCC", name: "Occitanie" },
    { code: "PDL", name: "Pays de la Loire" }, { code: "PAC", name: "Provence-Alpes-Côte d'Azur" },
  ],
  IT: [
    { code: "65", name: "Abruzzo" }, { code: "77", name: "Basilicata" }, { code: "78", name: "Calabria" },
    { code: "72", name: "Campania" }, { code: "45", name: "Emilia-Romagna" }, { code: "36", name: "Friuli-Venezia Giulia" },
    { code: "62", name: "Lazio" }, { code: "42", name: "Liguria" }, { code: "25", name: "Lombardia" },
    { code: "57", name: "Marche" }, { code: "67", name: "Molise" }, { code: "21", name: "Piemonte" },
    { code: "75", name: "Puglia" }, { code: "88", name: "Sardegna" }, { code: "82", name: "Sicilia" },
    { code: "52", name: "Toscana" }, { code: "32", name: "Trentino-Alto Adige" }, { code: "55", name: "Umbria" },
    { code: "23", name: "Valle d'Aosta" }, { code: "34", name: "Veneto" },
  ],
  ES: [
    { code: "AN", name: "Andalucía" }, { code: "AR", name: "Aragón" }, { code: "AS", name: "Asturias" },
    { code: "CN", name: "Canarias" }, { code: "CB", name: "Cantabria" }, { code: "CM", name: "Castilla-La Mancha" },
    { code: "CL", name: "Castilla y León" }, { code: "CT", name: "Cataluña" }, { code: "EX", name: "Extremadura" },
    { code: "GA", name: "Galicia" }, { code: "IB", name: "Islas Baleares" }, { code: "RI", name: "La Rioja" },
    { code: "MD", name: "Madrid" }, { code: "MC", name: "Murcia" }, { code: "NC", name: "Navarra" },
    { code: "PV", name: "País Vasco" }, { code: "VC", name: "Valencia" },
  ],
  PT: [
    { code: "01", name: "Aveiro" }, { code: "02", name: "Beja" }, { code: "03", name: "Braga" },
    { code: "04", name: "Bragança" }, { code: "05", name: "Castelo Branco" }, { code: "06", name: "Coimbra" },
    { code: "07", name: "Évora" }, { code: "08", name: "Faro" }, { code: "09", name: "Guarda" },
    { code: "10", name: "Leiria" }, { code: "11", name: "Lisboa" }, { code: "12", name: "Portalegre" },
    { code: "13", name: "Porto" }, { code: "14", name: "Santarém" }, { code: "15", name: "Setúbal" },
    { code: "16", name: "Viana do Castelo" }, { code: "17", name: "Vila Real" }, { code: "18", name: "Viseu" },
    { code: "20", name: "Açores" }, { code: "30", name: "Madeira" },
  ],
  IN: [
    { code: "AN", name: "Andaman and Nicobar Islands" }, { code: "AP", name: "Andhra Pradesh" },
    { code: "AR", name: "Arunachal Pradesh" }, { code: "AS", name: "Assam" }, { code: "BR", name: "Bihar" },
    { code: "CH", name: "Chandigarh" }, { code: "CT", name: "Chhattisgarh" }, { code: "DL", name: "Delhi" },
    { code: "GA", name: "Goa" }, { code: "GJ", name: "Gujarat" }, { code: "HR", name: "Haryana" },
    { code: "HP", name: "Himachal Pradesh" }, { code: "JK", name: "Jammu and Kashmir" }, { code: "JH", name: "Jharkhand" },
    { code: "KA", name: "Karnataka" }, { code: "KL", name: "Kerala" }, { code: "LA", name: "Ladakh" },
    { code: "MP", name: "Madhya Pradesh" }, { code: "MH", name: "Maharashtra" }, { code: "MN", name: "Manipur" },
    { code: "ML", name: "Meghalaya" }, { code: "MZ", name: "Mizoram" }, { code: "NL", name: "Nagaland" },
    { code: "OR", name: "Odisha" }, { code: "PY", name: "Puducherry" }, { code: "PB", name: "Punjab" },
    { code: "RJ", name: "Rajasthan" }, { code: "SK", name: "Sikkim" }, { code: "TN", name: "Tamil Nadu" },
    { code: "TG", name: "Telangana" }, { code: "TR", name: "Tripura" }, { code: "UP", name: "Uttar Pradesh" },
    { code: "UT", name: "Uttarakhand" }, { code: "WB", name: "West Bengal" },
  ],
  CN: [
    { code: "AH", name: "Anhui" }, { code: "BJ", name: "Beijing" }, { code: "CQ", name: "Chongqing" },
    { code: "FJ", name: "Fujian" }, { code: "GS", name: "Gansu" }, { code: "GD", name: "Guangdong" },
    { code: "GX", name: "Guangxi" }, { code: "GZ", name: "Guizhou" }, { code: "HI", name: "Hainan" },
    { code: "HE", name: "Hebei" }, { code: "HL", name: "Heilongjiang" }, { code: "HA", name: "Henan" },
    { code: "HB", name: "Hubei" }, { code: "HN", name: "Hunan" }, { code: "JS", name: "Jiangsu" },
    { code: "JX", name: "Jiangxi" }, { code: "JL", name: "Jilin" }, { code: "LN", name: "Liaoning" },
    { code: "NM", name: "Inner Mongolia" }, { code: "NX", name: "Ningxia" }, { code: "QH", name: "Qinghai" },
    { code: "SN", name: "Shaanxi" }, { code: "SD", name: "Shandong" }, { code: "SH", name: "Shanghai" },
    { code: "SX", name: "Shanxi" }, { code: "SC", name: "Sichuan" }, { code: "TJ", name: "Tianjin" },
    { code: "XJ", name: "Xinjiang" }, { code: "XZ", name: "Tibet" }, { code: "YN", name: "Yunnan" },
    { code: "ZJ", name: "Zhejiang" }, { code: "HK", name: "Hong Kong" }, { code: "MO", name: "Macau" },
    { code: "TW", name: "Taiwan" },
  ],
  JP: [
    { code: "01", name: "Hokkaido" }, { code: "02", name: "Aomori" }, { code: "03", name: "Iwate" },
    { code: "04", name: "Miyagi" }, { code: "05", name: "Akita" }, { code: "06", name: "Yamagata" },
    { code: "07", name: "Fukushima" }, { code: "08", name: "Ibaraki" }, { code: "09", name: "Tochigi" },
    { code: "10", name: "Gunma" }, { code: "11", name: "Saitama" }, { code: "12", name: "Chiba" },
    { code: "13", name: "Tokyo" }, { code: "14", name: "Kanagawa" }, { code: "15", name: "Niigata" },
    { code: "16", name: "Toyama" }, { code: "17", name: "Ishikawa" }, { code: "18", name: "Fukui" },
    { code: "19", name: "Yamanashi" }, { code: "20", name: "Nagano" }, { code: "21", name: "Gifu" },
    { code: "22", name: "Shizuoka" }, { code: "23", name: "Aichi" }, { code: "24", name: "Mie" },
    { code: "25", name: "Shiga" }, { code: "26", name: "Kyoto" }, { code: "27", name: "Osaka" },
    { code: "28", name: "Hyogo" }, { code: "29", name: "Nara" }, { code: "30", name: "Wakayama" },
    { code: "31", name: "Tottori" }, { code: "32", name: "Shimane" }, { code: "33", name: "Okayama" },
    { code: "34", name: "Hiroshima" }, { code: "35", name: "Yamaguchi" }, { code: "36", name: "Tokushima" },
    { code: "37", name: "Kagawa" }, { code: "38", name: "Ehime" }, { code: "39", name: "Kochi" },
    { code: "40", name: "Fukuoka" }, { code: "41", name: "Saga" }, { code: "42", name: "Nagasaki" },
    { code: "43", name: "Kumamoto" }, { code: "44", name: "Oita" }, { code: "45", name: "Miyazaki" },
    { code: "46", name: "Kagoshima" }, { code: "47", name: "Okinawa" },
  ],
  AU: [
    { code: "NSW", name: "New South Wales" }, { code: "VIC", name: "Victoria" }, { code: "QLD", name: "Queensland" },
    { code: "WA", name: "Western Australia" }, { code: "SA", name: "South Australia" }, { code: "TAS", name: "Tasmania" },
    { code: "ACT", name: "Australian Capital Territory" }, { code: "NT", name: "Northern Territory" },
  ],
  RU: [
    { code: "MOW", name: "Moskva" }, { code: "SPE", name: "Sankt-Peterburg" }, { code: "MOS", name: "Moskovskaya oblast" },
    { code: "LEN", name: "Leningradskaya oblast" }, { code: "KDA", name: "Krasnodarskiy kray" },
    { code: "SVE", name: "Sverdlovskaya oblast" }, { code: "TAT", name: "Tatarstan" },
    { code: "NVS", name: "Novosibirskaya oblast" }, { code: "ROS", name: "Rostovskaya oblast" },
    { code: "BA", name: "Bashkortostan" },
  ],
};

export function getCountryName(code: string, locale: string): string {
  try {
    const tag = locale === "pt" ? "pt-BR" : locale === "zh" ? "zh-CN" : locale;
    const dn = new Intl.DisplayNames([tag, "en"], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - 65),
    A + (code.charCodeAt(1) - 65),
  );
}
