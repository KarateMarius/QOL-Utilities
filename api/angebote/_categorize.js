// Einordnung von Angebotstiteln in Kategorien per Stichwortliste.
//
// Die Reihenfolge der Pruefungen ist Absicht: Drogerie/Haushalt zuerst, sonst
// landet "Katzennassfutter Filets" wegen "filet" unter Protein.

const HAUSHALT = [
  "waschmittel", "weichspüler", "spülmittel", "reiniger", "putzmittel",
  "toilettenpapier", "küchenrolle", "taschentücher", "feuchttücher",
  "windel", "pampers", "binden", "slipeinlagen", "tampons",
  "shampoo", "duschgel", "deo", "zahnpasta", "zahnbürste", "mundspülung",
  "rasierer", "rasierklingen", "creme", "bodylotion", "sonnenmilch", "sonnencreme",
  "parfum", "eau de", "make-up", "mascara", "lippenstift", "nagellack",
  "katzenfutter", "hundefutter", "katzennassfutter", "katzenstreu", "tiernahrung",
  "katzensnack", "hundesnack", "vitakraft", "whiskas", "felix", "sheba",
  "batterie", "glühbirne", "müllbeutel", "alufolie", "frischhaltefolie",
  "geschirrspül", "spülmaschinentabs", "entkalker",
  "urlaub", "reise", "flug", "hotel", "kreuzfahrt", "pauschalreise",
  "grill", "grillrost", "grillzange", "holzkohle", "feuerstelle",
  "gartenliege", "sonnenschirm", "gartenmöbel", "rasenmäher",
  "werkzeug", "bohrmaschine", "säge", "akku-", "schrauber",
  "fahrrad", "e-bike", "roller", "tretroller",
  "laptop", "tablet", "smartphone", "fernseher", "monitor", "drucker",
  "staubsauger", "waschmaschine", "geschirrspüler", "kühlschrank",
  "klimaanlage", "ventilator", "heizlüfter",
  "kleidung", "t-shirt", "hose", "shorts", "jacke", "schuhe", "sneaker",
  "badehose", "bikini", "badeanzug",
  "spielzeug", "puzzle", "lego", "puppe",
  "zelt", "schlafsack", "campingstuhl",
  "auto", "pkw", "reifen", "motoröl",
];

const PROTEIN = [
  "hähnchen", "hühnchen", "chicken", "hähnchenbrust", "hühnerbrust",
  "rindersteak", "rind", "steak", "filet", "schnitzel",
  "hackfleisch", "schweinefleisch", "schwein",
  "lachs", "forelle", "thunfisch", "fisch", "garnelen", "krabben", "shrimps",
  "quark", "skyr", "hüttenkäse", "körniger frischkäse",
  "eier", "freilandeier", "bio-eier",
  "proteinpulver", "proteinriegel", "whey", "protein",
  "kasseler", "chorizo", "schinken", "putenbrust", "pute",
  "fleisch", "kotelett", "spare ribs", "ribs", "gyros", "frikadelle",
  "garnele", "muschel", "hering", "makrele", "sardine", "matjes",
  "speck", "salami", "wurst", "bratwurst", "leberkäse", "aufschnitt",
  "tofu", "seitan", "linsen", "kichererbsen",
];

const GEMUESE = [
  "brokkoli", "broccoli", "spinat", "paprika", "zucchini",
  "tomate", "tomaten", "gurke", "gurken",
  "salat", "rucola", "feldsalat", "eisbergsalat", "romanasalat",
  "möhren", "karotten", "karotte",
  "beeren", "erdbeeren", "blaubeeren", "himbeeren", "brombeeren", "heidelbeeren",
  "banane", "bananen", "apfel", "äpfel", "birne", "birnen",
  "avocado", "gemüse", "obst", "rotkohl", "weißkohl",
  "lauch", "pilze", "champignons", "shiitake",
  "blumenkohl", "rosenkohl", "erbsen", "grüne bohnen", "spargel",
  "rote bete", "sellerie", "kürbis", "süßkartoffel", "kohlrabi",
  "fenchel", "pak choi", "mango", "melone", "honigmelone", "wassermelone",
  "pfirsich", "nektarine", "kirsche", "kirschen", "weintrauben", "trauben",
  "zitrone", "limette", "grapefruit", "kiwi", "ananas",
  "chili", "ingwer", "knoblauch", "zwiebel", "kartoffel", "kartoffeln",
  "kopfsalat", "endivie", "radicchio", "aubergine", "mais",
  "nektarinen", "pflaumen", "aprikosen", "clementinen", "mandarinen", "orangen",
];

