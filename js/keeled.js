// KEELTE NIMED (Open Library keelekoodid -> eestikeelsed nimed)

const KEELTE_NIMED = {
  eng: "Inglise",
  est: "Eesti",
  ger: "Saksa",
  fre: "Prantsuse",
  rus: "Vene",
  fin: "Soome",
  ukr: "Ukraina",
  spa: "Hispaania",
  ita: "Itaalia",
  swe: "Rootsi",
  lav: "Läti",
  lit: "Leedu",
  pol: "Poola",
  jpn: "Jaapani",
  chi: "Hiina",
};

function keeleNimi(kood) {
  if (!kood) return "Teadmata";
  return KEELTE_NIMED[kood] || kood.toUpperCase();
}
