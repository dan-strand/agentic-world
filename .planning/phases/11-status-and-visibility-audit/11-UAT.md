---
status: diagnosed
phase: 11-status-and-visibility-audit
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md
started: 2026-02-27T00:30:00Z
updated: 2026-02-27T00:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. System entry waiting status (5-30s window)
expected: After Claude finishes a task and you wait 5-10 seconds without responding, the agent shows "waiting" status with breathing alpha effect -- not idle, not disappeared.
result: pass

### 2. Waiting session survives past 30 minutes
expected: If a Claude session has been waiting for your input for over 30 minutes (file unmodified), the agent should still be visible in the world with "waiting" status. It should NOT disappear or be filtered as stale.
result: issue
reported: "i got a 'job's done' on the forma session, though it's still processing"
severity: major

### 3. Fade cancellation restores clean visuals
expected: Let an agent go idle long enough to start fading out (alpha decreasing toward 0). Before it fully disappears, send a new message to that session. The agent should snap back to full visibility with correct appearance -- no lingering stale tint, no residual breathing effect from before the fade, clean visual state.
result: pass

### 4. Rapid status changes don't flicker
expected: During a Claude session that rapidly alternates between active (processing) and waiting (brief pauses), the agent's visual status should remain stable -- no rapid flickering of tint colors or breathing effects. The debounce ensures only the final settled status is shown.
result: pass

### 5. Reactivated agent routes to correct building
expected: If an agent was fading out at Guild Hall due to idle timeout and the session reactivates (you send a new message), the agent should route to the correct building based on its activity type (e.g., coding -> appropriate building), not stay stranded at Guild Hall.
result: pass

### 6. No invisible agents for active/waiting sessions
expected: With one or more active or waiting Claude sessions running, every session should have a visible agent on screen. No agent should be invisible (alpha near 0) unless it's actively in the fading-out process. Check the console -- there should be no "[world] Visibility warning" messages during normal operation.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "A session that is actively processing (tool execution in progress) should not trigger 'job's done' celebration"
  status: failed
  reason: "User reported: i got a 'job's done' on the forma session, though it's still processing"
  severity: major
  test: 2
  root_cause: "Two interacting bugs: (1) determineStatus() treats all assistant entries identically -- after 2s returns 'waiting' even when the entry contains a tool_use request and the tool is still executing (no JSONL writes during tool execution). (2) checkForCompletion() fires on any active->waiting transition without verifying the turn actually completed (no system/turn_duration entry check). Combined: tool executions >6s trigger false celebration."
  artifacts:
    - path: "src/main/session-detector.ts"
      issue: "assistant entry type mapped to waiting after 2s without distinguishing tool_use from final response (line 231)"
    - path: "src/renderer/world.ts"
      issue: "checkForCompletion() fires on any active->waiting transition without additional validation (line 587)"
  missing:
    - "Detect tool_use in assistant entry content and treat as active instead of waiting"
    - "Harden checkForCompletion to require system entry type (turn_duration) as definitive completion signal"
  debug_session: ".planning/debug/false-jobs-done-active-session.md"
