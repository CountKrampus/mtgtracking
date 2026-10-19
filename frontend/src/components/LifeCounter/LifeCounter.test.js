import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import LifeCounter from './LifeCounter';
import {
  gameReducer,
  ACTIONS,
  createDefaultPlayer,
  migrateCounters
} from './hooks/useGameState';

global.IS_REACT_ACT_ENVIRONMENT = true;

// axios ships untranspiled ESM that CRA's jest transform ignores, so mock it
// with a factory instead of automocking (which would load the real module).
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() }
}));

const AUTO_SAVE_KEY = 'mtg-life-counter';
const LINEUPS_KEY = 'mtg-life-counter-lineups';

const findButton = (scope, label) =>
  [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === label);

// The ±1 life buttons are icon-only (Plus/Minus lucide icons) — find by aria-label
const findButtonByAria = (scope, label) =>
  [...scope.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label);

const click = async (el) => {
  await act(async () => { Simulate.click(el); });
};
const pointerDown = async (el) => {
  await act(async () => { Simulate.pointerDown(el); });
};
const pointerUp = async (el) => {
  await act(async () => { Simulate.pointerUp(el); });
};
const change = async (el, value) => {
  await act(async () => { Simulate.change(el, { target: { value } }); });
};

const lifeOf = (id) =>
  document.querySelector(`[data-testid="life-total-${id}"]`).textContent.trim();
const cardOf = (id) => document.querySelector(`[data-testid="player-card-${id}"]`);

// CRA's jest config sets resetMocks: true, which clears jest.fn
// implementations before every test — so these must be (re)installed in
// beforeEach, not beforeAll, or every test after the first runs against
// undefined-returning stubs.
const installStubs = () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve([]) })
  );

  // Minimal Web Audio API stub — jsdom has no AudioContext, and the sound
  // hook creates one lazily on first play.
  window.AudioContext = jest.fn(() => ({
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: jest.fn(),
    createOscillator: () => ({
      type: '',
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      frequency: { setValueAtTime: jest.fn() }
    }),
    createGain: () => ({
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      }
    })
  }));
};

let container = null;
let root = null;

const mount = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => {
    root.render(<LifeCounter onBack={jest.fn()} />);
  });
};

