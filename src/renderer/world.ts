import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { SessionInfo, ActivityType, SessionStatus } from '../shared/types';
import {
  BACKGROUND_COLOR,
  STATUS_DEBOUNCE_MS,
  CAMPFIRE_POS,
  CAMPFIRE_SIZE,
  QUEST_ZONE_POSITIONS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ACTIVITY_BUILDING,
  BUILDING_HEIGHT,
  IDLE_TIMEOUT_MS,
  IDLE_REMINDER_MS,
  WAITING_REMINDER_MS,
  REMINDER_THROTTLE_MS,
  AMBIENT_AGENT_COUNT,
  AMBIENT_AGENT_IDS,
  hashSessionId,
  FPS_IDLE,
} from '../shared/constants';
import type { BuildingType } from '../shared/constants';
import { Agent } from './agent';
import { AgentFactory } from './agent-factory';
import { Building } from './building';
import { buildingTextures, campfireTexture } from './asset-loader';
import { SpeechBubble } from './speech-bubble';
import { buildWorldTilemap } from './tilemap-builder';
import { buildSceneryLayer } from './scenery-layer';
import { AmbientParticles } from './ambient-particles';
import { SoundManager } from './sound-manager';
import { DayNightCycle } from './day-night-cycle';
import { buildNightGlowLayer, updateNightGlowLayer } from './night-glow-layer';
import { destroyCachedTextures } from './palette-swap';

/**
 * Prune entries from a Map<string, number> where the value (timestamp)
 * is older than maxAgeMs relative to `now`.
 * Returns the count of pruned entries.
 * Exported for unit testing (collection-pruning.test.ts).
 */
export function pruneByAge(map: Map<string, number>, maxAgeMs: number, now: number): number {
  let pruned = 0;
  for (const [key, timestamp] of map) {
    if (now - timestamp > maxAgeMs) {
      map.delete(key);
      pruned++;
    }
  }
  return pruned;
}

/** Per-agent status debounce tracking to prevent jittery visual flickering. */
interface StatusDebounce {
  /** The raw status we're waiting to commit. */
  pendingStatus: SessionStatus;
  /** Milliseconds the pending status has been stable. */
  timer: number;
  /** The last committed (visual) status. */
  committedStatus: SessionStatus;
}

/** Consolidated per-agent tracking state. Replaces 14 separate Maps/Sets. */
interface AgentTrackingState {
  speechBubble: SpeechBubble;
  lastActivity: ActivityType | undefined;
  statusDebounce: StatusDebounce;
  lastCommittedStatus: SessionStatus;
  lastRawStatus: SessionStatus;
  lastEntryType: string | undefined;
  building: Building | undefined;
  idleTimer: number;
  hasPlayedReminder: boolean;
  waitingTimer: number;
  hasPlayedWaitingReminder: boolean;
  spotIndex: number;
  isInBuilding: boolean;
  lastTickState: string | undefined;
}

/**
 * World -- PixiJS Application composing tilemap ground, static buildings,
 * agents, vehicles, speech bubbles into a living fantasy RPG world.
 *
 * Scene hierarchy:
 *   app.stage [no filter, no tint -- clean pass-through]
 *   +-- worldContainer [Container.tint = day/night hex -- all children inherit]
 *       +-- tilemapLayer (canvas-rendered grass + dirt star-pattern paths + pond)
 *       +-- buildingsContainer (campfire waypoint + 4 quest zone buildings in 2x2 grid)
 *       +-- sceneryLayer (trees, bushes, flowers, village props, fences, lanterns, torches)
 *       +-- nightGlowLayer (soft glow halos at lanterns, torches, windows, campfire)
 *       +-- ambientParticles (floating firefly particles)
 *       +-- agentsContainer (dynamic Agent children)
 */
export class World {
  private app!: Application;

  // Scene containers (z-order: tilemap, buildings, scenery, night glow, ambient particles, agents)
  private tilemapLayer!: Container;
  private campfire!: Sprite;
  private buildingsContainer!: Container;
  private sceneryLayer!: Container;
  private nightGlowLayer!: Container;
  private nightGlows: { gfx: Graphics; maxAlpha: number }[] = [];
  private ambientParticles!: AmbientParticles;
  private agentsContainer!: Container;

  // Day/night cycle (Phase 22) -- worldContainer receives tint; lastTintHex gates updates
  private dayNightCycle: DayNightCycle = new DayNightCycle();
  private worldContainer!: Container;
  private lastTintHex = 0xFFFFFF;
  private lastGlowIntensity = -1; // Force first update

  // Ambient idle agents (always at campfire, decorative)
  private ambientAgents: Agent[] = [];

  // State tracking
  private agents: Map<string, Agent> = new Map();
  private questZones: Map<ActivityType, Building> = new Map();
  private agentFactory: AgentFactory = new AgentFactory();

  // Consolidated per-agent tracking state (replaces 14 separate Maps/Sets)
  private agentStates: Map<string, AgentTrackingState> = new Map();

  // Project-to-building assignment (max 4 active projects)
  private projectToBuilding: Map<string, Building> = new Map();
  private buildingSlots: Building[] = []; // ordered quest zone buildings for slot assignment

