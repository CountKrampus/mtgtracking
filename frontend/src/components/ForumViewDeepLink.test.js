import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react';
import ForumView from './ForumView';

global.IS_REACT_ACT_ENVIRONMENT = true;

// react-router-dom v7 exposes no CommonJS entry that CRA's jest 27 resolver
// can find ("Cannot find module"), and ForumView only uses useNavigate — so
// mock it virtually. `mockNavigate` is allowed in the factory by jest-hoist.
const mockNavigate = jest.fn();
jest.mock(
  'react-router-dom',
  () => ({
    __esModule: true,
    useNavigate: () => mockNavigate
  }),
  { virtual: true }
);

// axios ships untranspiled ESM that CRA's jest transform ignores, so mock it
// with a factory instead of automocking (which would load the real module).
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() }
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { _id: 'u1', username: 'tester', displayName: 'Tester', role: 'user' }
  }),
  AuthProvider: (props) => props.children,
  withAuth: (Component) => Component,
  default: {}
}));

jest.mock('./Forum/ThreadView', () => ({
  __esModule: true,
  default: (props) => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'thread-view', 'data-thread-id': props.threadId },
      React.createElement(
        'button',
        { 'data-testid': 'back-button', onClick: props.onBack },
        'Back'
      )
    );
  }
}));

jest.mock('./Forum/ForumHome', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'forum-home' });
  }
}));

jest.mock('./Forum/CategoryView', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'category-view' });
  }
}));

const DEEP_LINK_ID = '6ad0148cba1991e4f1e4c363';
const STALE_ID = '6a76a93e82fe87314e4d5075';

describe('ForumView thread deep links', () => {
  let container;
  let root;
  let axios;

  beforeEach(() => {
    jest.resetAllMocks();
    axios = require('axios').default;
    axios.get.mockResolvedValue({ data: [] });
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.history.pushState({}, '', '/');
  });

  const render = async () => {
    await act(async () => {
      root.render(<ForumView />);
    });
  };

  test('/forum/thread/<id> opens that exact thread, winning over stale localStorage', async () => {
    window.history.pushState({}, '', `/forum/thread/${DEEP_LINK_ID}`);
    localStorage.setItem('forumSelectedThread', STALE_ID);

    await render();

    const view = container.querySelector('[data-testid="thread-view"]');
    expect(view).not.toBeNull();
    expect(view.getAttribute('data-thread-id')).toBe(DEEP_LINK_ID);
    expect(localStorage.getItem('forumSelectedThread')).toBe(DEEP_LINK_ID);
    expect(container.querySelector('[data-testid="forum-home"]')).toBeNull();
  });

  test('back navigation from a deep-linked thread clears it and resets the URL', async () => {
    window.history.pushState({}, '', `/forum/thread/${DEEP_LINK_ID}`);

    await render();
    const back = container.querySelector('[data-testid="back-button"]');
    expect(back).not.toBeNull();

    await act(async () => {
      back.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="thread-view"]')).toBeNull();
    expect(container.querySelector('[data-testid="forum-home"]')).not.toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/forum', { replace: true });
    expect(localStorage.getItem('forumSelectedThread')).toBeNull();
  });

  test('without a deep link, the last-open thread from localStorage still restores', async () => {
    window.history.pushState({}, '', '/forum');
    localStorage.setItem('forumSelectedThread', STALE_ID);

    await render();

    const view = container.querySelector('[data-testid="thread-view"]');
    expect(view).not.toBeNull();
    expect(view.getAttribute('data-thread-id')).toBe(STALE_ID);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
