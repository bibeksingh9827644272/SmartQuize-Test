interface ScoreRingProps {
  percent: number;
  passed: boolean;
  size?: 'md' | 'lg';
}

export function ScoreRing({ percent, passed, size = 'lg' }: ScoreRingProps) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - normalized / 100);

  return (
    <div
      className={`score-ring score-ring--${size} ${passed ? 'is-passed' : 'is-failed'}`}
      role="img"
      aria-label={`Score ${percent} percent`}
    >
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="score-ring-track" cx="70" cy="70" r={radius} />
        <circle
          className="score-ring-value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-label">
        <strong>{Math.round(percent)}%</strong>
        <span>score</span>
      </div>
    </div>
  );
}
