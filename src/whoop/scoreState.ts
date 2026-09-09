/**
 * When a synced WHOOP figure may be replaced by an unscored one.
 *
 * Editing a night's sleep times in the WHOOP app makes WHOOP recalculate that
 * night: for a while afterwards the sleep, the recovery and the cycle all come
 * back over the API as PENDING_SCORE with every figure null. A plain upsert
 * writes those nulls straight over the good numbers, which is why a hand-edited
 * sleep made that day's recovery — and its burn — disappear from this app.
 *
 * A pending re-score is not the news that there is no score. It is the news
 * that the score is being worked out again. So an unscored record never
 * displaces a scored one; the stored figures stand until WHOOP sends back
 * something scored to replace them.
 *
 * Times are a different matter and are always written: `start` and `end` are
 * plain facts about the record, and an edit is precisely a correction to them.
 * Only the scored figures are held back.
 */
export const SCORED = "SCORED";

/**
 * True when the incoming record's scored figures should be written.
 *
 * Scored always wins, because it is the newest truth. Unscored only wins when
 * there is nothing better already stored — a first sync, or a night WHOOP has
 * never managed to score.
 */
export function shouldWriteScore(
  storedScoreState: string | null | undefined,
  incomingScoreState: string,
): boolean {
  if (incomingScoreState === SCORED) return true;
  return storedScoreState !== SCORED;
}
