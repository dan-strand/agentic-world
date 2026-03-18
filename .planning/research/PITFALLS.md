# Pitfalls Research

**Domain:** Performance optimization for a long-running Electron + PixiJS 8 always-on desktop visualizer
**Researched:** 2026-03-18
**Confidence:** HIGH (verified via PixiJS v8 documentation, direct codebase analysis, Node.js fs API docs, established game programming patterns)

---

## Critical Pitfalls

### Pitfall 1: Removing ColorMatrixFilter Produces Visually Different Results Than Container Tint

**What goes wrong:**
The current day/night cycle applies a stage-level `ColorMatrixFilter` with a 5x4 matrix that multiplies R, G, B channels independently (e.g., `[0.85, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 1, 0]` for a cool blue night tint). The replacement approach uses PixiJS 8's `container.tint` property, which was introduced in v8 as an inherited property that propagates to children. However, `tint` and `ColorMatrixFilter` produce **different visual results** on the same colors:

1. **ColorMatrixFilter** operates per-pixel on the GPU fragment shader, multiplying each RGBA channel by the matrix values. It can boost channels above their original value (e.g., multiply blue by 1.1 to make nights bluer). It operates on the composited output of the entire stage, meaning overlapping semi-transparent children blend first, then the filter is applied to the result.

2. **Container.tint** is a multiplicative color applied per-vertex to each child sprite/graphics individually before compositing. It can only darken channels (multiply by 0..1), never brighten them. It is applied to each child independently before alpha blending, meaning overlapping semi-transparent children each carry their own tint into the blend.

The night tint constants (`NIGHT_TINT_B = 1.1` in the sine-wave interpolation) rely on the ColorMatrixFilter's ability to boost the blue channel above 1.0. With `container.tint`, the blue component is clamped to 0xFF (1.0), so nights will appear less blue and more washed-out gray compared to the current look.

Additionally, the current ColorMatrixFilter applies to the **entire composited stage** (tilemap, buildings, scenery, particles, agents all blended together, then tinted). Per-child tint applies separately to each child before compositing, which changes how overlapping semi-transparent elements (night glows, smoke particles, speech bubbles) interact with the color temperature shift.

**Why it happens:**
Developers see "tint replaces filter" as a simple swap because both involve color multiplication. The semantic difference (post-composite vs. pre-composite, clamped vs. unclamped) is not obvious from the API names.

**How to avoid:**
1. Before removing the ColorMatrixFilter, screenshot the world at 5+ points in the day/night cycle (dawn, midday, dusk, peak night, late night). These are the visual regression baseline.
2. Clamp the night tint RGB values to `[0, 1]` range when computing tint values. Accept that nights will be slightly less vivid blue, or compensate by adjusting the night glow layer alpha and ambient particle brightness upward.
3. Apply the tint to a single `worldContainer` that holds all scene children (tilemap, buildings, scenery, particles, agents) rather than to `app.stage` directly. This preserves the layered compositing order.
4. After the swap, compare screenshots at the same 5 cycle points. Pay special attention to: night glow halos appearing differently tinted, smoke particles losing their color temperature shift, and the overall night scene appearing flatter.

**Warning signs:**
- Night scenes look gray instead of blue
- Night glow halos appear too bright or wrong color (they were being color-shifted by the stage filter; now they receive their own tint independently)
- The transition from day to night feels abrupt instead of smooth (tint quantization at low values)
- Semi-transparent particles (smoke, fireflies, dust motes) look different against the tinted background

**Phase to address:**
Phase 1 (GPU rendering optimization -- ColorMatrixFilter removal). This is the highest visual regression risk in the entire milestone.

---

### Pitfall 2: Async File I/O Race Conditions in Session Discovery Loop

**What goes wrong:**
The current `FilesystemSessionDetector.discoverSessions()` method uses synchronous I/O (`readdirSync`, `statSync`, `readSync`) to scan the Claude projects directory. Converting to async (`readdir`, `stat`, `read`) introduces concurrency where multiple file operations execute in parallel. This creates three categories of race conditions:

1. **TOCTOU (Time-of-Check-to-Time-of-Use):** Between `await readdir()` listing a file and `await stat()` reading its metadata, Claude Code may delete the file (session ended) or create a new one. With sync I/O, the window is microseconds. With async I/O, other I/O operations interleave during the `await`, widening the window to milliseconds.

2. **Ordering loss:** The current sync code processes sessions in directory-listing order within each project directory, and results accumulate into a single `sessions[]` array in a deterministic order. With `Promise.all()` on async operations, results arrive in completion order (faster files first), which changes the session array ordering. If any downstream code relies on array ordering for building assignment or display, behavior changes silently.

3. **Mtime cache coherence:** The mtime cache checks `cached.mtimeMs === stat.mtimeMs` to skip re-reading unchanged files. With async I/O, a file's mtime could change between the `await stat()` and the `await read()` that uses the cached-or-fresh decision. The code would read the file's NEW content but cache it against the OLD mtime, causing the next poll to re-read an unchanged file or skip a changed one.

