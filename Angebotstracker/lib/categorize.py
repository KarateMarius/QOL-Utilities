"""Keyword based categorisation of offer titles.

The original tracker only knew protein / gemüse / getränke / sonstige, which
dropped ~60% of all offers into "sonstige" and made the category filter close
to useless. Drogerie/Haushalt, Milchprodukte and Süßwaren are split out here.
"""
from __future__ import annotations

import re

PROTEIN_KEYWORDS = [
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
]

VEGGIE_KEYWORDS = [
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
]

GETRAENKE_KEYWORDS = [
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
]

MILCH_KEYWORDS = [
    "joghurt", "jogurt", "käse", "gouda", "camembert", "brie", "emmentaler",
    "mozzarella", "feta", "frischkäse", "schmand", "crème fraîche", "creme fraiche",
    "sahne", "schlagsahne", "butter", "margarine", "buttermilch", "kefir",
    "pudding", "milchreis", "grießbrei", "quarkspeise",
    "streichzart", "scheiben käse", "reibekäse", "parmesan", "mascarpone",
    "ricotta", "harzer", "hirtenkäse", "bergkäse",
    "vollmilch", "frischmilch", "h-milch", "fettarme milch", "landmilch",
    "weidemilch", "milchdrink", "kondensmilch",
]

SUESS_KEYWORDS = [
    "schokolade", "schoko", "praline", "riegel", "keks", "kekse", "waffel",
    "bonbon", "gummibärchen", "lakritz", "fruchtgummi", "haribo",
    "eis", "eiscreme", "magnum", "cornetto", "langnese",
    "kuchen", "torte", "muffin", "donut", "croissant", "gebäck",
    "chips", "flips", "erdnussflips", "salzstangen", "cracker", "popcorn",
    "nutella", "nuss-nougat", "m&m", "snickers", "kinder", "milka", "ritter sport",
    "marmelade", "konfitüre", "fruchtaufstrich", "honig",
]

HAUSHALT_KEYWORDS = [
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
]

CATEGORIES = ["protein", "gemüse", "milch", "getränke", "süßes", "haushalt", "sonstige"]

CATEGORY_LABELS = {
    "protein": "Protein",
    "gemüse": "Obst & Gemüse",
    "milch": "Milchprodukte",
    "getränke": "Getränke",
    "süßes": "Snacks & Süßes",
    "haushalt": "Drogerie & Haushalt",
    "sonstige": "Sonstige",
}


def categorize(title: str) -> str:
    t = title.lower()

    # Non-food wins first: a "Katzennassfutter Filets" is not protein for us.
    for kw in HAUSHALT_KEYWORDS:
        if kw in t:
            return "haushalt"
    for kw in PROTEIN_KEYWORDS:
        if kw in t:
            return "protein"
    for kw in VEGGIE_KEYWORDS:
        if kw in t:
            return "gemüse"
    for kw in MILCH_KEYWORDS:
        if kw in t:
            return "milch"
    for kw in GETRAENKE_KEYWORDS:
        if kw in t:
            return "getränke"
    for kw in SUESS_KEYWORDS:
        if kw in t:
            return "süßes"

    # Short generic terms only with word boundaries, so "Wassermelone" or
    # "Teelicht" don't end up as drinks.
    for kw in ("wasser", "tee", "milch"):
        if re.search(rf"\b{kw}\b", t):
            return "getränke" if kw != "milch" else "milch"

    return "sonstige"
