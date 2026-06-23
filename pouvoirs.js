/* ========================================
   POUVOIRS.JS - Système de Cartes d'Arcanes

   Structure JSON attendue (exemple):
   {
     "compétences commune": [
       {
         "compétence": "nom de la compétence",
         "type": "attaque|magie|soutien|défense",
         "Point d'utilisation": 2,
         "effet": "description de l'effet",
         "dégats": "physique|magique|..."
       },
       ...
     ]
   }
   ======================================== */

// Mapping d'emojis par type de compétence
const typeEmojis = {
  attaque: '⚔️',
  magie: '🔮',
  soutien: '✨',
  défense: '🛡️'
};

// Stockage des compétences
let allCompetences = [];
let allTalents = [];
let allEspritCompetences = [];
let activeSpiritId = null;

// ========================================
// INITIALISATION AU CHARGEMENT DE LA PAGE
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadCompetences();
  await loadEsprits();
  setupFilters();
  setupTalentFilters();
  setupToggleSectionButton();
  setupToggleEspritsButton();
  setupToggleTalentsButton();
  setupScrollAnimation();
  setupEspritTooltips();
  setupSearch();
});

function setupToggleSectionButton() {
  const toggleBtn = document.getElementById('toggle-grid-btn');
  const gridWrapper = document.getElementById('competences-grid-container');

  if (!toggleBtn || !gridWrapper) return;

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = gridWrapper.classList.contains('collapsed');

    // Nettoyer les écouteurs précédents
    const handleTransitionEnd = (e) => {
      if (e.propertyName === 'max-height') {
        if (!gridWrapper.classList.contains('collapsed')) {
          gridWrapper.style.maxHeight = '';
          gridWrapper.style.overflow = '';
        } else {
          gridWrapper.style.maxHeight = '';
        }
        gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
      }
    };

    gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
    gridWrapper.addEventListener('transitionend', handleTransitionEnd);

    if (isCollapsed) {
      gridWrapper.style.overflow = 'hidden';
      gridWrapper.style.maxHeight = '0px';
      gridWrapper.classList.remove('collapsed');

      // Forcer le reflow
      gridWrapper.offsetHeight;

      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      updateToggleSectionText(toggleBtn, false);
    } else {
      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      // Forcer le reflow
      gridWrapper.offsetHeight;

      gridWrapper.style.overflow = 'hidden';
      gridWrapper.classList.add('collapsed');
      gridWrapper.style.maxHeight = '0px';

      updateToggleSectionText(toggleBtn, true);
    }
  });

  updateToggleSectionText(toggleBtn, gridWrapper.classList.contains('collapsed'));
}

function updateToggleSectionText(button, isCollapsed) {
  const icon = button.querySelector('.toggle-btn__icon');
  const text = button.querySelector('.toggle-btn__text');

  if (!icon || !text) return;

  if (isCollapsed) {
    icon.textContent = '+';
    text.textContent = 'Afficher les compétences';
    button.setAttribute('aria-expanded', 'false');
  } else {
    icon.textContent = '−';
    text.textContent = 'Masquer les compétences';
    button.setAttribute('aria-expanded', 'true');
  }
}

// ========================================
// ANIMATION DE LA NAVBAR AU SCROLL
// ========================================

function setupScrollAnimation() {
  const brandButton = document.getElementById('brandButton');
  let lastScrollTop = 0;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;

    if (scrollTop > 50) {
      brandButton.style.opacity = '0';
      brandButton.style.pointerEvents = 'none';
    } else {
      brandButton.style.opacity = '1';
      brandButton.style.pointerEvents = 'auto';
    }
  });

  // Ajouter transition au brandButton
  brandButton.style.transition = 'opacity 0.5s cubic-bezier(0.2, 0.9, 0.2, 1)';
}

// ========================================
// CHARGEMENT DES DONNÉES JSON
// ========================================

