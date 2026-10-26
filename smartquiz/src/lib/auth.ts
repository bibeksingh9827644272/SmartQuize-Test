import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { uid } from './ids';

export type { CountryCode };
export type UserRole = 'admin' | 'student';

export interface Account {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: CountryCode;
  role: UserRole;
  rollNumber: string;
  avatar: string | null;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: string;
  lastLoginAt: string | null;
}

type AccountRecord = Omit<Account, 'rollNumber' | 'avatar'> & {
  rollNumber?: string;
  avatar?: string | null;
};

export type AuthUser = Omit<Account, 'passwordHash' | 'passwordSalt' | 'passwordIterations'>;

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  country: CountryCode;
  role: UserRole;
  password: string;
  confirmPassword: string;
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export type ResetChannel = 'email' | 'phone';

export interface PasswordResetRequestInput {
  identifier: string;
  channel: ResetChannel;
  country: CountryCode;
}

export interface PasswordResetTicket {
  challengeId: string;
  accountName: string;
  role: UserRole;
  channel: ResetChannel;
  maskedDestination: string;
  demoCode: string;
  expiresAt: string;
  attemptsRemaining: number;
}

export interface PasswordResetVerification {
  accountName: string;
  role: UserRole;
  channel: ResetChannel;
  maskedDestination: string;
  expiresAt: string;
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
}

export type AuthErrorCode =
  | 'invalid_name'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_avatar'
  | 'weak_password'
  | 'password_mismatch'
  | 'duplicate_email'
  | 'duplicate_phone'
  | 'admin_exists'
  | 'invalid_credentials'
  | 'account_not_found'
  | 'reset_not_found'
  | 'reset_expired'
  | 'reset_not_verified'
  | 'reset_attempts_exceeded'
  | 'invalid_otp'
  | 'crypto_unavailable'
  | 'storage_unavailable';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const ACCOUNTS_STORAGE_KEY = 'smartquiz.accounts.v1';
export const SESSION_STORAGE_KEY = 'smartquiz.session.v1';
const RESET_STORAGE_KEY = 'smartquiz.passwordreset.v1';
const ACCOUNTS_KEY = ACCOUNTS_STORAGE_KEY;
const SESSION_KEY = SESSION_STORAGE_KEY;
const PASSWORD_ITERATIONS = 210_000;
// Any fixed salt works here; it only keeps unknown-identifier logins from returning early.
const DUMMY_SALT = 'c21hcnRxdWl6LWRlbW8=';

export const PASSWORD_MIN_LENGTH = 8;
export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_RESEND_COOLDOWN_SECONDS = 30;

interface SessionRecord {
  accountId: string;
  token: string;
  signedInAt: string;
}

interface ResetRecord {
  id: string;
  accountId: string;
  channel: ResetChannel;
  maskedDestination: string;
  codeSalt: string;
  codeHash: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
}

export function roleHome(role: UserRole): string {
  return role === 'admin' ? '/admin' : '/student';
}

let countryOptionsCache: CountryOption[] | null = null;

export function getCountryOptions(): CountryOption[] {
  if (countryOptionsCache) return countryOptionsCache;
  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    displayNames = null;
  }
  countryOptionsCache = getCountries()
    .map((code) => ({
      code,
      name: displayNames?.of(code) ?? code,
      dialCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryOptionsCache;
}

export function detectDefaultCountry(): CountryCode {
  if (typeof navigator !== 'undefined') {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const language of languages) {
      const region = /-([A-Za-z]{2})(?:-|$)/.exec(language)?.[1]?.toUpperCase();
      if (region && isSupportedCountry(region)) return region;
    }
  }
  return 'US';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

export function toE164(phone: string, country: CountryCode): string | null {
  const value = phone.trim();
  if (!value) return null;
  try {
    const parsed = parsePhoneNumberFromString(value, country);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.number;
  } catch {
    return null;
  }
}

export function phoneExample(country: CountryCode): string {
  switch (country) {
    case 'IN':
      return '98765 43210';
    case 'US':
    case 'CA':
      return '201 555 0123';
    case 'GB':
      return '7911 123456';
    case 'AU':
      return '412 345 678';
    default:
      return 'National number';
  }
}

export function getPasswordIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 128) return 'Keep the password under 128 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Add at least one letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  return null;
}

export function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export function toAuthUser(account: Account): AuthUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    country: account.country,
    role: account.role,
    rollNumber: account.rollNumber,
    avatar: account.avatar,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt,
  };
}

