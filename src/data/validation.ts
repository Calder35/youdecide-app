/**
 * Field validation, with messages written for a person rather than a form.
 *
 * Two rules the tests hold:
 *   1. A message says what to DO ("Add the @ …"), never just "invalid".
 *   2. An empty optional field is not an error. This app never blocks a seller
 *      for leaving something blank unless it truly cannot proceed.
 */

export type ValidationResult = string | null;

export function validateFullName(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length < 2) {
    return 'That looks short — enter the name you would sign a contract with.';
  }
  return null;
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  // Deliberately loose. Rejecting an unusual but valid address is worse than
  // letting one through — the confirmation email is the real check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return 'That does not look like an email address — check for a missing @ or a typo in the domain.';
  }
  return null;
}

export function validatePhone(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) {
    return 'A US phone number needs 10 digits, including the area code.';
  }
  if (digits.length > 11) {
    return 'That is more digits than a US phone number — check for an extra number.';
  }
  return null;
}

export function validateZip(value: string): ValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!/^\d{5}$/.test(trimmed)) {
    return 'A ZIP code is five digits, like 89129.';
  }
  return null;
}

/** Everything a seller needs before a human can usefully help them. */
export function readinessForHuman(input: {
  fullName: string;
  email: string;
  phone: string;
}): string[] {
  const missing: string[] = [];
  if (input.fullName.trim().length === 0) missing.push('your name');
  if (input.email.trim().length === 0 && input.phone.trim().length === 0) {
    missing.push('an email or a phone number');
  }
  return missing;
}
