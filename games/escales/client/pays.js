// Les pays en plus des 8 de départ. Pour en ajouter un : une entrée ici (4 villes, de la moins chère à la plus chère), son drapeau et son décor dans countries.js, ses monuments dans assets/monuments/.
// Des lieux et rien d'autre : les faits restent neutres.
const city = (name, model, fact, short) => ({ name, model, fact, ...(short ? { short } : {}) });

export const EXTRA_COUNTRIES = [
  { id: 'israel', name: 'Israël', color: '#7CB8FF', cities: [
    city('Eilat', 'recifEilat', 'La mer Rouge et ses récifs de corail, tout au sud.'),
    city('Haïfa', 'jardinsHaifa', 'Des jardins en terrasses descendent jusqu’à la mer.'),
    city('Saint-Jean-d’Acre', 'citadelleAcre', 'Une vieille ville fortifiée au bord de la Méditerranée.', 'Acre'),
    city('Tel-Aviv', 'bauhaus', 'La Ville blanche et ses milliers d’immeubles Bauhaus.'),
  ] },
  { id: 'coreeNord', name: 'Corée du Nord', color: '#E4576A', cities: [
    city('Nampho', 'barrageNampho', 'Un barrage de 8 km ferme l’embouchure du Taedong.'),
    city('Wonsan', 'plageWonsan', 'Une station balnéaire sur la côte est.'),
    city('Kaesong', 'pagodeKaesong', 'L’ancienne capitale du royaume de Koryo.'),
    city('Pyongyang', 'ryugyong', 'Le Ryugyong, pyramide de 105 étages, domine la ville.'),
  ] },
  { id: 'congo', name: 'RD Congo', color: '#3FC1E0', cities: [
    city('Kisangani', 'piroguesBoyoma', 'Les chutes Wagenia et leurs pêcheurs sur le fleuve Congo.'),
    city('Goma', 'volcanGoma', 'Au bord du lac Kivu, au pied du volcan Nyiragongo.'),
    city('Lubumbashi', 'cuivreLubumbashi', 'La capitale du cuivre, au Katanga.'),
    city('Kinshasa', 'tourLimete', 'Une ville géante, face à Brazzaville sur le fleuve Congo.'),
  ] },
  { id: 'coreeSud', name: 'Corée du Sud', color: '#B39DF2', cities: [
    city('Gyeongju', 'cheomseongdae', 'L’observatoire de Cheomseongdae, vieux de près de 1 400 ans.'),
    city('Jeju', 'hallasan', 'Une île volcanique dominée par le mont Halla.'),
    city('Busan', 'gamcheon', 'Le village de Gamcheon et ses maisons colorées à flanc de colline.'),
    city('Séoul', 'lotteTower', 'La Lotte World Tower culmine à 555 mètres.'),
  ] },
  { id: 'chine', name: 'Chine', color: '#F0564F', cities: [
    city('Xi’an', 'guerriers', 'Des milliers de guerriers de terre cuite veillent sous terre.'),
    city('Guilin', 'karstGuilin', 'Des pitons calcaires le long de la rivière Li.'),
    city('Pékin', 'citeInterdite', 'La Cité interdite, le palais des empereurs.'),
    city('Shanghai', 'perleOrient', 'La tour de la Perle de l’Orient domine Pudong.'),
  ] },
  { id: 'inde', name: 'Inde', color: '#FFAD5C', cities: [
    city('Jaipur', 'hawaMahal', 'La ville rose et le palais des Vents.'),
    city('Bénarès', 'ghats', 'Les marches des ghats descendent dans le Gange.'),
    city('Agra', 'tajMahal', 'Le Taj Mahal, tout de marbre blanc.'),
    city('Mumbai', 'gateway', 'La Porte de l’Inde, face à la mer d’Oman.'),
  ] },
  { id: 'thailande', name: 'Thaïlande', color: '#C58BF0', cities: [
    city('Chiang Mai', 'lanternesChiangMai', 'Des centaines de temples, et des lanternes lâchées dans le ciel.'),
    city('Ayutthaya', 'ayutthaya', 'Les tours de brique de l’ancienne capitale du Siam.'),
    city('Phuket', 'longTail', 'Des bateaux à longue queue sur la mer d’Andaman.'),
    city('Bangkok', 'watArun', 'Le Wat Arun, temple de l’Aube, au bord du fleuve.'),
  ] },
  { id: 'turquie', name: 'Turquie', color: '#37C8B0', cities: [
    city('Göreme', 'montgolfiere', 'Des cheminées de fée, survolées par les montgolfières.'),
    city('Izmir', 'konak', 'La tour de l’Horloge, sur la place Konak.'),
    city('Antalya', 'portAntalya', 'Le vieux port et son minaret cannelé.'),
    city('Istanbul', 'sainteSophie', 'Sainte-Sophie, entre Europe et Asie.'),
  ] },
  { id: 'egypte', name: 'Égypte', color: '#E8C26B', cities: [
    city('Alexandrie', 'qaitbay', 'La citadelle de Qaitbay, là où se dressait le Phare.'),
    city('Louxor', 'karnak', 'Les colonnes géantes du temple de Karnak.'),
    city('Assouan', 'felouque', 'Les felouques glissent sur le Nil.'),
    city('Le Caire', 'gizeh', 'Les pyramides de Gizeh, aux portes de la ville.'),
  ] },
  { id: 'algerie', name: 'Algérie', color: '#5CCB8F', cities: [
    city('Ghardaïa', 'ghardaia', 'La vallée du M’Zab et ses villes en étages.'),
    city('Constantine', 'pontConstantine', 'La ville des ponts, au-dessus des gorges du Rhummel.'),
    city('Oran', 'santaCruz', 'Le fort de Santa Cruz veille sur la baie.'),
    city('Alger', 'maqam', 'Alger la Blanche et le Mémorial du Martyr.'),
  ] },
  { id: 'senegal', name: 'Sénégal', color: '#A4D65E', cities: [
    city('Saint-Louis', 'pontFaidherbe', 'Le pont Faidherbe relie l’île au continent.'),
    city('Gorée', 'goree', 'Une petite île sans voitures, mémoire de la traite des esclaves.'),
    city('Touba', 'touba', 'La Grande Mosquée et son minaret de 87 mètres.'),
    city('Dakar', 'renaissance', 'Le monument de la Renaissance africaine domine la ville.'),
  ] },
  { id: 'bresil', name: 'Brésil', color: '#4CD07D', cities: [
    city('Salvador', 'pelourinho', 'Les façades colorées du Pelourinho.'),
    city('Manaus', 'amazonas', 'Un opéra en pleine Amazonie.'),
    city('Brasília', 'cathedraleBrasilia', 'La cathédrale d’Oscar Niemeyer et ses colonnes courbes.'),
    city('Rio de Janeiro', 'christRio', 'Le Christ Rédempteur, bras ouverts au-dessus de la baie.', 'Rio'),
  ] },
  { id: 'argentine', name: 'Argentine', color: '#86D3F2', cities: [
    city('Ushuaïa', 'phareUshuaia', 'Au bout du monde, sur le canal Beagle.'),
    city('Mendoza', 'vignesMendoza', 'Les vignes au pied des Andes.'),
    city('Bariloche', 'chaletBariloche', 'Les lacs, les sapins et les chalets de Patagonie.'),
    city('Buenos Aires', 'obelisque', 'L’Obélisque, sur la plus large avenue de la ville.'),
  ] },
  { id: 'espagne', name: 'Espagne', color: '#FF7F50', cities: [
    city('Séville', 'giralda', 'La Giralda domine la cathédrale.'),
    city('Grenade', 'alhambra', 'L’Alhambra, palais rouge sur sa colline.'),
    city('Madrid', 'puertaAlcala', 'La Puerta de Alcalá, au cœur de la ville.'),
    city('Barcelone', 'sagrada', 'La Sagrada Família, en chantier depuis 1882.'),
  ] },
  { id: 'royaumeUni', name: 'Royaume-Uni', color: '#8093F1', cities: [
    city('Liverpool', 'liverBuilding', 'Les Beatles, et les oiseaux du Royal Liver Building.'),
    city('Manchester', 'stade', 'Deux grands clubs de foot et un passé industriel.'),
    city('Édimbourg', 'chateauEdimbourg', 'Le château, sur son rocher volcanique.'),
    city('Londres', 'bigBen', 'Big Ben sonne au bord de la Tamise.'),
  ] },
  { id: 'australie', name: 'Australie', color: '#F5A05A', cities: [
    city('Cairns', 'recifCairns', 'La porte de la Grande Barrière de corail.'),
    city('Alice Springs', 'uluru', 'Au cœur du désert, sur la route d’Uluru.'),
    city('Melbourne', 'tramMelbourne', 'Ses trams, et la gare de Flinders Street.'),
    city('Sydney', 'operaSydney', 'L’Opéra et ses voiles blanches dans la baie.'),
  ] },
];
