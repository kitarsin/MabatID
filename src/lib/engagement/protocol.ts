export const FEEDBACK_MIN_LENGTH = 10;
export const FEEDBACK_MAX_LENGTH = 2000;

export interface LikeTally {
  week: string;
  nextResetAt: string;
  count: number;
  liked: boolean;
}

export function isTally(value: unknown): value is LikeTally {
  if (!value || typeof value !== "object") return false;
  const tally = value as LikeTally;
  return /^\d{4}-\d{2}-\d{2}$/.test(tally.week) &&
    Number.isFinite(Date.parse(tally.nextResetAt)) &&
    Number.isSafeInteger(tally.count) && tally.count >= 0 &&
    typeof tally.liked === "boolean";
}

export interface FeedbackInput {
  submissionId: string;
  message: string;
  rating: number | null;
}

export function parseFeedback(value: unknown): FeedbackInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["submissionId", "message", "rating"].includes(key))) return null;
  if (typeof input.submissionId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.submissionId)) return null;
  if (typeof input.message !== "string") return null;
  const message = input.message.trim();
  if (message.length < FEEDBACK_MIN_LENGTH || message.length > FEEDBACK_MAX_LENGTH || message.includes("\0")) return null;
  const rating = input.rating ?? null;
  if (rating !== null && (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5)) return null;
  return { submissionId: input.submissionId, message, rating };
}
