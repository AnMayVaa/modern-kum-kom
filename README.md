# Modern Kum-Kom (คำคม)

A web version of **Kum-Kom (คำคม)**, the Thai crossword board game, which works like Scrabble for the Thai language. Play solo against a bot with three difficulty levels, or online against a friend.

Live: https://modern-kum-kom.vercel.app · How to play: https://modern-kum-kom.vercel.app/about

Made by **พิทักษ์ ปทุมวัน (Pitak "Ohm" Patumwan)**, Computer Engineering, King Mongkut's University of Technology North Bangkok (KMUTNB) · GitHub [@AnMayVaa](https://github.com/AnMayVaa)

## Features

- **The official Kum-Kom board**: 15 columns × 9 rows with the printed board's six special squares (red 3× word, pink 2× word, purple 5×, orange 4×, green 3×, light blue 2× letter) and the centre star.
- **The official rules** (rule sheet of October 2552): earlier words come off the board after every turn, replacing a letter in the opposite direction, drawing a tile to decide who starts, exchanging only while 9+ tiles are in the bag, tone marks over ำ (ต่ำ), and the end-of-game scoring.
- **Real Thai spelling.** Consonants and leading vowels are tiles. Upper and lower vowels and tone marks are free, go in the thin rows above and below each letter, and stack the way Thai does (ที่, ปุ่ม, เกี่ยว).
- **Live move preview.** While you place tiles you see every word you are making, whether each one is in the dictionary, and the exact score, before you press submit.
- **Game options:** bot level, a turn or game clock (official 2 min/turn or 25 min/game with a 10-point-per-minute penalty), hint limits, and a tournament word check where an invalid word loses the turn.
- **Easy tile placement:** tap a tile then a square, drag tiles onto the board, or tap a square and then tap tiles in order; drag tiles in the rack to reorder them. On a computer, click a square and type the word (vowels and tone marks included); Enter plays, Backspace undoes, Esc recalls.
- **A bot that actually plays Thai.** It searches the whole dictionary on every row and column, adds the vowels and tone marks a word needs, uses blanks and dual tiles, and runs in a Web Worker so the board never freezes. Easy, normal and hard levels.
- **Hints** in solo games: the best move for your rack, placed on the board for you to check.
- **Online play** with quick matching or a private room code, a share link (`/?room=123456`), a ready check, and the win going to the remaining player if someone leaves.
- **Solo games are saved** on the device, so you can close the tab and continue later.
- **Stats** per device: games, wins, high score, best move, recent games.
- **Dictionary search** over all 25,551 words, instantly in the browser.
- Mobile-first layout with a zoom toggle for the board; keyboard focus and reduced motion are respected.
- **Easy to find:** server-rendered landing content, an about page with the full rules and FAQ, sitemap, robots.txt that welcomes search engines and AI crawlers, `llms.txt` for AI assistants, schema.org data (game, author, FAQ), and Open Graph / Twitter preview images.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**, **Tailwind CSS 4**
- **Dictionary**: 25,551 words from the original game's `word.mdb`, shipped with the app in `src/data/words.json`
- **MongoDB** (optional): online rooms (`kumkom_db.rooms`, cleaned up automatically by a TTL index)
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

- Without `MONGODB_URI` (or if the database is down), online rooms are kept in server memory. That works locally, but on Vercel two players can reach different servers, so set up a database for reliable matchmaking.
- Without the Pusher keys, solo play works and online play shows that it isn't set up.
- Sign-in buttons only appear for providers whose ID and secret are set.

Other scripts: `npm test` (engine tests), `npm run lint`, `npm run typecheck`, `npm run build`. GitHub Actions runs all four on every push and pull request.

### Updating the dictionary

The word list lives in `src/data/words.json` and ships with the app, so word checks never depend on a database. To rebuild it from the original game's Access file:

```bash
pip install access-parser
python scripts/extract_word.py path/to/word.mdb
```

The script splits the few entries that hold two words or a bracketed variant, drops stray digits and commas, and removes duplicates. The browser downloads the list once from `/api/words`, and that response is cached for a day, so redeploy after changing it.

## How it works

```
src/
├── app/
│   ├── page.tsx            # screens: name, menu, game, online lobby, dictionary, stats
│   └── api/
│       ├── words/          # the full word list (cached)
│       ├── check-word/     # server word check, used only if the list can't be downloaded
│       ├── dictionary/     # server word search fallback
│       ├── rooms/          # create, join and quick-match rooms (MongoDB, or memory)
│       ├── multiplayer/    # relays game events to the room through Pusher
│       └── auth/           # NextAuth
├── components/             # game screen, board, rack, dialogs, other screens
├── data/words.json         # the dictionary
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

The board is a 19×15 grid: odd rows are the 9 letter rows, and the even rows between them hold the free vowels and tone marks of the letter above or below. Every move goes through `evaluateMove` in `src/lib/game/rules.ts`, so the live preview, the submit check, the hint and the bot all follow exactly the same rules. Each game action is a pure function from one game state to the next. Online, the player who moves sends the new state to the room, and each side keeps whichever version is newer.

### Site details and SEO

- Site identity, keywords and author credits live in `src/lib/site.ts`. Set `NEXT_PUBLIC_SITE_URL` if the site moves to another domain.
- Set `NEXT_PUBLIC_CONTACT_EMAIL` in Vercel to show a contact address on the about page, in `llms.txt` and in the structured data (redeploy after changing it).
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/manifest.webmanifest` and the preview images are generated from `src/app`. To get indexed faster, add the site in Google Search Console and submit `/sitemap.xml`.

### Running online play locally

Point both the server and the browser at any Pusher-compatible server (for example soketi on port 6001):

```env
PUSHER_HOST=localhost
PUSHER_PORT=6001
PUSHER_USE_TLS=false
NEXT_PUBLIC_PUSHER_HOST=localhost
NEXT_PUBLIC_PUSHER_PORT=6001
```
