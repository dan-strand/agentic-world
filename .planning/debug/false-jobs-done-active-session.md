---
status: diagnosed
trigger: "Session 'forma' actively processing was reported as 'job's done' — showed completion while still running"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- assistant entry type with >2s mtime gap triggers false active->waiting transition
test: Full pipeline simulation with real JSONL data
expecting: Celebration at T+6s during active tool execution
next_action: Return diagnosis

## Symptoms

expected: Session actively processing should show as "active" with agent working at building
actual: Session showed "job's done" celebration (golden column + sound) while still actively processing
errors: No error — false positive completion detection
reproduction: Long-running Claude session with multi-step tool use
started: Observed during Phase 11 testing

## Eliminated

- hypothesis: Race condition in JSONL file reading (mid-write)
  evidence: jsonl-reader already handles mid-write with fallback to previous lines. The bug is in status logic, not file reading.
  timestamp: 2026-02-26

- hypothesis: system entry (turn_duration) written mid-processing
  evidence: system entries are ONLY written at true turn boundaries. Verified across multiple sessions -- system entry always follows the final assistant entry of a turn, never mid-turn.
  timestamp: 2026-02-26

- hypothesis: stale mtime causing brief idle detection
  evidence: The bug is not about idle detection -- it's about the active->waiting transition. The 30s idle threshold is not the culprit.
  timestamp: 2026-02-26

## Evidence

- timestamp: 2026-02-26
  checked: JSONL write patterns across forma, Agent World, freeflow sessions
  found: 327 occurrences of tool executions with >5s silence before result. During silence, file mtime does not update.
  implication: Any polling during this silence window will see stale mtime and make status decisions based on it.

- timestamp: 2026-02-26
  checked: Entry sequence during tool use (assistant -> [progress?] -> user pattern)
  found: For Read/Edit/Grep/Bash tools, the assistant(tool_use) entry is often the LAST entry written before a silence of up to 109s. No progress entries fill the gap.
  implication: The file's last entry type is 'assistant' and mtime ages during active tool execution.

- timestamp: 2026-02-26
  checked: determineStatus() behavior for assistant entry with timeSinceModified > 2s
  found: Returns 'waiting' after just 2 seconds for assistant entries. This is correct for a genuine end-of-turn assistant(text) response, but WRONG for assistant(tool_use) entries that are mid-turn.
  implication: The 2s threshold cannot distinguish between "assistant finished responding" and "assistant requested a tool and is waiting for result".

- timestamp: 2026-02-26
  checked: Completion detection in world.ts checkForCompletion()
  found: Triggers on active->waiting transition (line 587). Combined with 2.5s debounce, celebration fires at T+~6s after an assistant(tool_use) entry.
  implication: Every tool use that takes >6s creates a false completion event.

- timestamp: 2026-02-26
  checked: Full pipeline simulation
  found: T+0s: assistant(Read) written, status=active (timeSinceModified<2s). T+3s: raw=waiting (>2s). T+6s: debounce expires, committed becomes waiting, active->waiting transition triggers celebration. Meanwhile Claude is still actively processing the Read tool.
  implication: Bug is 100% reproducible for any tool execution lasting >6 seconds.

## Resolution

root_cause: |
  TWO interacting bugs create the false "job's done":

  BUG 1 (Primary) - session-detector.ts determineStatus() line 231:
  The `assistant` entry type maps to `waiting` after just 2 seconds. But `assistant` entries
  in JSONL contain BOTH final text responses AND mid-turn tool_use requests. The function
  cannot distinguish between:
  - "Claude finished responding with text" (genuinely waiting for user)
  - "Claude requested a tool_use and is waiting for the tool result" (actively processing)

  After an assistant(tool_use) entry, no more JSONL writes happen until the tool completes
  and writes a `user` entry with the tool result. For Read/Edit/Bash/Grep tools, this gap
  ranges from 3s to 109s+ with ZERO progress entries in between.

  BUG 2 (Enabler) - world.ts checkForCompletion() line 587:
  Completion detection fires on ANY active->waiting transition. But the active->waiting
  transition caused by Bug 1 is indistinguishable from a genuine turn completion. The
  debounce (2.5s) is far too short to filter these false positives -- a tool_use that takes
  >6s will always trigger a false celebration.

  COMBINED EFFECT: Claude writes assistant(tool_use), file goes quiet for seconds while tool
  runs, determineStatus sees assistant + >2s and returns 'waiting', debounce commits after
  2.5s, checkForCompletion detects active->waiting, celebration fires with sound + golden column.

fix:
verification:
files_changed: []
