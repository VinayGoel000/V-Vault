import { randomInt } from "node:crypto";

const CHARACTER_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
} as const;

function randomCharacter(characters: string): string {
  return characters[randomInt(0, characters.length)] ?? "";
}

/**
 * Generate a password with cryptographically secure selection and shuffling.
 * Every requested category is represented at least once.
 */
export function generatePassword(options: {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}): string {
  const requestedSets: Array<string | undefined> = [
    options.uppercase ? CHARACTER_SETS.uppercase : undefined,
    options.lowercase ? CHARACTER_SETS.lowercase : undefined,
    options.numbers ? CHARACTER_SETS.numbers : undefined,
    options.symbols ? CHARACTER_SETS.symbols : undefined,
  ];
  const enabledSets = requestedSets.filter(
    (set): set is string => set !== undefined,
  );

  if (enabledSets.length === 0 || options.length < enabledSets.length) {
    throw new Error("Invalid password generator options");
  }

  const characters = enabledSets.map(randomCharacter);
  const allCharacters = enabledSets.join("");

  while (characters.length < options.length) {
    characters.push(randomCharacter(allCharacters));
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex]!,
      characters[index]!,
    ];
  }

  return characters.join("");
}
