import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ActiveAttempt, Attempt, Exam, ExamContent, ExamStatus } from '../types';
import { makeExamCode, uid } from '../lib/ids';
import { createSampleExam } from './seed';

const STORAGE_KEY = 'quizpaper.workspace.v1';

interface Workspace {
  exams: Exam[];
  attempts: Attempt[];
  activeAttempts: ActiveAttempt[];
}

export interface AppStore extends Workspace {
  createExam: (content: ExamContent, status?: ExamStatus) => Exam;
  updateExam: (id: string, content: ExamContent) => void;
  publishExam: (id: string, content: ExamContent) => void;
  setExamStatus: (id: string, status: ExamStatus) => void;
  deleteExam: (id: string) => void;
  addSampleExam: () => Exam;
  saveAttempt: (attempt: Attempt) => void;
  saveActiveAttempt: (attempt: ActiveAttempt) => void;
  deleteActiveAttempt: (id: string) => void;
}

const EMPTY_WORKSPACE: Workspace = {
  exams: [],
  attempts: [],
  activeAttempts: [],
};

function readWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    return {
      exams: Array.isArray(parsed.exams)
        ? parsed.exams.map((exam) => ({
            ...exam,
            opensAt: typeof exam.opensAt === 'string' ? exam.opensAt : null,
            closesAt: typeof exam.closesAt === 'string' ? exam.closesAt : null,
          }))
        : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      activeAttempts: Array.isArray(parsed.activeAttempts) ? parsed.activeAttempts : [],
    };
  } catch {
    return EMPTY_WORKSPACE;
  }
}

function persist(workspace: Workspace) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Storage may be unavailable or full in private browsing; the app can keep running in memory.
  }
}

const StoreContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(readWorkspace);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        setWorkspace(readWorkspace());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const commit = useCallback((updater: (previous: Workspace) => Workspace) => {
    setWorkspace((previous) => {
      const next = updater(previous);
      persist(next);
      return next;
    });
  }, []);

  const createExam = useCallback(
    (content: ExamContent, status: ExamStatus = 'draft'): Exam => {
      const now = new Date().toISOString();
      const existingCodes = workspace.exams.map((exam) => exam.code);
      const exam: Exam = {
        ...content,
        id: uid('exam'),
        code: makeExamCode(existingCodes),
        status,
        createdAt: now,
        updatedAt: now,
      };
      commit((previous) => ({ ...previous, exams: [exam, ...previous.exams] }));
      return exam;
    },
    [commit, workspace.exams],
  );

  const updateExam = useCallback(
    (id: string, content: ExamContent) => {
      commit((previous) => ({
        ...previous,
        exams: previous.exams.map((exam) =>
          exam.id === id
            ? { ...exam, ...content, updatedAt: new Date().toISOString() }
            : exam,
        ),
      }));
    },
    [commit],
  );

  const publishExam = useCallback(
    (id: string, content: ExamContent) => {
      commit((previous) => ({
        ...previous,
        exams: previous.exams.map((exam) =>
          exam.id === id
            ? { ...exam, ...content, status: 'published', updatedAt: new Date().toISOString() }
            : exam,
        ),
      }));
    },
    [commit],
  );

  const setExamStatus = useCallback(
    (id: string, status: ExamStatus) => {
      commit((previous) => ({
        ...previous,
        exams: previous.exams.map((exam) =>
          exam.id === id ? { ...exam, status, updatedAt: new Date().toISOString() } : exam,
        ),
      }));
    },
    [commit],
  );

  const deleteExam = useCallback(
    (id: string) => {
      commit((previous) => ({
        exams: previous.exams.filter((exam) => exam.id !== id),
        attempts: previous.attempts.filter((attempt) => attempt.examId !== id),
        activeAttempts: previous.activeAttempts.filter((attempt) => attempt.examId !== id),
      }));
    },
    [commit],
  );

  const addSampleExam = useCallback((): Exam => {
    const exam = createSampleExam(workspace.exams.map((item) => item.code));
    commit((previous) => ({ ...previous, exams: [exam, ...previous.exams] }));
    return exam;
  }, [commit, workspace.exams]);

  const saveAttempt = useCallback(
    (attempt: Attempt) => {
      commit((previous) => ({
        ...previous,
        attempts: [attempt, ...previous.attempts],
      }));
    },
    [commit],
  );

  const saveActiveAttempt = useCallback(
    (attempt: ActiveAttempt) => {
      commit((previous) => {
        const exists = previous.activeAttempts.some((item) => item.id === attempt.id);
        return {
          ...previous,
          activeAttempts: exists
            ? previous.activeAttempts.map((item) => (item.id === attempt.id ? attempt : item))
            : [attempt, ...previous.activeAttempts],
        };
      });
    },
    [commit],
  );

  const deleteActiveAttempt = useCallback(
    (id: string) => {
      commit((previous) => ({
        ...previous,
        activeAttempts: previous.activeAttempts.filter((attempt) => attempt.id !== id),
      }));
    },
    [commit],
  );

  const value = useMemo<AppStore>(
    () => ({
      ...workspace,
      createExam,
      updateExam,
      publishExam,
      setExamStatus,
      deleteExam,
      addSampleExam,
      saveAttempt,
      saveActiveAttempt,
      deleteActiveAttempt,
    }),
    [
      workspace,
      createExam,
      updateExam,
      publishExam,
      setExamStatus,
      deleteExam,
      addSampleExam,
      saveAttempt,
      saveActiveAttempt,
      deleteActiveAttempt,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppProvider');
  return value;
}
