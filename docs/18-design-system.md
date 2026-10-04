# 18 · The design system: calm + playful

## What it is

A **design system** is the set of shared decisions that make every screen look like it belongs to the same app: colours, fonts, spacing, corner radius, and a small kit of reusable components (buttons, cards, inputs, badges).

StudyApp's style is **"calm + playful"**:

- **Calm, like Notion.** Warm greys, a quiet grey sidebar, lots of white space, thin borders, big bold page titles with an emoji "page icon", and property rows (Status, Subject, Tags) on a document page.
- **Playful, like Duolingo.** A bright green brand colour, chunky rounded buttons with a darker "3D" bottom edge that squashes when you press it, emoji, friendly copy ("This page wandered off. Let's get you back on track."), and (in phase 5) a **mini streak** of correct flashcard answers in a row.

Studying is hard and a bit boring; the calm half keeps the app easy to read for long sessions, and the playful half makes it a little more fun.

> **A design decision worth talking about:** an early version had Duolingo-style daily XP goals and day streaks. We took them out. Day streaks can make studying feel like a chore you'll be punished for missing, and for a study app the meaningful number is "did I remember this?". So the only streak is a small, in-session one: flashcards answered correctly in a row. Being able to explain _why you removed a feature_ is a great interview answer.

## Why we use it (and the alternatives)

| Decision                      | What we chose                                     | Alternatives                   | Why                                                                                                     |
| ----------------------------- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Styling                       | Tailwind CSS 4 + **CSS variables as tokens**      | CSS modules, styled-components | One place (`index.css`) defines every colour; dark mode is a variable swap, not a second stylesheet.    |
| Component kit                 | Our own small kit in `components/ui/`             | MUI, Chakra, shadcn/ui         | Fewer dependencies, and you can explain every line in an interview.                                     |
| Accessible menu               | **Radix** Dropdown Menu (unstyled)                | Writing it by hand             | Menus are hard: arrow keys, Escape, focus return, screen-reader roles. Radix does that; we do the look. |
| Icons                         | **lucide-react** (+ emoji for "page icons")       | Font Awesome, heroicons        | Tree-shaken: only the icons we import end up in the bundle.                                             |
| Fonts                         | **Nunito** (headings) + **Inter** (body), bundled | Google Fonts CDN, system fonts | Self-hosted with `@fontsource`: free, works offline, and no third-party request (privacy, CSP).         |
| Theme (light / dark / system) | `localStorage` in this browser                    | A column in the `User` table   | It's a per-device preference. Your phone can be dark while your laptop is light.                        |

## Where it lives

| File                                              | What it does                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/web/src/index.css`                          | Design tokens (colours, fonts, radius) for light and dark mode                           |
| `apps/web/public/theme.js`                        | Applies the saved theme **before** React loads, so dark mode never flashes white         |
| `apps/web/src/lib/theme.ts`                       | `useTheme()` and `setTheme()` for React                                                  |
| `apps/web/src/components/ui/*`                    | Button (+ `buttonClass`), Card, TextField, Alert, Badge, Avatar, ProgressBar, PageHeader |
| `apps/web/src/components/AppLayout.tsx`           | The Notion-style sidebar, today's goal widget, and the phone menu                        |
| `apps/web/src/components/ProfileMenu.tsx`         | The profile button: settings links, theme switch, sign out                               |
| `apps/web/src/features/settings/*`                | Settings pages: Profile, Appearance, Security, Your data                                 |
| `apps/web/src/features/home/HomePage.tsx`         | Greeting, library stats, "Jump back in", quick actions                                   |
| `apps/api/src/modules/account/account.service.ts` | Profile updates, data export, account deletion                                           |

## The code, explained

### 1. Tokens: colours as CSS variables

Components never say "grey #e9e9e7". They say `border-line`. The value of `line` depends on the theme:

```css
:root {
  --line: #e9e9e7; /* light mode border */
  --ink: #37352f; /* light mode text (Notion's warm black) */
}
.dark {
  --line: #2f2f2f;
  --ink: #e8e7e4;
}

/* Tailwind turns each token into classes: border-line, text-ink, bg-canvas ... */
@theme inline {
  --color-line: var(--line);
  --color-ink: var(--ink);
}
```

`@theme inline` matters: it tells Tailwind to write `var(--line)` into the class, so when `<html class="dark">` changes, every border changes with it. No `dark:` prefixes needed in components.

### 2. Accessible brand green (WCAG contrast)

Duolingo's famous green (`#58CC02`) with white text has a contrast ratio of only **2.1 : 1**. The WCAG AA rule for normal text is **4.5 : 1**, so many people would struggle to read a white label on it. We split the green into roles:

- `brand-500` `#58CC02`: the bright green for bars, charts and big decorative areas (no small white text on it).
- `brand-600` `#2A8000`: button background. White text on it is **4.9 : 1**, which passes AA.
- `brand-700`: the darker "3D" edge under the button.

We checked each pair with the WCAG formula (relative luminance) before picking them. Saying this in an interview shows you know accessibility is more than alt text.

### 3. The chunky 3D button

```ts
// A thick bottom border is the "3D" edge. When pressed, it shrinks and the button moves down 2px,
// and a 2px margin stops the buttons around it from jumping.
const PRESS = 'border-b-4 active:enabled:translate-y-[2px] active:enabled:border-b-2 active:enabled:mb-[2px]';
```

`buttonClass()` lives in its own file so a `<Link>` can look like a button (`<Link className={buttonClass('primary')}>`) without breaking Vite's fast refresh (a `.tsx` file should export only components).

