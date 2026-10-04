// Who the AI is writing for. The same guide is summarised differently for a Grade 9 learner
// and a Master's student: simpler words and everyday examples for one, precise academic
// language for the other. See docs/11-ai-gemini.md ("Matching the study level").
import type { StudyLevel } from '@studyapp/shared';

export function audienceDescription(level: StudyLevel | null, grade: number | null): string {
  switch (level) {
    case 'HIGH_SCHOOL': {
      const who = grade ? `a Grade ${grade} high school learner` : 'a high school learner';
      const younger = grade !== null && grade <= 9;
      return (
        `${who} in South Africa. Use simple, clear language and short sentences. ` +
        `Explain every technical word the first time you use it` +
        (younger
          ? ', and use everyday examples where they help.'
          : '. Focus on what is likely to come up in tests and exams.')
      );
    }
    case 'COLLEGE':
      return 'a college or TVET student. Be clear and practical: focus on how ideas are applied, steps and procedures, and key facts to remember.';
    case 'UNIVERSITY':
      return 'a university undergraduate. Use precise academic language, define key concepts, and show how the ideas connect.';
    case 'POSTGRAD':
      return 'a postgraduate student with a strong background in the field. Be concise and technical, and point out assumptions, limitations and open questions.';
    default:
      return 'a student. Use clear, plain language.';
  }
}
