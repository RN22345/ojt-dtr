# UI/UX team requirements

This document gives the rules that the UI/UX team must obey when the team designs screens and sends assets for the app. The rules make sure that each design can go into the app without rework, that the app stays fast and offline, and that the design can change later. The app uses dynamic and animated designs.

Read `design-system.md` first. It gives the current tokens and the modular structure. For the dev server and the files to edit, read `system/frontend/UI-GUIDE.md`.

The words "must" and "must not" are mandatory. The developer can refuse an asset that does not obey a "must" rule.

## 1. Scope of the design

1. The requirements are the source of each screen (D-34). A screen must show the data and the actions of its requirements (`docs/02-requirements/functional-requirements.md`). If the design needs a new function, ask the developer first. The developer writes the requirement before the work starts (AGENTS.md, rule 11).
2. Do not design screens or menus that have no requirement (for example, Committee Management, Alumni Records).
3. Design each mobile screen for these states. A screen design is not complete without them:

   | State | What the screen shows |
   |---|---|
   | Normal | Data |
   | Empty | No data yet, with one sentence and one action |
   | Loading | A skeleton or a spinner. No blank screen. |
   | No network | The sync status bar shows "No network". The screen still works (offline). |
   | Server not reachable | The sync status bar shows "Server not reachable". |
   | Error | The cause and the correction, at the field or in a note |
   | Sync status of a record | Synced, pending, or issue, with an icon and a text label (QR-IC-08) |

4. The mobile app is for the OJT and the facilitator. The web app is for the admin only. Do not put admin functions in the mobile design, or mobile functions in the web design (FR-AUTH-03).
5. Each irreversible action (submit, approve, return, reject, deactivate) must have a confirmation step in the design (QR-IC-04).

## 2. Frame sizes

| Platform | Frame | Notes |
|---|---|---|
| Mobile | 390 x 844 (main), also check 360 x 800 | Android phones. Keep 16px side margins. |
| Web (admin) | 1440 x 900, also check 1280 x 800 | Desktop browsers only |

The bottom tab bar of the mobile app has a maximum of five tabs.

## 3. Tokens: colors, fonts, space

1. Use only the tokens of `design-system.md`, section 2. Make each color, text style, radius, and space a Figma variable or style with the same name as the token (for example, `primary`, `font-heading`, `radius-m`).
2. A new color must be a new token. Send its hex value, its role, and the text color on it. The contrast of text on it must be 4.5:1 or more (QR-IC-06).
3. Do not use amber text on white or on teal.
4. Use only two font families: Plus Jakarta Sans (big text, headers) and Inter (small text). A new font needs a decision. The developer installs fonts from npm (`@fontsource-variable`). Do not send font files.
5. Minimum text size: 12px for small labels, 14px for body text.
6. Touch targets must be 48 x 48 dp or larger (QR-IC-03).

## 4. Text

1. Write screen text in ASD-STE100 style: short sentences, one instruction in each sentence, approved words (`docs/00-standards/ste100-writing-rules.md`).
2. Put the final text in the design, not "Lorem ipsum". The developer copies it to `strings.ts`.
3. Do not put text inside images or animations. Text in an image cannot change, cannot be read by a screen reader, and does not scale.

## 5. Assets (logos, icons, pictures)

### 5.1 Formats

| Asset | Format | Size limit | Notes |
|---|---|---|---|
| Logo | SVG (preferred), and PNG with a transparent background | SVG 50 KB, PNG 150 KB | Send a full logo and a square mark. Send a light and a dark background version. |
| App icon (Android) | PNG 1024 x 1024, and the foreground layer on a transparent background | 300 KB | The mark must fit in the center 66% (Android adaptive icon safe zone). |
| Splash screen | SVG or PNG 2732 x 2732, logo in the center 1200 x 1200 | 500 KB | One color background from the tokens |
| Icons | Use Ionicons (already in the app). A custom icon must be SVG, 24 x 24 grid, one color (`currentColor`), no text. | 5 KB each | The developer changes the color with tokens. |
| Illustrations (empty states, onboarding) | SVG | 60 KB each | Use token colors only, so that a token change changes the picture. |
| Photos (if necessary) | WebP or JPEG, 2x size | 150 KB each | No photos of real people without written permission |
| Animations | Lottie JSON or dotLottie (`.lottie`) | 80 KB each | See section 6 |

The total size of all new assets must be 2 MB or less. The release APK must be 25 MB or less (QR-PE-06).

### 5.2 Rules

1. Each asset must operate offline. Do not link to a CDN, Google Fonts, or a web URL. The app bundles all assets.
2. Remove hidden layers, unused symbols, and editor metadata from SVG files (for example, with SVGO).
3. Do not use the old 5.5 MB logo PNG. Give large images in the size of their use, at 2x.
4. Each asset must have a license that permits use in the app. Record the source and the license in the asset list (section 7).

