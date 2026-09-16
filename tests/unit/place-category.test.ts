import { expect, it } from "vitest";
import { placeCategoryLabel } from "@/domain/place-category";

it("turns Overture category keys into readable Korean labels", () => {
  expect(placeCategoryLabel("boutique")).toBe("부티크");
  expect(placeCategoryLabel("photography_store_and_services")).toBe("사진관");
  expect(placeCategoryLabel("unknown_provider_key")).toBe("장소");
});
