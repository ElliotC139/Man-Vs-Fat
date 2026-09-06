/**
 * Mifflin-St Jeor's sex term.
 *
 * Its own file so a test can reach it without loading a route, which pulls in
 * config and a database connection: tests/bmrSex.test.ts couldn't even load
 * while this lived in routes/stats.ts.
 */

// Mifflin-St Jeor's final term depends on sex: +5 for men, -161 for women, a
// 166 kcal/day gap. The app hardcoded +5, so every woman's burn came out 166
// too high — a generous target, verdicts that read better than the week
// really went, and slower loss than the projection promised.
//
// An unset value takes the midpoint rather than either constant. It is wrong
// by 83 for everyone instead of wrong by 166 for half of them, and nobody
// should have to answer this to use a food diary.
const SEX_CONSTANTS = { male: 5, female: -161 } as const;
const SEX_CONSTANT_UNKNOWN = (SEX_CONSTANTS.male + SEX_CONSTANTS.female) / 2;

export function sexConstant(sex: string | null | undefined): number {
  if (sex === "male" || sex === "female") return SEX_CONSTANTS[sex];
  return SEX_CONSTANT_UNKNOWN;
}