### 4. No white flash in dark mode

React loads after the page's HTML. If dark mode were applied in React, a dark-mode user would see a white page for a split second. So `public/theme.js` runs first, in `<head>`, and adds `class="dark"` straight away. It's a separate file, not inline `<script>` code, because our **Content Security Policy** (Helmet) blocks inline scripts, which is one of our XSS defences.

### 5. The profile menu (Radix)

```tsx
<Menu.Root>
  <Menu.Trigger aria-label="Profile and settings">…avatar, name, email…</Menu.Trigger>
  <Menu.Portal>
    <Menu.Content side="top">
      <Menu.Item onSelect={() => navigate('/settings/security')}>Security</Menu.Item>
      <Menu.RadioGroup value={theme} onValueChange={setTheme}>
        …Light / Dark / System…
      </Menu.RadioGroup>
      <Menu.Item onSelect={() => logout.mutate()}>Sign out</Menu.Item>
    </Menu.Content>
  </Menu.Portal>
</Menu.Root>
```

Radix is "headless": it renders no styles, only behaviour and ARIA roles (`menu`, `menuitem`, `menuitemradio`). Style hooks come as data attributes, e.g. `data-[highlighted]:bg-hover` for the item under the keyboard cursor.

### 6. The mini streak (phase 5)

The only "streak" in StudyApp is a small one, inside a flashcard review session: how many cards you've answered correctly **in a row** ("🔥 5 in a row!"). Missing a card (rating it _Again_) resets it, and the best run of the session shows on the summary screen. Nothing is saved across days. The rule is a tiny pure function with unit tests; see [12-flashcards-sm2.md](12-flashcards-sm2.md#using-it--studyservicets).

### 7. Settings under the profile button

Settings is one route with child routes, so every tab has its own URL (`/settings/security` can be linked from emails and the MFA nudge):

| Tab        | What you can do                                                                |
| ---------- | ------------------------------------------------------------------------------ |
| Profile    | Display name and study level (`PATCH /api/account/profile`)                    |
| Appearance | Light / dark / system theme (saved in this browser)                            |
| Security   | Two-factor sign-in, password, active sessions, security history (from phase 2) |
| Your data  | Download everything as JSON, or delete your account                            |

**Why "Your data"?** South Africa's privacy law, **POPIA** (like Europe's GDPR), gives people the right to see the personal information you hold about them and to have it deleted. Both actions need your password (and your MFA code, for deletion), so someone who steals a session cookie can't download or destroy the account. The export leaves out password hashes, the MFA secret and recovery codes. Deletion removes the `User` row and the database **cascades** (`onDelete: Cascade`) to everything they own.

`PATCH /api/account/profile` validates with a Zod schema that lists only `displayName`, `studyLevel` and `schoolGrade` (a grade sent with a non-school level is dropped). Anything else in the body (say `aiDailyQuota: 100000`) is dropped, which prevents **mass assignment**. There's a test for that.

### 8. Smaller first load (code splitting)

The library and settings pages load on demand with React Router's `lazy`, and Vite puts libraries in their own `react` and `vendor` files. After a deploy, returning visitors only re-download the small app file.

### 9. Words that match the study level

`levelWords()` in `packages/shared/src/studyLevel.ts` changes a few words to match the student: South African schools say **learner** and **subject**, universities say **module** and **exam**. The `useLevelWords()` hook gives components the right words, so the library says "Modules" for a university student and "Subjects" for a Grade 10 learner. The study level picker (`components/StudyLevelPicker.tsx`) is one component used in three places: sign-up, Settings → Profile, and a "One quick question" card on Home for accounts made before levels existed.

## Common mistakes

- **Hard-coding colours** (`text-slate-500`) in components. Dark mode then needs a `dark:` twin everywhere. Use tokens (`text-muted`).
- **Checking contrast by eye.** Bright green looks readable to many people and isn't to others. Measure it.
- **Applying the theme in a React effect.** You get a white flash. Apply it before React loads.
- **Adding game features without asking if they help.** Points and day streaks are easy to add and can backfire (stress, gaming the system). Tie rewards to real learning, like correct answers.

## Interview questions

**Q: How does dark mode work in your app?**
A: Colours are CSS variables. Light values sit on `:root`, dark values on `.dark`. Tailwind classes point at the variables. A tiny script in `<head>` reads the saved choice (or the OS setting) and sets the class before React renders, so there's no flash. It's an external file because our CSP blocks inline scripts.

**Q: Why use Radix instead of building the dropdown yourself?**
A: Accessible menus need focus management, arrow-key navigation, Escape to close, focus returning to the button, and the right ARIA roles. Radix provides that behaviour unstyled, and we style it with Tailwind. It's tested by a big community, which beats my first attempt.

**Q: You had daily streaks and XP, then removed them. Why?**
A: Day streaks reward opening the app, not learning, and they can make students anxious about missing a day. I kept the fun part where it matters: a combo of correct flashcard answers in one session. It's simpler too: no extra table, no time-zone maths, just React state and a pure function.

**Q: What stops someone exporting or deleting another person's data?**
A: Both routes use the signed-in user's id from the session, never an id from the request, and both need the current password (deletion also needs the MFA code if it's on). They also have the CSRF check and a rate limit.

## Try it yourself

1. Add a new token `--accent-soft` for a pale purple, use it on the "Coming soon" card, and check it in both themes.
2. Make the 3D press effect respect `prefers-reduced-motion` (hint: it already does via `index.css`; find out how).
3. Sketch the mini streak: write `nextCombo()` and its tests before phase 5 starts. What should happen to the combo when a card is skipped?
