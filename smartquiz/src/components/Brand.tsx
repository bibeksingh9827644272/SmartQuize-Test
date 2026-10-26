import { Check, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BrandProps {
  to?: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
}

export function Brand({ to = '/', tone = 'dark', compact = false }: BrandProps) {
  return (
    <Link className={`brand brand--${tone}`} to={to} aria-label="SmartQuiz home">
      <span className="brand-mark" aria-hidden="true">
        <FileText strokeWidth={1.8} />
        <span className="brand-mark-check">
          <Check strokeWidth={3} />
        </span>
      </span>
      {!compact && (
        <span className="brand-copy">
          <span className="brand-name">SmartQuiz</span>
          <span className="brand-tagline">smart exam studio</span>
        </span>
      )}
    </Link>
  );
}
