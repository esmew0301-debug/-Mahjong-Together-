# Mahjong Together

A mobile-first AI learning companion for **four real people at a physical Mahjong table**. Each player joins on their own phone. The AI guides the group through one variant step by step. Players vote on shared decisions, confirm that they understand, and confirm each physical step before the group moves on. Each player also has a Private AI Coach for questions about their own tiles.

It is not an online Mahjong game. Tiles, dice and play all stay physical.

## How it works

- **Rooms:** the host creates a room (code like `MAH-7K2P`) and the others scan its QR code to `/join/MAH-7K2P`. Each player gets a server-issued, httpOnly session cookie. A refresh restores the same seat, and a player can't join twice.
- **Shared state:** rooms live in Redis (Upstash REST). Every change is an atomic compare-and-set on a version number (a Lua script), so simultaneous votes never overwrite each other. Clients poll about once a second, slow down when the tab is hidden, and back off on errors. Presence is shown as Connected / Reconnecting / Offline.
- **Three kinds of group interaction**, kept separate in the engine (`lib/server/room.ts`):
  - **Consensus:** used for the variant and for optional or house rules. Everyone must pick the same option. American's second Charleston is different: any one "No" stops it, per AMJA.
  - **Comprehension:** "Does everyone understand?" Any "Not yet" blocks progress, the AI asks what to re-explain, and the next explanation opens a fresh round.
  - **Physical completion:** "Has everyone completed this step?" Done / Not yet.
- **Variant workflows:** each variant has its own data-driven steps (`lib/variants.ts`), with rule type, group action, illustration and source. Dealer dice are entered by each player, with re-rolls on ties. The wall-break position is calculated only where the source states the procedure.
- **Mahjong Rule Assistant (free, local):** a deterministic assistant over structured rule data in `lib/mahjong/rules/*.ts`, with one profile per variant. It normalizes the question, uses synonyms (including some Chinese phrases), weights keywords, and takes the room's variant and current step into account. It picks a question-specific answer (for example *why*, *same suit?*, *can we skip?*), and it handles follow-ups ("explain more simply", "give an example", "what happens next") using the last topic in that conversation. When a question matches no verified topic, it says so instead of guessing. **Summarize Questions** groups recent public questions by matched topic, quoting players word for word. **Nothing is sent to any AI service, and no API key is needed.** Photos stay on the phone, and the coach explains that photo analysis isn't available.
- **Voice:** browser speech-to-text fills the input box. Nothing is sent until the player taps Send or Ask AI.

## Run locally

```bash
npm install
npm run dev                  # uses a local file store (.data/) when no Redis is configured
```

To try it with real phones on the same Wi-Fi, open the "Network" URL that Next prints (for example `http://192.168.1.20:3000`) on the host's phone, so the QR code points to a reachable address.

## Deploy to Vercel

1. Push the project to GitHub and import it in Vercel.
2. In Vercel, add **Storage → Upstash for Redis** and connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`; you can instead set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` by hand.
3. Deploy. Without Redis, the deployed site shows a clear "live rooms aren't set up" message instead of faking a room.

## Sources used for the rule data

- Sichuan: Jiada Mahjong rules (Sichuan section) and Mahjong Planet Sichuan rules.
- Riichi: World Riichi Championship rules and the japan.mahjong.download guide.
- Hong Kong: hkmahjongrules.com, hongkong.mahjong.download and Jiada (HK section).
- American: American Mahjongg Association rules and Charleston guide. The NMJL card is not reproduced.

Where sources disagree (for example, HK dealer selection), the step explains the options instead of inventing one rule.
