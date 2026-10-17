import { expect, test } from "vitest";
import { voteCounts } from "@/components/community/use-community-mutations";
test("vote switching, cancellation and rollback restore both counts", () => {
  const base = { positive: 4, negative: 2 };
  const positive = voteCounts(base, 0, 1);
  expect(positive).toEqual({ positive: 5, negative: 2 });
  const negative = voteCounts(positive, 1, -1);
  expect(negative).toEqual({ positive: 4, negative: 3 });
  expect(voteCounts(negative, -1, 0)).toEqual(base);
  expect(voteCounts(positive, 1, 0)).toEqual(base);
});
