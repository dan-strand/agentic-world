import { AgentSlot } from '../shared/types';
import { getAgentSlot } from '../shared/constants';

/**
 * AgentFactory -- Maps sessionId to deterministic visual identity.
 *
 * Caches slot assignments to avoid rehashing the same sessionId.
 * The slot determines the agent's color and character class.
 *
 * Same sessionId always produces the same AgentSlot, ensuring
 * stable visual identity across app restarts.
 */
export class AgentFactory {
  private slotCache: Map<string, AgentSlot> = new Map();

  /**
   * Get the visual identity slot for a given session.
   * Result is deterministic and cached.
   */
  getSlot(sessionId: string): AgentSlot {
    let slot = this.slotCache.get(sessionId);
    if (!slot) {
      slot = getAgentSlot(sessionId);
      this.slotCache.set(sessionId, slot);
    }
    return slot;
  }

  /**
   * Clear the cache (useful if session set is reset).
   */
  clearCache(): void {
    this.slotCache.clear();
  }

  /**
   * Release a single slot from the cache (cleanup after agent removal).
   */
  releaseSlot(sessionId: string): void {
    this.slotCache.delete(sessionId);
  }
}

/** Singleton factory instance for use across the renderer */
export const agentFactory = new AgentFactory();
