export const COURSE_ART = ["physics", "maths", "market", "community", "english", "geography", "science", "it", "business"] as const;
export const GAME_ART = [
  "mental_maths", "number_sequence", "fraction_face_off", "coin_counter", "spelling_spotter",
  "word_unscramble", "odd_one_out", "percent_sprint", "star_counter", "memory_flash",
] as const;

export type ArtName = (typeof COURSE_ART)[number] | (typeof GAME_ART)[number];

export const ART_LABELS: Record<ArtName, string> = {
  physics: "Physics Lab", maths: "Maths", market: "Market Simulator", community: "Community", english: "English",
  geography: "Geography", science: "Science", it: "IT & Coding", business: "Business & Accounts",
  mental_maths: "Mental Maths", number_sequence: "Number Patterns", fraction_face_off: "Fraction Face-Off",
  coin_counter: "Coin Counter", spelling_spotter: "Spelling Spotter", word_unscramble: "Word Unscramble",
  odd_one_out: "Odd One Out", percent_sprint: "Percent Sprint", star_counter: "Star Counter", memory_flash: "Memory Flash",
};

/**
 * Asset configuration. To replace any illustrated icon with your own artwork (photography, 3D renders,
 * AI-generated images), drop a square image into /public/art and map it here, e.g.
 *   physics: "/art/physics.webp"
 * Recommended: 512x512 WebP, under 60 KB each. Anything not listed keeps the built-in vector illustration.
 */
export const ART_OVERRIDES: Partial<Record<ArtName, string>> = {};

/** Maps a free-text course subject to an icon. Falls back to "science". */
export function artForSubject(subject: string): ArtName {
  const s = subject.toLowerCase();
  if (/physic/.test(s)) return "physics";
  if (/math|algebra|statistic|geometry/.test(s)) return "maths";
  if (/account|business|econom|commerce/.test(s)) return "business";
  if (/english|literature|language/.test(s)) return "english";
  if (/geograph|social|histor|caribbean/.test(s)) return "geography";
  if (/\bit\b|information|computer|coding|technology/.test(s)) return "it";
  if (/finance|market|invest/.test(s)) return "market";
  return "science";
}
