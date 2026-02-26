import { Application, Container, ColorMatrixFilter } from 'pixi.js';
import type { SessionInfo, ActivityType, SessionStatus } from '../shared/types';
import {
  BACKGROUND_COLOR,
  STATUS_DEBOUNCE_MS,
  GUILD_HALL_POS,
  QUEST_ZONE_POSITIONS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ACTIVITY_BUILDING,
  IDLE_TIMEOUT_MS,
  IDLE_REMINDER_MS,
  hashSessionId,
} from '../shared/constants';
import type { BuildingType } from '../shared/constants';
import { Agent } from './agent';
import { AgentFactory } from './agent-factory';
import { Building } from './building';
import { buildingTextures } from './asset-loader';
import { SpeechBubble } from './speech-bubble';
import { buildWorldTilemap } from './tilemap-builder';
import { AmbientParticles } from './ambient-particles';
import { SoundManager } from './sound-manager';

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
 *   app.stage [warm ColorMatrixFilter]
 *   +-- tilemapLayer (canvas-rendered grass + dirt paths)
 *   +-- buildingsContainer (Guild Hall + 4 quest zone buildings)
 *   +-- ambientParticles (floating firefly particles)
 *   +-- agentsContainer (dynamic Agent children)
 */
export class World {
  private app!: Application;

  // Scene containers (z-order: tilemap, buildings, ambient particles, agents)
  private tilemapLayer!: Container;
  private guildHall!: Building;
  private buildingsContainer!: Container;
  private ambientParticles!: AmbientParticles;
  private agentsContainer!: Container;

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

