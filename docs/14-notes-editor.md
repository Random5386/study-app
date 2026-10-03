# 14. Notion-style notes (BlockNote)

## What it is

Notes in StudyApp work like Notion: a page is a list of **blocks** (heading, paragraph, checklist, code, table, image…), you type `/` for a menu of block types, drag blocks to reorder, and pages can contain sub-pages shown in a sidebar tree. Everything autosaves.

We use **BlockNote**, an open-source React editor built on Tiptap and ProseMirror (the engine behind many professional editors).

## Why BlockNote

- Notion-style blocks, slash menu and drag handles **out of the box** — building these from scratch would take months.
- Saves content as **JSON**, not HTML. JSON is structured (easy to search, transform and validate) and can't smuggle in `<script>` tags.
- React-first API that fits our stack.

Alternatives: **Tiptap** directly (more control, more work), **Lexical** (Meta's editor), **Editor.js** (block-based, not React-specific), a plain `<textarea>` with Markdown (simplest, least Notion-like).

## Where it lives

```
apps/web/src/features/notes/
├── NotePage.tsx          # loads a note, shows title + editor
├── NoteEditor.tsx        # BlockNote + autosave
├── NotesSidebar.tsx      # the page tree
├── buildTree.ts          # flat list → tree
└── useDebouncedCallback.ts
apps/api/src/modules/notes/   # routes + service (page 04)
apps/api/src/lib/blocksToText.ts
```

## The code, explained

### The editor with autosave — `NoteEditor.tsx`

```tsx
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useDebouncedCallback } from './useDebouncedCallback';

type Props = { noteId: string; initialContent: unknown[] };

export function NoteEditor({ noteId, initialContent }: Props) {
  // BlockNote needs `undefined` (not an empty array) for a blank page.
  const editor = useCreateBlockNote({
    initialContent: initialContent.length ? (initialContent as never) : undefined,
  });

  const save = useMutation({
    mutationFn: (content: unknown[]) => api.patch(`/api/notes/${noteId}`, { content }),
  });

  // Wait until typing pauses for 1 second, then save once.
  const saveSoon = useDebouncedCallback((content: unknown[]) => save.mutate(content), 1000);

  return (
    <div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {save.isPending ? 'Saving…' : save.isError ? 'Not saved — retrying when you type' : 'Saved'}
      </p>
      <BlockNoteView editor={editor} onChange={() => saveSoon(editor.document)} />
    </div>
  );
}
```

**Debouncing:** without it, every keystroke would send a request (hundreds per minute). A debounce waits until the user pauses, then fires once.

### A small reusable hook — `useDebouncedCallback.ts`

```ts
import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]); // always call the latest fn
  useEffect(() => () => clearTimeout(timer.current), []); // cancel on unmount

  return useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  );
}
```

### Validating and indexing note content on the server

The browser sends BlockNote JSON. The server:

1. validates its _shape_ and size with Zod (`content: z.array(z.record(z.string(), z.unknown())).max(5000)` plus Express's 1 MB body limit), and
2. computes `contentText` **itself** for search — never trusting a client-supplied copy:

```ts
// lib/blocksToText.ts — walk the block tree and collect the text
type Inline = { type?: string; text?: string };
type Block = { content?: Inline[] | unknown; children?: Block[] };

export function blocksToText(blocks: Block[]): string {
  const out: string[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (Array.isArray(block.content)) {
        out.push((block.content as Inline[]).map((c) => c.text ?? '').join(''));
      }
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);
  return out.filter(Boolean).join('\n');
}
```

This is a **recursive** function — blocks can contain child blocks, which can contain children…

### The page tree — `buildTree.ts`

The API returns notes as a **flat list** with `parentId`. The sidebar needs a **tree**:

```ts
export type NoteItem = { id: string; title: string; parentId: string | null; position: number };
export type TreeNode = NoteItem & { children: TreeNode[] };

export function buildTree(items: NoteItem[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots: TreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node); // orphans (parent in trash) become roots
  }

  const sortDeep = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortDeep(n.children));
  };
  sortDeep(roots);
  return roots;
}
```

One pass with a `Map` makes this **O(n)** — versus O(n²) if each node searched the whole list for its children. That's a good detail for interviews.

The sidebar renders it recursively:

```tsx
function TreeItem({ node }: { node: TreeNode }) {
  return (
    <li>
      <NavLink to={`/notes/${node.id}`}>{node.title || 'Untitled'}</NavLink>
      {node.children.length > 0 && (
        <ul className="ml-4">
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

### Moving pages safely

When a note is moved under a new parent, the server checks that the new parent (a) belongs to the same user and (b) is **not the note itself or one of its descendants** — otherwise you'd create a loop and the tree would never end. It walks up from the new parent via `parentId` and refuses if it meets the note's own id.

### Trash

"Delete" sets `deletedAt` (a **soft delete**), so the note can be restored. A pg-boss scheduled job runs nightly and permanently deletes notes that have been in the trash for 30 days:

```ts
await boss.createQueue('purge-trash');
await boss.schedule('purge-trash', '0 3 * * *'); // every day at 03:00
await boss.work('purge-trash', async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.note.deleteMany({ where: { deletedAt: { lt: cutoff } } });
});
```

## Common mistakes

- Saving on every keystroke (no debounce) — floods the API and the database.
- Storing and re-rendering raw HTML from the editor — an XSS risk.
- Trusting client-supplied search text or tree positions without checks.
- Letting a page become its own ancestor.
- Losing the last edit: also flush the pending save when the user navigates away.

## Interview questions

**Q: How does autosave work in your notes feature?**
A: The editor's `onChange` calls a debounced function that waits for one second of inactivity, then sends a PATCH with the block JSON. TanStack Query's mutation state drives the "Saving…/Saved" indicator.

**Q: How do you turn a flat list with parent ids into a tree?**
A: One pass to put every item in a Map by id, a second pass to attach each item to its parent's children (or to the roots). It's O(n). Then sort children by position.

**Q: Why store the editor content as JSON instead of HTML?**
A: JSON is structured, so I can validate it, extract text for search and render it through the editor's schema. Raw HTML would need sanitising to be safe against XSS.

## Try it yourself

1. Type quickly in a note and watch the Network tab — you should see one PATCH after you stop, not one per key.
2. Write a unit test for `buildTree` with three levels of nesting and an orphan.
3. Add a "Favourites" section to the sidebar using `isFavourite`.
