export interface ParsedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number | null;
  explanation: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  warnings: string[];
}

interface OptionMatch {
  letter: string;
  index: number;
  contentStart: number;
}

const QUESTION_START = /^(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[.)\]:\-–]\s*(.*)$/i;
const OPTION_START = /^(?:\(([A-Ha-h])\)|([A-Ha-h])\s*[.)\]:\-–])\s*(.*)$/;
const ANSWER_LINE =
  /^(?:the\s+)?(?:correct\s+)?(?:answer|ans|key)\b(?:\s+is)?\s*[:\-–=]?\s*(?:option\s*)?\(?([A-Ha-h])\)?\b/i;
const EXPLANATION_LINE = /^(?:explanation|reason|why)\s*[:\-–]\s*(.*)$/i;
const INLINE_ANSWER =
  /\b(?:the\s+)?(?:correct\s+)?(?:answer|ans)\b(?:\s+is)?\s*[:\-–=]?\s*(?:option\s*)?\(?([A-Ha-h])\)?\b/i;
const INLINE_EXPLANATION = /\b(?:explanation|reason)\s*[:\-–]\s*(.+)$/i;
const ANSWER_SUFFIX = /\s*(?:\(\s*(?:correct|answer)\s*\)|\*\s*)$/i;
const IGNORED_LINE =
  /^(?:[-–—_=•·]{3,}|page\s+\d+(?:\s+of\s+\d+)?|\[?page\s*\d+\]?|={2,}.*={2,}|\d+\s*\/\s*\d+)$/i;

function nextLetter(letter: string): string {
  return String.fromCharCode(letter.charCodeAt(0) + 1);
}

function findSequentialOptions(text: string): OptionMatch[] | null {
  const marker = /(?:^|[\s;,])(?:\(([A-Ha-h])\)|([A-Ha-h])[.)])\s+/g;
  const matches: OptionMatch[] = [];

  for (const match of text.matchAll(marker)) {
    const letter = (match[1] ?? match[2] ?? '').toUpperCase();
    if (!letter || match.index === undefined) continue;
    matches.push({
      letter,
      index: match.index,
      contentStart: match.index + match[0].length,
    });
  }

  if (matches.length < 2) return null;

  const firstA = matches.findIndex((match) => match.letter === 'A');
  if (firstA < 0) return null;

  const sequence: OptionMatch[] = [];
  let expected = 'A';
  for (let i = firstA; i < matches.length; i += 1) {
    const match = matches[i];
    if (match.letter !== expected) break;
    sequence.push(match);
    expected = nextLetter(expected);
  }

  return sequence.length >= 2 ? sequence : null;
}

function extractAnchoredMeta(body: string): {
  body: string;
  answerLetter: string | null;
  explanation: string;
} {
  let clean = body;
  let answerLetter: string | null = null;
  let explanation = '';

  const answer = clean.match(INLINE_ANSWER);
  if (answer?.index !== undefined) {
    answerLetter = answer[1].toUpperCase();
    clean = clean.slice(0, answer.index).trim();
  }

  const expl = clean.match(INLINE_EXPLANATION);
  if (expl?.index !== undefined) {
    explanation = expl[1].trim();
    clean = clean.slice(0, expl.index).trim();
  }

  return { body: clean, answerLetter, explanation };
}

function splitInlineOptions(body: string): {
  stem: string;
  options: { letter: string; text: string }[];
  answerLetter: string | null;
  explanation: string;
} | null {
  const meta = extractAnchoredMeta(body);
  const sequence = findSequentialOptions(meta.body);
  if (!sequence) return null;

  const first = sequence[0];
  const stem = meta.body.slice(0, first.index).trim();
  const options = sequence.map((match, index) => {
    const end = sequence[index + 1]?.index ?? meta.body.length;
    const text = meta.body.slice(match.contentStart, end).trim().replace(/\s+/g, ' ');
    return { letter: match.letter, text };
  });

  return {
    stem,
    options,
    answerLetter: meta.answerLetter,
    explanation: meta.explanation,
  };
}

function expandInlineLines(text: string): string[] {
  const source = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/^[\s•·▪◦]+/, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  const expanded: string[] = [];

  for (const line of source) {
    if (!line) {
      expanded.push('');
      continue;
    }

    const question = line.match(QUESTION_START);
    if (question) {
      const split = splitInlineOptions(question[2]);
      if (split && split.options.length >= 2) {
        expanded.push(`${question[1]}. ${split.stem}`.trim());
        split.options.forEach((option) => {
          expanded.push(`${option.letter}. ${option.text}`.trim());
        });
        if (split.answerLetter) expanded.push(`Answer: ${split.answerLetter}`);
        if (split.explanation) expanded.push(`Explanation: ${split.explanation}`);
        continue;
      }
    }

    const split = splitInlineOptions(line);
    if (split && split.options.length >= 2 && !question) {
      if (split.stem) expanded.push(split.stem);
      split.options.forEach((option) => {
        expanded.push(`${option.letter}. ${option.text}`.trim());
      });
      if (split.answerLetter) expanded.push(`Answer: ${split.answerLetter}`);
      if (split.explanation) expanded.push(`Explanation: ${split.explanation}`);
      continue;
    }

    expanded.push(line);
  }

  return expanded;
}