### 5.3 File names

Use lowercase letters, digits, and hyphens only. Use this pattern: `<group>-<name>[-<variant>].<ext>`.

| Folder | Example |
|---|---|
| `assets/brand/` | `brand-logo.svg`, `brand-logo-dark.svg`, `brand-mark.svg` |
| `assets/illustrations/` | `empty-reports.svg`, `empty-notifications.svg`, `offline.svg` |
| `assets/animations/` | `anim-punch-success.json`, `anim-sync-done.json`, `anim-empty-reports.json` |
| `assets/icons/` | `icon-correction.svg` |

To replace an asset, keep the same file name. Then no code changes.

## 6. Animations

### 6.1 Two types of motion

| Type | Made with | Used for | Who makes it |
|---|---|---|---|
| Interface motion | CSS in `motion.scss` (tokens and classes) | Press feedback, lists that come in, badges, page parts, the progress ring | UI/UX team gives the motion spec. The developer builds it. |
| Illustration animation | Lottie (JSON or dotLottie) | Punch success, sync done, empty states, onboarding | UI/UX team makes the file |

### 6.2 Motion spec (for interface motion)

For each motion, give the developer this table. Use the tokens of `design-system.md`, section 4.

| Item | Example |
|---|---|
| Trigger | The punch is saved |
| Element | The time-in button and the confirmation card |
| Property | Scale and opacity (only `transform` and `opacity`) |
| From and to | Scale 0.9 to 1, opacity 0 to 1 |
| Duration | `--motion-slow` (360ms) |
| Curve | `--ease-emphasized` |
| Reduced motion | No scale. The card shows at once. |

A Figma Smart Animate prototype or a short screen video (MP4, 10 seconds or less) helps, but the table is mandatory.

### 6.3 Rules for all animations

1. Each animation is 400ms or less, except an illustration animation (2 seconds or less) and a loop for a live state.
2. An animation must not delay a user action. The punch confirmation must show in 1 second or less (QR-PE-01).
3. Each animation must have a reduced-motion version: a still frame or no motion (`prefers-reduced-motion`).
4. An animation must not flash more than three times in one second (WCAG 2.3.1).
5. The final state of a screen must be the same with and without the animation.

### 6.4 Rules for Lottie files

1. Export with Bodymovin or LottieFiles. Use shape layers only. Do not use images inside the file, expressions, or text layers.
2. Size: 80 KB or less for each file. Frame rate 30 fps. Canvas 400 x 400 or smaller.
3. Use only token colors. Name each color layer with its token name (for example, `primary`, `secondary`), so that the developer can change the colors in the code.
4. Give the first frame or the last frame as the still frame for reduced motion. Write its frame number in the asset list.
5. Test the file in the LottieFiles preview before you send it.

## 7. How to send a design or an asset

1. Put the screens in the Figma file "OJT Weekly Report and DTR Monitoring". Use one page for each area (Mobile OJT, Mobile facilitator, Web admin, Components, Tokens). Name each frame `<Platform> / <Area> / <Screen> / <State>`, for example `Mobile / OJT / Weekly reports / Empty`.
2. Mark each frame that is ready for the developer with the Figma status "Ready for development". The developer builds only frames with this status.
3. Send assets in one of these two ways:
   - A pull request to the GitHub repository (`RN22345/ojt-dtr`) on a branch named `design/<short-name>`. Put the files in the folders of section 5.3. Do not change code files, except `strings*.ts` and the files of layers 1 to 3 in `design-system.md`, section 3.
   - A ZIP file with only the new or changed files, in the same folder structure. Do not send the full project.
4. Add a row to the asset list for each new or changed asset. The asset list is a table in the pull request description or in a file `asset-list.md` in the ZIP:

   | File | Use (screen and state) | Size | Source and license | Reduced-motion frame (animations) |
   |---|---|---|---|---|
   | `assets/animations/anim-punch-success.json` | DTR page, after a punch | 42 KB | Own work | Frame 45 |

5. For a token change, send the new values and the reason. The developer updates `design-system.md` and records a decision for a large change.
6. The developer checks each delivery against this document within two work days. The developer gives a list of the items that do not obey a rule.

## 8. Checklist before you send

- [ ] Each screen has all the states of section 1, item 3.
- [ ] Only tokens are used. Text contrast is 4.5:1 or more. Touch targets are 48 dp or more.
- [ ] Text is final and in ASD-STE100 style. No text is in images.
- [ ] Each asset obeys the format, size, and name rules of section 5.
- [ ] Each animation has a motion spec or a Lottie file that obeys section 6, with a reduced-motion version.
- [ ] Nothing loads from the internet.
- [ ] The asset list is complete.
