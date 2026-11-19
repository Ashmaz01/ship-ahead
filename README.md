# Ship Ahead

A pass-and-play quiz board game. Players race around Volcano Isle to the harbour, collecting
3 fuel cans to board a ship before the lava reaches the shore. See `SPEC.md` for the full rules.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # rules tests (no browser needed)
npm run build    # type-check and build to dist/
```

## Layout

- `src/rules/`: game rules as plain TypeScript with no Phaser import (board, turns, lava, fuel,
  powers, questions, maths generator). Tested in `game.test.ts`.
- `src/scenes/`: the Phaser scene that draws the island and animates rule events.
- `src/main.ts`, `src/ui/`, `src/styles.css`: HTML screens (story, setup, HUD, questions,
  pause, game over) laid over the canvas.
- `src/data/questions.json`: hand-written questions (science, English, Arabic). Maths is generated.
- `.claude/skills/`: gamedev skills vendored from `gamedev-skills/awesome-gamedev-agent-skills`
  (Apache-2.0).

## Tuning

Board and pacing numbers live in `src/rules/config.ts` (`RULES`, `DIFFICULTY`).
