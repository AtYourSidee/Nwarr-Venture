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

        // Formater les passifs (séparés par des retours à la ligne ou puces) en cherchant l'effet réel dans allTalents
        const passifStr = userRow["Passif"] || userRow["Passif "] || "";
        const talents = passifStr.split('\n').map(p => p.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const matchedTalent = allTalents.find(t => t.nom.toLowerCase().trim() === nom.toLowerCase().trim());
          return {
            nom: nom,
            effets: matchedTalent ? matchedTalent.effets : 'Effet du passif naturel.'
          };
        });

        // Formater les compétences
        const compStr = userRow["Compétences"] || userRow["Compétences "] || "";
        const skills = compStr.split('\n').map(s => s.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const matchedComp = allCompetences.find(c => c.compétence.toLowerCase().trim() === nom.toLowerCase().trim());
          return {
            compétence: nom,
            effet: matchedComp ? matchedComp.effet : 'Effet de compétence de combat.'
          };
        });

        // Formater l'inventaire et déterminer dynamiquement les bonus de statistiques des équipements
        const invStr = userRow["Inventaire"] || userRow["Inventaire "] || "";
        const inventory = invStr.split('\n').map(i => i.replace(/[•\-\*]/g, '').trim()).filter(Boolean).map(nom => {
          const lowerNom = nom.toLowerCase();
          const isEquip = lowerNom.includes('épée') || lowerNom.includes('plastron') || lowerNom.includes('bottes') || lowerNom.includes('anneau') || lowerNom.includes('dague') || lowerNom.includes('bouclier') || lowerNom.includes('katana') || lowerNom.includes('arc') || lowerNom.includes('bâton') || lowerNom.includes('hache') || lowerNom.includes('écu');
          
          let statDesc = "Objet consommable de l'aventure.";
          if (isEquip) {
            if (lowerNom.includes('épée') || lowerNom.includes('katana') || lowerNom.includes('hache')) statDesc = '+3 Puissance (DEG)';
            else if (lowerNom.includes('dague')) statDesc = '+1 Puissance (DEG), +1 Vitesse (VIT)';
            else if (lowerNom.includes('bouclier') || lowerNom.includes('écu') || lowerNom.includes('plastron')) statDesc = '+2 Résistance (DEF)';
            else if (lowerNom.includes('bottes')) statDesc = '+2 Vitesse (VIT)';
            else if (lowerNom.includes('anneau') || lowerNom.includes('collier')) statDesc = '+5 Points de Vie (PV)';
            else statDesc = '+2 Caractéristique';
          }
          return {
            nom: nom,
            type: isEquip ? "equipement" : "consommable",
            stat: statDesc
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
  const maxDef = Math.max(50, charData.stats.def);

  // Afficher les barres de stats et valeurs
  updateStatItem('pv', charData.stats.pv, maxPv, true);
  updateStatItem('deg', charData.stats.deg, maxDeg);
  updateStatItem('vit', charData.stats.vit, maxVit);
  updateStatItem('def', charData.stats.def, maxDef);

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

  // 5. Déterminer l'inventaire (3-4 items aléatoires parmi une liste prédéfinie)
  const availableItems = [
    { nom: "Épée émoussée", type: "equipement", stat: "+2 Puissance (DEG)" },
    { nom: "Plastron en cuir renforcé", type: "equipement", stat: "+3 Résistance (DEF)" },
    { nom: "Bottes légères de voyage", type: "equipement", stat: "+2 Vitesse (VIT)" },
    { nom: "Anneau de vitalité", type: "equipement", stat: "+5 Points de Vie (PV)" },
    { nom: "Dague rouillée", type: "equipement", stat: "+1 Puissance (DEG), +1 Vitesse (VIT)" },
    { nom: "Bouclier en bois fendu", type: "equipement", stat: "+2 Résistance (DEF)" },
    { nom: "Potion de soin", type: "consommable", stat: "Restaure 15 Points de Vie en combat." },
    { nom: "Élixir de célérité", type: "consommable", stat: "Octroie +5 Vitesse pendant 3 tours." },
    { nom: "Herbes médicinales", type: "consommable", stat: "Soigne le poison mineur et restaure 5 PV." }
  ];

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
  document.getElementById('pact-unique-desc').innerHTML = `<strong>${pact.uniqueName} :</strong> ${pact.uniqueDesc}`;

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
        <span class="deck-item__effect">${effet}</span>
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
        <span class="deck-item__effect">${effet}</span>
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
    const badgeText = isEquip ? 'Équipement' : 'Consommable';
    const badgeClass = isEquip ? 'equipement' : 'consommable';

    // Si c'est un équipement, la description/stat modifiée sera colorée spécifiquement
    const statLine = isEquip
      ? `<span class="inventory-item__stat">${item.stat}</span>`
      : `<span class="deck-item__effect">${item.stat}</span>`;

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

