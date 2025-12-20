import { useCallback, useMemo } from "react";
import type { OutputNodeData } from "../../../types/flowNodes";

export const useOutputController = (data: OutputNodeData) => {
  const { rfId, output } = data;
  const stepOutputReferences = useMemo(
    () => data.stepOutputReferences ?? [],
    [data.stepOutputReferences]
  );
  const referenceOptions = useMemo(
    () => Array.from(new Set(stepOutputReferences.filter(Boolean))),
    [stepOutputReferences]
  );

  const links = useMemo(
    () => (Array.isArray(output?.links) ? [...output.links] : []),
    [output?.links]
  );
  const textEntries = useMemo(
    () =>
      Array.isArray((output as any)?.text) ? [...(output as any).text] : [],
    [output]
  );

  const setLinkFieldValue = useCallback(
    (
      index: number,
      field: "title" | "icon" | "url" | "entityRef",
      value: string
    ) => {
      const next = [...links];
      const entry = { ...(next[index] ?? {}) };
      entry[field] = value;
      next[index] = entry;
      data.onUpdateOutput?.(rfId, (prev) => ({
        ...(prev ?? {}),
        links: next,
      }));
    },
    [data, links, rfId]
  );

  const handleLinkChange = useCallback(
    (index: number, field: "title" | "icon" | "url" | "entityRef") =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setLinkFieldValue(index, field, event.target.value);
      },
    [setLinkFieldValue]
  );

  const handleAddLink = useCallback(() => {
    data.onUpdateOutput?.(rfId, (prev) => ({
      ...(prev ?? {}),
      links: [...links, { title: "Link", url: "" }],
    }));
  }, [data, links, rfId]);

  const handleRemoveLink = useCallback(
    (index: number) => {
      const next = [...links];
      next.splice(index, 1);
      data.onUpdateOutput?.(rfId, (prev) => ({
        ...(prev ?? {}),
        links: next,
      }));
    },
    [data, links, rfId]
  );

  const setTextFieldValue = useCallback(
    (
      index: number,
      field: "title" | "icon" | "content" | "default",
      value: unknown
    ) => {
      const next = [...textEntries];
      const entry = { ...(next[index] ?? {}) };
      (entry as any)[field] = value;
      next[index] = entry;
      data.onUpdateOutput?.(rfId, (prev: any) => ({
        ...(prev ?? {}),
        text: next,
      }));
    },
    [data, textEntries, rfId]
  );

  const handleTextChange = useCallback(
    (index: number, field: "title" | "icon" | "content") =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextFieldValue(index, field, event.target.value);
      },
    [setTextFieldValue]
  );

  const handleTextDefaultToggle = useCallback(
    (index: number) => {
      const next = textEntries.map((entry, idx) => ({
        ...entry,
        default: idx === index ? !entry?.default : false,
      }));
      data.onUpdateOutput?.(rfId, (prev: any) => ({
        ...(prev ?? {}),
        text: next,
      }));
    },
    [data, rfId, textEntries]
  );

  const handleAddText = useCallback(() => {
    data.onUpdateOutput?.(rfId, (prev: any) => ({
      ...(prev ?? {}),
      text: [...textEntries, { title: "Note", content: "" }],
    }));
  }, [data, rfId, textEntries]);

  const handleRemoveText = useCallback(
    (index: number) => {
      const next = [...textEntries];
      next.splice(index, 1);
      data.onUpdateOutput?.(rfId, (prev: any) => ({
        ...(prev ?? {}),
        text: next,
      }));
    },
    [data, textEntries, rfId]
  );

  return {
    stepOutputReferences,
    links,
    textEntries,
    referenceOptions,
    setLinkFieldValue,
    handleLinkChange,
    handleAddLink,
    handleRemoveLink,
    setTextFieldValue,
    handleTextChange,
    handleTextDefaultToggle,
    handleAddText,
    handleRemoveText,
    rfId,
  };
};
