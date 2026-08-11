import type { MondayOutboundItem } from "./map-task";

export type MondayItem = MondayOutboundItem & {
  id: string;
};

export type MondayClient = {
  createItem: (input: MondayOutboundItem) => Promise<MondayItem>;
  updateItem: (
    id: string,
    input: Partial<MondayOutboundItem>,
  ) => Promise<MondayItem>;
};

export const createInMemoryMondayClient = (): MondayClient & {
  items: Map<string, MondayItem>;
} => {
  const items = new Map<string, MondayItem>();
  let seq = 0;

  return {
    items,
    createItem: async (input) => {
      seq += 1;
      const item: MondayItem = { id: `mon-${seq}`, ...input };
      items.set(item.id, item);
      return item;
    },
    updateItem: async (id, input) => {
      const current = items.get(id);
      if (!current) {
        throw new Error(`Monday item not found: ${id}`);
      }
      const updated: MondayItem = { ...current, ...input, id };
      items.set(id, updated);
      return updated;
    },
  };
};
