import { Application, Container, Graphics, Sprite, ColorMatrixFilter } from 'pixi.js';
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

/** Per-agent status debounce tracking to prevent jittery visual flickering. */
interface StatusDebounce {
  /** The raw status we're waiting to commit. */
  pendingStatus: SessionStatus;
  /** Milliseconds the pending status has been stable. */
  timer: number;
  /** The last committed (visual) status. */
  committedStatus: SessionStatus;
}

/**
 * World -- PixiJS Application composing tilemap ground, static buildings,
 * agents, vehicles, speech bubbles into a living fantasy RPG world.
 *
 * Scene hierarchy:
 *   app.stage [dynamic ColorMatrixFilter -- day/night color temperature]
 *   +-- tilemapLayer (canvas-rendered grass + dirt star-pattern paths + pond)
 *   +-- buildingsContainer (campfire waypoint + 4 quest zone buildings in 2x2 grid)
 *   +-- sceneryLayer (trees, bushes, flowers, village props, fences, lanterns, torches)
 *   +-- nightGlowLayer (soft glow halos at lanterns, torches, windows, campfire)
 *   +-- ambientParticles (floating firefly particles)
 *   +-- agentsContainer (dynamic Agent children)
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

  // Day/night cycle (Phase 22)
  private dayNightCycle: DayNightCycle = new DayNightCycle();
  private stageFilter!: ColorMatrixFilter;

  // Ambient idle agents (always at campfire, decorative)
  private ambientAgents: Agent[] = [];

  // State tracking
  private agents: Map<string, Agent> = new Map();
  private questZones: Map<ActivityType, Building> = new Map();
  private agentFactory: AgentFactory = new AgentFactory();

  // Speech bubbles managed per-agent
  private speechBubbles: Map<string, SpeechBubble> = new Map();
  // Track last known activity per agent for change detection
  private lastActivity: Map<string, ActivityType> = new Map();

  // Status debouncing (tracks raw -> committed status per agent)
  private statusDebounce: Map<string, StatusDebounce> = new Map();

  // Last committed status per agent (for active->idle completion detection)
  private lastCommittedStatus: Map<string, SessionStatus> = new Map();

  // Track last raw status received per agent (for tick-based debounce advancement)
  private lastRawStatus: Map<string, SessionStatus> = new Map();

  // Track last entry type per agent (for completion detection validation)
  private lastEntryType: Map<string, string> = new Map();

  // Project-to-building assignment (max 4 active projects)
  private projectToBuilding: Map<string, Building> = new Map();
  private buildingSlots: Building[] = []; // ordered quest zone buildings for slot assignment
  // Track which building each agent is currently assigned to (for work position and glow)
  private agentBuilding: Map<string, Building> = new Map();

  // Dismissed sessions -- prevents resurrection from stale IPC data after fade-out removal
  private dismissedSessions: Set<string> = new Set();

  // Idle timeout tracking (ms of continuous committed-idle time per agent)
  private idleTimers: Map<string, number> = new Map();

  // Track whether the idle reminder sound has already played for each agent's current idle period
  private hasPlayedReminder: Map<string, boolean> = new Map();

  // Waiting reminder tracking: per-session timer for "ready to work" nudge from waiting status
  private waitingTimers: Map<string, number> = new Map();
  // Track whether the waiting reminder has played for the current waiting period (requires active cycle to reset)
  private hasPlayedWaitingReminder: Map<string, boolean> = new Map();
  // Global throttle: timestamp of last reminder sound play (any session), prevents sound stacking
  private lastReminderPlayTime = 0;

  // Track current work spot index per agent (for spot rotation on activity change)
  private agentSpotIndex: Map<string, number> = new Map();

  // Track which agents have been reparented into building interior containers
  private agentsInBuildings: Set<string> = new Set();

  // Track the current tool label per building (for change detection)
  private buildingToolName: Map<Building, string> = new Map();

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

    // Tilemap ground layer
    this.tilemapLayer = new Container();
    this.tilemapLayer.eventMode = 'none';
    this.tilemapLayer.interactiveChildren = false;
    this.app.stage.addChild(this.tilemapLayer);

    const tilemap = buildWorldTilemap(
      CAMPFIRE_POS,
      Object.values(QUEST_ZONE_POSITIONS),
    );
    this.tilemapLayer.addChild(tilemap);

    // Buildings container (campfire + 4 quest zone buildings in 2x2 grid)
    this.buildingsContainer = new Container();
    this.app.stage.addChild(this.buildingsContainer);

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
    this.app.stage.addChild(this.sceneryLayer);

    // Night glow layer: soft halos at light sources, visible at night (Phase 22)
    const glowResult = buildNightGlowLayer();
    this.nightGlowLayer = glowResult.container;
    this.nightGlows = glowResult.glows;
    this.app.stage.addChild(this.nightGlowLayer);

    // Ambient floating particles (between night glow and agents in z-order)
    this.ambientParticles = new AmbientParticles();
    this.app.stage.addChild(this.ambientParticles);

    this.agentsContainer = new Container();
    this.app.stage.addChild(this.agentsContainer);

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

    // Day/night cycle dynamic color temperature filter (replaces static warm tint)
    this.stageFilter = new ColorMatrixFilter();
    this.app.stage.filters = [this.stageFilter];
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

    // Update stage color temperature filter
    const [r, g, b] = this.dayNightCycle.getTintRGB();
    // Apply RGB multipliers using ColorMatrixFilter matrix
    // The matrix multiplies each channel: [r,0,0,0,0, 0,g,0,0,0, 0,0,b,0,0, 0,0,0,1,0]
    this.stageFilter.matrix = [
      r, 0, 0, 0, 0,
      0, g, 0, 0, 0,
      0, 0, b, 0, 0,
      0, 0, 0, 1, 0,
    ];

    // Update night glow sprites
    updateNightGlowLayer(this.nightGlows, nightIntensity);

    // Tick ambient agents (idle animation at campfire)
    for (const ambient of this.ambientAgents) {
      if (ambient.visible) {
        ambient.tick(deltaMs);
      }
    }

    // Tick agents (state machine + animation) and advance status debouncing
    for (const agent of this.agents.values()) {
      agent.tick(deltaMs);

      // Reparent agents between global agentsContainer and building agentsLayer
      this.handleAgentReparenting(agent);

      // Capture previous committed status before debounce may update it
      const prevCommitted = this.lastCommittedStatus.get(agent.sessionId);

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
            const celebBuilding = this.agentBuilding.get(agent.sessionId);
            if (celebBuilding) {
              celebBuilding.releaseStation(agent.sessionId);
            }
            agent.startCelebration();
            SoundManager.getInstance().play();
          }
        }
      }

      // Idle timeout: track continuous idle duration, play reminder, trigger fade-out
      const committed = this.lastCommittedStatus.get(agent.sessionId);
      if (committed === 'idle' && agent.getState() !== 'fading_out') {
        const prev = this.idleTimers.get(agent.sessionId) ?? 0;
        const next = prev + deltaMs;
        this.idleTimers.set(agent.sessionId, next);

        // Play reminder sound once after 1 minute of continuous idle (with global throttle)
        if (next >= IDLE_REMINDER_MS && !this.hasPlayedReminder.get(agent.sessionId)) {
          const now = performance.now();
          if (now - this.lastReminderPlayTime >= REMINDER_THROTTLE_MS) {
            SoundManager.getInstance().playReminder();
            this.lastReminderPlayTime = now;
          }
          this.hasPlayedReminder.set(agent.sessionId, true);
        }

        if (next >= IDLE_TIMEOUT_MS) {
          agent.startFadeOut();
          this.idleTimers.delete(agent.sessionId);
          this.hasPlayedReminder.delete(agent.sessionId);
        }
      } else {
        // Not idle or already fading -- reset timer and reminder flag
        this.idleTimers.delete(agent.sessionId);
        this.hasPlayedReminder.delete(agent.sessionId);
      }

      // Waiting reminder: per-session timer for "ready to work" audio nudge (AUDIO-04/05/06/07)
      // Unlike idle timer (which triggers fadeout), waiting timer only plays a sound.
      // Fires from 'waiting' status, NOT 'idle'. Throttled globally so sounds never stack.
      if (committed === 'waiting' && agent.getState() !== 'fading_out') {
        const wPrev = this.waitingTimers.get(agent.sessionId) ?? 0;
        const wNext = wPrev + deltaMs;
        this.waitingTimers.set(agent.sessionId, wNext);

        // Play reminder once after WAITING_REMINDER_MS, with global throttle
        if (wNext >= WAITING_REMINDER_MS && !this.hasPlayedWaitingReminder.get(agent.sessionId)) {
          const now = performance.now();
          if (now - this.lastReminderPlayTime >= REMINDER_THROTTLE_MS) {
            SoundManager.getInstance().playReminder();
            this.lastReminderPlayTime = now;
          }
          // Mark as played regardless of throttle -- this session's reminder is "consumed"
          // It won't retry; the next session's timer will fire its own reminder after the throttle gap
          this.hasPlayedWaitingReminder.set(agent.sessionId, true);
        }
      } else if (committed === 'active') {
        // Active-cycle reset: clear waiting timer and reminder flag when session goes active
        // This allows the reminder to fire again if the session returns to waiting (AUDIO-07)
        this.waitingTimers.delete(agent.sessionId);
        this.hasPlayedWaitingReminder.delete(agent.sessionId);
      } else {
        // Any other status (idle, error, fading) -- just reset the waiting timer
        // Do NOT clear hasPlayedWaitingReminder here -- only 'active' clears the flag (AUDIO-07)
        this.waitingTimers.delete(agent.sessionId);
      }

      // Visibility safeguard: warn if any non-fading agent has alpha < 0.4
      // This catches bugs where alpha leaks from breathing or other effects
      if (agent.getState() !== 'fading_out' && agent.alpha < 0.4) {
        console.warn(`[world] Visibility warning: agent ${agent.sessionId} has alpha ${agent.alpha.toFixed(2)} in state ${agent.getState()}`);
        agent.alpha = 1; // Force-fix to prevent invisible agents
      }
    }

    // Deferred removal of fully faded agents (collect-then-remove to avoid mutation during iteration)
    const toRemove: string[] = [];
    for (const agent of this.agents.values()) {
      if (agent.isFadedOut()) {
        toRemove.push(agent.sessionId);
      }
    }
    for (const sessionId of toRemove) {
      this.removeAgent(sessionId);
    }

    // Tick building smoke particles (Phase 20)
    for (const building of this.questZones.values()) {
      building.tick(deltaMs);
    }

    // Tick ambient particles
    this.ambientParticles.tick(deltaMs);

    // Tick speech bubbles (skip for fading agents)
    for (const [sessionId, bubble] of this.speechBubbles) {
      const agent = this.agents.get(sessionId);
      if (agent && agent.getState() === 'fading_out') {
        bubble.visible = false;
        continue;
      }
      bubble.tick(deltaMs);
    }

    // Quest zone active highlights (ENV-04) -- based on project-to-building assignment
    const activeBuildings = new Set<Building>();
    for (const agent of this.agents.values()) {
      const agentState = agent.getState();
      if (agentState === 'working' || agentState === 'walking_to_workspot') {
        const building = this.agentBuilding.get(agent.sessionId);
        if (building) {
          activeBuildings.add(building);
        }
      }
    }
    for (const building of this.questZones.values()) {
      building.tint = activeBuildings.has(building) ? 0xFFDD88 : 0xFFFFFF;
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

  // --- Private: Agent Removal ---

  /**
   * Remove an agent completely: scene graph, PixiJS destroy, all tracking Maps, factory slot.
   * Single cleanup method to prevent memory leaks from incomplete removal.
   */
  private removeAgent(sessionId: string): void {
    const agent = this.agents.get(sessionId);
    if (!agent) return;

    // Release building station if assigned
    const building = this.agentBuilding.get(sessionId);
    if (building) {
      building.releaseStation(sessionId);
    }

    // Remove from whichever container the agent is in (building agentsLayer or global agentsContainer)
    if (this.agentsInBuildings.has(sessionId) && building) {
      building.getAgentsLayer().removeChild(agent);
    } else {
      this.agentsContainer.removeChild(agent);
    }

    // Destroy PixiJS container + all children (AnimatedSprite, SpeechBubble)
    agent.destroy({ children: true });

    // Clean ALL tracking Maps
    this.agents.delete(sessionId);
    this.speechBubbles.delete(sessionId);
    this.lastActivity.delete(sessionId);
    this.statusDebounce.delete(sessionId);
    this.lastCommittedStatus.delete(sessionId);
    this.lastRawStatus.delete(sessionId);
    this.lastEntryType.delete(sessionId);
    this.agentBuilding.delete(sessionId);
    this.idleTimers.delete(sessionId);
    this.agentSpotIndex.delete(sessionId);
    this.hasPlayedReminder.delete(sessionId);
    this.waitingTimers.delete(sessionId);
    this.hasPlayedWaitingReminder.delete(sessionId);
    this.agentsInBuildings.delete(sessionId);

    // Release factory slot
    this.agentFactory.releaseSlot(sessionId);

    // Prevent resurrection from stale IPC data
    this.dismissedSessions.add(sessionId);
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
        this.speechBubbles.set(session.sessionId, bubble);
        agent.addChild(bubble);

        // Initialize debounce for new agent
        this.statusDebounce.set(session.sessionId, {
          pendingStatus: session.status,
          timer: 0,
          committedStatus: session.status,
        });
        this.lastCommittedStatus.set(session.sessionId, session.status);
        this.lastRawStatus.set(session.sessionId, session.status);

        // Apply initial visual status immediately (no debounce needed for first)
        agent.applyStatusVisuals(session.status);
      }

      // Store raw status for tick-based debounce advancement
      this.lastRawStatus.set(session.sessionId, session.status);

      // Store entry type for completion detection validation
      this.lastEntryType.set(session.sessionId, session.lastEntryType);

      // Route agent to building based on project name
      const activityType = session.activityType;

      // Handle fading agents: cancel idle-timeout fades on reactivation, skip session-gone fades
      if (agent.getState() === 'fading_out') {
        if (session.activityType !== 'idle' || session.status !== 'idle') {
          agent.cancelFadeOut();
          // Reinitialize debounce state for clean reactivation
          this.statusDebounce.set(session.sessionId, {
            pendingStatus: session.status,
            timer: 0,
            committedStatus: session.status,
          });
          this.lastCommittedStatus.set(session.sessionId, session.status);
          this.lastRawStatus.set(session.sessionId, session.status);
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
            this.agentSpotIndex.set(session.sessionId, stationIndex);
            // Enable interior mode (1.5x scale)
            agent.setInteriorMode(true);
            // Agent at campfire, needs to go work -- send to project building
            // Walk from campfire to building entrance in GLOBAL coordinates (agent is still in agentsContainer)
            const entrance = this.getBuildingEntrance(building);
            const workPos = this.getBuildingWorkPosition(building, session.sessionId);
            agent.assignToCompound(entrance, workPos);
            this.agentBuilding.set(session.sessionId, building);
            // BUBBLE-03: Show speech bubble on initial departure from campfire
            const bubble = this.speechBubbles.get(session.sessionId);
            if (bubble) bubble.show(activityType);
          } else if (agentState === 'working') {
            // Check for tool change (lastToolName change triggers station switch)
            const prevActivity = this.lastActivity.get(session.sessionId);
            if (prevActivity && prevActivity !== activityType) {
              // BUBBLE-03: Show speech bubble on activity change at same building
              const bubble = this.speechBubbles.get(session.sessionId);
              if (bubble) bubble.show(activityType);

              // Reassign to a new station (different from current if possible)
              const newStationIndex = building.reassignStation(session.sessionId);
              this.agentSpotIndex.set(session.sessionId, newStationIndex);
              const newWorkPos = building.getWorkSpot(newStationIndex);
              agent.updateActivity(newWorkPos);
            }
          }
        } else {
          // 5th+ project overflow: stay at campfire
          if (agentState !== 'idle_at_hq' && agentState !== 'walking_to_building') {
            // Reparent agent out of building if inside one
            this.reparentAgentOut(session.sessionId);
            const prevBuilding = this.agentBuilding.get(session.sessionId);
            if (prevBuilding) prevBuilding.releaseStation(session.sessionId);
            const idlePos = this.getCampfireIdlePosition(session.sessionId);
            agent.assignToHQ(idlePos);
            this.agentBuilding.delete(session.sessionId);
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
          const prevBuilding = this.agentBuilding.get(session.sessionId);
          if (prevBuilding) prevBuilding.releaseStation(session.sessionId);
          const idlePos = this.getCampfireIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
          this.agentBuilding.delete(session.sessionId);
        }
      }

      // Track activity
      this.lastActivity.set(session.sessionId, session.activityType);
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
        const building = this.agentBuilding.get(sessionId);
        if (building) building.releaseStation(sessionId);
        agent.startFadeOut();
      }
    }

    // Clean up debounce state for removed sessions
    for (const [sessionId] of this.statusDebounce) {
      if (!currentIds.has(sessionId)) {
        this.statusDebounce.delete(sessionId);
        this.lastCommittedStatus.delete(sessionId);
        this.lastRawStatus.delete(sessionId);
        this.lastEntryType.delete(sessionId);
        this.agentBuilding.delete(sessionId);
        this.idleTimers.delete(sessionId);
        this.agentSpotIndex.delete(sessionId);
        this.hasPlayedReminder.delete(sessionId);
        this.waitingTimers.delete(sessionId);
        this.hasPlayedWaitingReminder.delete(sessionId);
        this.agentsInBuildings.delete(sessionId);
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
    const debounce = this.statusDebounce.get(sessionId);
    if (!debounce) return null;

    const rawStatus = this.lastRawStatus.get(sessionId);
    if (!rawStatus) return debounce.committedStatus;

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
        this.lastCommittedStatus.set(sessionId, rawStatus);
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
    const entryType = this.lastEntryType.get(sessionId);
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
    const state = agent.getState();
    const isInBuilding = this.agentsInBuildings.has(sessionId);
    const building = this.agentBuilding.get(sessionId);

    if ((state === 'walking_to_workspot' || state === 'working') && !isInBuilding && building) {
      // Reparent INTO building: convert global position to building-local
      this.agentsContainer.removeChild(agent);
      building.getAgentsLayer().addChild(agent);

      // Convert global coords to building-local coords
      agent.x = agent.x - building.x;
      agent.y = agent.y - building.y;

      // Update workspot target to local coordinates
      const spotIndex = this.agentSpotIndex.get(sessionId) ?? 0;
      const localSpot = building.getWorkSpot(spotIndex);
      agent.updateActivity(localSpot);

      this.agentsInBuildings.add(sessionId);
    } else if (
      (state === 'walking_to_building' || state === 'idle_at_hq' || state === 'celebrating' || state === 'fading_out') &&
      isInBuilding && building
    ) {
      // Reparent OUT of building: convert building-local position to global
      building.getAgentsLayer().removeChild(agent);
      this.agentsContainer.addChild(agent);

      // Convert building-local coords to global coords
      agent.x = agent.x + building.x;
      agent.y = agent.y + building.y;

      this.agentsInBuildings.delete(sessionId);
    }
  }

  /**
   * Reparent an agent out of a building back to agentsContainer if it's currently inside one.
   * Called explicitly when agent is leaving a building (e.g., returning to campfire).
   */
  private reparentAgentOut(sessionId: string): void {
    if (!this.agentsInBuildings.has(sessionId)) return;
    const agent = this.agents.get(sessionId);
    const building = this.agentBuilding.get(sessionId);
    if (!agent || !building) return;

    building.getAgentsLayer().removeChild(agent);
    this.agentsContainer.addChild(agent);

    // Convert building-local coords to global
    agent.x = agent.x + building.x;
    agent.y = agent.y + building.y;

    this.agentsInBuildings.delete(sessionId);
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
    const spotIndex = this.agentSpotIndex.get(sessionId) ?? 0;
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
