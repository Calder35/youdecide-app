import {
  ProductionHostRefused,
  assertTestBaseUrl,
  isAllowedDeployment,
  isTestHost,
  resolveApiConfig,
} from '../api/config';

/**
 * The "no production side effects" non-negotiable, as a test.
 *
 * This app has no production mode. The guard is what makes that a property of
 * the code rather than a promise in a README.
 */
describe('where the app is allowed to send things', () => {
  it('accepts a laptop backend', () => {
    expect(assertTestBaseUrl('http://localhost:8000')).toBe('http://localhost:8000');
    expect(assertTestBaseUrl('http://127.0.0.1:8000/')).toBe('http://127.0.0.1:8000');
  });

  it('accepts a phone on the same wifi, which is how Expo Go reaches a laptop', () => {
    expect(isTestHost('192.168.1.42')).toBe(true);
    expect(isTestHost('10.0.0.7')).toBe(true);
    expect(isTestHost('172.16.4.1')).toBe(true);
    expect(isTestHost('macbook.local')).toBe(true);
  });

  it('accepts an obviously-named review deployment', () => {
    expect(isTestHost('test.youdecide.ai')).toBe(true);
    expect(isTestHost('dev.youdecide.ai')).toBe(true);
    expect(isTestHost('staging.youdecide.ai')).toBe(true);
  });

  it('accepts a deployment that has been named explicitly', () => {
    const railway = 'web-production-e36a6.up.railway.app';
    expect(isAllowedDeployment(railway)).toBe(true);
    expect(assertTestBaseUrl(`https://${railway}`)).toBe(`https://${railway}`);
  });

  it('allows the named host EXACTLY, never by suffix or sibling', () => {
    // The allowlist is not a wildcard: a neighbouring Railway app, or a
    // lookalike that merely ends with the allowed name, stays refused.
    expect(isAllowedDeployment('other-app.up.railway.app')).toBe(false);
    expect(isAllowedDeployment('up.railway.app')).toBe(false);
    expect(isAllowedDeployment('evil-web-production-e36a6.up.railway.app')).toBe(false);
    expect(() => assertTestBaseUrl('https://other-app.up.railway.app')).toThrow(
      ProductionHostRefused,
    );
  });

  it('refuses anything that could be production', () => {
    const refused = [
      'https://youdecide.ai',
      'https://api.youdecide.ai',
      'https://youdecide-ai-backend.example.com',
      'https://8.8.8.8',
      // A test-looking word that is not the hostname prefix does not count.
      'https://api.youdecide.ai/test',
      'https://nottest.youdecide.ai',
    ];
    for (const url of refused) {
      expect(() => assertTestBaseUrl(url)).toThrow(ProductionHostRefused);
    }
  });

  it('refuses a public IP that merely looks private', () => {
    // 172.32 is outside the private 172.16–172.31 range.
    expect(isTestHost('172.32.0.1')).toBe(false);
    expect(isTestHost('192.169.1.1')).toBe(false);
    expect(isTestHost('11.0.0.1')).toBe(false);
  });

  it('refuses a non-http scheme and unparseable junk', () => {
    expect(() => assertTestBaseUrl('ftp://localhost')).toThrow(ProductionHostRefused);
    expect(() => assertTestBaseUrl('localhost:8000')).toThrow(ProductionHostRefused);
    expect(() => assertTestBaseUrl('')).toThrow(ProductionHostRefused);
  });

  it('says what to do rather than only refusing', () => {
    expect(() => assertTestBaseUrl('https://api.youdecide.ai')).toThrow(
      /only talks to test hosts/,
    );
  });

  it('defaults to offline when nothing is configured', () => {
    expect(resolveApiConfig('')).toEqual({ mode: 'offline', baseUrl: '' });
  });

  it('reports test-api mode for a configured test host', () => {
    expect(resolveApiConfig('http://localhost:8000')).toEqual({
      mode: 'test-api',
      baseUrl: 'http://localhost:8000',
    });
  });
});
