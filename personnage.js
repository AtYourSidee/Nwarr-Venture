// ========================================================
// PERSONNAGE.JS - Connexion Twitch & Générateur de Héros
// ========================================================

// Remplacer par votre Client ID obtenu sur la console développeur Twitch (https://dev.twitch.tv/console)
const TWITCH_CLIENT_ID = 'dgn81aedkbrbixvdlzm956pb5xf37h';

// URL et clé anonyme de votre projet Supabase (obtenus sur votre tableau de bord Supabase -> Project Settings -> API)
const SUPABASE_URL = 'https://lekwuaizcjdlbngwxpws.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5D3i4kNfWkQAHhm2iJiIFw_JcicI683';

// Configuration des URLs de redirection
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'user:read:email';

// Variables globales
let currentUser = null;
let allCompetences = [];
let allTalents = [];
let allEsprits = [];
let allEspritCompetences = [];
let allStatusEffects = [];
let allGameObjects = { consommables: [], équipements: [], artefacts: [] };
let supabaseClient = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Initialiser le client Supabase si configuré
  if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_URL !== 'VOTRE_SUPABASE_URL') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // Charger les données de compétences et d'esprits pour peupler la fiche
  await loadGameData();

  // Écouteurs de clics pour la connexion
  document.getElementById('twitch-login-btn').addEventListener('click', redirectToTwitch);
  document.getElementById('demo-login-btn').addEventListener('click', startDemoMode);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  let isFirstAuthCheck = true;

  if (supabaseClient) {
    // Écouter les changements d'état d'authentification Supabase
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // L'utilisateur est connecté à Supabase via Twitch
        currentUser = {
          username: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email.split('@')[0],
          avatar: session.user.user_metadata.avatar_url || 'static/twitchpp.png',
          isDemo: false,
          id: session.user.id
        };
        await showCharacterSheet(currentUser, isFirstAuthCheck);
      } else {
        // Hors ligne / non connecté
        if (!currentUser || !currentUser.isDemo) {
          currentUser = null;
          const loginSection = document.getElementById('login-section');
          const charSection = document.getElementById('character-section');
          if (charSection.style.display !== 'none') {
            transitionSection(charSection, loginSection, 'flex');
          } else {
            loginSection.style.display = 'flex';
          }
        }
      }
      isFirstAuthCheck = false;
    });
  } else {
    // Mode simulation / hors ligne local
    checkLocalStorageSession();
  }
}

// ========================================================
// CHARGEMENT DES DONNÉES DU JEU
// ========================================================
async function loadGameData() {
  try {
    let compRes = await fetch('data/competences.json');
    if (!compRes.ok) {
      compRes = await fetch('competences.json');
    }
    if (compRes.ok) {
      const data = await compRes.json();
      allCompetences = data['compétences commune'] || [];
      allTalents = data['Talent naturel'] || [];
      allEspritCompetences = extractEspritCompetences(data["compétences d'esprit"] || []);
    }
  } catch (err) {
    console.warn('Impossible de charger les compétences.', err);
  }

  try {
    let espritRes = await fetch('data/esprits_clean.json');
    if (!espritRes.ok) {
      espritRes = await fetch('esprits_clean.json');
    }
    if (espritRes.ok) {
      allEsprits = await espritRes.json();
    }
  } catch (err) {
    console.warn('Impossible de charger les esprits.', err);
  }

  try {
    let statusRes = await fetch('data/altérations_d_etats.json');
    if (!statusRes.ok) {
      statusRes = await fetch('altérations_d_etats.json');
    }
    if (statusRes.ok) {
      allStatusEffects = await statusRes.json();
    }
  } catch (err) {
    console.warn('Impossible de charger les altérations d\'états.', err);
  }

  try {
    let objectsRes = await fetch('data/Objets.json');
    if (!objectsRes.ok) {
      objectsRes = await fetch('Objets.json');
    }
    if (objectsRes.ok) {
      allGameObjects = await objectsRes.json();
    }
  } catch (err) {
    console.warn('Impossible de charger les objets.', err);
  }
}

