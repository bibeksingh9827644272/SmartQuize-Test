import { Check, MinusCircle, X } from 'lucide-react';
import type { Attempt } from '../types';
import { OPTION_LETTERS } from '../lib/quiz';

export function AnswerReview({ attempt }: { attempt: Attempt }) {
  return (
    <div className="review-list">
      {attempt.questions.map((question, index) => {
        const chosen = attempt.answers[question.id];
        const isCorrect = chosen === question.correctOptionId;
        const state = !chosen ? 'skipped' : isCorrect ? 'correct' : 'incorrect';
        const correctIndex = question.options.findIndex(
          (option) => option.id === question.correctOptionId,
        );

        return (
          <article className={`review-card review-card--${state}`} key={question.id}>
            <header className="review-head">
              <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
              <div className="review-title">
                <p>{question.prompt || 'Untitled question'}</p>
                <span className="review-meta">
                  {Math.max(1, question.points)} {question.points === 1 ? 'point' : 'points'}
                  {correctIndex >= 0 && (
                    <> · Answer {OPTION_LETTERS[correctIndex] ?? correctIndex + 1}</>
                  )}
                </span>
              </div>
              <span className={`review-state review-state--${state}`}>
                {state === 'correct' && <Check size={14} />}
                {state === 'incorrect' && <X size={14} />}
                {state === 'skipped' && <MinusCircle size={14} />}
                {state === 'correct' ? 'Correct' : state === 'incorrect' ? 'Incorrect' : 'Skipped'}
              </span>
            </header>

            <div className="review-options">
              {question.options.map((option, optionIndex) => {
                const isAnswer = option.id === question.correctOptionId;
                const wasChosen = option.id === chosen;
                const optionState = isAnswer
                  ? 'answer'
                  : wasChosen
                    ? 'chosen-wrong'
                    : 'idle';

                return (
                  <div className={`review-option review-option--${optionState}`} key={option.id}>
                    <span className="option-letter">{OPTION_LETTERS[optionIndex] ?? '?'}</span>
                    <span className="review-option-text">{option.text}</span>
                    {wasChosen && <span className="option-tag">Your answer</span>}
                    {isAnswer && !wasChosen && <span className="option-tag option-tag--key">Key</span>}
                    {isAnswer && wasChosen && (
                      <Check className="review-option-icon" size={17} />
                    )}
                  </div>
                );
              })}
            </div>

            {question.explanation && (
              <div className="explanation">
                <span>Why</span>
                <p>{question.explanation}</p>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
