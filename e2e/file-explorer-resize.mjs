import assert from "node:assert/strict";

// The in-sidebar file explorer keeps a real measured ceiling: its height may
// never push the session slot (list or search results) below its minimum, and
// the stored height must be re-clamped whenever the layout changes without a
// window resize. Regression guard for the bug where a missing measurement — the
// session list is unmounted while a search query is active — degraded the bound
// to a "no limit" sentinel, letting the pane grow past the sidebar bottom and
// persisting the oversized value.
const EXPLORER_MIN_HEIGHT = 120;
const SESSION_SLOT_MIN_HEIGHT = 80;
const OVERSIZED_STORED_HEIGHT = 1500;

export async function checkFileExplorerResize(page) {
  // `checkChatAppearance` leaves the page at a mobile viewport, where the
  // sidebar is an overlay; reload at a desktop width to start from its default
  // open state.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: "domcontentloaded" });

  const handle = page.locator(".explorer-resize-handle");
  await handle.waitFor({ state: "visible" });
  const pane = handle.locator("xpath=following-sibling::*[1]");
  const column = handle.locator("xpath=parent::*");

  const geometry = async () => {
    const [paneBox, columnBox] = await Promise.all([pane.boundingBox(), column.boundingBox()]);
    return {
      attributes: await handle.evaluate((el) => ({
        now: Number(el.getAttribute("aria-valuenow")),
        max: Number(el.getAttribute("aria-valuemax")),
        min: Number(el.getAttribute("aria-valuemin")),
      })),
      columnHeight: Math.round(columnBox.height),
      paneHeight: Math.round(paneBox.height),
      paneBottom: Math.round(paneBox.y + paneBox.height),
      columnBottom: Math.round(columnBox.y + columnBox.height),
    };
  };

  // Drag to the very top of the viewport so the pane is guaranteed to hit its
  // ceiling instead of stopping wherever a fixed number of steps happens to end.
  const dragHandleToTop = async () => {
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2;
    const from = box.y + box.height / 2;
    const to = 8;
    await page.mouse.move(x, from);
    await page.mouse.down();
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(x, from + ((to - from) * step) / 10);
    }
    await page.mouse.up();
    await page.waitForTimeout(200);
  };

  const assertInsideSidebar = async (label) => {
    const state = await geometry();
    assert.equal(
      state.attributes.min,
      EXPLORER_MIN_HEIGHT,
      `${label}: the announced ARIA range must match the enforced floor`,
    );
    assert.ok(
      state.paneBottom <= state.columnBottom,
      `${label}: explorer pane must stay inside the sidebar (${state.paneBottom} > ${state.columnBottom})`,
    );
    assert.ok(
      state.attributes.now <= state.attributes.max,
      `${label}: aria-valuenow must not exceed aria-valuemax (${state.attributes.now} > ${state.attributes.max})`,
    );
    assert.ok(
      state.paneHeight >= EXPLORER_MIN_HEIGHT,
      `${label}: explorer pane must stay usable (${state.paneHeight} < ${EXPLORER_MIN_HEIGHT})`,
    );
    return state;
  };

  const initial = await assertInsideSidebar("initial");

  // A session search replaces the list with the results pane in the same slot.
  await page.click('[aria-controls="session-search-input"]');
  await page.fill("#session-search-input", "E2E");
  const results = page.locator("#session-sidebar [aria-busy]");
  await results.waitFor({ state: "attached" });
  await page.waitForTimeout(300);

  const searching = await geometry();
  assert.ok(
    searching.attributes.max <= searching.columnHeight - SESSION_SLOT_MIN_HEIGHT,
    `search active: the ceiling must stay measured, not fall back to an unbounded value (${searching.attributes.max} with a ${searching.columnHeight}px sidebar)`,
  );

  // Dragging all the way up must stop at that ceiling instead of overflowing.
  await dragHandleToTop();
  const dragged = await assertInsideSidebar("search active, dragged to the top");
  assert.ok(
    dragged.paneHeight > initial.paneHeight,
    `dragging upwards must grow the explorer (${initial.paneHeight} -> ${dragged.paneHeight})`,
  );
  assert.ok(
    Math.round((await results.boundingBox()).height) >= SESSION_SLOT_MIN_HEIGHT,
    "search results must keep their minimum height while the explorer is at its ceiling",
  );

  // Clearing the query brings the list back in the same slot: the committed
  // height is still valid, so nothing may be left over-sized.
  await page.click("#session-search-input");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.querySelector("#session-sidebar div[style*='overflow-y: auto']") !== null);
  await assertInsideSidebar("search cleared");

  // A stored height that no longer fits must be re-clamped on load.
  await page.evaluate((height) => localStorage.setItem("pi-web:file-explorer:height", String(height)), OVERSIZED_STORED_HEIGHT);
  await page.reload({ waitUntil: "domcontentloaded" });
  await handle.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  const restored = await assertInsideSidebar("stored value larger than the sidebar");
  assert.ok(
    Number(await page.evaluate(() => localStorage.getItem("pi-web:file-explorer:height"))) <= restored.attributes.max,
    "an oversized stored height must be re-clamped in storage",
  );
  console.log("PASS: file explorer resize stays bounded by the live sidebar height");
}
