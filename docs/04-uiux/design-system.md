# Design system

This document gives the current mood board and the design system of the app (LogBound, D-64). It also tells how the design is split into replaceable parts, so that the UI/UX team can change the look without a change to the pages. The UI/UX team owns the design (D-26). The developer keeps this file the same as the code.

Status: 2026-10-30. Source of the values: the UI/UX team repository `Yandev13/log-bound` (2026-10-28) and the instructions of the UI/UX head (2026-10-30). The Figma file still shows the old mood board (`docs/01-project/uiux-moodboard-summary.md`). Open issue UI-02: the UI/UX team must confirm the hex values.

## 1. Brand

| Item | Value |
|---|---|
| Product name on screen | LogBound (logo). The text name in `strings.ts` is `OJT-DTR` until the team confirms the name. |
| Logo file | `system/frontend/src/assets/brand/log-bound-logo.png` (900 px wide, white background) |
| Logo status | Blue and orange. The team must send a teal and amber logo (UI-02). |
| Tone | Clean, calm, and quick. Teal gives trust. Amber marks the action. |

## 2. Mood board (current)

### 2.1 Colors

| Token | Name | Hex | Role | Text on it |
|---|---|---|---|---|
| `primary` | Teal | `#0F766E` | Header, tab bar, titles, links, selected items | White (5.5:1) |
| `secondary` | Amber | `#F59E0B` | Main action buttons, the active tab mark, unread marks | Black `#111111` (9.0:1) |
| `tertiary` | Dark teal | `#115E59` | Charts, second accent | White (7.6:1) |
| `success` | Green | `#1E9E54` | Approved, synced | White |
| `warning` | Light amber | `#FBBF24` | Submitted, pending, notes | Black |
| `danger` | Red | `#D6232F` | Errors, returned, rejected | White |
| `medium` | Gray | `#6B7280` | Draft, small text | White |
| `light` | Mist teal | `#F1F6F5` | Cards, list items, segment background | Black |
| `dark` | Black | `#111111` | Body text | White |

Proportion: about 60% white and mist, 30% teal, 10% amber. Use amber only for the one main action on a screen.

CAUTION: Do not put amber text on white or teal. The contrast is less than 4.5:1 (QR-IC-06). Use amber as a fill with black text, or as a mark (line, dot, bar).

### 2.2 Typography

| Token | Font | Use | Weights |
|---|---|---|---|
| `--font-heading` | Plus Jakarta Sans | Big text, page titles, headers (`h1` to `h4`), sub headers, big numbers (stat tiles, progress ring) | 600, 700, 800 |
| `--ion-font-family` | Inter | Small text: body, lists, buttons, inputs, labels, times | 400, 500, 600 |

Numbers use `font-variant-numeric: tabular-nums` so that columns of times and hours align.

### 2.3 Shapes and space

| Token | Value | Use |
|---|---|---|
| `--radius-s` | 10px | Buttons, inputs |
| `--radius-m` | 12px | List items, segments, notes |
| `--radius-l` | 16px | Cards, tab bar, logo panel |
| `--space-1` to `--space-6` | 4, 8, 12, 16, 24, 32 px | Gaps and padding |
| `--elevation-1` | Soft shadow | Floating tab bar, sheets |

### 2.4 Components (current look)

| Component | Look |
|---|---|
| Header bar | Teal, white title in Plus Jakarta Sans |
| Tab bar | Floating, rounded (16px), teal. Selected tab: light amber text and an amber mark. |
| Main button | Amber fill, black text, 10px corners, no capital letters |
| Outline button | Teal line and teal text |
| Card and list item | Mist fill, no shadow, 12px to 16px corners |
| Status badge | Color of the status (success, warning, danger, medium), with an icon and a text label (QR-IC-08) |
| Login page | Teal top part with a curved amber edge. Logo on a white panel. |

## 3. Modular structure (how to change the design)

The design is in replaceable layers (D-31, frontend rule 13). A page file does not contain hex colors, font names, text, or asset paths.

| Layer | File | Contents | Who changes it |
|---|---|---|---|
| 1. Tokens | `src/theme/variables.scss` | Colors, fonts, radius, space, elevation | UI/UX team |
| 2. Motion | `src/theme/motion.scss` | Motion durations and curves, keyframes, motion classes, the reduced-motion rule | UI/UX team |
| 3. Component styles | `src/theme/components.scss` | Global look of Ionic parts: buttons, cards, tab bar, inputs, segments | UI/UX team |
| 4. Assets | `src/assets/brand/`, `src/assets/illustrations/`, `src/assets/animations/` | Logo, empty-state pictures, animation files | UI/UX team (section 5 of the UI/UX team rules) |
| 5. Asset map | `src/app/shared/brand.ts` | One name for each asset path. Pages use the name, not the path. | Developer, after the team sends a new asset |
| 6. Text | `src/app/shared/strings*.ts` | All screen text | UI/UX team or developer |
| 7. Shared parts | `src/app/shared/ui/`, `shared/page-header/`, `shared/sync-status/` | Progress ring, bar chart, stat tile, status badge, empty state, header | Developer, from a team design |
| 8. Pages | `src/app/features/*/` | Layout of one screen | Developer |

A change in layers 1 to 6 changes all screens. No page change is necessary.

## 4. Motion

The app uses motion to show a change of state. Motion must not delay the user (QR-PE-01: a punch confirmation in 1 second or less).

| Token | Value | Use |
|---|---|---|
| `--motion-fast` | 120ms | Press feedback, small state changes |
| `--motion-medium` | 220ms | Lists, cards, badges that come in |
| `--motion-slow` | 360ms | Page parts, the progress ring, success marks |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most motion |
| `--ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1.3)` | Success marks (small overshoot) |

Motion classes in `motion.scss`:

| Class | Effect |
|---|---|
| `.anim-fade-in` | Fade in |
| `.anim-rise-in` | Fade in and move up 8px |
| `.anim-pop` | Scale from 0.9 to 1 with a small overshoot (success, punch confirmation) |
| `.anim-stagger` | Gives the children of a list a short delay, one after the other (maximum 8 children) |
| `.anim-pulse` | Slow pulse for a live state (syncing, open work session) |

Rules:

1. Each motion stops when the operating system asks for reduced motion (`prefers-reduced-motion: reduce`). `motion.scss` does this for all classes.
2. Animate only `transform` and `opacity`. Other properties make the page slow on older phones.
3. Each motion is 400ms or less. A loop is permitted only for a live state (syncing, a busy spinner).
4. Motion never hides data or controls. The final state must be the same with and without motion.
5. Animation files (Lottie) are for empty states, success screens, and onboarding only. See the UI/UX team rules, section 6.

## 5. Accessibility rules

| Rule | Requirement |
|---|---|
| Text contrast 4.5:1 or more | QR-IC-06 |
| Touch targets 48 x 48 dp or more | QR-IC-03 |
| Each control has an accessible name | QR-IC-07 |
| Layout is usable at 200% font size | QR-IC-06 |
| Each sync status has an icon and a text label (not only a color) | QR-IC-08 |
| Each irreversible action asks for confirmation | QR-IC-04 |

## 6. Dark mode

The app uses the light theme only. The tokens set a white background in all system modes. A dark theme is not a requirement. If the team makes a dark theme, add it as a token set in `variables.scss` under `@media (prefers-color-scheme: dark)`, and write a decision first.
