# 5. The database: PostgreSQL and Prisma

## What it is

**PostgreSQL** ("Postgres") is a free, open-source **relational database**: data lives in **tables** made of **rows** and **columns**, and tables point at each other.

**Prisma ORM** sits between our TypeScript code and Postgres. You describe your tables once in `schema.prisma`; Prisma then:

1. generates **migrations** (SQL files that create/alter tables), and
2. generates a **type-safe client**, so `prisma.note.findMany(...)` is autocompleted and type-checked.

## Why we use them

- Postgres is the default database for Node.js work and very common in SA job ads; it's free, reliable and has great JSON and full-text search.
- Prisma gives beginners guard rails: typed queries, no hand-built SQL strings (so no SQL injection), and readable migrations.
- We pin **Prisma ORM 7**. Prisma 8 changes the schema format and was still a release candidate in October 2026.

Alternatives: **Drizzle** (SQL-like, lighter), **TypeORM** (decorators, older), raw SQL with `pg` (most control, most work). MongoDB is a _document_ database — fine for some apps, but StudyApp's data (users → decks → cards → reviews) is naturally relational.

## Relational database concepts you must know

| Concept           | Meaning                                       | In StudyApp                                 |
| ----------------- | --------------------------------------------- | ------------------------------------------- |
| Table             | A collection of one kind of thing             | `Flashcard`                                 |
| Row               | One thing                                     | One card                                    |
| Column            | One property                                  | `front`, `dueAt`                            |
| Primary key (PK)  | Unique id of a row                            | `id` (UUID v7)                              |
| Foreign key (FK)  | A column pointing at another table's PK       | `Flashcard.deckId` → `Deck.id`              |
| One-to-many       | One row relates to many rows                  | One deck, many cards                        |
| Many-to-many      | Needs a join table                            | Notes ↔ Tags via `NoteTag`                  |
| Index             | A lookup structure that makes searches fast   | `(deckId, dueAt)` to find due cards quickly |
| Unique constraint | Database refuses duplicates                   | `User.email`                                |
| Transaction       | Several changes that succeed or fail together | Save a review **and** reschedule the card   |
| Migration         | A versioned, repeatable schema change         | `20261015_add_flashcards/migration.sql`     |

**Why UUID v7 for ids?** Random enough that nobody can guess `/api/notes/2` from `/api/notes/1`, but time-ordered, so new rows land at the end of the index (fast inserts).

## Where it lives

```
apps/api/
├── prisma/schema.prisma      # the data model
├── prisma/migrations/        # generated SQL, committed to Git
├── prisma/seed.ts            # creates the demo account
├── prisma.config.ts          # Prisma 7 settings (database URL, paths)
└── src/db/prisma.ts          # the one shared client
```

## The code, explained

### `prisma/schema.prisma` (excerpt)

```prisma
generator client {
  provider = "prisma-client"            // Prisma 7's generator
  output   = "../src/generated/prisma"  // generated code lands here (git-ignored)
}

datasource db {
  provider = "postgresql"               // the URL itself lives in prisma.config.ts
}

model User {
  id              String    @id @default(uuid(7)) @db.Uuid
  email           String    @unique
  passwordHash    String
  displayName     String
  emailVerifiedAt DateTime?                 // ? = nullable
  totpSecretEnc   String?
  mfaEnabledAt    DateTime?
  failedLogins    Int       @default(0)
  lockedUntil     DateTime?
  aiDailyQuota    Int       @default(20)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt      // Prisma sets this on every update

  notes Note[]
  decks Deck[]
}

model Note {
  id          String    @id @default(uuid(7)) @db.Uuid
  userId      String    @db.Uuid
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentId    String?   @db.Uuid
  parent      Note?     @relation("NoteTree", fields: [parentId], references: [id], onDelete: Cascade)
  children    Note[]    @relation("NoteTree")   // a note can contain sub-pages
  title       String    @default("Untitled")
  icon        String?
  content     Json      @default("[]")        // BlockNote's JSON blocks
  contentText String    @default("")          // plain text copy for search
  position    Int       @default(0)
  isFavourite Boolean   @default(false)
  deletedAt   DateTime?                       // set = in the trash
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId, parentId])                 // fast "my notes under this parent"
}

model Deck {
  id          String      @id @default(uuid(7)) @db.Uuid
  userId      String      @db.Uuid
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  cards       Flashcard[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([userId])
}

model Flashcard {
  id           String     @id @default(uuid(7)) @db.Uuid
  deckId       String     @db.Uuid
  deck         Deck       @relation(fields: [deckId], references: [id], onDelete: Cascade)
  front        String
  back         String
  source       CardSource @default(MANUAL)
  easeFactor   Float      @default(2.5)       // SM-2 state (page 12)
  intervalDays Int        @default(0)
  repetitions  Int        @default(0)
  dueAt        DateTime   @default(now())
  reviews      CardReview[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([deckId, dueAt])
}

enum CardSource {
  MANUAL
  AI
}
```

Things to notice:

- `@relation(... onDelete: Cascade)` — delete a deck and Postgres deletes its cards automatically.
- `Flashcard` has no `userId`; it belongs to a user **through** its deck. Ownership checks use a relation filter (below).
- The full schema (every model) is listed in the project plan's _Database schema_ section.

