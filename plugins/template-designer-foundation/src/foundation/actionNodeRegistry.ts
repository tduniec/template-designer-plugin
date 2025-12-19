import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { RegisteredActionNode } from "./types";

export class ActionNodeRegistry {
  private readonly nodes = new Map<string, RegisteredActionNode>();

  /**
   * Register a new action node renderer. Locked nodes cannot be overridden.
   */
  register(
    id: string,
    component: ComponentType<NodeProps>,
    options: { locked?: boolean } = {}
  ) {
    const existing = this.nodes.get(id);
    if (existing?.locked) {
      throw new Error(`Action node '${id}' is locked and cannot be overridden`);
    }
    if (existing && options.locked) {
      throw new Error(`Action node '${id}' is already registered`);
    }

    this.nodes.set(id, {
      id,
      component,
      locked: Boolean(options.locked),
    });
  }

  get(id: string): ComponentType<NodeProps> | undefined {
    return this.nodes.get(id)?.component;
  }

  list(): RegisteredActionNode[] {
    return Array.from(this.nodes.values());
  }
}

/**
 * Shared registry instance to keep the common action nodes "final".
 * PRO can append new nodes by registering under a different id.
 */
export const actionNodeRegistry = new ActionNodeRegistry();
