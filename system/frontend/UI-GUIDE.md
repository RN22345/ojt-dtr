# UI guide for the UI/UX team

This guide shows where to change the look of the app. All paths are in `system/frontend/`.

## 1. See your changes at once (no rebuild)

Do not run `ng build` or make an APK for each change. Use the dev server. It reloads the page when you save a file.

1. In the `system/frontend/` folder, run `npm install` (first time only).
2. Run `npm start`.
3. Open http://localhost:4200 in Chrome.
4. Press F12, then press Ctrl+Shift+M. This shows the phone view.

To see the OJT and facilitator screens in a browser, open `src/environments/environment.ts`. Set `platformOverride: 'mobile'`. Do not send this change back to the developer.

To see an admin screen, set `platformOverride: null` and log in as admin.

If the browser shows an old page, press Ctrl+Shift+R.

## 2. Which file changes what

| What you want to change | File | What to edit |
|---|---|---|
| All colors | `src/theme/variables.scss` | Change the Ionic color variables (section 3). Teal is primary. Amber is secondary. |
| All text on the screens (buttons, titles, messages) | `src/app/shared/strings.ts` and `src/app/shared/strings-ui.ts` | Change the text in quotation marks. |
| System name on screen | `src/app/shared/strings.ts` | Change `appName`. |
| Name in the browser tab | `src/index.html` | Change `<title>`. |
| Font | `src/theme/variables.scss` | `--font-heading` (Plus Jakarta Sans) and `--ion-font-family` (Inter) (section 4). |
| Login page logo | `src/assets/log-bound-logo.png` | Replace the file. Keep the same name. Make it 900 px wide or less. |
| Browser tab icon | `src/assets/icon/favicon.png` | Replace the file. Keep the same name. |
| One page | `src/app/features/<module>/` | Edit the `.ts` file of the page (the layout and styles are inside it). |
| Shared parts (header, tiles, rings) | `src/app/shared/` | Edit the part. All pages that use it change. |
| Page order and tabs | `src/app/shells/ojt.routes.ts` and `facilitator.routes.ts` | Do not change without the developer. |

Fake data for the prototype pages is in `src/app/data/mock/`.

## 3. Colors

The colors are in `src/theme/variables.scss`. To change a color, replace its hex values. Use the Ionic color generator to make all five values from one color: https://ionicframework.com/docs/theming/color-generator

```scss
:root {
  --ion-color-primary: #3880ff;
  --ion-color-primary-rgb: 56, 128, 255;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-contrast-rgb: 255, 255, 255;
  --ion-color-primary-shade: #3171e0;
  --ion-color-primary-tint: #4c8dff;
}
```

Do the same for `secondary`, `tertiary`, `success`, `warning`, `danger`, `medium`, and `light` if you want to change them.

Other useful variables:

| Variable | Effect |
|---|---|
| `--ion-background-color` | Page background |
| `--ion-text-color` | Main text color |
| `--ion-toolbar-background` | Header bar color |
| `--ion-tab-bar-background` | Bottom tab bar color |
| `--ion-item-background` | List item background |

The app uses these variables everywhere. A color change here changes the full app.

## 4. Font

The app has two fonts (D-64):

| Variable in `src/theme/variables.scss` | Font | Used for |
|---|---|---|
| `--font-heading` | Plus Jakarta Sans | Big text, headers (`h1` to `h4`), sub headers, page titles, big numbers |
| `--ion-font-family` | Inter | Small text, buttons, inputs, lists |

The font files come from npm packages (`@fontsource-variable/inter`, `@fontsource-variable/plus-jakarta-sans`). The build puts them in the app. Do not add `.ttf` files to `src/assets/`.

To use a different font, ask the developer to install its `@fontsource-variable` package. Then change the `@import` line and the variable in `variables.scss`.

Use a font file, not a link to Google Fonts. The mobile app must work with no network.

## 5. Rules

- Keep the UI text in `strings.ts`. Do not write text inside the page files.
- Use the color variables. Do not write hex colors inside the page files.
- Do not change files in `src/app/core/`, `src/app/data/`, or `src/app/plugins/`. Ask the developer.
- Do not change `.spec.ts` files.
- Send the developer the list of files you changed, or the changed files only. Do not send the whole folder.
