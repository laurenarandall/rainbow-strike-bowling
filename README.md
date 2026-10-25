# Rainbow Strike Bowling 🌈🎳

A bright, kid-friendly 3D bowling game for young players: rainbow lanes and pins, bumpers on by default, an easy one-tap power meter, confetti and fanfare on strikes, and lots of cheering.

**Play it:** https://bvilleventures.github.io/rainbow-strike-bowling/

## How to play
1. Drag left/right (or use the arrow keys) to aim, then tap (or press Space).
2. Tap again while the power bar is in the big green zone.
3. Watch the pins fly!

## Development
```bash
pnpm install
pnpm dev      # local dev server
pnpm build    # production build into web/dist
pnpm --filter @bowling/web test
```

Built with TypeScript, React, Babylon.js, Vite and Tailwind. Deployed to GitHub Pages by `.github/workflows/pages.yml`.

## Credits
Based on [freegamestore-online/bowling](https://github.com/freegamestore-online/bowling) (MIT License, © 2026 FreeAppStore), which also provides the `@freegamestore/games` UI frame package. This fork keeps the original MIT license; see [LICENSE](LICENSE).
