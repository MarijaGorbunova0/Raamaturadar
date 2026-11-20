// RAAMATU DETAILVAADE (Open Library API)

const OL_URL = "https://openlibrary.org";
const KAANE_URL = "https://covers.openlibrary.org/b/id/";
const KOHATAIDE_KAAS = "assets/book-cover-placeholder.svg";

// Mitu žanri ja keelt maksimaalselt kuvatakse
const MAX_ZANRE = 3;
const MAX_KEELI = 3;

document.addEventListener("DOMContentLoaded", () => {
  const teade = document.getElementById("raamatu-teade");
  const vaade = document.getElementById("raamatu-vaade");

  if (!teade || !vaade) return;

  const parameetrid = new URLSearchParams(window.location.search);
  const id = parameetrid.get("id");
  const valitudKeel = parameetrid.get("keel");
  const valjaandeId = parameetrid.get("valjaanne");

  // Lubame ainult Open Library teose ID-d (nt OL82586W)
  if (!id || !/^OL\d+W$/.test(id)) {
    naitaTeadet("Raamatut ei leitud. Vali raamat avastamise lehelt.");
    return;
  }

  laeRaamat(id);

  // API PÄRINGUD

  async function laeJson(url) {
    const vastus = await fetch(url);
    if (!vastus.ok) throw new Error(`API viga: ${vastus.status}`);
    return vastus.json();
  }

  async function laeRaamat(teoseId) {
    const otsinguParameetrid = new URLSearchParams({
      q: `key:"/works/${teoseId}"`,
      fields: "author_name,first_publish_year,language",
      limit: "1",
    });

    try {
      // Teose andmed (kirjeldus, žanrid, kaas), otsingu andmed
      // (autor, aasta, keeled) ja valitud keeles väljaanne (pealkiri, kaas)
      // laetakse paralleelselt
      const [teos, otsing, valjaanne] = await Promise.all([
        laeJson(`${OL_URL}/works/${teoseId}.json`),
        laeJson(`${OL_URL}/search.json?${otsinguParameetrid}`).catch(
          () => null,
        ),
        valjaandeId && /^OL\d+M$/.test(valjaandeId)
          ? laeJson(`${OL_URL}/books/${valjaandeId}.json`).catch(() => null)
          : null,
      ]);

      const lisaandmed = (otsing && otsing.docs && otsing.docs[0]) || {};
      naitaRaamatut(teos, lisaandmed, valjaanne);
    } catch (viga) {
      console.error(viga);
      naitaTeadet(
        "Raamatu andmeid ei õnnestunud laadida. Proovi hiljem uuesti!",
      );
    }
  }

  // KUVAMINE

  function naitaTeadet(tekst) {
    teade.textContent = tekst;
    teade.hidden = false;
    vaade.hidden = true;
  }

  function naitaRaamatut(teos, lisaandmed, valjaanne) {
    const pealkiri =
      (valjaanne && valjaanne.title) || teos.title || "Pealkiri puudub";
    document.title = `Raamaturadar | ${pealkiri}`;

    maaraTekst("raamatu-pealkiri", pealkiri);
    maaraTekst("raamatu-kirjeldus", puhastaKirjeldus(teos.description));
    maaraTekst("raamatu-autor", autorid(lisaandmed.author_name));
    maaraTekst(
      "raamatu-aasta",
      lisaandmed.first_publish_year || aastaKuupaevast(teos.first_publish_date),
    );
    maaraTekst("raamatu-zanr", zanrid(teos.subjects));
    maaraTekst("raamatu-keel", keeled(lisaandmed.language));

    // Väljaande olemasolul kasutame ainult selle kaant, et kaas oleks
    // valitud keeles (kaane puudumisel kuvatakse kohatäide)
    maaraKaas(valjaanne ? valjaanne.covers : teos.covers, pealkiri);

    teade.hidden = true;
    vaade.hidden = false;
  }

  function maaraTekst(elemendiId, tekst) {
    const element = document.getElementById(elemendiId);
    if (element) element.textContent = tekst || "Teadmata";
  }

  function maaraKaas(kaaned, pealkiri) {
    const kaas = document.getElementById("raamatu-kaas");
    if (!kaas) return;

    const kaaneId = (kaaned || []).find((k) => k > 0);
    if (!kaaneId) return;

    kaas.addEventListener("error", () => {
      kaas.src = KOHATAIDE_KAAS;
      kaas.alt = "Raamatu kaanepilt puudub";
    });
    kaas.src = `${KAANE_URL}${kaaneId}-L.jpg`;
    kaas.alt = `Raamatu „${pealkiri}“ kaanepilt`;
  }

  // ANDMETE TÖÖTLEMINE

  function puhastaKirjeldus(kirjeldus) {
    let tekst = typeof kirjeldus === "string" ? kirjeldus : kirjeldus?.value;
    if (!tekst) return "Kirjeldus puudub.";

    tekst = tekst
      // Eemalda "See also" jms osa, mis algab eraldusjoonega
      .split(/\r?\n-{3,}/)[0]
      // Eemalda allikaviited, nt "([source](https://...))"
      .replace(/\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, "")
      // Markdowni lingid -> ainult tekst
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return tekst || "Kirjeldus puudub.";
  }

  function autorid(nimed) {
    if (!nimed || nimed.length === 0) return "Teadmata";
    return [...new Set(nimed)].slice(0, 3).join(", ");
  }

  function aastaKuupaevast(kuupaev) {
    const leitud = String(kuupaev || "").match(/\d{4}/);
    return leitud ? leitud[0] : "";
  }

  function zanrid(teemad) {
    if (!teemad || teemad.length === 0) return "Teadmata";

    return teemad
      .filter((teema) => !teema.includes(":") && teema.length < 40)
      .slice(0, MAX_ZANRE)
      .map((teema) => teema.charAt(0).toUpperCase() + teema.slice(1))
      .join(", ");
  }

  function keeled(koodid) {
    if (valitudKeel) return keeleNimi(valitudKeel);
    if (!koodid || koodid.length === 0) return "Teadmata";

    // Eelistame keeli, millel on eestikeelne nimi olemas
    const tuntud = koodid.filter((kood) => KEELTE_NIMED[kood]);
    const jarjestatud = [
      ...Object.keys(KEELTE_NIMED).filter((kood) => tuntud.includes(kood)),
      ...koodid.filter((kood) => !KEELTE_NIMED[kood]),
    ];

    const kuvatavad = jarjestatud.slice(0, MAX_KEELI).map(keeleNimi);
    const ulejaanud = koodid.length - kuvatavad.length;

    return ulejaanud > 0
      ? `${kuvatavad.join(", ")} ja veel ${ulejaanud}`
      : kuvatavad.join(", ");
  }
});
