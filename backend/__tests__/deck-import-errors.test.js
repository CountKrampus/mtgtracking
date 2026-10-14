jest.mock('axios');

const axios = require('axios');
const {
  parseMoxfieldURL,
  parseArchidektURL,
  parseTappedOutURL,
  parseMTGGoldfishURL
} = require('../utils/deckHelpers');

// Builds an axios-shaped rejection: Error with err.response.status.
function httpError(status) {
  const err = new Error(`Request failed with status code ${status}`);
  err.response = { status };
  return err;
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('Friendly upstream error mapping for deck import sources', () => {
  test('Moxfield: invalid URL -> 400 with URL hint (was a bare 500)', async () => {
    await expect(parseMoxfieldURL('https://example.com/nope'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid Moxfield URL') });
  });

  test('Moxfield: 404 -> 404 with public/private hint instead of generic message', async () => {
    axios.get.mockRejectedValue(httpError(404));
    await expect(parseMoxfieldURL('https://moxfield.com/decks/abc123'))
      .rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Moxfield deck not found')
      });
  });

  test('Moxfield: blocked (403) -> 502 mentioning Text List fallback', async () => {
    axios.get.mockRejectedValue(httpError(403));
    await expect(parseMoxfieldURL('https://moxfield.com/decks/abc123'))
      .rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('Text List import instead')
      });
  });

  test('Moxfield: timeout -> 504 with "did not respond in time"', async () => {
    const err = new Error('timeout of 10000ms exceeded');
    err.code = 'ECONNABORTED';
    axios.get.mockRejectedValue(err);
    await expect(parseMoxfieldURL('https://moxfield.com/decks/abc123'))
      .rejects.toMatchObject({ statusCode: 504, message: expect.stringContaining('did not respond in time') });
  });

  test('Archidekt: invalid URL -> 400 (was "Invalid Archidekt URL" as 500)', async () => {
    await expect(parseArchidektURL('https://archidekt.com/decks/abc'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid Archidekt URL') });
  });

  test('Archidekt: 404 -> 404 with URL/public hint instead of raw axios message', async () => {
    axios.get.mockRejectedValue(httpError(404));
    await expect(parseArchidektURL('https://archidekt.com/decks/123456/some-deck'))
      .rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Archidekt deck not found')
      });
  });

  // TappedOut's CDN 403s non-browser clients, so this tab fails for everyone.
  test('TappedOut: 403 -> names TappedOut and points at Text List import', async () => {
    axios.get.mockRejectedValue(httpError(403));
    await expect(parseTappedOutURL('https://tappedout.net/mtg-decks/some-deck/'))
      .rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('TappedOut is currently blocking automated imports')
      });
  });

  test('TappedOut: invalid URL -> 400', async () => {
    await expect(parseTappedOutURL('https://tappedout.net/'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid TappedOut URL') });
  });

  test('MTGGoldfish: invalid URL -> 400 with example URL', async () => {
    await expect(parseMTGGoldfishURL('https://www.mtggoldfish.com/'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Invalid MTGGoldfish URL') });
  });

  test('MTGGoldfish: 404 -> 404 with example URL instead of raw axios message', async () => {
    axios.get.mockRejectedValue(httpError(404));
    await expect(parseMTGGoldfishURL('https://www.mtggoldfish.com/deck/9999999'))
      .rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('MTGGoldfish deck not found')
      });
  });
});
