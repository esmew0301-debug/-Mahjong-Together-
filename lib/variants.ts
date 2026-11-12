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
  source: string;
}

const YESNO = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];
const DONE_Q = "Has everyone completed this step?";

const DIRS: Record<string, string> = { clockwise: "clockwise", counterclockwise: "counter-clockwise", across: "across the table" };
export const dirLabel = (d?: string) => (d ? DIRS[d] || d : "in the agreed direction");

export const STEPS: Step[] = [
  // ---------------- SICHUAN ----------------
  {
    id: "sc-tiles", variant: "sichuan", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Your Tiles",
    intro: "Before we begin, let's prepare the tiles for Sichuan Mahjong.",
    short: "Keep the Characters, Bamboo, and Dots suits. Remove all Wind, Dragon, Flower, and Season tiles, and any jokers.",
    detail: "Keep all three suits, numbered 1–9, four copies of each:\n• Characters (Wan, 万): 36 tiles\n• Bamboo (Tiao, 条): 36 tiles\n• Dots (Tong, 筒): 36 tiles\nTotal: 108 tiles.\n\nPut away East, South, West, North, the Red, Green, and White Dragons, all Flowers and Seasons, and jokers if your set has them.",
    question: "Has everyone prepared their tiles?",
    image: "/illustrations/sichuan-tile-selection.svg",
    imageAlt: "Keep 108 tiles: Characters, Bamboo, and Dots. Remove winds, dragons, flowers, seasons, and jokers.",
    source: SRC.sichuan,
  },
  {
    id: "sc-dealer", variant: "sichuan", kind: "dice-dealer", ruleType: "mandatory",
    title: "Choose the Dealer",
    intro: "Now let's choose the first dealer.",
    short: "Each player rolls two real dice. Enter your own total below. The highest total becomes the first dealer. Ties re-roll.",
    detail: "Under the Jiada Sichuan rules, each player rolls two dice and the highest total deals first. Tied players re-roll. The app does not roll for you — use your physical dice.",
    source: SRC.sichuan,
  },
  {
    id: "sc-wall", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle the 108 tiles face down and build the wall.",
    short: "Build four walls, two tiles high: two walls of 14 stacks and two walls of 13 stacks.",
    detail: "• Shuffle all 108 tiles face down.\n• Each player builds a wall two tiles high in front of them.\n• Under the Jiada Sichuan rules, two walls have 14 stacks and two have 13 stacks (28 + 28 + 26 + 26 = 108).\n• Push the four walls together into a square.",
    question: "Is everyone's wall built?",
    source: SRC.sichuan,
  },
  {
    id: "sc-break", variant: "sichuan", kind: "dice-break", ruleType: "mandatory", breakMethod: "sichuan",
    title: "Roll Dice & Break the Wall",
    intro: "Next, the dealer rolls two dice to decide where to break the wall.",
    short: "The dealer rolls two real dice and enters both numbers. I'll show which wall to break and where.",
    detail: "Jiada Sichuan rules: count counter-clockwise from the dealer's own wall (dealer's wall = 1) by the dice total to choose a wall. On that wall, count stacks from the right using the lower die, and break the wall there. Dealing starts from the break.",
    question: "Has the wall been broken?",
    source: SRC.sichuan,
  },
  {
    id: "sc-deal", variant: "sichuan", kind: "complete", ruleType: "mandatory",
    title: "Deal the Starting Hands",
    intro: "Time to deal.",
    short: "The dealer starts, going counter-clockwise: take four tiles at a time until everyone has 12. Then the dealer takes two more and everyone else one. Dealer: 14. Others: 13.",
    detail: "• Starting from the break, the dealer takes four tiles (two stacks), then each player counter-clockwise does the same.\n• Repeat until everyone has 12 tiles.\n• The dealer then takes two more tiles; each other player takes one.\n• Result: dealer 14 tiles, everyone else 13. Keep your tiles hidden.",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.sichuan,
  },
  {
    id: "sc-exchange-vote", variant: "sichuan", kind: "consensus", ruleType: "optional", decisionKey: "exchange", options: YESNO,
    title: "Decide: Exchange Three Tiles?",
    intro: "Before Ding Que, your group has an optional rule to decide.",
    short: "Would you like to play with Exchange Three Tiles?",
    detail: "Exchange Three Tiles (Huan San Zhang) is part of many Sichuan rule sets, such as Mahjong Planet's, but not every table uses it. In this home-rules profile it is optional, so all four players need to agree.\n\nIf you play it, each player passes three tiles of one suit to another player in a shared direction. If you skip it, you go straight to Ding Que.",
    question: "Would you like to play with Exchange Three Tiles?",
    source: SRC.sichuan,
  },
  {
    id: "sc-exchange-dir", variant: "sichuan", kind: "consensus", ruleType: "house rule", decisionKey: "exchangeDir",
    options: [
      { id: "clockwise", label: "Clockwise" },
      { id: "counterclockwise", label: "Counter-clockwise" },
      { id: "across", label: "Across" },
    ],
    when: (d) => d.exchange === "yes",
    title: "Choose the Exchange Direction",
    intro: "Everyone passes in the same direction.",
    short: "Agree on one direction for everyone. For a random pick, the dealer can roll one die: 1–2 clockwise, 3–4 counter-clockwise, 5–6 across.",
    detail: "Mahjong Planet's Sichuan rules use one randomly selected direction that applies to everyone. The die mapping (1–2 clockwise, 3–4 counter-clockwise, 5–6 across) is a home convention, not a universal rule — any fair method your group agrees on works. Everyone then selects the same direction here.",
    question: "Which direction will your group pass?",
    source: SRC.sichuan,
  },
  {
    id: "sc-exchange", variant: "sichuan", kind: "complete", ruleType: "optional", understand: false,
    when: (d) => d.exchange === "yes",
    title: "Exchange Three Tiles",
    intro: "Let's do the exchange.",
    short: "Choose exactly three tiles of the same suit, keep them face down, and pass them {dir} at the same time. Then pick up the three you receive.",
    detail: "• Choose exactly three tiles.\n• All three must be from one suit.\n• Place them face down — don't show anyone.\n• Everyone passes {dir} at the same time.\n• Pick up the three tiles you receive.\n\nTip: passing tiles from your weakest suit can make Ding Que easier.",
    question: "Has everyone completed the exchange?",
    image: "/illustrations/exchange-three-tiles.svg",
    imageAlt: "Four seats around a table, each with three face-down tiles, with arrows showing the exchange direction.",
    source: SRC.sichuan,
  },
  {
    id: "sc-dingque", variant: "sichuan", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Ding Que — Choose a Missing Suit",
    intro: "Now each player needs to choose a Missing Suit, also called Ding Que.",
    short: "Pick one suit — Characters, Bamboo, or Dots — to give up. You must discard that suit before any other, you can't pung, kong, or win with it, and you can't win while holding any of it.",
    detail: "Ding Que rules in this profile (Mahjong Planet):\n• Each player declares one missing suit after the deal (and after the exchange, if played).\n• You must discard tiles of your missing suit before any other suit.\n• You cannot pung, kong, call, or win with tiles of that suit while holding them.\n• A winning hand uses at most two suits.\n• If you still hold your missing suit when the wall runs out, Mahjong Planet's rules have you pay each player who cleared theirs.\n\nDon't enter your suit in this app. Declare it at the table the way your group agrees — for example, everyone places one tile of their missing suit face down and reveals together.",
    question: "Has everyone completed Ding Que?",
    source: SRC.sichuan,
  },
  {
    id: "sc-review", variant: "sichuan", kind: "review", ruleType: "mandatory",
    title: "Final Rules Review",
    intro: "Here's a quick summary before you play.",
    short: "Turns go counter-clockwise; the dealer discards first. Pung and kong are allowed, chow is not. Win with four sets and a pair (or seven pairs) with no missing-suit tiles. After a win, the others keep playing.",
    detail: "• Turn order: counter-clockwise. The dealer discards first.\n• Melds: pung (three identical) and kong (four identical) can be claimed. Chow is not allowed.\n• Missing suit: discard it first; you can't win while holding it.\n• Winning hand: four sets plus a pair. Seven pairs is also a valid hand in these sources (worth 2 fan).\n• Bloody Battle: a winner leaves the round; the rest keep playing until three players have won or the wall runs out.\n• Scoring varies by table. This app does not calculate scores.",
    source: SRC.sichuan,
  },
  {
    id: "sc-begin", variant: "sichuan", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. The dealer discards first.",
    detail: "Play with your physical tiles. Ask the Shared Table for public rule questions, and use My Private Coach for questions about your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.sichuan,
  },

  // ---------------- RIICHI ----------------
  {
    id: "ri-tiles", variant: "riichi", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Your Tiles",
    intro: "Let's prepare the tiles for Riichi Mahjong.",
    short: "Use 136 tiles: Characters, Bamboo, and Dots (1–9, four each), four of each Wind, and four of each Dragon. Remove Flowers, Seasons, and jokers.",
    detail: "• Suits: Characters, Bamboo, Dots, 1–9 × 4 = 108\n• Winds: East, South, West, North × 4 = 16\n• Dragons: Red, Green, White × 4 = 12\nTotal: 136 tiles. Standard Riichi uses no flowers, seasons, or jokers.",
    question: "Has everyone prepared the tiles?",
    source: SRC.riichi,
  },
  {
    id: "ri-redfives", variant: "riichi", kind: "consensus", ruleType: "house rule", decisionKey: "redFives", options: YESNO,
    title: "Decide: Red Fives?",
    intro: "One ruleset choice to agree on.",
    short: "Will your group play with red fives (bonus dora)? Only choose Yes if your set has them.",
    detail: "Red fives depend on the ruleset. Many sets include one red five in each suit, which counts as an extra dora. Others play without them. All four players should agree.",
    question: "Play with red fives?",
    source: SRC.riichi,
  },
  {
    id: "ri-seats", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Choose Seats & Dealer",
    intro: "Now decide seats and the first dealer (East).",
    short: "A common method: shuffle one each of East, South, West, and North face down and each player draws one. Whoever draws East is the first dealer.",
    detail: "The reference guide says East is the dealer but doesn't fix how seats are chosen. Drawing wind tiles is a widely used method; use your group's own method if you prefer. Sit counter-clockwise East → South → West → North.",
    question: "Are seats and the dealer decided?",
    source: SRC.riichi,
  },
  {
    id: "ri-wall", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle face down and build the walls.",
    short: "Each player builds a wall 17 tiles long and two tiles high (136 tiles total).",
    detail: "• Shuffle all 136 tiles face down.\n• Each player builds a wall of 17 stacks, two high, in front of them.\n• Push the walls together into a square.",
    question: "Is everyone's wall built?",
    source: SRC.riichi,
  },
  {
    id: "ri-break", variant: "riichi", kind: "dice-break", ruleType: "mandatory", breakMethod: "riichi",
    title: "Dice, Wall Break & Dead Wall",
    intro: "The dealer rolls two dice to break the wall.",
    short: "The dealer rolls two real dice and enters both numbers. I'll show where to break, where the dead wall is, and where to flip the dora indicator.",
    detail: "WRC-style counting: count counter-clockwise starting with the dealer as 1 to choose a wall. From the right end of that wall, count stacks equal to the dice total and break there. The 7 stacks (14 tiles) to the right of the break form the dead wall. Flip the top tile of the third stack from the break as the dora indicator.\n\nThe Japan Mahjong guide confirms the 14-tile dead wall and dora indicator but doesn't spell out the counting, so this counting comes from WRC-style rules.",
    question: "Is the wall broken and the dora indicator flipped?",
    source: SRC.riichi,
  },
  {
    id: "ri-deal", variant: "riichi", kind: "complete", ruleType: "mandatory",
    title: "Deal the Starting Hands",
    intro: "Time to deal.",
    short: "Starting with the dealer, counter-clockwise, each player takes four tiles at a time for three rounds. Then the dealer takes two and the others take one. Dealer: 14. Others: 13.",
    detail: "• Deal from the left of the break (never from the dead wall).\n• Each player takes two stacks (four tiles) at a time for three rounds: 12 tiles.\n• The dealer takes two more tiles; each other player takes one.\n• Dealer 14, others 13. The dealer discards first.",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.riichi,
  },
  {
    id: "ri-review", variant: "riichi", kind: "review", ruleType: "mandatory",
    title: "Final Rules Review",
    intro: "Key Riichi rules before you play.",
    short: "You need at least one yaku to win. You can declare riichi with a closed, ready hand. Furiten blocks winning on discards. Chi only from the player on your left; pon and kan from anyone.",
    detail: "• Yaku: a winning hand needs at least one scoring pattern.\n• Riichi: with a closed hand one tile from winning, you may declare riichi and place a 1,000-point stick.\n• Furiten: if one of your winning tiles is in your own discards, you can't win on another player's discard.\n• Calls: chi (sequence) only from the player on your left; pon (triplet) and kan (quad) from any player.\n• Dora: the tile after the indicator is a bonus tile.\n• No tile exchange and no missing suit in Riichi.",
    source: SRC.riichi,
  },
  {
    id: "ri-begin", variant: "riichi", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. The dealer (East) discards first.",
    detail: "Play with your physical tiles. Use the Shared Table for public questions and My Private Coach for your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.riichi,
  },

  // ---------------- CANTONESE ----------------
  {
    id: "hk-tiles", variant: "cantonese", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Your Tiles",
    intro: "Let's prepare the tiles for Hong Kong Mahjong.",
    short: "Use all 144 tiles: the three suits, Winds, Dragons, four Flowers, and four Seasons. Keep the winds and dragons. Remove jokers only.",
    detail: "• Suits: Characters, Bamboo, Dots, 1–9 × 4 = 108\n• Winds × 4 = 16, Dragons × 4 = 12\n• Flowers 4 + Seasons 4 = 8 bonus tiles\nTotal: 144. Remove jokers if your set has them.",
    question: "Has everyone prepared the tiles?",
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
    id: "hk-wall", variant: "cantonese", kind: "complete", ruleType: "mandatory",
    title: "Build the Wall",
    intro: "Shuffle face down and build the walls.",
    short: "Each player builds a wall 18 stacks long and two tiles high (144 tiles total).",
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
    id: "hk-deal", variant: "cantonese", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Deal & Replace Flowers",
    intro: "Time to deal, then replace any bonus tiles.",
    short: "Deal 13 tiles to each player and 14 to East. Then, starting with East, put any Flower or Season face up and draw a replacement from the end of the wall. Repeat until no one holds a bonus tile.",
    detail: "• Deal four tiles at a time for three rounds, then the dealer takes two and the others one (East 14, others 13).\n• Flowers and seasons are bonus tiles, not part of your hand.\n• Starting with the dealer, place each bonus tile face up in front of you and draw a replacement from the end of the wall.\n• Repeat until no one has a bonus tile. During play, do the same whenever you draw one.",
    question: "Has everyone dealt and replaced bonus tiles?",
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
    detail: "HK Mahjong Rules says a winning hand must be worth at least 3 faan under traditional rules, while some tables allow a chicken hand (no faan). Other references simply use an agreed minimum. All four players need to choose the same option.",
    question: "Which minimum will your group use?",
    source: SRC.cantonese,
  },
  {
    id: "hk-review", variant: "cantonese", kind: "review", ruleType: "mandatory",
    title: "Final Rules Review",
    intro: "Key Hong Kong rules before you play.",
    short: "Chow from the player on your left; pung and kong from anyone. Win with four sets and a pair that meets your minimum faan. Replace bonus tiles whenever you draw them.",
    detail: "• Turns go counter-clockwise. East discards first.\n• Chow (sequence) only from the player on your left; pung and kong from anyone.\n• Winning hand: four sets plus a pair, worth at least your agreed minimum faan.\n• Flowers and seasons: set aside and replace from the end of the wall.\n• No tile exchange and no missing suit in this style.",
    source: SRC.cantonese,
  },
  {
    id: "hk-begin", variant: "cantonese", kind: "begin", ruleType: "mandatory",
    title: "Begin the Game",
    intro: "Great! Your group has completed the setup.",
    short: "You're ready to start playing. East discards first.",
    detail: "Play with your physical tiles. Use the Shared Table for public questions and My Private Coach for your own hand.",
    question: "Is everyone ready to start playing?",
    source: SRC.cantonese,
  },

  // ---------------- AMERICAN ----------------
  {
    id: "am-tiles", variant: "american", kind: "complete", ruleType: "mandatory", understand: true,
    title: "Prepare Tiles & Equipment",
    intro: "Let's prepare for American Mah Jongg.",
    short: "Use all 152 tiles (including 8 flowers and 8 jokers), four racks, dice, and a current-year NMJL card for each player.",
    detail: "• 108 suited tiles, 16 Winds, 12 Dragons, 8 Flowers, 8 Jokers = 152\n• Four racks and two dice\n• A current-year National Mah Jongg League card for each player. This app does not reproduce the card — buy it from the NMJL.",
    question: "Does everyone have tiles, a rack, and a current card?",
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
    short: "Deal 13 tiles to each player and 14 to East. Place your tiles on your rack.",
    detail: "AMJA: each player receives 13 tiles and East receives 14; East discards first after the Charleston.\n\nA common method: players take four tiles at a time for three rounds, then East takes two and the others take one. The AMJA page gives the counts but not this order, so follow your group's habit if it differs.",
    question: "Has everyone received the correct number of tiles?",
    source: SRC.american,
  },
  {
    id: "am-charleston1", variant: "american", kind: "complete", ruleType: "mandatory", understand: true,
    title: "The First Charleston",
    intro: "Before play, every player passes tiles in the Charleston. The first Charleston is required.",
    short: "Three passes of three tiles each: Right, then Across, then Left. Jokers can't be passed.",
    detail: "First Charleston (required):\n1. Pass three tiles to the player on your Right.\n2. Pass three tiles Across.\n3. Pass three tiles to your Left.\n\nPass face down, and pick up what you receive before passing again. Jokers may not be passed.",
    question: "Has everyone completed the first Charleston?",
    source: SRC.american,
  },
  {
    id: "am-charleston2-vote", variant: "american", kind: "consensus", ruleType: "optional", decisionKey: "charleston2", options: YESNO, veto: true,
    title: "Decide: Second Charleston?",
    intro: "The second Charleston is optional.",
    short: "Would your group like to complete a second Charleston? It needs unanimous agreement — any one player can stop it, no explanation needed.",
    detail: "AMJA: the second Charleston requires unanimous agreement. Any player may stop it, without explanation, after the first Charleston and before looking at any second-Charleston tiles. If anyone says No, the group skips straight to the optional courtesy pass.",
    question: "Would your group like to complete a second Charleston?",
    source: SRC.american,
  },
  {
    id: "am-charleston2", variant: "american", kind: "complete", ruleType: "optional",
    when: (d) => d.charleston2 === "yes",
    title: "The Second Charleston",
    intro: "Your group agreed to a second Charleston.",
    short: "Three more passes of three tiles: Left, then Across, then Right.",
    detail: "Second Charleston: pass three tiles Left, then Across, then Right. Jokers may not be passed.",
    question: "Has everyone completed the second Charleston?",
    source: SRC.american,
  },
  {
    id: "am-courtesy", variant: "american", kind: "complete", ruleType: "optional",
    title: "Optional Courtesy Pass",
    intro: "Last, an optional courtesy pass with the player across from you.",
    short: "You and the player across may exchange 0 to 3 tiles. The player who wants to pass fewer tiles decides the number.",
    detail: "AMJA: the courtesy pass is across the table, 0–3 tiles. If you and your partner disagree, the one who wants to pass fewer tiles sets the number. Skipping it is fine.",
    question: "Has everyone finished or skipped the courtesy pass?",
    source: SRC.american,
  },
  {
    id: "am-review", variant: "american", kind: "review", ruleType: "mandatory",
    title: "Final Rules Review",
    intro: "Key American Mah Jongg rules before you play.",
    short: "Your winning hand must match a hand on the current NMJL card. Jokers work in pungs, kongs, and quints — not singles or pairs. East discards first.",
    detail: "• Winning hand: must exactly match a hand on the current year's card.\n• Jokers: usable in groups of three or more identical tiles (pung, kong, quint), never in singles or pairs.\n• Joker exchange: on your own turn, you may swap the matching real tile for a joker in an exposed group.\n• East discards first; play then continues in turn.\n• No missing suit and no Sichuan-style exchange.",
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
