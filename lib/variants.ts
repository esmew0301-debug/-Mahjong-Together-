import type { VariantId } from "./types";

export const SRC = {
  sichuan: "Jiada Mahjong rules, Sichuan section (jiadamahjong.com/pages/rules); Mahjong Planet Sichuan rules (mahjong-planet.com/rules/sichuan)",
  riichi: "World Riichi Championship rules (worldriichi.org); Japan Mahjong guide (japan.mahjong.download/en/how-to-play)",
  cantonese: "HK Mahjong Rules (hkmahjongrules.com/rules); Hong Kong Mahjong tile guide (hongkong.mahjong.download/en/guide/tiles); Jiada Mahjong rules, HK section",
  american: "American Mahjongg Association rules and Charleston guide (americanmahjonggassociation.com)",
};

export interface Variant {
  id: VariantId;
  name: string;
  region: string;
  intro: string;
  ruleset: string;
  rulesetName: string;
  background: string;
  rules: string[];
  source: string;
}

export const VARIANTS: Variant[] = [
  {
    id: "sichuan",
    name: "Sichuan Mahjong",
    region: "Sichuan & Chongqing, southwest China",
    intro: "Fast three-suit Mahjong with a declared missing suit; play continues after the first win.",
    ruleset: "sichuan-xzdd-home",
    rulesetName: "Sichuan Bloody Battle (Xue Zhan Dao Di), home-rules profile",
    background:
      "Sichuan Mahjong is a fixture of social life in Chengdu and Chongqing, played in teahouses, homes, and parks. With no honor tiles and no chow, hands come together quickly. In Bloody Battle style, the round keeps going after someone wins, so most players stay involved until the end.",
    rules: [
      "108 tiles: Characters, Bamboo, and Dots, 1–9, four of each. No winds, dragons, flowers, or seasons.",
      "Optional in this profile: Exchange Three Tiles of one suit after the deal.",
      "Each player declares a missing suit (Ding Que) and cannot win while holding it.",
      "Pung and kong are allowed. Chow is not.",
      "Bloody Battle: play continues after a win until three players have won or the wall runs out.",
    ],
    source: SRC.sichuan,
  },
  {
    id: "riichi",
    name: "Japanese Riichi Mahjong",
    region: "Japan",
    intro: "Strategic Mahjong where every winning hand needs a yaku, with riichi declarations and dora.",
    ruleset: "riichi-wrc",
    rulesetName: "Japanese Riichi Mahjong, World Riichi Championship-style rules",
    background:
      "Riichi is the dominant form of Mahjong in Japan, played in parlors, professional leagues, and many video games. It rewards careful defense and reading other players' discards.",
    rules: [
      "136 tiles: three suits plus winds and dragons. No flowers or seasons. Red fives depend on the ruleset.",
      "A winning hand needs at least one yaku (scoring pattern).",
      "A player with a closed, ready hand may declare riichi.",
      "Furiten: you can't win on a discard if you have already discarded one of your winning tiles.",
      "A 14-tile dead wall holds the dora indicator.",
    ],
    source: SRC.riichi,
  },
  {
    id: "cantonese",
    name: "Cantonese / Hong Kong Mahjong",
    region: "Hong Kong & Guangdong, south China",
    intro: "Classic Hong Kong style with winds, dragons, flower bonus tiles, and faan-based scoring.",
    ruleset: "hk-traditional",
    rulesetName: "Hong Kong (Cantonese) Mahjong, traditional 144-tile rules",
    background:
      "Hong Kong Mahjong is a traditional social game across Hong Kong, Guangdong, and many overseas Chinese communities, and the style many people first learn outside mainland China.",
    rules: [
      "144 tiles: three suits, winds, dragons, four flowers, and four seasons.",
      "Flowers and seasons are bonus tiles: set them aside and draw a replacement.",
      "Chow, pung, and kong are allowed.",
      "Hands are valued in faan. Tables agree on a minimum faan to win.",
    ],
    source: SRC.cantonese,
  },
  {
    id: "american",
    name: "American Mah Jongg",
    region: "United States",
    intro: "Card-based play with jokers, the Charleston tile pass, and a new list of hands each year.",
    ruleset: "american-nmjl",
    rulesetName: "American Mah Jongg (National Mah Jongg League card play)",
    background:
      "American Mah Jongg developed in the United States in the 1920s and 30s. The National Mah Jongg League (founded 1937) publishes a new card of valid hands every year, and the game has a strong community-club tradition.",
    rules: [
      "152 tiles, including 8 flowers and 8 jokers. Players use racks.",
      "Before play, players pass tiles in the Charleston.",
      "You can only win with a hand on the current year's NMJL card.",
      "Jokers can be used in pungs, kongs, and quints, but not in singles or pairs.",
    ],
    source: SRC.american,
  },
];
export const variantById = (id: VariantId | null | undefined) => VARIANTS.find((v) => v.id === id);

