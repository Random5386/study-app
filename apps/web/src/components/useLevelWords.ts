// Words that match the signed-in student's level: "subject" at school, "module" at university.
import { levelWords } from '@studyapp/shared';
import { useMe } from '../features/auth/useMe';

export function useLevelWords() {
  const { data: me } = useMe();
  return levelWords(me?.studyLevel);
}
