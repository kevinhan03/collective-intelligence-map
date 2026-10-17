import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { MobilePlaceCarousel } from "@/components/community/mobile-place-carousel";
import type { MapPlace } from "@/domain/types";
test("500 places keep their slide widths but render at most three card bodies", () => {
  const places = Array.from(
    { length: 500 },
    (_, index) =>
      ({
        id: String(index),
        place_id: String(index),
        name: `Place ${index}`,
        address: "서울 용산구",
        rationale: "Introduction",
        positive: 0,
        negative: 0,
      }) as MapPlace,
  );
  for (const [activeId, expected] of [
    ["0", 2],
    ["250", 3],
    ["499", 2],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(MobilePlaceCarousel, {
        places,
        activeId,
        onSelect: () => {},
        onOpen: () => {},
        onSave: () => {},
        isSaved: () => false,
        disabled: true,
        controls: null,
        demo: true,
        onClose: () => {},
        onOpenComments: () => {},
        onVote: () => {},
        getVote: () => 0,
      }),
    );
    expect(html.match(/class="mobile-place-slide"/g)).toHaveLength(500);
    expect(html.match(/class="mobile-place-summary /g)).toHaveLength(expected);
  }
});