function extractEspritCompetences(rawEspritList) {
  if (!Array.isArray(rawEspritList)) return [];

  const result = [];
  for (let i = 1; i < rawEspritList.length; i++) {
    const item = rawEspritList[i];
    if (!item || typeof item !== 'object') continue;

    result.push({
      nom: (item.Column1 || '').trim().toLowerCase(),
      type: (item.Column2 || '').trim().toLowerCase(),
      pu: item.Column3 || '/',
      effet: item.Column4 || '',
      contreCoup: item.Column6 || '/',
      degats: item.Column7 || '/',
      esprit: (item.Column8 || '').trim().toLowerCase(),
      genre: (item['0'] || '').trim().toLowerCase()
    });
  }
  return result;
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    // remove content in parentheses
    .replace(/\s*\([^)]*\)/g, '')
    // replace accents
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    // normalize double p, double t, etc.
    .replace(/pp/g, 'p')
    .replace(/tt/g, 't')
    .replace(/mm/g, 'm')
    .replace(/ll/g, 'l')
    .replace(/cc/g, 'c')
    // remove spaces and special characters
    .replace(/[^a-z0-9]/g, '')
    // remove trailing 's' if any (plural normalization)
    .replace(/s$/, '');
}

// ========================================================
// FLUX D'AUTHENTIFICATION TWITCH VIA SUPABASE
// ========================================================

async function redirectToTwitch() {
  if (!supabaseClient) {
    alert("Le client Supabase n'est pas configuré. Veuillez vérifier SUPABASE_URL et SUPABASE_KEY.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'twitch',
    options: {
      redirectTo: REDIRECT_URI
    }
  });

  if (error) {
    console.error("Erreur de connexion OAuth:", error.message);
    alert("Erreur lors de la redirection vers Twitch : " + error.message);
  }
}

function checkLocalStorageSession() {
  const savedUser = localStorage.getItem('nwarr_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showCharacterSheet(currentUser, true);
    } catch {
      localStorage.removeItem('nwarr_user');
    }
  }
}

// Liste de pseudos amusants pour la démo Twitch
const DEMO_PSEUDOS = [
  "zogaa_", "zaaaaaayyyyyy", "grifender_", "mayuko_h", "at_your_side", "gabriocheaulait", "levraishark"
];

function startDemoMode() {
  // Sélectionner un pseudo démo fun de la liste pour avoir des variations intéressantes
  const randomPseudo = DEMO_PSEUDOS[Math.floor(Math.random() * DEMO_PSEUDOS.length)];
  currentUser = {
    username: randomPseudo,
    avatar: 'static/twitchpp.png',
    isDemo: true
  };

  localStorage.setItem('nwarr_user', JSON.stringify(currentUser));
  showCharacterSheet(currentUser, false);
}

async function handleLogout() {
  if (supabaseClient && currentUser && !currentUser.isDemo) {
    await supabaseClient.auth.signOut();
  }

  localStorage.removeItem('nwarr_user');
  localStorage.removeItem('nwarr_token');
  currentUser = null;

  const loginSection = document.getElementById('login-section');
  const charSection = document.getElementById('character-section');
  transitionSection(charSection, loginSection, 'flex');
}

// ========================================================
// RÉCUPÉRATION SUPABASE DES CARACTÉRISTIQUES
// ========================================================

