import type { Exam, Question } from '../types';
import { makeExamCode, uid } from '../lib/ids';

function option(text: string) {
  return { id: uid('o'), text };
}

function question(
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
): Question {
  const built = options.map(option);
  return {
    id: uid('q'),
    prompt,
    options: built,
    correctOptionId: built[correctIndex]?.id ?? null,
    points: 1,
    explanation,
  };
}

export function createSampleExam(takenCodes: string[] = []): Exam {
  const now = new Date().toISOString();
  return {
    id: uid('exam'),
    code: makeExamCode(takenCodes),
    title: 'The Everyday Science Quiz',
    subject: 'General Science',
    description:
      'A short warm-up quiz across biology, chemistry, and space. A good place to see how the full exam flow works.',
    instructions:
      'Attempt every question. Each question has one correct answer. You can move between questions freely before submitting.',
    durationMinutes: 10,
    passPercent: 60,
    questions: [
      question(
        'Which planet is known as the Red Planet?',
        ['Venus', 'Mars', 'Jupiter', 'Mercury'],
        1,
        'Iron minerals in the dust and rocks on Mars give the planet its reddish appearance.',
      ),
      question(
        'What is the main gas absorbed by plants during photosynthesis?',
        ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
        2,
        'Plants take in carbon dioxide and water, using light energy to produce glucose and oxygen.',
      ),
      question(
        'Which part of the human body produces insulin?',
        ['Liver', 'Kidneys', 'Pancreas', 'Spleen'],
        2,
        'The beta cells of the pancreas produce insulin, which helps regulate blood sugar.',
      ),
      question(
        'What is 15% of 200?',
        ['15', '20', '30', '45'],
        2,
        'Fifteen percent is 0.15, and 0.15 × 200 = 30.',
      ),
      question(
        'Who wrote the novel Pride and Prejudice?',
        ['Charlotte Brontë', 'Jane Austen', 'Virginia Woolf', 'Mary Shelley'],
        1,
        'Jane Austen published Pride and Prejudice in 1813.',
      ),
      question(
        'Which organ filters waste and excess water from the blood?',
        ['Lungs', 'Liver', 'Kidneys', 'Stomach'],
        2,
        'The kidneys filter blood and produce urine, helping maintain fluid and electrolyte balance.',
      ),
    ],
    status: 'published',
    opensAt: null,
    closesAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
