// Regions
export const REGIONS = [
  { id: "tunis", name: "Grand Tunis", icon: "🏛️", lt: 36.81, lg: 10.18, subs: ["Tunis Centre", "Carthage & Sidi Bou Saïd", "La Marsa & Gammarth"] },
  { id: "sahel", name: "Sahel", icon: "🏟️", lt: 35.75, lg: 10.70, subs: ["Sousse", "Monastir", "Mahdia"] },
  { id: "nord_ouest", name: "Nord-Ouest", icon: "🌲", lt: 36.60, lg: 8.90, subs: ["Tabarka", "Aïn Draham", "Béja", "Le Kef", "Testour & Dougga", "Bou Salem"] },
  { id: "nord_est", name: "Nord-Est", icon: "⚓", lt: 37.27, lg: 9.87, subs: ["Bizerte", "Ichkeul", "Raf Raf", "Ghar El Melh"] },
  { id: "zaghouan", name: "Zaghouan", icon: "⛰️", lt: 36.40, lg: 10.14, subs: ["Zaghouan", "Jbel Oust"] },
  { id: "cap_bon", name: "Cap Bon", icon: "🌊", lt: 36.60, lg: 10.80, subs: ["Hammamet", "Nabeul", "Kélibia", "Korbus", "El Haouaria", "Korba", "Soliman"] },
  { id: "centre", name: "Centre", icon: "🕌", lt: 35.50, lg: 10.30, subs: ["Kairouan", "El Jem"] },
  { id: "sud_ouest", name: "Sud-Ouest", icon: "🌴", lt: 33.92, lg: 8.13, subs: ["Tozeur", "Nefta & Chebika", "Tamerza", "Douz"] },
  { id: "sud_est", name: "Sud-Est", icon: "🏜️", lt: 33.50, lg: 10.20, subs: ["Matmata", "Tataouine", "Gabès", "Médenine & Zarzis"] },
  { id: "djerba", name: "Djerba", icon: "🏝️", lt: 33.81, lg: 10.86, subs: ["Houmt Souk", "Midoun", "Erriadh"] },
  { id: "sfax", name: "Sfax", icon: "🐚", lt: 34.74, lg: 10.76, subs: ["Sfax Ville", "Kerkennah"] }
];

// Travel Profiles
export const PROFILES = {
  aventurier: { l: "Aventurier", i: "🧗", w: { attraction: 1, nature: 1.6, restaurant: .5, cafe: .4, hotel: .3, beach: .8, activity: 1.2, mosque: .5 } },
  culturel: { l: "Culturel", i: "🎭", w: { attraction: 1.5, nature: .5, restaurant: .9, cafe: 1.2, hotel: .3, beach: .3, activity: .5, mosque: 1.4 } },
  nature_p: { l: "Nature", i: "🌿", w: { attraction: .5, nature: 1.8, restaurant: .4, cafe: .6, hotel: .3, beach: 1, activity: 1, mosque: .2 } },
  gourmand: { l: "Gourmand", i: "🍽️", w: { attraction: .6, nature: .4, restaurant: 1.8, cafe: 1.5, hotel: .5, beach: .6, activity: .6, mosque: .2 } },
  photo: { l: "Photo", i: "📸", w: { attraction: 1.3, nature: 1.5, restaurant: .4, cafe: .8, hotel: .2, beach: .9, activity: .6, mosque: 1 } },
  detente: { l: "Détente", i: "🧘", w: { attraction: .3, nature: 1.3, restaurant: 1, cafe: 1.3, hotel: 1.5, beach: 1.6, activity: .6, mosque: .2 } },
  spirituel: { l: "Spirituel", i: "🕌", w: { attraction: 1.2, nature: .8, restaurant: .4, cafe: .5, hotel: .3, beach: .1, activity: .6, mosque: 1.8 } },
  hotelier: { l: "Hôtels 5★", i: "🏨", w: { attraction: .5, nature: .3, restaurant: .8, cafe: .5, hotel: 2, beach: .6, activity: .6, mosque: .2 } }
};

// Companions
export const COMPS = [
  { k: "solo", l: "Seul(e)", i: "🚶" },
  { k: "couple", l: "Couple", i: "💑" },
  { k: "famille", l: "Famille", i: "👨‍👩‍👧‍👦" },
  { k: "amis", l: "Amis", i: "👯" },
  { k: "guide", l: "Guide", i: "🎙️" }
];

// Seasons
export const SEASONS = {
  printemps: { l: "Printemps", i: "🌸", s: "Mars - Mai" },
  ete: { l: "Été", i: "☀️", s: "Juin - Août" },
  automne: { l: "Automne", i: "🍂", s: "Sep - Nov" },
  hiver: { l: "Hiver", i: "❄️", s: "Déc - Fév" }
};

// Zones for AI Planning
export const ZONES = {
  all: { l: "Toute la Tunisie", i: "🇹🇳", g: "top", regions: ["tunis", "sahel", "djerba", "cap_bon", "sud_ouest", "nord_ouest", "sud_est", "nord_est", "centre", "sfax", "zaghouan"] },
  nord: { l: "Nord", i: "🏔️", g: "top", regions: ["tunis", "nord_ouest", "nord_est", "cap_bon", "zaghouan"] },
  centre_all: { l: "Centre & Sahel", i: "🏟️", g: "top", regions: ["centre", "sahel", "sfax"] },
  sud: { l: "Sud & Îles", i: "🏜️", g: "top", regions: ["sud_ouest", "sud_est", "djerba"] },
  tunis: { l: "Tunis", i: "🏛️", g: "reg", regions: ["tunis"] },
  nord_ouest: { l: "Nord-Ouest", i: "🌲", g: "reg", regions: ["nord_ouest"] },
  nord_est: { l: "Nord-Est", i: "⚓", g: "reg", regions: ["nord_est"] },
  cap_bon: { l: "Cap Bon", i: "🌊", g: "reg", regions: ["cap_bon"] },
  sahel: { l: "Sahel", i: "🏟️", g: "reg", regions: ["sahel"] },
  centre: { l: "Centre", i: "🕌", g: "reg", regions: ["centre"] },
  sud_ouest: { l: "Sud-Ouest", i: "🌴", g: "reg", regions: ["sud_ouest"] },
  sud_est: { l: "Sud-Est", i: "🏜️", g: "reg", regions: ["sud_est"] },
  djerba: { l: "Djerba", i: "🏝️", g: "reg", regions: ["djerba"] },
  sfax: { l: "Sfax", i: "🐚", g: "reg", regions: ["sfax"] },
  zaghouan: { l: "Zaghouan", i: "⛰️", g: "reg", regions: ["zaghouan"] }
};