export type StepKind = "complete" | "consensus" | "dice-dealer" | "dice-break" | "review" | "begin";
export type BreakMethod = "sichuan" | "riichi" | "seat-total" | "east-wall";

export interface Step {
  id: string;
  variant: VariantId;
  title: string;
  intro: string;
  short: string;
  detail: string;
  ruleType: "mandatory" | "optional" | "house rule";
  kind: StepKind;
  question?: string;
  options?: { id: string; label: string }[];
  decisionKey?: string;
  veto?: boolean;
  understand?: boolean;
  image?: string;
  imageAlt?: string;
  when?: (d: Record<string, string>) => boolean;
  breakMethod?: BreakMethod;
  why?: string; // 1–2 sentences
  doSteps?: string[]; // physical actions
  example?: string;
  source: string;
}

const YESNO = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];
const DONE_Q = "Has everyone completed this step?";

const DIRS: Record<string, string> = { clockwise: "clockwise", counterclockwise: "counter-clockwise", across: "across the table" };
export const dirLabel = (d?: string) => (d ? DIRS[d] || d : "in the agreed direction");

/** Each Charleston pass is its own physical step with its own diagram and 4/4 completion check (AMJA order). */
function charlestonSteps(second = false): Step[] {
  const passes: [string, string, string][] = second
    ? [["left", "Left", "the player on your left"], ["across", "Across", "the player opposite you"], ["right", "Right", "the player on your right"]]
    : [["right", "Right", "the player on your right"], ["across", "Across", "the player opposite you"], ["left", "Left", "the player on your left"]];
  return passes.map(([dir, Dir, who], i) => ({
    id: `am-ch${second ? 2 : 1}-${dir}`, variant: "american" as VariantId, kind: "complete" as StepKind, ruleType: (second ? "optional" : "mandatory") as Step["ruleType"],
    understand: !second && i === 0,
    when: second ? (d: Record<string, string>) => d.charleston2 === "yes" : undefined,
    title: `${second ? "Second" : "First"} Charleston · Pass ${i + 1}: ${Dir}`,
    intro: !second && i === 0 ? "Before play, every player passes tiles in the Charleston. The first Charleston is required: Right, Across, Left." : `Pass ${i + 1} of 3${second ? " of the second Charleston" : ""}.`,
    short: `Everyone chooses three tiles and passes them face down to ${who}, all at the same time. Then pick up the three tiles you receive.`,
    why: !second && i === 0 ? "The Charleston lets everyone swap away tiles that don't fit a card hand before play starts." : undefined,
    doSteps: ["Choose three tiles you don't need for your target card hands.", `Place them face down and pass them to ${who}.`, "Wait until everyone has passed, then pick up what you received.", "Jokers can never be passed."],
    example: !second && i === 0 ? "You're aiming for a hand of Dots and Dragons, so you pass three unrelated Bamboo tiles to your right." : undefined,
    detail: `${second ? "Second Charleston (optional, unanimous): Left → Across → Right." : "First Charleston (required): Right → Across → Left."} Three tiles each pass, face down. Jokers may not be passed.`,
    question: `Has everyone passed ${Dir.toLowerCase()} and picked up their new tiles?`,
    image: `/illustrations/charleston-${dir}.svg`,
    imageAlt: `Everyone passes three tiles to ${who}.`,
    source: SRC.american,
  }));
}

