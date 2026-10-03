# 2. TypeScript essentials

## What it is

**TypeScript** is JavaScript plus **types**. You write `.ts`/`.tsx` files; the TypeScript compiler checks them and outputs plain JavaScript that Node.js and browsers run. Types disappear at runtime — they exist to catch mistakes _before_ the code runs.

```ts
function greet(name: string) {
  return `Hello, ${name}`;
}
greet(42); // ❌ compile error: Argument of type 'number' is not assignable to parameter of type 'string'
```

## Why we use it

- Catches typos and wrong data shapes while you type (your editor underlines them).
- Makes refactoring safe — rename a field and the compiler lists every place to fix.
- Prisma and Zod **generate** types for us, so database rows and API inputs are typed automatically.
- Most South African job ads for React/Node roles now ask for TypeScript.

Alternative: plain JavaScript (less setup, but bugs show up at runtime instead).

## The 12 things you actually need

### 1. Basic types

```ts
let title: string = 'Biology';
let count: number = 3;
let done: boolean = false;
let tags: string[] = ['exam', 'term-2'];
let maybe: string | null = null; // a "union": string OR null
```

Usually you don't write the type — TypeScript **infers** it: `let title = 'Biology'` is already a `string`.

### 2. Object types with `type` or `interface`

```ts
type Flashcard = {
  id: string;
  front: string;
  back: string;
  dueAt: Date;
  imageUrl?: string; // ? = optional
};
```

`type` and `interface` are nearly interchangeable. This project uses `type` for data and `interface` for "contracts" a class must fulfil (like `AiClient`).

### 3. Union of literal values (great instead of magic strings)

```ts
type Rating = 'again' | 'hard' | 'good' | 'easy';
function review(r: Rating) {
  /* ... */
}
review('meh'); // ❌ compile error
```

### 4. Functions

```ts
function add(a: number, b: number): number {
  return a + b;
}
const double = (n: number) => n * 2; // arrow function, return type inferred
```

### 5. `async` / `await` and `Promise`

Anything slow (database, network, files) returns a **Promise** — a value that arrives later. `await` pauses _this function_ until it arrives, without freezing the whole server.

```ts
async function getNote(id: string): Promise<Note | null> {
  const note = await prisma.note.findUnique({ where: { id } });
  return note;
}
```

Forgetting `await` is the #1 beginner bug: you get a `Promise` object instead of the data.

### 6. Narrowing with `if`

```ts
function show(note: Note | null) {
  if (!note) return 'Not found';
  return note.title; // TypeScript knows note is a Note here
}
```

### 7. Generics (types with a parameter)

You'll mostly _use_ them, not write them:

```ts
const ids: Array<string> = [];
const result: Promise<number> = Promise.resolve(1);
useQuery<Note[]>({ ... }); // "this query returns an array of Note"
```

### 8. Modules: `import` / `export`

```ts
// lib/sm2.ts
export function schedule(...) { ... }

// somewhere else
import { schedule } from '../lib/sm2.js';
```

In Node ESM projects you write `.js` in import paths even though the file is `.ts` — the path refers to the compiled output. (Vite on the front end doesn't need the extension.)

### 9. `unknown` vs `any`

- `any` switches type-checking off. Avoid it (ESLint will warn).
- `unknown` means "could be anything — check before using". Use it for data from outside (JSON, errors).

### 10. Utility types

```ts
type NoteUpdate = Partial<Note>; // all fields optional
type NoteSummary = Pick<Note, 'id' | 'title'>;
type PublicUser = Omit<User, 'passwordHash'>;
```

### 11. Types from Zod (one source of truth)

```ts
import { z } from 'zod';
export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subjectId: z.uuid().optional(),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
// => { title: string; subjectId?: string }
```

The schema checks data **at runtime**; `z.infer` gives the matching **compile-time** type. StudyApp keeps these in `packages/shared` so the React form and the Express route use the exact same rules.

### 12. Strict mode

`tsconfig.json` has `"strict": true`. It forces you to handle `null`/`undefined` and forbids implicit `any`. It's stricter at first, but it's what professional codebases use.

## Common mistakes

- Forgetting `await` (see above).
- Using `as SomeType` to silence an error. `as` tells the compiler "trust me" — it doesn't check anything. Validate with Zod instead.
- Thinking types protect you at runtime. They don't: data from the browser, the database or Gemini must still be validated.

## Interview questions

**Q: Why TypeScript over JavaScript?**
A: Static types catch a class of bugs at compile time, make large codebases easier to refactor and document intent. In StudyApp, Prisma and Zod generate types, so the database, API and front end share one definition of each data shape.

**Q: What's the difference between `any` and `unknown`?**
A: `any` disables checking; `unknown` forces you to narrow the type before use, so it's the safe choice for untrusted data.

**Q: Do TypeScript types exist at runtime?**
A: No, they're erased when compiling. That's why we still validate input at runtime with Zod.

## Try it yourself

In `packages/shared`, write a Zod schema for creating a flashcard (`front` and `back` required, 1–2000 characters; `deckId` a UUID), then export its inferred type. Try passing an object missing `back` to a function that takes that type and read the compiler error.
