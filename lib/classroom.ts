/** The ONE classroom of this demo (shared by player matching and spectating). Not a game-room id. */
export const CLASSROOM_CODE = "COGS123";
export const INVALID_CLASSROOM = "Invalid classroom code. Please check and try again.";
/** Case-insensitive; surrounding (and inner) spaces ignored. */
export const normalizeClassroom = (raw: unknown) => String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
