const pokedexGrid = document.getElementById('pokedex-grid');
const loader = document.getElementById('loader');
const pokemonDetailsModal = document.getElementById('pokemon-details-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal-btn');
const searchInput = document.getElementById('search-input');
const noResultsDiv = document.getElementById('no-results');

const POKEMON_COUNT = 200;
const POKE_API_URL = 'https://pokeapi.co/api/v2/';
let allPokemonCards = [];

// --- Helper Functions ---

const formatPokemonId = (id) => {
    return `#${String(id).padStart(3, '0')}`;
};

const getPokemonImageUrl = (pokemonData) => {
    // Check details first as it's more likely to exist if card is created
    const details = pokemonData.details;
    if (details && details.sprites) {
        return details.sprites.other['official-artwork']?.front_default
            || details.sprites.other.dream_world?.front_default
            || details.sprites.front_default;
    }
    // Fallback if details somehow missing or sprites missing
    return 'https://via.placeholder.com/100?text=No+Image';
};


const getStatBarClass = (value) => {
    if (value < 50) return 'low';
    if (value < 80) return 'medium';
    if (value < 110) return 'high';
    return 'very-high';
};

// --- API Fetching ---

const fetchPokemonData = async (identifier) => {
    const pokemonUrl = `${POKE_API_URL}pokemon/${identifier}`;
    const speciesUrl = `${POKE_API_URL}pokemon-species/${identifier}`;

    try {
        const [pokemonRes, speciesRes] = await Promise.all([
            fetch(pokemonUrl),
            fetch(speciesUrl)
        ]);

        // Need details to be OK for basic card creation
        if (!pokemonRes.ok) {
             console.error(`Failed to fetch Pokémon details for ${identifier}. Status: ${pokemonRes.status}`);
             // Allow proceeding if species is ok for modal, but card creation might fail later
        }
         if (!speciesRes.ok) {
            // Log error but don't necessarily stop if details are ok
            console.warn(`Failed to fetch Pokémon species for ${identifier}. Status: ${speciesRes.status}`);
        }

        const pokemonDetails = pokemonRes.ok ? await pokemonRes.json() : null;
        const pokemonSpecies = speciesRes.ok ? await speciesRes.json() : null;

        return { details: pokemonDetails, species: pokemonSpecies };

    } catch (error) {
        console.error(`Error fetching data for Pokémon ${identifier}:`, error);
        return { details: null, species: null }; // Indicate failure
    }
};

const fetchPokemonList = async (limit) => {
    const url = `${POKE_API_URL}pokemon?limit=${limit}&offset=0`;
    try {
        loader.style.display = 'block';
        pokedexGrid.classList.remove('loaded');
        noResultsDiv.style.display = 'none';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.results.map(p => p.name); // Return just names
    } catch (error) {
        console.error("Could not fetch Pokémon list:", error);
        loader.textContent = 'Failed to load Pokémon list.';
        return [];
    }
};


// --- DOM Manipulation ---

const createPokemonCard = (pokemonFullData) => {
    // Essential check: Need details to build the card
    if (!pokemonFullData || !pokemonFullData.details) {
        console.warn("Skipping card creation: Missing essential details data.");
        return null;
    }

    const details = pokemonFullData.details;

    const card = document.createElement('div');
    card.classList.add('pokemon-card');
    card.dataset.pokemonId = details.id;
    card.dataset.pokemonName = details.name.toLowerCase();

    // Determine PRIMARY TYPE and add class for background
    const primaryType = details.types?.[0]?.type?.name;
    if (primaryType) {
        const typeClass = `type-bg-${primaryType}`;
        card.classList.add(typeClass);
    } else {
         card.classList.add('type-bg-unknown'); // Fallback class
    }

    const imageUrl = getPokemonImageUrl(pokemonFullData); // Use combined data
    const name = details.name;
    const id = details.id;

    card.innerHTML = `
        <img src="${imageUrl}" alt="${name}" loading="lazy">
        <p class="pokemon-id">${formatPokemonId(id)}</p>
        <h2 class="pokemon-name">${name}</h2>
    `;

    card.addEventListener('click', () => {
        // Pass ID to fetch fresh details for modal
        displayPokemonDetails(details.id);
    });

    return card;
};


