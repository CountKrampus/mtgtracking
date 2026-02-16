import React, { useState, useEffect } from 'react';
import { Package, Plus, Shuffle, Play, RotateCcw, Download, Upload, Search, Filter, Trophy, Zap, Star, Users, Pause, Volume2, VolumeX, Gamepad2, Heart, RefreshCw } from 'lucide-react';

const SealedSimulator = () => {
  const [sets, setSets] = useState([
    { id: 'lea', name: 'Alpha', releaseDate: '1993-08-05', cardCount: 295, type: 'Core Set' },
    { id: 'leb', name: 'Beta', releaseDate: '1993-10-04', cardCount: 302, type: 'Core Set' },
    { id: '2ed', name: 'Unlimited', releaseDate: '1993-12-14', cardCount: 302, type: 'Core Set' },
    { id: '3ed', name: 'Revised', releaseDate: '1994-04-01', cardCount: 306, type: 'Core Set' },
    { id: '4ed', name: 'Fourth Edition', releaseDate: '1995-04-01', cardCount: 379, type: 'Core Set' },
    { id: '5ed', name: 'Fifth Edition', releaseDate: '1997-03-21', cardCount: 460, type: 'Core Set' },
    { id: '6ed', name: 'Classic Sixth Edition', releaseDate: '1999-04-21', cardCount: 442, type: 'Core Set' },
    { id: '7ed', name: 'Seventh Edition', releaseDate: '2001-04-11', cardCount: 357, type: 'Core Set' },
    { id: '8ed', name: 'Eighth Edition', releaseDate: '2003-07-28', cardCount: 350, type: 'Core Set' },
    { id: '9ed', name: 'Ninth Edition', releaseDate: '2005-07-29', cardCount: 355, type: 'Core Set' },
    { id: '10e', name: 'Tenth Edition', releaseDate: '2007-07-13', cardCount: 455, type: 'Core Set' },
    { id: 'm10', name: 'Magic 2010', releaseDate: '2009-07-17', cardCount: 249, type: 'Core Set' },
    { id: 'm11', name: 'Magic 2011', releaseDate: '2010-07-16', cardCount: 249, type: 'Core Set' },
    { id: 'm12', name: 'Magic 2012', releaseDate: '2011-07-15', cardCount: 249, type: 'Core Set' },
    { id: 'm13', name: 'Magic 2013', releaseDate: '2012-07-13', cardCount: 249, type: 'Core Set' },
    { id: 'm14', name: 'Magic 2014', releaseDate: '2013-07-19', cardCount: 249, type: 'Core Set' },
    { id: 'm15', name: 'Magic Origins', releaseDate: '2015-07-17', cardCount: 264, type: 'Core Set' },
    { id: 'ori', name: 'Oath of the Gatewatch', releaseDate: '2016-01-22', cardCount: 274, type: 'Expansion' },
    { id: 'bfz', name: 'Battle for Zendikar', releaseDate: '2015-10-02', cardCount: 264, type: 'Expansion' },
    { id: 'soi', name: 'Shadows over Innistrad', releaseDate: '2016-04-08', cardCount: 248, type: 'Expansion' },
    { id: 'emn', name: 'Eldritch Moon', releaseDate: '2016-07-22', cardCount: 199, type: 'Expansion' },
    { id: 'ktk', name: 'Khans of Tarkir', releaseDate: '2014-09-26', cardCount: 264, type: 'Expansion' },
    { id: 'frf', name: 'Fate Reforged', releaseDate: '2015-01-23', cardCount: 165, type: 'Expansion' },
    { id: 'dtk', name: 'Dragons of Tarkir', releaseDate: '2015-03-27', cardCount: 221, type: 'Expansion' },
    { id: 'zen', name: 'Zendikar', releaseDate: '2009-10-02', cardCount: 248, type: 'Expansion' },
    { id: 'wwk', name: 'Worldwake', releaseDate: '2010-02-05', cardCount: 145, type: 'Expansion' },
    { id: 'roe', name: 'Rise of the Eldrazi', releaseDate: '2010-04-23', cardCount: 155, type: 'Expansion' },
    { id: 'mrd', name: 'Mirrodin', releaseDate: '2003-10-02', cardCount: 306, type: 'Expansion' },
    { id: 'dst', name: 'Darksteel', releaseDate: '2004-02-06', cardCount: 165, type: 'Expansion' },
    { id: '5dn', name: 'Fifth Dawn', releaseDate: '2004-06-04', cardCount: 165, type: 'Expansion' },
    { id: 'chk', name: 'Champions of Kamigawa', releaseDate: '2004-10-01', cardCount: 307, type: 'Expansion' },
    { id: 'bok', name: 'Betrayers of Kamigawa', releaseDate: '2005-02-04', cardCount: 165, type: 'Expansion' },
    { id: 'sok', name: 'Saviors of Kamigawa', releaseDate: '2005-06-03', cardCount: 165, type: 'Expansion' },
    { id: 'rav', name: 'Ravnica: City of Guilds', releaseDate: '2005-10-07', cardCount: 306, type: 'Expansion' },
    { id: 'gpt', name: 'Guildpact', releaseDate: '2006-02-03', cardCount: 165, type: 'Expansion' },
    { id: 'dis', name: 'Dissension', releaseDate: '2006-05-05', cardCount: 180, type: 'Expansion' },
    { id: 'ts', name: 'Time Spiral', releaseDate: '2006-10-06', cardCount: 301, type: 'Expansion' },
    { id: 'plc', name: 'Planar Chaos', releaseDate: '2007-02-02', cardCount: 165, type: 'Expansion' },
    { id: 'fut', name: 'Future Sight', releaseDate: '2007-05-04', cardCount: 165, type: 'Expansion' },
    { id: 'lrw', name: 'Lorwyn', releaseDate: '2007-10-12', cardCount: 301, type: 'Expansion' },
    { id: 'mor', name: 'Morningtide', releaseDate: '2008-02-01', cardCount: 180, type: 'Expansion' },
    { id: 'shm', name: 'Shadowmoor', releaseDate: '2008-06-06', cardCount: 301, type: 'Expansion' },
    { id: 'eve', name: 'Eventide', releaseDate: '2008-07-25', cardCount: 180, type: 'Expansion' },
    { id: 'ala', name: 'Shards of Alara', releaseDate: '2008-10-03', cardCount: 249, type: 'Expansion' },
    { id: 'con', name: 'Conflux', releaseDate: '2009-02-06', cardCount: 145, type: 'Expansion' },
    { id: 'arb', name: 'Alara Reborn', releaseDate: '2009-04-03', cardCount: 145, type: 'Expansion' },
    { id: 'zen', name: 'Zendikar', releaseDate: '2009-10-02', cardCount: 248, type: 'Expansion' },
    { id: 'wwk', name: 'Worldwake', releaseDate: '2010-02-05', cardCount: 145, type: 'Expansion' },
    { id: 'roe', name: 'Rise of the Eldrazi', releaseDate: '2010-04-23', cardCount: 155, type: 'Expansion' },
    { id: 'som', name: 'Scars of Mirrodin', releaseDate: '2010-10-01', cardCount: 249, type: 'Expansion' },
    { id: 'mbs', name: 'Mirrodin Besieged', releaseDate: '2011-02-04', cardCount: 155, type: 'Expansion' },
    { id: 'nph', name: 'New Phyrexia', releaseDate: '2011-05-13', cardCount: 155, type: 'Expansion' },
    { id: 'm11', name: 'Magic 2011', releaseDate: '2010-07-16', cardCount: 249, type: 'Core Set' },
    { id: 'm12', name: 'Magic 2012', releaseDate: '2011-07-15', cardCount: 249, type: 'Core Set' },
    { id: 'm13', name: 'Magic 2013', releaseDate: '2012-07-13', cardCount: 249, type: 'Core Set' },
    { id: 'm14', name: 'Magic 2014', releaseDate: '2013-07-19', cardCount: 249, type: 'Core Set' },
    { id: 'm15', name: 'Magic Origins', releaseDate: '2015-07-17', cardCount: 264, type: 'Core Set' },
    { id: 'ori', name: 'Oath of the Gatewatch', releaseDate: '2016-01-22', cardCount: 274, type: 'Expansion' },
    { id: 'bfz', name: 'Battle for Zendikar', releaseDate: '2015-10-02', cardCount: 264, type: 'Expansion' },
    { id: 'ogw', name: 'Oath of the Gatewatch', releaseDate: '2016-03-18', cardCount: 184, type: 'Expansion' },
    { id: 'soi', name: 'Shadows over Innistrad', releaseDate: '2016-04-08', cardCount: 248, type: 'Expansion' },
    { id: 'emn', name: 'Eldritch Moon', releaseDate: '2016-07-22', cardCount: 199, type: 'Expansion' },
    { id: 'kld', name: 'Kaladesh', releaseDate: '2016-09-30', cardCount: 264, type: 'Expansion' },
    { id: 'aer', name: 'Aether Revolt', releaseDate: '2017-01-20', cardCount: 184, type: 'Expansion' },
    { id: 'akh', name: 'Amonkhet', releaseDate: '2017-04-28', cardCount: 274, type: 'Expansion' },
    { id: 'hou', name: 'Hour of Devastation', releaseDate: '2017-07-14', cardCount: 199, type: 'Expansion' },
    { id: 'xln', name: 'Ixalan', releaseDate: '2017-09-29', cardCount: 279, type: 'Expansion' },
    { id: 'rix', name: 'Rivals of Ixalan', releaseDate: '2018-01-19', cardCount: 196, type: 'Expansion' },
    { id: 'dom', name: 'Dominaria', releaseDate: '2018-04-27', cardCount: 280, type: 'Expansion' },
    { id: 'm19', name: 'Core Set 2019', releaseDate: '2018-07-13', cardCount: 280, type: 'Core Set' },
    { id: 'grn', name: 'Guilds of Ravnica', releaseDate: '2018-10-05', cardCount: 259, type: 'Expansion' },
    { id: 'rna', name: 'Ravnica Allegiance', releaseDate: '2019-01-25', cardCount: 259, type: 'Expansion' },
    { id: 'war', name: 'War of the Spark', releaseDate: '2019-05-03', cardCount: 269, type: 'Expansion' },
    { id: 'm20', name: 'Core Set 2020', releaseDate: '2019-07-12', cardCount: 248, type: 'Core Set' },
    { id: 'eld', name: 'Throne of Eldraine', releaseDate: '2019-10-04', cardCount: 269, type: 'Expansion' },
    { id: 'thb', name: 'Theros Beyond Death', releaseDate: '2020-01-24', cardCount: 254, type: 'Expansion' },
    { id: 'iko', name: 'Ikoria: Lair of Behemoths', releaseDate: '2020-04-24', cardCount: 280, type: 'Expansion' },
    { id: 'm21', name: 'Core Set 2021', releaseDate: '2020-07-03', cardCount: 269, type: 'Core Set' },
    { id: 'znr', name: 'Zendikar Rising', releaseDate: '2020-09-25', cardCount: 280, type: 'Expansion' },
    { id: 'khm', name: 'Kaldheim', releaseDate: '2021-02-05', cardCount: 280, type: 'Expansion' },
    { id: 'stx', name: 'Strixhaven: School of Mages', releaseDate: '2021-04-23', cardCount: 280, type: 'Expansion' },
    { id: 'afc', name: 'Adventures in the Forgotten Realms', releaseDate: '2021-07-23', cardCount: 280, type: 'Expansion' },
    { id: 'mid', name: 'Innistrad: Midnight Hunt', releaseDate: '2021-09-24', cardCount: 280, type: 'Expansion' },
    { id: 'vow', name: 'Innistrad: Crimson Vow', releaseDate: '2021-11-19', cardCount: 280, type: 'Expansion' },
    { id: 'neo', name: 'Kamigawa: Neon Dynasty', releaseDate: '2022-02-18', cardCount: 280, type: 'Expansion' },
    { id: 'snc', name: 'Streets of New Capenna', releaseDate: '2022-04-29', cardCount: 280, type: 'Expansion' },
    { id: 'dmu', name: 'Dominaria United', releaseDate: '2022-09-09', cardCount: 280, type: 'Expansion' },
    { id: 'bro', name: 'The Brothers` War', releaseDate: '2022-11-18', cardCount: 280, type: 'Expansion' },
    { id: 'mom', name: 'March of the Machine', releaseDate: '2023-04-21', cardCount: 280, type: 'Expansion' },
    { id: 'mom', name: 'March of the Machine: The Aftermath', releaseDate: '2023-05-05', cardCount: 71, type: 'Expansion' },
    { id: 'woe', name: 'Wilds of Eldraine', releaseDate: '2023-09-08', cardCount: 280, type: 'Expansion' },
    { id: 'lci', name: 'The Lost Caverns of Ixalan', releaseDate: '2023-11-17', cardCount: 280, type: 'Expansion' },
    { id: 'otj', name: 'Outlaws of Thunder Junction', releaseDate: '2024-04-19', cardCount: 280, type: 'Expansion' },
    { id: 'mat', name: 'March of the Machine: Aftermath', releaseDate: '2023-05-05', cardCount: 71, type: 'Expansion' }
  ]);

  const [selectedSet, setSelectedSet] = useState(null);
  const [sealedPool, setSealedPool] = useState([]);
  const [deck, setDeck] = useState([]);
  const [sideboard, setSideboard] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [gamePhase, setGamePhase] = useState('setup'); // setup, sealed, deckbuilding, playtest
  const [numBoosters, setNumBoosters] = useState(6);
  const [packsOpened, setPacksOpened] = useState([]);
  const [gameLog, setGameLog] = useState([]);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Mock card database for each set
  const mockCards = {
    lea: [
      { id: 1, name: 'Black Lotus', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Colorless', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Sacred white lotus that can tap for 3 mana of any one color.' },
      { id: 2, name: 'Ancestral Recall', set: 'LEA', cmc: 0, type: 'Instant', color: 'Blue', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Target player draws three cards.' },
      { id: 3, name: 'Time Walk', set: 'LEA', cmc: 0, type: 'Sorcery', color: 'Green', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Take an extra turn after this one.' },
      { id: 4, name: 'Mox Pearl', set: 'LEA', cmc: 0, type: 'Artifact', color: 'White', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Tap for W.' },
      { id: 5, name: 'Mox Sapphire', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Blue', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Tap for U.' },
      { id: 6, name: 'Mox Jet', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Black', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Tap for B.' },
      { id: 7, name: 'Mox Ruby', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Red', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Tap for R.' },
      { id: 8, name: 'Mox Emerald', set: 'LEA', cmc: 0, type: 'Artifact', color: 'Green', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: 'Tap for G.' },
      { id: 9, name: 'Ankh of Mishra', set: 'LEA', cmc: 2, type: 'Artifact', color: 'Colorless', rarity: 'Rare', power: null, toughness: null, imageUrl: '', description: 'At the beginning of each player\'s upkeep, that player loses 2 life unless he or she controls a Desert.' },
      { id: 10, name: 'Serra Angel', set: 'LEA', cmc: 6, type: 'Creature', color: 'White', rarity: 'Uncommon', power: 4, toughness: 4, imageUrl: '', description: 'Flying, vigilance, lifelink.' }
    ],
    ktk: [
      { id: 11, name: 'Abzan Falconer', set: 'KTK', cmc: 3, type: 'Creature', color: 'White', rarity: 'Uncommon', power: 2, toughness: 3, imageUrl: '', description: 'When Abzan Falconer enters the battlefield, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' },
      { id: 12, name: 'Ainok Bond-Kin', set: 'KTK', cmc: 2, type: 'Creature', color: 'Green', rarity: 'Common', power: 2, toughness: 2, imageUrl: '', description: 'When Ainok Bond-Kin enters the battlefield, you may have target player create a 1/1 green Elephant creature token.' },
      { id: 13, name: 'Altar of the Brood', set: 'KTK', cmc: 3, type: 'Artifact', color: 'Colorless', rarity: 'Rare', power: null, toughness: null, imageUrl: '', description: 'Sacrifice a creature: Create a 1/1 colorless Germ creature token.' },
      { id: 14, name: 'Ankle Shanker', set: 'KTK', cmc: 1, type: 'Creature', color: 'Black', rarity: 'Common', power: 1, toughness: 1, imageUrl: '', description: 'Menace (This creature can\'t be blocked except by two or more creatures.)' },
      { id: 15, name: 'Arashin Foremost', set: 'KTK', cmc: 4, type: 'Creature', color: 'White', rarity: 'Uncommon', power: 4, toughness: 4, imageUrl: '', description: 'When Arashin Foremost enters the battlefield, you may have it fight another target creature.' },
      { id: 16, name: 'Arrow Storm', set: 'KTK', cmc: 3, type: 'Sorcery', color: 'Red', rarity: 'Uncommon', power: null, toughness: null, imageUrl: '', description: 'Arrow Storm deals 1 damage to each creature and each player.' },
      { id: 17, name: 'Avalanche Tusker', set: 'KTK', cmc: 6, type: 'Creature', color: 'Green', rarity: 'Uncommon', power: 5, toughness: 5, imageUrl: '', description: 'Trample, haste. When Avalanche Tusker dies, create a 3/3 green Elephant creature token.' },
      { id: 18, name: 'Barrage of Boulders', set: 'KTK', cmc: 4, type: 'Sorcery', color: 'Red', rarity: 'Common', power: null, toughness: null, imageUrl: '', description: 'Barrage of Boulders deals 5 damage to target creature or player. If a land was sacrificed this turn, it deals 10 damage instead.' },
      { id: 19, name: 'Bloodsoaked Champion', set: 'KTK', cmc: 3, type: 'Creature', color: 'Black', rarity: 'Uncommon', power: 2, toughness: 2, imageUrl: '', description: 'Menace. When Bloodsoaked Champion dies, create a 2/2 black Zombie creature token.' },
      { id: 20, name: 'Chief of the Edge', set: 'KTK', cmc: 2, type: 'Creature', color: 'Red', rarity: 'Uncommon', power: 2, toughness: 1, imageUrl: '', description: 'Other red creatures you control get +1/+0. {T}: Target red creature you control gains first strike until end of turn.' }
    ],
    dm: [
      { id: 21, name: 'Anje, Maid of Dishonor', set: 'DM', cmc: 3, type: 'Legendary Creature', color: 'Black', rarity: 'Mythic', power: 2, toughness: 3, imageUrl: '', description: 'When Anje, Maid of Dishonor enters the battlefield, create a Treasure token. When Anje dies, each opponent loses 2 life.' },
      { id: 22, name: 'Kaervek, the Spiteful', set: 'DM', cmc: 4, type: 'Legendary Creature', color: 'Red', rarity: 'Mythic', power: 4, toughness: 4, imageUrl: '', description: 'First strike. At the beginning of your upkeep, Kaervek, the Spiteful deals 1 damage to each opponent.' },
      { id: 23, name: 'Jaya, Journeying Planner', set: 'DM', cmc: 3, type: 'Legendary Planeswalker', color: 'Red', rarity: 'Mythic', power: null, toughness: null, imageUrl: '', description: '+1: Create a Treasure token. -2: Jaya, Journeying Planner deals 2 damage to any target. -7: Search your library for any number of instant and sorcery cards with the same name, put them into your hand, then shuffle.' },
      { id: 24, name: 'Jodah, Eternal Archmage', set: 'DM', cmc: 5, type: 'Legendary Creature', color: 'Multicolor', rarity: 'Mythic', power: 3, toughness: 5, imageUrl: '', description: 'Jodah, Eternal Archmage costs {2} less to cast for each color of mana spent on it. Flying, hexproof. {T}: Add one mana of any color.' },
      { id: 25, name: 'Serra, Martyr to Faith', set: 'DM', cmc: 5, type: 'Legendary Creature', color: 'White', rarity: 'Mythic', power: 4, toughness: 6, imageUrl: '', description: 'Flying, vigilance, lifelink. When Serra, Martyr to Faith enters the battlefield, create three 1/1 white Soldier creature tokens.' },
      { id: 26, name: 'Tivit, Seller of Secrets', set: 'DM', cmc: 2, type: 'Legendary Creature', color: 'Blue', rarity: 'Rare', power: 1, toughness: 3, imageUrl: '', description: 'When Tivit, Seller of Secrets enters the battlefield, draw a card. {2}, {T}, Sacrifice Tivit: Create a Treasure token.' },
      { id: 27, name: 'Zur, Eternal Schemer', set: 'DM', cmc: 4, type: 'Legendary Creature', color: 'Multicolor', rarity: 'Mythic', power: 2, toughness: 4, imageUrl: '', description: 'Flying. {T}, Pay 2 life: Search your library for a card named Zur the Enchanter, reveal it, and put it into your hand. Then shuffle.' },
      { id: 28, name: 'Chainer, Dementia Master', set: 'DM', cmc: 6, type: 'Legendary Creature', color: 'Black', rarity: 'Mythic', power: 6, toughness: 5, imageUrl: '', description: 'When Chainer, Dementia Master enters the battlefield, target player draws three cards, then discards two cards at random. {2}, {T}, Sacrifice a creature: Target player discards a card at random.' },
      { id: 29, name: 'Gerrard, Weatherlight Hero', set: 'DM', cmc: 5, type: 'Legendary Creature', color: 'Multicolor', rarity: 'Mythic', power: 4, toughness: 5, imageUrl: '', description: 'Vigilance, first strike. When Gerrard, Weatherlight Hero enters the battlefield, create a 2/2 white Knight creature token with vigilance.' },
      { id: 30, name: 'Sisay, Weatherlight Captain', set: 'DM', cmc: 3, type: 'Legendary Creature', color: 'Multicolor', rarity: 'Mythic', power: 2, toughness: 3, imageUrl: '', description: '{T}, Sacrifice a legendary permanent: Search your library for a legendary permanent card, put it into your hand, then shuffle.' }
    ]
  };

  // Timer effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(timer => timer + 1);
      }, 1000);
    } else if (!isTimerRunning) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addToGameLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLog(prev => [{ time: timestamp, message }, ...prev.slice(0, 15)]);
  };

  const openBoosterPack = (setCode) => {
    const setCards = mockCards[setCode] || [];
    if (setCards.length === 0) return [];

    // Standard booster pack: 10 commons, 3 uncommons, 1 rare/mythic, 1 basic land
    const pack = [];
    
    // Add 10 commons
    const commons = setCards.filter(c => c.rarity === 'Common');
    for (let i = 0; i < 10 && commons.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * commons.length);
      pack.push({...commons[randomIndex], packId: Date.now() + i});
    }
    
    // Add 3 uncommons
    const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
    for (let i = 0; i < 3 && uncommons.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * uncommons.length);
      pack.push({...uncommons[randomIndex], packId: Date.now() + i + 10});
    }
    
    // Add 1 rare/mythic (75% rare, 25% mythic)
    const rares = setCards.filter(c => c.rarity === 'Rare');
    const mythics = setCards.filter(c => c.rarity === 'Mythic');
    const isMythic = Math.random() < 0.25 && mythics.length > 0;
    
    if (isMythic) {
      const randomIndex = Math.floor(Math.random() * mythics.length);
      pack.push({...mythics[randomIndex], packId: Date.now() + 13});
    } else if (rares.length > 0) {
      const randomIndex = Math.floor(Math.random() * rares.length);
      pack.push({...rares[randomIndex], packId: Date.now() + 13});
    }
    
    // Add 1 basic land
    const basicLands = [
      { id: Date.now() + 14, name: 'Plains', set: setCode, cmc: 0, type: 'Land', color: 'White', rarity: 'Basic', power: null, toughness: null, imageUrl: '', description: 'Produces W.', packId: Date.now() + 14 },
      { id: Date.now() + 15, name: 'Island', set: setCode, cmc: 0, type: 'Land', color: 'Blue', rarity: 'Basic', power: null, toughness: null, imageUrl: '', description: 'Produces U.', packId: Date.now() + 15 },
      { id: Date.now() + 16, name: 'Swamp', set: setCode, cmc: 0, type: 'Land', color: 'Black', rarity: 'Basic', power: null, toughness: null, imageUrl: '', description: 'Produces B.', packId: Date.now() + 16 },
      { id: Date.now() + 17, name: 'Mountain', set: setCode, cmc: 0, type: 'Land', color: 'Red', rarity: 'Basic', power: null, toughness: null, imageUrl: '', description: 'Produces R.', packId: Date.now() + 17 },
      { id: Date.now() + 18, name: 'Forest', set: setCode, cmc: 0, type: 'Land', color: 'Green', rarity: 'Basic', power: null, toughness: null, imageUrl: '', description: 'Produces G.', packId: Date.now() + 18 }
    ];
    const randomLand = basicLands[Math.floor(Math.random() * basicLands.length)];
    pack.push(randomLand);
    
    return pack;
  };

  const simulateSealed = (setCode, numPacks) => {
    const allCards = [];
    const newPacks = [];
    
    for (let i = 0; i < numPacks; i++) {
      const pack = openBoosterPack(setCode);
      allCards.push(...pack);
      newPacks.push({ id: i + 1, cards: pack });
    }
    
    setSealedPool(allCards);
    setPacksOpened(newPacks);
    setSelectedSet(sets.find(s => s.id === setCode));
    addToGameLog(`Opened ${numPacks} packs of ${sets.find(s => s.id === setCode)?.name}`);
  };

  const startSealed = () => {
    if (!selectedSet) return;
    simulateSealed(selectedSet.id, numBoosters);
    setGamePhase('sealed');
    setIsTimerRunning(true);
    addToGameLog(`Started sealed with ${numBoosters} packs of ${selectedSet.name}`);
  };

  const addToDeck = (card) => {
    if (deck.length < 40) { // Sealed decks are minimum 40 cards
      setDeck([...deck, card]);
      setSealedPool(sealedPool.filter(c => c.packId !== card.packId || c.id !== card.id));
      addToGameLog(`Added ${card.name} to deck`);
    } else {
      alert('Sealed decks must have at least 40 cards but no more than 60 in regular play. This is a simulation.');
    }
  };

  const removeFromDeck = (cardId) => {
    const card = deck.find(c => c.id === cardId);
    if (card) {
      setDeck(deck.filter(c => c.id !== cardId));
      setSealedPool([...sealedPool, card]);
      addToGameLog(`Removed ${card.name} from deck`);
    }
  };

  const addToSideboard = (card) => {
    setSideboard([...sideboard, card]);
    setSealedPool(sealedPool.filter(c => c.packId !== card.packId || c.id !== card.id));
    addToGameLog(`Added ${card.name} to sideboard`);
  };

  const removeFromSideboard = (cardId) => {
    const card = sideboard.find(c => c.id === cardId);
    if (card) {
      setSideboard(sideboard.filter(c => c.id !== cardId));
      setSealedPool([...sealedPool, card]);
      addToGameLog(`Removed ${card.name} from sideboard`);
    }
  };

  const startDeckBuilding = () => {
    setGamePhase('deckbuilding');
    addToGameLog('Entered deck building phase');
  };

  const startPlaytest = () => {
    if (deck.length < 40) {
      alert('Your deck needs at least 40 cards to playtest!');
      return;
    }
    setGamePhase('playtest');
    addToGameLog('Started playtesting your sealed deck');
  };

  const endPlaytest = () => {
    setGamePhase('deckbuilding');
    addToGameLog('Ended playtest session');
  };

  const resetGame = () => {
    setSealedPool([]);
    setDeck([]);
    setSideboard([]);
    setSelectedSet(null);
    setGamePhase('setup');
    setPacksOpened([]);
    setGameLog([]);
    setTimer(0);
    setIsTimerRunning(false);
    addToGameLog('Game reset to initial state');
  };

  const getRarityColor = (rarity) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'text-gray-400';
      case 'uncommon': return 'text-green-400';
      case 'rare': return 'text-blue-400';
      case 'mythic': return 'text-orange-400';
      case 'basic': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const filteredSets = sets.filter(set =>
    set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    set.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    set.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCards = sealedPool.filter(card => {
    const matchesRarity = filterRarity === 'all' || card.rarity === filterRarity;
    const matchesType = filterType === 'all' || card.type.includes(filterType);
    return matchesRarity && matchesType;
  });

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Sealed Simulator</h1>
        <p className="text-gray-400">
          Open virtual booster packs from any set and build a sealed deck
        </p>
      </div>

      {/* Game Status Bar */}
      <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                gamePhase === 'setup' ? 'bg-gray-500' : 
                gamePhase === 'sealed' ? 'bg-blue-500' : 
                gamePhase === 'deckbuilding' ? 'bg-purple-500' : 
                'bg-green-500'
              }`}></div>
              <span className="text-white font-medium capitalize">{gamePhase}</span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-300">
              <Play size={16} />
              <span>Time: {formatTime(timer)}</span>
            </div>
            
            {selectedSet && (
              <div className="flex items-center gap-2 text-purple-300">
                <Package size={16} />
                <span>{selectedSet.name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white"
            >
              {isTimerRunning ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={resetGame}
              className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {gamePhase === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Select Set</h2>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search sets..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-300 text-sm">Boosters:</label>
                    <input
                      type="number"
                      value={numBoosters}
                      onChange={(e) => setNumBoosters(parseInt(e.target.value) || 6)}
                      min="3"
                      max="12"
                      className="w-16 px-2 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  
                  <button
                    onClick={startSealed}
                    disabled={!selectedSet}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap size={20} />
                    Start Sealed
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSets.map(set => (
                  <div 
                    key={set.id} 
                    className={`bg-white/5 rounded-lg p-4 border cursor-pointer transition ${
                      selectedSet?.id === set.id
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/10 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedSet(set)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{set.name}</h3>
                      <span className="text-xs text-gray-400">{set.releaseDate}</span>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-400">
                      <div>ID: {set.id.toUpperCase()}</div>
                      <div>Type: {set.type}</div>
                      <div>Cards: {set.cardCount}</div>
                    </div>
                    
                    {selectedSet?.id === set.id && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-green-400 flex items-center gap-1">
                          <Star size={12} />
                          Selected
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
            
            <div className="space-y-4 text-gray-300">
              <div className="p-3 bg-white/5 rounded-lg">
                <h3 className="font-medium text-white mb-1">1. Select Set</h3>
                <p className="text-sm">Choose a Magic set to simulate sealed with</p>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <h3 className="font-medium text-white mb-1">2. Choose Boosters</h3>
                <p className="text-sm">Select how many booster packs to open (default 6)</p>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <h3 className="font-medium text-white mb-1">3. Open Packs</h3>
                <p className="text-sm">Click "Start Sealed" to open your booster packs</p>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <h3 className="font-medium text-white mb-1">4. Build Deck</h3>
                <p className="text-sm">Construct a 40+ card deck from your pool</p>
              </div>
              
              <div className="p-3 bg-white/5 rounded-lg">
                <h3 className="font-medium text-white mb-1">5. Playtest</h3>
                <p className="text-sm">Test your deck against simulated opponents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(gamePhase === 'sealed' || gamePhase === 'deckbuilding') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {selectedSet?.name} Sealed Pool
                </h2>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-blue-600/20 text-blue-300 rounded-full text-sm">
                    {sealedPool.length} cards
                  </span>
                  {gamePhase === 'sealed' && (
                    <button
                      onClick={startDeckBuilding}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                    >
                      Build Deck
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search cards..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <select
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Rarities</option>
                  <option value="Common">Common</option>
                  <option value="Uncommon">Uncommon</option>
                  <option value="Rare">Rare</option>
                  <option value="Mythic">Mythic</option>
                  <option value="Basic">Basic</option>
                </select>
                
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Types</option>
                  <option value="Creature">Creatures</option>
                  <option value="Instant">Instants</option>
                  <option value="Sorcery">Sorceries</option>
                  <option value="Artifact">Artifacts</option>
                  <option value="Enchantment">Enchantments</option>
                  <option value="Land">Lands</option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {filteredCards.map(card => (
                  <div 
                    key={`${card.packId}-${card.id}`} 
                    className="bg-white/10 rounded-lg p-3 border border-white/20 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-white text-xs leading-tight truncate">{card.name}</h4>
                      <span className={`text-xs ${getRarityColor(card.rarity)}`}>
                        {card.rarity.charAt(0)}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-xs text-gray-400 mb-2">
                      <div className="truncate">{card.type}</div>
                      <div>{card.color}</div>
                      {card.power && card.toughness && (
                        <div className="text-green-400">{card.power}/{card.toughness}</div>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => addToDeck(card)}
                        className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition text-xs"
                      >
                        Deck
                      </button>
                      <button
                        onClick={() => addToSideboard(card)}
                        className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition text-xs"
                      >
                        SB
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredCards.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="mx-auto h-12 w-12 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No cards found</h3>
                  <p>Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
            
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Packs Opened</h3>
              
              <div className="space-y-2">
                {packsOpened.map(pack => (
                  <div key={pack.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">Pack {pack.id}</span>
                      <span className="text-xs text-gray-400">{pack.cards.length} cards</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {pack.cards.slice(0, 3).map(card => card.name).join(', ')}
                      {pack.cards.length > 3 && '...'}
                    </div>
                  </div>
                ))}
                
                {packsOpened.length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">No packs opened yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Deck Building</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Main Deck</h4>
                    <span className="text-sm text-gray-400">{deck.length}/40+</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 min-h-32 max-h-40 overflow-y-auto border border-white/10">
                    {deck.length === 0 ? (
                      <p className="text-gray-500 text-center py-4 text-sm">Empty deck</p>
                    ) : (
                      deck.slice(0, 10).map((card, index) => (
                        <div key={`${card.packId}-${card.id}-${index}`} className="flex justify-between items-center py-1 border-b border-white/10 last:border-b-0">
                          <span className="text-sm text-white truncate flex-1 mr-2">{card.name}</span>
                          <button
                            onClick={() => removeFromDeck(card.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                    {deck.length > 10 && (
                      <p className="text-xs text-gray-500 text-center mt-2">+{deck.length - 10} more</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Sideboard</h4>
                    <span className="text-sm text-gray-400">{sideboard.length}</span>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 min-h-24 max-h-32 overflow-y-auto border border-white/10">
                    {sideboard.length === 0 ? (
                      <p className="text-gray-500 text-center py-2 text-sm">Empty sideboard</p>
                    ) : (
                      sideboard.slice(0, 8).map((card, index) => (
                        <div key={`${card.packId}-${card.id}-${index}`} className="flex justify-between items-center py-1 border-b border-white/10 last:border-b-0">
                          <span className="text-sm text-white truncate flex-1 mr-2">{card.name}</span>
                          <button
                            onClick={() => removeFromSideboard(card.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                    {sideboard.length > 8 && (
                      <p className="text-xs text-gray-500 text-center mt-2">+{sideboard.length - 8} more</p>
                    )}
                  </div>
                </div>
                
                {deck.length >= 40 && gamePhase === 'deckbuilding' && (
                  <button
                    onClick={startPlaytest}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                  >
                    <Play size={20} />
                    Start Playtest
                  </button>
                )}
              </div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Deck Stats</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Cards:</span>
                  <span className="text-white">{deck.length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Lands:</span>
                  <span className="text-white">{deck.filter(c => c.type.includes('Land')).length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Creatures:</span>
                  <span className="text-white">{deck.filter(c => c.type.includes('Creature')).length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Spells:</span>
                  <span className="text-white">{deck.filter(c => c.type.includes('Instant') || c.type.includes('Sorcery')).length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. CMC:</span>
                  <span className="text-white">
                    {deck.length > 0 
                      ? (deck.reduce((sum, c) => sum + (c.cmc || 0), 0) / deck.length).toFixed(1) 
                      : '0.0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {gamePhase === 'playtest' && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Deck Playtest</h2>
            <button
              onClick={endPlaytest}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
            >
              End Playtest
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Your Deck</h3>
              
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white">Deck Size: {deck.length} cards</span>
                  <span className="text-purple-300">40+ required</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {deck.map((card, index) => (
                    <div key={index} className="p-2 bg-white/10 rounded border border-white/20">
                      <div className="font-medium text-white text-sm">{card.name}</div>
                      <div className="text-xs text-gray-400">{card.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Playtest Simulation</h3>
              
              <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
                <h4 className="font-medium text-white mb-2">Virtual Opponent</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Opponent Type:</span>
                    <span className="text-white">Random AI</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Game Length:</span>
                    <span className="text-white">Simulated</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Wins:</span>
                    <span className="text-white">0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Losses:</span>
                    <span className="text-white">0</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  Simulate Single Game
                </button>
                <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition">
                  Simulate 10 Games
                </button>
                <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                  Simulate Tournament (3-5 games)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white/5 rounded-lg p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Game Log</h3>
        
        <div className="max-h-40 overflow-y-auto space-y-2">
          {gameLog.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No events yet</p>
          ) : (
            gameLog.map((entry, index) => (
              <div key={index} className="p-2 bg-white/5 rounded border border-white/10 text-sm">
                <span className="text-gray-400 mr-2">[{entry.time}]</span>
                <span className="text-white">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">About Sealed Format</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Sealed is a Magic: The Gathering format where players receive a fixed number of booster packs 
              (typically 6) and must build a 40-card minimum deck from the cards they open.
            </p>
            <p>
              Unlike draft, sealed doesn't involve passing cards between players. Each player keeps all 
              the cards they open and builds their deck from that pool.
            </p>
            <p>
              This simulator allows you to experience sealed format with any set in Magic history, 
              perfect for practicing deck building skills or testing new strategies.
            </p>
          </div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Sealed Strategy Tips</h3>
          <div className="space-y-3 text-gray-300">
            <ul className="list-disc list-inside space-y-2">
              <li>Focus on a 2-color deck when possible for consistency</li>
              <li>Don't be afraid to play 17+ lands if your deck is mana-hungry</li>
              <li>Look for synergistic cards that work well together</li>
              <li>Consider your curve carefully - you need early, mid, and late game plays</li>
              <li>Play the best removal spells you have, even if they're not in your colors</li>
              <li>Adjust your expectations - sealed decks are typically weaker than constructed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SealedSimulator;