async function fetchCharacterFromSupabase(username) {
  if (!supabaseClient) {
    return null;
  }

  try {
    const cleanUsername = username.trim();

    // Récupérer l'utilisateur connecté Supabase pour lier par UUID si présent
    const authResponse = await supabaseClient.auth.getUser();
    const user = authResponse.data ? authResponse.data.user : null;

    // Récupérer tous les personnages (Supabase filtrera selon RLS si activé)
    // On essaie avec 'Personnages' (majuscule) puis avec 'personnages' (minuscule) en cas d'échec
    let response = await supabaseClient.from('Personnages').select('*');
    if (response.error) {
      response = await supabaseClient.from('personnages').select('*');
    }

    const { data, error } = response;

    if (error) {
      console.warn('Erreur Supabase lors de la récupération:', error);
      return null;
    }

    if (data && data.length > 0) {
      // Trouver la ligne correspondante au pseudo ou à l'UUID utilisateur
      const userRow = data.find(row => {
        // A. Lien par UUID (si la base a une colonne id)
        if (user && row["id"] === user.id) {
          return true;
        }
        // B. Lien par Twitch Id (le pseudo Twitch) ou par défaut Nom
        const twitchIdVal = row["Twitch Id"] || row["Nom"];
        return twitchIdVal && twitchIdVal.trim().toLowerCase() === cleanUsername.toLowerCase();
      });

      if (userRow) {
        console.log('Personnage trouvé dans Supabase:', userRow);

        // Formater les statistiques en s'alignant sur les colonnes exactes de la base
        const stats = {
          pv: parseInt(userRow["Points de vie"] || 40),
          deg: parseInt(userRow["Puissance"] || 10),
          vit: parseInt(userRow["Vitesse"] || 10),
          def: 10 // Par défaut (pas de colonne défense dans les colonnes fournies)
        };

        // Formater le pacte
        const pactName = (userRow["Pacte"] || "Aucun").trim();
        const pactLevel = parseInt(userRow["Lvl du pacte"] || 1);

        // Recherche de l'esprit pour obtenir les détails du lore
        const espritData = allEsprits.find(e => e.nom.toLowerCase().includes(pactName.toLowerCase())) || {};

        const pact = {
          nom: pactName,
          emoji: espritData.emoji || '🔮',
          intro: espritData.intro || 'Un pacte mystérieux conclu au cours de l\'aventure.',
          level: pactLevel,
          uniqueName: espritData.capacite_nom || 'Capacité Unique',
          uniqueDesc: espritData.capacite_effet || 'Capacité liée à votre pacte.'
        };

        // Générer la démo des choix
        pact.choices = [];
        if (pact.level >= 2) {
          pact.choices.push({
            level: 2,
            choice: "Compétence active débloquée."
          });
        }
        if (pact.level >= 3) {
          pact.choices.push({
            level: 3,
            choice: "Bonus de statistique choisi."
          });
        }
        if (pact.level >= 4) {
          pact.choices.push({
            level: 4,
            choice: "Talent passif débloqué."
          });
        }

        // Formater les passifs (séparés par des retours à la ligne ou puces) en cherchant l'effet réel dans allTalents ou allEspritCompetences avec normalisation
        const passifStr = userRow["Passif"] || userRow["Passif "] || "";
        const talents = passifStr.split('\n').map(p => p.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const normNom = normalizeName(nom);
          const matchedTalent = allTalents.find(t => normalizeName(t.nom) === normNom);

          let effets = 'Effet du passif naturel.';
          if (matchedTalent) {
            effets = matchedTalent.effets || matchedTalent.effet || effets;
          } else {
            const matchedEspritComp = allEspritCompetences.find(c => normalizeName(c.nom) === normNom);
            if (matchedEspritComp) {
              effets = matchedEspritComp.effet || effets;
            }
          }

          return {
            nom: nom,
            effets: effets
          };
        });

        // Formater les compétences avec normalisation
        const compStr = userRow["Compétences"] || userRow["Compétences "] || "";
        const skills = compStr.split('\n').map(s => s.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const normNom = normalizeName(nom);
          const matchedComp = allCompetences.find(c => normalizeName(c.compétence) === normNom);

          let effet = 'Effet de compétence de combat.';
          if (matchedComp) {
            effet = matchedComp.effet || matchedComp.effets || effet;
          } else {
            const matchedEspritComp = allEspritCompetences.find(c => normalizeName(c.nom) === normNom);
            if (matchedEspritComp) {
              effet = matchedEspritComp.effet || effet;
            }
          }

          return {
            compétence: nom,
            effet: effet
          };
        });

        // Formater l'inventaire en cherchant les objets dans le fichier Objets.json
        const invStr = userRow["Inventaire"] || userRow["Inventaire "] || "";
        const inventory = invStr.split('\n').map(i => i.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const details = findObjectDetails(nom);
          if (details) return details;

          // Fallback si l'objet n'est pas dans le JSON
          const lowerNom = nom.toLowerCase();
          const isEquip = lowerNom.includes('épée') || lowerNom.includes('plastron') || lowerNom.includes('bottes') || lowerNom.includes('anneau') || lowerNom.includes('dague') || lowerNom.includes('bouclier') || lowerNom.includes('katana') || lowerNom.includes('arc') || lowerNom.includes('bâton') || lowerNom.includes('hache') || lowerNom.includes('écu');
          return {
            nom: nom,
            type: isEquip ? "equipement" : "consommable",
            stat: isEquip ? "+2 Caractéristique" : "Objet consommable de l'aventure.",
            badgeText: isEquip ? "Équipement" : "Consommable"
          };
        });

        const displayName = userRow["Nom"] || username;

        return { stats, pact, talents, skills, inventory, displayName };
      }
    }
  } catch (err) {
    console.error('Erreur lors du chargement des données Supabase:', err);
  }
  return null;
}