const MILCH = [
  "joghurt", "jogurt", "käse", "gouda", "camembert", "brie", "emmentaler",
  "mozzarella", "feta", "frischkäse", "schmand", "crème fraîche", "creme fraiche",
  "sahne", "schlagsahne", "butter", "margarine", "buttermilch", "kefir",
  "pudding", "milchreis", "grießbrei", "quarkspeise",
  "streichzart", "scheiben käse", "reibekäse", "parmesan", "mascarpone",
  "ricotta", "harzer", "hirtenkäse", "bergkäse",
  "vollmilch", "frischmilch", "h-milch", "fettarme milch", "landmilch",
  "weidemilch", "milchdrink", "kondensmilch",
];

const GETRAENKE = [
  "mineralwasser", "cola", "fanta", "sprite", "pepsi",
  "limonade", "limo", "brause", "eistee",
  "saft", "orangensaft", "apfelsaft", "multivitaminsaft", "fruchtsaft",
  "smoothie", "nektar", "schorle",
  "bier", "pils", "weizen", "radler", "alkoholfrei",
  "wein", "rotwein", "weißwein", "rosé", "prosecco", "sekt", "champagner",
  "whisky", "vodka", "wodka", "gin", "rum", "likör", "schnaps", "aperitif",
  "pinot", "grigio", "merlot", "riesling", "chardonnay", "sauvignon",
  "primitivo", "tempranillo", "grauburgunder", "spätburgunder", "dornfelder",
  "kaffee", "espresso", "cappuccino", "latte",
  "früchtetee", "kräutertee",
  "kakao", "heiße schokolade",
  "energy drink", "iso drink", "sportgetränk",
  "hafermilch", "sojamilch", "mandelmilch",
  "getränk", "softdrink",
];

const SUESS = [
  "schokolade", "schoko", "praline", "riegel", "keks", "kekse", "waffel",
  "bonbon", "gummibärchen", "lakritz", "fruchtgummi", "haribo",
  "eis", "eiscreme", "magnum", "cornetto", "langnese",
  "kuchen", "torte", "muffin", "donut", "croissant", "gebäck",
  "chips", "flips", "erdnussflips", "salzstangen", "cracker", "popcorn",
  "nutella", "nuss-nougat", "m&m", "snickers", "kinder", "milka", "ritter sport",
  "marmelade", "konfitüre", "fruchtaufstrich", "honig",
];

export const CATEGORIES = [
  { key: "protein", label: "Protein" },
  { key: "gemüse", label: "Obst & Gemüse" },
  { key: "milch", label: "Milchprodukte" },
  { key: "getränke", label: "Getränke" },
  { key: "süßes", label: "Snacks & Süßes" },
  { key: "haushalt", label: "Drogerie & Haushalt" },
  { key: "sonstige", label: "Sonstige" },
];

const ORDER = [
  [HAUSHALT, "haushalt"],
  [PROTEIN, "protein"],
  [GEMUESE, "gemüse"],
  [MILCH, "milch"],
  [GETRAENKE, "getränke"],
  [SUESS, "süßes"],
];

export function categorize(title) {
  const t = String(title || "").toLowerCase();

  for (const [words, key] of ORDER) {
    for (const word of words) {
      if (t.includes(word)) return key;
    }
  }

  // Kurze Allerweltswoerter nur mit Wortgrenze, sonst wird aus einer
  // "Wassermelone" ein Getraenk.
  if (/\bmilch\b/.test(t)) return "milch";
  if (/\bwasser\b/.test(t) || /\btee\b/.test(t)) return "getränke";

  return "sonstige";
}