**Why it happens:**
Sync-to-async conversion appears mechanical: replace `readdirSync` with `await readdir`, `statSync` with `await stat`, etc. The interleaving behavior of async operations is invisible in the code structure -- the same sequential-looking `for` loop now has yield points at every `await`.

**How to avoid:**
1. Use `for...of` with individual `await` calls (sequential async) rather than `Promise.all()` for the outer project directory scan. This preserves ordering and minimizes TOCTOU windows. The performance gain of parallel directory reads is negligible for 2-8 project directories.
2. Within each project directory, individual file processing CAN be parallelized with `Promise.all()` since files within a directory are independent. But handle `ENOENT` errors gracefully (file deleted between listing and stat).
3. Capture the mtime from `stat()` and pass it through to the cache update as a single unit -- do not re-stat the file after reading it. The pattern should be: `stat -> decide -> read (if needed) -> cache with original stat's mtime`.
4. Keep `discoverSessions()` returning a `Promise<SessionInfo[]>` but document that the array order is not guaranteed and downstream code must not depend on it.

**Warning signs:**
- Intermittent `ENOENT` errors in logs during normal operation (file deleted between readdir and stat)
- Session status flickering more than before the change (mtime cache hitting/missing inconsistently)
- Sessions appearing and disappearing briefly on each poll cycle
- Dashboard session ordering changing between polls when no sessions actually changed

**Phase to address:**
Phase 2 (I/O optimization -- async file operations). Test by running with 3+ active Claude Code sessions creating/completing work simultaneously.

---

### Pitfall 3: Incremental JSONL Parsing Offset Tracking Breaks on File Truncation and Concurrent Writes

**What goes wrong:**
The current `readUsageTotals()` reads the entire JSONL file from byte 0 on every call (gated by mtime cache). The optimization stores a byte offset and only reads new content since the last parse. This breaks when:

1. **File truncation:** Claude Code does not truncate JSONL files during normal operation, but if the user manually deletes session files, or if disk space recovery tools truncate them, the stored offset points past the end of the file. Reading from offset > file.size returns empty data. The accumulated totals are now stale (reflect the old file content that no longer exists), and new content written after truncation is missed because the offset is never reset.

2. **Mid-write reads:** Claude Code writes JSONL entries as complete lines, but the write is not atomic from the filesystem perspective. A `read()` at the stored offset might capture a partial JSON line (the write is in progress). The current code handles this with `try/catch` on `JSON.parse`, but incremental parsing must also handle the case where a partial line is read, the offset is advanced past it, and the remaining bytes of that line appear in the NEXT incremental read as an orphaned fragment.

3. **File replacement (rotation):** If Claude Code ever replaces a JSONL file (delete + create, or rename + create), the inode changes but the path stays the same. The stored offset and accumulated totals refer to the old file. The new file's content is skipped until the offset happens to be smaller than the new file's size.

**Why it happens:**
Incremental file parsing is a deceptively simple optimization. It works perfectly when the file is append-only and reads never overlap with writes. Production filesystems violate both assumptions under edge conditions.

**How to avoid:**
1. **Detect truncation:** Before reading, compare `stat.size` with the stored offset. If `stat.size < storedOffset`, the file was truncated -- reset offset to 0 and clear accumulated totals for that session. Re-parse from the beginning.
2. **Detect replacement:** Store the file's inode (from `stat.ino`) alongside the offset. If the inode changes, the file was replaced -- reset everything.
3. **Handle partial lines:** When reading from the stored offset, always discard bytes before the first `\n` in the read buffer (they may be the tail of a partially-written line from the previous read). Start parsing from the first complete line. This means the offset should be stored as "byte position of the last successfully parsed newline + 1", not "bytes read".
4. **Use file size as mtime supplement:** Even if mtime hasn't changed (sub-millisecond writes), if `stat.size > storedOffset`, there is new content to read.

**Warning signs:**
- Token totals suddenly drop to zero for a session (offset reset missed after truncation)
- Token totals are wildly inflated (parsing a partial line as a different entry)
- JSON parse errors appearing in logs during incremental reads (partial line boundary)
- Dashboard shows stale token counts that never update (offset past end of truncated file)

**Phase to address:**
Phase 2 (I/O optimization -- incremental JSONL parsing). The truncation/replacement detection must be implemented BEFORE the incremental read logic, not after.

---

### Pitfall 4: Dirty Flag for Day/Night Filter Skips Updates at Transition Boundaries

**What goes wrong:**
The optimization adds a threshold-based dirty flag to the day/night cycle: only update the tint/filter when the night intensity changes by more than a threshold (e.g., 0.01). This works during the sustained day and night plateaus where intensity changes slowly. But at the dawn/dusk transitions, the sine-wave derivative is at its steepest -- intensity changes rapidly. If the threshold is too large, the transitions appear as visible steps (color jumps) instead of smooth gradients.

More subtly, the sine-wave with `pow(raw, 1.5)` sharpening means the rate of change is NOT uniform across the cycle. At the inflection points (transitions between day and night), the derivative peaks. The threshold that works for smooth plateaus produces visible stepping at transitions.

