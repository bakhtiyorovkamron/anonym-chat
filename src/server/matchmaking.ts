import { Gender, GenderPreference, Mode, type Persona, type User } from "@prisma/client";

export type CandidateState = {
  user: Pick<User, "id" | "language" | "age" | "gender" | "preferredGender" | "online" | "lastSeenAt">;
  persona: Pick<Persona, "interests" | "mode">;
  blocked: boolean;
  recentlyMatched: boolean;
};

function prefers(preference: GenderPreference, candidateGender: Gender) {
  if (preference === GenderPreference.ANY) return true;
  if (preference === GenderPreference.MALE) return candidateGender === Gender.MALE;
  if (preference === GenderPreference.FEMALE) return candidateGender === Gender.FEMALE;
  return false;
}

function ageClose(a?: number | null, b?: number | null) {
  if (!a || !b) return false;
  return Math.abs(a - b) <= 7;
}

export function scoreCandidate(current: CandidateState, candidate: CandidateState) {
  if (current.user.id === candidate.user.id) return -1;
  if (candidate.blocked || candidate.recentlyMatched || !candidate.user.online) return -1;

  let score = 0;

  if (candidate.user.language === current.user.language) score += 30;

  const commonInterests = candidate.persona.interests.filter((interest) =>
    current.persona.interests.includes(interest),
  ).length;
  score += Math.min(commonInterests * 10, 20);

  if (candidate.persona.mode === current.persona.mode) score += 20;
  if (ageClose(current.user.age, candidate.user.age)) score += 10;

  const currentPreferenceMatch = prefers(current.user.preferredGender, candidate.user.gender);
  const candidatePreferenceMatch = prefers(candidate.user.preferredGender, current.user.gender);
  if (currentPreferenceMatch && candidatePreferenceMatch) score += 10;

  if (candidate.user.online) score += 10;

  return score;
}

export function pickBestCandidate(current: CandidateState, candidates: CandidateState[]) {
  let best: CandidateState | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreCandidate(current, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { best, bestScore };
}

export function modeFromInput(input: string): Mode {
  return (Object.values(Mode) as string[]).includes(input) ? (input as Mode) : Mode.TALK;
}