export const STEPS: Step[] = [
  // ---------------- SICHUAN ----------------
  // Final product: exactly THREE shared preparation checkpoints for physical Sichuan Mahjong.
  // Dealer selection, dice and dealing are not separate group checkpoints (see the Build Your Wall help).
  {
    id: "sc-tiles", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Prepare 108 Tiles",
    intro: "Keep only Characters, Bamboo, and Dots.",
    short: "Keep only Characters, Bamboo, and Dots.",
    why: "This version of Sichuan Mahjong uses 108 suited tiles.",
    doSteps: ["Keep four copies of each numbered tile, 1–9, in all three suits.", "Remove Winds, Dragons, Flowers, and any extra tiles."],
    detail: "Sichuan Mahjong uses only the three suits — Characters (Wan), Bamboo (Tiao) and Dots (Tong) — numbered 1–9, four copies of each: 27 tile types × 4 = 108 tiles. Winds, Dragons, Flowers, Seasons and any jokers are set aside.",
    source: SRC.sichuan,
  },
  {
    id: "sc-wall", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Build Your Wall",
    intro: "Arrange your tiles into the four table walls.",
    short: "Arrange your tiles into the four table walls.",
    why: "The walls hold the tiles for drawing during play.",
    doSteps: ["Divide all 108 tiles into four walls around the table.", "Make sure no tiles are left out."],
    detail: "Build four walls of face-down stacks, two tiles high: 14 stacks for the top and bottom walls and 13 stacks for the left and right walls, staggered at the corners. (14 + 14 + 13 + 13) × 2 = 108 tiles. Then choose a dealer, break the wall and deal as your table usually does: the dealer takes 14 tiles, everyone else 13.",
    source: SRC.sichuan,
  },
  {
    id: "sc-exchange", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Exchange 3 Tiles",
    intro: "Choose 3 tiles of the same suit and pass them together.",
    short: "Choose 3 tiles of the same suit and pass them together.",
    why: "The exchange adds variety to starting hands.",
    doSteps: ["Pick any three tiles from ONE suit: Characters, Bamboo, or Dots.", "Pass all three together in the direction shown."],
    detail: "Every player chooses three tiles of one suit and passes them face down, all at the same time, in the direction shown on every phone. This prototype draws the direction at random for the table (left, right or across) and shows the same result to all four players.",
    source: SRC.sichuan,
  },
  {
    id: "sc-dingque", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Choose Your Missing Suit",
    intro: "Pick one suit to discard before you can win.",
    short: "Pick one suit to discard before you can win.",
    why: "Ding Que is a key Sichuan Mahjong rule that shapes how you play your hand.",
    doSteps: ["Choose one suit as your missing suit.", "You must discard all tiles of that suit before winning."],
    detail: "Ding Que (missing suit): each player picks one of the three suits. Discard every tile of that suit over your turns; you cannot declare a win while still holding any tile of it.",
    source: SRC.sichuan,
  },

  // ---------------- RIICHI (WRC-style profile) ----------------
  {
    id: "ri-tiles", variant: "riichi", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Your Tiles",
    intro: "Let's prepare the tiles for Riichi Mahjong.",
    short: "Use 136 tiles: Manzu, Pinzu, and Souzu 1–9, the four Winds, and the three Dragons — four of each. Remove Flowers, Seasons, and jokers.",
    why: "Standard Riichi has no bonus tiles, so flowers and seasons would break the tile counts.",
    doSteps: ["Sort out the Flowers, Seasons, and any jokers and put them away.", "Check you have four of every remaining tile: 108 suit tiles, 16 winds, 12 dragons.", "If your set has red fives, keep them aside until the group decides on them."],
    example: "A full Chinese set has 144 tiles. Remove the 8 flowers and seasons and you have 136 — exactly a Riichi set.",
    detail: "• Manzu (characters), Pinzu (dots), Souzu (bamboo): 1–9 × 4 = 108\n• Winds: East, South, West, North × 4 = 16\n• Dragons: White, Green, Red × 4 = 12\nTotal: 136. Standard Riichi uses no flowers, seasons, or jokers.",
    question: "Has everyone prepared the tiles?",
    image: "/illustrations/riichi-tiles.svg",
    imageAlt: "Keep 136 tiles: three suits, four winds and three dragons. Red fives optional. Remove flowers, seasons and jokers.",
    source: SRC.riichi,
  },
  {
    id: "ri-redfives", variant: "riichi", kind: "consensus", ruleType: "house rule", decisionKey: "redFives", options: YESNO,
    title: "Decide: Red Fives?",
    intro: "One ruleset choice to agree on.",
    short: "Will your group play with red fives (bonus dora)? Only choose Yes if your set has them.",
    why: "Red fives are a ruleset option, not a fixed rule, so all four players should agree before playing.",
    detail: "Many sets include one red five in each suit, which counts as an extra dora. Others play without them. All four players should agree.",
    question: "Play with red fives?",
    source: SRC.riichi,
  },
  {
    id: "ri-seats", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Seats, Winds & Dealer",
    intro: "Now decide seats and the first dealer (East).",
    short: "Draw one each of East, South, West, and North face down. Whoever draws East is the dealer. Sit East, South, West, North going counter-clockwise; turns also go counter-clockwise.",
    why: "Your seat wind matters for scoring, and the dealer starts the hand and scores more when winning.",
    doSteps: ["Shuffle one East, South, West and North face down.", "Each player takes one; East is the first dealer.", "South sits to East's right, West opposite, North to East's left.", "Turns go counter-clockwise: East → South → West → North."],
    example: "Jamie draws East and becomes dealer. Taylor drew South and sits on Jamie's right, so Taylor plays right after Jamie.",
    detail: "The Japan Mahjong guide says East is the dealer but doesn't fix how seats are chosen. Drawing wind tiles is a widely used method; use your group's own method if you prefer. The direction of play is fixed by the rules: counter-clockwise.",
    question: "Are seats and the dealer decided?",
    image: "/illustrations/seat-winds.svg",
    imageAlt: "Seats around the table: East (dealer) at the bottom, South to the right, West opposite, North to the left; turns go counter-clockwise.",
    source: SRC.riichi,
  },
  {
    id: "ri-wall", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle face down and build the walls.",
    short: "Each player builds a wall 17 tiles long and two tiles high (136 tiles total).",
    why: "Four equal walls let everyone see how many tiles remain and where the dead wall sits.",
    doSteps: ["Shuffle all 136 tiles face down.", "Build 17 stacks, two tiles high, in front of you.", "Push the four walls together into a square."],
    detail: "• Shuffle all 136 tiles face down.\n• Each player builds a wall of 17 stacks, two high, in front of them.\n• Push the walls together into a square.",
    question: "Is everyone's wall built?",
    source: SRC.riichi,
  },
  {
    id: "ri-break", variant: "riichi", kind: "dice-break", ruleType: "mandatory", breakMethod: "riichi",
    title: "Roll Dice & Break the Wall",
    intro: "The dealer rolls two dice to choose where to break the wall.",
    short: "The dealer rolls two real dice and enters both numbers. I'll show which wall to break and how many stacks to count.",
    why: "The dice make the starting point random, so nobody knows which tiles will be drawn first.",
    detail: "WRC-style counting: count counter-clockwise starting with the dealer as 1 to choose a wall. From the right end of that wall, count stacks equal to the dice total and break there.",
    question: "Has the wall been broken?",
    source: SRC.riichi,
  },
  {
    id: "ri-deadwall", variant: "riichi", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Dead Wall & Dora Indicator",
    intro: "Before dealing, set up the dead wall.",
    short: "The 7 stacks (14 tiles) to the right of the break are the dead wall. Flip the top tile of the third stack from the break face up: that's the dora indicator.",
    why: "The dead wall holds the dora indicator and the replacement tiles for kans. Nobody draws from it in normal turns.",
    doSteps: ["Count 7 stacks to the right of the break and slide them slightly apart.", "Turn the top tile of the 3rd stack from the break face up.", "The tile after the indicator is the dora — e.g. indicator 4 Characters → dora 5 Characters."],
    example: "The indicator is North. Winds go East → South → West → North → East, so the dora is East. If it's the Red dragon, dragons go White → Green → Red → White, so the dora is White.",
    detail: "• Dead wall: 7 stacks = 14 tiles, to the right of the break.\n• Dora indicator: top tile of the third stack from the break, face up.\n• Dora = next tile in sequence (9 wraps to 1; winds E→S→W→N→E; dragons White→Green→Red→White).\n• Each dora in a winning hand adds han, but dora alone is not a yaku.\n• Kan replacement tiles are drawn from the dead wall, and each kan reveals another indicator.",
    question: "Is the dead wall set aside and the dora indicator flipped?",
    image: "/illustrations/riichi-dead-wall.svg",
    imageAlt: "Wall after the break: live wall to the left, 7-stack dead wall to the right, with the third stack's top tile flipped as the dora indicator.",
    source: SRC.riichi,
  },
  {
    id: "ri-deal", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Deal the Starting Hands",
    intro: "Time to deal.",
    short: "Starting with the dealer and going counter-clockwise, each player takes two stacks (four tiles) at a time for three rounds, then the dealer takes two more tiles and the others one. Dealer: 14. Others: 13.",
    why: "Taking tiles in turn from the live wall keeps the deal fair and starts the dealer with the extra tile they discard first.",
    doSteps: ["Take tiles from the live wall, starting next to the break — never from the dead wall.", "Each player in turn order takes four tiles, three times (12 tiles).", "The dealer takes two more tiles; everyone else takes one.", "Stand your tiles up so only you can see them."],
    detail: "• Deal from the live wall (left of the break), never from the dead wall.\n• Each player takes two stacks (four tiles) at a time for three rounds: 12 tiles.\n• The dealer takes two more tiles; each other player takes one.\n• Dealer 14, others 13. The dealer discards first.",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.riichi,
  },
  {
    id: "ri-turns", variant: "riichi", kind: "review", ruleType: "mandatory",
    title: "Draw, Discard & Calls",
    intro: "How a turn works in Riichi.",
    short: "On your turn, draw one tile from the live wall, then discard one face up in a neat row of six in front of you. Chi only from the player on your left; pon and kan from anyone. Calling opens your hand.",
    why: "Your discard rows are public information: other players read them, and furiten depends on them.",
    example: "Your left neighbour discards 5 Bamboo and you hold 4 and 6: you may call chi. If the player across discards it, you can't chi — only pon if you hold two 5 Bamboo.",
    detail: "• Draw from the live wall, then discard one tile face up (rows of six).\n• Chi (sequence): only from the player on your left.\n• Pon (triplet) and kan (quad): from any player. Claiming a win (ron) beats pon/kan, which beat chi.\n• After a kan, draw a replacement from the dead wall and flip a new dora indicator.\n• A hand with no calls is closed; any chi, pon, or open kan makes it open. Some yaku, including riichi, need a closed hand.",
    source: SRC.riichi,
  },
  {
    id: "ri-winning", variant: "riichi", kind: "review", ruleType: "mandatory",
    title: "Winning: Yaku, Riichi, Ron & Tsumo",
    intro: "What makes a legal Riichi win.",
    short: "A winning hand is four sets and a pair (or seven pairs, or thirteen orphans) AND it needs at least one yaku. Dora alone is not a yaku. Win by ron (someone's discard) or tsumo (your own draw).",
    why: "The yaku requirement is what makes Riichi strategic: a complete shape with no yaku cannot win.",
    example: "You're tenpai with a closed hand and no other yaku. Declare riichi (place a 1,000-point stick) — now riichi itself is your yaku, so you can win by ron or tsumo.",
    detail: "• Shapes: 4 sets + pair; seven pairs; thirteen orphans.\n• At least one yaku is required (e.g. riichi, all simples, a dragon triplet, closed self-draw). Dora add value but are not yaku.\n• Riichi: closed hand, tenpai (one tile from winning), at least 1,000 points to deposit; your hand is then locked.\n• Ron: win on another player's discard. Tsumo: win on your own draw.\n• Furiten: if any of your winning tiles is in your own discards, you can't ron — only tsumo.\n• Scoring uses han and fu. This app doesn't automate it: agree the payment with a score table and enter it for group verification.",
    source: SRC.riichi,
  },
  {
    id: "ri-begin", variant: "riichi", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. The dealer (East) discards first; turns go counter-clockwise.",
    detail: "Play with your physical tiles. Use the Shared Table for public questions and My Private Coach for your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.riichi,
  },

  // ---------------- HONG KONG (traditional 144-tile profile) ----------------
  {
    id: "hk-tiles", variant: "cantonese", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Your Tiles",
    intro: "Let's prepare the tiles for Hong Kong Mahjong.",
    short: "Use all 144 tiles: the three suits, Winds, Dragons, four Flowers, and four Seasons. Keep the winds, dragons and flowers. Remove jokers only.",
    why: "Unlike Sichuan, Hong Kong Mahjong uses honor tiles and treats flowers and seasons as bonus tiles.",
    doSteps: ["Keep every suit, wind, and dragon tile (four of each).", "Keep the 4 flowers and 4 seasons — they're used as bonus tiles.", "Put away any jokers."],
    example: "A standard Chinese set already has 144 tiles, so usually only jokers (if any) come out.",
    detail: "• Suits: Characters, Bamboo, Dots, 1–9 × 4 = 108\n• Winds × 4 = 16, Dragons × 4 = 12\n• Flowers 4 + Seasons 4 = 8 bonus tiles\nTotal: 144. Remove jokers if your set has them.",
    question: "Has everyone prepared the tiles?",
    image: "/illustrations/hk-tiles.svg",
    imageAlt: "Keep all 144 tiles: suits, winds, dragons, flowers and seasons. Remove only jokers.",
    source: SRC.cantonese,
  },
  {
    id: "hk-dealer", variant: "cantonese", kind: "dice-dealer", ruleType: "mandatory",
    title: "Choose the Dealer (East)",
    intro: "Now let's choose the first dealer.",
    short: "Each player rolls two real dice and enters their total. The highest total becomes East. Ties re-roll.",
    detail: "The Jiada HK rules use the highest dice total. HK Mahjong Rules instead has each player draw a wind tile, with East choosing a seat first. Both are recognized — this guide uses the dice method.",
    source: SRC.cantonese,
  },
  {
    id: "hk-seats", variant: "cantonese", kind: "complete", ruleType: "mandatory",
    title: "Seats & Turn Order",
    intro: "Take your seats around East.",
    short: "South sits to East's right, West opposite, North to East's left. Turns go counter-clockwise: East → South → West → North.",
    why: "Seat winds affect faan (a pung of your own seat wind scores), and play always moves to the right.",
    doSteps: ["East (the dealer) stays put.", "The player to East's right is South, opposite is West, to East's left is North.", "Remember: play passes to the player on your right."],
    detail: "Turn order is fixed by the rules: counter-clockwise, East first.",
    question: "Is everyone seated in wind order?",
    image: "/illustrations/seat-winds.svg",
    imageAlt: "Seats: East (dealer) at the bottom, South to the right, West opposite, North to the left; turns go counter-clockwise.",
    source: SRC.cantonese,
  },
  {
    id: "hk-wall", variant: "cantonese", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle face down and build the walls.",
    short: "Each player builds a wall 18 stacks long and two tiles high (144 tiles total).",
    doSteps: ["Shuffle all 144 tiles face down.", "Build 18 stacks, two tiles high, in front of you.", "Push the walls together into a square."],
    detail: "• Shuffle all 144 tiles face down.\n• Each player builds 18 stacks, two high.\n• Push the walls together into a square.",
    question: "Is everyone's wall built?",
    source: SRC.cantonese,
  },
  {
    id: "hk-break", variant: "cantonese", kind: "dice-break", ruleType: "mandatory", breakMethod: "seat-total",
    title: "Roll Dice & Break the Wall",
    intro: "East rolls two dice to break the wall.",
    short: "The dealer rolls two real dice and enters both numbers. I'll show which wall and how many stacks to count.",
    detail: "HK Mahjong Rules: the dealer counts counter-clockwise starting from themselves as 1 to choose a wall, then counts the same number of stacks from that wall's right end and breaks there. (Jiada's HK rules count from a different end; follow one method consistently.)",
    question: "Has the wall been broken?",
    source: SRC.cantonese,
  },
  {
    id: "hk-deal", variant: "cantonese", kind: "complete", ruleType: "mandatory",
    title: "Deal the Starting Hands",
    intro: "Time to deal.",
    short: "In turn order from East, take four tiles at a time for three rounds; then East takes two and everyone else one. East: 14, others: 13.",
    doSteps: ["Starting from the break, East takes four tiles, then South, West, North.", "Repeat until everyone has 12.", "East takes two more tiles; the others take one.", "Don't replace flowers yet — that's the next step."],
    detail: "• Four tiles at a time for three rounds, then the dealer takes two and the others one (East 14, others 13).",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.cantonese,
  },
  {
    id: "hk-flowers", variant: "cantonese", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Replace Flowers & Seasons",
    intro: "Flowers and seasons are bonus tiles, not part of your hand.",
    short: "Starting with East, place each flower or season face up in front of you and draw a replacement from the END of the wall. Repeat until no one holds a bonus tile.",
    why: "Bonus tiles can add faan, but they can't be used in sets, so they're replaced to keep your hand at 13 (14 for East).",
    doSteps: ["East goes first: put any flower or season face up in front of you.", "Draw the same number of replacement tiles from the end of the wall (the far end, not where dealing started).", "If a replacement is another bonus tile, repeat.", "Then South, West, North do the same."],
    example: "Taylor holds Plum and Spring. Taylor sets both face up and draws two tiles from the end of the wall. One is Bamboo (kept), the other is Summer, so Taylor sets it out and draws once more.",
    detail: "• Bonus tiles are set face up and replaced from the end of the wall.\n• During play, do the same whenever you draw one.\n• A flower or season matching your seat number may add faan, depending on your scoring table.",
    question: "Has everyone replaced their flowers and seasons?",
    image: "/illustrations/hk-flower-replacement.svg",
    imageAlt: "Three steps: find a flower in your hand, set it face up in front of you, draw a replacement from the end of the wall.",
    source: SRC.cantonese,
  },
  {
    id: "hk-minfaan", variant: "cantonese", kind: "consensus", ruleType: "house rule", decisionKey: "minFaan",
    options: [
      { id: "3", label: "3 faan" },
      { id: "1", label: "1 faan" },
      { id: "0", label: "No minimum" },
    ],
    title: "Decide: Minimum Faan",
    intro: "One house rule to agree on.",
    short: "What minimum faan does a hand need to win? Traditional HK rules use 3 faan; some tables allow lower or a chicken hand.",
    why: "This is a genuine table choice, so the group agrees on it before play.",
    detail: "HK Mahjong Rules says a winning hand must be worth at least 3 faan under traditional rules, while some tables allow a chicken hand (no faan). Other references simply use an agreed minimum. All four players need to choose the same option.",
    question: "Which minimum will your group use?",
    source: SRC.cantonese,
  },
  {
    id: "hk-calls", variant: "cantonese", kind: "review", ruleType: "mandatory",
    title: "Turns & Calls",
    intro: "How a turn works in Hong Kong Mahjong.",
    short: "Draw a tile, then discard one. You may chow a discard only from the player on your left; pung or kong from anyone. A winning claim beats a pung or kong, which beats a chow.",
    example: "Your left neighbour discards 7 Bamboo and you hold 8 and 9: you may chow. If the player across discards it, you can only pung it if you hold two 7 Bamboo.",
    detail: "• East discards first; turns go counter-clockwise.\n• Chow (sequence): only from the player on your left.\n• Pung and kong: from any player.\n• After a kong, draw a replacement from the end of the wall.\n• Claim priority: win > pung/kong > chow.",
    source: SRC.cantonese,
  },
  {
    id: "hk-winning", variant: "cantonese", kind: "review", ruleType: "mandatory",
    title: "Winning & Faan",
    intro: "What makes a winning Hong Kong hand.",
    short: "Win with four sets and a pair worth at least your agreed minimum faan, either by self-draw or on a discard. Faan come from features like all pungs, a dragon pung, one suit, or your own flower.",
    example: "With a 3-faan minimum, a hand of all pungs (worth faan by itself) plus a pung of red dragons can win; a plain hand with only a matching flower may not reach the minimum.",
    detail: "• Standard shape: four sets plus a pair.\n• Must reach the agreed minimum faan.\n• Self-draw vs discard win usually changes who pays.\n• Faan tables vary by table, so this app doesn't automate scoring: agree the payment and enter it for group verification.",
    source: SRC.cantonese,
  },
  {
    id: "hk-begin", variant: "cantonese", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. East discards first; turns go counter-clockwise.",
    detail: "Play with your physical tiles. Use the Shared Table for public questions and My Private Coach for your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.cantonese,
  },

  // ---------------- AMERICAN (NMJL card play) ----------------
  {
    id: "am-tiles", variant: "american", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Tiles & Equipment",
    intro: "Let's prepare for American Mah Jongg.",
    short: "Use all 152 tiles — including 8 flowers and 8 jokers — four racks, two dice, and a current-year NMJL card for each player.",
    why: "American hands are built from the official card, and jokers and flowers are part of those hands.",
    doSteps: ["Check the set: craks, bams, dots 1–9 (four each), 16 winds, 12 dragons, 8 flowers, 8 jokers.", "Give each player a rack.", "Each player gets this year's NMJL card (bought from the NMJL — this app doesn't reproduce it)."],
    example: "If your set has fewer than 8 jokers or is missing flowers, it won't match card hands — check before you start.",
    detail: "• 108 suited tiles, 16 Winds, 12 Dragons (the white dragon is often called Soap), 8 Flowers, 8 Jokers = 152\n• Four racks and two dice\n• A current-year National Mah Jongg League card for each player.",
    question: "Does everyone have tiles, a rack, and a current card?",
    image: "/illustrations/american-tiles.svg",
    imageAlt: "Keep all 152 tiles: three suits, winds, dragons, eight flowers and eight jokers.",
    source: SRC.american,
  },
  {
    id: "am-card", variant: "american", kind: "review", ruleType: "mandatory",
    title: "How to Read Your Card",
    intro: "The card is how you win in American Mah Jongg.",
    short: "Your winning hand must exactly match one hand printed on this year's NMJL card. Look over the card now and pick two or three hands your tiles could grow into.",
    why: "There are no free-form winning hands: only the card's hands count, and they change every year.",
    example: "If your hand has lots of one suit and a pair of flowers, look for card hands that use one suit and flowers, and keep those tiles.",
    detail: "• Each card section groups related hands (for example by year, numbers, or winds); read your card's own key.\n• Colors on the card show which groups must be the same or different suits.\n• Hands are marked as exposed or concealed, with their point value.\n• This app can't see or reproduce the card. Check your own card for exact hands and values.",
    source: SRC.american,
  },
  {
    id: "am-dealer", variant: "american", kind: "dice-dealer", ruleType: "mandatory",
    title: "Choose East",
    intro: "Now let's decide who is East (the dealer).",
    short: "Each player rolls two real dice and enters their total. The highest total is East. Ties re-roll.",
    detail: "AMJA: in public games, each player rolls two dice and the highest total is East; ties re-roll. In home games, the host often starts as East — if your group prefers that, the host can enter the highest number.",
    source: SRC.american,
  },
  {
    id: "am-wall", variant: "american", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle face down and build the walls.",
    short: "Each player builds a wall 19 tiles long and two tiles high, pushed out in front of their rack.",
    doSteps: ["Shuffle all 152 tiles face down.", "Build 19 stacks, two high, in front of your rack."],
    detail: "• Shuffle all 152 tiles face down.\n• Each player builds 19 stacks, two high (152 tiles).",
    question: "Is everyone's wall built?",
    source: SRC.american,
  },
  {
    id: "am-break", variant: "american", kind: "dice-break", ruleType: "mandatory", breakMethod: "east-wall",
    title: "Roll Dice & Break the Wall",
    intro: "East rolls two dice in the center of the table.",
    short: "East enters both dice. Count that many stacks from the right end of East's own wall and break there. Re-roll if a die lands off the table or not flat.",
    detail: "AMJA: East rolls two dice in the center. Re-roll if a die lands outside the playing area or not flat. Count the total from the right end of East's wall and break there. Tiles to the left of the break are dealt first.",
    question: "Has the wall been broken?",
    source: SRC.american,
  },
  {
    id: "am-deal", variant: "american", kind: "complete", ruleType: "mandatory",
    title: "Deal the Starting Hands",
    intro: "Time to deal.",
    short: "Deal 13 tiles to each player and 14 to East. Place your tiles on your rack facing you.",
    doSteps: ["A common method: each player in turn takes four tiles, three times.", "Then East takes two more and the others one.", "Set your tiles on your rack so nobody else can see them."],
    detail: "AMJA: each player receives 13 tiles and East receives 14; East discards first after the Charleston. The four-at-a-time order is a common method; the AMJA page gives the counts but not the order.",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.american,
  },
  ...charlestonSteps(),
  {
    id: "am-charleston2-vote", variant: "american", kind: "consensus", ruleType: "optional", decisionKey: "charleston2", options: YESNO, veto: true,
    title: "Decide: Second Charleston?",
    intro: "The second Charleston is optional.",
    short: "Would your group like to complete a second Charleston? It needs unanimous agreement — any one player can stop it, no explanation needed.",
    why: "AMJA rules let any player stop the second Charleston before seeing its tiles.",
    detail: "AMJA: the second Charleston requires unanimous agreement. Any player may stop it, without explanation, after the first Charleston and before looking at any second-Charleston tiles. If anyone says No, the group skips straight to the optional courtesy pass.",
    question: "Would your group like to complete a second Charleston?",
    source: SRC.american,
  },
  ...charlestonSteps(true),
  {
    id: "am-courtesy", variant: "american", kind: "complete", ruleType: "optional",
    title: "Optional Courtesy Pass",
    intro: "Last, an optional courtesy pass with the player across from you.",
    short: "You and the player across may exchange 0 to 3 tiles. The player who wants to pass fewer tiles decides the number.",
    doSteps: ["Agree a number (0–3) with the player across.", "If you disagree, the smaller number wins.", "Pass face down across; no jokers."],
    detail: "AMJA: the courtesy pass is across the table, 0–3 tiles. If you and your partner disagree, the one who wants to pass fewer tiles sets the number. Skipping it is fine.",
    question: "Has everyone finished or skipped the courtesy pass?",
    image: "/illustrations/charleston-across.svg",
    imageAlt: "Pass across the table to the player opposite you.",
    source: SRC.american,
  },
  {
    id: "am-review", variant: "american", kind: "review", ruleType: "mandatory",
    title: "Jokers, Calling & Winning",
    intro: "Key American Mah Jongg rules before you play.",
    short: "Jokers work only in groups of three or more identical tiles, never in singles or pairs. Your winning hand must match a card hand exactly. East discards first.",
    example: "You need a kong of 5 Dots and hold three plus a joker: valid. You need a pair of Flowers and hold one Flower plus a joker: not valid.",
    detail: "• Winning hand: must exactly match a hand on the current year's card.\n• Jokers: usable in pungs, kongs, quints and larger identical groups, never in singles or pairs.\n• Joker exchange: on your own turn, you may swap the matching real tile for a joker in an exposed group.\n• East discards first; play then continues in turn.\n• No missing suit and no Sichuan-style exchange.",
    source: SRC.american,
  },
  {
    id: "am-begin", variant: "american", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. East discards first.",
    detail: "Play with your physical tiles and card. Use the Shared Table for public questions and My Private Coach for your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.american,
  },
];