// ========================================================
// GÉNÉRATEUR ET AFFICHAGE DU PERSONNAGE
// ========================================================

async function showCharacterSheet(user, isInitialLoad = false) {
  const loginSection = document.getElementById('login-section');
  const charSection = document.getElementById('character-section');
  if (isInitialLoad) {
    if (loginSection) loginSection.style.display = 'none';
    if (charSection) {
      charSection.style.display = 'block';
      charSection.classList.add('fade-in-section');
    }
  } else {
    if (loginSection && loginSection.style.display !== 'none') {
      transitionSection(loginSection, charSection, 'block');
    } else if (charSection) {
      charSection.style.display = 'block';
      charSection.classList.add('fade-in-section');
    }
  }

  // Tenter de récupérer le personnage depuis Supabase, sinon fallback déterministe
  let charData = await fetchCharacterFromSupabase(user.username);
  if (!charData) {
    charData = generateDeterministicCharacter(user.username);
  }

  // Injecter les données de profil de base (Nom d'usage de la base ou pseudo Twitch)
  document.getElementById('char-name').textContent = charData.displayName || user.username;
  document.getElementById('char-avatar').src = user.avatar;

  if (user.isDemo) {
    document.getElementById('char-rank').textContent = 'Mode Démo 🕹️';
  } else {
    document.getElementById('char-rank').textContent = 'Rang : Aventurier 🏆';
  }

  // Déterminer dynamiquement le maximum des barres pour garder un affichage visuel correct et proportionné
  const maxPv = Math.max(100, charData.stats.pv);
  const maxDeg = Math.max(50, charData.stats.deg);
  const maxVit = Math.max(50, charData.stats.vit);

  // Afficher les barres de stats et valeurs
  updateStatItem('pv', charData.stats.pv, maxPv, true);
  updateStatItem('deg', charData.stats.deg, maxDeg);
  updateStatItem('vit', charData.stats.vit, maxVit);

  // Afficher le pacte spirituel
  updatePactCard(charData.pact);

  // Afficher les talents naturels
  renderTalents(charData.talents);

  // Afficher les compétences
  renderSkills(charData.skills);

  // Afficher l'inventaire
  renderInventory(charData.inventory);
}

