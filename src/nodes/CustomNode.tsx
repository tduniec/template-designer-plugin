import React from 'react';
import { Handle, NodeToolbar, Position } from '@xyflow/react';
import './CustomNode.css'; // styles below

export function CustomNode({ data }: any) {
  return (
    <div className="custom-node">
      <NodeToolbar position={Position.Bottom}>
        <button onClick={() => data.onAddNode?.(data.id)}>➕ Add Node</button>
      </NodeToolbar>

      <div className="custom-node-content">
        <strong>{data?.label ?? 'Custom Node'}</strong>
      </div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