Additionally, the threshold comparison uses floating-point equality/inequality. If the implementation stores the "last applied intensity" and compares `Math.abs(current - last) > threshold`, the floating-point representation of the threshold boundary itself can cause off-by-one-frame jitter where the update alternately fires and skips on consecutive frames at exactly the threshold boundary.

**Why it happens:**
Threshold-based update skipping is straightforward to implement and test during a quick visual check ("looks the same"). The visual artifacts only appear during the specific 30-60 second transition windows in the 10-minute cycle, and only if the developer watches continuously during those windows.

**How to avoid:**
1. Use a threshold of `0.005` or smaller for the night intensity comparison. At 30fps with a 10-minute cycle, the maximum intensity change per frame is approximately `0.003`, so a threshold of `0.005` means the filter updates every 1-2 frames during transitions and every 5-10 frames during plateaus.
2. Use `>=` instead of `>` for the threshold comparison to avoid boundary jitter: `if (Math.abs(current - lastApplied) >= threshold)`.
3. Also gate on `nightIntensity === 0` and `nightIntensity === 1` explicitly to ensure the endpoints are always applied exactly (no residual partial tint from the last threshold-passing frame).
4. Consider a simpler approach: cache the previous tint RGB values as integers (0-255 per channel) and only update when any channel changes by >= 1. This naturally adapts to the rate of change because RGB 0-255 quantization provides appropriate resolution.

**Warning signs:**
- Dawn/dusk transitions look "stepped" or "chunky" instead of smooth
- Night glow layer alpha appears to update at a different rate than the tint (if night glow uses its own threshold)
- A brief flash of wrong color at the exact moment of transition (endpoint not applied precisely)
- Particle brightness (fireflies, smoke) desyncs from the ambient color temperature

**Phase to address:**
Phase 1 (GPU rendering optimization -- day/night cache). Verify with a screen recording at 2x speed through a full day/night cycle.

---

### Pitfall 5: Swap-and-Pop Reorders Active Particle Arrays, Breaking Index-Based Iteration

**What goes wrong:**
The current code uses `Array.splice(i, 1)` to remove expired particles from `sparkParticles[]` and `smokeParticles[]` during reverse iteration. The optimization replaces splice (O(n)) with swap-and-pop (O(1)): copy the last element over the expired element, then `pop()` the array. This is correct when iterating in reverse (`for (let i = arr.length - 1; i >= 0; i--)`), which the current code already does.

However, if a developer later adds forward iteration or index-based references to these arrays (e.g., "the particle at index 3 is the oldest"), swap-and-pop silently corrupts those assumptions. More immediately, if the swap-and-pop implementation swaps but forgets to decrement `i` (or swaps during forward iteration), it skips the newly-swapped element, leaving expired particles visible for an extra frame.

The specific bug pattern:
```typescript
// WRONG: after swapping, the element at index i is the previously-last element
// that hasn't been processed yet. If we decrement i and continue, it gets skipped.
arr[i] = arr[arr.length - 1];
arr.pop();
// i-- from the loop header skips the swapped-in element
```

This is correct in a reverse loop but WRONG in a forward loop. The current code uses reverse loops, but if anyone changes the loop direction during refactoring, particles will flicker.

Additionally, swap-and-pop changes the order of elements in the array. If any rendering behavior depends on array order (e.g., newer particles render on top of older ones due to draw order), the visual layering changes unpredictably.

**Why it happens:**
Swap-and-pop is a well-known optimization but has a subtle invariant: it only works correctly in reverse-iteration loops, and it destroys array ordering. Developers who learn the pattern but don't internalize the constraints introduce it incorrectly.

**How to avoid:**
1. Add a comment at EVERY swap-and-pop site: `// INVARIANT: reverse iteration required. swap-and-pop destroys ordering.`
2. Extract a reusable `swapRemove(arr, i)` helper function with the invariant documented in the function signature. Use this helper everywhere instead of inlining the pattern.
3. Verify that particle draw order is not visually significant for any particle type. For sparks and smoke, draw order is irrelevant (additive-looking small particles). If any future particle type has ordered layering, use a different removal strategy.
4. Write a unit test that verifies all elements are visited exactly once during a reverse-iteration removal loop.

**Warning signs:**
- Particles visually "flicker" (appear for one frame, disappear, reappear) -- sign of skipped processing
- Particles persist one frame longer than expected before disappearing
- Particle layering order changes randomly (newer particles appear behind older ones)

**Phase to address:**
Phase 3 (medium-impact fixes -- splice-to-swap-and-pop). Low risk if implemented correctly, but add the helper function and comments to prevent regression.

---

### Pitfall 6: Object Pool Use-After-Return Bugs from Stale References

**What goes wrong:**
The `GraphicsPool` is already used for spark and smoke particles. Expanding pooling to other systems (e.g., speech bubbles, night glow halos, or particle types) increases the surface area for use-after-return bugs. A use-after-return occurs when:

1. Code returns a Graphics object to the pool (`pool.return(gfx)`).
2. Another consumer borrows the same Graphics object (`pool.borrow()` returns the just-returned object).
3. The original consumer still holds a reference and modifies the Graphics (setting position, alpha, or calling draw methods).
4. The modifications corrupt the state of the new consumer's Graphics.

