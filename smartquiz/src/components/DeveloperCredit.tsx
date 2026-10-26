import bibekPhoto from '../assets/bibek-singh.jpg';

interface DeveloperCreditProps {
  inline?: boolean;
  inverse?: boolean;
  className?: string;
}

export function DeveloperCredit({
  inline = false,
  inverse = false,
  className: extraClassName,
}: DeveloperCreditProps) {
  const className = [
    'developer-credit',
    inline ? 'developer-credit--inline' : '',
    inverse ? 'developer-credit--inverse' : '',
    extraClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={className} aria-label="Developed by Bibek Singh">
      <img src={bibekPhoto} alt="Bibek Singh" />
      <span className="developer-credit-copy">
        <small>Developed by</small>
        <strong>Bibek Singh</strong>
      </span>
    </aside>
  );
}