// Génère un personnage de façon déterministe à partir du pseudo
function generateDeterministicCharacter(username) {
  // Calculer une somme de hachage simple du pseudo pour avoir un index stable
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // 1. Déterminer les statistiques (base neutre + variation hash)
  const stats = {
    pv: 30 + (hash % 11), // 30 à 40 PV
    deg: 10 + (hash % 6), // 10 à 15 DEG
    vit: 10 + ((hash >> 2) % 6), // 10 à 15 VIT
    def: 10 + ((hash >> 3) % 6)  // 10 à 15 DEF
  };

  // 2. Déterminer le Pacte Spirituel
  let pact = null;
  const pactLevel = (hash % 3) + 2; // Niveau 2 à 4 pour avoir toujours au moins niveau 2 et voir la démo

  if (allEsprits.length > 0) {
    const esprit = allEsprits[hash % allEsprits.length];
    pact = {
      nom: esprit.nom,
      emoji: esprit.emoji || '🔮',
      intro: esprit.intro || '',
      level: pactLevel,
      uniqueName: esprit.capacite_nom || 'Capacité Unique',
      uniqueDesc: esprit.capacite_effet || ''
    };
  } else {
    pact = {
      nom: 'Le Gardien Sylvestre',
      emoji: '🛡️',
      intro: 'Celui qui protège et qui n\'abandonne jamais personne dans les bois profonds.',
      level: pactLevel,
      uniqueName: 'Refuge de l\'Esprit',
      uniqueDesc: 'Permet de désigner un lieu comme zone sûre une fois par combat.'
    };
  }

  // Générer la démo des choix du pacte pour les niveaux >= 2
  pact.choices = [];
  if (pact.level >= 2) {
    // Niv 2: Compétence active spirituelle
    pact.choices.push({
      level: 2,
      choice: "Compétence active : « Émanation Astrale » (Projette une vague d'énergie spirituelle infligeant des dégâts de zone)."
    });
  }
  if (pact.level >= 3) {
    // Niv 3: Choix de statistique (par exemple le joueur a décidé de prendre des stats)
    pact.choices.push({
      level: 3,
      choice: "Amélioration de statistiques : +5 Points de Vie (PV) max."
    });
  }
  if (pact.level >= 4) {
    // Niv 4: Talent passif spirituel
    pact.choices.push({
      level: 4,
      choice: "Talent passif : « Communion Élémentaire » (Augmente les résistances élémentaires de 15% tant que l'esprit est invoqué)."
    });
  }

  // 3. Déterminer les Talents Naturels (2 aléatoires)
  const talents = [];
  if (allTalents.length > 0) {
    const t1 = allTalents[(hash >> 1) % allTalents.length];
    const t2 = allTalents[(hash >> 4) % allTalents.length];
    talents.push(t1);
    if (t1.nom !== t2.nom) talents.push(t2);
  } else {
    talents.push({ nom: 'Robuste', effets: 'Vous gagnez +5 pv' });
    talents.push({ nom: 'Katchow', effets: 'Vous gagnez +5 vitesse' });
  }

  // 4. Déterminer les compétences communes (3 aléatoires)
  const skills = [];
  if (allCompetences.length > 0) {
    const s1 = allCompetences[hash % allCompetences.length];
    const s2 = allCompetences[(hash >> 2) % allCompetences.length];
    const s3 = allCompetences[(hash >> 3) % allCompetences.length];
    skills.push(s1);
    if (s2 && s2.compétence !== s1.compétence) skills.push(s2);
    if (s3 && s3.compétence !== s1.compétence && s3.compétence !== s2.compétence) {
      skills.push(s3);
    } else if (skills.length < 3 && allCompetences.length > 3) {
      // Trouver une troisième compétence unique
      for (let s of allCompetences) {
        if (!skills.includes(s)) {
          skills.push(s);
          break;
        }
      }
    }
  } else {
    skills.push({ compétence: 'Frappe puissante', type: 'attaque', effet: 'Inflige votre puissance +5' });
    skills.push({ compétence: 'Soins légers', type: 'soutien', effet: 'Soigne 5 pv + la moitié de votre puissance' });
  }

  // 5. Déterminer l'inventaire (3-4 items aléatoires parmi le fichier Objets.json si possible, sinon fallback)
  const availableItems = [];

  if (allGameObjects.consommables && allGameObjects.consommables.length > 0) {
    allGameObjects.consommables.forEach(i => {
      availableItems.push({
        nom: i.consommable,
        type: "consommable",
        stat: i.effet,
        badgeText: i.type || "Consommable"
      });
    });
  }
  if (allGameObjects.équipements && allGameObjects.équipements.length > 0) {
    allGameObjects.équipements.forEach(i => {
      availableItems.push({
        nom: i.équipement,
        type: "equipement",
        stat: i.effet,
        badgeText: i.type || "Équipement"
      });
    });
  }
  if (allGameObjects.artefacts && allGameObjects.artefacts.length > 0) {
    allGameObjects.artefacts.forEach(i => {
      availableItems.push({
        nom: i.artefact,
        type: "artefact",
        stat: i.effet,
        badgeText: i.type || "Artefact"
      });
    });
  }

  // Fallback si allGameObjects est vide
  if (availableItems.length === 0) {
    availableItems.push(
      { nom: "Épée émoussée", type: "equipement", stat: "+2 Puissance (DEG)", badgeText: "Équipement" },
      { nom: "Plastron en cuir renforcé", type: "equipement", stat: "+3 Résistance (DEF)", badgeText: "Équipement" },
      { nom: "Bottes légères de voyage", type: "equipement", stat: "+2 Vitesse (VIT)", badgeText: "Équipement" },
      { nom: "Anneau de vitalité", type: "equipement", stat: "+5 Points de Vie (PV)", badgeText: "Équipement" },
      { nom: "Potion de soin", type: "consommable", stat: "Restaure 15 Points de Vie en combat.", badgeText: "Consommable" }
    );
  }

  const inventory = [];
  const itemCount = 3 + (hash % 2); // 3 ou 4 objets
  for (let i = 0; i < itemCount; i++) {
    const itemIndex = (hash + i * 7) % availableItems.length;
    inventory.push(availableItems[itemIndex]);
  }

  return { stats, pact, talents, skills, inventory };
}