export function listAccounts(): AuthUser[] {
  return readAccounts()
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toAuthUser);
}

const MAX_AVATAR_DATA_URL_LENGTH = 600_000;

function normalizeAvatar(value: unknown): string | null {
  if (
    typeof value === 'string' &&
    /^data:image\/(png|jpeg|webp|gif);base64,/.test(value) &&
    value.length <= MAX_AVATAR_DATA_URL_LENGTH
  ) {
    return value;
  }
  return null;
}

function makeRollNumber(role: UserRole, createdAt: string, used: Set<string>): string {
  const created = new Date(createdAt);
  const year = Number.isNaN(created.getTime()) ? new Date().getFullYear() : created.getFullYear();
  const base = `${role === 'admin' ? 'SQ-EXM' : 'SQ-STU'}-${year}-`;
  let highest = 0;
  used.forEach((roll) => {
    if (!roll.startsWith(base)) return;
    const sequence = Number.parseInt(roll.slice(base.length), 10);
    if (Number.isFinite(sequence)) highest = Math.max(highest, sequence);
  });
  let next = highest + 1;
  let candidate = `${base}${String(next).padStart(4, '0')}`;
  while (used.has(candidate)) {
    next += 1;
    candidate = `${base}${String(next).padStart(4, '0')}`;
  }
  used.add(candidate);
  return candidate;
}

function isAccountRecord(value: unknown): value is AccountRecord {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<Account>;
  return (
    typeof account.id === 'string' &&
    typeof account.name === 'string' &&
    typeof account.email === 'string' &&
    typeof account.phone === 'string' &&
    (account.role === 'admin' || account.role === 'student') &&
    typeof account.passwordHash === 'string' &&
    typeof account.passwordSalt === 'string' &&
    typeof account.passwordIterations === 'number'
  );
}

function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const records = parsed.filter(isAccountRecord);
    const used = new Set(
      records
        .map((record) => record.rollNumber)
        .filter((roll): roll is string => typeof roll === 'string' && roll.length > 0),
    );
    let migrated = false;
    const accounts = records.map((record): Account => {
      const rollNumber =
        typeof record.rollNumber === 'string' && record.rollNumber
          ? record.rollNumber
          : makeRollNumber(record.role, record.createdAt, used);
      if (rollNumber !== record.rollNumber) migrated = true;
      const avatar = normalizeAvatar(record.avatar);
      if (avatar !== (record.avatar ?? null)) migrated = true;
      return {
        ...record,
        rollNumber,
        avatar,
      };
    });
    if (migrated) {
      try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      } catch {
        // Keep working in memory if the upgraded accounts cannot be persisted.
      }
    }
    return accounts;
  } catch {
    return [];
  }
}

function writeAccounts(accounts: Account[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    throw new AuthError(
      'storage_unavailable',
      'This browser would not save the account. Check that local storage is allowed and try again.',
    );
  }
}

export function readSession(): SessionRecord | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionRecord>;
    if (typeof parsed.accountId !== 'string' || !parsed.accountId) return null;
    return {
      accountId: parsed.accountId,
      token: typeof parsed.token === 'string' ? parsed.token : '',
      signedInAt: typeof parsed.signedInAt === 'string' ? parsed.signedInAt : '',
    };
  } catch {
    return null;
  }
}

export function startSession(accountId: string): void {
  const session: SessionRecord = {
    accountId,
    token: uid('session'),
    signedInAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new AuthError(
      'storage_unavailable',
      'This browser would not keep the sign-in. Allow session storage and try again.',
    );
  }
}

export function endSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

export function loadSessionUser(): AuthUser | null {
  const session = readSession();
  if (!session) return null;
  const account = readAccounts().find((item) => item.id === session.accountId);
  if (!account) {
    endSession();
    return null;
  }
  return toAuthUser(account);
}

export function workspaceHasAdmin(): boolean {
  return readAccounts().some((account) => account.role === 'admin');
}

function assertDuplicateFree(accounts: Account[], email: string, phone: string): void {
  if (accounts.some((account) => account.email === email)) {
    throw new AuthError(
      'duplicate_email',
      'An account with this email already exists in this browser. Sign in instead.',
    );
  }
  if (accounts.some((account) => account.phone === phone)) {
    throw new AuthError(
      'duplicate_phone',
      'An account with this phone number already exists in this browser. Sign in instead.',
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function secureCrypto(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new AuthError(
      'crypto_unavailable',
      'Secure browser cryptography is unavailable. Open SmartQuiz over HTTPS or localhost to sign in.',
    );
  }
  return crypto.subtle;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const subtle = secureCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      iterations,
    },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function hashesMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function generateOtp(): string {
  const buffer = crypto.getRandomValues(new Uint32Array(1));
  return String(buffer[0] % 1_000_000).padStart(6, '0');
}

async function hashResetCode(code: string, salt: Uint8Array): Promise<string> {
  const subtle = secureCrypto();
  const codeBytes = new TextEncoder().encode(code);
  const payload = new Uint8Array(salt.length + codeBytes.length);
  payload.set(salt, 0);
  payload.set(codeBytes, salt.length);
  const digest = await subtle.digest('SHA-256', payload);
  return bytesToBase64(new Uint8Array(digest));
}

function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return 'your email';
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}

function maskPhone(phone: string): string {
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (parsed) {
      const national = parsed.nationalNumber;
      const hidden = '•'.repeat(Math.max(4, national.length - 4));
      return `+${parsed.countryCallingCode} ${hidden} ${national.slice(-4)}`;
    }
  } catch {
    // Fall back to a simple mask below.
  }
  return phone.replace(/\d(?=\d{4})/g, '•');
}

function isResetRecord(value: unknown): value is ResetRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ResetRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.accountId === 'string' &&
    (record.channel === 'email' || record.channel === 'phone') &&
    typeof record.maskedDestination === 'string' &&
    typeof record.codeSalt === 'string' &&
    typeof record.codeHash === 'string' &&
    typeof record.attempts === 'number' &&
    typeof record.createdAt === 'string' &&
    typeof record.expiresAt === 'string' &&
    (record.verifiedAt === null || typeof record.verifiedAt === 'string')
  );
}

function readResetRecord(): ResetRecord | null {
  try {
    const raw = sessionStorage.getItem(RESET_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isResetRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeResetRecord(record: ResetRecord): void {
  try {
    sessionStorage.setItem(RESET_STORAGE_KEY, JSON.stringify(record));
  } catch {
    throw new AuthError(
      'storage_unavailable',
      'This browser would not keep the reset challenge. Allow session storage and try again.',
    );
  }
}

function clearResetRecord(): void {
  try {
    sessionStorage.removeItem(RESET_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

function activeResetRecord(): ResetRecord {
  const record = readResetRecord();
  if (!record) {
    throw new AuthError(
      'reset_not_found',
      'This recovery session has expired or was closed. Start the reset again.',
    );
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    clearResetRecord();
    throw new AuthError(
      'reset_expired',
      'That one-time code has expired. Start the reset again to get a fresh code.',
    );
  }
  return record;
}

function resetExpiry(): string {
  return new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000).toISOString();
}

function buildResetTicket(record: ResetRecord, account: Account, demoCode: string): PasswordResetTicket {
  return {
    challengeId: record.id,
    accountName: account.name,
    role: account.role,
    channel: record.channel,
    maskedDestination: record.maskedDestination,
    demoCode,
    expiresAt: record.expiresAt,
    attemptsRemaining: Math.max(0, RESET_MAX_ATTEMPTS - record.attempts),
  };
}

export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<PasswordResetTicket> {
  const accounts = readAccounts();
  let account: Account | undefined;
  const channel: ResetChannel = input.channel;
  let destination = '';

  if (input.channel === 'email') {
    if (!isValidEmail(input.identifier)) {
      throw new AuthError(
        'invalid_email',
        'Enter the email address on the account you want to recover.',
      );
    }
    const email = normalizeEmail(input.identifier);
    account = accounts.find((item) => item.email === email);
    destination = email;
  } else {
    const phone = toE164(input.identifier, input.country);
    if (!phone) {
      throw new AuthError(
        'invalid_phone',
        'Enter a valid phone number for the account you want to recover.',
      );
    }
    account = accounts.find((item) => item.phone === phone);
    destination = phone;
  }

  if (!account) {
    throw new AuthError(
      'account_not_found',
      `No account in this browser uses that ${channel === 'email' ? 'email address' : 'phone number'}.`,
    );
  }

  secureCrypto();
  const demoCode = generateOtp();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const codeHash = await hashResetCode(demoCode, saltBytes);
  const maskedDestination =
    channel === 'email' ? maskEmail(destination) : maskPhone(destination);
  const record: ResetRecord = {
    id: uid('reset'),
    accountId: account.id,
    channel,
    maskedDestination,
    codeSalt: bytesToBase64(saltBytes),
    codeHash,
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: resetExpiry(),
    verifiedAt: null,
  };
  writeResetRecord(record);
  return buildResetTicket(record, account, demoCode);
}

export async function verifyPasswordResetCode(
  challengeId: string,
  code: string,
): Promise<PasswordResetVerification> {
  const record = activeResetRecord();
  if (record.id !== challengeId) {
    throw new AuthError(
      'reset_not_found',
      'That recovery session is no longer current. Start the reset again.',
    );
  }
  if (record.attempts >= RESET_MAX_ATTEMPTS) {
    throw new AuthError(
      'reset_attempts_exceeded',
      'Too many incorrect codes. Request a new code and try again.',
    );
  }

  const candidateHash = await hashResetCode(code, base64ToBytes(record.codeSalt));
  if (!hashesMatch(candidateHash, record.codeHash)) {
    const attempts = record.attempts + 1;
    writeResetRecord({ ...record, attempts });
    if (attempts >= RESET_MAX_ATTEMPTS) {
      throw new AuthError(
        'reset_attempts_exceeded',
        'That code was incorrect. No attempts remain; request a new code.',
      );
    }
    throw new AuthError(
      'invalid_otp',
      `That code is not correct. ${RESET_MAX_ATTEMPTS - attempts} attempt${
        RESET_MAX_ATTEMPTS - attempts === 1 ? '' : 's'
      } left.`,
    );
  }

  const updated: ResetRecord = { ...record, verifiedAt: new Date().toISOString() };
  writeResetRecord(updated);
  const account = readAccounts().find((item) => item.id === record.accountId);
  if (!account) {
    clearResetRecord();
    throw new AuthError('account_not_found', 'That account no longer exists in this browser.');
  }
  return {
    accountName: account.name,
    role: account.role,
    channel: record.channel,
    maskedDestination: record.maskedDestination,
    expiresAt: record.expiresAt,
  };
}

export async function resendPasswordResetCode(
  challengeId: string,
): Promise<PasswordResetTicket> {
  const record = activeResetRecord();
  if (record.id !== challengeId) {
    throw new AuthError(
      'reset_not_found',
      'That recovery session is no longer current. Start the reset again.',
    );
  }
  const account = readAccounts().find((item) => item.id === record.accountId);
  if (!account) {
    clearResetRecord();
    throw new AuthError('account_not_found', 'That account no longer exists in this browser.');
  }

  secureCrypto();
  const demoCode = generateOtp();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const codeHash = await hashResetCode(demoCode, saltBytes);
  const updated: ResetRecord = {
    ...record,
    codeSalt: bytesToBase64(saltBytes),
    codeHash,
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: resetExpiry(),
    verifiedAt: null,
  };
  writeResetRecord(updated);
  return buildResetTicket(updated, account, demoCode);
}

export async function completePasswordReset(input: {
  challengeId: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthUser> {
  const record = activeResetRecord();
  if (record.id !== input.challengeId) {
    throw new AuthError(
      'reset_not_found',
      'That recovery session is no longer current. Start the reset again.',
    );
  }
  if (!record.verifiedAt) {
    throw new AuthError('reset_not_verified', 'Verify the one-time code before setting a password.');
  }
  const passwordIssue = getPasswordIssue(input.password);
  if (passwordIssue) {
    throw new AuthError('weak_password', passwordIssue);
  }
  if (input.password !== input.confirmPassword) {
    throw new AuthError('password_mismatch', 'The two passwords do not match.');
  }

  secureCrypto();
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePasswordHash(
    input.password,
    saltBytes,
    PASSWORD_ITERATIONS,
  );

  // Re-read after the async hash so a password change is not lost to another tab.
  const accounts = readAccounts();
  const account = accounts.find((item) => item.id === record.accountId);
  if (!account) {
    clearResetRecord();
    throw new AuthError('account_not_found', 'That account no longer exists in this browser.');
  }
  const updated: Account = {
    ...account,
    passwordHash,
    passwordSalt: bytesToBase64(saltBytes),
    passwordIterations: PASSWORD_ITERATIONS,
  };
  writeAccounts(accounts.map((item) => (item.id === updated.id ? updated : item)));
  clearResetRecord();
  return toAuthUser(updated);
}

export async function createAccount(input: RegisterInput): Promise<Account> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    throw new AuthError('invalid_name', 'Enter your full name.');
  }
  if (name.length > 60) {
    throw new AuthError('invalid_name', 'Keep your name under 60 characters.');
  }
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new AuthError('invalid_email', 'Enter a valid email address, such as you@gmail.com.');
  }
  const phone = toE164(input.phone, input.country);
  if (!phone) {
    throw new AuthError(
      'invalid_phone',
      'Enter a valid phone number for the selected country.',
    );
  }
  const passwordIssue = getPasswordIssue(input.password);
  if (passwordIssue) {
    throw new AuthError('weak_password', passwordIssue);
  }
  if (input.password !== input.confirmPassword) {
    throw new AuthError('password_mismatch', 'The two passwords do not match.');
  }

  const accounts = readAccounts();
  assertDuplicateFree(accounts, email, phone);
  if (input.role === 'admin' && accounts.some((account) => account.role === 'admin')) {
    throw new AuthError(
      'admin_exists',
      'This workspace already has an administrator. Sign in with that account instead.',
    );
  }

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await derivePasswordHash(
    input.password,
    saltBytes,
    PASSWORD_ITERATIONS,
  );

  // Re-read after the async hash so a second tab cannot slip a duplicate in.
  const freshAccounts = readAccounts();
  assertDuplicateFree(freshAccounts, email, phone);
  if (input.role === 'admin' && freshAccounts.some((item) => item.role === 'admin')) {
    throw new AuthError(
      'admin_exists',
      'This workspace already has an administrator. Sign in with that account instead.',
    );
  }

  const createdAt = new Date().toISOString();
  const usedRollNumbers = new Set(freshAccounts.map((item) => item.rollNumber));
  const account: Account = {
    id: uid('user'),
    name,
    email,
    phone,
    country: input.country,
    role: input.role,
    rollNumber: makeRollNumber(input.role, createdAt, usedRollNumbers),
    avatar: null,
    passwordHash,
    passwordSalt: bytesToBase64(saltBytes),
    passwordIterations: PASSWORD_ITERATIONS,
    createdAt,
    lastLoginAt: null,
  };

  freshAccounts.push(account);
  writeAccounts(freshAccounts);
  return account;
}

export interface ProfileUpdateInput {
  name: string;
  avatar: string | null;
}

export function updateAccountProfile(
  accountId: string,
  input: ProfileUpdateInput,
): AuthUser {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    throw new AuthError('invalid_name', 'Enter your full name.');
  }
  if (name.length > 60) {
    throw new AuthError('invalid_name', 'Keep your name under 60 characters.');
  }
  const avatar = input.avatar === null ? null : normalizeAvatar(input.avatar);
  if (input.avatar !== null && !avatar) {
    throw new AuthError(
      'invalid_avatar',
      'Use a JPG, PNG, WEBP or GIF image. Large photos are resized automatically.',
    );
  }

  const accounts = readAccounts();
  const account = accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new AuthError('account_not_found', 'That account no longer exists in this browser.');
  }
  const updated: Account = { ...account, name, avatar };
  writeAccounts(accounts.map((item) => (item.id === accountId ? updated : item)));
  return toAuthUser(updated);
}

export async function signIn(input: SignInInput): Promise<Account> {
  const identifier = input.identifier.trim();
  const accounts = readAccounts();
  const lookup = identifier.toLowerCase();
  const account = identifier.includes('@')
    ? accounts.find((item) => item.email === lookup)
    : accounts.find(
        (item) => item.phone === identifier.replace(/[\s().-]/g, ''),
      );

  const salt = account ? base64ToBytes(account.passwordSalt) : base64ToBytes(DUMMY_SALT);
  const iterations = account?.passwordIterations ?? PASSWORD_ITERATIONS;
  const candidateHash = await derivePasswordHash(input.password, salt, iterations);

  if (!account || !hashesMatch(candidateHash, account.passwordHash)) {
    throw new AuthError(
      'invalid_credentials',
      'That email or phone and password do not match an account in this browser.',
    );
  }

  const updated: Account = { ...account, lastLoginAt: new Date().toISOString() };
  try {
    writeAccounts(
      accounts.map((item) => (item.id === account.id ? updated : item)),
    );
  } catch {
    // A successful sign-in should not fail just because lastLoginAt could not be written.
  }
  return updated;
}
