---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/index.html
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "User can click and drag the top area of the window to move it around the screen"
    - "Windows title bar overlay controls (minimize, close) remain functional"
    - "PixiJS canvas rendering is not affected by the drag region"
  artifacts:
    - path: "src/renderer/index.html"
      provides: "Transparent drag region div with -webkit-app-region: drag"
      contains: "-webkit-app-region: drag"
  key_links:
    - from: "src/renderer/index.html"
      to: "Electron BrowserWindow titleBarOverlay"
      via: "-webkit-app-region CSS property"
      pattern: "app-region.*drag"
---

<objective>
Add a draggable title bar region so the window can be moved around the screen.

Purpose: The window currently uses `titleBarStyle: 'hidden'` with a Windows controls overlay, which removes the native drag region. Without a custom drag region, the user has no way to reposition the window on screen.

Output: A transparent drag region div at the top of the window that enables click-and-drag movement while preserving the Windows title bar overlay controls.
</objective>

<execution_context>
@C:/Users/dlaws/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dlaws/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/main/index.ts (BrowserWindow config: titleBarStyle: 'hidden', titleBarOverlay height: 28)
@src/renderer/index.html (current HTML with #app no-drag)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add transparent drag region to window HTML</name>
  <files>src/renderer/index.html</files>
  <action>
Add a transparent drag region div to `src/renderer/index.html` that enables window dragging:

1. Add a `#drag-region` div as a sibling BEFORE `#app` in the body (or as an absolutely-positioned overlay).
2. Style the drag region:
   - `position: fixed` (so it stays at top regardless of content)
   - `top: 0; left: 0; right: 0;` (full width of window)
   - `height: 28px` (matches the titleBarOverlay height from main/index.ts)
   - `-webkit-app-region: drag` (this is the critical property that enables window dragging)
   - `z-index: 9999` (above the PixiJS canvas)
   - `pointer-events: auto` (ensure it captures mouse events)
   - No background color (fully transparent -- user sees the game world through it)

3. Keep `#app` as-is with `-webkit-app-region: no-drag` (already set).

The 28px drag region aligns with the titleBarOverlay height. The Windows overlay controls (minimize/close buttons) are rendered natively by Electron on top of everything, so they will remain clickable even with the drag region present. The user drags anywhere along the top 28px strip (excluding the overlay buttons on the right) to move the window.

Do NOT add any visible UI elements -- this is purely an invisible interaction zone.
  </action>
  <verify>
    Run `npm start` and confirm:
    1. The window can be dragged by clicking and holding anywhere along the top ~28px of the window
    2. The minimize and close buttons in the top-right still work
    3. The PixiJS world renders normally underneath the drag region
    4. Clicking on the game world below the 28px region does not initiate a drag
  </verify>
  <done>Window is draggable by its top edge. Title bar overlay controls remain functional. Game rendering unaffected.</done>
</task>

</tasks>

<verification>
- Launch app with `npm start`
- Click and drag the top 28px of the window -- window moves with cursor
- Click minimize/close buttons -- they function normally
- Click below the drag region -- no drag initiated, game world interactive as before
</verification>

<success_criteria>
The Agent World window can be freely repositioned on screen by dragging its top edge, while all existing functionality (overlay controls, game rendering) remains intact.
</success_criteria>

<output>
After completion, create `.planning/quick/1-need-to-be-able-to-move-the-window-aroun/1-SUMMARY.md`
</output>