async function loadCompetences() {
  const pathsToTry = [
    'data/competences.json',
    './data/competences.json',
    'competences.json'
  ];

  let response = null;
  let lastError = null;

  for (const relativePath of pathsToTry) {
    const url = resolveDataPath(relativePath);

    try {
      response = await fetch(url);
      if (response.ok) {
        break;
      }
      lastError = new Error(`Erreur HTTP ${response.status} pour ${url}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (!response || !response.ok) {
    console.error('Erreur lors du chargement des compétences:', lastError);
    showError('Impossible de charger les compétences. Vérifiez que le fichier data/competences.json existe et qu’il est accessible depuis la page.');
    return;
  }

  try {
    const data = await response.json();
    allCompetences = extractCompetences(data);
    allTalents = data['Talent naturel'] || [];
    allEspritCompetences = extractEspritCompetences(data["compétences d'esprit"]);

    if (allCompetences.length === 0) {
      showError('Aucune compétence valide trouvée dans le fichier JSON.');
      return;
    }

    renderCards(allCompetences);
    if (allTalents.length > 0) {
      renderTalents(allTalents);
    }
    hideError();
  } catch (error) {
    console.error('Erreur pendant l’analyse JSON:', error);
    showError('Impossible de lire les données du fichier JSON. Vérifiez sa validité.');
  }
}

function resolveDataPath(relativePath) {
  try {
    return new URL(relativePath, document.baseURI).href;
  } catch {
    return relativePath;
  }
}

function extractCompetences(data) {
  if (!data || typeof data !== 'object') return [];

  const candidates = data['compétences commune'] || [];
  const validCompetences = candidates.filter(isValidCompetence);

  if (validCompetences.length !== candidates.length) {
    console.warn('Certains éléments JSON ont été ignorés car ils ne correspondent pas au format attendu.', {
      total: candidates.length,
      valid: validCompetences.length
    });
  }

  return validCompetences;
}

function isValidCompetence(entry) {
  return entry && typeof entry === 'object' && typeof entry.compétence === 'string' && typeof entry.type === 'string';
}

// ========================================
// GÉNÉRATION DES CARTES HTML
// ========================================

function renderCards(competences) {
  const grid = document.getElementById('competences-grid');
  grid.innerHTML = ''; // Vider la grille

  competences.forEach((competence, index) => {
    const card = createCard(competence);
    card.classList.add('fade-in');
    grid.appendChild(card);

    // Animation de cascade (stagger)
    card.style.animationDelay = `${index * 0.04}s`;

    // Nettoyer après la fin de l'animation d'apparition
    card.addEventListener('animationend', function handleEntranceEnd(e) {
      if (e.animationName === 'cardEntrance') {
        card.classList.remove('fade-in');
        card.style.animationDelay = '';
        card.removeEventListener('animationend', handleEntranceEnd);
      }
    });
  });
}

// ========================================
// CRÉATION D'UNE CARTE INDIVIDUELLE
// ========================================

function createCard(competence) {
  const card = document.createElement('div');
  card.className = 'arcane-card';

  // Normaliser le type (minuscule, sans accents)
  const type = normalizeType(competence.type || 'attaque');
  card.setAttribute('data-type', type);
  card.setAttribute('data-filter', type);

  // Emoji approprié
  const emoji = typeEmojis[type] || '⚡';

  // Coût en points d'utilisation
  const cout = competence['Point d\'utilisation'] || competence.cout || 0;

  // Effets
  const effet = competence.effet || 'Aucun effet spécifié';
  const degats = competence.dégats || '-';

  // Statut et Contre-coup
  const statut = competence.statut || competence.statu || '';
  const contreCoup = competence['contre coup'] || '';

  let statutHTML = '';
  if (statut && statut !== '/' && statut !== '-') {
    statutHTML = `<div class="arcane-card__status"><strong>Statut:</strong> ${statut}</div>`;
  }

  let ccHTML = '';
  if (contreCoup && contreCoup !== '/' && contreCoup !== '-') {
    ccHTML = `<div class="arcane-card__cc"><strong>Contre-coup:</strong> ${contreCoup}</div>`;
  }

  // Construire le HTML de la carte
  card.innerHTML = `
    <div class="arcane-card__header">
      <div class="arcane-card__title">${capitalize(competence.compétence)}</div>
      <span class="arcane-card__type">${capitalize(type)}</span>
    </div>

    <div class="arcane-card__icon">${emoji}</div>

    <div class="arcane-card__content">
      <div class="arcane-card__footer">
        <div class="arcane-card__description">${effet}</div>
        ${statutHTML}
        ${ccHTML}
        <div class="arcane-card__meta">
          <span>Dégâts: ${capitalize(degats)}</span>
          <span>Coût: ${cout} PU</span>
        </div>
      </div>
    </div>
  `;

  return card;
}



// ========================================
// SYSTÈME DE FILTRAGE
// ========================================

function setupFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Mise à jour de l'état actif
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Filtrage
      const filter = btn.getAttribute('data-filter');
      filterCards(filter);
    });
  });
}

function filterCards(filter) {
  const grid = document.getElementById('competences-grid');
  const cards = Array.from(grid.querySelectorAll('.arcane-card'));

  // 1. Début de l'animation: faire disparaître TOUTES les cartes actives
  cards.forEach(card => {
    card.classList.remove('fade-in');
    card.style.animationDelay = '';
    card.classList.add('fade-out');
  });

  // 2. Attendre la fin de l'animation fade-out (~300ms)
  setTimeout(() => {
    let visibleCount = 0;
    const cardsToShow = [];
    const cardsToHide = [];

    // Classifier les cartes
    cards.forEach(card => {
      const cardType = card.getAttribute('data-type');
      const shouldShow = filter === 'all' || cardType === filter;

      if (shouldShow) {
        visibleCount++;
        cardsToShow.push(card);
      } else {
        cardsToHide.push(card);
      }
    });

    // Masquer les cartes qui ne doivent pas apparaître
    cardsToHide.forEach(card => {
      card.classList.add('hidden');
      card.classList.remove('fade-out');
    });

    // Afficher les cartes sélectionnées avec le fade-in
    cardsToShow.forEach((card, index) => {
      card.classList.remove('hidden', 'fade-out');
      card.classList.add('fade-in');
      card.style.animationDelay = `${index * 0.04}s`;

      // Nettoyer après la fin de l'animation d'apparition
      card.addEventListener('animationend', function handleEntranceEnd(e) {
        if (e.animationName === 'cardEntrance') {
          card.classList.remove('fade-in');
          card.style.animationDelay = '';
          card.removeEventListener('animationend', handleEntranceEnd);
        }
      });
    });

    // Message d'erreur si aucune carte à afficher
    if (visibleCount === 0) {
      showError('Aucune compétence de ce type trouvée.');
    } else {
      hideError();
    }
  }, 300);
}

// ========================================
// UTILITAIRES
// ========================================

function normalizeType(type) {
  if (!type) return 'attaque';

  const normalized = type.toLowerCase().trim();

  // Mapping des variantes de type
  const typeMap = {
    'attaque': 'attaque',
    'magie': 'magie',
    'magic': 'magie',
    'soutien': 'soutien',
    'support': 'soutien',
    'défense': 'défense',
    'defense': 'défense'
  };

  return typeMap[normalized] || 'attaque';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.innerHTML = `<p>${message}</p>`;
  errorDiv.style.display = 'block';
}

function hideError() {
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

// ========================================
// SYSTÈME DES ESPRITS
// ========================================

async function loadEsprits() {
  const pathsToTry = [
    'data/esprits_clean.json',
    './data/esprits_clean.json',
    'esprits_clean.json'
  ];

  let response = null;
  let lastError = null;

  for (const relativePath of pathsToTry) {
    const url = resolveDataPath(relativePath);
    try {
      response = await fetch(url);
      if (response.ok) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!response || !response.ok) {
    console.error('Erreur lors du chargement des esprits:', lastError);
    return;
  }

  try {
    const data = await response.json();
    renderEsprits(data);
  } catch (error) {
    console.error('Erreur pendant l’analyse JSON des esprits:', error);
  }
}

function renderEsprits(esprits) {
  const grid = document.getElementById('esprits-grid');
  if (!grid) return;
  grid.innerHTML = '';

  esprits.forEach((esprit, index) => {
    const card = createEspritCard(esprit);
    card.classList.add('fade-in');
    grid.appendChild(card);

    // Animation de cascade (stagger)
    card.style.animationDelay = `${index * 0.04}s`;

    // Nettoyer après la fin de l'animation d'apparition
    card.addEventListener('animationend', function handleEntranceEnd(e) {
      if (e.animationName === 'cardEntrance') {
        card.classList.remove('fade-in');
        card.style.animationDelay = '';
        card.removeEventListener('animationend', handleEntranceEnd);
      }
    });
  });
}

function createEspritCard(esprit) {
  const card = document.createElement('div');
  card.className = 'esprit-card';
  card.setAttribute('data-id', esprit.id);

  // Générer le HTML pour les évolutions
  let evolutionsHTML = '';
  esprit.evolutions.forEach(evo => {
    evolutionsHTML += `
      <div class="evolution-level">
        <div class="evolution-level__title">Niveau ${evo.niveau}</div>
        <div class="evolution-level__details">
          <div><span>Stats:</span> ${evo.stats}</div>
          <div><span>Compétence:</span> ${makeInteractiveName(evo.competence)}</div>
          <div><span>Passif:</span> ${makeInteractiveName(evo.passive)}</div>
        </div>
      </div>
    `;
  });

  card.innerHTML = `
    <div class="esprit-card__header">
      <div class="esprit-card__title">${esprit.nom}</div>
      <span class="esprit-card__icon-badge">${esprit.emoji}</span>
    </div>
    <div class="esprit-card__intro">"${esprit.intro}"</div>
    
    <div class="esprit-card__section">
      <div class="esprit-card__section-title">Capacité Unique : ${esprit.capacite_nom}</div>
      <div class="esprit-card__section-text">${esprit.capacite_effet}</div>
    </div>

    <div class="esprit-card__section">
      <div class="esprit-card__section-title">Pacte Initial</div>
      <div class="esprit-meta-item"><span>Stats:</span> ${esprit.stats_depart}</div>
      <div class="esprit-meta-item"><span>Compétence:</span> ${makeInteractiveName(esprit.competence_depart)}</div>
      <div class="esprit-meta-item"><span>Passif:</span> ${makeInteractiveName(esprit.passive_depart)}</div>
    </div>

    <button class="esprit-card__evolutions-btn" aria-expanded="false">
      <span>Voir les Évolutions (Niv. 2 - 4)</span>
      <span class="evolution-btn-icon">▼</span>
    </button>
    <div class="esprit-card__evolutions">
      ${evolutionsHTML}
    </div>
  `;

  // Événement pour le tiroir des évolutions
  const toggleBtn = card.querySelector('.esprit-card__evolutions-btn');
  const evolutionsContainer = card.querySelector('.esprit-card__evolutions');
  if (toggleBtn && evolutionsContainer) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = evolutionsContainer.classList.contains('open');
      if (isOpen) {
        evolutionsContainer.classList.remove('open');
        toggleBtn.classList.remove('active');
        toggleBtn.setAttribute('aria-expanded', 'false');
        card.classList.remove('expanded');
        clearSpiritDetails();
      } else {
        // Fermer les autres esprits s'il y en a d'ouverts pour éviter le mélange des compétences
        const otherOpenEsprits = document.querySelectorAll('.esprit-card__evolutions.open');
        otherOpenEsprits.forEach(container => {
          container.classList.remove('open');
          const otherCard = container.closest('.esprit-card');
          if (otherCard) {
            otherCard.classList.remove('expanded');
            const otherBtn = otherCard.querySelector('.esprit-card__evolutions-btn');
            if (otherBtn) {
              otherBtn.classList.remove('active');
              otherBtn.setAttribute('aria-expanded', 'false');
            }
          }
        });

        evolutionsContainer.classList.add('open');
        toggleBtn.classList.add('active');
        toggleBtn.setAttribute('aria-expanded', 'true');
        card.classList.add('expanded');
        showAllSpiritDetails(esprit);
      }
    });
  }

  return card;
}

function setupToggleEspritsButton() {
  const toggleBtn = document.getElementById('toggle-esprits-btn');
  const gridWrapper = document.getElementById('esprits-grid-container');

  if (!toggleBtn || !gridWrapper) return;

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = gridWrapper.classList.contains('collapsed');

    const handleTransitionEnd = (e) => {
      if (e.propertyName === 'max-height') {
        if (!gridWrapper.classList.contains('collapsed')) {
          gridWrapper.style.maxHeight = '';
          gridWrapper.style.overflow = '';
        } else {
          gridWrapper.style.maxHeight = '';
        }
        gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
      }
    };

    gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
    gridWrapper.addEventListener('transitionend', handleTransitionEnd);

    if (isCollapsed) {
      gridWrapper.style.overflow = 'hidden';
      gridWrapper.style.maxHeight = '0px';
      gridWrapper.classList.remove('collapsed');

      gridWrapper.offsetHeight; // force reflow

      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      updateToggleEspritsText(toggleBtn, false);
    } else {
      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      gridWrapper.offsetHeight; // force reflow

      gridWrapper.style.overflow = 'hidden';
      gridWrapper.classList.add('collapsed');
      gridWrapper.style.maxHeight = '0px';

      updateToggleEspritsText(toggleBtn, true);
    }
  });

  updateToggleEspritsText(toggleBtn, gridWrapper.classList.contains('collapsed'));
}

function updateToggleEspritsText(button, isCollapsed) {
  const icon = button.querySelector('.toggle-btn__icon');
  const text = button.querySelector('.toggle-btn__text');

  if (!icon || !text) return;

  if (isCollapsed) {
    icon.textContent = '+';
    text.textContent = 'Afficher les esprits';
    button.setAttribute('aria-expanded', 'false');
  } else {
    icon.textContent = '−';
    text.textContent = 'Masquer les esprits';
    button.setAttribute('aria-expanded', 'true');
  }
}

// ========================================
// SYSTÈME DES TALENTS NATURELS
// ========================================

function renderTalents(talents) {
  const grid = document.getElementById('talents-grid');
  if (!grid) return;
  grid.innerHTML = '';

  talents.forEach((talent, index) => {
    const card = createTalentCard(talent);
    card.classList.add('fade-in');
    grid.appendChild(card);

    // Animation de cascade
    card.style.animationDelay = `${index * 0.03}s`;

    card.addEventListener('animationend', function handleEntranceEnd(e) {
      if (e.animationName === 'cardEntrance') {
        card.classList.remove('fade-in');
        card.style.animationDelay = '';
        card.removeEventListener('animationend', handleEntranceEnd);
      }
    });
  });
}

function createTalentCard(talent) {
  const card = document.createElement('div');
  card.className = 'talent-card';

  // Normaliser et attribuer le type de talent pour le filtrage et le style
  const type = getTalentType(talent);
  card.setAttribute('data-type', type);
  card.setAttribute('data-filter', type);

  // Déterminer l'emoji en fonction du nom du talent
  const emoji = getTalentEmoji(talent.nom);

  card.innerHTML = `
    <div class="talent-card__header">
      <div class="talent-card__title">${capitalize(talent.nom.trim())}</div>
      <span class="talent-card__icon">${emoji}</span>
    </div>
    <div class="talent-card__effect">${talent.effets}</div>
  `;

  return card;
}

function getTalentEmoji(nom) {
  const lowerNom = nom.toLowerCase().trim();

  if (lowerNom.includes('eau')) return '💧';
  if (lowerNom.includes('vent')) return '🌪️';
  if (lowerNom.includes('foudre') || lowerNom.includes('éclair')) return '⚡';
  if (lowerNom.includes('feu')) return '🔥';
  if (lowerNom.includes('terre')) return '⛰️';
  if (lowerNom.includes('glace')) return '❄️';
  if (lowerNom.includes('lumière')) return '☀️';
  if (lowerNom.includes('ténèbre')) return '🌙';
  if (lowerNom.includes('goliath')) return '💪';
  if (lowerNom.includes('berserker')) return '🩸';
  if (lowerNom.includes('exécuteur')) return '⚔️';
  if (lowerNom.includes('opportuniste')) return '🎯';
  if (lowerNom.includes('robuste') || lowerNom.includes('écaille')) return '🛡️';
  if (lowerNom.includes('survivant')) return '💖';
  if (lowerNom.includes('katchow')) return '🏃';
  if (lowerNom.includes('leader')) return '👑';
  if (lowerNom.includes('courageux')) return '🦁';
  if (lowerNom.includes('corps sain')) return '🧪';
  if (lowerNom.includes('esprit sain')) return '🧠';
  if (lowerNom.includes('détermination')) return '✊';
  if (lowerNom.includes('porte bonheur')) return '🍀';

  return '✨';
}

function setupToggleTalentsButton() {
  const toggleBtn = document.getElementById('toggle-talents-btn');
  const gridWrapper = document.getElementById('talents-grid-container');

  if (!toggleBtn || !gridWrapper) return;

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = gridWrapper.classList.contains('collapsed');

    const handleTransitionEnd = (e) => {
      if (e.propertyName === 'max-height') {
        if (!gridWrapper.classList.contains('collapsed')) {
          gridWrapper.style.maxHeight = '';
          gridWrapper.style.overflow = '';
        } else {
          gridWrapper.style.maxHeight = '';
        }
        gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
      }
    };

    gridWrapper.removeEventListener('transitionend', handleTransitionEnd);
    gridWrapper.addEventListener('transitionend', handleTransitionEnd);

    if (isCollapsed) {
      gridWrapper.style.overflow = 'hidden';
      gridWrapper.style.maxHeight = '0px';
      gridWrapper.classList.remove('collapsed');

      gridWrapper.offsetHeight; // force reflow

      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      updateToggleTalentsText(toggleBtn, false);
    } else {
      const scrollHeight = gridWrapper.scrollHeight;
      gridWrapper.style.maxHeight = scrollHeight + 'px';

      gridWrapper.offsetHeight; // force reflow

      gridWrapper.style.overflow = 'hidden';
      gridWrapper.classList.add('collapsed');
      gridWrapper.style.maxHeight = '0px';

      updateToggleTalentsText(toggleBtn, true);
    }
  });

  updateToggleTalentsText(toggleBtn, gridWrapper.classList.contains('collapsed'));
}

function updateToggleTalentsText(button, isCollapsed) {
  const icon = button.querySelector('.toggle-btn__icon');
  const text = button.querySelector('.toggle-btn__text');

  if (!icon || !text) return;

  if (isCollapsed) {
    icon.textContent = '+';
    text.textContent = 'Afficher les talents';
    button.setAttribute('aria-expanded', 'false');
  } else {
    icon.textContent = '−';
    text.textContent = 'Masquer les talents';
    button.setAttribute('aria-expanded', 'true');
  }
}

function getTalentType(talent) {
  const nom = talent.nom.toLowerCase().trim();
  const effets = (talent.effets || '').toLowerCase().trim();

  // 1. Affinités -> magie
  if (nom.startsWith('affinité')) {
    return 'magie';
  }
  // 2. Enfants -> défense
  if (nom.startsWith('enfant de') || nom.startsWith('enfant du') || nom.startsWith('enfant des')) {
    return 'défense';
  }
  // 3. Immunité, robustesse, boucliers, réduction -> défense
  if (nom.includes('robuste') || nom.includes('écaille') || nom.includes('survivant') ||
    nom.includes('courageux') || nom.includes('corps sain') || nom.includes('esprit sain') ||
    effets.includes('résistance') || effets.includes('immunisé') || effets.includes('bouclier') ||
    effets.includes('défense') || effets.includes('moins de dégâts') || effets.includes('réduits')) {
    return 'défense';
  }
  // 4. Augmentation de vitesse, buff d'alliés, reroll, leader -> soutien
  if (nom.includes('katchow') || nom.includes('éclair') || nom.includes('leader') ||
    nom.includes('détermination') || nom.includes('porte bonheur') ||
    effets.includes('vitesse') || effets.includes('alliée') || effets.includes('dés') || effets.includes('récompense')) {
    return 'soutien';
  }
  // 5. Par défaut -> attaque (Goliath, Berserker, exécuteur, opportuniste, etc.)
  return 'attaque';
}

function setupTalentFilters() {
  const filterBtns = document.querySelectorAll('.talent-filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Mise à jour de l'état actif
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Filtrage
      const filter = btn.getAttribute('data-filter');
      filterTalents(filter);
    });
  });
}

function filterTalents(filter) {
  const grid = document.getElementById('talents-grid');
  const cards = Array.from(grid.querySelectorAll('.talent-card'));

  // 1. Début de l'animation: faire disparaître TOUTES les cartes actives
  cards.forEach(card => {
    card.classList.remove('fade-in');
    card.style.animationDelay = '';
    card.classList.add('fade-out');
  });

  // 2. Attendre la fin de l'animation fade-out (~300ms)
  setTimeout(() => {
    let visibleCount = 0;
    const cardsToShow = [];
    const cardsToHide = [];

    // Classifier les cartes
    cards.forEach(card => {
      const cardType = card.getAttribute('data-type');
      const shouldShow = filter === 'all' || cardType === filter;

      if (shouldShow) {
        visibleCount++;
        cardsToShow.push(card);
      } else {
        cardsToHide.push(card);
      }
    });

    // Masquer les cartes qui ne doivent pas apparaître
    cardsToHide.forEach(card => {
      card.classList.add('hidden');
      card.classList.remove('fade-out');
    });

    // Afficher les cartes sélectionnées avec le fade-in
    cardsToShow.forEach((card, index) => {
      card.classList.remove('hidden', 'fade-out');
      card.classList.add('fade-in');
      card.style.animationDelay = `${index * 0.03}s`;

      card.addEventListener('animationend', function handleEntranceEnd(e) {
        if (e.animationName === 'cardEntrance') {
          card.classList.remove('fade-in');
          card.style.animationDelay = '';
          card.removeEventListener('animationend', handleEntranceEnd);
        }
      });
    });
  }, 300);
}

// ========================================
// SYSTÈME DE TOOLTIP POUR LES ESPRITS
// ========================================

function makeInteractiveName(name) {
  if (!name || name.toLowerCase() === 'aucune') {
    return 'Aucune';
  }
  const details = findSkillDetails(name);
  const typeClass = details && details.type ? details.type.toLowerCase() : '';
  return `<span class="interactive-competence ${typeClass}" data-name="${name}">${name}</span>`;
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

function findSkillDetails(name) {
  const normSearch = normalizeName(name);
  if (!normSearch) return null;

  if (normSearch === 'estimation') {
    return {
      nom: "Estimation",
      type: "soutien",
      pu: "/",
      effet: "Permet d'évaluer la puissance d'un adversaire ou d'obtenir des informations sur lui.",
      contreCoup: "/",
      degats: "/",
      genre: "passif"
    };
  }
  if (normSearch.startsWith('magieelementaire') || normSearch.startsWith('unemagieelementaire')) {
    return {
      nom: "Magie Élémentaire",
      type: "magie",
      pu: "/",
      effet: "Choisissez l'une des affinités ou sorts élémentaires de magie disponibles dans la section des compétences.",
      contreCoup: "/",
      degats: "/",
      genre: "actif"
    };
  }

  // Try common skills first (competences simples)
  const common = allCompetences.find(c => normalizeName(c.compétence) === normSearch);
  if (common) {
    return {
      nom: common.compétence,
      type: common.type,
      pu: common["Point d'utilisation"] || common.cout || 0,
      effet: common.effet,
      contreCoup: common["contre coup"] || '/',
      degats: common.dégats || '/',
      genre: 'actif'
    };
  }

  // Try spirit skills next (compétences d'esprit)
  const esprit = allEspritCompetences.find(c => normalizeName(c.nom) === normSearch);
  if (esprit) {
    return {
      nom: esprit.nom,
      type: esprit.type,
      pu: esprit.pu,
      effet: esprit.effet,
      contreCoup: esprit.contreCoup,
      degats: esprit.degats,
      genre: esprit.genre
    };
  }

  return null;
}

function setupEspritTooltips() {
  const espritsGrid = document.getElementById('esprits-grid');
  if (!espritsGrid) return;

  const leftContainer = document.getElementById('passifs-sidebar-container');
  const rightContainer = document.getElementById('competences-sidebar-container');

  if (!leftContainer || !rightContainer) return;

  // Event delegation for clicks
  espritsGrid.addEventListener('click', (e) => {
    const target = e.target.closest('.interactive-competence');
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    const name = target.getAttribute('data-name');
    if (!name) return;

    const details = findSkillDetails(name);
    if (!details) return;

    // Find the parent spirit card to group by spirit
    const parentCard = target.closest('.esprit-card');
    const spiritId = parentCard ? parentCard.getAttribute('data-id') : 'unknown';

    // If we clicked on a different spirit, clear all currently shown details
    if (spiritId !== activeSpiritId) {
      leftContainer.innerHTML = '';
      rightContainer.innerHTML = '';
      activeSpiritId = spiritId;
    }

    // Determine target column (passifs to left, actives to right)
    const isPassive = details.genre === 'passif';
    const targetContainer = isPassive ? leftContainer : rightContainer;
    const normName = normalizeName(details.nom);

    // Check if it is already displayed
    const existingCard = targetContainer.querySelector(`[data-norm-name="${normName}"]`);
    if (existingCard) {
      // Toggle off: animate and remove
      existingCard.classList.add('fade-out');
      let removed = false;
      const removeCard = () => {
        if (removed) return;
        removed = true;
        existingCard.remove();
        checkActiveSpiritReset();
      };
      existingCard.addEventListener('transitionend', removeCard);
      setTimeout(removeCard, 450); // Fallback if transitionend is blocked
    } else {
      // Toggle on: create and append
      const card = document.createElement('div');
      card.className = 'sidebar-card';
      card.setAttribute('data-type', details.type || '');
      card.setAttribute('data-norm-name', normName);
      card.innerHTML = generateSidebarCardHTML(details);

      // Close button listener
      const closeBtn = card.querySelector('.sidebar-card__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          card.classList.add('fade-out');
          let removed = false;
          const removeCard = () => {
            if (removed) return;
            removed = true;
            card.remove();
            checkActiveSpiritReset();
          };
          card.addEventListener('transitionend', removeCard);
          setTimeout(removeCard, 450); // Fallback if transitionend is blocked
        });
      }

      targetContainer.appendChild(card);
    }
  });

  function checkActiveSpiritReset() {
    if (leftContainer.children.length === 0 && rightContainer.children.length === 0) {
      activeSpiritId = null;
    }
  }
}

function showAllSpiritDetails(esprit) {
  const leftContainer = document.getElementById('passifs-sidebar-container');
  const rightContainer = document.getElementById('competences-sidebar-container');
  if (!leftContainer || !rightContainer) return;

  // Nettoyer les containers d'abord
  leftContainer.innerHTML = '';
  rightContainer.innerHTML = '';
  activeSpiritId = esprit.id;

  // Rassembler toutes les compétences et passifs
  const skills = [];

  // Compétence et passif de départ
  if (esprit.competence_depart) skills.push({ name: esprit.competence_depart, isPassive: false });
  if (esprit.passive_depart) skills.push({ name: esprit.passive_depart, isPassive: true });

  // Évolutions
  if (Array.isArray(esprit.evolutions)) {
    esprit.evolutions.forEach(evo => {
      if (evo.competence) skills.push({ name: evo.competence, isPassive: false });
      if (evo.passive) skills.push({ name: evo.passive, isPassive: true });
    });
  }

  // Générer les fiches de détails
  skills.forEach(skill => {
    if (!skill.name || skill.name.toLowerCase() === 'aucune') return;

    const details = findSkillDetails(skill.name);
    if (!details) return;

    const targetContainer = details.genre === 'passif' ? leftContainer : rightContainer;
    const normName = normalizeName(details.nom);

    // Éviter les doublons
    if (!targetContainer.querySelector(`[data-norm-name="${normName}"]`)) {
      const card = document.createElement('div');
      card.className = 'sidebar-card';
      card.setAttribute('data-type', details.type || '');
      card.setAttribute('data-norm-name', normName);
      card.innerHTML = generateSidebarCardHTML(details);

      // Gestionnaire de fermeture de la carte individuelle
      const closeBtn = card.querySelector('.sidebar-card__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          card.classList.add('fade-out');
          let removed = false;
          const removeCard = () => {
            if (removed) return;
            removed = true;
            card.remove();
            if (leftContainer.children.length === 0 && rightContainer.children.length === 0) {
              activeSpiritId = null;
            }
          };
          card.addEventListener('transitionend', removeCard);
          setTimeout(removeCard, 450);
        });
      }

      targetContainer.appendChild(card);
    }
  });
}

function clearSpiritDetails() {
  const leftContainer = document.getElementById('passifs-sidebar-container');
  const rightContainer = document.getElementById('competences-sidebar-container');
  if (!leftContainer || !rightContainer) return;

  const cards = Array.from(leftContainer.children).concat(Array.from(rightContainer.children));
  if (cards.length === 0) {
    activeSpiritId = null;
    return;
  }

  cards.forEach(card => {
    card.classList.add('fade-out');
    const removeCard = () => {
      card.remove();
    };
    card.addEventListener('transitionend', removeCard);
    setTimeout(removeCard, 450);
  });

  activeSpiritId = null;
}

function generateSidebarCardHTML(details) {
  const puText = details.genre === 'actif' ? `<span class="sidebar-card__pu">${details.pu || 0} PU</span>` : '<span class="sidebar-card__passive">Passif</span>';
  const typeEmoji = typeEmojis[details.type] || '✨';

  let ccHTML = '';
  if (details.contreCoup && details.contreCoup !== '/' && details.contreCoup !== '-') {
    ccHTML = `<div class="sidebar-card__cc"><strong>Contre-coup :</strong> ${details.contreCoup}</div>`;
  }

  let degatsHTML = '';
  if (details.degats && details.degats !== '/' && details.degats !== '-') {
    degatsHTML = `<div class="sidebar-card__meta-item"><strong>Type de dégâts :</strong> ${capitalize(details.degats)}</div>`;
  }

  return `
    <button class="sidebar-card__close" aria-label="Fermer">&times;</button>
    <div class="sidebar-card__header">
      <span class="sidebar-card__title">${capitalize(details.nom)}</span>
      ${puText}
    </div>
    <div class="sidebar-card__type-row">
      <span class="sidebar-card__type-badge ${details.type}">${typeEmoji} ${capitalize(details.type)}</span>
    </div>
    <div class="sidebar-card__effect">${details.effet}</div>
    <div class="sidebar-card__meta">
      ${degatsHTML}
    </div>
    ${ccHTML}
  `;
}

// ========================================
// RECHERCHE UNIFIÉE (TALENTS, COMPÉTENCES & ESPRITS)
// ========================================

function setupSearch() {
  const searchInput = document.getElementById('powers-search-input');
  const clearBtn = document.getElementById('clear-search-btn');
  const resultsSection = document.getElementById('search-results-section');
  const resultsGrid = document.getElementById('search-results-grid');

  if (!searchInput || !resultsSection || !resultsGrid) return;

  resultsSection.style.display = 'none';

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
      if (clearBtn) clearBtn.style.display = 'block';
      performSearch(query);
    } else {
      if (clearBtn) clearBtn.style.display = 'none';
      resetSearch();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      resetSearch();
      searchInput.focus();
    });
  }
}

function cleanStringForSearch(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function performSearch(query) {
  const cleanQuery = cleanStringForSearch(query);
  const results = [];

  // 1. Recherche dans les talents naturels
  allTalents.forEach(talent => {
    const cleanNom = cleanStringForSearch(talent.nom);
    const cleanEffet = cleanStringForSearch(talent.effets);
    if (cleanNom.includes(cleanQuery) || cleanEffet.includes(cleanQuery)) {
      results.push({
        type: 'talent',
        data: talent,
        score: cleanNom.startsWith(cleanQuery) ? 2 : 1
      });
    }
  });

  // 2. Recherche dans les compétences communes
  allCompetences.forEach(comp => {
    const cleanNom = cleanStringForSearch(comp.compétence);
    const cleanEffet = cleanStringForSearch(comp.effet);
    const cleanType = cleanStringForSearch(comp.type);
    if (cleanNom.includes(cleanQuery) || cleanEffet.includes(cleanQuery) || cleanType.includes(cleanQuery)) {
      results.push({
        type: 'competence',
        data: comp,
        score: cleanNom.startsWith(cleanQuery) ? 2 : 1
      });
    }
  });

  // 3. Recherche dans les compétences d'esprits
  allEspritCompetences.forEach(comp => {
    const cleanNom = cleanStringForSearch(comp.nom);
    const cleanEffet = cleanStringForSearch(comp.effet);
    const cleanType = cleanStringForSearch(comp.type);
    const cleanEsprit = cleanStringForSearch(comp.esprit);
    if (cleanNom.includes(cleanQuery) || cleanEffet.includes(cleanQuery) || cleanType.includes(cleanQuery) || cleanEsprit.includes(cleanQuery)) {
      results.push({
        type: 'esprit',
        data: comp,
        score: cleanNom.startsWith(cleanQuery) ? 2 : 1
      });
    }
  });

  // Trier par pertinence (les correspondances en début de nom d'abord)
  results.sort((a, b) => b.score - a.score);

  displaySearchResults(results, query);
}

function displaySearchResults(results, query) {
  const resultsSection = document.getElementById('search-results-section');
  const resultsGrid = document.getElementById('search-results-grid');
  const resultsCount = document.getElementById('search-results-count');

  if (!resultsSection || !resultsGrid) return;

  resultsGrid.innerHTML = '';
  if (resultsCount) resultsCount.textContent = results.length;
  resultsSection.style.display = 'block';

  // Masquer les sections par défaut pour se concentrer sur la recherche
  toggleDefaultSections(false);

  if (results.length === 0) {
    resultsGrid.innerHTML = '<div class="error-message" style="grid-column: 1/-1; margin: 20px 0;"><p>Aucun pouvoir ne correspond à votre recherche.</p></div>';
    return;
  }

  results.forEach((result, index) => {
    let card;
    if (result.type === 'talent') {
      card = createTalentSearchResultCard(result.data, query);
    } else if (result.type === 'competence') {
      card = createCompetenceSearchResultCard(result.data, query);
    } else {
      card = createEspritSearchResultCard(result.data, query);
    }
    
    card.classList.add('fade-in');
    resultsGrid.appendChild(card);
    card.style.animationDelay = `${index * 0.03}s`;

    card.addEventListener('animationend', function handleEntranceEnd(e) {
      if (e.animationName === 'cardEntrance') {
        card.classList.remove('fade-in');
        card.style.animationDelay = '';
        card.removeEventListener('animationend', handleEntranceEnd);
      }
    });
  });
}

function resetSearch() {
  const resultsSection = document.getElementById('search-results-section');
  const resultsGrid = document.getElementById('search-results-grid');
  
  if (resultsSection) resultsSection.style.display = 'none';
  if (resultsGrid) resultsGrid.innerHTML = '';
  
  toggleDefaultSections(true);
}

function toggleDefaultSections(show) {
  const elements = [
    document.querySelector('.talents-header'),
    document.getElementById('talents-grid-container'),
    document.querySelector('.competences-header'),
    document.getElementById('competences-grid-container'),
    document.querySelector('.esprits-header'),
    document.getElementById('esprits-grid-container')
  ];

  elements.forEach(el => {
    if (el) {
      el.style.display = show ? '' : 'none';
    }
  });
}

function highlightText(text, query) {
  if (!text || !query) return text;
  
  const cleanText = cleanStringForSearch(text);
  const cleanQuery = cleanStringForSearch(query);
  
  if (!cleanText.includes(cleanQuery)) return text;
  
  let result = '';
  let lastIndex = 0;
  let index = cleanText.indexOf(cleanQuery);
  
  while (index !== -1) {
    result += text.substring(lastIndex, index);
    const match = text.substring(index, index + query.length);
    result += `<mark class="search-highlight">${match}</mark>`;
    
    lastIndex = index + query.length;
    index = cleanText.indexOf(cleanQuery, lastIndex);
  }
  result += text.substring(lastIndex);
  return result;
}

function createTalentSearchResultCard(talent, query) {
  const card = document.createElement('div');
  const type = getTalentType(talent);
  card.className = 'talent-card';
  card.setAttribute('data-type', type);
  const emoji = getTalentEmoji(talent.nom);

  const highlightedName = highlightText(capitalize(talent.nom.trim()), query);
  const highlightedEffect = highlightText(talent.effets, query);

  card.innerHTML = `
    <span class="search-result-badge talent">Talent Naturel</span>
    <div class="talent-card__header" style="padding-right: 120px;">
      <div class="talent-card__title">${highlightedName}</div>
      <span class="talent-card__icon">${emoji}</span>
    </div>
    <div class="talent-card__effect" style="margin-top: 10px;">${highlightedEffect}</div>
  `;
  return card;
}

function createCompetenceSearchResultCard(comp, query) {
  const card = document.createElement('div');
  const type = normalizeType(comp.type || 'attaque');
  card.className = 'arcane-card';
  card.setAttribute('data-type', type);

  const emoji = typeEmojis[type] || '⚡';
  const cout = comp["Point d'utilisation"] || comp.cout || 0;
  const highlightedName = highlightText(capitalize(comp.compétence), query);
  const highlightedEffect = highlightText(comp.effet || 'Aucun effet spécifié', query);
  const degats = comp.dégats || '-';
  const statut = comp.statut || comp.statu || '';
  const contreCoup = comp['contre coup'] || '';

  let statutHTML = '';
  if (statut && statut !== '/' && statut !== '-') {
    statutHTML = `<div class="arcane-card__status"><strong>Statut:</strong> ${highlightText(statut, query)}</div>`;
  }

  let ccHTML = '';
  if (contreCoup && contreCoup !== '/' && contreCoup !== '-') {
    ccHTML = `<div class="arcane-card__cc"><strong>Contre-coup:</strong> ${highlightText(contreCoup, query)}</div>`;
  }

  card.innerHTML = `
    <span class="search-result-badge competence">Compétence</span>
    <div class="arcane-card__header" style="padding-right: 120px;">
      <div class="arcane-card__title">${highlightedName}</div>
      <span class="arcane-card__type">${capitalize(type)}</span>
    </div>
    <div class="arcane-card__icon">${emoji}</div>
    <div class="arcane-card__content">
      <div class="arcane-card__footer">
        <div class="arcane-card__description">${highlightedEffect}</div>
        ${statutHTML}
        ${ccHTML}
        <div class="arcane-card__meta">
          <span>Dégâts: ${capitalize(degats)}</span>
          <span>Coût: ${cout} PU</span>
        </div>
      </div>
    </div>
  `;
  return card;
}

function createEspritSearchResultCard(comp, query) {
  const card = document.createElement('div');
  const type = normalizeType(comp.type || 'attaque');
  card.className = 'arcane-card';
  card.setAttribute('data-type', type);

  const emoji = typeEmojis[type] || '🔮';
  const cout = comp.pu || '/';
  const highlightedName = highlightText(capitalize(comp.nom), query);
  const highlightedEffect = highlightText(comp.effet || 'Aucun effet spécifié', query);
  const degats = comp.degats || '/';
  const contreCoup = comp.contreCoup || '';
  const esprit = comp.esprit || '';
  const genre = comp.genre || 'actif';

  let ccHTML = '';
  if (contreCoup && contreCoup !== '/' && contreCoup !== '-') {
    ccHTML = `<div class="arcane-card__cc"><strong>Contre-coup:</strong> ${highlightText(contreCoup, query)}</div>`;
  }

  const genreText = genre === 'passif' ? 'Passif' : `${cout} PU`;

  card.innerHTML = `
    <span class="search-result-badge esprit">Esprit: ${capitalize(esprit)}</span>
    <div class="arcane-card__header" style="padding-right: 140px;">
      <div class="arcane-card__title">${highlightedName}</div>
      <span class="arcane-card__type" style="background: rgba(130, 80, 220, 0.25); border-color: rgba(130, 80, 220, 0.5); color: #d6c5f0;">
        ${capitalize(type)}
      </span>
    </div>
    <div class="arcane-card__icon">${emoji}</div>
    <div class="arcane-card__content">
      <div class="arcane-card__footer">
        <div class="arcane-card__description">${highlightedEffect}</div>
        ${ccHTML}
        <div class="arcane-card__meta">
          <span>Dégâts: ${capitalize(degats)}</span>
          <span>Type: ${capitalize(genreText)}</span>
        </div>
      </div>
    </div>
  `;
  return card;
}
