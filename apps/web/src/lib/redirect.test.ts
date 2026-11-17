import { safeNext } from './redirect';
import { serialiseRuntimeConfig } from './runtime-config';

describe('safeNext', () => {
  it.each([
    ['/account', '/account'],
    ['/account?tab=security', '/account?tab=security'],
    [null, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe('serialiseRuntimeConfig', () => {
  it('escapes characters that could break out of the script tag', () => {
    const out = serialiseRuntimeConfig({ apiUrl: 'https://x/</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).apiUrl).toBe('https://x/</script><script>alert(1)</script>');
  });
});
