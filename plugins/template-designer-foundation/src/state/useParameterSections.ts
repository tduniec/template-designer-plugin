import { useCallback } from "react";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
  ParametersNodeData,
} from "../types/flowNodes";

const buildUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const createSectionTemplate = (): ParameterSectionDisplay => {
  const unique = buildUniqueId();
  return {
    id: `section-${unique}`,
    title: "New Section",
    description: "",
    fields: [],
    properties: {},
    required: [],
    dependencies: {},
  };
};

const createFieldTemplate = (
  section: ParameterSectionDisplay
): ParameterFieldDisplay => {
  const unique = buildUniqueId();
  const nextIndex = (section.fields?.length ?? 0) + 1;
  const fallbackName = `field_${nextIndex}`;
  return {
    id: `${section.id}-field-${unique}`,
    fieldName: fallbackName,
    sectionId: section.id,
    sectionTitle: section.title,
    required: false,
    schema: {
      title: `Field ${nextIndex}`,
      type: "string",
    },
  };
};

export const useParameterSectionsController = (data: ParametersNodeData) => {
  const applySectionsUpdate = useCallback(
    (
      updater: (
        prevSections: ParameterSectionDisplay[]
      ) => ParameterSectionDisplay[]
    ) => {
      if (!data.onUpdateSections) {
        return;
      }
      data.onUpdateSections(data.rfId, (prev) => updater(prev ?? []));
    },
    [data]
  );

  const handleSectionUpdate = useCallback(
    (
      sectionId: string,
      updater: (section: ParameterSectionDisplay) => ParameterSectionDisplay
    ) => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) =>
          section.id === sectionId ? updater(section) : section
        )
      );
    },
    [applySectionsUpdate]
  );

  const handleFieldUpdate = useCallback(
    (
      sectionId: string,
      fieldId: string,
      updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
    ) => {
      handleSectionUpdate(sectionId, (section) => ({
        ...section,
        fields:
          section.fields?.map((field) =>
            field.id === fieldId ? updater(field) : field
          ) ?? [],
      }));
    },
    [handleSectionUpdate]
  );

  const handleAddSection = useCallback(
    (afterSectionId?: string) => {
      applySectionsUpdate((prev) => {
        const list = [...(prev ?? [])];
        const insertIndex = afterSectionId
          ? Math.max(
              list.findIndex((section) => section.id === afterSectionId) + 1,
              0
            )
          : list.length;
        const nextSection = createSectionTemplate();
        list.splice(insertIndex, 0, nextSection);
        return list;
      });
    },
    [applySectionsUpdate]
  );

  const handleMoveSection = useCallback(
    (sectionId: string, direction: "up" | "down") => {
      applySectionsUpdate((prev) => {
        const list = [...(prev ?? [])];
        const currentIndex = list.findIndex(
          (section) => section.id === sectionId
        );
        if (currentIndex < 0) {
          return list;
        }
        const targetIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= list.length) {
          return list;
        }
        const [item] = list.splice(currentIndex, 1);
        list.splice(targetIndex, 0, item);
        return list;
      });
    },
    [applySectionsUpdate]
  );

  const handleAddField = useCallback(
    (sectionId: string, afterFieldId?: string) => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) => {
          if (section.id !== sectionId) {
            return section;
          }
          const fields = [...(section.fields ?? [])];
          const insertIndex =
            afterFieldId && fields.length
              ? Math.max(
                  fields.findIndex((field) => field.id === afterFieldId) + 1,
                  0
                )
              : fields.length;
          const newField = createFieldTemplate(section);
          fields.splice(insertIndex, 0, newField);
          return {
            ...section,
            fields,
          };
        })
      );
    },
    [applySectionsUpdate]
  );

  const handleMoveField = useCallback(
    (sectionId: string, fieldId: string, direction: "up" | "down") => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) => {
          if (section.id !== sectionId) {
            return section;
          }
          const fields = [...(section.fields ?? [])];
          const currentIndex = fields.findIndex(
            (field) => field.id === fieldId
          );
          if (currentIndex < 0) {
            return section;
          }
          const targetIndex =
            direction === "up" ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= fields.length) {
            return section;
          }
          const [item] = fields.splice(currentIndex, 1);
          fields.splice(targetIndex, 0, item);
          return {
            ...section,
            fields,
          };
        })
      );
    },
    [applySectionsUpdate]
  );

  return {
    sections: data.sections ?? [],
    handleSectionUpdate,
    handleFieldUpdate,
    handleAddSection,
    handleMoveSection,
    handleAddField,
    handleMoveField,
  };
};