  // Dismissed sessions -- prevents resurrection from stale IPC data after fade-out removal
  // Map<sessionId, dismissalTimestamp> for age-based pruning
  private dismissedSessions: Map<string, number> = new Map();

  // Periodic pruning timer for dismissedSessions
  private pruneTimer = 0;
  private static readonly PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly DISMISS_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

  // Global throttle: timestamp of last reminder sound play (any session), prevents sound stacking
  private lastReminderPlayTime = 0;

  // Track the current tool label per building (for change detection)
  private buildingToolName: Map<Building, string> = new Map();

  // Dirty flag: building highlights only recompute when agent occupancy changes
  private highlightsDirty = true; // true initially to force first computation

  // Reusable set for highlight computation (avoids per-tick allocation)
  private activeBuildings: Set<Building> = new Set();

  // Reusable buffer for deferred agent removal (avoids per-tick allocation)
  private toRemoveBuffer: string[] = [];

  // Throttle visibility warnings to once per second per agent (TICK-02)
  private warnThrottleMap: Map<string, number> = new Map();

  // Layout
  private centerX = 0;
  private centerY = 0;

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: BACKGROUND_COLOR,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      roundPixels: true,  // Prevents sub-pixel gaps between tiles
    });

    container.appendChild(this.app.canvas);

    // World container: all scene children are added here instead of app.stage.
    // Day/night tint is applied to this container; children inherit it multiplicatively.
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Tilemap ground layer
    this.tilemapLayer = new Container();
    this.tilemapLayer.eventMode = 'none';
    this.tilemapLayer.interactiveChildren = false;
    this.worldContainer.addChild(this.tilemapLayer);

    const tilemap = buildWorldTilemap(
      CAMPFIRE_POS,
      Object.values(QUEST_ZONE_POSITIONS),
    );
    this.tilemapLayer.addChild(tilemap);
    // Cache tilemap as single GPU texture -- this layer never changes after init
    this.tilemapLayer.cacheAsTexture({ antialias: false });

    // Buildings container (campfire + 4 quest zone buildings in 2x2 grid)
    this.buildingsContainer = new Container();
    this.worldContainer.addChild(this.buildingsContainer);

    // Position center for campfire
    this.centerX = WORLD_WIDTH / 2;
    this.centerY = WORLD_HEIGHT / 2;

    // Create campfire sprite at world center (small waypoint, not a full building)
    this.campfire = new Sprite(campfireTexture['campfire']);
    this.campfire.anchor.set(0.5, 0.5);
    this.campfire.position.set(CAMPFIRE_POS.x, CAMPFIRE_POS.y);
    this.buildingsContainer.addChild(this.campfire);

    // Create 4 quest zone buildings at 2x2 grid positions
    // Buildings use anchor (0.5, 1.0) so position bottom-center at quadrant bottom-center
    for (const [activityType, pos] of Object.entries(QUEST_ZONE_POSITIONS)) {
      const buildingType: BuildingType = ACTIVITY_BUILDING[activityType as ActivityType];
      const building = new Building(buildingType, buildingTextures[buildingType]);
      // Building anchor is (0.5, 1.0) -- bottom-center. Position so the building
      // is visually centered in its quadrant by placing bottom-center at the
      // quadrant center offset down by half the building height.
      building.position.set(pos.x, pos.y + BUILDING_HEIGHT / 2);
      this.buildingsContainer.addChild(building);
      this.questZones.set(activityType as ActivityType, building);
    }

    // Populate building slots in stable order for project assignment
    const slotOrder: ActivityType[] = ['coding', 'testing', 'reading', 'comms'];
    for (const activity of slotOrder) {
      const slotBuilding = this.questZones.get(activity);
      if (slotBuilding) this.buildingSlots.push(slotBuilding);
    }

    // Scenery layer: trees, props, lanterns placed between buildings (Phase 20)
    this.sceneryLayer = buildSceneryLayer();
    this.worldContainer.addChild(this.sceneryLayer);
    // Cache scenery as single GPU texture -- trees, props, fences never change after init
    this.sceneryLayer.cacheAsTexture({ antialias: false });

    // Night glow layer: soft halos at light sources, visible at night (Phase 22)
    const glowResult = buildNightGlowLayer();
    this.nightGlowLayer = glowResult.container;
    this.nightGlows = glowResult.glows;
    this.worldContainer.addChild(this.nightGlowLayer);

    // Ambient floating particles (between night glow and agents in z-order)
    this.ambientParticles = new AmbientParticles();
    this.worldContainer.addChild(this.ambientParticles);

    this.agentsContainer = new Container();
    this.worldContainer.addChild(this.agentsContainer);

    // Spawn ambient idle agents at campfire (decorative, always visible)
    for (const ambientId of AMBIENT_AGENT_IDS) {
      const slot = this.agentFactory.getSlot(ambientId);
      const agent = new Agent(ambientId, slot);
      const spacing = 30;
      const index = AMBIENT_AGENT_IDS.indexOf(ambientId);
      const totalWidth = (AMBIENT_AGENT_COUNT - 1) * spacing;
      const startX = CAMPFIRE_POS.x - totalWidth / 2;
      agent.x = startX + index * spacing;
      agent.y = CAMPFIRE_POS.y + CAMPFIRE_SIZE / 2 + 10;
      agent.setHQPosition({ x: agent.x, y: agent.y });
      agent.applyStatusVisuals('idle');
      this.agentsContainer.addChild(agent);
      this.ambientAgents.push(agent);
    }

  }

  /**
   * Core logic -- called on every IPC session update.
   * Groups sessions by project, creates/updates/transitions agents.
   * Buildings are static -- no compound lifecycle management needed.
   */
  updateSessions(sessions: SessionInfo[]): void {
    // a. Group sessions by projectName (still needed for agent management)
    const projectSessions = new Map<string, SessionInfo[]>();
    for (const s of sessions) {
      const list = projectSessions.get(s.projectName) ?? [];
      list.push(s);
      projectSessions.set(s.projectName, list);
    }

    // b. Manage agents -- create/update/transition (no compound lifecycle)
    this.manageAgents(sessions, projectSessions);
  }

  /**
   * Tick all agents and speech bubbles.
   * Buildings are always visible at alpha 1.0 -- no fade transitions needed.
   */
  tick(deltaMs: number): void {
    // Advance day/night cycle and update lighting
    this.dayNightCycle.tick(deltaMs);
    const nightIntensity = this.dayNightCycle.getNightIntensity();
    const isIdle = this.app.ticker.maxFPS <= FPS_IDLE;

    // Update day/night tint only when hex value actually changes (~98.5% skip rate)
    const tintHex = this.dayNightCycle.getTintHex();
    if (tintHex !== this.lastTintHex) {
      this.worldContainer.tint = tintHex;
      this.lastTintHex = tintHex;
    }

    // Only update glow alphas when intensity meaningfully changes (~0.005 threshold)
    if (Math.abs(nightIntensity - this.lastGlowIntensity) >= 0.005) {
      updateNightGlowLayer(this.nightGlows, nightIntensity);
      this.lastGlowIntensity = nightIntensity;
    }

    // Tick ambient agents (idle animation at campfire)
    for (const ambient of this.ambientAgents) {
      if (ambient.visible) {
        ambient.tick(deltaMs);
      }
    }

    // Tick agents (state machine + animation) and advance status debouncing
    for (const agent of this.agents.values()) {
      agent.tick(deltaMs);

      const state = this.agentStates.get(agent.sessionId);
      if (!state) continue;

      // Reparent only when agent state actually changes (not every frame)
      const currentState = agent.getState();
      if (currentState !== state.lastTickState) {
        this.handleAgentReparenting(agent);
        state.lastTickState = currentState;
      }

      // Capture previous committed status before debounce may update it
      const prevCommitted = state.lastCommittedStatus;

      // Advance status debounce and check for committed changes
      const newStatus = this.advanceStatusDebounce(agent.sessionId, deltaMs);
      if (newStatus !== null) {
        agent.applyStatusVisuals(newStatus);

        // Check for completion (active → waiting transition)
        const isCompletion = this.checkForCompletion(agent.sessionId, newStatus, prevCommitted);
        if (isCompletion) {
          const agentState = agent.getState();
          if (agentState !== 'celebrating' && agentState !== 'fading_out') {
            // Release station before celebration (agent will walk back to campfire)
            const celebBuilding = state.building;
            if (celebBuilding) {
              celebBuilding.releaseStation(agent.sessionId);
            }
            agent.startCelebration();
            this.highlightsDirty = true;
            SoundManager.getInstance().play();
          }
        }
      }

      // Idle timeout: track continuous idle duration, play reminder, trigger fade-out
      const committed = state.lastCommittedStatus;
      if (committed === 'idle' && agent.getState() !== 'fading_out') {
        const next = state.idleTimer + deltaMs;
        state.idleTimer = next;

        // Play reminder sound once after 1 minute of continuous idle (with global throttle)
        if (next >= IDLE_REMINDER_MS && !state.hasPlayedReminder) {
          const now = performance.now();
          if (now - this.lastReminderPlayTime >= REMINDER_THROTTLE_MS) {
            SoundManager.getInstance().playReminder();
            this.lastReminderPlayTime = now;
          }
          state.hasPlayedReminder = true;
        }

        if (next >= IDLE_TIMEOUT_MS) {
          agent.startFadeOut();
          this.highlightsDirty = true;
          state.idleTimer = 0;
          state.hasPlayedReminder = false;
        }
      } else {
        // Not idle or already fading -- reset timer and reminder flag
        state.idleTimer = 0;
        state.hasPlayedReminder = false;
      }

      // Waiting reminder: per-session timer for "ready to work" audio nudge (AUDIO-04/05/06/07)
      // Unlike idle timer (which triggers fadeout), waiting timer only plays a sound.
      // Fires from 'waiting' status, NOT 'idle'. Throttled globally so sounds never stack.
      if (committed === 'waiting' && agent.getState() !== 'fading_out') {
        const wNext = state.waitingTimer + deltaMs;
        state.waitingTimer = wNext;

        // Play reminder once after WAITING_REMINDER_MS, with global throttle
        if (wNext >= WAITING_REMINDER_MS && !state.hasPlayedWaitingReminder) {
          const now = performance.now();
          if (now - this.lastReminderPlayTime >= REMINDER_THROTTLE_MS) {
            SoundManager.getInstance().playReminder();
            this.lastReminderPlayTime = now;
          }
          // Mark as played regardless of throttle -- this session's reminder is "consumed"
          // It won't retry; the next session's timer will fire its own reminder after the throttle gap
          state.hasPlayedWaitingReminder = true;
        }
      } else if (committed === 'active') {
        // Active-cycle reset: clear waiting timer and reminder flag when session goes active
        // This allows the reminder to fire again if the session returns to waiting (AUDIO-07)
        state.waitingTimer = 0;
        state.hasPlayedWaitingReminder = false;
      } else {
        // Any other status (idle, error, fading) -- just reset the waiting timer
        // Do NOT clear hasPlayedWaitingReminder here -- only 'active' clears the flag (AUDIO-07)
        state.waitingTimer = 0;
      }

      // Visibility safeguard: warn if any non-fading agent has alpha < 0.4
      // This catches bugs where alpha leaks from breathing or other effects
      if (agent.getState() !== 'fading_out' && agent.alpha < 0.4) {
        const now = Date.now();
        const lastWarn = this.warnThrottleMap.get(agent.sessionId) ?? 0;
        if (now - lastWarn >= 1000) {
          console.warn(`[world] Visibility warning: agent ${agent.sessionId} has alpha ${agent.alpha.toFixed(2)} in state ${agent.getState()}`);
          this.warnThrottleMap.set(agent.sessionId, now);
        }
        agent.alpha = 1; // Force-fix always runs regardless of throttle
      }
    }

    // Deferred removal of fully faded agents (reuse buffer to avoid per-tick allocation)
    this.toRemoveBuffer.length = 0;
    for (const agent of this.agents.values()) {
      if (agent.isFadedOut()) {
        this.toRemoveBuffer.push(agent.sessionId);
      }
    }
    for (const sessionId of this.toRemoveBuffer) {
      this.removeAgent(sessionId);
    }

    // Tick building smoke particles (Phase 20, night-modulated Phase 22)
    for (const building of this.questZones.values()) {
      building.tick(deltaMs, nightIntensity, isIdle);
    }

    // Tick ambient particles (night-modulated Phase 22)
    this.ambientParticles.tick(deltaMs, nightIntensity, isIdle);

    // Tick speech bubbles (skip for fading agents)
    for (const [sessionId, agentState] of this.agentStates) {
      const agent = this.agents.get(sessionId);
      if (agent && agent.getState() === 'fading_out') {
        agentState.speechBubble.visible = false;
        continue;
      }
      agentState.speechBubble.tick(deltaMs);
    }

    // Periodically prune stale dismissed session entries
    this.pruneDismissedSessions(deltaMs);

    // Quest zone active highlights -- only recompute when occupancy changes (dirty flag)
    if (this.highlightsDirty) {
      this.activeBuildings.clear();
      for (const agent of this.agents.values()) {
        const agentState = agent.getState();
        if (agentState === 'working' || agentState === 'walking_to_workspot') {
          const building = this.agentStates.get(agent.sessionId)?.building;
          if (building) {
            this.activeBuildings.add(building);
          }
        }
      }
      for (const building of this.questZones.values()) {
        building.tint = this.activeBuildings.has(building) ? 0xFFDD88 : 0xFFFFFF;
      }
      this.highlightsDirty = false;
    }
  }

  getApp(): Application {
    return this.app;
  }

  resize(): void {
    // Window is now fixed 1024x768 -- resize is a no-op
    // Keep method signature for GameLoop/index.ts compatibility
  }

  /**
   * Returns true if any agent has an active animation that needs smooth frame rate.
   * Used by GameLoop to keep 30fps during celebrations, walking, and fade-out
   * even when all sessions report idle status.
   */
  hasActiveAnimations(): boolean {
    for (const agent of this.agents.values()) {
      const state = agent.getState();
      if (state === 'celebrating' || state === 'walking_to_building' ||
          state === 'walking_to_workspot' || state === 'fading_out' ||
          state === 'working') {
        // 'working' included because interior wander behavior is an active animation
        return true;
      }
    }
    return false;
  }

  destroy(): void {
    this.app.destroy(true);
  }

  // --- Private: Collection Pruning ---

  /**
   * Periodically prune stale entries from dismissedSessions.
   * Entries older than 30 minutes are removed to prevent unbounded growth.
   */
  private pruneDismissedSessions(deltaMs: number): void {
    this.pruneTimer += deltaMs;
    if (this.pruneTimer < World.PRUNE_INTERVAL_MS) return;
    this.pruneTimer = 0;
    pruneByAge(this.dismissedSessions, World.DISMISS_MAX_AGE_MS, Date.now());
  }

  // --- Private: Agent Removal ---

  /**
   * Remove an agent completely: scene graph, PixiJS destroy, all tracking Maps, factory slot.
   * Single cleanup method to prevent memory leaks from incomplete removal.
   */
  private removeAgent(sessionId: string): void {
    const agent = this.agents.get(sessionId);
    if (!agent) return;

    const state = this.agentStates.get(sessionId);

    // Release building station if assigned
    const building = state?.building;
    if (building) {
      building.releaseStation(sessionId);
    }

    // Remove from whichever container the agent is in (building agentsLayer or global agentsContainer)
    if (state?.isInBuilding && building) {
      building.getAgentsLayer().removeChild(agent);
    } else {
      this.agentsContainer.removeChild(agent);
    }

    // Save characterClass and paletteIndex BEFORE destroy invalidates the object
    const savedClass = agent.characterClass;
    const savedPaletteIndex = agent.paletteIndex;

    // Destroy PixiJS container + all children (AnimatedSprite, SpeechBubble)
    agent.destroy({ children: true });

    // Clean up palette swap textures if no other active agent shares the same class+palette combo.
    // Deferred to next frame via setTimeout(0) to avoid destroying textures that PixiJS
    // may still reference during the current render pass (causes null style crash in GlTextureSystem).
    let shouldCleanup = true;
    for (const a of this.agents.values()) {
      if (a !== agent && a.characterClass === savedClass && a.paletteIndex === savedPaletteIndex) {
        shouldCleanup = false;
        break;
      }
    }
    if (shouldCleanup) {
      setTimeout(() => destroyCachedTextures(savedClass, savedPaletteIndex), 0);
    }

    // Clean ALL tracking -- single delete replaces 14 individual deletes
    this.agents.delete(sessionId);
    this.agentStates.delete(sessionId);
    this.warnThrottleMap.delete(sessionId);

    // Release factory slot
    this.agentFactory.releaseSlot(sessionId);

    // Prevent resurrection from stale IPC data (timestamp for age-based pruning)
    this.dismissedSessions.set(sessionId, Date.now());

    // Agent removed -- recompute building highlights
    this.highlightsDirty = true;
  }

  // --- Private: Agent Management ---

  /**
   * Create, update, and transition agents based on session data.
   * Routes agents to buildings by project name -- same project always goes to same building.
   */
  private manageAgents(
    sessions: SessionInfo[],
    _projectSessions: Map<string, SessionInfo[]>,
  ): void {
    const currentIds = new Set<string>();

    for (const session of sessions) {
      currentIds.add(session.sessionId);

      // Skip dismissed sessions -- prevents resurrection from stale IPC data
      if (this.dismissedSessions.has(session.sessionId)) {
        // Clear dismissal if session shows any non-idle activity.
        // Status can be 'active' OR 'waiting' (between turns) for a valid session.
        if (session.status !== 'idle') {
          this.dismissedSessions.delete(session.sessionId);
          // Fall through to normal agent creation below
        } else {
          continue; // Still idle, keep dismissed
        }
      }

      let agent = this.agents.get(session.sessionId);

      if (!agent) {
        // Create new agent
        const slot = this.agentFactory.getSlot(session.sessionId);
        agent = new Agent(session.sessionId, slot);
        // Start at campfire (not 0,0) so agents don't walk from the corner
        const spawnPos = { x: this.campfire.x, y: this.campfire.y + CAMPFIRE_SIZE / 2 + 10 };
        agent.x = spawnPos.x;
        agent.y = spawnPos.y;
        agent.setHQPosition(spawnPos); // Initialize hqPosition so celebration walk-back targets campfire, not (0,0)
        this.agents.set(session.sessionId, agent);
        this.agentsContainer.addChild(agent);

        // Create speech bubble for the agent
        const bubble = new SpeechBubble();
        agent.addChild(bubble);

        // Initialize consolidated tracking state
        this.agentStates.set(session.sessionId, {
          speechBubble: bubble,
          lastActivity: undefined,
          statusDebounce: {
            pendingStatus: session.status,
            timer: 0,
            committedStatus: session.status,
          },
          lastCommittedStatus: session.status,
          lastRawStatus: session.status,
          lastEntryType: undefined,
          building: undefined,
          idleTimer: 0,
          hasPlayedReminder: false,
          waitingTimer: 0,
          hasPlayedWaitingReminder: false,
          spotIndex: 0,
          isInBuilding: false,
          lastTickState: undefined,
        });

        // Apply initial visual status immediately (no debounce needed for first)
        agent.applyStatusVisuals(session.status);
      }

      // Get consolidated state for this agent (guaranteed to exist after creation block)
      const state = this.agentStates.get(session.sessionId)!;

      // Store raw status for tick-based debounce advancement
      state.lastRawStatus = session.status;

      // Store entry type for completion detection validation
      state.lastEntryType = session.lastEntryType;

      // Route agent to building based on project name
      const activityType = session.activityType;

      // Handle fading agents: cancel idle-timeout fades on reactivation, skip session-gone fades
      if (agent.getState() === 'fading_out') {
        if (session.activityType !== 'idle' || session.status !== 'idle') {
          agent.cancelFadeOut();
          this.highlightsDirty = true;
          // Reinitialize debounce state for clean reactivation
          state.statusDebounce = {
            pendingStatus: session.status,
            timer: 0,
            committedStatus: session.status,
          };
          state.lastCommittedStatus = session.status;
          state.lastRawStatus = session.status;
          // Apply visual status immediately (bypass debounce for reactivation)
          agent.applyStatusVisuals(session.status);
          // Fall through to routing with fresh state
        } else {
          continue; // Still idle, let fade-out proceed
        }
      }

      const agentState = agent.getState();

      if (activityType !== 'idle') {
        const building = this.getProjectBuilding(session.projectName);
        if (building) {
          if (agentState === 'idle_at_hq') {
            // Assign station via building's station manager
            const stationIndex = building.assignStation(session.sessionId);
            state.spotIndex = stationIndex;
            // Enable interior mode (1.5x scale)
            agent.setInteriorMode(true);
            // Agent at campfire, needs to go work -- send to project building
            // Walk from campfire to building entrance in GLOBAL coordinates (agent is still in agentsContainer)
            const entrance = this.getBuildingEntrance(building);
            const workPos = this.getBuildingWorkPosition(building, session.sessionId);
            agent.assignToCompound(entrance, workPos);
            state.building = building;
            this.highlightsDirty = true;
            // BUBBLE-03: Show speech bubble on initial departure from campfire
            state.speechBubble.show(activityType);
          } else if (agentState === 'working') {
            // Check for tool change (lastToolName change triggers station switch)
            const prevActivity = state.lastActivity;
            if (prevActivity && prevActivity !== activityType) {
              // BUBBLE-03: Show speech bubble on activity change at same building
              state.speechBubble.show(activityType);

              // Reassign to a new station (different from current if possible)
              const newStationIndex = building.reassignStation(session.sessionId);
              state.spotIndex = newStationIndex;
              const newWorkPos = building.getWorkSpot(newStationIndex);
              agent.updateActivity(newWorkPos);
            }
          }
        } else {
          // 5th+ project overflow: stay at campfire
          if (agentState !== 'idle_at_hq' && agentState !== 'walking_to_building') {
            // Reparent agent out of building if inside one
            this.reparentAgentOut(session.sessionId);
            const prevBuilding = state.building;
            if (prevBuilding) prevBuilding.releaseStation(session.sessionId);
            const idlePos = this.getCampfireIdlePosition(session.sessionId);
            agent.assignToHQ(idlePos);
            state.building = undefined;
            this.highlightsDirty = true;
          }
        }
      } else {
        // Activity is idle -- agent should be at campfire
        if (
          agentState !== 'idle_at_hq' &&
          agentState !== 'walking_to_building' &&
          agentState !== 'celebrating'
        ) {
          // Reparent agent out of building if inside one
          this.reparentAgentOut(session.sessionId);
          const prevBuilding = state.building;
          if (prevBuilding) prevBuilding.releaseStation(session.sessionId);
          const idlePos = this.getCampfireIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
          state.building = undefined;
          this.highlightsDirty = true;
        }
      }

      // Track activity
      state.lastActivity = session.activityType;
    }

    // Update tool name overlays on each active building
    this.updateToolLabels(sessions);

    // Release building slots for projects with no active sessions
    this.releaseInactiveProjectSlots(sessions);

    // Trigger fade-out for agents whose sessions have disappeared from IPC
    for (const [sessionId, agent] of this.agents) {
      if (!currentIds.has(sessionId) && agent.getState() !== 'fading_out') {
        // Reparent out of building before fading so agent is in the correct
        // scene graph container for removal and fades at the right screen position
        this.reparentAgentOut(sessionId);
        const fadingState = this.agentStates.get(sessionId);
        const building = fadingState?.building;
        if (building) building.releaseStation(sessionId);
        agent.startFadeOut();
        this.highlightsDirty = true;
      }
    }

    // Clean up tracking state for removed sessions (partial cleanup -- agent still fading)
    for (const [sessionId] of this.agentStates) {
      if (!currentIds.has(sessionId)) {
        const cleanState = this.agentStates.get(sessionId)!;
        // Reset fields that were individually deleted in the original code
        // (statusDebounce, lastCommittedStatus, lastRawStatus, lastEntryType,
        //  building, idleTimers, spotIndex, hasPlayedReminder,
        //  waitingTimers, hasPlayedWaitingReminder, isInBuilding, lastTickState)
        cleanState.statusDebounce = { pendingStatus: 'idle', timer: 0, committedStatus: 'idle' };
        cleanState.lastCommittedStatus = 'idle';
        cleanState.lastRawStatus = 'idle';
        cleanState.lastEntryType = undefined;
        cleanState.building = undefined;
        cleanState.idleTimer = 0;
        cleanState.spotIndex = 0;
        cleanState.hasPlayedReminder = false;
        cleanState.waitingTimer = 0;
        cleanState.hasPlayedWaitingReminder = false;
        cleanState.isInBuilding = false;
        cleanState.lastTickState = undefined;
        // NOTE: speechBubble and lastActivity are NOT reset here (matches original behavior)
      }
    }

    // Hide ambient agents when many real agents are present to avoid clutter
    const hideAmbient = this.agents.size >= 4;
    for (const ambient of this.ambientAgents) {
      ambient.visible = !hideAmbient;
    }

    // Reposition idle agents at campfire
    this.repositionIdleAgents();
  }

  /**
   * Reposition all idle agents around the campfire.
   * Fans agents horizontally below the campfire sprite.
   */
  private repositionIdleAgents(): void {
    const idleAgents: Agent[] = [];
    // Include visible ambient agents in the fan layout
    for (const ambient of this.ambientAgents) {
      if (ambient.visible) {
        idleAgents.push(ambient);
      }
    }
    // Include real idle agents
    for (const agent of this.agents.values()) {
      if (agent.getState() === 'idle_at_hq') {
        idleAgents.push(agent);
      }
    }

    const spacing = 30;
    const baseY = this.campfire.y + CAMPFIRE_SIZE / 2 + 10;
    for (let i = 0; i < idleAgents.length; i++) {
      const totalWidth = (idleAgents.length - 1) * spacing;
      const startX = this.campfire.x - totalWidth / 2;
      const globalPos = {
        x: startX + i * spacing,
        y: baseY,
      };
      idleAgents[i].setHQPosition(globalPos);
      // Ambient agents are always idle_at_hq; directly position them
      if (idleAgents[i].getState() === 'idle_at_hq') {
        idleAgents[i].x = globalPos.x;
        idleAgents[i].y = globalPos.y;
      }
    }
  }

  // --- Private: Status Debouncing & Completion Detection ---

  /**
   * Debounce status changes -- only commit a visual status change if the
   * new status holds for STATUS_DEBOUNCE_MS. Prevents jittery flickering.
   * Called per-agent in tick() for smooth timing.
   */
  private advanceStatusDebounce(sessionId: string, deltaMs: number): SessionStatus | null {
    const state = this.agentStates.get(sessionId);
    if (!state) return null;
    const debounce = state.statusDebounce;
    const rawStatus = state.lastRawStatus;

    if (rawStatus === debounce.committedStatus) {
      // Status unchanged from committed -- reset pending
      debounce.pendingStatus = rawStatus;
      debounce.timer = 0;
      return null; // no change
    }

    if (rawStatus === debounce.pendingStatus) {
      // Same pending status -- accumulate time
      debounce.timer += deltaMs;
      if (debounce.timer >= STATUS_DEBOUNCE_MS) {
        // Debounce threshold met -- commit the change
        debounce.committedStatus = rawStatus;
        debounce.timer = 0;
        state.lastCommittedStatus = rawStatus;
        return rawStatus; // signal: new committed status
      }
    } else {
      // Different pending status -- reset debounce
      debounce.pendingStatus = rawStatus;
      debounce.timer = 0;
    }

    return null; // no change yet
  }

  /**
   * Detect task completion: session was active, now committed to waiting,
   * AND the last JSONL entry is a 'system' type (turn_duration), confirming
   * the turn actually completed.
   *
   * The system entry check prevents false celebrations from:
   * - Brief active->waiting transitions during tool execution gaps
   * - Edge cases where status determination temporarily reports waiting
   *
   * In normal completion flow: Claude finishes -> writes system(turn_duration)
   * -> session-detector reads it -> status goes active (0-5s) then waiting (5-30s)
   * -> debounce commits waiting -> this method sees active->waiting + system entry
   * -> celebration fires correctly.
   *
   * @param prevCommitted - The committed status BEFORE advanceStatusDebounce updated it
   */
  private checkForCompletion(
    sessionId: string,
    newCommittedStatus: SessionStatus,
    prevCommitted: SessionStatus | undefined,
  ): boolean {
    if (prevCommitted !== 'active' || newCommittedStatus !== 'waiting') return false;
    // Require system entry type as definitive turn completion signal.
    // System entries (turn_duration) are ONLY written at true turn boundaries.
    const entryType = this.agentStates.get(sessionId)?.lastEntryType;
    return entryType === 'system';
  }

  // --- Private: Project-to-Building Assignment ---

  /**
   * Get the building assigned to a project, assigning a new slot if needed.
   * Returns null if all 4 slots are full (project overflows to Guild Hall).
   */
  private getProjectBuilding(projectName: string): Building | null {
    const existing = this.projectToBuilding.get(projectName);
    if (existing) return existing;

    // Find first unoccupied slot
    const occupiedBuildings = new Set(this.projectToBuilding.values());
    for (const building of this.buildingSlots) {
      if (!occupiedBuildings.has(building)) {
        this.projectToBuilding.set(projectName, building);
        building.setLabel(projectName);
        return building;
      }
    }

    // All 4 slots full -- overflow to campfire
    return null;
  }

  /**
   * Release building slots for projects with no active (non-idle) sessions.
   * Reverts building labels to RPG names. Called after processing all sessions.
   */
  private releaseInactiveProjectSlots(sessions: SessionInfo[]): void {
    const activeProjects = new Set<string>();
    for (const s of sessions) {
      if (s.activityType !== 'idle') {
        activeProjects.add(s.projectName);
      }
    }

    for (const [projectName, building] of this.projectToBuilding) {
      if (!activeProjects.has(projectName)) {
        building.resetLabel();
        building.hideToolLabel();
        this.buildingToolName.delete(building);
        this.projectToBuilding.delete(projectName);
      }
    }
  }

  // --- Private: Tool Label Updates ---

  /**
   * Update tool name overlays on each building based on active sessions.
   * Shows the most recent tool name from the most recently modified session in each building.
   */
  private updateToolLabels(sessions: SessionInfo[]): void {
    // Build a map of building -> most recent tool name
    const buildingBestTool: Map<Building, { toolName: string; lastModified: number }> = new Map();

    for (const session of sessions) {
      if (session.activityType === 'idle' || !session.lastToolName) continue;

      const building = this.projectToBuilding.get(session.projectName);
      if (!building) continue;

      const existing = buildingBestTool.get(building);
      if (!existing || session.lastModified > existing.lastModified) {
        buildingBestTool.set(building, {
          toolName: session.lastToolName,
          lastModified: session.lastModified,
        });
      }
    }

    // Apply labels: show for buildings with active tools, hide for all others
    for (const building of this.questZones.values()) {
      const best = buildingBestTool.get(building);
      if (best) {
        const prev = this.buildingToolName.get(building);
        if (prev !== best.toolName) {
          building.setToolLabel(best.toolName);
          this.buildingToolName.set(building, best.toolName);
        }
      } else {
        if (this.buildingToolName.has(building)) {
          building.hideToolLabel();
          this.buildingToolName.delete(building);
        }
      }
    }
  }

  // --- Private: Agent Reparenting ---

  /**
   * Handle reparenting agents between the global agentsContainer and building interior.
   * When agent transitions to walking_to_workspot (arrived at entrance), reparent INTO building.
   * When agent leaves building (going to HQ, celebrating, fading), reparent OUT of building.
   */
  private handleAgentReparenting(agent: Agent): void {
    const sessionId = agent.sessionId;
    const agentState = agent.getState();
    const trackingState = this.agentStates.get(sessionId);
    if (!trackingState) return;
    const isInBuilding = trackingState.isInBuilding;
    const building = trackingState.building;

    if ((agentState === 'walking_to_workspot' || agentState === 'working') && !isInBuilding && building) {
      // Reparent INTO building: convert global position to building-local
      this.agentsContainer.removeChild(agent);
      building.getAgentsLayer().addChild(agent);

      // Convert global coords to building-local coords
      agent.x = agent.x - building.x;
      agent.y = agent.y - building.y;

      // Update workspot target to local coordinates
      const localSpot = building.getWorkSpot(trackingState.spotIndex);
      agent.updateActivity(localSpot);

      trackingState.isInBuilding = true;
    } else if (
      (agentState === 'walking_to_building' || agentState === 'idle_at_hq' || agentState === 'celebrating' || agentState === 'fading_out') &&
      isInBuilding && building
    ) {
      // Reparent OUT of building: convert building-local position to global
      building.getAgentsLayer().removeChild(agent);
      this.agentsContainer.addChild(agent);

      // Convert building-local coords to global coords
      agent.x = agent.x + building.x;
      agent.y = agent.y + building.y;

      trackingState.isInBuilding = false;
    }
  }

  /**
   * Reparent an agent out of a building back to agentsContainer if it's currently inside one.
   * Called explicitly when agent is leaving a building (e.g., returning to campfire).
   */
  private reparentAgentOut(sessionId: string): void {
    const trackingState = this.agentStates.get(sessionId);
    if (!trackingState?.isInBuilding) return;
    const agent = this.agents.get(sessionId);
    const building = trackingState.building;
    if (!agent || !building) return;

    building.getAgentsLayer().removeChild(agent);
    this.agentsContainer.addChild(agent);

    // Convert building-local coords to global
    agent.x = agent.x + building.x;
    agent.y = agent.y + building.y;

    trackingState.isInBuilding = false;
  }

  // --- Private: Position Helpers ---

  /**
   * Get building entrance position in global (world) coordinates.
   */
  private getBuildingEntrance(building: Building): { x: number; y: number } {
    const local = building.getEntrancePosition();
    return { x: building.x + local.x, y: building.y + local.y };
  }

  /**
   * Get building work position in global (world) coordinates.
   * Uses named work spots based on agent's current spot index.
   */
  private getBuildingWorkPosition(building: Building, sessionId: string): { x: number; y: number } {
    const spotIndex = this.agentStates.get(sessionId)?.spotIndex ?? 0;
    const local = building.getWorkSpot(spotIndex);
    return { x: building.x + local.x, y: building.y + local.y };
  }

  /**
   * Get a global idle position at the campfire for a specific agent.
   * Used when sending an agent back to the campfire waypoint.
   */
  private getCampfireIdlePosition(sessionId: string): { x: number; y: number } {
    // Count current idle agents + visible ambient agents + this one
    let idleCount = 1;
    let thisIndex = 0;
    // Count visible ambient agents (they occupy positions before real agents)
    for (const ambient of this.ambientAgents) {
      if (ambient.visible) {
        idleCount++;
        thisIndex++;
      }
    }
    for (const agent of this.agents.values()) {
      if (agent.sessionId === sessionId) continue;
      if (agent.getState() === 'idle_at_hq') {
        idleCount++;
        thisIndex++;
      }
    }
    const spacing = 30;
    const totalWidth = (idleCount - 1) * spacing;
    const startX = this.campfire.x - totalWidth / 2;
    return {
      x: startX + thisIndex * spacing,
      y: this.campfire.y + CAMPFIRE_SIZE / 2 + 10,
    };
  }
}
