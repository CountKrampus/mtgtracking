import React, { useState } from 'react';
import { Search, BookOpen, Filter, Tag } from 'lucide-react';

const KeywordGlossary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedKeyword, setExpandedKeyword] = useState(null);

  const toggleKeyword = (keywordName) => {
    setExpandedKeyword(expandedKeyword === keywordName ? null : keywordName);
  };

  // Comprehensive list of MTG keywords with categories
  const keywords = [
    // ── Combat Abilities ───────────────────────────────────────────
    {
      name: 'Flying',
      category: 'Combat',
      description: 'Can only be blocked by creatures with flying or reach.',
      example: 'A 2/2 flyer attacks; only your opponent\'s creature with flying or reach can block it.',
      advanced: 'Multiple blockers are allowed if they all have flying or reach. Reach does not grant flying.'
    },
    {
      name: 'Trample',
      category: 'Combat',
      description: 'Excess combat damage beyond what is needed to kill blockers carries over to the defending player.',
      example: 'A 6/6 trampler attacks into a 2/2 blocker — 2 damage kills the blocker, 4 carries over to the player.',
      advanced: 'You must assign at least lethal damage to each blocker before assigning trample damage to the player. Indestructible blockers must be assigned their toughness in damage before excess can trample through.'
    },
    {
      name: 'First Strike',
      category: 'Combat',
      description: 'Deals its combat damage before creatures without first strike.',
      example: 'A 2/1 first striker blocks a 3/3: it deals 2 damage first. If that kills the 3/3, the 3/3 never deals damage back.',
      advanced: 'First strike creates an extra combat damage step. If both creatures have first strike, they deal damage simultaneously in that step.'
    },
    {
      name: 'Double Strike',
      category: 'Combat',
      description: 'Deals combat damage in both the first strike and regular combat damage steps.',
      example: 'A 2/2 double striker fights a 4/4: it deals 2 damage in the first-strike step and 2 more in the regular step.',
      advanced: 'A double striker can kill a creature in the first-strike step and still deal combat damage to the player in the regular step.'
    },
    {
      name: 'Vigilance',
      category: 'Combat',
      description: 'Attacking doesn\'t cause this creature to tap.',
      example: 'A 3/3 with vigilance attacks, remains untapped, and can still block on your opponent\'s turn.',
      advanced: 'Vigilance does not prevent the creature from being tapped by other effects. It only prevents the tapping cost of attacking.'
    },
    {
      name: 'Deathtouch',
      category: 'Combat',
      description: 'Any amount of damage this creature deals is enough to destroy the creature it damages.',
      example: 'A 1/1 with deathtouch blocks a 10/10: the 1/1 deals 1 damage, which is lethal due to deathtouch.',
      advanced: 'When a deathtouch creature deals combat damage to multiple blockers, even 1 damage to each is lethal. Lifelink and deathtouch together is a powerful combination.'
    },
    {
      name: 'Lifelink',
      category: 'Combat',
      description: 'Damage dealt by this source also causes its controller to gain that much life.',
      example: 'A 3/3 with lifelink deals 3 combat damage — its controller gains 3 life simultaneously.',
      advanced: 'Lifelink applies to all damage dealt by the source, not just combat damage. Multiple instances of lifelink do not stack (you gain life once per damage event).'
    },
    {
      name: 'Reach',
      category: 'Combat',
      description: 'Can block creatures with flying.',
      example: 'A Spider with reach can block an opponent\'s Dragon with flying.',
      advanced: 'Reach does not grant flying. A creature with reach cannot block other creatures with reach unless it also has flying.'
    },
    {
      name: 'Menace',
      category: 'Combat',
      description: 'Can\'t be blocked except by two or more creatures.',
      example: 'An attacking 3/3 with menace can only be blocked if the opponent assigns at least two blockers.',
      advanced: 'If only one creature is available to block, the menace creature is unblockable. Deathtouch + menace forces the opponent to sacrifice two creatures to block it.'
    },
    {
      name: 'Infect',
      category: 'Combat',
      description: 'Damage to creatures is given as -1/-1 counters; damage to players is given as poison counters. A player with 10 or more poison counters loses the game.',
      example: 'A 2/2 infect creature deals 2 damage to a player — that player gets 2 poison counters.',
      advanced: 'Infect damage to creatures does not use the normal damage/toughness system; instead -1/-1 counters accumulate. A creature dies when its toughness reaches 0 from these counters.'
    },
    {
      name: 'Wither',
      category: 'Combat',
      description: 'Damage this source deals to creatures is dealt as -1/-1 counters instead.',
      example: 'A 2/2 with wither deals 2 damage to a 3/3: the 3/3 becomes a 1/1 with two -1/-1 counters on it.',
      advanced: 'Wither only affects creatures; damage to players is still normal loss of life, not poison counters (unlike Infect).'
    },
    {
      name: 'Annihilator',
      category: 'Combat',
      description: 'Whenever this creature attacks, the defending player sacrifices that many permanents.',
      example: 'Emrakul, the Aeons Torn has annihilator 6: the defending player sacrifices 6 permanents when it attacks.',
      advanced: 'The sacrifice trigger goes on the stack when the creature attacks, before blockers are declared. Sacrificing lands can be forced, accelerating the opponent\'s demise.'
    },
    {
      name: 'Myriad',
      category: 'Combat',
      description: 'When this creature attacks, create a token copy of it attacking each other opponent.',
      example: 'In a four-player game, a creature with myriad attacking one player also puts token copies attacking the other two opponents.',
      advanced: 'The tokens are exiled at end of combat. Myriad is especially powerful in multiplayer formats like Commander.'
    },
    {
      name: 'Afflict',
      category: 'Combat',
      description: 'Whenever this creature becomes blocked, the defending player loses life equal to the afflict value.',
      example: 'A creature with afflict 3 is blocked: the defending player loses 3 life regardless of combat outcome.',
      advanced: 'The life loss happens even if the creature is blocked by multiple creatures. This forces opponents to choose between taking damage or losing life.'
    },
    {
      name: 'Battle Cry',
      category: 'Combat',
      description: 'Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.',
      example: 'Three creatures attack, one has battle cry: the other two attacking creatures each get +1/+0.',
      advanced: 'Multiple battle cry triggers stack: two creatures with battle cry each trigger separately, giving the other attackers +2/+0 total.'
    },
    // ── Evasion ────────────────────────────────────────────────────
    {
      name: 'Hexproof',
      category: 'Evasion',
      description: 'Can\'t be the target of spells or abilities your opponents control.',
      example: 'An opponent can\'t Lightning Bolt your hexproof creature, but you can cast Giant Growth on it.',
      advanced: 'Hexproof does not prevent targeting by the controller. It also does not prevent non-targeted effects like board wipes (Wrath of God).'
    },
    {
      name: 'Shroud',
      category: 'Evasion',
      description: 'Can\'t be the target of any spells or abilities — including your own.',
      example: 'A creature with shroud can\'t be targeted by your own Giant Growth either.',
      advanced: 'Shroud is strictly more protective than hexproof in some ways, but prevents you from buffing or equipping the creature as well.'
    },
    {
      name: 'Ward',
      category: 'Evasion',
      description: 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.',
      example: 'Ward 2: an opponent targets your creature with a removal spell; they must pay 2 additional mana or the spell is countered.',
      advanced: 'Ward triggers after the spell is on the stack. If the opponent can\'t or won\'t pay, the spell is countered but not necessarily exiled. Common on modern MTG cards.'
    },
    {
      name: 'Protection',
      category: 'Evasion',
      description: 'Protection from [quality]: can\'t be damaged, enchanted, equipped, blocked, or targeted by sources with that quality (DEBT).',
      example: 'Protection from red: red spells can\'t target it, red creatures can\'t block it, red damage is prevented.',
      advanced: 'DEBT: Damage prevented, Enchanted/equipped blocked, Blocked by those sources, Targeted by those spells. Does not prevent non-targeted effects (like Wrath).'
    },
    {
      name: 'Indestructible',
      category: 'Evasion',
      description: 'Can\'t be destroyed by damage or "destroy" effects.',
      example: 'A creature with indestructible survives any amount of damage and effects like Doom Blade.',
      advanced: 'Indestructible does not prevent exile effects, -X/-X effects that reduce toughness to 0, or sacrifice effects. "Destroy" effects simply don\'t work.'
    },
    // ── Timing ─────────────────────────────────────────────────────
    {
      name: 'Haste',
      category: 'Timing',
      description: 'Can attack and use activated abilities that include tapping the turn it enters the battlefield.',
      example: 'A creature with haste can attack the same turn it\'s cast, ignoring summoning sickness.',
      advanced: 'Haste overrides the normal rule that creatures must be under your control since the start of your turn to attack or tap.'
    },
    {
      name: 'Flash',
      category: 'Timing',
      description: 'Can be cast any time you could cast an instant.',
      example: 'A creature with flash can be cast on your opponent\'s end step or in response to a spell.',
      advanced: 'Flash is powerful because it provides information advantage — you can see what your opponent does before deciding whether to play your creature.'
    },
    {
      name: 'Suspend',
      category: 'Timing',
      description: 'Rather than casting normally, pay the suspend cost to exile the card with time counters. Remove one counter each upkeep; cast it for free when the last counter is removed.',
      example: 'Suspend 4 — 1G: exile the card with 4 time counters, cast it free after 4 of your upkeeps.',
      advanced: 'Suspended spells have haste if they\'re creatures when they come off suspend. You can\'t cancel a suspended spell once you\'ve suspended it.'
    },
    {
      name: 'Phasing',
      category: 'Timing',
      description: 'Phases out (is treated as though it doesn\'t exist) at the beginning of your untap step, then phases back in at the beginning of your next untap step.',
      example: 'A phasing creature phases out at your untap step: it can\'t be targeted or affected until it phases back in.',
      advanced: 'Phased-out permanents don\'t untap, trigger, or be affected by anything. Auras and equipment attached to a phased-out creature also phase out with it.'
    },
    {
      name: 'Echo',
      category: 'Timing',
      description: 'At the beginning of your upkeep after playing this, pay the echo cost or sacrifice it.',
      example: 'A 3/3 with echo 3G: on your next upkeep, pay 3G again or sacrifice the 3/3.',
      advanced: 'Echo triggers at the upkeep only once — the turn after it enters. If you don\'t pay, you sacrifice it. Great with "enters the battlefield" abilities since you get them even if you sacrifice it.'
    },
    {
      name: 'Cumulative Upkeep',
      category: 'Timing',
      description: 'At the beginning of your upkeep, put an age counter on this, then pay the upkeep cost for each age counter on it, or sacrifice it.',
      example: 'Cumulative upkeep 1: costs 1 on first upkeep, 2 on the second, 3 on the third, etc.',
      advanced: 'The cost escalates every turn. This mechanic was common in Ice Age block and makes long-term use prohibitively expensive.'
    },
    // ── Triggered Abilities ────────────────────────────────────────
    {
      name: 'Prowess',
      category: 'Triggered',
      description: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
      example: 'Cast a cantrip with a prowess creature in play: it gets +1/+1 for the rest of the turn.',
      advanced: 'Multiple noncreature spells stack: cast three spells in a turn for +3/+3. Core mechanic of "Izzet spells" archetypes.'
    },
    {
      name: 'Landfall',
      category: 'Triggered',
      description: 'Triggers whenever a land enters the battlefield under your control.',
      example: 'A creature with landfall gains +2/+2 until end of turn whenever you play a land.',
      advanced: 'Fetchlands trigger landfall twice: once when the fetch enters, and once when the basic enters. Important timing consideration in Landfall decks.'
    },
    {
      name: 'Undying',
      category: 'Triggered',
      description: 'When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield with a +1/+1 counter.',
      example: 'A 2/2 with undying dies: it returns as a 3/3 with a +1/+1 counter on it.',
      advanced: 'The returned creature has a +1/+1 counter, so undying does not trigger again when it dies the second time. Removing the counter resets this.'
    },
    {
      name: 'Persist',
      category: 'Triggered',
      description: 'When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield with a -1/-1 counter.',
      example: 'A 2/2 with persist dies: it returns as a 1/1 with a -1/-1 counter on it.',
      advanced: 'Persist and Undying can create infinite loops together: if a creature with undying and one with persist share a way to remove counters, they can loop indefinitely.'
    },
    {
      name: 'Fabricate',
      category: 'Triggered',
      description: 'When this creature enters the battlefield, choose: put N +1/+1 counters on it, or create N 1/1 colorless Servo artifact creature tokens.',
      example: 'Fabricate 2: when it enters, put two +1/+1 counters on it or create two 1/1 Servos.',
      advanced: 'Fabricate is always a choice between buffs and tokens. The choice is made on entry, and each use of fabricate is a separate instance.'
    },
    // ── Activated Abilities ────────────────────────────────────────
    {
      name: 'Equip',
      category: 'Activated',
      description: 'Sorcery-speed activated ability that attaches an Equipment to a creature you control.',
      example: 'Equip 2: spend 2 mana to attach this sword to one of your creatures.',
      advanced: 'Equipping moves the Equipment from its current creature to the new target. You can equip only at sorcery speed (your main phase, no spells on stack).'
    },
    {
      name: 'Crew',
      category: 'Activated',
      description: 'Tap any number of creatures with total power N or greater to turn this Vehicle into an artifact creature until end of turn.',
      example: 'Crew 3: tap creatures with total power 3 or more. The vehicle becomes a creature until end of turn.',
      advanced: 'Crewing does not cause the creature to tap itself for crew purposes. A 1/1 can help crew a Crew 5 vehicle if other creatures contribute the rest.'
    },
    {
      name: 'Convoke',
      category: 'Activated',
      description: 'When casting this spell, you may tap untapped creatures you control. Each tapped creature reduces the cost by 1 (or by one mana of that creature\'s color).',
      example: 'Tap two creatures to reduce a spell\'s cost by 2 generic mana.',
      advanced: 'Each creature tapped pays for one mana. A green creature tapped can pay for one green mana or one generic mana. You can overpay with convoke (tap more creatures than needed).'
    },
    {
      name: 'Level Up',
      category: 'Activated',
      description: 'Pay the level up cost as a sorcery to put a level counter on this creature, gaining new abilities and stats at each level threshold.',
      example: 'Level up 1W: pay 1W during your main phase to put a level counter on the creature.',
      advanced: 'Each creature with level up has fixed power/toughness and abilities at each level range. Once leveled up, the creature retains its level even if the controller changes.'
    },
    {
      name: 'Adapt',
      category: 'Activated',
      description: 'Pay the adapt cost: if this creature has no +1/+1 counters on it, put N +1/+1 counters on it.',
      example: 'Adapt 2 (2G): spend 2G — if the creature has no counters, put two +1/+1 counters on it.',
      advanced: 'Adapt is conditional: it only works if the creature has no +1/+1 counters. Removing counters resets this. Proliferate can add counters after adapting.'
    },
    {
      name: 'Ninjutsu',
      category: 'Activated',
      description: 'Pay the ninjutsu cost and return an unblocked attacker you control to hand: put this card from your hand onto the battlefield tapped and attacking.',
      example: 'Ninjutsu 1U: return an unblocked attacker to hand, replace it with this Ninja mid-combat.',
      advanced: 'The Ninja enters already attacking and dealing damage. Its "enters the battlefield" abilities trigger. The returned creature can be replayed next turn.'
    },
    {
      name: 'Monstrous',
      category: 'Activated',
      description: 'Pay the monstrosity cost: if this creature is not monstrous, put N +1/+1 counters on it and it becomes monstrous.',
      example: 'Monstrosity 3 (4GG): pay 4GG to put three +1/+1 counters on the creature; it becomes monstrous.',
      advanced: 'Once a creature is monstrous, it stays monstrous even if the counters are removed. Monstrosity often unlocks triggered abilities (e.g., when it becomes monstrous, do X).'
    },
    {
      name: 'Proliferate',
      category: 'Activated',
      description: 'Choose any number of players and/or permanents with counters on them, then add one more counter of each type already there.',
      example: 'Proliferate: add a +1/+1 counter to each creature with one, a poison counter to each poisoned player, a loyalty counter to each planeswalker.',
      advanced: 'Proliferate applies to all counter types simultaneously. It is powerful with poison counters, planeswalkers, and sagas. Multiple proliferate triggers stack.'
    },
    {
      name: 'Transmute',
      category: 'Activated',
      description: 'Pay the transmute cost and discard this card: search your library for a card with the same mana value as this card.',
      example: 'Transmute 1UB: discard this 3-cost card to search for any other 3-cost card.',
      advanced: 'Transmute is a tutor built into a card. The card is discarded as the cost, so it goes to the graveyard. Common in older Ravnica sets at every converted mana cost.'
    },
    // ── Spells & Casting ───────────────────────────────────────────
    {
      name: 'Kicker',
      category: 'Spells',
      description: 'An optional additional cost when casting the spell that provides an additional effect.',
      example: 'Kicker 3: pay 3 extra when casting this spell to trigger the kicker effect.',
      advanced: 'Multikicker lets you pay the kicker cost multiple times for escalating effects. Kicked spells are still the same spell for interaction purposes.'
    },
    {
      name: 'Overload',
      category: 'Spells',
      description: 'Pay the overload cost instead of the normal cost: the spell now affects all valid targets instead of one.',
      example: 'Cyclonic Rift\'s overload cost: instead of bouncing one nonland permanent, bounce all opponents\' nonland permanents.',
      advanced: 'An overloaded spell has no target (it affects all). This means it can\'t be countered by spells that only counter targeted spells, and hexproof/shroud don\'t protect from it.'
    },
    {
      name: 'Cascade',
      category: 'Spells',
      description: 'When you cast this spell, exile cards from the top of your library until you exile a nonland card with a lesser mana value, then you may cast it for free.',
      example: 'Cast a cascade spell (mana value 4): exile cards until you hit a card with mana value 3 or less, cast it free.',
      advanced: 'Cascade triggers when cast, not when it resolves. Responding to cascade is possible. Cascade can chain into another cascade spell if the exiled card also has cascade.'
    },
    {
      name: 'Storm',
      category: 'Spells',
      description: 'When you cast this spell, copy it for each spell cast before it this turn.',
      example: 'If you\'ve cast 4 spells this turn, casting a storm spell creates 4 additional copies of it.',
      advanced: 'Storm counts all spells cast this turn by any player, from any zone. The copies are put onto the stack simultaneously and resolve one at a time.'
    },
    {
      name: 'Affinity',
      category: 'Spells',
      description: 'This spell costs 1 less for each permanent of the specified type you control.',
      example: 'Affinity for artifacts: if you control 5 artifacts, this spell costs 5 less to cast.',
      advanced: 'The cost can be reduced to zero but not below. Affinity was banned extensively in Standard 2005 due to how degenerate it was with artifact lands.'
    },
    {
      name: 'Dash',
      category: 'Spells',
      description: 'You may cast this creature for its dash cost. If you do, it gains haste and is returned to its owner\'s hand at the beginning of the next end step.',
      example: 'Dash a 3/2: it enters with haste, attacks immediately, then returns to your hand at end of turn.',
      advanced: 'Dashing avoids dying and provides repeated use. Does not protect from exile effects. Dashed creatures trigger enters-the-battlefield abilities each time they\'re played.'
    },
    {
      name: 'Surge',
      category: 'Spells',
      description: 'You may cast this spell for its surge cost if you or a teammate cast another spell this turn.',
      example: 'Cast a cantrip, then cast a surge spell for its reduced surge cost.',
      advanced: 'Surge requires a spell already cast this turn. Instant-speed surge spells can be activated on opponents\' turns if you have another instant.'
    },
    {
      name: 'Emerge',
      category: 'Spells',
      description: 'You may cast this creature by sacrificing another creature and paying this spell\'s cost reduced by that creature\'s mana value.',
      example: 'Emerge cost 5BG, sacrifice a creature with mana value 3: pay only 2BG.',
      advanced: 'The sacrificed creature\'s dies triggers still fire. Emerge is common on Eldrazi in Eldritch Moon. Sacrificing larger creatures reduces cost more.'
    },
    {
      name: 'Bestow',
      category: 'Spells',
      description: 'You may cast this card as an Aura for its bestow cost. If the enchanted creature dies, this card becomes a creature on the battlefield.',
      example: 'Bestow 4W: pay 4W to cast as an aura; if the creature it enchants dies, this becomes a 3/3 creature.',
      advanced: 'Bestow creatures avoid the "aura goes to graveyard when the creature dies" problem. They\'re never actually auras when put on the stack, so they resolve as a creature if the target dies before resolution.'
    },
    {
      name: 'Morph',
      category: 'Spells',
      description: 'You may cast this face down as a 2/2 creature for 3 generic mana. Turn it face up anytime for its morph cost.',
      example: 'Cast any morph creature as an anonymous 2/2 for 3 mana; pay its morph cost to flip it face-up.',
      advanced: 'Face-down creatures have no name, type, color, or abilities. The morph cost is paid as a special action (not a spell), so it can\'t be countered.'
    },
    {
      name: 'Foretell',
      category: 'Spells',
      description: 'During your turn, pay 2 to exile this card face down. You may cast it from exile for its foretell cost on a future turn.',
      example: 'Foretell a 5-cost spell for 2 mana; cast it next turn for its 2W foretell cost.',
      advanced: 'Foretelling is useful for playing around counterspells and splitting up mana over multiple turns. Opponents can\'t see what is foretold.'
    },
    {
      name: 'Cycling',
      category: 'Spells',
      description: 'Pay the cycling cost and discard this card: draw a card.',
      example: 'Pay 2 and discard this card to draw a new card, replacing a dead draw.',
      advanced: 'Cycling triggers "whenever you cycle a card" effects. Cycling can be activated at instant speed. Some cards have "typecycling" (e.g., forestcycling) to find a specific basic land type.'
    },
    {
      name: 'Replicate',
      category: 'Spells',
      description: 'When casting this spell, you may pay its replicate cost any number of times. Copy the spell for each time you paid the replicate cost.',
      example: 'Replicate 2U: pay 2U twice while casting to create two additional copies of the spell.',
      advanced: 'Replicate copies go on the stack immediately. They can be countered individually. Unlike storm, replicate is paid as part of casting, not a triggered ability.'
    },
    // ── Graveyard ─────────────────────────────────────────────────
    {
      name: 'Flashback',
      category: 'Graveyard',
      description: 'You may cast this card from your graveyard for its flashback cost. Exile it afterward.',
      example: 'Flashback 3R: if this spell is in your graveyard, pay 3R to cast it again, then exile it.',
      advanced: 'Flashback does not require the card to have been successfully cast before. You can discard a card with flashback and still flashback it from the graveyard.'
    },
    {
      name: 'Jump-Start',
      category: 'Graveyard',
      description: 'You may cast this card from your graveyard for its jump-start cost by also discarding a card. Exile it afterward.',
      example: 'Jump-start 2R: pay 2R and discard a card to cast this spell from your graveyard.',
      advanced: 'Jump-start requires discarding a card as an additional cost, unlike flashback. This makes it weaker in topdeck situations but synergizes with madness and graveyard decks.'
    },
    {
      name: 'Escape',
      category: 'Graveyard',
      description: 'You may cast this card from your graveyard for its escape cost by also exiling a specified number of other cards from your graveyard.',
      example: 'Escape 4G, exile 5 cards: pay 4G and exile 5 other cards from your graveyard to cast this from your graveyard.',
      advanced: 'Escape often produces a larger or enhanced version of the original card. Uro, Titan of Nature\'s Wrath famously combined escape with a powerful ETB effect.'
    },
    {
      name: 'Delve',
      category: 'Graveyard',
      description: 'When casting this spell, you may exile any number of cards from your graveyard. Each card exiled this way reduces its cost by 1.',
      example: 'Cast Treasure Cruise (cost 7): exile 6 cards from your graveyard to cast it for just 1 blue mana.',
      advanced: 'Delve is extremely powerful in decks that fill the graveyard quickly (fetch lands, cantrips, self-mill). Treasure Cruise and Dig Through Time were banned in multiple formats for being too efficient with delve.'
    },
    {
      name: 'Dredge',
      category: 'Graveyard',
      description: 'If you would draw a card, you may instead mill N cards and return this card from your graveyard to your hand.',
      example: 'Dredge 6: instead of drawing, mill 6 cards and return this card from graveyard to hand.',
      advanced: 'Dredge replaces a draw entirely, so you get the card back but mill instead of drawing. Entire "Dredge" decks use this mechanic to fill the graveyard rapidly and create powerful reanimation engines.'
    },
    {
      name: 'Madness',
      category: 'Graveyard',
      description: 'If you discard this card, you may cast it for its madness cost instead of putting it into your graveyard.',
      example: 'Madness 1R: when this card is discarded, cast it for 1R instead of it going to the graveyard.',
      advanced: 'Madness creates a window to cast the spell as an instant even if it\'s a sorcery, because the discard trigger creates a timing opportunity. Combines powerfully with Faithless Looting and similar discard effects.'
    },
    {
      name: 'Retrace',
      category: 'Graveyard',
      description: 'You may cast this card from your graveyard by discarding a land as an additional cost.',
      example: 'Retrace: discard a land from your hand to cast this spell from your graveyard again.',
      advanced: 'Retrace is most powerful in decks with many lands in hand (Landfall decks, ramp decks). Unlike flashback, retrace can be used multiple times as long as you keep discarding lands.'
    },
    {
      name: 'Aftermath',
      category: 'Graveyard',
      description: 'A split card where the second half can only be cast from the graveyard (and is exiled afterward).',
      example: 'Cut // Ribbons: cast Cut normally, cast Ribbons only from your graveyard for XBB.',
      advanced: 'The graveyard half of aftermath can never be cast from hand — only from the graveyard. It provides a way to use cards that naturally end up in the graveyard.'
    },
    {
      name: 'Scry',
      category: 'Card Advantage',
      description: 'Look at the top N cards of your library; put any number of them on the bottom in any order, the rest back on top in any order.',
      example: 'Scry 2: look at the top two cards, keep what you want on top, put the rest on the bottom.',
      advanced: 'Scry does not draw cards — it\'s library manipulation. Excellent for setting up future draws. Scry 1 appears on many low-cost spells and lands as a minor bonus.'
    },
    {
      name: 'Surveil',
      category: 'Card Advantage',
      description: 'Look at the top N cards of your library; put any number of them into your graveyard, the rest on top in any order.',
      example: 'Surveil 3: look at the top three cards, put any of them in your graveyard, keep the rest on top.',
      advanced: 'Surveil fills the graveyard while filtering your draws — more powerful than scry in decks using graveyard synergies. Common in Dimir (blue/black) decks.'
    }
  ];

  const categories = ['all', ...new Set(keywords.map(k => k.category))];

  const filteredKeywords = keywords.filter(keyword => {
    const matchesSearch = keyword.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         keyword.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || keyword.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Keyword Glossary</h1>
        <p className="text-gray-400">
          Comprehensive guide to Magic: The Gathering keywords and abilities
        </p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keywords..."
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pl-10 pr-8 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredKeywords.length > 0 ? (
          filteredKeywords.map((keyword) => (
            <div key={keyword.name} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => toggleKeyword(keyword.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <Tag className="text-purple-400" size={20} />
                  <div>
                    <h2 className="text-lg font-semibold text-white">{keyword.name}</h2>
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                      {keyword.category}
                    </span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm">{keyword.description}</div>
              </button>
              
              {expandedKeyword === keyword.name && (
                <div className="p-4 pt-0 space-y-4">
                  <div className="border-t border-white/10 pt-4">
                    <h3 className="font-medium text-purple-300 mb-2">Description</h3>
                    <p className="text-gray-300">{keyword.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Example</h3>
                    <p className="text-gray-300">{keyword.example}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-300 mb-2">Advanced Rules</h3>
                    <p className="text-gray-300">{keyword.advanced}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No keywords found</h3>
            <p className="text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">About Keywords</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
          <div>
            <h4 className="font-medium text-purple-300 mb-2">What are Keywords?</h4>
            <p className="text-sm">
              Keywords in Magic: The Gathering are shorthand terms that represent complex rules. 
              Each keyword has a specific meaning that is defined in the comprehensive rules.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-300 mb-2">Why Learn Keywords?</h4>
            <p className="text-sm">
              Understanding keywords is essential for playing Magic effectively. 
              They appear on thousands of cards and knowing their meanings helps 
              you understand card interactions and build better decks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeywordGlossary;