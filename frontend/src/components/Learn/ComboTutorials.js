import React, { useState } from 'react';
import { Zap, Star, Search, Filter } from 'lucide-react';

const ComboTutorials = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [expandedCombo, setExpandedCombo] = useState(null);

  const toggleCombo = (comboId) => {
    setExpandedCombo(expandedCombo === comboId ? null : comboId);
  };

  const combos = [
    {
      id: 1,
      name: 'Splinter Twin',
      cards: ['Splinter Twin', 'Pestermite'],
      description: 'Create infinite hasty token copies at end of opponent\'s turn',
      format: 'Modern',
      difficulty: 'Intermediate',
      prerequisites: ['Splinter Twin enchanting Pestermite (or Deceiver Exarch)', 'Enough mana to start the loop'],
      steps: [
        'Enchant Pestermite with Splinter Twin',
        'Tap Pestermite to create a token copy of itself',
        'The token enters untapped and untaps the enchanted Pestermite',
        'Repeat to create as many token copies as desired',
        'Attack with all the hasty tokens for lethal damage',
        'Sacrifice all tokens at end of turn (they have haste, attack immediately)'
      ],
      variations: [
        'Deceiver Exarch is another untapper that works the same way',
        'Village Bell-Ringer can also untap Pestermite for the combo',
        'Can be assembled with Chord of Calling or Collected Company'
      ],
      notes: 'Both Splinter Twin and Pestermite are banned in Modern. This combo is still legal in Legacy and Commander.'
    },
    {
      id: 2,
      name: 'Kiki-Jiki + Pestermite',
      cards: ['Kiki-Jiki, Mirror Breaker', 'Pestermite'],
      description: 'Infinite hasty token copies without the enchantment vulnerability',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Kiki-Jiki, Mirror Breaker in play', 'Pestermite (or Deceiver Exarch) in play'],
      steps: [
        'Activate Kiki-Jiki targeting Pestermite to create a hasty token copy',
        'The Pestermite token enters the battlefield and untaps Kiki-Jiki',
        'Activate Kiki-Jiki again targeting the new Pestermite token',
        'Repeat to create infinite hasty token copies',
        'Attack with all tokens for lethal damage'
      ],
      variations: [
        'Deceiver Exarch works identically to Pestermite',
        'Restoration Angel can be used to blink Kiki-Jiki for additional value',
        'Fetchable with Chord of Calling or Green Sun\'s Zenith (for Kiki)'
      ],
      notes: 'Unlike Splinter Twin, Kiki-Jiki is not banned in Modern but the combo is more commonly seen in Commander and Legacy.'
    },
    {
      id: 3,
      name: 'Thassa\'s Oracle + Demonic Consultation',
      cards: ['Thassa\'s Oracle', 'Demonic Consultation'],
      description: 'Win the game immediately with an empty library',
      format: 'Commander',
      difficulty: 'Advanced',
      prerequisites: ['Both cards in hand', 'UUB available (or split across turns with fast mana)', 'No graveyard hate in play'],
      steps: [
        'Cast Demonic Consultation, naming a card not in your deck',
        'Exile your entire library (no card by that name is found)',
        'Cast Thassa\'s Oracle with an empty library',
        'Thassa\'s Oracle\'s trigger resolves: you look at 0 cards, devotion to blue is 2+, you win'
      ],
      variations: [
        'Tainted Pact can replace Demonic Consultation if your deck has no duplicate card names (common in cEDH)',
        'Jace, Wielder of Mysteries has a similar win condition to Thassa\'s Oracle',
        'Laboratory Maniac is a slower alternative that requires drawing a card'
      ],
      notes: 'This is one of the most efficient two-card win conditions in cEDH. Requires only 3 mana total split across two spells. Demonic Consultation is banned in Commander by many playgroups but not officially.'
    },
    {
      id: 4,
      name: 'Devoted Druid + Vizier of Remedies',
      cards: ['Devoted Druid', 'Vizier of Remedies'],
      description: 'Generate infinite green mana with a two-creature combo',
      format: 'Modern',
      difficulty: 'Beginner',
      prerequisites: ['Devoted Druid in play', 'Vizier of Remedies in play'],
      steps: [
        'Tap Devoted Druid to add one green mana',
        'Activate Devoted Druid\'s untap ability (normally puts a -1/-1 counter on it)',
        'Vizier of Remedies replaces the -1/-1 counter with no counter being placed',
        'Devoted Druid untaps with no counters, tap again for green mana',
        'Repeat for infinite green mana',
        'Use the mana to cast a creature for infinite power (e.g., Walking Ballista or Duskwatch Recruiter loops)'
      ],
      variations: [
        'Walking Ballista as the mana sink wins immediately with infinite damage',
        'Channeler Initiate can replace Devoted Druid if it has been given counters another way',
        'Duskwatch Recruiter can find the combo pieces while generating value'
      ],
      notes: 'A resilient combo that can be assembled with Collected Company or Chord of Calling. Devoted Druid has summoning sickness on the turn it enters, so you need to wait a turn or have haste enablers.'
    },
    {
      id: 5,
      name: 'Mikaeus + Triskelion',
      cards: ['Mikaeus, the Unhallowed', 'Triskelion'],
      description: 'Deal infinite damage with an infinite undying loop',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Mikaeus, the Unhallowed in play', 'Triskelion in play or in graveyard'],
      steps: [
        'Triskelion enters with three +1/+1 counters (four total with Mikaeus\'s buff)',
        'Remove two counters to deal 2 damage to target player',
        'Remove the third counter to deal 1 damage to Triskelion itself',
        'Triskelion dies with no counters and no +1/+1 counters (Mikaeus\'s gave one, you used it)',
        'Undying triggers: Triskelion returns from graveyard with a +1/+1 counter',
        'Repeat from step 2 for infinite damage'
      ],
      variations: [
        'Can deal damage to multiple opponents simultaneously in multiplayer',
        'Walking Ballista works similarly under Mikaeus with slight rule differences',
        'Persist creatures (like Glen Elendra Archmage) can also loop under Mikaeus'
      ],
      notes: 'Mikaeus gives all non-Humans undying. Triskelion is not a Human. The combo wins on the spot. Both pieces are commonly tutored in black Commander decks.'
    },
    {
      id: 6,
      name: 'Sanguine Bond + Exquisite Blood',
      cards: ['Sanguine Bond', 'Exquisite Blood'],
      description: 'Infinite life drain loop triggered by any life gain or life loss',
      format: 'Commander',
      difficulty: 'Beginner',
      prerequisites: ['Both enchantments in play', 'Any source of life gain or damage to an opponent'],
      steps: [
        'Gain any amount of life (e.g., from a Sanguine Bond trigger, a lifelink creature, or a life gain spell)',
        'Sanguine Bond triggers: opponent loses that much life',
        'Exquisite Blood triggers: you gain that much life (because an opponent lost life)',
        'Sanguine Bond triggers again from the life gain',
        'Loop continues until all opponents are dead'
      ],
      variations: [
        'Exquisite Blood also triggers from damage, not just "lose life" effects',
        'Vito, Thorn of the Dusk Rose is a creature that acts as Sanguine Bond on the stack',
        'Epicure of Blood is a functional reprint as a creature'
      ],
      notes: 'One of the most well-known infinite combos in Commander. Requires you to trigger one of the two enchantments to start the loop. Any damage or life gain starts it once both pieces are in play.'
    },
    {
      id: 7,
      name: 'Isochron Scepter + Dramatic Reversal',
      cards: ['Isochron Scepter', 'Dramatic Reversal', 'Mana Rocks (producing 3+ total mana)'],
      description: 'Infinite mana and activations with artifacts and mana rocks',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Isochron Scepter with Dramatic Reversal imprinted', 'Mana rocks producing at least 3 total mana', 'UU available'],
      steps: [
        'Tap your mana rocks to add at least 3 mana (including UU)',
        'Activate Isochron Scepter for 2 to copy Dramatic Reversal',
        'The copy of Dramatic Reversal untaps all nonland permanents',
        'Your mana rocks untap, generating more mana than you spent',
        'Repeat for infinite mana of any color your rocks produce',
        'Win with an infinite mana payoff like Blue Sun\'s Zenith or Walking Ballista'
      ],
      variations: [
        'Any instant with CMC 2 or less can be imprinted; Dramatic Reversal is the classic choice',
        'Can also generate infinite storm count with any cantrip imprinted',
        'Rings of Brighthearth can copy the Scepter activation for extra value'
      ],
      notes: 'Commonly seen in artifact-heavy Commander decks and Urza, Lord High Artificer decks. Requires mana rocks that produce at least 3 total mana to be net positive.'
    },
    {
      id: 8,
      name: 'Food Chain Combo',
      cards: ['Food Chain', 'Misthollow Griffin'],
      description: 'Generate infinite colored mana by exiling and recasting from exile',
      format: 'Legacy',
      difficulty: 'Advanced',
      prerequisites: ['Food Chain in play', 'Misthollow Griffin (or Eternal Scourge) in play or hand'],
      steps: [
        'Exile Misthollow Griffin to Food Chain, adding XXXG where X = Griffin\'s mana cost (4G)',
        'Misthollow Griffin can be cast from exile (its ability)',
        'You gained 5 food counters, spent 4 to recast it — net 1 mana profit per loop',
        'Repeat to generate infinite colored mana',
        'Use the mana on a win condition that can be cast from exile or doesn\'t rely on the stack'
      ],
      variations: [
        'Eternal Scourge works identically and is colorless, giving more flexibility',
        'Squee, the Immortal can be used but returns to hand, not exile',
        'In Commander, Tazri Beacon of Unity can use this mana to put creatures into play'
      ],
      notes: 'This combo only generates creature mana (Food Chain counters), which can only be used to cast creature spells. You need a payoff creature as your win condition. Commonly paired with The Gitrog Monster or Thrasios, Triton Hero in cEDH.'
    },
    {
      id: 9,
      name: 'Ad Nauseam + Angel\'s Grace',
      cards: ['Ad Nauseam', 'Angel\'s Grace', 'Lightning Storm'],
      description: 'Draw your entire deck and win with Lightning Storm at any life total',
      format: 'Modern',
      difficulty: 'Advanced',
      prerequisites: ['Ad Nauseam in hand', 'Angel\'s Grace or Phyrexian Unlife in hand/play', '5 mana available'],
      steps: [
        'Cast Angel\'s Grace (or have Phyrexian Unlife in play) to prevent death from 0 life',
        'Cast Ad Nauseam — reveal and put into hand each card from the top of your library',
        'Continue through your entire deck regardless of life total',
        'Find and cast Simian Spirit Guide and/or rituals for mana if needed',
        'Cast Lightning Storm',
        'Discard lands from hand to redirect all the damage to the opponent for lethal'
      ],
      variations: [
        'Phyrexian Unlife can replace Angel\'s Grace (you can go to negative life without dying)',
        'Conflagrate as a backup win condition using flashback',
        'Laboratory Maniac is a slower alternative win condition'
      ],
      notes: 'The classic Ad Nauseam combo deck is one of Modern\'s most unique archetypes. The deck runs very few expensive cards to maximize the value of Ad Nauseam. Typically finishes on turns 3-5.'
    },
    {
      id: 10,
      name: 'Worldgorger Dragon + Animate Dead',
      cards: ['Worldgorger Dragon', 'Animate Dead'],
      description: 'Infinite ETB triggers and infinite mana by looping an exile/return effect',
      format: 'Legacy',
      difficulty: 'Advanced',
      prerequisites: ['Worldgorger Dragon in graveyard', 'Animate Dead in hand or accessible', '2BB available'],
      steps: [
        'Cast Animate Dead on Worldgorger Dragon in your graveyard',
        'Worldgorger Dragon enters the battlefield, exiling all other permanents you control (including Animate Dead)',
        'Animate Dead leaves the battlefield, causing its trigger to reanimate another creature',
        'Target Worldgorger Dragon again',
        'Dragon enters, exiles everything, Animate Dead leaves again',
        'Each loop, tap your lands for mana while they\'re not exiled (float the mana)',
        'Exit the loop by targeting a different creature with the Animate Dead trigger',
        'Spend the infinite mana on a win condition like Sunscorched Desert pings or Gemstone Array'
      ],
      variations: [
        'Dance of the Dead and Necromancy work identically to Animate Dead',
        'Any reanimation enchantment that leaves the battlefield when the target dies works',
        'Can win via an opponent\'s creature if they have one in their graveyard'
      ],
      notes: 'The loop can be interrupted by exiling Worldgorger Dragon in response to an entering trigger. Without an exit target in graveyards, the loop is a draw. Be careful not to accidentally draw with this combo.'
    },
    {
      id: 11,
      name: 'Hermit Druid',
      cards: ['Hermit Druid'],
      description: 'Mill your entire library in one activation with no basic lands',
      format: 'Commander',
      difficulty: 'Expert',
      prerequisites: ['Hermit Druid in play', 'No basic lands in your deck (or zero remaining in library)', '1G available to activate'],
      steps: [
        'Build a deck with zero basic lands (or have none remaining in your library)',
        'Activate Hermit Druid: reveal cards until you reveal a basic land',
        'With no basics in the deck, reveal and mill your entire library',
        'Set up a graveyard-based win condition from here',
        'Common wins: Dread Return + Thassa\'s Oracle, Necrotic Ooze combo, Laboratory Maniac + draw effect'
      ],
      variations: [
        'Thassa\'s Oracle is the most reliable win after milling: cast it with empty library',
        'Necrotic Ooze can use activated abilities of creatures in your graveyard',
        'Some builds use Dread Return (via convoke with self-reanimating creatures) to bring back Thassa\'s Oracle'
      ],
      notes: 'Hermit Druid decks are called "Hermit Druid combo" in cEDH. They typically use no basic lands and fill the graveyard with specific creatures to chain into a win. Requires careful deckbuilding and graveyard protection.'
    },
    {
      id: 12,
      name: 'Underworld Breach + Brain Freeze',
      cards: ['Underworld Breach', 'Lion\'s Eye Diamond', 'Brain Freeze'],
      description: 'Mill the opponent\'s entire library through recursive storm',
      format: 'Legacy',
      difficulty: 'Expert',
      prerequisites: ['Underworld Breach in play', 'Lion\'s Eye Diamond in play', 'Brain Freeze in hand or graveyard', 'Cards in graveyard for Breach escape costs'],
      steps: [
        'Cast Brain Freeze targeting opponent, milling 3 cards plus storm copies',
        'In response to your own Brain Freeze, crack Lion\'s Eye Diamond for 3 blue mana',
        'Use Underworld Breach to cast Brain Freeze from the graveyard (escape cost: exile 3 cards from graveyard)',
        'Each Brain Freeze cast adds to the storm count',
        'Loop Brain Freeze via Breach to generate ever-increasing storm counts',
        'Eventually mill the opponent\'s entire library, leaving them to draw from an empty deck'
      ],
      variations: [
        'Grinding Station can replace Brain Freeze for artifact-based decks',
        'Echo of Eons provides a "library reset" to continue the engine',
        'Can win with Tendrils of Agony instead of Brain Freeze by copying that with storm'
      ],
      notes: 'This is one of the most powerful Legacy combo packages. The deck typically uses Breach as a value engine early and pivots to the kill when the opponent taps out or misses disruption.'
    },
    {
      id: 13,
      name: 'Painter\'s Servant + Grindstone',
      cards: ['Painter\'s Servant', 'Grindstone'],
      description: 'Mill opponent\'s entire library in one Grindstone activation',
      format: 'Legacy',
      difficulty: 'Intermediate',
      prerequisites: ['Painter\'s Servant in play naming any color', 'Grindstone in play', '3 mana available to activate Grindstone'],
      steps: [
        'Painter\'s Servant enters naming a color (e.g., blue)',
        'Every card in every library is now considered that color',
        'Activate Grindstone targeting opponent for 3 mana',
        'Mill 2 cards; both share the named color (all cards do)',
        'Grindstone triggers again from matching colors',
        'Repeat until opponent\'s library is empty, they draw and lose'
      ],
      variations: [
        'Painter\'s Servant can name any color — all work equally well with Grindstone',
        'Can also mill yourself if needed (e.g., to enable graveyard strategies)',
        'Red Elemental Blast and Pyroblast become counterspells for all spells with Servant in play'
      ],
      notes: 'Painter\'s Servant was unbanned in Legacy in 2019. The Servant+Grindstone combo is straightforward but requires both pieces and 3 mana. Red Elemental Blast becomes a universal counterspell with Servant naming blue, giving the deck interaction.'
    },
    {
      id: 14,
      name: 'Heliod + Walking Ballista',
      cards: ['Heliod, Sun-Crowned', 'Walking Ballista'],
      description: 'Infinite damage and infinite life with a two-permanent combo',
      format: 'Pioneer',
      difficulty: 'Beginner',
      prerequisites: ['Heliod, Sun-Crowned in play', 'Walking Ballista with at least 1 counter in play'],
      steps: [
        'Heliod gives Walking Ballista lifelink while it\'s a creature (2+ counters)',
        'Remove a +1/+1 counter from Ballista to deal 1 damage to any target',
        'Lifelink causes you to gain 1 life',
        'Heliod triggers: put a +1/+1 counter on a creature you control (target Ballista)',
        'Ballista now has the same number of counters as before',
        'Repeat for infinite damage to any targets and infinite life gain'
      ],
      variations: [
        'Spike Feeder can replace Walking Ballista for an infinite life combo (with Heliod giving lifelink)',
        'Calix, Guided by Fate can fetch Heliod in some formats',
        'Common in Pioneer Lotus Field and Heliod Company decks'
      ],
      notes: 'Requires Ballista to have 2+ counters (so it\'s a 1/1 or larger) for Heliod to give it lifelink. The combo is popular in Pioneer and Modern Humans variants. Walking Ballista was banned in Standard for this interaction.'
    },
    {
      id: 15,
      name: 'Tendrils of Agony Storm',
      cards: ['Tendrils of Agony', 'Lion\'s Eye Diamond', 'Dark Ritual', 'Cabal Ritual'],
      description: 'Build high storm count to kill with Tendrils of Agony',
      format: 'Legacy',
      difficulty: 'Expert',
      prerequisites: ['Tendrils of Agony in hand', 'Multiple fast mana spells', 'A way to rebuild hand (Infernal Tutor, Ad Nauseam, or Past in Flames)'],
      steps: [
        'Develop mana with Lotus Petal, Lion\'s Eye Diamond, Dark Ritual, Cabal Ritual',
        'Cast cantrips (Brainstorm, Ponder, Preordain) to find more pieces and increase storm count',
        'Cast Infernal Tutor with empty hand (Lion\'s Eye Diamond floating) to find Tendrils',
        'Crack LED in response to Infernal Tutor to generate black mana',
        'Cast Tendrils of Agony with a storm count of 9+ to drain opponent for 20+ life',
        'Each storm copy also drains 2 life; at storm 9, opponent loses 20 life'
      ],
      variations: [
        'Past in Flames (Flashback) can recast your graveyard to continue the chain',
        'Echo of Eons shuffles graveyards back for more action',
        'Ad Nauseam variant draws into the whole deck mid-game'
      ],
      notes: 'ANT (Ad Nauseam Tendrils) and TES (The EPIC Storm) are the two main Legacy storm decks. Storm count needs to reach 9 to deal 20 damage with one Tendrils (2 × 10 copies = 20). One of the most skill-intensive decks in Magic.'
    },
    {
      id: 16,
      name: 'Flash + Protean Hulk',
      cards: ['Flash', 'Protean Hulk'],
      description: 'Put Protean Hulk into play for free via Flash, then sacrifice it to fetch any winning creature package',
      format: 'Legacy',
      difficulty: 'Expert',
      prerequisites: ['Flash in hand', 'Protean Hulk in hand', '1U available', 'A winning creature package in library'],
      steps: [
        'Cast Flash (1U), targeting Protean Hulk in your hand',
        'Hulk enters the battlefield via Flash\'s effect',
        'Choose NOT to pay Protean Hulk\'s mana cost (5GG = 7 mana)',
        'Flash\'s clause triggers: since you didn\'t pay, Hulk is sacrificed',
        'Protean Hulk\'s death trigger fires: search your library for creatures with total mana value ≤ 6',
        'Classic winning package: Viscera Seer (1) + Body Double (5) = 6 total',
        'Body Double enters as a copy of Protean Hulk. Sacrifice it to Viscera Seer.',
        'Second Hulk trigger: fetch the final win package (e.g., Thassa\'s Oracle + Nomads en-Kor + Cephalid Illusionist = 5)',
        'Mill your library with the Nomads/Illusionist loop, then resolve Thassa\'s Oracle to win'
      ],
      variations: [
        'Thassa\'s Oracle + Thought Scour can be the final package in some piles',
        'In Commander, Hulk is often fetched via other sacrifice outlets for repeated use',
        'Mikaeus, the Unhallowed + Walking Ballista = 5 total is another winning package'
      ],
      notes: 'Flash was banned in Legacy (and Commander) specifically because of this combo — a 1U instant assembling a turn-1 win. Both Flash and Protean Hulk are banned in Legacy. The combo remains relevant in older formats and discussions of ban history.'
    },
    {
      id: 17,
      name: 'Deadeye Navigator + Palinchron',
      cards: ['Deadeye Navigator', 'Palinchron'],
      description: 'Generate infinite mana by blinking Palinchron repeatedly to untap lands each time it enters',
      format: 'Commander',
      difficulty: 'Intermediate',
      prerequisites: ['Deadeye Navigator in play soulbonded to Palinchron', 'At least 7 lands in play producing 9+ total mana'],
      steps: [
        'Soulbond Deadeye Navigator (5UU) and Palinchron (5UU) — they pair when either enters',
        'Tap your lands for mana (need at least 9 mana sources from 7+ lands)',
        'Pay 2U to activate Deadeye Navigator\'s soulbond ability: exile and return Palinchron',
        'Palinchron re-enters the battlefield and untaps up to 7 lands',
        'Your lands now produce more mana than you spent (net positive each loop)',
        'Repeat for infinite mana of whatever colors your lands produce',
        'Spend infinite mana on a win condition (Blue Sun\'s Zenith, Exsanguinate, etc.)'
      ],
      variations: [
        'Peregrine Drake (5 mana, untaps 5 lands) works similarly with enough ramp',
        'Great Whale is a budget-friendly Palinchron substitute (same effect)',
        'Phantasmal Image can copy Palinchron while bonded to Deadeye for a 3-card version'
      ],
      notes: 'Requires lands producing 9+ total mana (2U for Deadeye activation, and the lands untapped by Palinchron must produce more than was spent). With 7 basic Islands, you produce 7 and spend 2U (3), netting 4 each cycle. A Commander staple in blue-heavy decks.'
    },
    {
      id: 18,
      name: 'The Gitrog Monster + Dakmor Salvage',
      cards: ['The Gitrog Monster', 'Dakmor Salvage', 'Discard outlet (e.g., Putrid Imp)'],
      description: 'Draw your entire library by repeatedly dredging Dakmor Salvage and triggering Gitrog Monster',
      format: 'Commander',
      difficulty: 'Expert',
      prerequisites: ['The Gitrog Monster in play', 'Dakmor Salvage in hand', 'Any discard outlet in play', 'A win condition (Thassa\'s Oracle or Laboratory Maniac)'],
      steps: [
        'Activate your discard outlet (e.g., Putrid Imp) to discard Dakmor Salvage',
        'Dakmor Salvage hits the graveyard — Gitrog Monster triggers "draw a card"',
        'Instead of drawing, use Dakmor Salvage\'s Dredge 2 ability: mill 2 cards and return Salvage to hand',
        'If either milled card is a land, Gitrog Monster triggers again: draw (or dredge) again',
        'Discard Dakmor Salvage again to the discard outlet; repeat',
        'Each pass mills 2 cards and draws 1 (net: slowly consume your library)',
        'Continue until you\'ve drawn into your entire library',
        'Win with Thassa\'s Oracle (draw trigger with empty library) or Laboratory Maniac'
      ],
      variations: [
        'Nath of the Gilt-Leaf as commander lets you discard for value while assembling the combo',
        'Kozilek, Butcher of Truth in the library prevents decking — shuffle on death',
        'Once you have infinite draw loops, Exsanguinate or a large Walking Ballista wins'
      ],
      notes: 'The interaction is complex: Gitrog\'s draw trigger goes on the stack when a land hits the graveyard, and you can replace each draw with a dredge. The loop eventually draws your whole library. This is one of Commander\'s most intricate one-card-plus-outlet combos. Frequently paired with the Golgari commanders.'
    },
    {
      id: 19,
      name: 'Doomsday',
      cards: ['Doomsday', 'Thassa\'s Oracle', 'Brainstorm or cycler'],
      description: 'Search for a winning 5-card pile and draw through it to win immediately',
      format: 'Legacy',
      difficulty: 'Expert',
      prerequisites: ['Doomsday in hand (BBB)', 'A draw spell available', 'Understanding of pile construction', 'Graveyard and exile not shut down'],
      steps: [
        'Cast Doomsday (BBB): you go to 1 or 2 life; search library + graveyard for 5 cards',
        'Build your winning pile on top of your library in this order:',
        'Classic pile (needing a draw after Doomsday): [Thassa\'s Oracle, Ponder, Brainstorm, Lotus Petal, Edge of Autumn]',
        'Draw the top card (Thassa\'s Oracle) using your prepared draw spell',
        'Thassa\'s Oracle enters; its trigger resolves — you look at 0 remaining cards in library, win'
      ],
      variations: [
        'With a draw effect already in hand, you can build a simpler 2-3 card pile',
        'Laboratory Maniac + Gitaxian Probe is a budget pile (draw on empty library)',
        'Burning Wish can access a sideboard Doomsday in Vintage for a protected copy'
      ],
      notes: 'Doomsday is a highly skill-intensive combo — the "pile" you build changes based on what you have in hand, what mana is available, and what the opponent can interact with. Mastering pile construction is the core skill of playing the deck. The format player who casts Doomsday typically wins on the same turn or the next.'
    },
    {
      id: 20,
      name: 'Show and Tell + Omniscience',
      cards: ['Show and Tell', 'Omniscience'],
      description: 'Put Omniscience into play for free, then cast your entire hand for free',
      format: 'Legacy',
      difficulty: 'Intermediate',
      prerequisites: ['Show and Tell in hand (2U)', 'Omniscience (or Emrakul, the Aeons Torn) in hand', 'A follow-up win condition in hand'],
      steps: [
        'Cast Show and Tell (2U): each player may put an artifact, creature, enchantment, or land from their hand onto the battlefield',
        'Put Omniscience onto the battlefield (no mana cost paid)',
        'Opponent also gets to put a card into play — the risk of the combo',
        'With Omniscience in play, cast every spell in your hand for free',
        'Common follow-ups: cast Enter the Infinite (draw entire library), then cast a win condition',
        'Or: immediately cast Emrakul, the Aeons Torn for free — 15/15 flying plus take an extra turn',
        'Win via combat damage or by casting your entire library for free'
      ],
      variations: [
        'Emrakul, the Aeons Torn can be put in with Show and Tell directly (opponent sacrifices 6 permanents on attack)',
        'Griselbrand is another powerful Show and Tell target (draw 7+ cards immediately)',
        'Sneak Attack is used alongside Show and Tell to put creatures in play at instant speed for just 1R'
      ],
      notes: 'The opponent also gets to put a card into play, which is the risk — they could put in their own bomb. Legacy Show and Tell decks counter this by holding disruption (Force of Will) and winning fast enough that the opponent\'s card doesn\'t matter. Paired with Sneak Attack in the "Sneak and Show" archetype.'
    }
  ];

  const formats = ['all', ...new Set(combos.map(c => c.format))];
  const difficulties = ['all', ...new Set(combos.map(c => c.difficulty))];

  const filteredCombos = combos.filter(combo => {
    const matchesSearch = combo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         combo.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         combo.cards.some(card => card.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFormat = selectedFormat === 'all' || combo.format === selectedFormat;
    const matchesDifficulty = selectedDifficulty === 'all' || combo.difficulty === selectedDifficulty;
    return matchesSearch && matchesFormat && matchesDifficulty;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Combo Tutorials</h1>
        <p className="text-gray-400">
          Step-by-step explanations of popular Magic: The Gathering combos
        </p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search combos..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {formats.map(format => (
              <option key={format} value={format}>
                {format === 'all' ? 'All Formats' : format}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty === 'all' ? 'All Difficulties' : difficulty}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredCombos.length > 0 ? (
          filteredCombos.map((combo) => (
            <div key={combo.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleCombo(combo.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <Zap className="text-yellow-400" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-white">{combo.name}</h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                        {combo.format}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                        {combo.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-gray-400 text-sm">{combo.description}</div>
              </button>
              
              {expandedCombo === combo.id && (
                <div className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Cards Required</h3>
                      <div className="flex flex-wrap gap-2">
                        {combo.cards.map((card, index) => (
                          <span key={index} className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Prerequisites</h3>
                      <ul className="text-gray-300 text-sm space-y-1">
                        {combo.prerequisites.map((prereq, index) => (
                          <li key={index} className="flex items-start">
                            <Star size={12} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                            {prereq}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Steps</h3>
                    <ol className="text-gray-300 text-sm space-y-2">
                      {combo.steps.map((step, index) => (
                        <li key={index} className="flex items-start">
                          <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Variations</h3>
                      <ul className="text-gray-300 text-sm space-y-1">
                        {combo.variations.map((variation, index) => (
                          <li key={index} className="flex items-start">
                            <Zap size={12} className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                            {variation}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-purple-300 mb-2">Important Notes</h3>
                      <p className="text-gray-300 text-sm">{combo.notes}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Zap className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No combos found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">About Combos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <h4 className="font-medium text-purple-300 mb-2">What are Combos?</h4>
            <p className="text-sm">
              Combos in Magic: The Gathering are combinations of cards that work together 
              to create powerful effects, sometimes winning the game immediately. 
              They often involve loops or explosive interactions.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Learning Combos</h4>
            <p className="text-sm">
              Understanding combos is important for both competitive play and casual formats. 
              Knowing how to execute your own combos and disrupt your opponents' combos 
              is a key skill in Magic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboTutorials;