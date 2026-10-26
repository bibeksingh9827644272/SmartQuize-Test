import {
  getPasswordIssue,
  getCountryOptions,
  passwordStrength,
  phoneExample,
  PASSWORD_MIN_LENGTH,
  type CountryCode,
} from '../lib/auth';

interface PhoneFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  country: CountryCode;
  phone: string;
  autoComplete?: string;
  onCountryChange: (country: CountryCode) => void;
  onPhoneChange: (phone: string) => void;
}

export function PhoneField({
  id,
  label,
  hint,
  error,
  country,
  phone,
  autoComplete = 'tel-national',
  onCountryChange,
  onPhoneChange,
}: PhoneFieldProps) {
  const countries = getCountryOptions();
  const dialCode = countries.find((item) => item.code === country)?.dialCode ?? '';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field auth-field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        <span className="optional-label">any country</span>
      </label>
      <div className="phone-field">
        <select
          className="phone-country"
          value={country}
          onChange={(event) => onCountryChange(event.target.value as CountryCode)}
          aria-label="Country for the phone number"
        >
          {countries.map((item) => (
            <option value={item.code} key={item.code}>
              {item.name}
            </option>
          ))}
        </select>
        <div className="phone-input-shell">
          <span className="phone-dial" aria-hidden="true">
            {dialCode}
          </span>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete}
            value={phone}
            placeholder={phoneExample(country)}
            maxLength={24}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) =>
              onPhoneChange(
                event.target.value.replace(/[^\d+()\-\s]/g, '').slice(0, 24),
              )
            }
          />
        </div>
      </div>
      {error ? (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      ) : hint ? (
        <span className="field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function PasswordMeter({ password }: { password: string }) {
  const score = passwordStrength(password);
  const issue = password ? getPasswordIssue(password) : `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  const note =
    issue ??
    (score >= 3 ? 'Strong password.' : 'Good password — more length makes it stronger.');

  return (
    <div className="password-meter" aria-live="polite">
      <div className="password-meter-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={level <= score ? `is-filled is-level-${score}` : ''}
          />
        ))}
      </div>
      <span>{note}</span>
    </div>
  );
}
