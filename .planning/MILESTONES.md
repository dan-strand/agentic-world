# Milestones

## v2.2 Performance Optimization (Shipped: 2026-03-19)

**Phases completed:** 4 phases, 9 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v2.0 World & Character Detail (Shipped: 2026-03-03)

**Phases completed:** 3 phases, 7 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.5 Usage Dashboard (Shipped: 2026-03-01)

**Phases:** 17-19 | **Plans:** 6 | **Tasks:** 12 | **Timeline:** 1 day (2026-03-01)
**Codebase:** 7,777 LOC TypeScript/JS, 37 files changed, +6,638 / -1,000
**Git range:** `42121a6` → `1f244c6` (28 commits)

**Key accomplishments:**
1. Window expanded to 1024x1080 with flex column layout: 768px PixiJS canvas + 312px HTML dashboard panel
2. Streaming JSONL parser extracts all token usage fields (input, output, cache read, cache write) with mtime-cached aggregator and 14 tests
3. MODEL_PRICING table covering all Claude model families with 4-step resolution chain (bare alias, exact, prefix, fallback)
4. Live dashboard with compact session rows, click-to-expand token breakdowns, cost estimates (~$X.XX), and cache savings display
5. Today's aggregate totals bar (In/Out/Cost/Saved/Sessions) updated every poll cycle
6. HistoryStore with atomic JSON persistence, 30-day retention pruning, and Windows-safe writes (EPERM/EBUSY fallback)

**Delivered:** Usage dashboard below the RPG world showing live session details, token usage, cost estimates with auto-detected model pricing, and 30-day historical trends — everything needed to track Claude Code spending at a glance.

---

## v1.1 Fantasy RPG Aesthetic (Shipped: 2026-02-26)

**Phases:** 4-7 | **Plans:** 9 | **Timeline:** 2 days (2026-02-25 → 2026-02-26)
**Codebase:** 2,587 LOC TypeScript, 22 source files, 3 generator scripts

**Key accomplishments:**
1. Tilemap ground with seeded grass variation and Bresenham dirt paths connecting all locations
2. 5 Fantasy RPG buildings (Guild Hall + Wizard Tower, Training Grounds, Ancient Library, Tavern) with pngjs-generated atlas sprites
3. AnimatedSprite character agents with 4 RPG classes (mage, warrior, ranger, rogue) and walk/idle/work animations
4. Walk-only movement system replacing vehicles — 5-state machine, staggered frame offsets
5. Golden level-up celebration with light column, sparkle shower, and GlowFilter halo
6. RPG atmosphere: ambient firefly particles, warm ColorMatrixFilter tint, quest zone glow highlights

**Delivered:** Complete visual theme overhaul from spy/secret agent to Fantasy RPG — tilemap terrain, quest zone buildings, animated adventurer characters, and atmospheric effects.

---


## v1.3 Audio & Status Reliability (Shipped: 2026-02-27)

**Phases:** 11, 13 | **Plans:** 4 | **Tasks:** 8 | **Timeline:** ~4 hours (2026-02-26 → 2026-02-27)
**Codebase:** 3,269 LOC TypeScript, 4 source files modified
**Git range:** `83e3ec9` → `7ba0853` (8 source commits)

**Key accomplishments:**
1. Fixed system entry status detection — waiting sessions no longer misreported as idle, stale filter preserves active sessions
2. Hardened cancelFadeOut with full visual state reset — no more invisible agents after reactivation
3. Added tool_use content inspection preventing false "job's done" celebrations during active tool execution
4. Dual-gate completion detection requiring both status transition AND system entry confirmation (defense-in-depth)
5. Per-session waiting reminder timers with 30s global throttle and active-cycle guard preventing sound stacking

**Delivered:** Bulletproof status pipeline and audio reliability — every status transition is accurate, agents are always visible when they should be, completion celebrations only fire on real completions, and waiting reminders nudge per-session without stacking.

**Note:** Phase 12 (Jobs Done Global Signal) was removed by user decision — per-session completion sounds are preferred and already working correctly.

---


## v1.4 Enhanced Session Workspaces (Shipped: 2026-02-27)

**Phases:** 14-16 | **Plans:** 6 | **Timeline:** 1 day (2026-02-27)
**Codebase:** 6,461 LOC TypeScript/JS, 15 files modified, +1,893 net lines
**Git range:** `87a576a` → `49d7930` (22 commits)

**Key accomplishments:**
1. World restructured to 2x2 grid of 464x336 landscape buildings filling the 1024x768 screen
2. Guild Hall replaced with compact 64x64 campfire waypoint at world center with star-pattern footpaths
3. Four detailed top-down interior scenes: Wizard Tower (arcane study), Training Grounds (arena), Ancient Library (study hall), Tavern (gathering space)
4. Agents walk into building interiors and position at themed stations with wander behavior (~40px radius)
5. Tool name overlay banners display current tool on each active workspace building
6. Agent z-ordering, reparenting between global/building containers, and station management for interior/exterior transitions

**Delivered:** Workspace buildings expanded from 96x96 exteriors to 464x336 detailed interiors showing agents working at themed stations with tool info — each building is now a visual status dashboard.

---

