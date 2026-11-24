# Modern Kum-Kom (คำคม)

A web version of **Kum-Kom (คำคม)**, the Thai crossword board game, which works like Scrabble for the Thai language. Play solo against a bot with three difficulty levels, or online against a friend.

Live: https://modern-kum-kom.vercel.app

## Features

- **15×15 Kum-Kom board** with 2L/3L/4L letter squares, 2W/3W word squares and the centre star.
- **Real Thai spelling.** Consonants and leading vowels are tiles. Upper and lower vowels and tone marks are free, go in the thin rows above and below each letter, and stack the way Thai does (ที่, ปุ่ม, เกี่ยว).
- **Live move preview.** While you place tiles you see every word you are making, whether each one is in the dictionary, and the exact score, before you press submit.
- **Full rules:** tiles in one line with no gaps, connected to the board, first word through the star, up to one tile placed over an existing one per turn, blank tiles (0 points), dual tiles such as ฆ/ซ, bingo bonus for 6–9 tiles, exchange or pass, and the end-of-game rules (going out, or six scoreless turns).
- **A bot that actually plays Thai.** It searches the whole dictionary on every row and column, adds the vowels and tone marks a word needs, uses blanks and dual tiles, and runs in a Web Worker so the board never freezes. Easy, normal and hard levels.
- **Hints** in solo games: the best move for your rack, placed on the board for you to check.
- **Online play** with quick matching or a private room code, a share link (`/?room=123456`), a ready check, and the win going to the remaining player if someone leaves.
- **Solo games are saved** on the device, so you can close the tab and continue later.
- **Stats** per device: games, wins, high score, best move, recent games.
- **Dictionary search** that runs instantly in the browser.
- Mobile-first layout with a zoom toggle for the board; keyboard focus and reduced motion are respected.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, **Tailwind CSS 4**
- **MongoDB**: the dictionary (`kumkom_db.vocabulary`) and online rooms (`kumkom_db.rooms`, cleaned up automatically by a TTL index)
- **Pusher** for real-time moves
- **NextAuth** for optional Google or Facebook sign-in
- **Vitest** for the game engine tests
- Fonts: Trirong and Anuphan, self-hosted through Fontsource

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in what you have
npm run dev                  # http://localhost:3000
```

Everything in `.env.local` is optional for local development:

- Without `MONGODB_URI`, the word list is read from `src/lib/word_list.json` (see below) and rooms are kept in memory.
- Without the Pusher keys, solo play works and online play shows that it isn't set up.
- Sign-in buttons only appear for providers whose ID and secret are set.

Other scripts: `npm test` (engine tests), `npm run lint`, `npm run typecheck`, `npm run build`. GitHub Actions runs all four on every push and pull request.

### Loading the dictionary

The scripts in `scripts/` build the word list:

1. `extract_word.py` exports the words from the `word.mdb` Access database to `src/lib/word_list.json`. It needs `pyodbc` and the Microsoft Access driver.
2. `upload_to_mongo.py` uploads the list to MongoDB, reading `MONGODB_URI` from `.env.local`.

The browser downloads the whole list once from `/api/words`, and that response is cached for a day. After changing the dictionary, redeploy or wait for the cache to expire.

## How it works

```
src/
├── app/
│   ├── page.tsx            # screens: name, menu, game, online lobby, dictionary, stats
│   └── api/
│       ├── words/          # the full word list (cached)
│       ├── check-word/     # server word check, used only if the list can't be downloaded
│       ├── dictionary/     # server word search fallback
│       ├── rooms/          # create, join and quick-match rooms (MongoDB)
│       ├── multiplayer/    # relays game events to the room through Pusher
│       └── auth/           # NextAuth
├── components/             # game screen, board, rack, dialogs, other screens
├── hooks/
│   ├── useGame.ts          # game controller: placing tiles, submitting, bot turns, online sync
│   └── useDictionary.ts
└── lib/
    ├── game/               # the rules engine (no React, fully tested)
    │   ├── constants.ts    # board layout, letter scores, tile counts
    │   ├── thai.ts         # letters vs. marks, mark stacking, normal form
    │   ├── board.ts        # grid helpers
    │   ├── rules.ts        # evaluateMove: placement rules + scoring
    │   ├── state.ts        # game state and actions (play, exchange, pass, end of game)
    │   ├── bot.ts          # move generator and difficulty levels
    │   ├── bot.worker.ts   # runs the move generator off the main thread
    │   └── dictionary.ts
    ├── client/             # browser helpers: dictionary loader, Pusher, local storage
    └── server/             # MongoDB, word cache, rooms, Pusher
```

The board is a 31×15 grid: odd rows are the 15 letter rows, and the even rows between them hold the free vowels and tone marks of the letter above or below. Every move goes through `evaluateMove` in `src/lib/game/rules.ts`, so the live preview, the submit check, the hint and the bot all follow exactly the same rules. Each game action is a pure function from one game state to the next. Online, the player who moves sends the new state to the room, and each side keeps whichever version is newer.

### Running online play locally

Point both the server and the browser at any Pusher-compatible server (for example soketi on port 6001):

```env
PUSHER_HOST=localhost
PUSHER_PORT=6001
PUSHER_USE_TLS=false
NEXT_PUBLIC_PUSHER_HOST=localhost
NEXT_PUBLIC_PUSHER_PORT=6001
```
