# Modern Kum-Kom (คำคม)

A modern web version of **Kum-Kom (คำคม)**, the Thai crossword board game, which works like Scrabble for the Thai language. You can play solo against a bot or online against another player.

## Features

- **Full 15×15 Kum-Kom board** with premium squares: 2L/3L/4L letter bonuses, 2W/3W word bonuses and a center star.
- **Thai-aware tile system.** Consonants and leading vowels are tiles with standard Kum-Kom point values. Upper and lower vowels and tone marks (ิ ี ุ ่ ้ ์ …) are free and stack above or below a consonant.
- **Blank tiles (`0`)** worth 0 points that can stand for any letter.
- **Word validation** against a Thai dictionary of about 25,900 words, stored in MongoDB.
- **Automatic scoring** that shows a per-word breakdown and a bingo bonus.
- **Solo mode** against a bot that searches anchor squares for its best-scoring move.
- **Online multiplayer** with random matchmaking or private room codes, a ready check and real-time moves through **Pusher**.
- **Sign-in** with Google or Facebook through NextAuth, plus a user profile.
- **Built-in dictionary** for looking up words.
- Shuffle, swap and recall tiles.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **MongoDB**, with the dictionary in database `kumkom_db`, collection `vocabulary`
- **Pusher** for real-time multiplayer
- **NextAuth** for OAuth login

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000
```

Create `.env.local`:

```env
MONGODB_URI=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
PUSHER_APP_ID=
NEXT_PUBLIC_PUSHER_KEY=
PUSHER_SECRET=
```

Pusher's cluster is set to `ap1`.

### Loading the dictionary

The scripts in `scripts/` build the word list:

1. `extract_word.py` exports the words from the `word.mdb` Access database to `src/lib/word_list.json`. It needs `pyodbc` and the Microsoft Access driver.
2. `upload_to_mongo.py` uploads the list to MongoDB, reading `MONGODB_URI` from `.env.local`.

## Project structure

```
src/
├── app/                 # pages + API routes (auth, check-word, dictionary, multiplayer, rooms)
├── components/          # Game board & parts, Dictionary, UserProfile
├── hooks/               # game, turn, multiplayer logic
└── lib/                 # board layout & letter scores, scoring, bot, MongoDB client
```
