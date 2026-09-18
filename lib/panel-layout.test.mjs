import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  clampPanelWidth,
  getDefaultRightPanelWidth,
  getPanelAxisBehavior,
  getRightPanelMaxWidth,
  getSidebarMaxWidth,
} = await jiti.import("./panel-layout.ts");

test("clamps panel widths to finite bounds", () => {
  assert.equal(clampPanelWidth(420.4, 180, 480), 420);
  assert.equal(clampPanelWidth(120, 180, 480), 180);
  assert.equal(clampPanelWidth(600, 180, 480), 480);
  assert.equal(clampPanelWidth(Number.NaN, 180, 480), 180);
  assert.equal(clampPanelWidth(200, 300, 250), 300);
});

test("keeps the responsive right panel default within useful limits", () => {
  assert.equal(getDefaultRightPanelWidth(700), 360);
  assert.equal(getDefaultRightPanelWidth(1366), 574);
  assert.equal(getDefaultRightPanelWidth(1920), 640);
});

test("reserves chat space while split panels are visible", () => {
  assert.equal(getSidebarMaxWidth({
    viewportWidth: 700,
    rightPanelOpen: true,
    rightPanelWidth: 560,
  }), 380);
  assert.equal(getSidebarMaxWidth({
    viewportWidth: 1366,
    rightPanelOpen: true,
    rightPanelWidth: 686,
  }), 260);
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 1024,
    sidebarOpen: true,
    sidebarWidth: 260,
  }), 344);
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 1366,
    sidebarOpen: true,
    sidebarWidth: 260,
  }), 686);
});

test("does not rewrite desktop widths while the file panel is in overlay mode", () => {
  assert.equal(getRightPanelMaxWidth({
    viewportWidth: 900,
    sidebarOpen: true,
    sidebarWidth: 480,
  }), 1200);
});

test("maps each axis and growth direction to a drag behavior", () => {
  assert.deepEqual(getPanelAxisBehavior("x", "right"), {
    bodyCursor: "col-resize",
    coord: "clientX",
    growKey: "ArrowRight",
    separatorOrientation: "vertical",
    shrinkKey: "ArrowLeft",
    sign: 1,
  });
  assert.deepEqual(getPanelAxisBehavior("x", "left"), {
    bodyCursor: "col-resize",
    coord: "clientX",
    growKey: "ArrowLeft",
    separatorOrientation: "vertical",
    shrinkKey: "ArrowRight",
    sign: -1,
  });
  // The in-sidebar file explorer: a horizontal separator that grows upwards.
  assert.deepEqual(getPanelAxisBehavior("y", "up"), {
    bodyCursor: "row-resize",
    coord: "clientY",
    growKey: "ArrowUp",
    separatorOrientation: "horizontal",
    shrinkKey: "ArrowDown",
    sign: -1,
  });
  assert.deepEqual(getPanelAxisBehavior("y", "down"), {
    bodyCursor: "row-resize",
    coord: "clientY",
    growKey: "ArrowDown",
    separatorOrientation: "horizontal",
    shrinkKey: "ArrowUp",
    sign: 1,
  });
});

test("grows the panel for the grow key and shrinks it for the shrink key on every axis", () => {
  // Key token deltas along the axis; mirrors what the browser reports in `event.key`.
  const tokenDelta = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 };
  // The reachable pairs, mirroring the hook's GrowDirection union per axis.
  const directionsByAxis = { x: ["left", "right"], y: ["up", "down"] };

  for (const [axis, directions] of Object.entries(directionsByAxis)) {
    for (const growthDirection of directions) {
      const label = `${axis}/${growthDirection}`;
      const behavior = getPanelAxisBehavior(axis, growthDirection);
      assert.equal(behavior.coord, axis === "y" ? "clientY" : "clientX", `${label} coord`);
      assert.equal(behavior.separatorOrientation, axis === "y" ? "horizontal" : "vertical", `${label} orientation`);
      assert.ok(behavior.sign * tokenDelta[behavior.growKey] > 0, `${label} grows on ${behavior.growKey}`);
      assert.ok(behavior.sign * tokenDelta[behavior.shrinkKey] < 0, `${label} shrinks on ${behavior.shrinkKey}`);
    }
  }
});
