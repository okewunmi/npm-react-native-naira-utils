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
