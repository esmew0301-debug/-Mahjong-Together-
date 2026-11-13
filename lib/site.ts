/** Public production site. The classroom QR code always encodes this address (never localhost or a preview URL).
 *  Override with NEXT_PUBLIC_SITE_URL only if the production domain changes. */
export const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mahjongtogether.vercel.app").replace(/\/$/, "");
/** The ONE shared classroom destination: a matchmaking queue (never a specific room). */
export const CLASS_QR_URL = `${PUBLIC_SITE_URL}/match?queue=class`;
