import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() }
}));

// Replace PlayerCard with a lightweight memoized stub that counts renders
// per player. The stub's memo is subject to the exact same prop-identity
// contract as the real React.memo(PlayerCard), so it measures whether the
// stable-callback work in LifeCounter actually prevents untouched cards
// from re-rendering when one player's life changes.
jest.mock('./PlayerCard', () => {
  const ReactActual = require('react');
  const counts = {};
  const Stub = ReactActual.memo(({ player, onLifeChange }) => {
    counts[player.id] = (counts[player.id] || 0) + 1;
    return ReactActual.createElement(
      'div',
      { 'data-testid': `player-card-${player.id}` },
      ReactActual.createElement(
        'button',
        { 'aria-label': `Add 1 life to ${player.name}`, onClick: () => onLifeChange(1) },
        '+1'
      ),
      ReactActual.createElement('span', null, String(player.life))
    );
  });
  Stub.__counts = counts;
  return { __esModule: true, default: Stub };
});

import LifeCounter from './LifeCounter';
import PlayerCardStub from './PlayerCard';

beforeAll(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve([]) })
  );
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
});

let container = null;
let root = null;

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
});

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

const snapshotCounts = () => ({ ...PlayerCardStub.__counts });

test('a life tap re-renders only that player card, not the whole grid', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = ReactDOM.createRoot(container);
  await act(async () => {
    root.render(<LifeCounter onBack={jest.fn()} />);
  });

  // Start a 4-player commander game
  const startBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim() === 'Start Game');
  await act(async () => { Simulate.click(startBtn); });

  const before = snapshotCounts();
  expect(before[1]).toBeGreaterThan(0);
  expect(before[2]).toBeGreaterThan(0);

  const plusOne = [...document.querySelectorAll('[data-testid="player-card-1"] button')]
    .find(b => b.getAttribute('aria-label') === 'Add 1 life to Player 1');
  await act(async () => { Simulate.click(plusOne); });

  const after = snapshotCounts();
  // The changed player's card re-rendered...
  expect(after[1]).toBeGreaterThan(before[1]);
  // ...and every other card was skipped entirely (stable props + memo)
  expect(after[2]).toBe(before[2]);
  expect(after[3]).toBe(before[3]);
  expect(after[4]).toBe(before[4]);
});
