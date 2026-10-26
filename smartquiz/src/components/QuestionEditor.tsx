import { useId } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Question } from '../types';
import { OPTION_LETTERS } from '../lib/quiz';
import { uid } from '../lib/ids';

interface QuestionEditorProps {
  question: Question;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onChange: (question: Question) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

export function QuestionEditor({
  question,
  index,
  total,
  open,
  onToggle,
  onChange,
  onMove,
  onDelete,
}: QuestionEditorProps) {
  const bodyId = useId();
  const promptId = useId();
  const pointsId = useId();
  const explanationId = useId();
  const correctIndex = question.options.findIndex(
    (option) => option.id === question.correctOptionId,
  );

  const update = (partial: Partial<Question>) => onChange({ ...question, ...partial });

  const updateOption = (optionId: string, text: string) => {
    update({
      options: question.options.map((option) =>
        option.id === optionId ? { ...option, text } : option,
      ),
    });
  };

  const addOption = () => {
    if (question.options.length >= 6) return;
    update({
      options: [...question.options, { id: uid('o'), text: '' }],
    });
  };

  const removeOption = (optionId: string) => {
    if (question.options.length <= 2) return;
    const nextOptions = question.options.filter((option) => option.id !== optionId);
    update({
      options: nextOptions,
      correctOptionId:
        question.correctOptionId === optionId ? null : question.correctOptionId,
    });
  };

  return (
    <article className={`q-editor${open ? ' is-open' : ''}`} id={`question-${question.id}`}>
      <div className="q-editor-summary">
        <button
          type="button"
          className="q-summary-toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="q-summary-copy">
            <strong>{question.prompt.trim() || 'Untitled question'}</strong>
            <span>
              {question.options.length} options · {Math.max(1, question.points)}{' '}
              {question.points === 1 ? 'point' : 'points'}
              {question.correctOptionId ? (
                <em className="q-key q-key--set">
                  <Check size={12} />
                  Key {OPTION_LETTERS[correctIndex] ?? ''}
                </em>
              ) : (
                <em className="q-key q-key--missing">No answer key</em>
              )}
            </span>
          </span>
        </button>
        <div className="q-summary-actions">
          <button
            type="button"
            className="icon-btn icon-btn--quiet"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move question ${index + 1} up`}
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--quiet"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move question ${index + 1} down`}
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--quiet icon-btn--danger"
            onClick={onDelete}
            aria-label={`Delete question ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
          <button
            type="button"
            className="icon-btn q-chevron"
            onClick={onToggle}
            aria-label={open ? 'Collapse question' : 'Expand question'}
          >
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="q-editor-body" id={bodyId}>
          <label className="field">
            <span className="field-label">Question prompt</span>
            <textarea
              id={promptId}
              rows={2}
              value={question.prompt}
              onChange={(event) => update({ prompt: event.target.value })}
              placeholder="Type the question exactly as students should see it…"
              autoFocus={!question.prompt}
            />
          </label>

          <div className="option-editor-head">
            <span className="field-label">Answer options</span>
            <span className="field-hint">Choose the correct one below</span>
          </div>

          <div className="option-editor-list">
            {question.options.map((option, optionIndex) => (
              <div
                className={`option-editor-row${
                  option.id === question.correctOptionId ? ' is-correct' : ''
                }`}
                key={option.id}
              >
                <span className="option-letter">{OPTION_LETTERS[optionIndex] ?? '?'}</span>
                <input
                  type="text"
                  value={option.text}
                  onChange={(event) => updateOption(option.id, event.target.value)}
                  placeholder={`Option ${OPTION_LETTERS[optionIndex] ?? optionIndex + 1}`}
                  aria-label={`Option ${OPTION_LETTERS[optionIndex] ?? optionIndex + 1}`}
                />
                {option.id === question.correctOptionId && (
                  <span className="correct-marker">
                    <Check size={13} />
                    Correct
                  </span>
                )}
                <button
                  type="button"
                  className="option-remove"
                  onClick={() => removeOption(option.id)}
                  disabled={question.options.length <= 2}
                  aria-label={`Remove option ${OPTION_LETTERS[optionIndex] ?? optionIndex + 1}`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="option-editor-tools">
            <button
              type="button"
              className="text-button"
              onClick={addOption}
              disabled={question.options.length >= 6}
            >
              <Plus size={15} />
              Add option
            </button>
            <span>{Math.max(0, 6 - question.options.length)} option slots left</span>
          </div>

          <div className="correct-picker">
            <div>
              <span className="field-label">Correct answer</span>
              <p>Click a letter to set the answer key.</p>
            </div>
            <div className="correct-letter-group" role="group" aria-label="Correct answer">
              {question.options.map((option, optionIndex) => {
                const isSelected = option.id === question.correctOptionId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`correct-letter${isSelected ? ' is-selected' : ''}`}
                    onClick={() => update({ correctOptionId: isSelected ? null : option.id })}
                    aria-pressed={isSelected}
                    aria-label={`Mark option ${OPTION_LETTERS[optionIndex]} as correct`}
                  >
                    {isSelected && <Check size={13} />}
                    {OPTION_LETTERS[optionIndex] ?? optionIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="q-editor-settings">
            <label className="field field--points">
              <span className="field-label">Points</span>
              <input
                id={pointsId}
                type="number"
                min={1}
                max={50}
                step={1}
                value={question.points}
                onChange={(event) =>
                  update({ points: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">
                Explanation <span className="optional-label">optional</span>
              </span>
              <input
                id={explanationId}
                type="text"
                value={question.explanation}
                onChange={(event) => update({ explanation: event.target.value })}
                placeholder="Shown with the answer when a student reviews the paper."
              />
            </label>
          </div>
        </div>
      )}
    </article>
  );
}