function updateStatItem(id, val, max, showAsFraction = false) {
  const valEl = document.getElementById(`stat-${id}-val`);
  const barEl = document.getElementById(`stat-${id}-bar`);

  if (valEl) {
    valEl.textContent = showAsFraction ? `${val} / ${val}` : val;
  }
  if (barEl) {
    const percent = Math.min((val / max) * 100, 100);
    // Forcer un petit timeout pour que la transition de la barre se joue à l'apparition
    setTimeout(() => {
      barEl.style.width = `${percent}%`;
    }, 150);
  }
}

function updatePactCard(pact) {
  document.getElementById('pact-level-badge').textContent = `Pacte Niv. ${pact.level}`;
  document.getElementById('pact-emoji').textContent = pact.emoji;
  document.getElementById('pact-name').textContent = pact.nom;
  document.getElementById('pact-intro').textContent = `« ${pact.intro} »`;
  document.getElementById('pact-unique-desc').innerHTML = `<strong>${pact.uniqueName} :</strong> ${makeStatusInteractive(pact.uniqueDesc)}`;

  // Afficher les choix d'évolutions choisis
  const evolutionsList = document.getElementById('pact-evolutions-list');
  evolutionsList.innerHTML = '';

  if (pact.level >= 2 && pact.choices && pact.choices.length > 0) {
    pact.choices.forEach(c => {
      const evoItem = document.createElement('div');
      evoItem.className = 'pact-evo-item';
      evoItem.innerHTML = `<strong>Niveau ${c.level} :</strong> ${c.choice}`;
      evolutionsList.appendChild(evoItem);
    });
  } else {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'pact-evo-item';
    emptyMsg.style.fontStyle = 'italic';
    emptyMsg.textContent = 'Aucune évolution disponible (Pacte inférieur au Niveau 2)';
    evolutionsList.appendChild(emptyMsg);
  }
}

