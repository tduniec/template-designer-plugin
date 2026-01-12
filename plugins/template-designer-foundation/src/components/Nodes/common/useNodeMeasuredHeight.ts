import { useLayoutEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

/**
 * Shared hook to record a node's measured height into React Flow state.
 * Use this in custom node components so layout has accurate spacing.
 */
export const useNodeMeasuredHeight = (rfId: string, deps: any[] = []) => {
  const { setNodes } = useReactFlow();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const heightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) {
      return undefined;
    }
    let raf: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = entry.contentRect.height;
      const prev = heightRef.current ?? nextHeight;
      if (Math.abs(prev - nextHeight) < 1) {
        return;
      }
      heightRef.current = nextHeight;
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === rfId
              ? {
                  ...node,
                  data: { ...(node.data as any), measuredHeight: nextHeight },
                }
              : node
          )
        );
      });
    });
    observer.observe(element);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfId, setNodes, ...deps]);

  return cardRef;
};
