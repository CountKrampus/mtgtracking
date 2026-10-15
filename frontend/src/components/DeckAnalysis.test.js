import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import axios from 'axios';
import DeckAnalysis from './DeckAnalysis';
import { API_URL } from '../config';

global.IS_REACT_ACT_ENVIRONMENT = true;
// axios ships untranspiled ESM that CRA's jest transform ignores, so mock it
// with a factory instead of automocking (which would load the real module).
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));

// W-identity commander with an empty deck → 6 W staples + 4 C staples missing
const deck = {
  commander: { name: 'Test Commander', colorIdentity: ['W'] },
  mainDeck: []
};

const lookupURL = (name) => `${API_URL}/images/lookup?name=${encodeURIComponent(name)}`;
const searchURL = (name) => `${API_URL}/scryfall/search?name=${encodeURIComponent(name)}`;

// Lets every pending promise chain (microtasks) settle inside act()
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });

// Manually-resolvable promise so the transient 'loading' state is observable:
// an immediately-resolved mock settles inside the same act() flush as the
// hover event and would skip past it.
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const chipWithText = (container, text) =>
  [...container.querySelectorAll('span')].find(el => el.textContent === text);

describe('DeckAnalysis — Missing Staples hover preview', () => {
  let container;
  let root;

  beforeEach(() => {
    jest.resetAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('lists missing staples for the commander color identity without fetching anything up front', async () => {
    await act(async () => { root.render(<DeckAnalysis deck={deck} />); });

    expect(container.textContent).toContain('Missing Staples');
    expect(chipWithText(container, 'Swords to Plowshares')).toBeTruthy();
    expect(chipWithText(container, 'Sol Ring')).toBeTruthy(); // C staples always count
    expect(container.textContent).not.toContain('All key staples included');
    // Nothing is fetched until the user actually hovers a chip
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('resolves from the local image lookup on first hover, shows the image, and cleans up on leave', async () => {
    const d = deferred();
    axios.get.mockImplementation((url) => {
      if (url === lookupURL('Swords to Plowshares')) return d.promise;
      throw new Error(`Unexpected URL requested: ${url}`);
    });
    await act(async () => { root.render(<DeckAnalysis deck={deck} />); });

    const chip = chipWithText(container, 'Swords to Plowshares');
    await act(async () => { Simulate.mouseEnter(chip); });

    // Local-first: the disk-cache lookup, never the Scryfall search
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(lookupURL('Swords to Plowshares'));
    expect(container.textContent).toContain('Loading Swords to Plowshares');
    expect(container.querySelector('img')).toBeNull();

    await act(async () => {
      d.resolve({ data: { scryfallId: 'abc-123', imageUrl: '/api/images/abc-123' } });
    });
    await flush();
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(`${API_URL}/images/abc-123`);
    expect(container.textContent).not.toContain('Loading');

    await act(async () => { Simulate.mouseLeave(chip); });
    expect(container.querySelector('img')).toBeNull();

    // Memoized per session: re-hovering the same chip does not refetch
    await act(async () => { Simulate.mouseEnter(chip); });
    expect(axios.get).toHaveBeenCalledTimes(1);
    await flush();
    expect(container.querySelector('img')).toBeTruthy();
  });

  it('falls back to the Scryfall search when the local lookup misses', async () => {
    axios.get.mockImplementation((url) => {
      if (url === lookupURL('Path to Exile')) {
        const err = new Error('not cached');
        err.response = { status: 404 };
        return Promise.reject(err);
      }
      if (url === searchURL('Path to Exile')) {
        return Promise.resolve({ data: { scryfallId: 'p2e-1', imageUrl: 'https://cards.example/p2e.jpg' } });
      }
      throw new Error(`Unexpected URL requested: ${url}`);
    });
    await act(async () => { root.render(<DeckAnalysis deck={deck} />); });

    const chip = chipWithText(container, 'Path to Exile');
    await act(async () => { Simulate.mouseEnter(chip); });
    await flush();

    // Lookup first, search only as the fallback
    expect(axios.get.mock.calls.map(c => c[0])).toEqual([
      lookupURL('Path to Exile'),
      searchURL('Path to Exile')
    ]);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(`${API_URL}/images/p2e-1`);
  });

  it('shows a failure message, clears it on leave, and retries on the next hover', async () => {
    axios.get.mockImplementation(() => Promise.reject(new Error('network down')));
    await act(async () => { root.render(<DeckAnalysis deck={deck} />); });

    const chip = chipWithText(container, 'Sol Ring');
    await act(async () => { Simulate.mouseEnter(chip); });
    await flush();
    expect(container.textContent).toContain('Preview unavailable for Sol Ring');

    await act(async () => { Simulate.mouseLeave(chip); });
    expect(container.textContent).not.toContain('Preview unavailable');

    // Back online (or transient failure) → the next hover retries the whole
    // chain: lookup, then search fallback, then success
    axios.get.mockImplementation((url) => {
      if (url === lookupURL('Sol Ring')) {
        const err = new Error('not cached');
        err.response = { status: 404 };
        return Promise.reject(err);
      }
      if (url === searchURL('Sol Ring')) {
        return Promise.resolve({ data: { scryfallId: 'sol-1', imageUrl: null } });
      }
      throw new Error(`Unexpected URL requested: ${url}`);
    });
    await act(async () => { Simulate.mouseEnter(chip); });
    await flush();
    expect(axios.get.mock.calls.map(c => c[0])).toEqual([
      lookupURL('Sol Ring'), searchURL('Sol Ring'), // first hover: both failed
      lookupURL('Sol Ring'), searchURL('Sol Ring')  // retry after leave
    ]);
    expect(container.querySelector('img').getAttribute('src')).toBe(`${API_URL}/images/sol-1`);
  });
});
