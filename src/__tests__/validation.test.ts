import {
  readinessForHuman,
  validateEmail,
  validateFullName,
  validatePhone,
  validateZip,
} from '../data/validation';

describe('field validation', () => {
  it('never complains about an empty field', () => {
    expect(validateFullName('')).toBeNull();
    expect(validateEmail('')).toBeNull();
    expect(validatePhone('')).toBeNull();
    expect(validateZip('   ')).toBeNull();
  });

  it('accepts ordinary entries', () => {
    expect(validateFullName('Jordan Rivera')).toBeNull();
    expect(validateEmail('jordan@example.com')).toBeNull();
    expect(validatePhone('(702) 555-0143')).toBeNull();
    expect(validateZip('89129')).toBeNull();
  });

  it('accepts unusual but valid email addresses rather than second-guessing them', () => {
    expect(validateEmail("o'brien+listing@sub.domain.co.uk")).toBeNull();
  });

  it('catches the mistakes people actually make', () => {
    expect(validateEmail('jordan.example.com')).not.toBeNull();
    expect(validateEmail('jordan@example')).not.toBeNull();
    expect(validatePhone('702-555')).not.toBeNull();
    expect(validatePhone('7025550143999')).not.toBeNull();
    expect(validateZip('8912')).not.toBeNull();
    expect(validateZip('89129-1234')).not.toBeNull();
  });

  it('tells the seller what to do, not just that they are wrong', () => {
    const messages = [
      validateEmail('nope'),
      validatePhone('123'),
      validateZip('1'),
      validateFullName('J'),
    ].filter((message): message is string => message !== null);

    expect(messages).toHaveLength(4);
    for (const message of messages) {
      // No bare "invalid"/"required" — every message says something useful.
      expect(message.toLowerCase()).not.toMatch(/^(invalid|required|error)\b/);
      expect(message.length).toBeGreaterThan(25);
    }
  });
});

describe('readiness for a human handoff', () => {
  it('needs a name and one way to reply', () => {
    expect(readinessForHuman({ fullName: '', email: '', phone: '' })).toEqual([
      'your name',
      'an email or a phone number',
    ]);
  });

  it('is satisfied by either an email or a phone', () => {
    expect(
      readinessForHuman({ fullName: 'Jordan Rivera', email: 'jordan@example.com', phone: '' }),
    ).toEqual([]);
    expect(
      readinessForHuman({ fullName: 'Jordan Rivera', email: '', phone: '7025550143' }),
    ).toEqual([]);
  });
});
