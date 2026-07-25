/**
 * Shared result contracts for followed-country operations.
 *
 * This file must remain environment-neutral.
 * Do not import Convex, browser, or Node modules here.
 */

export type FollowMutationResult =
  | { ok: true; idempotent: false }
  | { ok: true; idempotent: true }
  | { ok: false; reason: "FREE_CAP"; currentCount: number; limit: number };

export type MergeAnonymousLocalResult = {
  totalCount: number;
  accepted: string[];
  droppedInvalid: string[];
  droppedDueToCap: string[];
};