const displayPokemonDetails = async (pokemonId) => {
     modalBody.innerHTML = '<p>Loading details...</p>';
    pokemonDetailsModal.showModal();

    const fullData = await fetchPokemonData(pokemonId); // Fetch combined data again

    // Check required data for modal display
    if (!fullData || !fullData.details) {
        modalBody.innerHTML = '<p>Could not load Pokémon details. Please try again.</p>';
        pokemonDetailsModal.showModal(); // Keep modal open to show error
        return;
    }

    const data = fullData.details; // Main data source
    const speciesData = fullData.species; // Supplemental data

    const imageUrl = getPokemonImageUrl(fullData); // Use combined data

    const typesHtml = data.types.map(typeInfo =>
        `<span class="type-badge type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
    ).join(' ');

    const abilitiesHtml = data.abilities.map(abilityInfo =>
        `<li>${abilityInfo.ability.name.replace('-', ' ')}${abilityInfo.is_hidden ? ' (Hidden)' : ''}</li>`
    ).join('');

     const statsHtml = data.stats.map(statInfo => `
        <li>
            <span class="stat-name">${statInfo.stat.name.replace('-', ' ')}</span>
            <div class="stat-bar-container">
                <div class="stat-bar ${getStatBarClass(statInfo.base_stat)}"
                     style="width: ${Math.min(statInfo.base_stat / 1.5, 100)}%;">
                </div>
            </div>
            <span class="stat-value">${statInfo.base_stat}</span>
        </li>
    `).join('');

    // Safely get habitat name
    const habitatName = speciesData?.habitat?.name ? speciesData.habitat.name.replace('-', ' ') : 'Unknown';

    modalBody.innerHTML = `
        <h2>${data.name}</h2>
        <img src="${imageUrl}" alt="${data.name}">
        <p><strong>ID:</strong> ${formatPokemonId(data.id)}</p>
        <div class="details-section">
            <h3>Types</h3>
            <p>${typesHtml}</p>
        </div>
        <div class="details-section">
            <h3>Habitat</h3>
            <p style="text-transform: capitalize;">${habitatName}</p>
        </div>
        <div class="details-section">
            <h3>Abilities</h3>
            <ul>${abilitiesHtml}</ul>
        </div>
         <div class="details-section">
            <h3>Base Stats</h3>
            <ul class="stats-list">${statsHtml}</ul>
        </div>
        <div class="details-section">
            <h3>Physical Attributes</h3>
            <p><strong>Height:</strong> ${data.height / 10} m</p>
            <p><strong>Weight:</strong> ${data.weight / 10} kg</p>
        </div>
    `;
};

// --- Search/Filter Function ---
const filterPokemon = () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    allPokemonCards.forEach(card => {
        // Skip if card is somehow null (shouldn't happen if checks are good)
        if (!card) return;

        const pokemonName = card.dataset.pokemonName;
        const pokemonId = card.dataset.pokemonId;
        const isMatch = pokemonName.includes(searchTerm) || pokemonId.startsWith(searchTerm);

        card.style.display = isMatch ? 'flex' : 'none';
        if (isMatch) {
            visibleCount++;
        }
    });
    noResultsDiv.style.display = (visibleCount === 0 && searchTerm !== '') ? 'block' : 'none';
};


// --- Initialization ---
const initializePokedex = async () => {
    const pokemonIdentifiers = await fetchPokemonList(POKEMON_COUNT);

    if (pokemonIdentifiers.length === 0) return;

    console.log(`Fetching data for ${pokemonIdentifiers.length} Pokémon...`);
    const pokemonDataPromises = pokemonIdentifiers.map(identifier => fetchPokemonData(identifier));
    const allPokemonFullData = await Promise.all(pokemonDataPromises);
    console.log("Finished fetching all Pokémon data.");

    pokedexGrid.innerHTML = '';
    allPokemonCards = []; // Reset card array

    allPokemonFullData.forEach(pokemonFullData => {
        // Pass the full data object to the card creation function
        const card = createPokemonCard(pokemonFullData);
        if (card) { // Only process if card was successfully created
             pokedexGrid.appendChild(card);
             allPokemonCards.push(card);
        }
    });

    loader.style.display = 'none';
    pokedexGrid.classList.add('loaded');
};

// --- Event Listeners ---
closeModalBtn.addEventListener('click', () => {
    pokemonDetailsModal.close();
});
pokemonDetailsModal.addEventListener('click', (event) => {
    // Close only if clicking the backdrop itself, not the content inside
    if (event.target === pokemonDetailsModal) {
        pokemonDetailsModal.close();
    }
});
searchInput.addEventListener('input', filterPokemon);

// --- Start the application ---
initializePokedex();