The current `GraphicsPool.return()` resets position, alpha, scale, and visibility. But it does NOT clear the reference in the caller's data structure. For example, in `Building.tick()`, when a smoke particle expires:
```typescript
this.smokePool.return(s.gfx);
this.smokeParticles.splice(i, 1);
```
The splice removes the `SmokeParticle` struct (which holds `s.gfx`), so the reference is dropped. This is correct. But if the code is restructured (e.g., to use swap-and-pop, or to defer removal), the `SmokeParticle` struct with its `.gfx` reference may persist in the array for one more iteration, during which `s.gfx.x += ...` modifies a Graphics that is now back in the pool or borrowed by someone else.

**Why it happens:**
Pool return and reference nullification are two separate operations that must happen atomically (or at least in the correct order). Any gap between them is a window for use-after-return. In JavaScript, there is no borrow checker or ownership system to prevent this.

**How to avoid:**
1. After `pool.return(gfx)`, immediately null out the reference in the data structure: `s.gfx = null!`. Any subsequent access will throw a clear TypeError instead of silently corrupting another consumer.
2. In `GraphicsPool.return()`, add a debug-only flag that marks the Graphics as returned. In `GraphicsPool.borrow()`, clear the flag. Add an assertion in the return path that the Graphics is not already returned (double-return detection).
3. Never hold references to pooled objects outside the struct that manages their lifecycle. The `SmokeParticle.gfx` field should be the ONLY reference to that Graphics object.
4. Consider making `GraphicsPool.return()` accept the entire particle struct and null out the field itself, enforcing the pattern.

**Warning signs:**
- Particles appearing at wrong positions momentarily (one frame of stale position from a previous consumer)
- Particles appearing visible when they should be hidden (the `visible = false` in return() was overwritten by a stale reference setting `visible = true`)
- Graphics objects with corrupted drawing (a returned object is drawn on by two consumers)
- Intermittent visual glitches that cannot be reproduced deterministically (depend on pool allocation order)

**Phase to address:**
Phase 3 (medium-impact fixes). Applies wherever pooling is expanded or where swap-and-pop changes the particle removal timing relative to pool return.

---

### Pitfall 7: Combining Redundant JSONL Reads Breaks Mtime Cache Coherence Between Detector and Aggregator

**What goes wrong:**
Currently, `FilesystemSessionDetector` and `UsageAggregator` each independently read JSONL files with their own mtime caches. The detector reads the last 4KB (tail buffer) for status detection. The aggregator reads the entire file for token totals. The optimization combines these into a single-pass read.

The coherence problem: the detector's mtime cache and the aggregator's mtime cache are currently independent. If you combine them into a single read, you must ensure both caches are updated atomically. If the single-pass reader updates the detector's cache but throws before updating the aggregator's cache (e.g., a malformed JSONL line in the middle of the file that status detection ignores but token parsing chokes on), the two caches desync. On the next poll:
- Detector sees mtime unchanged, returns cached status (correct).
- Aggregator sees mtime unchanged, returns cached totals (stale -- the failed parse left old totals).

This is a silent data correctness bug: the dashboard shows wrong token counts for that session until its JSONL file is next modified.

More critically, the detector needs only the LAST line (O(1) tail read), while the aggregator needs ALL lines (O(n) full read). Combining them means every poll pays the O(n) cost even when only the O(1) status check was needed. This is a performance regression, not improvement, unless the combined read is gated behind the mtime check.

**Why it happens:**
"Two reads of the same file = redundant" is a surface-level analysis. The two reads serve different purposes, need different amounts of data, and have different error handling requirements. Combining them conflates these concerns.

**How to avoid:**
1. Keep the detector's tail-buffer read separate from the aggregator's full-file read. They serve different purposes and have different performance profiles.
2. If combining is still desired: use a single mtime check to gate BOTH reads, then perform the full-file read, extract the last-line status from the same buffer, and update BOTH caches atomically in a single code path. Wrap the entire operation in try/catch so either both caches update or neither does.
3. The real win is making the aggregator's full-file read incremental (offset-based), not combining it with the detector's tail read. This reduces the aggregator from O(n) to O(delta) without changing the detector at all.

**Warning signs:**
- Dashboard token counts freeze for a session while its status continues updating correctly
- Token totals appear lower than expected (a partial parse was cached)
- Increased CPU usage on every poll cycle (full-file reads happening more often than before)

**Phase to address:**
Phase 2 (I/O optimization). Prefer independent optimization of each reader (incremental aggregator, keep tail-buffer detector) over combining them.

---

### Pitfall 8: Per-Container Tint Changes Interaction with Existing Per-Agent Tint Effects

**What goes wrong:**
Agents already use the `tint` property for status visual differentiation. The `Agent.applyStatusVisuals()` method sets `this.targetTint` to colors like `0xFFDD88` (active warm), `0x88BBFF` (waiting cool), `0xFF6666` (error red). These tints are applied directly to the Agent container via `this.tint = lerpColor(...)`.

