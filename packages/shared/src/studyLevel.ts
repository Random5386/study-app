import { z } from 'zod';

// Study levels: high school (with a grade), college/TVET, university, postgraduate.
// AI features pitch their language and depth at the student's level, and a few words in
// the app change to match (a high-school "subject" is a university "module").

export const STUDY_LEVELS = ['HIGH_SCHOOL', 'COLLEGE', 'UNIVERSITY', 'POSTGRAD'] as const;
export type StudyLevel = (typeof STUDY_LEVELS)[number];

export const STUDY_LEVEL_INFO: Record<StudyLevel, { label: string; hint: string; emoji: string }> = {
  HIGH_SCHOOL: { label: 'High school', hint: 'Grades 8 to 12', emoji: '🏫' },
  COLLEGE: { label: 'College or TVET', hint: 'Certificates, diplomas and N-courses', emoji: '🛠️' },
  UNIVERSITY: { label: 'University', hint: 'Undergraduate degrees', emoji: '🎓' },
  POSTGRAD: { label: 'Postgraduate', hint: "Honours, Master's and PhD", emoji: '🔬' },
};

export const SCHOOL_GRADES = [8, 9, 10, 11, 12] as const;

export const studyLevelSchema = z.enum(STUDY_LEVELS, 'Choose your study level');
export const schoolGradeSchema = z.coerce
  .number()
  .int()
  .min(8, 'Choose a grade from 8 to 12')
  .max(12, 'Choose a grade from 8 to 12');

/** Level + optional grade. A grade only makes sense for high school, so it's dropped otherwise. */
export const studyLevelFields = {
  studyLevel: studyLevelSchema,
  schoolGrade: schoolGradeSchema.nullable().optional(),
};

/** Drops a grade sent with a non-school level, so the database never holds "University, Grade 10". */
export function normaliseGrade<T extends { studyLevel?: StudyLevel; schoolGrade?: number | null }>(
  value: T,
): T {
  if (value.studyLevel && value.studyLevel !== 'HIGH_SCHOOL') return { ...value, schoolGrade: null };
  return value;
}

/** "Grade 10 learner", "University student"... */
export function describeLevel(level: StudyLevel | null | undefined, grade?: number | null): string {
  if (!level) return 'Not set';
  if (level === 'HIGH_SCHOOL') return grade ? `High school, Grade ${grade}` : 'High school';
  return STUDY_LEVEL_INFO[level].label;
}

/** Words that change with the level. South African schools say "learner" and "subject"; universities say "module". */
export function levelWords(level: StudyLevel | null | undefined) {
  const university = level === 'UNIVERSITY' || level === 'POSTGRAD';
  return {
    subject: university ? 'module' : 'subject',
    Subject: university ? 'Module' : 'Subject',
    subjects: university ? 'modules' : 'subjects',
    Subjects: university ? 'Modules' : 'Subjects',
    student: level === 'HIGH_SCHOOL' ? 'learner' : 'student',
    test: university ? 'exam' : 'test',
  };
}

/**
 * The cache key part for AI output: who it was written for. Two Grade 10 learners can share
 * a cached summary style; a Grade 10 and a university summary are different.
 */
export function audienceKey(level: StudyLevel | null | undefined, grade?: number | null): string {
  if (!level) return 'GENERAL';
  return level === 'HIGH_SCHOOL' && grade ? `HIGH_SCHOOL:${grade}` : level;
}

/** The reverse of audienceKey(): "HIGH_SCHOOL:10" → "High school, Grade 10". */
export function describeAudience(key: string): string {
  if (key === 'GENERAL') return 'Everyone';
  const [level, grade] = key.split(':');
  if (!STUDY_LEVELS.includes(level as StudyLevel)) return 'Everyone';
  return describeLevel(level as StudyLevel, grade ? Number(grade) : null);
}
