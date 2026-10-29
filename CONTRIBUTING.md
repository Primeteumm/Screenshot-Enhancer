# Contributing to Screenshot Enhancer

Thanks for taking the time to help! Bug reports, ideas, translations and pull requests are all welcome.

## Reporting bugs and ideas

Open an [issue](https://github.com/Primeteumm/Screenshot-Enhancer/issues/new/choose) using the bug or feature template. For bugs, the app version (bottom right of Settings), your Windows version and the screenshot tool you used help a lot. Running with `SE_DEBUG=1` prints hit-testing and click-through state to the console.

## Development setup

You need Windows 10/11 and [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/Primeteumm/Screenshot-Enhancer.git
cd Screenshot-Enhancer
npm install
npm start
```

`npm run dist` builds the NSIS installer into `dist/`. `npm run icons` regenerates the icons.

The [project structure](README.md#build-from-source) and the [Windows quirks the app works around](README.md#how-it-works) are documented in the README. Please read the quirks section before touching `previewManager.js` or the preview window: several "obvious" simplifications break input or drag & drop.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep the change focused; one fix or feature per PR.
3. Match the surrounding code style (plain CommonJS, no build step, no framework).
4. Test it by running the app; describe how in the PR.
5. If you change UI text, update both `tr` and `en` in `src/renderer/shared/i18n.js`.

If you plan a bigger change, open an issue first so we can agree on the approach.

## Adding a language

Translations are a great first contribution:

1. Copy the `en` block in [`src/renderer/shared/i18n.js`](src/renderer/shared/i18n.js) under a new language code (e.g. `de`) and translate the values. Keep the keys and `{placeholders}` unchanged.
2. Add the code to the allowed values of `general.language` in [`src/main/config.js`](src/main/config.js).
3. Add an `<option>` for it in the language select in [`src/renderer/settings/index.html`](src/renderer/settings/index.html).
4. Check every window (settings, thumbnail toolbar, tray menu) for text that overflows.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
