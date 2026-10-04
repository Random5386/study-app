# 12. Flashcards and spaced repetition (SM-2)

## What it is

**Spaced repetition** shows you a card just before you're likely to forget it. Easy cards come back rarely; hard ones come back often. It's backed by decades of memory research (the "forgetting curve") and used by Anki, Duolingo and Quizlet.

StudyApp uses **SM-2**, the classic algorithm from SuperMemo (1987). After each card you press:

| Button | Meaning                 | SM-2 quality (0–5) |
| ------ | ----------------------- | ------------------ |
| Again  | Forgot it               | 1                  |
| Hard   | Remembered, with effort | 3                  |
| Good   | Remembered              | 4                  |
| Easy   | Instant                 | 5                  |

## Why SM-2

- Simple enough to implement and explain in an interview — about 20 lines.
- A **pure function** (same input → same output, no database or clock inside), so it's perfect for unit tests.

Alternative: **FSRS**, the newer algorithm Anki now offers — more accurate but much more complex. "I'd consider FSRS next" is a good improvement answer.

## Where it lives

```
apps/api/src/lib/sm2.ts                 # the algorithm (pure)
apps/api/src/lib/sm2.test.ts            # its unit tests
apps/api/src/modules/study/study.service.ts   # due cards, saving reviews
apps/web/src/features/study/StudySession.tsx  # the flip-card UI
```

## How SM-2 works

Each card stores three numbers:

- **repetitions** — how many times in a row you've recalled it.
- **intervalDays** — days until it's due again.
- **easeFactor** — how easy the card is for _you_; starts at 2.5, never below 1.3.

On each review with quality `q`:

1. If `q < 3` (Again): reset `repetitions` to 0, `intervalDays` to 1. Ease is unchanged.
2. Otherwise: `repetitions += 1`, and the new interval is
   - 1 day after the 1st success,
   - 6 days after the 2nd,
   - `previous interval × easeFactor` after that.
     Then update the ease:

```latex
EF' = EF + (0.1 - (5 - q)(0.08 + (5 - q) \cdot 0.02)), \quad EF' \ge 1.3
```

So: Easy (`q = 5`) adds 0.1, Good (`q = 4`) leaves it unchanged, Hard (`q = 3`) subtracts 0.14.

Pressing **Good** every time on a new card gives intervals of **1, 6, 15, 38, 95 days** — five reviews cover three months.

## The code, explained — `lib/sm2.ts`

```ts
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type CardState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

export const QUALITY: Record<Rating, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

/**
 * Pure SM-2 scheduler: takes the card's current state and a rating,
 * returns the new state and when the card is next due. No I/O, no hidden clock.
 */
export function schedule(
  card: CardState,
  rating: Rating,
  now: Date = new Date(),
): CardState & { dueAt: Date } {
  const q = QUALITY[rating];
  let { easeFactor, intervalDays, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);

    easeFactor = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }

  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
```

Why `now` is a parameter: tests can pass a fixed date and get exact, repeatable answers. Hidden calls to `new Date()` inside logic make tests flaky.

### Unit tests — `lib/sm2.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { schedule, type CardState } from './sm2.js';

const fresh: CardState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
const now = new Date('2026-10-01T09:00:00Z');

