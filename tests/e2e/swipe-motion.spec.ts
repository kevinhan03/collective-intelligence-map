import { expect, test } from "@playwright/test";
import { openFirstMobilePlace } from "./mobile-sheet";

test("mobile swipe keeps title and body together through release in both directions", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/maps/tokyo-fashion");
  await openFirstMobilePlace(page);
  const card = page.locator(".mobile-place-carousel");
  const title = card.getByRole("heading");
  const initial = await title.innerText();
  const touch = await page.context().newCDPSession(page);
  for (const direction of [-1, 1]) {
    await expect
      .poll(() =>
        card.evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      )
      .toBe(0);
    const name = await title.innerText();
    // The return swipe starts in the blank area beside the reaction buttons.
    const target =
      direction < 0
        ? title
        : card.locator(
            '.mobile-place-slide[aria-hidden="false"] .place-summary-participation',
          );
    const box = (await target.boundingBox())!;
    const x = direction < 0 ? box.x + box.width * 0.75 : box.x + 12;
    const y = box.y + box.height / 2;
    const before = await card
      .locator(".mobile-place-track")
      .evaluate((track) => track.scrollLeft);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 8; i++) {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + direction * i * 10, y }],
      });
    }
    expect(
      await card
        .locator(".mobile-place-track")
        .evaluate((track) => track.scrollLeft),
    ).toBe(before);
    const releaseX = await title.evaluate(
      (element) => element.getBoundingClientRect().x,
    );
    const frames = card.evaluate(
      (element) =>
        new Promise<
          { name: string; x: number; bodyX: number; opacity: number }[]
        >((resolve) => {
          const frames: {
            name: string;
            x: number;
            bodyX: number;
            opacity: number;
          }[] = [];
          const end = performance.now() + 450;
          function sample() {
            const heading = element.querySelector("h2")!;
            const body = element.querySelector(
              '.mobile-place-slide[aria-hidden="false"] .mobile-place-summary',
            )!;
            frames.push({
              name: heading.textContent!,
              x: heading.getBoundingClientRect().x,
              bodyX: body.getBoundingClientRect().x,
              opacity: Number(getComputedStyle(heading.parentElement!).opacity),
            });
            if (performance.now() < end) requestAnimationFrame(sample);
            else resolve(frames);
          }
          requestAnimationFrame(sample);
        }),
    );
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const samples = await frames;
    await test
      .info()
      .attach(`swipe-${direction}`, {
        body: JSON.stringify({ name, releaseX, samples }),
        contentType: "application/json",
      });
    const outgoing = samples.filter((frame) => frame.name === name);
    expect(outgoing.length).toBeGreaterThan(1);
    // The outgoing place continues in the drag direction, never snapping back.
    for (const frame of outgoing) {
      expect(direction * (frame.x - releaseX)).toBeGreaterThanOrEqual(-2);
    }
    expect(outgoing.some((frame) => frame.opacity < 0.9)).toBe(true);
    for (const frame of samples)
      expect(Math.abs(frame.x - frame.bodyX)).toBeLessThan(2);
    await expect(title).not.toHaveText(name);
    await expect(card).toHaveAttribute("data-sheet-stage", "summary");
  }
  await expect(title).toHaveText(initial);
});
