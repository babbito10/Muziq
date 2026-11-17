import { truncateIp } from './request-meta';

describe('truncateIp', () => {
  it.each([
    ['203.0.113.42', '203.0.113.0/24'],
    ['::ffff:198.51.100.7', '198.51.100.0/24'],
    ['2001:db8:85a3:8d3:1319:8a2e:370:7348', '2001:db8:85a3::/48'],
    ['2001:db8::1', '2001:db8:0::/48'],
    ['::1', '0:0:0::/48'],
    ['not-an-ip', null],
    [undefined, null],
  ])('%s → %s', (input, expected) => {
    expect(truncateIp(input)).toBe(expected);
  });
});
