# Hubuno — brief

Source: Minh's interrogation of 23/10/2026 (`docs/cuisine/journal.md`, rounds R1–R9 and the cross-examination).

## Who
- Minh's class in higher education, about 20 to 40 students, all adults (R1, R9).
- Three people: Minh owns the hub (built by the main assistant, **no helper agents**, R2); another student writes the games (R1); a third student runs and pays the O2Switch account (R7, R9).
- Admins at start: Minh and the games student; they can appoint more (R5).

## Why
- A private place to play board games online together and chat, for fun (M1, R2). No deadline, not graded (R2).
- Success: at least 15 registered students and games played every week, one month after going live (R8, confirmed).
- Minh also wants it in his portfolio (R8): screenshots with made-up pseudos only.

## What
- **Accounts**: class code to sign up, then pseudo + password; no e-mail stored; forgotten password reset by an admin with a temporary password (R1, R6). A short « Règles et données » page accepted at sign-up; users can delete their account (R9).
- **Chat, Discord style**: general channel, admin-created channels, private messages, a chat per game table; text, emojis and reactions; no images, no editing (R1, R3, R4). Messages deleted after one year (R5).
- **Presence and social**: who is online and who is playing; invitations to a table; profile with an emoji or colour avatar and a short bio (R5).
- **Moderation**: admins delete messages, mute, ban, change the class code, reset passwords, appoint admins (R4).
- **Game tables**: the hub provides multiplayer (create a table, join, spectate, send moves, turns, reconnection) (R2, R5). Games are folders the games student drops into Hubuno's `games/` folder, following a written plug-in guide with a tic-tac-toe example (R3, cross-examination). First real game: a Monopoly-like game in the style of Rich Up, turn based, about 2–6 players, long games (R8).
- Phone and desktop (R3). Dark, Discord-like layout: channels left, chat centre, online people right (R6). Visual style « Néon », chosen by Minh on 23/10/2026 from his references: near-black, big rounded cards in violet, yellow, lime and orange with black text, Unbounded headings, Figtree body, lime pill buttons with a soft glow.
- Out of scope: the games themselves (except the example), scores and rankings, images in chat, e-mail, domain, O2Switch administration.

## How
- One Node.js app on O2Switch (cPanel « Setup Node.js App », Passenger): the hub, the chat and the game tables in the same server (R2, R4).
- Express + Socket.IO, vanilla JS front end with no build step, SQLite through Node's built-in `node:sqlite` (no native module to compile on the host). Must run as a single instance (state kept in memory).
- The address is chosen by the students (R2): the app must work at any URL, including a sub-folder.

## Order
1. Design, accounts, chat and presence; deployed at once on O2Switch to test real time.
2. Game tables, plug-in guide and tic-tac-toe example.
3. The games student's games.

## Rules
- Adults only; minimal data (pseudo, hashed password, profile, messages for one year).
- Do not reuse Monopoly's name or visuals (rules are free to reuse).
- No legal accessibility duty; keep keyboard use and contrast right.

## Money
- 0 €: no paid service; O2Switch already paid by the student who runs it (R9). Lifetime: at least 2 years (R9) → maintainable code, database backups.

## Risks
- Real time on O2Switch shared hosting: WebSocket upgrades are not confirmed; Socket.IO falls back to long-polling, which needs a single instance. Tested at the first deploy.
- Node version available on O2Switch must be 22.13 or newer for `node:sqlite`.
- Depends on two other students: the games one must follow the guide, the O2Switch one must deploy.
