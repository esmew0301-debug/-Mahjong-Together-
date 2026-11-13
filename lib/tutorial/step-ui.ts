/**
 * Visual-first presentation for every tutorial step (all four variants).
 * - instruction: ONE concise sentence shown by default.
 * - remember: one-line takeaway shown in the help view.
 * - scene: the instructional animation (lib/tutorial/scenes.ts).
 * - action: "done" for physical steps ("I've Done This"), "ready" for knowledge steps ("I'm Ready").
 * Longer rule text stays in lib/variants.ts (detail) behind "Explain More".
 */
export interface StepUI { scene?: string; instruction: string; remember: string; action: "done" | "ready" }

export const STEP_UI: Record<string, StepUI> = {
  // ---------------- Sichuan ----------------
  "sc-tiles": { scene: "sort-sichuan", action: "done", instruction: "Keep Characters, Bamboo and Dots; set everything else aside.", remember: "108 tiles: three suits, 1–9, four of each." },
  "sc-dealer": { scene: "dealer-dice", action: "done", instruction: "Everyone rolls two dice and enters their total.", remember: "Highest total deals first. Ties roll again." },
  "sc-wall": { scene: "wall-sichuan", action: "done", instruction: "Build your wall two tiles high in front of you.", remember: "Two walls of 14 stacks, two walls of 13." },
  "sc-break": { scene: "break-sichuan", action: "done", instruction: "The dealer rolls; follow the result to break the wall.", remember: "Count walls counter-clockwise, then count the lower die from the right end." },
  "sc-deal": { scene: "deal", action: "done", instruction: "Take four tiles at a time in turn until everyone has 13.", remember: "Dealer ends with 14 tiles, everyone else 13." },
  "sc-exchange-vote": { scene: "exchange-preview", action: "ready", instruction: "Decide together whether to exchange three tiles.", remember: "Optional in this profile — all four must agree." },
  "sc-exchange-dir": { action: "ready", instruction: "Agree on one direction for everyone.", remember: "Everyone passes the same way at the same time." },
  "sc-exchange": { scene: "exchange", action: "done", instruction: "Pass three tiles of one suit in the direction shown.", remember: "Three tiles, one suit, face down, all at once." },
  "sc-dingque": { scene: "ding-que", action: "done", instruction: "Choose one suit to give up and declare it at the table.", remember: "Discard that suit first; you can't win while holding it." },
  "sc-review": { scene: "win-sichuan", action: "ready", instruction: "A win is four sets and a pair, with no missing-suit tiles.", remember: "Pung and kong allowed, no chow. Play continues after a win." },
  "sc-begin": { scene: "draw-discard", action: "done", instruction: "The dealer discards first; then draw one, discard one.", remember: "Turns go counter-clockwise." },
  // ---------------- Riichi ----------------
  "ri-tiles": { scene: "sort-riichi", action: "done", instruction: "Keep suits, winds and dragons; set aside flowers and jokers.", remember: "136 tiles: four of each." },
  "ri-redfives": { scene: "red-fives", action: "ready", instruction: "Decide together whether to use red fives.", remember: "Only if your set has them; they count as bonus dora." },
  "ri-seats": { scene: "turn-winds", action: "done", instruction: "Draw wind tiles for seats; East is the dealer.", remember: "Play goes counter-clockwise: East → South → West → North." },
  "ri-wall": { scene: "wall-17", action: "done", instruction: "Build your wall 17 stacks long and two high.", remember: "4 walls × 17 stacks × 2 = 136 tiles." },
  "ri-break": { scene: "break-riichi", action: "done", instruction: "The dealer rolls; follow the result to break the wall.", remember: "Count walls counter-clockwise from the dealer, then count stacks from the right end." },
  "ri-deadwall": { scene: "dead-wall", action: "done", instruction: "Set aside 7 stacks right of the break and flip the dora indicator.", remember: "Dora = the tile after the indicator. Dora alone is not a yaku." },
  "ri-deal": { scene: "deal-east", action: "done", instruction: "Take four tiles at a time in turn until everyone has 13.", remember: "Never deal from the dead wall. Dealer ends with 14." },
  "ri-turns": { scene: "melds-riichi", action: "ready", instruction: "Draw, discard; chi only from your left, pon and kan from anyone.", remember: "Calling opens your hand; riichi needs a closed hand." },
  "ri-winning": { scene: "win-riichi", action: "ready", instruction: "A win needs four sets and a pair plus at least one yaku.", remember: "Ron = win on a discard, tsumo = win on your draw." },
  "ri-begin": { scene: "draw-discard", action: "done", instruction: "East discards first; then draw one, discard one.", remember: "Discards go face up in rows of six." },
  // ---------------- Hong Kong ----------------
  "hk-tiles": { scene: "sort-cantonese", action: "done", instruction: "Keep all 144 tiles, including flowers; remove only jokers.", remember: "Flowers and seasons stay in as bonus tiles." },
  "hk-dealer": { scene: "dealer-dice", action: "done", instruction: "Everyone rolls two dice and enters their total.", remember: "Highest total is East (the dealer)." },
  "hk-seats": { scene: "turn-winds", action: "done", instruction: "Sit in wind order around East.", remember: "Play goes counter-clockwise: East → South → West → North." },
  "hk-wall": { scene: "wall-18", action: "done", instruction: "Build your wall 18 stacks long and two high.", remember: "4 walls × 18 stacks × 2 = 144 tiles." },
  "hk-break": { scene: "break-hk", action: "done", instruction: "East rolls; follow the result to break the wall.", remember: "Count walls counter-clockwise, then the same number of stacks from the right end." },
  "hk-deal": { scene: "deal-east", action: "done", instruction: "Take four tiles at a time in turn until everyone has 13.", remember: "East ends with 14 tiles." },
  "hk-flowers": { scene: "flower-replace", action: "done", instruction: "Put flowers face up and draw replacements from the wall's end.", remember: "East first; repeat if you draw another flower." },
  "hk-minfaan": { action: "ready", instruction: "Agree on the minimum faan needed to win.", remember: "Traditional rules use 3 faan." },
  "hk-calls": { scene: "melds-cantonese", action: "ready", instruction: "Chow only from your left; pung and kong from anyone.", remember: "A win claim beats pung/kong, which beats chow." },
  "hk-winning": { scene: "win-cantonese", action: "ready", instruction: "Win with four sets and a pair worth your minimum faan.", remember: "Win by self-draw or on a discard." },
  "hk-begin": { scene: "draw-discard", action: "done", instruction: "East discards first; then draw one, discard one.", remember: "Replace any flower you draw during play." },
  // ---------------- American ----------------
  "am-tiles": { scene: "sort-american", action: "done", instruction: "Use all 152 tiles, a rack, and this year's card each.", remember: "Includes 8 flowers and 8 jokers." },
  "am-card": { scene: "american-card", action: "ready", instruction: "Look over your card and pick hands to aim for.", remember: "Only hands on the current card can win." },
  "am-dealer": { scene: "dealer-dice", action: "done", instruction: "Everyone rolls two dice and enters their total.", remember: "Highest total is East." },
  "am-wall": { scene: "wall-19", action: "done", instruction: "Build your wall 19 tiles long and two high.", remember: "4 walls × 19 × 2 = 152 tiles." },
  "am-break": { scene: "break-american", action: "done", instruction: "East rolls and breaks East's own wall.", remember: "Count the total from the right end of East's wall." },
  "am-deal": { scene: "deal-east", action: "done", instruction: "Deal 13 tiles each and 14 to East, onto your racks.", remember: "East discards first after the Charleston." },
  "am-ch1-right": { scene: "charleston-right", action: "done", instruction: "Pass three tiles to the player on your right.", remember: "Face down, at the same time. Never pass jokers." },
  "am-ch1-across": { scene: "charleston-across", action: "done", instruction: "Pass three tiles to the player across.", remember: "Pick up what you receive before the next pass." },
  "am-ch1-left": { scene: "charleston-left", action: "done", instruction: "Pass three tiles to the player on your left.", remember: "That completes the required first Charleston." },
  "am-charleston2-vote": { scene: "charleston-left", action: "ready", instruction: "Decide whether to do a second Charleston.", remember: "Any one player can say No." },
  "am-ch2-left": { scene: "charleston-left", action: "done", instruction: "Second Charleston: pass three tiles to your left.", remember: "Order: Left → Across → Right." },
  "am-ch2-across": { scene: "charleston-across", action: "done", instruction: "Second Charleston: pass three tiles across.", remember: "Never pass jokers." },
  "am-ch2-right": { scene: "charleston-right", action: "done", instruction: "Second Charleston: pass three tiles to your right.", remember: "That completes the second Charleston." },
  "am-courtesy": { scene: "charleston-across", action: "done", instruction: "Optionally swap 0–3 tiles with the player across.", remember: "The smaller number wins if you disagree." },
  "am-review": { scene: "jokers", action: "ready", instruction: "Jokers only fill groups of three or more; win with a card hand.", remember: "No jokers in singles or pairs." },
  "am-begin": { scene: "draw-discard", action: "done", instruction: "East discards first; then draw one, discard one.", remember: "Your hand must match the card exactly to win." },
};