  // Track current work spot index per agent (for spot rotation on activity change)
  private agentSpotIndex: Map<string, number> = new Map();

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
      GUILD_HALL_POS,
      Object.values(QUEST_ZONE_POSITIONS),
    );
    this.tilemapLayer.addChild(tilemap);

    // Buildings container (replaces HQ + compoundsContainer)
    this.buildingsContainer = new Container();
    this.app.stage.addChild(this.buildingsContainer);

    // Position center for guild hall
    this.centerX = WORLD_WIDTH / 2;
    this.centerY = WORLD_HEIGHT / 2;

    // Create Guild Hall at world center
    this.guildHall = new Building('guild_hall', buildingTextures['guild_hall']);
    this.guildHall.position.set(GUILD_HALL_POS.x, GUILD_HALL_POS.y);
    this.buildingsContainer.addChild(this.guildHall);

    // Create 4 quest zone buildings from QUEST_ZONE_POSITIONS
    for (const [activityType, pos] of Object.entries(QUEST_ZONE_POSITIONS)) {
      const buildingType: BuildingType = ACTIVITY_BUILDING[activityType as ActivityType];
      const building = new Building(buildingType, buildingTextures[buildingType]);
      building.position.set(pos.x, pos.y);
      this.buildingsContainer.addChild(building);
      this.questZones.set(activityType as ActivityType, building);
    }

    // Populate building slots in stable order for project assignment
    const slotOrder: ActivityType[] = ['coding', 'testing', 'reading', 'comms'];
    for (const activity of slotOrder) {
      const slotBuilding = this.questZones.get(activity);
      if (slotBuilding) this.buildingSlots.push(slotBuilding);
    }

    // Ambient floating particles (between buildings and agents in z-order)
    this.ambientParticles = new AmbientParticles();
    this.app.stage.addChild(this.ambientParticles);

    this.agentsContainer = new Container();
    this.app.stage.addChild(this.agentsContainer);

    // Warm ambient lighting tint (FX-03)
    const warmFilter = new ColorMatrixFilter();
    warmFilter.tint(0xFFE8C0, false); // Warm golden tone for RPG atmosphere
    this.app.stage.filters = [warmFilter];
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
    // Tick agents (state machine + animation) and advance status debouncing
    for (const agent of this.agents.values()) {
      agent.tick(deltaMs);

      // Capture previous committed status before debounce may update it
      const prevCommitted = this.lastCommittedStatus.get(agent.sessionId);

      // Advance status debounce and check for committed changes
      const newStatus = this.advanceStatusDebounce(agent.sessionId, deltaMs);
      if (newStatus !== null) {
        // Status just committed -- apply visuals
        agent.applyStatusVisuals(newStatus);

        // Check for completion (active -> idle)
        if (this.checkForCompletion(agent.sessionId, newStatus, prevCommitted)) {
          // Celebrate unless agent is already idle at HQ or already celebrating
          const agentState = agent.getState();
          if (agentState !== 'idle_at_hq' && agentState !== 'celebrating') {
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

        // Play reminder sound once after 1 minute of continuous idle
        if (next >= IDLE_REMINDER_MS && !this.hasPlayedReminder.get(agent.sessionId)) {
          SoundManager.getInstance().playReminder();
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
          state === 'walking_to_workspot' || state === 'fading_out') {
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

    // Remove from scene graph
    this.agentsContainer.removeChild(agent);

    // Destroy PixiJS container + all children (AnimatedSprite, SpeechBubble)
    agent.destroy({ children: true });

    // Clean ALL tracking Maps
    this.agents.delete(sessionId);
    this.speechBubbles.delete(sessionId);
    this.lastActivity.delete(sessionId);
    this.statusDebounce.delete(sessionId);
    this.lastCommittedStatus.delete(sessionId);
    this.lastRawStatus.delete(sessionId);
    this.agentBuilding.delete(sessionId);
    this.idleTimers.delete(sessionId);
    this.agentSpotIndex.delete(sessionId);
    this.hasPlayedReminder.delete(sessionId);

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
        // Only clear dismissal if session shows genuine reactivation
        if (session.activityType !== 'idle' && session.status === 'active') {
          this.dismissedSessions.delete(session.sessionId);
          // Fall through to normal agent creation below
        } else {
          continue; // Skip this session entirely
        }
      }

      let agent = this.agents.get(session.sessionId);

      if (!agent) {
        // Create new agent
        const slot = this.agentFactory.getSlot(session.sessionId);
        agent = new Agent(session.sessionId, slot);
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

      // Route agent to building based on project name
      const activityType = session.activityType;

      // Handle fading agents: cancel idle-timeout fades on reactivation, skip session-gone fades
      if (agent.getState() === 'fading_out') {
        if (session.activityType !== 'idle' || session.status !== 'idle') {
          agent.cancelFadeOut();
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
            // Assign deterministic initial spot based on session hash
            this.agentSpotIndex.set(session.sessionId, hashSessionId(session.sessionId) % 3);
            // Agent at guild hall, needs to go work -- send to project building
            const entrance = this.getBuildingEntrance(building);
            const workPos = this.getBuildingWorkPosition(building, session.sessionId);
            agent.assignToCompound(entrance, workPos);
            this.agentBuilding.set(session.sessionId, building);
            // BUBBLE-03: Show speech bubble on initial departure from Guild Hall
            const bubble = this.speechBubbles.get(session.sessionId);
            if (bubble) bubble.show(activityType);
          } else if (agentState === 'working') {
            const prevActivity = this.lastActivity.get(session.sessionId);
            if (prevActivity && prevActivity !== activityType) {
              // BUBBLE-03: Show speech bubble on activity change at same building
              const bubble = this.speechBubbles.get(session.sessionId);
              if (bubble) bubble.show(activityType);

              // Rotate to next work spot within the building
              const currentSpot = this.agentSpotIndex.get(session.sessionId) ?? 0;
              const nextSpot = (currentSpot + 1) % 3;
              this.agentSpotIndex.set(session.sessionId, nextSpot);
              const newWorkPos = this.getBuildingWorkPosition(building, session.sessionId);
              agent.updateActivity(newWorkPos);
            }
          }
        } else {
          // 5th+ project overflow: stay at Guild Hall
          if (agentState !== 'idle_at_hq' && agentState !== 'walking_to_building') {
            const idlePos = this.getGuildHallIdlePosition(session.sessionId);
            agent.assignToHQ(idlePos);
            this.agentBuilding.delete(session.sessionId);
          }
        }
      } else {
        // Activity is idle -- agent should be at Guild Hall
        if (
          agentState !== 'idle_at_hq' &&
          agentState !== 'walking_to_building' &&
          agentState !== 'celebrating'
        ) {
          const idlePos = this.getGuildHallIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
          this.agentBuilding.delete(session.sessionId);
        }
      }

      // Track activity
      this.lastActivity.set(session.sessionId, session.activityType);
    }

    // Release building slots for projects with no active sessions
    this.releaseInactiveProjectSlots(sessions);

    // Trigger fade-out for agents whose sessions have disappeared from IPC
    for (const [sessionId, agent] of this.agents) {
      if (!currentIds.has(sessionId) && agent.getState() !== 'fading_out') {
        agent.startFadeOut();
      }
    }

    // Clean up debounce state for removed sessions
    for (const [sessionId] of this.statusDebounce) {
      if (!currentIds.has(sessionId)) {
        this.statusDebounce.delete(sessionId);
        this.lastCommittedStatus.delete(sessionId);
        this.lastRawStatus.delete(sessionId);
        this.agentBuilding.delete(sessionId);
        this.idleTimers.delete(sessionId);
        this.agentSpotIndex.delete(sessionId);
        this.hasPlayedReminder.delete(sessionId);
      }
    }

    // Reposition idle agents at Guild Hall
    this.repositionIdleAgents();
  }

  /**
   * Reposition all idle agents in front of Guild Hall.
   */
  private repositionIdleAgents(): void {
    const idleAgents: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.getState() === 'idle_at_hq') {
        idleAgents.push(agent);
      }
    }

    for (let i = 0; i < idleAgents.length; i++) {
      const localPos = this.guildHall.getIdlePosition(i, idleAgents.length);
      // Convert guild hall local position to global position
      const globalPos = {
        x: this.guildHall.x + localPos.x,
        y: this.guildHall.y + localPos.y,
      };
      idleAgents[i].setHQPosition(globalPos);
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
   * Detect task completion: session was active, now committed to idle.
   * Returns true only on the transition, not on sustained idle.
   *
   * @param prevCommitted - The committed status BEFORE advanceStatusDebounce updated it
   */
  private checkForCompletion(
    _sessionId: string,
    newCommittedStatus: SessionStatus,
    prevCommitted: SessionStatus | undefined,
  ): boolean {
    // Completion = was active, now idle
    return prevCommitted === 'active' && newCommittedStatus === 'idle';
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

    // All 4 slots full -- overflow to Guild Hall
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
        this.projectToBuilding.delete(projectName);
      }
    }
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
   * Get a global idle position at Guild Hall for a specific agent.
   * Used when sending an agent back to Guild Hall.
   */
  private getGuildHallIdlePosition(sessionId: string): { x: number; y: number } {
    // Count current idle agents + this one
    let idleCount = 1;
    let thisIndex = 0;
    for (const agent of this.agents.values()) {
      if (agent.sessionId === sessionId) continue;
      if (agent.getState() === 'idle_at_hq') {
        idleCount++;
        thisIndex++;
      }
    }
    const localPos = this.guildHall.getIdlePosition(thisIndex, idleCount);
    return {
      x: this.guildHall.x + localPos.x,
      y: this.guildHall.y + localPos.y,
    };
  }
}