describe('SM-2 schedule', () => {
  it('pressing Good repeatedly gives 1, 6, 15, 38 days', () => {
    let card = fresh;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      card = schedule(card, 'good', now);
      intervals.push(card.intervalDays);
    }
    expect(intervals).toEqual([1, 6, 15, 38]);
  });

  it('Again resets the repetitions but keeps the ease factor', () => {
    const learned = { easeFactor: 2.6, intervalDays: 15, repetitions: 3 };
    const next = schedule(learned, 'again', now);
    expect(next).toMatchObject({ repetitions: 0, intervalDays: 1, easeFactor: 2.6 });
  });

  it('never lets the ease factor drop below 1.3', () => {
    let card: CardState = { easeFactor: 1.35, intervalDays: 6, repetitions: 2 };
    for (let i = 0; i < 5; i++) card = schedule(card, 'hard', now);
    expect(card.easeFactor).toBe(1.3);
  });

  it('sets dueAt intervalDays after now', () => {
    const next = schedule(fresh, 'good', now);
    expect(next.dueAt.toISOString()).toBe('2026-10-02T09:00:00.000Z');
  });
});
```

## Using it — `study.service.ts`

```ts
export const studyService = {
  /** Cards due now from the user's decks (or one deck), oldest first. */
  dueCards(userId: string, deckId?: string) {
    return prisma.flashcard.findMany({
      where: { dueAt: { lte: new Date() }, deck: { userId, ...(deckId && { id: deckId }) } },
      orderBy: { dueAt: 'asc' },
      take: 100,
    });
  },

  async review(userId: string, cardId: string, rating: Rating) {
    const card = await prisma.flashcard.findFirst({ where: { id: cardId, deck: { userId } } });
    if (!card) throw new HttpError(404, 'Card not found');

    const next = schedule(card, rating);

    await prisma.$transaction([
      // both writes or neither (page 05)
      prisma.cardReview.create({
        data: {
          flashcardId: card.id,
          userId,
          rating: QUALITY[rating],
          previousInterval: card.intervalDays,
          newInterval: next.intervalDays,
        },
      }),
      prisma.flashcard.update({ where: { id: card.id }, data: next }),
    ]);
    return next;
  },
};
```

**Mini streak (combo):** during a review session, the app counts how many cards you answered correctly **in a row**: "🔥 5 in a row!". _Hard_, _Good_ and _Easy_ all count as correct (in SM-2 terms, quality 3 or more is a successful recall); _Again_ resets it to 0. The best combo of the session is shown on the summary screen at the end. It is deliberately small and friendly: nothing is saved across days, so there's no daily pressure and no streak to "lose" overnight.

Because it only lives for one session, it's plain React state, not a database table. The rule itself is a pure function, so it gets unit tests like SM-2 does:

```ts
// apps/web/src/features/study/combo.ts
export type Combo = { current: number; best: number };
export const START: Combo = { current: 0, best: 0 };

export function nextCombo(combo: Combo, rating: Rating): Combo {
  const current = rating === 'again' ? 0 : combo.current + 1;
  return { current, best: Math.max(combo.best, current) };
}

/** A little celebration at 5, 10, 15 ... in a row. */
export const isMilestone = (combo: Combo) => combo.current > 0 && combo.current % 5 === 0;
```

**In the UI:** the session shows the front, Space flips the card, keys 1–4 pick Again/Hard/Good/Easy. Cards rated _Again_ are also put back at the end of the current session, so you see them again before you finish.

## Common mistakes

- Putting `new Date()` or database calls inside the algorithm — hard to test.
- Floating-point drift in the ease factor; round it.
- Forgetting the ownership check (`deck: { userId }`) when reviewing by card id.
- Updating the card without saving the review (or vice versa) — use a transaction.

## Interview questions

**Q: Explain an algorithm you implemented.**
A: SM-2 for spaced repetition. Each card has an ease factor, interval and repetition count. A failed recall resets the interval to one day; a success grows it — 1 day, 6 days, then the previous interval times the ease factor — and the ease factor adjusts with how easy the recall was, floored at 1.3.

**Q: What's a pure function and why does it matter?**
A: Its output depends only on its inputs and it has no side effects. My scheduler takes the card state, rating and current time, so I can unit-test it with exact expected values.

**Q: How would you improve the scheduling?**
A: Switch to FSRS, which models memory stability per card from review history, or add "fuzz" so cards learned together don't all fall due on the same day.

## Try it yourself

1. Add a test: pressing **Easy** on a new card three times — what are the intervals and ease? Work it out on paper first.
2. Add a "fuzz" of ±5% to intervals over 7 days, keeping the function testable (hint: pass a random function in as a parameter).