const startGame = async () => {
  await click(findButton(document, 'Start Game'));
};

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  localStorage.clear();
  jest.clearAllTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('useGameState reducer', () => {
  const fresh = () => ({
    players: [createDefaultPlayer(1, 'P1', 40)],
    gameFormat: 'commander'
  });

  test('REMOVE_COUNTER deletes a custom counter outright', () => {
    let state = fresh();
    state = gameReducer(state, {
      type: ACTIONS.CHANGE_COUNTER,
      payload: { playerId: 1, counterType: 'stun', amount: 3 }
    });
    expect(state.players[0].counters.custom.stun).toBe(3);

    state = gameReducer(state, {
      type: ACTIONS.REMOVE_COUNTER,
      payload: { playerId: 1, counterType: 'stun' }
    });
    // The old -9999 path dispatched a +0 change (a no-op after clamping),
    // so the counter survived removal — this is the regression guard.
    expect(state.players[0].counters.custom).not.toHaveProperty('stun');
  });

  test('radiation is handled as a named counter, not pushed into custom', () => {
    let state = fresh();
    state = gameReducer(state, {
      type: ACTIONS.CHANGE_COUNTER,
      payload: { playerId: 1, counterType: 'radiation', amount: 2 }
    });
    expect(state.players[0].counters.radiation).toBe(2);
    expect(state.players[0].counters.custom).not.toHaveProperty('radiation');
  });

  test('poison clamps to 0-10 and eliminates at 10', () => {
    let state = fresh();
    state = gameReducer(state, {
      type: ACTIONS.CHANGE_POISON,
      payload: { playerId: 1, amount: 15 }
    });
    expect(state.players[0].poison).toBe(10);
    expect(state.players[0].isEliminated).toBe(true);
    expect(state.players[0].eliminationReason).toBe('poison');

    let s2 = fresh();
    s2 = gameReducer(s2, {
      type: ACTIONS.CHANGE_POISON,
      payload: { playerId: 1, amount: -5 }
    });
    expect(s2.players[0].poison).toBe(0);
  });

  test('commander damage is real damage: it reduces life too', () => {
    let state = fresh();
    state = {
      ...state,
      players: [createDefaultPlayer(1, 'P1', 40), createDefaultPlayer(2, 'P2', 40)]
    };

    state = gameReducer(state, {
      type: ACTIONS.CHANGE_COMMANDER_DAMAGE,
      payload: { targetPlayerId: 2, sourcePlayerId: 1, amount: 5 }
    });
    expect(state.players[1].commanderDamage[1]).toBe(5);
    expect(state.players[1].life).toBe(35); // the fix: damage came off life

    // Removing damage gives the life back...
    state = gameReducer(state, {
      type: ACTIONS.CHANGE_COMMANDER_DAMAGE,
      payload: { targetPlayerId: 2, sourcePlayerId: 1, amount: -2 }
    });
    expect(state.players[1].commanderDamage[1]).toBe(3);
    expect(state.players[1].life).toBe(37);

    // ...but only for damage that actually existed (0-floor clamp): -5 on
    // 3 damage restores the 3 that were there (37 → 40), not 5 (which
    // would overshoot to 42)
    state = gameReducer(state, {
      type: ACTIONS.CHANGE_COMMANDER_DAMAGE,
      payload: { targetPlayerId: 2, sourcePlayerId: 1, amount: -5 }
    });
    expect(state.players[1].commanderDamage[1]).toBe(0);
    expect(state.players[1].life).toBe(40);
  });

  test('SET_COMMANDER_DAMAGE adjusts life by the delta', () => {
    let state = {
      ...fresh(),
      players: [createDefaultPlayer(1, 'P1', 40), createDefaultPlayer(2, 'P2', 40)]
    };

    state = gameReducer(state, {
      type: ACTIONS.SET_COMMANDER_DAMAGE,
      payload: { targetPlayerId: 2, sourcePlayerId: 1, value: 8 }
    });
    expect(state.players[1].life).toBe(32);

    state = gameReducer(state, {
      type: ACTIONS.SET_COMMANDER_DAMAGE,
      payload: { targetPlayerId: 2, sourcePlayerId: 1, value: 10 }
    });
    expect(state.players[1].life).toBe(30);
  });

  test('migrateCounters promotes legacy custom.radiation', () => {
    const migrated = migrateCounters({
      energy: 1,
      experience: 0,
      custom: { radiation: 4, stun: 2 }
    });
    expect(migrated.radiation).toBe(4);
    expect(migrated.custom).toEqual({ stun: 2 });
  });
});

