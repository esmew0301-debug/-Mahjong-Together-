import type { VariantId } from "../types";
import type { ScoringProfile } from "./types";
import { SICHUAN_PROFILE } from "./sichuan";
import { SRC } from "../variants";

export * from "./types";
export { SICHUAN_PROFILE } from "./sichuan";

/** Only Sichuan has a complete documented automatic engine. Other variants use unanimous manual transfers. */
const MANUAL: Record<Exclude<VariantId, "sichuan">, ScoringProfile> = {
  riichi: { variant: "riichi", rulesetId: "riichi-manual", name: "Riichi — manual group-verified scoring", source: SRC.riichi, automatic: false, maxWinners: 1, winnersLeave: false },
  cantonese: { variant: "cantonese", rulesetId: "hk-manual", name: "Hong Kong — manual group-verified scoring", source: SRC.cantonese, automatic: false, maxWinners: 1, winnersLeave: false },
  american: { variant: "american", rulesetId: "american-manual", name: "American Mah Jongg — manual group-verified scoring", source: SRC.american, automatic: false, maxWinners: 1, winnersLeave: false },
};
export function profileFor(v: VariantId | null): ScoringProfile {
  if (v === "sichuan" || !v) return SICHUAN_PROFILE;
  return MANUAL[v];
}
export const MANUAL_NOTE: Record<string, string> = {
  riichi: "Riichi scoring (han, fu, dora, dealer payments, riichi sticks, honba) isn't automated here. Work out the payment with your scoring table, then enter each payer → recipient transfer for the group to verify.",
  cantonese: "Hong Kong faan tables and payment conventions vary by table, so scoring isn't automated. Agree the faan and payment, then enter each payer → recipient transfer for the group to verify.",
  american: "American Mah Jongg hand values come from the current NMJL card, which this app doesn't reproduce. Use the value printed on your card and enter each payer → recipient transfer for the group to verify.",
};