### `prisma.config.ts`

```ts
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: path.resolve(import.meta.dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url: env('DATABASE_URL') },
});
```

### `src/db/prisma.ts` — one shared client

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

// Prisma 7 talks to Postgres through a "driver adapter" built on the popular `pg` package.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
```

Create the client **once** and import it everywhere. Creating one per request opens a new connection pool each time and quickly exhausts the database.

### The migration workflow

```bash
# 1. Edit schema.prisma (e.g. add `colour String?` to Deck)
# 2. Create + apply a migration and regenerate the client:
npx prisma migrate dev --name add_deck_colour
npx prisma generate
# 3. Commit both schema.prisma and the new prisma/migrations/<timestamp>_add_deck_colour folder
```

| Command                 | When                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `prisma migrate dev`    | Development: creates a migration from your schema changes and applies it |
| `prisma migrate deploy` | Production/CI: applies existing migrations, never creates new ones       |
| `prisma migrate reset`  | Wipes the database and re-applies everything (dev/test only!)            |
| `prisma generate`       | Rebuilds the typed client after schema changes                           |
| `prisma studio`         | Opens a free browser GUI to view and edit data                           |

**Never edit a migration that has already been applied** (by you or anyone else). Make a new one.

### Everyday queries

```ts
// All my decks with a count of their cards (one query, not one per deck)
const decks = await prisma.deck.findMany({
  where: { userId },
  include: { _count: { select: { cards: true } } },
  orderBy: { createdAt: 'desc' },
});

// Cards due now, but only from MY decks — a relation filter does the ownership check
const due = await prisma.flashcard.findMany({
  where: { dueAt: { lte: new Date() }, deck: { userId } },
  orderBy: { dueAt: 'asc' },
  take: 50,
});

// Only the columns you need (smaller, faster responses)
const titles = await prisma.note.findMany({
  where: { userId, deletedAt: null },
  select: { id: true, title: true },
});
```

### Transactions: all or nothing

Reviewing a card must save the review **and** update the schedule. If one fails, neither should happen:

```ts
await prisma.$transaction([
  prisma.cardReview.create({
    data: {
      flashcardId: card.id,
      userId,
      rating,
      previousInterval: card.intervalDays,
      newInterval: next.intervalDays,
    },
  }),
  prisma.flashcard.update({
    where: { id: card.id },
    data: {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
    },
  }),
]);
```

### Full-text search (raw SQL, still safe)

Prisma's query builder doesn't cover everything. For Postgres full-text search we add a generated `tsvector` column in a hand-edited migration (`prisma migrate dev --create-only`, then edit the SQL):

```sql
ALTER TABLE "Document"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("extractedText", ''))) STORED;
CREATE INDEX "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");
```

…declare it in the schema as `searchVector Unsupported("tsvector")?`, and query it with a **tagged template**:

```ts
const results = await prisma.$queryRaw<{ id: string; title: string; rank: number }[]>`
  SELECT id, title, ts_rank("searchVector", query) AS rank
  FROM "Document", websearch_to_tsquery('english', ${searchText}) AS query
  WHERE "userId" = ${userId}::uuid AND "searchVector" @@ query
  ORDER BY rank DESC
  LIMIT 20`;
```

The `${...}` values are sent as **parameters**, not glued into the SQL text, so this is safe from SQL injection. Never use `$queryRawUnsafe` with user input.

## Common mistakes

- **N+1 queries:** loading 20 decks, then running one extra query per deck for its cards (21 queries). Use `include`/`select` or `_count` to fetch in one go.
- Forgetting `userId` in a `where` → a data leak. Every service query is reviewed for it.
- Editing the database by hand in Studio and wondering why migrations break — schema changes go through migrations only.
- Storing money/time as strings; use the right column types (`DateTime`, `Int`, `Decimal`).

## Interview questions

**Q: What is an ORM, and what are its trade-offs?**
A: It maps database rows to objects in code. Pros: type safety, less boilerplate, protection from SQL injection, portable migrations. Cons: can hide inefficient queries, and complex SQL (like full-text search) sometimes needs raw queries — which I still parameterise.

**Q: What is a database index and when would you add one?**
A: A data structure (usually a B-tree) that lets the database find rows without scanning the whole table. I add them on columns used in frequent `WHERE`/`ORDER BY` clauses, like `(deckId, dueAt)` for the "cards due" query. They cost extra disk space and slightly slower writes.

**Q: What is a transaction? Give an example from your project.**
A: A group of operations that commit together or not at all (ACID). Saving a flashcard review and rescheduling the card is one transaction, so the history and the schedule can never disagree.

**Q: What is the N+1 problem?**
A: Running one query for a list and then one more per item. I avoid it with Prisma's `include`, `select` and `_count`.

## Try it yourself

1. Add an optional `colour` field to `Deck`, create a migration, and look at the generated SQL file.
2. Open `npx prisma studio`, find your demo user's decks, and check the `_count` query result matches.
3. Write a query: "my 5 most recently updated notes that are not in the trash".