function renderTalents(talents) {
  const container = document.getElementById('char-talents-container');
  container.innerHTML = '';

  talents.forEach(t => {
    if (!t) return;
    const item = document.createElement('div');
    item.className = 'deck-item';

    const name = t.nom || 'Talent';
    const effet = t.effets || t.effet || 'Aucun effet spécifié';

    // Rendre le talent sous la même structure que les compétences
    item.innerHTML = `
      <div class="deck-item__info">
        <span class="deck-item__name">${name}</span>
        <span class="deck-item__effect">${makeStatusInteractive(effet)}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

function renderSkills(skills) {
  const container = document.getElementById('equipped-skills-list');
  container.innerHTML = '';

  skills.forEach(s => {
    if (!s) return;
    const item = document.createElement('div');
    item.className = 'deck-item';

    const name = s.compétence || s.nom || 'Compétence';
    const effet = s.effet || s.effets || 'Aucun effet spécifié';

    // Rendre l'effet lisible sans le badge de type
    item.innerHTML = `
      <div class="deck-item__info">
        <span class="deck-item__name">${name}</span>
        <span class="deck-item__effect">${makeStatusInteractive(effet)}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

function renderInventory(inventory) {
  const container = document.getElementById('char-inventory-container');
  container.innerHTML = '';

  if (!inventory || inventory.length === 0) {
    container.innerHTML = '<div class="inventory-item"><span class="inventory-item__name" style="font-style: italic;">L\'inventaire est vide.</span></div>';
    return;
  }

  inventory.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'inventory-item';

    const isEquip = item.type === 'equipement';
    const isArtefact = item.type === 'artefact';
    const badgeText = item.badgeText || (isEquip ? 'Équipement' : (isArtefact ? 'Artefact' : 'Consommable'));
    const badgeClass = item.type || (isEquip ? 'equipement' : (isArtefact ? 'artefact' : 'consommable'));

    // Si c'est un équipement ou artefact, la description/stat modifiée sera colorée spécifiquement
    const statLine = (isEquip || isArtefact)
      ? `<span class="inventory-item__stat">${makeStatusInteractive(item.stat)}</span>`
      : `<span class="deck-item__effect">${makeStatusInteractive(item.stat)}</span>`;

    itemEl.innerHTML = `
      <div class="inventory-item__info">
        <span class="inventory-item__name">${item.nom}</span>
        ${statLine}
      </div>
      <span class="inventory-item__badge ${badgeClass}">${badgeText}</span>
    `;

    container.appendChild(itemEl);
  });
}

function transitionSection(fromEl, toEl, toDisplay = 'block') {
  if (!fromEl || !toEl) return;
  fromEl.classList.add('fade-out-section');
  fromEl.classList.remove('fade-in-section');

  setTimeout(() => {
    fromEl.style.display = 'none';
    fromEl.classList.remove('fade-out-section');

    toEl.style.display = toDisplay;
    toEl.classList.add('fade-in-section');
  }, 350);
}

function makeStatusInteractive(text) {
  if (!text) return '';
  let formatted = text;

  const sortedStatus = [...allStatusEffects].sort((a, b) => b.Nom.length - a.Nom.length);

  sortedStatus.forEach(status => {
    const statusName = status.Nom;
    const regex = new RegExp('(?:^|[^a-zA-Z0-9àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ])(' + statusName + 's?)(?![a-zA-Z0-9àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ])', 'gi');

    formatted = formatted.replace(regex, (match, p1) => {
      const index = match.indexOf(p1);
      const prefix = match.substring(0, index);
      const suffix = match.substring(index + p1.length);
      const normStatus = normalizeName(statusName);
      return `${prefix}<span class="interactive-status status-${normStatus}" data-status="${statusName}">${p1}</span>${suffix}`;
    });
  });

  return formatted;
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('.interactive-status');
  if (!target) return;

  e.preventDefault();
  e.stopPropagation();

  const statusName = target.getAttribute('data-status');
  if (!statusName) return;

  const statusInfo = allStatusEffects.find(s => normalizeName(s.Nom) === normalizeName(statusName));
  if (!statusInfo) return;

  const leftContainer = document.getElementById('passifs-sidebar-container');
  const rightContainer = document.getElementById('competences-sidebar-container');
  if (!leftContainer || !rightContainer) return;

  const normName = normalizeName(statusInfo.Nom);

  // Vérifier si cette altération est déjà affichée
  const existingCard = document.querySelector(`.status-sidebar-card.status-${normName}`);
  if (existingCard) {
    // Si oui, on la ferme (comportement d'Afficher/Masquer)
    existingCard.classList.add('fade-out');
    const removeCard = () => existingCard.remove();
    existingCard.addEventListener('transitionend', removeCard);
    setTimeout(removeCard, 450);
    return;
  }

  // Créer la nouvelle carte avec le design de recherche (status-sidebar-card, compacte)
  const card = document.createElement('div');
  const type = getStatusType(statusInfo.Nom);
  card.className = `status-sidebar-card status-${normName}`;
  card.setAttribute('data-type', type);
  card.setAttribute('data-norm-name', normName);

  const emoji = getStatusEmoji(statusInfo.Nom);
  const title = capitalize(statusInfo.Nom);
  const effects = statusInfo.Effets || 'Aucun effet spécifié';
  const duree = statusInfo.durée || 'Spécial';

  card.innerHTML = `
    <div class="talent-card__header">
      <div class="talent-card__title">${title}</div>
      <span class="talent-card__icon">${emoji}</span>
    </div>
    <div class="talent-card__effect" style="margin-top: 10px; line-height: 1.5;">
      ${effects}
      <span style="font-size: 0.8rem; opacity: 0.7; display: block; margin-top: 8px; font-weight: 600; color: var(--star-gold);">
        Durée : ${duree}
      </span>
    </div>
  `;

  // Permettre de fermer la carte en cliquant dessus
  card.addEventListener('click', (ev) => {
    ev.stopPropagation();
    card.classList.add('fade-out');
    const removeCard = () => card.remove();
    card.addEventListener('transitionend', removeCard);
    setTimeout(removeCard, 450);
  });

  // Déterminer le conteneur cible : si dans une sidebar, on l'y ajoute, sinon par position écran
  let targetContainer = target.closest('.sidebar-container');
  if (!targetContainer) {
    const isLeftClick = e.clientX < window.innerWidth / 2;
    targetContainer = isLeftClick ? leftContainer : rightContainer;
  }

  targetContainer.appendChild(card);
});