describe('LifeCounter game flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    installStubs();
  });

  test('starts a commander game at 40 life; +1 tap reflects immediately', async () => {
    await mount();
    await startGame();

    expect(lifeOf(1)).toBe('40');
    expect(lifeOf(4)).toBe('40');

    await click(findButtonByAria(cardOf(1), 'Add 1 life to Player 1'));
    // AnimatedLifeChange must show the new total in the SAME render; the old
    // version held it back until 300ms after the last change (fake timers
    // never advance here, so a regression would still read 40).
    expect(lifeOf(1)).toBe('41');
    expect(lifeOf(2)).toBe('40');
  });

  test('hold-to-repeat: press fires once, holding repeats, release stops', async () => {
    await mount();
    await startGame();

    const btn = findButtonByAria(cardOf(1), 'Add 1 life to Player 1');
    await pointerDown(btn);
    expect(lifeOf(1)).toBe('41');

    // 400ms hold delay, then three 120ms interval ticks
    await act(async () => { jest.advanceTimersByTime(400 + 120 * 3); });
    expect(lifeOf(1)).toBe('44');

    await pointerUp(btn);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(lifeOf(1)).toBe('44'); // no repeats after release
  });

  test('pointer sequence does not double-fire via the trailing click', async () => {
    await mount();
    await startGame();

    const btn = findButtonByAria(cardOf(1), 'Add 1 life to Player 1');
    await pointerDown(btn);
    await pointerUp(btn);
    await click(btn); // synthetic click that follows the pointer sequence
    expect(lifeOf(1)).toBe('41');
  });

  test('direct life entry pad sets an exact total', async () => {
    await mount();
    await startGame();

    await click(document.querySelector('[data-testid="life-entry-1"]') || document.querySelector('[data-testid="life-total-1"]'));
    const pad = document.querySelector('[data-testid="life-entry-1"]');
    expect(pad).toBeTruthy();

    await change(document.querySelector('[data-testid="life-entry-input-1"]'), '27');
    await click(findButton(pad, 'Set'));

    expect(document.querySelector('[data-testid="life-entry-1"]')).toBeNull();
    expect(lifeOf(1)).toBe('27');
  });

  test('custom counters can be added and actually removed', async () => {
    await mount();
    await startGame();

    const card1 = cardOf(1);
    await click(findButton(card1, 'Add Custom Counter'));
    const nameInput = card1.querySelector('input[placeholder="Counter name..."]');
    await change(nameInput, 'stun');
    await click(findButton(card1, 'Add'));
    expect(card1.textContent).toContain('stun');

    const removeBtn = card1.querySelector('button[title="Remove counter"]');
    expect(removeBtn).toBeTruthy();
    await click(removeBtn);
    expect(card1.textContent).not.toContain('stun');
  });

  test('custom starting life and per-player handicap are applied', async () => {
    await mount();

    await change(document.querySelector('[data-testid="starting-life-input"]'), '50');
    await change(document.querySelector('[data-testid="handicap-input-1"]'), '30');
    await startGame();

    expect(lifeOf(1)).toBe('50');
    expect(lifeOf(2)).toBe('30'); // handicap
    expect(lifeOf(3)).toBe('50');
  });

  test('lineup save/load round-trips the pod', async () => {
    await mount();

    const nameInput = container.querySelector('input[placeholder="Player 1"]');
    await change(nameInput, 'Alice');
    await click(findButton(document, 'Save current lineup'));

    const saved = JSON.parse(localStorage.getItem(LINEUPS_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toContain('Alice');
    expect(saved[0].playerCount).toBe(4);

    await change(nameInput, 'Bob');
    await click(findButton(document, 'Load'));
    expect(container.querySelector('input[placeholder="Player 1"]').value).toBe('Alice');
  });

  test('commander damage grid shows every opponent on the card', async () => {
    await mount();
    await startGame();

    const grid = document.querySelector('[data-testid="commander-damage-grid-1"]');
    expect(grid).toBeTruthy();
    const chips = [...grid.querySelectorAll('button')];
    expect(chips).toHaveLength(3); // 4-player game → 3 opponents
    chips.forEach(c => expect(c.textContent).toMatch(/0\/21/));
  });

  test('commander damage can be added from the on-card grid modal', async () => {
    await mount();
    await startGame();

    const chip = document.querySelector('[data-testid="commander-damage-grid-1"] button');
    expect(chip.textContent).toMatch(/Player 2/);
    await click(chip); // opens the Commander Damage modal

    // One row per opponent: "X more to lethal" + [minus, plus]
    const row = [...document.querySelectorAll('div[class*="rounded-xl"]')]
      .find(el => el.textContent.includes('Player 2') && el.textContent.includes('more to lethal'));
    expect(row).toBeTruthy();
    const [, plus] = [...row.querySelectorAll('button')];
    await click(plus);

    await click(findButton(document, 'Done'));
    const chipAfter = document.querySelector('[data-testid="commander-damage-grid-1"] button');
    expect(chipAfter.textContent).toMatch(/1\/21/);
  });

  test('commander damage can be added from Advanced Controls (Damage tab)', async () => {
    await mount();
    await startGame();

    await click(findButton(cardOf(1), 'Advanced Controls'));
    await click(findButton(document, 'Damage'));

    // "Add Commander Damage" lists every opponent via the players context
    const addHeading = [...document.querySelectorAll('h4')]
      .find(h => h.textContent.includes('Add Commander Damage'));
    expect(addHeading).toBeTruthy();
    const sourceRow = [...addHeading.parentElement.querySelectorAll('div[class*="rounded"]')]
      .find(d => d.textContent.trim().startsWith('Player 2'));
    expect(sourceRow).toBeTruthy(); // context reached the panel — opponents listed
    const [, addOne] = [...sourceRow.querySelectorAll('button')]; // [minus, +1 zap, +5]
    await click(addOne);

    const chip = document.querySelector('[data-testid="commander-damage-grid-1"] button');
    expect(chip.textContent).toMatch(/1\/21/);
  });

  test('commander damage from the modal reduces the life total on screen', async () => {
    await mount();
    await startGame();

    const chip = document.querySelector('[data-testid="commander-damage-grid-1"] button');
    await click(chip); // opens the Commander Damage modal: damage TO Player 1

    const row = [...document.querySelectorAll('div[class*="rounded-xl"]')]
      .find(el => el.textContent.includes('Player 2') && el.textContent.includes('more to lethal'));
    const [, plus] = [...row.querySelectorAll('button')];
    await click(plus); // Player 2's commander hits Player 1 for 1
    await click(findButton(document, 'Done'));

    // +1 commander damage → 40 - 1 = 39 life on the target
    expect(lifeOf(1)).toBe('39');
  });

  test('Damage tab lists opponents without an inner scroll clip (regression: empty "Add Commander Damage")', async () => {
    await mount();
    await click(findButton(document, '2')); // 2-player game, like the report
    await startGame();

    await click(findButton(cardOf(2), 'Advanced Controls'));
    await click(findButton(document, 'Damage'));

    // The "Add Commander Damage" rows used to sit inside a nested
    // max-h-32 scroll region, so on a phone the heading showed with an
    // empty list under it. The rows must be reachable in the tab's own
    // scroll container without a smaller nested one.
    const addHeading = [...document.querySelectorAll('h4')]
      .find(h => h.textContent.includes('Add Commander Damage'));
    expect(addHeading).toBeTruthy();
    const sourceRow = [...addHeading.parentElement.querySelectorAll('div[class*="rounded"]')]
      .find(d => d.textContent.trim().startsWith('Player 1'));
    expect(sourceRow).toBeTruthy(); // opponent listed in a 2-player game

    const nestedScroller = addHeading.closest('div[class*="max-h-32"]');
    expect(nestedScroller).toBeNull(); // no clipped scroll region around it

    const [, addOne] = [...sourceRow.querySelectorAll('button')];
    await click(addOne);
    expect(lifeOf(2)).toBe('39'); // damage applied AND life reduced
  });

  test('compact mode (6 players) always shows a tappable commander damage chip', async () => {
    await mount();
    await click(findButton(document, '6')); // 6 players → compact cards
    await startGame();

    const grid = document.querySelector('[data-testid="commander-damage-grid-1"]');
    expect(grid).toBeTruthy(); // visible even with zero damage
    const chips = [...grid.querySelectorAll('button')];
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toMatch(/0\/21/);

    await click(chips[0]); // opens the damage modal
    expect(findButton(document, 'Done')).toBeTruthy();
  });

  test('landscape head-to-head: CMD opens damage modal and Reset asks to confirm', async () => {
    await mount();
    await click(findButton(document, '2')); // 2 players
    await startGame();
    await click(document.querySelector('button[title="Landscape Layout"]'));

    // CMD button on each side opens the Commander Damage modal (previously
    // the landscape early-return rendered neither modal, so the button
    // set state with no visible UI consuming it)
    const cmdButtons = [...document.querySelectorAll('button')]
      .filter(b => b.textContent.trim() === 'CMD');
    expect(cmdButtons).toHaveLength(2);
    await click(cmdButtons[0]);

    const row = [...document.querySelectorAll('div[class*="rounded-xl"]')]
      .find(el => el.textContent.includes('Player 2') && el.textContent.includes('more to lethal'));
    expect(row).toBeTruthy(); // modal is actually visible in landscape
    const [, plus] = [...row.querySelectorAll('button')];
    await click(plus);
    const indicator = [...row.querySelectorAll('div')]
      .find(d => d.className.includes('min-w-[3rem]'));
    expect(indicator.textContent).toBe('1');
    await click(findButton(document, 'Done'));

    // Reset asks for confirmation instead of silently doing nothing
    await click(document.querySelector('button[title="Reset"]'));
    const isConfirmOpen = () =>
      [...document.querySelectorAll('h3')].some(h => h.textContent.includes('Reset Game?'));
    expect(isConfirmOpen()).toBe(true);
    await click(findButton(document, 'Reset'));
    expect(isConfirmOpen()).toBe(false);
  });

  test('auto-save is debounced, then flushed immediately on pagehide', async () => {
    await mount();
    await startGame();

    expect(localStorage.getItem(AUTO_SAVE_KEY)).toBeNull();

    await click(findButtonByAria(cardOf(1), 'Add 1 life to Player 1'));
    expect(localStorage.getItem(AUTO_SAVE_KEY)).toBeNull(); // still debounced

    await act(async () => { jest.advanceTimersByTime(400); });
    let saved = JSON.parse(localStorage.getItem(AUTO_SAVE_KEY));
    expect(saved.players[0].life).toBe(41);

    // A further change stays pending until the flush event
    await click(findButtonByAria(cardOf(1), 'Add 1 life to Player 1'));
    expect(JSON.parse(localStorage.getItem(AUTO_SAVE_KEY)).players[0].life).toBe(41);

    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    saved = JSON.parse(localStorage.getItem(AUTO_SAVE_KEY));
    expect(saved.players[0].life).toBe(42);
  });
});