interface DraftQuestion {
  prompt: string;
  options: { letter: string; text: string }[];
  answerLetter: string | null;
  explanation: string;
}

export function parseMcqs(text: string): ParseResult {
  const lines = expandInlineLines(text);
  const warnings: string[] = [];
  const drafts: DraftQuestion[] = [];
  const state: {
    current: DraftQuestion | null;
    mode: 'prompt' | 'option' | 'answer' | 'explanation';
  } = { current: null, mode: 'prompt' };
  let skippedBlocks = 0;

  const flush = () => {
    const question = state.current;
    if (!question) return;
    if (question.options.length >= 2) {
      drafts.push(question);
    } else if (question.prompt.trim()) {
      skippedBlocks += 1;
    }
    state.current = null;
  };

  const startQuestion = (prompt: string) => {
    state.current = {
      prompt: prompt.trim(),
      options: [],
      answerLetter: null,
      explanation: '',
    };
    state.mode = 'prompt';
  };

  const appendToLastOption = (value: string) => {
    const question = state.current;
    if (!question || question.options.length === 0) return;
    const last = question.options[question.options.length - 1];
    last.text = `${last.text} ${value}`.replace(/\s+/g, ' ').trim();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (IGNORED_LINE.test(line)) continue;

    const answer = line.match(ANSWER_LINE);
    if (answer) {
      const question = state.current;
      if (question) {
        question.answerLetter = answer[1].toUpperCase();
        state.mode = 'answer';
        continue;
      }
    }

    const explanation = line.match(EXPLANATION_LINE);
    if (explanation) {
      const question = state.current;
      if (question) {
        question.explanation = explanation[1].trim();
        state.mode = 'explanation';
        continue;
      }
    }

    const question = line.match(QUESTION_START);
    if (question) {
      flush();
      startQuestion(question[2]);
      continue;
    }

    const option = line.match(OPTION_START);
    if (option) {
      if (!state.current) startQuestion('');
      const letter = (option[1] ?? option[2]).toUpperCase();
      let optionText = option[3].trim();
      const current = state.current;

      if (current && ANSWER_SUFFIX.test(optionText)) {
        current.answerLetter = letter;
        optionText = optionText.replace(ANSWER_SUFFIX, '').trim();
      }

      if (current) {
        current.options.push({ letter, text: optionText });
        state.mode = 'option';
      }
      continue;
    }

    if (!state.current) {
      const upcoming = lines.slice(index + 1).find(Boolean) ?? '';
      if (OPTION_START.test(upcoming) && !IGNORED_LINE.test(upcoming)) {
        startQuestion(line);
      }
      continue;
    }

    const current = state.current;
    const inlineCorrect = line.match(
      /^(?:the\s+)?correct\s+(?:answer|option)\s+(?:is\s+)?\(?([A-Ha-h])\)?\b/i,
    );
    if (inlineCorrect) {
      current.answerLetter = inlineCorrect[1].toUpperCase();
      state.mode = 'answer';
      continue;
    }

    if (state.mode === 'option') {
      appendToLastOption(line);
    } else if (state.mode === 'prompt') {
      current.prompt = `${current.prompt} ${line}`.replace(/\s+/g, ' ').trim();
    } else if (state.mode === 'explanation') {
      current.explanation = `${current.explanation} ${line}`.replace(/\s+/g, ' ').trim();
    }
  }

  flush();

  const questions: ParsedQuestion[] = drafts.map((draft) => {
    const options = draft.options.map((option) =>
      option.text.replace(/^\s*[*✓✔]+\s*|[*✓✔]+\s*$/g, '').trim(),
    );
    let correctIndex: number | null = draft.answerLetter
      ? draft.options.findIndex((option) => option.letter === draft.answerLetter)
      : null;

    if (correctIndex === -1) {
      warnings.push(
        `An answer key mentions option ${draft.answerLetter}, but that option was not found.`,
      );
      correctIndex = null;
    }

    if (!draft.answerLetter) {
      const starred = draft.options.findIndex((option) => /[*✓✔]/.test(option.text));
      if (starred >= 0) correctIndex = starred;
    }

    return {
      prompt: draft.prompt.replace(/^\s*[-–—]\s*/, '').trim(),
      options,
      correctIndex,
      explanation: draft.explanation.trim(),
    };
  });

  if (questions.length === 0) {
    warnings.push(
      'No numbered multiple-choice questions were found. Check that each question is numbered and options start with A, B, C…',
    );
  }
  if (skippedBlocks > 0) {
    warnings.push(`${skippedBlocks} numbered block(s) did not contain at least two options.`);
  }

  const missingAnswers = questions.filter((question) => question.correctIndex === null).length;
  if (missingAnswers > 0) {
    warnings.push(
      `${missingAnswers} question${missingAnswers === 1 ? ' is' : 's are'} missing an answer key. Set the correct answer before publishing.`,
    );
  }

  return { questions, warnings };
}