// Fonctions utilitaires pour le traitement des altérations
function getStatusType(nom) {
  const normalized = normalizeName(nom);
  if (normalized.includes('poison')) return 'soutien'; // green
  if (normalized.includes('brulure') || normalized.includes('terreur') || normalized.includes('hemorragie') || normalized.includes('marque')) return 'attaque'; // red
  if (normalized.includes('lenteur') || normalized.includes('confusion')) return 'magie'; // blue
  if (normalized.includes('affaiblissement') || normalized.includes('choc') || normalized.includes('bouclier')) return 'défense'; // gold
  return 'soutien';
}

function getStatusEmoji(nom) {
  const normalized = normalizeName(nom);
  if (normalized.includes('poison')) return '🤢';
  if (normalized.includes('brulure')) return '🔥';
  if (normalized.includes('lenteur')) return '⏳';
  if (normalized.includes('confusion')) return '🌀';
  if (normalized.includes('affaiblissement')) return '🩹';
  if (normalized.includes('terreur')) return '😱';
  if (normalized.includes('hemorragie')) return '🩸';
  if (normalized.includes('choc')) return '⚡';
  if (normalized.includes('marque')) return '🎯';
  if (normalized.includes('bouclier')) return '🛡️';
  return '⚠️';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function findObjectDetails(name) {
  const normSearch = normalizeName(name);
  if (!normSearch) return null;

  if (allGameObjects.consommables) {
    const item = allGameObjects.consommables.find(i => normalizeName(i.consommable) === normSearch);
    if (item) {
      return {
        nom: item.consommable,
        type: "consommable",
        stat: item.effet,
        badgeText: item.type || "Consommable"
      };
    }
  }

  if (allGameObjects.équipements) {
    const item = allGameObjects.équipements.find(i => normalizeName(i.équipement) === normSearch);
    if (item) {
      return {
        nom: item.équipement,
        type: "equipement",
        stat: item.effet,
        badgeText: item.type || "Équipement"
      };
    }
  }

  if (allGameObjects.artefacts) {
    const item = allGameObjects.artefacts.find(i => normalizeName(i.artefact) === normSearch);
    if (item) {
      return {
        nom: item.artefact,
        type: "artefact",
        stat: item.effet,
        badgeText: item.type || "Artefact"
      };
    }
  }

  return null;
}

