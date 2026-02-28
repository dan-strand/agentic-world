# Milestones

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

