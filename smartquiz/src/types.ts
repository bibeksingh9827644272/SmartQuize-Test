export type ExamStatus = 'draft' | 'published';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string | null;
  points: number;
  explanation: string;
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  subject: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  passPercent: number;
  questions: Question[];
  status: ExamStatus;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExamContent = Pick<
  Exam,
  | 'title'
  | 'subject'
  | 'description'
  | 'instructions'
  | 'durationMinutes'
  | 'passPercent'
  | 'questions'
  | 'opensAt'
  | 'closesAt'
>;

export type Answers = Record<string, string>;

export interface ActiveAttempt {
  id: string;
  examId: string;
  examTitle: string;
  examCode: string;
  studentId?: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  deadlineAt: string;
  lastSavedAt: string;
  durationMinutes: number;
  passPercent: number;
  questions: Question[];
  answers: Answers;
}

export interface Attempt {
  id: string;
  examId: string;
  examTitle: string;
  examCode: string;
  studentId?: string;
  studentName: string;
  studentEmail: string;
  startedAt: string;
  submittedAt: string;
  timeSpentSec: number;
  autoSubmitted: boolean;
  durationMinutes: number;
  passPercent: number;
  questions: Question[];
  answers: Answers;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  correctCount: number;
}

export interface ExamStats {
  attempts: number;
  passRate: number;
  averagePercent: number;
  highestPercent: number;
}
