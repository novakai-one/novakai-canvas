import { useStore } from '../../app/store';
import { roomFor } from '../../room-navigation/room-for';
import type {
  CommandCenterDesignCommands,
  CommandCenterDesignData,
} from './command-center-design';
import { resolveCommandCenterDesign } from './command-center-design-registry';

/** Composition root that supplies app state to the selected Command Center design. */
export function CommandCenter() {
  const { graph, feed, elected, selected, select, patch, addRecord, enterRoom } = useStore();
  const design = resolveCommandCenterDesign(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const DesignView = design.View;

  const data: CommandCenterDesignData = {
    graph,
    feed,
    elected,
    selected,
  };

  const commands: CommandCenterDesignCommands = {
    select,
    patch,
    addRecord,
    canOpen: (record) => roomFor(record) !== null,
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
  };

  return <DesignView data={data} commands={commands} />;
}
