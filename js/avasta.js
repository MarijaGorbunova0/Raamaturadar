// RAAMATU AVASTAMINE (Open Library API)

const OTSINGU_URL = "https://openlibrary.org/search.json";
const KAANE_URL = "https://covers.openlibrary.org/b/id/";
const KOHATAIDE_KAAS = "assets/book-cover-placeholder.svg";

// Open Library lubab sügavat lehitsemist piiratult, seega valime juhusliku
// raamatu esimese 1000 tulemuse seast
const MAX_NIHE = 1000;

const VALJAD = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "subject",
  "language",
  // Valitud keelele vastav väljaanne (pealkiri ja kaas selles keeles)
  "editions",
  "editions.key",
  "editions.title",
  "editions.cover_i",
  "editions.language",
].join(",");

document.addEventListener("DOMContentLoaded", () => {
  const leiaNupp = document.getElementById("leia-raamat");
  const onneNupp = document.getElementById("feeling-lucky");
  const tulemus = document.getElementById("tulemus");

  if (!leiaNupp || !onneNupp || !tulemus) return;

  leiaNupp.addEventListener("click", () => {
    const filtrid = loeFiltrid();
    otsiRaamat(filtrid);
  });

  onneNupp.addEventListener("click", () => {
    otsiRaamat({ zanr: juhuslikZanr(), keel: "", aasta: "" });
  });

  // FILTRID

  function loeFiltrid() {
    const filtrid = { zanr: "", keel: "", aasta: "" };

    document.querySelectorAll(".pill-block[data-filter]").forEach((grupp) => {
      const valitud = grupp.querySelector(".pill--selected");
      filtrid[grupp.dataset.filter] = valitud ? valitud.dataset.value : "";
    });

    // Kui ühtegi filtrit pole valitud, otsime juhuslikust žanrist
    if (!filtrid.zanr && !filtrid.keel && !filtrid.aasta) {
      filtrid.zanr = juhuslikZanr();
    }

    return filtrid;
  }

  function juhuslikZanr() {
    const zanrid = Array.from(
      document.querySelectorAll('[data-filter="zanr"] .pill'),
    )
      .map((nupp) => nupp.dataset.value)
      .filter(Boolean);

    return zanrid[Math.floor(Math.random() * zanrid.length)];
  }

  function koostaParing(filtrid) {
    const osad = [];

    if (filtrid.zanr) osad.push(`subject:"${filtrid.zanr}"`);
    if (filtrid.keel) osad.push(`language:${filtrid.keel}`);
    if (filtrid.aasta) {
      const [algus, lopp] = filtrid.aasta.split("-");
      osad.push(`first_publish_year:[${algus} TO ${lopp}]`);
    }

    return osad.join(" AND ");
  }

  // API PÄRINGUD

  async function teeOtsing(paring, nihe) {
    const parameetrid = new URLSearchParams({
      q: paring,
      fields: VALJAD,
      limit: "1",
      offset: String(nihe),
    });

    const vastus = await fetch(`${OTSINGU_URL}?${parameetrid}`);
    if (!vastus.ok) throw new Error(`API viga: ${vastus.status}`);

    return vastus.json();
  }

  async function otsiRaamat(filtrid) {
    const paring = koostaParing(filtrid);

    maaraLaadimine(true);
    naitaTeadet("Otsin raamatut…");

    try {
      // 1. päring: mitu raamatut filtritele vastab
      const esimene = await teeOtsing(paring, 0);
      const kokku = Math.min(esimene.numFound || 0, MAX_NIHE);

      if (kokku === 0) {
        naitaTeadet(
          "Nende eelistustega raamatut ei leitud. Proovi teisi filtreid!",
        );
        return;
      }

      // 2. päring: juhuslik raamat tulemuste seast
      const nihe = Math.floor(Math.random() * kokku);
      const andmed = nihe === 0 ? esimene : await teeOtsing(paring, nihe);
      const raamat = andmed.docs && andmed.docs[0];

      if (!raamat) {
        naitaTeadet("Raamatut ei õnnestunud laadida. Proovi uuesti!");
        return;
      }

      naitaRaamatut(raamat, filtrid);
    } catch (viga) {
      console.error(viga);
      naitaTeadet(
        "Raamatute andmebaasiga ei õnnestunud ühendust saada. Proovi hiljem uuesti!",
      );
    } finally {
      maaraLaadimine(false);
    }
  }

  // KUVAMINE

  function maaraLaadimine(laeb) {
    leiaNupp.disabled = laeb;
    onneNupp.disabled = laeb;
    tulemus.setAttribute("aria-busy", String(laeb));
  }

  function naitaTeadet(tekst) {
    tulemus.replaceChildren();

    const teade = document.createElement("p");
    teade.className = "avasta-teade";
    teade.textContent = tekst;
    tulemus.append(teade);
  }

  function naitaRaamatut(raamat, filtrid) {
    tulemus.replaceChildren();

    const kaart = document.createElement("article");
    kaart.className = "card avasta-raamat";

    // Keele valimisel kasutame selles keeles väljaande pealkirja ja kaant,
    // muidu teose üldist pealkirja ja kaant
    const valjaanne = filtrid.keel ? leiaValjaanne(raamat, filtrid.keel) : null;
    const raamatuPealkiri =
      (valjaanne && valjaanne.title) || raamat.title || "Pealkiri puudub";
    const kaaneId = valjaanne ? valjaanne.cover_i : raamat.cover_i;

    // Kaanepilt
    const kaas = document.createElement("img");
    kaas.className = "avasta-raamat-kaas";
    kaas.src = kaaneId ? `${KAANE_URL}${kaaneId}-M.jpg` : KOHATAIDE_KAAS;
    kaas.alt = kaaneId
      ? `Raamatu „${raamatuPealkiri}“ kaanepilt`
      : "Raamatu kaanepilt puudub";
    kaas.addEventListener("error", () => {
      kaas.src = KOHATAIDE_KAAS;
      kaas.alt = "Raamatu kaanepilt puudub";
    });

    // Info
    const info = document.createElement("div");
    info.className = "avasta-raamat-info";

    const pealkiri = document.createElement("h2");
    pealkiri.className = "avasta-raamat-pealkiri";
    pealkiri.textContent = raamatuPealkiri;
    info.append(pealkiri);

    const autor = raamat.author_name
      ? [...new Set(raamat.author_name)].slice(0, 3).join(", ")
      : "Teadmata";
    const aasta = raamat.first_publish_year || "Teadmata";
    const zanr =
      filtrid.zanr || (raamat.subject && raamat.subject[0]) || "Teadmata";
    const keel = keeleNimi(filtrid.keel || (raamat.language || [])[0]);

    info.append(
      looMetaandmed("Autor", autor),
      looMetaandmed("Aasta", aasta),
      looMetaandmed("Žanr", suurAlgustaht(zanr)),
      looMetaandmed("Keel", keel),
    );

    // Detailvaate link
    const link = document.createElement("a");
    link.className = "pill pill--filled avasta-raamat-link";
    const lingiParameetrid = new URLSearchParams({
      id: raamat.key.replace("/works/", ""),
    });
    if (filtrid.keel) lingiParameetrid.set("keel", filtrid.keel);
    if (valjaanne && valjaanne.key) {
      lingiParameetrid.set(
        "valjaanne",
        valjaanne.key.replace("/books/", ""),
      );
    }
    link.href = `raamatu-vaade.html?${lingiParameetrid}`;
    link.textContent = "Vaata lähemalt";
    info.append(link);

    kaart.append(kaas, info);
    tulemus.append(kaart);
  }

  function leiaValjaanne(raamat, keel) {
    const valjaanded = (raamat.editions && raamat.editions.docs) || [];
    return (
      valjaanded.find((v) => (v.language || []).includes(keel)) || null
    );
  }

  function looMetaandmed(votm, vaartus) {
    const rida = document.createElement("div");
    rida.className = "book-metadata-item";

    const votmeElement = document.createElement("div");
    votmeElement.className = "book-metadata-key";
    votmeElement.textContent = votm;

    const vaartuseElement = document.createElement("div");
    vaartuseElement.className = "book-metadata-value";
    vaartuseElement.textContent = vaartus;

    rida.append(votmeElement, vaartuseElement);
    return rida;
  }

  function suurAlgustaht(tekst) {
    const s = String(tekst);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
});