export const stepById = (id: string | null) => STEPS.find((s) => s.id === id);
export const stepsFor = (v: VariantId) => STEPS.filter((s) => s.variant === v);
export function firstStep(v: VariantId) {
  return stepsFor(v)[0];
}
export function nextStep(current: Step, decisions: Record<string, string>): Step | null {
  const list = stepsFor(current.variant);
  for (let i = list.indexOf(current) + 1; i < list.length; i++) if (!list[i].when || list[i].when!(decisions)) return list[i];
  return null;
}
export function visibleSteps(v: VariantId, decisions: Record<string, string>) {
  return stepsFor(v).filter((s) => !s.when || s.when(decisions));
}
export function fill(text: string, d: Record<string, string>) {
  return text.replace(/\{dir\}/g, dirLabel(d.exchangeDir));
}
export function stepImage(step: Step, d: Record<string, string>) {
  if (step.id === "sc-exchange") {
    if (d.exchangeDir === "counterclockwise") return "/illustrations/exchange-three-tiles-counterclockwise.svg";
    if (d.exchangeDir === "across") return "/illustrations/exchange-three-tiles-across.svg";
  }
  return step.image;
}

// -------- Wall break calculation (only for verified procedures) --------
const WALL = ["the dealer's own wall", "the wall of the player to the dealer's right", "the wall across from the dealer", "the wall of the player to the dealer's left"];
export function breakInstruction(method: BreakMethod, d1: number, d2: number, dealerName: string): string {
  const total = d1 + d2;
  const low = Math.min(d1, d2);
  const wallIdx = (total - 1) % 4;
  const wall = WALL[wallIdx].replace("the dealer", dealerName);
  if (method === "east-wall")
    return `Total ${total}. ${dealerName} counts ${total} stacks from the right end of their own wall and breaks it there. Tiles to the left of the break are dealt first.`;
  if (method === "sichuan")
    return `Total ${total} → counting counter-clockwise from ${dealerName}'s wall as 1, break ${wall}. On that wall, count ${low} stack${low > 1 ? "s" : ""} from the right (the lower die) and break there.`;
  if (method === "riichi")
    return `Total ${total} → counting counter-clockwise with ${dealerName} as 1, break ${wall}. From its right end, count ${total} stacks and break there. The 7 stacks to the right of the break are the dead wall. Flip the top tile of the third stack from the break as the dora indicator.`;
  return `Total ${total} → counting counter-clockwise with ${dealerName} as 1, break ${wall}. From its right end, count ${total} stacks and break there.`;
}