In PixiJS 8, tint is inherited by children and MULTIPLIED with the parent's tint. If the world container now has a day/night tint of `0xCCBBAA` (warm day), and an agent has a status tint of `0x88BBFF` (waiting cool blue), the actual rendered color is the per-channel product: `R: 0xCC * 0x88 / 255 = 0x6B, G: 0xBB * 0xBB / 255 = 0x89, B: 0xAA * 0xFF / 255 = 0xAA`. This double-multiplication produces darker, muddier colors than either the day/night tint or the status tint alone.

Previously, the ColorMatrixFilter operated on the composited stage output, which included agents already rendered with their status tints. The filter adjusted the overall color temperature post-composite. With per-container tint, the day/night tint and status tint are multiplied together, which is a mathematically different operation that produces visually different results.

Building highlights (`building.tint = 0xFFDD88` for active buildings) have the same issue: the warm highlight tint is multiplied with the day/night tint, making active buildings appear washed-out during the day (0xFFDD88 * 0xFFEECC = less vivid) and barely visible at night (0xFFDD88 * 0x8899CC = very dark).

**Why it happens:**
PixiJS 8's tint inheritance is multiplicative by design -- it mimics how transforms and alpha propagate. Developers replacing a post-process filter with per-object tint don't account for the compositing difference.

**How to avoid:**
1. Apply the day/night tint to the STAGE or a top-level world container that is the PARENT of all other containers, not as a sibling tint alongside per-child tints.
2. Compensate agent status tints for the expected day/night tint by dividing: if the parent tint is `0.8` on the red channel and the agent wants to appear at `0.9` red, set the agent tint's red to `0.9 / 0.8 = 1.125`. Since tint values are clamped to 0-255, this compensation only works when the parent tint darkens (< 1.0) and the desired color is brighter. For night scenes where the parent tint is very dark, per-agent tint compensation cannot produce bright status colors.
3. The simpler solution: keep status tints on agents but accept that they will appear color-shifted by the day/night cycle. This is arguably MORE realistic (a blue-tinted agent at night should look blue-shifted). Test whether users find this acceptable.
4. Alternative: apply the day/night tint only to the tilemap, buildings, and scenery containers (the "background world"), and exempt the agents container from the tint. This preserves agent status colors at the cost of agents looking "unlit" compared to their environment.

**Warning signs:**
- Agent status colors look muddy or wrong (especially "waiting" blue during warm daytime)
- Active building highlights barely visible during night
- Night glow halos (which already have their own alpha modulation) look double-dimmed
- Colors that looked correct in isolation (testing one system at a time) look wrong when composited

**Phase to address:**
Phase 1 (GPU rendering optimization -- ColorMatrixFilter removal). Must be resolved during the same phase as the filter removal, not deferred.

---

### Pitfall 9: Throttling Particle Updates at Idle FPS Produces Jerky Motion

**What goes wrong:**
The optimization reduces particle update frequency when the game loop is running at idle FPS (5fps). Particles that update every frame at 30fps (smooth 33ms ticks) now update every 200ms at 5fps. The particle physics (position += velocity * dt) is delta-time correct, so particles move the right DISTANCE per tick. But the visual result is jerky: particles jump 6x the per-frame distance every 200ms instead of moving smoothly every 33ms.

This is especially noticeable for:
- **Fireflies:** Their sine-wave bob has frequency components that alias at 5fps, producing irregular jump patterns instead of smooth oscillation.
- **Smoke:** Smoke puffs jump upward in visible increments, creating a "time-lapse" effect.
- **Leaves:** Horizontal drift + sine sway at 5fps looks like teleporting leaves.

The day/night cycle also advances in 200ms chunks at idle FPS, causing the color temperature and glow layer alpha to step visibly (though this is masked by the threshold-based update gating in Pitfall 4).

**Why it happens:**
Delta-time physics guarantees positional correctness but not visual smoothness. Smoothness requires high temporal sampling rate (fps). The game loop was designed to be adaptive (30fps active, 5fps idle), but the visual expectation for ambient effects is "always smooth" even when no sessions are active.

