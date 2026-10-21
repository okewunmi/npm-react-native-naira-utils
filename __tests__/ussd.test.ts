import { buildUSSD, dialUSSD } from '../src/ussd';

describe('buildUSSD', () => {
  it('builds a simple code with no params', () => {
    expect(buildUSSD('737')).toBe('*737#');
  });

  it('builds a code with params', () => {
    expect(buildUSSD('737', ['1', '1'])).toBe('*737*1*1#');
  });

  it('is idempotent on already-formed codes', () => {
    expect(buildUSSD('*737#')).toBe('*737#');
  });

  it('filters out empty params', () => {
    expect(buildUSSD('737', ['1', '', '2'])).toBe('*737*1*2#');
  });

  it('throws on empty code', () => {
    expect(() => buildUSSD('')).toThrow(TypeError);
  });
});

describe('dialUSSD', () => {
  it('throws on malformed USSD string', () => {
    return expect(dialUSSD('not-ussd')).rejects.toThrow(TypeError);
  });

  it('throws a clear error when react-native is unavailable', () => {
    return expect(dialUSSD('*737#')).rejects.toThrow(/react-native is not available/);
  });
});

describe('buildUSSD: structure is protected (v0.2.0)', () => {
  it('accepts numeric params given as numbers', () => {
    expect(buildUSSD('737', [50, '0803123456'])).toBe('*737*50*0803123456#');
  });

  it.each([['1*2'], ['1#'], ['abc'], ['*'], ['#']])('rejects param %j', (p) => {
    expect(() => buildUSSD('737', [p])).toThrow(TypeError);
  });

  it('allows letters only when explicitly enabled, never * or #', () => {
    expect(buildUSSD('737', ['abc1'], { allowNonNumeric: true })).toBe('*737*abc1#');
    expect(() => buildUSSD('737', ['a*b'], { allowNonNumeric: true })).toThrow(TypeError);
  });

  it('treats null params as none', () => {
    expect(buildUSSD('737', null)).toBe('*737#');
  });

  it.each(['#', '*', '*#', 'abc', '12 34'])('rejects malformed code %j', (code) => {
    expect(() => buildUSSD(code)).toThrow(TypeError);
  });

  it('accepts multi-segment codes', () => {
    expect(buildUSSD('*901*1#')).toBe('*901*1#');
    expect(buildUSSD('901*1', ['5'])).toBe('*901*1*5#');
  });
});

describe('dialUSSD with a mocked react-native Linking', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native');
  });

  function load(linking: unknown) {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Linking: linking }), { virtual: true });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../src/ussd') as typeof import('../src/ussd');
  }

  it('percent-encodes # and opens the dialer', async () => {
    const openURL = jest.fn().mockResolvedValue(undefined);
    const { dialUSSD: dial } = load({ openURL, canOpenURL: jest.fn().mockResolvedValue(true) });
    await dial('*737*1*1#');
    expect(openURL).toHaveBeenCalledWith('tel:*737*1*1%23');
  });

  it('throws a clear error when the device cannot open the dialer', async () => {
    const openURL = jest.fn();
    const { dialUSSD: dial } = load({ openURL, canOpenURL: jest.fn().mockResolvedValue(false) });
    await expect(dial('*737#')).rejects.toThrow(/cannot open the phone dialer/);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('still works when canOpenURL is unavailable', async () => {
    const openURL = jest.fn().mockResolvedValue(undefined);
    const { dialUSSD: dial } = load({ openURL });
    await dial('*737#');
    expect(openURL).toHaveBeenCalledWith('tel:*737%23');
  });
});
