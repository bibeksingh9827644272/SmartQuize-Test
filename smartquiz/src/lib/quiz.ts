import type { Attempt, Exam, ExamContent, ExamStats, Question } from '../types';
import { uid } from './ids';

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function newQuestion(): Question {
  return {
    id: uid('q'),
    prompt: '',
    options: OPTION_LETTERS.slice(0, 4).map(() => ({
      id: uid('o'),
      text: '',
    })),
    correctOptionId: null,
    points: 1,
    explanation: '',
  };
}

export function totalPoints(questions: Question[]): number {
  return questions.reduce((sum, question) => sum + Math.max(1, question.points), 0);
}

export function examStats(exam: Exam, attempts: Attempt[]): ExamStats {
  const relevant = attempts.filter((attempt) => attempt.examId === exam.id);
  if (relevant.length === 0) {
    return { attempts: 0, passRate: 0, averagePercent: 0, highestPercent: 0 };
  }
  const passed = relevant.filter((attempt) => attempt.passed).length;
  const totalPercent = relevant.reduce((sum, attempt) => sum + attempt.percent, 0);
  return {
    attempts: relevant.length,
    passRate: Math.round((passed / relevant.length) * 100),
    averagePercent: Math.round(totalPercent / relevant.length),
    highestPercent: Math.max(...relevant.map((attempt) => attempt.percent)),
  };
}

export interface PublishIssue {
  questionId?: string;
  message: string;
}

export function validateExamContent(exam: ExamContent): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (!exam.title.trim()) issues.push({ message: 'Give the exam a title.' });
  if (!exam.subject.trim()) issues.push({ message: 'Add a subject.' });
  if (!Number.isFinite(exam.durationMinutes) || exam.durationMinutes < 1) {
    issues.push({ message: 'Duration must be at least 1 minute.' });
  }
  if (exam.durationMinutes > 300) {
    issues.push({ message: 'Keep the duration at 300 minutes or less.' });
  }
  if (!Number.isFinite(exam.passPercent) || exam.passPercent < 0 || exam.passPercent > 100) {
    issues.push({ message: 'Pass mark must be between 0 and 100.' });
  }
  if (exam.questions.length === 0) {
    issues.push({ message: 'Add at least one question.' });
  }

  exam.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (!question.prompt.trim()) {
      issues.push({ questionId: question.id, message: `${label} needs a prompt.` });
    }
    if (question.options.length < 2) {
      issues.push({ questionId: question.id, message: `${label} needs at least two options.` });
    }
    if (question.options.some((option) => !option.text.trim())) {
      issues.push({ questionId: question.id, message: `${label} has a blank option.` });
    }
    if (!question.correctOptionId) {
      issues.push({ questionId: question.id, message: `${label} needs a correct answer.` });
    } else if (!question.options.some((option) => option.id === question.correctOptionId)) {
      issues.push({ questionId: question.id, message: `${label} has an invalid answer key.` });
    }
    if (!Number.isFinite(question.points) || question.points < 1) {
      issues.push({ questionId: question.id, message: `${label} must be worth at least 1 point.` });
    }
  });

  return issues;
}

export function scoreAttempt(params: {
  exam: Pick<Exam, 'id' | 'title' | 'code' | 'passPercent' | 'durationMinutes'>;
  questions: Question[];
  answers: Record<string, string>;
  studentId?: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  submittedAt: string;
  autoSubmitted: boolean;
}): Attempt {
  const { exam, questions, answers } = params;
  let score = 0;
  let correctCount = 0;
  let maxScore = 0;

  const reviewed = questions.map((question) => {
    const points = Math.max(1, question.points);
    maxScore += points;
    const answer = answers[question.id];
    if (answer && answer === question.correctOptionId) {
      score += points;
      correctCount += 1;
    }
    return question;
  });

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const started = new Date(params.startedAt).getTime();
  const submitted = new Date(params.submittedAt).getTime();

  return {
    id: uid('attempt'),
    examId: exam.id,
    examTitle: exam.title,
    examCode: exam.code,
    studentId: params.studentId,
    studentName: params.studentName.trim(),
    studentEmail: params.studentEmail.trim(),
    startedAt: params.startedAt,
    submittedAt: params.submittedAt,
    timeSpentSec: Math.max(0, Math.round((submitted - started) / 1000)),
    autoSubmitted: params.autoSubmitted,
    durationMinutes: exam.durationMinutes,
    passPercent: exam.passPercent,
    questions: reviewed,
    answers,
    score,
    maxScore,
    percent,
    passed: percent >= exam.passPercent,
    correctCount,
  };
}

export function escapeCsv(value: string | number | boolean): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function attemptsToCsv(attempts: Attempt[]): string {
  const headers = [
    'Student',
    'Email',
    'Exam',
    'Submitted',
    'Score',
    'Max score',
    'Percent',
    'Result',
    'Time spent (sec)',
    'Auto submitted',
  ];
  const rows = attempts.map((attempt) => [
    attempt.studentName,
    attempt.studentEmail,
    attempt.examTitle,
    new Date(attempt.submittedAt).toISOString(),
    attempt.score,
    attempt.maxScore,
    attempt.percent,
    attempt.passed ? 'Pass' : 'Fail',
    attempt.timeSpentSec,
    attempt.autoSubmitted ? 'Yes' : 'No',
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function downloadTextFile(filename: string, content: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'exam'
  );
}

export function stripQuestionForSnapshot(question: Question): Question {
  return {
    ...question,
    options: question.options.map((option) => ({ ...option })),
  };
}
