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

## Game, scoring and results (after setup)

- **States:** setup → playing → hand review → next hand | session review → complete. Every change goes through an authorized server action inside the room's atomic version check. Nothing the Rule Assistant says can record points or announce a win.
- **Record Event:** Declare Win (Hu), Record Kong (Gang), Wall Exhausted / End Hand, Review or Correct Event, and Scoring History. Self-draw and discard are ways of winning, not separate wins.
- **Group verification (the fourth mechanism):** each pending event shows the proposed payer → recipient transfers, how they were calculated, its rule source and its version number. All four players choose Confirm Result, Need Explanation, or Dispute or Correct. Any revision resets every approval. Approvals for an outdated version are rejected. An event commits only when all four approve the same version, and duplicate submissions with the same idempotency key are ignored. A pending item can be removed only by a unanimous void.
- **Ledger:** immutable transfer entries. Corrections add a reversal plus replacement entries, so history is never overwritten. Scores are sums of committed ledger entries.
- **Sichuan scoring engine** (`lib/scoring/sichuan.ts`): follows one documented ruleset, Mahjong Planet "planet-blood-battle-v1" (mahjong-planet.com/rules/sichuan).
  - A standard hand is 1 point; fan is capped at 3; hand value is 2^fan.
  - All pungs 1, pure suit 2, seven pairs 2, each root 1, golden hook 1, kong replacement 1, robbing an added kong 1, last tile 1.
  - Self-draw: every other active player pays value + 1. Discard win: the discarder pays the value.
  - Kongs: concealed 2 from each active player, added 1 from each, exposed 2 from the discarder.
  - Wall exhaustion: a missing-suit holder pays 8 to each cleared player; a not-ready player pays each ready player that player's best value and returns kong income.
  - Blood Battle: winners leave the hand, which ends after three wins or wall exhaustion.
  - Dealer rotation isn't stated by that source. The group chooses the next dealer, with Jiada's convention shown as the suggestion.
- **Riichi, Hong Kong and American Mah Jongg:** no automatic scoring. Players enter manual payer → recipient transfers, verified unanimously.
- **Check My Hand** (Private Coach): a private, advisory wizard with optional manual tile entry and validation. It runs only on the player's phone. Only an explicit Declare Win shares the claim.
- **Final Results:** all four confirm the same ledger version, then a podium with rising bars and a crown appears, followed by gentle falling confetti that plays once (the supplied `components/ui/confetti.tsx`).
- **Dark mode:** a per-device toggle, saved in localStorage and applied before first paint.

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