**How to avoid:**
1. Do NOT skip particle updates at idle FPS. Particles are cheap (54 objects total: 25 fireflies + 15 dust motes + 6 leaves + 8 sparks). The per-frame cost of updating 54 particles is negligible even at 5fps.
2. DO skip more expensive subsystems at idle FPS: night glow layer updates (19+ Graphics alpha changes), building smoke (4 buildings x N particles), and the ColorMatrixFilter/tint update (if intensity hasn't changed).
3. If particle updates must be throttled, use interpolation: store the previous and current state, and render at a linearly interpolated position based on the time since the last physics tick. This requires double-buffering particle state, which is complex and not worth the effort for 54 particles.
4. The game loop already handles this correctly: at idle 5fps, particles update at 5fps with correct dt. The visual jerkiness at 5fps is acceptable because the user's attention is NOT on the visualizer when all sessions are idle. Only optimize subsystems that have measurable CPU cost, not ones that are already fast.

**Warning signs:**
- Ambient effects look "jumpy" or "laggy" when all sessions are idle
- Fireflies appear to teleport between positions instead of floating
- Smoke puffs jump upward in discrete steps
- User perceives the app as broken/frozen when actually it's just updating slowly

**Phase to address:**
Phase 1 (rendering optimization -- particle throttling). Measure CPU cost of particle updates before optimizing. If cost is < 1ms/frame, do not throttle -- the savings are not worth the visual regression.

---

### Pitfall 10: Dashboard DOM Diffing Optimization Breaks Click-to-Expand State

**What goes wrong:**
The current `DashboardPanel.renderSessions()` rebuilds the entire session list innerHTML on every update. The optimization adds DOM diffing: only update DOM elements that changed, preserving unchanged elements. This breaks the click-to-expand interaction because:

1. **Event listener loss:** If the diffing algorithm removes and re-creates a session row element (because it moved position in the sorted list), the click event listener attached to the old element is lost. The new element needs a fresh listener.
2. **Expanded state loss:** The `expandedSessions` Set tracks which sessions are expanded by sessionId. If the diffing algorithm replaces a session row element, the new element renders in collapsed state even though `expandedSessions.has(sessionId)` returns true -- the expanded visual state was in the old DOM element's children, not in the Set.
3. **Stale closure capture:** If event listeners use closures that capture the session data object, and the data object is replaced on the next update (new object reference, same sessionId), the closure references stale data. Clicking "expand" shows outdated token counts.

**Why it happens:**
DOM diffing optimizations focus on minimizing DOM mutations for rendering performance. They often don't account for stateful DOM interactions (expanded/collapsed, scroll position, focus state, event listeners).

**How to avoid:**
1. Use event delegation: attach a single click listener to the session list container, not individual session rows. Use `event.target.closest('.session-row')` to find the clicked row and its `data-session-id` attribute. This pattern survives DOM element replacement.
2. When updating an existing session row (same sessionId, data changed), mutate the existing DOM element's text content and attributes rather than replacing the entire element. This preserves the element identity, event listeners, and expanded/collapsed child nodes.
3. Separate layout structure (which rows exist, in what order) from content updates (what text each row shows). Only rebuild structure when sessions are added or removed. Update content in-place for existing sessions.
4. After any DOM update, verify that `expandedSessions` matches the visual state: for each expanded sessionId, verify the corresponding DOM element has its detail section visible.

**Warning signs:**
- Clicking a session row to expand it works once, then stops working after the next data update
- Expanded session details collapse unexpectedly when new data arrives
- Token counts in expanded view are stale (showing values from the previous update)
- Scroll position jumps to top on every update (entire list was rebuilt)

**Phase to address:**
Phase 3 (medium-impact fixes -- DOM diffing). Test by expanding a session row, then verifying it stays expanded through 3+ data update cycles.

---

### Pitfall 11: Poll Backoff Masks Newly Active Sessions

**What goes wrong:**
The current session polling interval is fixed at `POLL_INTERVAL_MS` (3 seconds). The optimization adds adaptive backoff: poll less frequently when no sessions are active (e.g., every 10 seconds), and restore 3-second polling when activity is detected. The problem: activity can only be detected by polling. If polling is backed off to 10 seconds, a newly started Claude Code session takes up to 10 seconds to appear in the visualizer, creating a perception of the app being "slow" or "not working."

Worse, if the backoff algorithm uses exponential backoff (3s -> 6s -> 12s -> 24s), the maximum detection latency grows unboundedly. A user who hasn't had active sessions for 5 minutes might wait 24+ seconds for a new session to appear.

**Why it happens:**
Poll backoff is a standard optimization for reducing CPU usage during idle periods. The tradeoff between idle CPU savings and detection latency is not obvious until the user experience is tested.

**How to avoid:**
1. Set a maximum backoff interval of 5-10 seconds. Never go slower than that, even after hours of no activity.
2. Use linear backoff (3s -> 5s -> 7s -> 10s cap) instead of exponential. The CPU savings from going beyond 10 seconds are negligible.
3. Immediately reset to the fast poll interval (3s) when ANY session activity is detected. Do not gradually ramp down.
4. Consider using filesystem watchers (`fs.watch`) on the `~/.claude/projects/` directory as a complementary signal. When a new file is created, trigger an immediate poll regardless of the backoff timer. Note: `fs.watch` on Windows has known reliability issues with recursive watching, so it should supplement polling, not replace it.

**Warning signs:**
- New sessions take noticeably longer to appear in the visualizer (> 5 seconds)
- User starts a Claude session, looks at Agent World, sees no agent, concludes the app is broken
- Session status transitions (active -> waiting) are delayed, making the status feel "laggy"

**Phase to address:**
Phase 2 (I/O optimization -- poll backoff). The maximum interval must be decided during implementation, not tuned later.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Replace ColorMatrixFilter with container tint without visual regression testing | Simple code change, immediate GPU savings | Subtle color differences that erode visual quality | Never -- screenshot baseline before and after |
| Convert all sync I/O to async in one batch | Single PR, consistent codebase | Race conditions in untested interaction patterns | Acceptable if each conversion site is tested independently |
| Hard-coded dirty flag threshold (e.g., 0.01) | Fast to implement | Wrong threshold produces stepping or wastes CPU | Acceptable for MVP if documented; tune from screenshots later |
| Skip particle physics at idle FPS | Lower idle CPU | Visual jerkiness when user glances at idle app | Never for fewer than 100 particles; CPU cost is negligible |
| innerHTML replacement for DOM diffing | Simplest "diffing" approach | Destroys event listeners, expanded state, scroll position | Never for interactive DOM elements |
| Exponential poll backoff without cap | Minimal idle CPU | Unacceptable detection latency for new sessions | Never -- always cap at 5-10 seconds |
| Combining detector and aggregator reads | "One read instead of two" | Cache coherence complexity, performance regression for status-only polls | Only if both caches update atomically |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PixiJS 8 `container.tint` replacing `ColorMatrixFilter` | Assuming visual equivalence (tint is multiplicative per-child, filter is post-composite) | Screenshot baseline comparison at 5+ cycle points; accept or compensate for color differences |
| PixiJS 8 tint inheritance with existing per-child tints | Forgetting that parent tint MULTIPLIES with child tint (not replaces) | Test compound tints: world tint * agent status tint * building highlight tint |
| Node.js `readdirSync` -> `readdir` async | Assuming ordering is preserved and TOCTOU window is unchanged | Handle ENOENT on every async stat/read; do not depend on array ordering |
| Node.js incremental file read with stored offset | Not detecting file truncation or replacement | Compare size < offset AND inode changes on every read |
| `Array.splice()` -> swap-and-pop | Using swap-and-pop in forward iteration loops | Extract `swapRemove()` helper; require reverse iteration; document invariant |
| Object pool `return()` without nulling references | Stale reference modifies Graphics that has been re-borrowed | Null the reference immediately after pool.return(); add double-return detection |
| DOM diffing with stateful elements | Replacing elements that have event listeners or expanded state | Use event delegation + in-place text updates; preserve element identity |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Dirty flag threshold too large for day/night transitions | Visible color stepping at dawn/dusk | Use threshold 0.005 or per-channel integer comparison | Immediately visible during transitions |
| Combining detector + aggregator reads into one pass | Every poll pays O(n) full-file cost even for status-only checks | Keep reads separate; make aggregator incremental independently | When JSONL files grow large (10MB+) |
| Throttling cheap particle updates (54 objects) | Jerky ambient effects at idle FPS | Measure before optimizing; don't throttle < 100 objects | Visible at 5fps idle |
| Per-container tint multiplied with per-agent tint | Muddy agent colors, invisible building highlights | Apply tint at appropriate hierarchy level; test compound multiplication | Visible immediately in day/night + status combination |
| Incremental JSONL parsing without truncation detection | Stale or missing token totals after file operations | Check size < offset before every read | When user/tool modifies JSONL files |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Night colors less vivid after filter removal | World feels "flatter" at night, losing atmospheric quality | Compensate with brighter night glow halos and boosted firefly alpha |
| Poll backoff delays new session detection | User thinks app is broken when new session doesn't appear promptly | Cap backoff at 5-10 seconds; instant reset on activity |
| Particle jerkiness at idle FPS | App feels "laggy" when user glances at it during idle | Don't throttle cheap ambient particles; accept 54-particle cost at 5fps |
| Dashboard expanded row collapses on data update | User loses context, has to re-expand to see session details | Preserve DOM elements for existing sessions; only update text content |

---

## "Looks Done But Isn't" Checklist

- [ ] **Color regression:** Screenshots at dawn, midday, dusk, peak night, and late night all visually match pre-optimization baseline (or documented intentional differences are accepted)
- [ ] **Compound tint:** Agent status colors (active, waiting, idle, error) are visually distinguishable at ALL points in the day/night cycle, not just during daytime
- [ ] **Building highlights:** Active building warm tint (`0xFFDD88`) is visually distinct at night (not crushed by dark night tint)
- [ ] **Incremental parsing:** Token totals match full-parse totals for all sessions (run both methods and compare outputs)
- [ ] **Truncation handling:** Manually truncate a JSONL file; verify token totals reset and re-accumulate correctly on next write
- [ ] **Async I/O ordering:** With 3+ simultaneous sessions, verify no intermittent ENOENT errors or status flickering over 100 poll cycles
- [ ] **Swap-and-pop:** All reverse-iteration loops with swap-and-pop visit every element exactly once (unit test)
- [ ] **Pool safety:** After pool.return(), the caller's reference is nulled; verify no stale writes via a debug assertion in the pool
- [ ] **Dashboard state:** Expand a session row, wait for 3+ data updates, verify it stays expanded with correct data
- [ ] **Dirty flag transitions:** Record a full 10-minute day/night cycle at 2x speed; verify dawn/dusk transitions are smooth (no stepping)
- [ ] **Poll backoff:** Start a new Claude session during maximum backoff period; verify agent appears within 10 seconds

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| ColorMatrixFilter visual regression (Pitfall 1, 8) | MEDIUM | Revert to ColorMatrixFilter; re-approach with hybrid strategy (tint for most children, filter for specific layers) |
| Async I/O race conditions (Pitfall 2) | LOW | Add error handling at each await site; fall back to sync for the detector if async introduces instability |
| Incremental parsing offset bugs (Pitfall 3) | LOW | Reset offset to 0 and re-parse from beginning; this is the safe fallback for any detected inconsistency |
| Dirty flag stepping (Pitfall 4) | LOW | Reduce threshold or remove threshold entirely (revert to per-frame updates) |
| Swap-and-pop bugs (Pitfall 5) | LOW | Revert to splice; the performance difference is negligible for arrays < 20 elements |
| Pool use-after-return (Pitfall 6) | MEDIUM | Add debug assertions; null references after return; review all pool.return() call sites |
| Combined read cache desync (Pitfall 7) | LOW | Revert to separate reads; they were working correctly before |
| Dashboard state loss (Pitfall 10) | LOW | Revert to innerHTML rebuild (it was working); apply diffing only to the content, not the structure |
| Poll backoff too aggressive (Pitfall 11) | LOW | Reduce backoff cap or remove backoff entirely; 3-second polling is already efficient |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| ColorMatrixFilter visual regression (1) | Phase 1: GPU rendering | Screenshot comparison at 5 cycle points |
| Per-container tint multiplication (8) | Phase 1: GPU rendering | Agent status colors distinguishable at all cycle points |
| Dirty flag stepping at transitions (4) | Phase 1: GPU rendering | Screen recording of full cycle at 2x speed |
| Particle throttling jerkiness (9) | Phase 1: GPU rendering | CPU measurement shows < 1ms/frame for 54 particles; don't throttle |
| Async I/O race conditions (2) | Phase 2: I/O optimization | 100 poll cycles with 3+ active sessions; no ENOENT or flickering |
| Incremental parsing offset bugs (3) | Phase 2: I/O optimization | Token totals match full-parse; truncation test passes |
| Combined read cache desync (7) | Phase 2: I/O optimization | Dashboard token counts update correctly when status changes |
| Poll backoff latency (11) | Phase 2: I/O optimization | New session detected within 10 seconds at maximum backoff |
| Swap-and-pop iteration bugs (5) | Phase 3: Medium-impact fixes | Unit test: all elements visited once in reverse loop |
| Pool use-after-return (6) | Phase 3: Medium-impact fixes | Debug assertion: no double-return; null refs after return |
| Dashboard state loss (10) | Phase 3: Medium-impact fixes | Expanded row survives 3+ data updates |

---

## Sources

- [PixiJS v8 Launch Blog -- Tint inheritance announcement](https://pixijs.com/blog/pixi-v8-launches) -- Confirmed: v8 container.tint propagates to children as multiplicative color (HIGH confidence, official blog)
- [PixiJS 8 Scene Objects Guide](https://pixijs.com/8.x/guides/components/scene-objects) -- Tint is inherited by child objects unless they specify their own (HIGH confidence, official docs)
- [PixiJS Container Discussion #7765](https://github.com/pixijs/pixijs/discussions/7765) -- Pre-v8: no native container tint; v8 added it (HIGH confidence, GitHub discussion)
- [PixiJS ColorMatrixFilter Docs](https://pixijs.download/dev/docs/filters.ColorMatrixFilter.html) -- 5x4 matrix transformation on RGBA per-pixel (HIGH confidence, official docs)
- [PixiJS Filters Overview](https://pixijs.download/release/docs/filters.html) -- Filters should be used somewhat sparingly; can slow performance (HIGH confidence, official docs)
- [Game Programming Patterns -- Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html) -- If you miss setting the dirty flag, your program will use stale derived data (HIGH confidence, established reference)
- [Node.js fs API Documentation](https://nodejs.org/api/fs.html) -- Promise APIs not synchronized or threadsafe; concurrent modifications may corrupt data (HIGH confidence, official docs)
- [Elastic Filebeat -- Log Rotation Data Loss](https://www.elastic.co/guide/en/beats/filebeat/current/file-log-rotation.html) -- Offset tracking across truncation and rotation (HIGH confidence, production documentation)
- [Swap-and-Pop vs Splice Performance](https://tomoharutsutsumi.medium.com/instead-of-splice-use-swap-and-pop-javascript-22103d90bf5c) -- O(1) vs O(n) removal, destroys ordering (MEDIUM confidence, community article)
- [melonJS Performance Issue #192](https://github.com/melonjs/melonJS/issues/192) -- Array.splice is REALLY slow in game loops (MEDIUM confidence, game engine issue)
- Direct codebase analysis of Agent World src/ -- world.ts, day-night-cycle.ts, session-detector.ts, usage-aggregator.ts, jsonl-reader.ts, ambient-particles.ts, building.ts, graphics-pool.ts, agent.ts, game-loop.ts, dashboard-panel.ts (HIGH confidence, primary source)

---
*Pitfalls research for: Agent World v2.2 -- Performance Optimization (GPU rendering, async I/O, incremental parsing, dirty flags, object pooling, DOM diffing)*
*Researched: 2026-03-18*
