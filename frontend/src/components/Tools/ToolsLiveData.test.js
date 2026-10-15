import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import axios from 'axios';
import SetReleaseCalendar from './SetReleaseCalendar';
import SpoilerSeasonIntegration from './SpoilerSeasonIntegration';

global.IS_REACT_ACT_ENVIRONMENT = true;
// axios ships untranspiled ESM that CRA's jest transform ignores, so mock it
// with a factory instead of automocking (which would load the real module).
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const scryfallSet = (overrides) => ({
  object: 'set',
  code: 'nsw',
  name: 'New World Set',
  released_at: iso(30),
  set_type: 'expansion',
  card_count: 275,
  digital: false,
  icon_svg_uri: 'https://svgs.scryfall.io/sets/nsw.svg',
  scryfall_uri: 'https://scryfall.com/sets/nsw',
  ...overrides
});

const scryfallCard = (overrides) => ({
  object: 'card',
  id: 'card-1',
  name: 'Skyward Angel',
  released_at: iso(30),
  collector_number: '12',
  rarity: 'rare',
  type_line: 'Creature — Angel',
  mana_cost: '{3}{W}',
  oracle_text: 'Flying\nAngels you control get +1/+1.',
  power: '2',
  toughness: '2',
  flavor_text: 'It remembers the sky.',
  prices: { usd: null, usd_foil: null },
  variation: false,
  full_art: false,
  card_faces: undefined,
  ...overrides
});

const mockApi = ({ sets = [], cards = [], cardsStatus = 200 } = {}) => {
  axios.get.mockImplementation(async (url) => {
    if (url === 'https://api.scryfall.com/sets') {
      return { data: { data: sets } };
    }
    if (url.startsWith('https://api.scryfall.com/cards/search')) {
      if (cardsStatus === 404) {
        const err = new Error('not found');
        err.response = { status: 404 };
        throw err;
      }
      return { data: { total_cards: cards.length, has_more: false, data: cards } };
    }
    throw new Error(`Unexpected URL requested: ${url}`);
  });
};

describe('SetReleaseCalendar (live Scryfall data)', () => {
  let container;
  let root;

  beforeEach(() => {
    jest.resetAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(<SetReleaseCalendar />);
    });
  };

  test('shows upcoming and recently released sets, not old hardcoded ones', async () => {
    mockApi({
      sets: [
        scryfallSet({}),
        scryfallSet({
          code: 'dsk',
          name: 'Duskmourn: House of Horror',
          released_at: iso(-400)
        }),
        scryfallSet({ code: 'rct', name: 'Recent Set', released_at: iso(-10) }),
        scryfallSet({
          code: 'pzz',
          name: 'Promo Noise Set',
          released_at: iso(3),
          set_type: 'promo'
        }),
        scryfallSet({
          code: 'tok',
          name: 'Token Noise Set',
          released_at: iso(3),
          set_type: 'token'
        }),
        scryfallSet({
          code: 'dgl',
          name: 'Digital Noise Set',
          released_at: iso(3),
          digital: true
        })
      ]
    });

    await render();

    expect(container.textContent).toContain('New World Set');
    expect(container.textContent).toContain('Recent Set');
    expect(container.textContent).toContain('Releases in');
    // The old static data (and other noise types) must not appear
    expect(container.textContent).not.toContain('Duskmourn: House of Horror');
    expect(container.textContent).not.toContain('Promo Noise Set');
    expect(container.textContent).not.toContain('Token Noise Set');
    expect(container.textContent).not.toContain('Digital Noise Set');

    const link = container.querySelector('a[href="https://scryfall.com/sets/nsw"]');
    expect(link).not.toBeNull();
  });

  test('shows an error with a working Retry button when Scryfall is unreachable', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));
    mockApi({ sets: [scryfallSet({})] });

    await render();
    expect(container.textContent).toContain('Could not reach Scryfall');

    const retry = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Retry'
    );
    expect(retry).toBeDefined();

    await act(async () => {
      retry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('New World Set');
    expect(container.textContent).not.toContain('Could not reach Scryfall');
  });
});

describe('SpoilerSeasonIntegration (live Scryfall data)', () => {
  let container;
  let root;

  beforeEach(() => {
    jest.resetAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(<SpoilerSeasonIntegration />);
    });
  };

  test('renders actually spoiled cards for the nearest upcoming set', async () => {
    mockApi({
      sets: [scryfallSet({ released_at: iso(10) })],
      cards: [
        scryfallCard({}),
        scryfallCard({
          id: 'card-2',
          name: 'Void Tyrant',
          collector_number: '121',
          rarity: 'mythic',
          type_line: 'Creature — Eldrazi',
          power: '7',
          toughness: '7',
          prices: { usd: '39.99', usd_foil: null }
        })
      ]
    });

    await render();

    expect(container.textContent).toContain('Skyward Angel');
    expect(container.textContent).toContain('Void Tyrant');
    expect(container.textContent).toContain('Mythic Rare');
    expect(container.textContent).toContain('$39.99');
    expect(container.textContent).toContain('Collector №');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('Angels you control get +1/+1.');
    expect(container.textContent).toContain('7/7');
    // Fabricated demo fields are gone
    expect(container.textContent).not.toContain('Community Rating');
    expect(container.textContent).not.toContain('Cosmic Horror');
  });

  test('shows a helpful empty state when nothing is spoiled yet (404 from Scryfall)', async () => {
    mockApi({
      sets: [scryfallSet({ released_at: iso(45) })],
      cardsStatus: 404
    });

    await render();

    expect(container.textContent).toContain('No spoilers yet');
    expect(container.textContent).toContain('New World Set');
    expect(container.textContent).not.toContain('Cosmic Horror');
  });
});
