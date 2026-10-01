/** Escapes LIKE wildcards in user input so "50%" searches for the literal text. */
export const likeEscape = (term: string): string => term.replace(/[\\%_]/g, '\\$&');

/** Splits a search box value into at most 6 non-empty words. */
export const searchTokens = (search?: string | null): string[] =>
  (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
