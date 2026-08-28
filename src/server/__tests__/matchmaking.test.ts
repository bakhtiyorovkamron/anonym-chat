import { describe, expect, it } from "vitest";
import { Gender, GenderPreference, Language, type Mode } from "@prisma/client";
import { pickBestCandidate, scoreCandidate, type CandidateState } from "@/server/matchmaking";

const base = {
  user: {
    id: "u1",
    language: Language.RUSSIAN,
    age: 24,
    gender: Gender.FEMALE,
    preferredGender: GenderPreference.ANY,
    online: true,
    lastSeenAt: new Date(),
  },
  persona: {
    interests: ["Музыка", "Кино"],
    mode: "ROLEPLAY" as Mode,
  },
  blocked: false,
  recentlyMatched: false,
} satisfies CandidateState;

describe("matchmaking", () => {
  it("does not match user with self", () => {
    const score = scoreCandidate(base, { ...base });
    expect(score).toBe(-1);
  });

  it("respects blocks", () => {
    const score = scoreCandidate(base, {
      ...base,
      user: { ...base.user, id: "u2" },
      blocked: true,
    });
    expect(score).toBe(-1);
  });

  it("rewards language and preferences", () => {
    const candidate: CandidateState = {
      ...base,
      user: {
        ...base.user,
        id: "u2",
        gender: Gender.MALE,
        preferredGender: GenderPreference.FEMALE,
      },
      blocked: false,
    };

    const score = scoreCandidate(base, candidate);
    expect(score).toBeGreaterThan(50);
  });

  it("filters inactive users", () => {
    const score = scoreCandidate(base, {
      ...base,
      user: { ...base.user, id: "u2", online: false },
    });
    expect(score).toBe(-1);
  });

  it("picks best candidate", () => {
    const c1: CandidateState = {
      ...base,
      user: { ...base.user, id: "u2", language: Language.ENGLISH },
      persona: { ...base.persona, interests: ["Игры"], mode: "TALK" as Mode },
    };
    const c2: CandidateState = {
      ...base,
      user: { ...base.user, id: "u3" },
    };

    const result = pickBestCandidate(base, [c1, c2]);
    expect(result.best?.user.id).toBe("u3");
  });
});
