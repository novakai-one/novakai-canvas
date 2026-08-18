/**
 * The application frame: rail, header, active surface, inspector.
 *
 * The shell persists across every Room. Only the workspace swaps, so a load failure or
 * a Room change never costs you your location.
 */
import { useEffect, useState } from 'react';
import './prototype-app.css';
import { roomKey, StoreProvider, useStore, type Projection, type Room } from './store';
import { childStages, type ObjectGraph } from '../object-graph/graph';
import { NavigationRail } from '../components/NavigationRail/NavigationRail';
import { ContextHeader } from '../components/ContextHeader/ContextHeader';
import { InspectorPanel } from '../components/InspectorPanel/InspectorPanel';
import { Home } from '../rooms/Home/Home';
import { CommandCenter } from '../rooms/CommandCenter/CommandCenter';
import { Missions } from '../rooms/Missions/Missions';
import { Projects } from '../rooms/Projects/Projects';
import { CanvasRoom } from '../rooms/Canvas/CanvasRoom';
import { Messages } from '../rooms/Messages/Messages';
import { AgentRoles } from '../rooms/AgentRoles/AgentRoles';
import { MissionRoom } from '../rooms/MissionRoom/MissionRoom';
import { StageRoom } from '../rooms/StageRoom/StageRoom';
import { AgentRoom, ProjectRoom } from '../rooms/ObjectRoom/ObjectRoom';
import { resolveCommandCenterDesign } from '../rooms/CommandCenter/command-center-design-registry';
import { resolveMessagesDesign } from '../rooms/Messages/messages-design-registry';
import { resolveMissionsDesign } from '../rooms/Missions/missions-design-registry';
import { resolveProjectsDesign } from '../rooms/Projects/projects-design-registry';
import { resolveObjectRoomDesign } from '../rooms/ObjectRoom/object-room-design-registry';
import { resolveStageDesign } from '../rooms/StageRoom/stage-design-registry';
import { resolveAgentRolesDesign } from '../rooms/AgentRoles/agent-roles-design-registry';
import { resolveHomeDesign } from '../rooms/Home/home-design-registry';

function activeDesignOwnsInspector(room: Room, graph: ObjectGraph, projection: Projection): boolean {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  if (room.kind === 'area' && room.area === 'command-center') {
    return resolveCommandCenterDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'thread' || (room.kind === 'area' && room.area === 'messages')) {
    return resolveMessagesDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'area' && room.area === 'missions') {
    return resolveMissionsDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'area' && room.area === 'projects') {
    return resolveProjectsDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'project' || room.kind === 'agent') {
    return resolveObjectRoomDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'stage') {
    // A stage design only owns the inspector while the sheet actually renders —
    // the host's world-projection branch must never hide the global inspector.
    const worldRenders = projection === 'world' && childStages(graph, room.subjectId).length > 0;
    return (resolveStageDesign(search).ownsInspector ?? false) && !worldRenders;
  }
  if (room.kind === 'role' || (room.kind === 'area' && room.area === 'agent-roles')) {
    return resolveAgentRolesDesign(search).ownsInspector ?? false;
  }
  if (room.kind === 'area' && room.area === 'home') {
    return resolveHomeDesign(search).ownsInspector ?? false;
  }
  return false;
}

function ActiveRoom() {
  const { room } = useStore();

  switch (room.kind) {
    case 'mission':
      return <MissionRoom missionId={room.subjectId} />;
    case 'stage':
      return <StageRoom stageId={room.subjectId} />;
    case 'project':
      return <ProjectRoom projectId={room.subjectId} />;
    case 'agent':
      return <AgentRoom agentId={room.subjectId} />;
    case 'thread':
      return <Messages threadId={room.subjectId} />;
    case 'role':
      return <AgentRoles />;
    case 'area':
      switch (room.area) {
        case 'home':
          return <Home />;
        case 'command-center':
          return <CommandCenter />;
        case 'missions':
          return <Missions />;
        case 'projects':
          return <Projects />;
        case 'canvas':
          // Canvas is the persistent sibling owned by Shell, never a keyed Room child.
          return null;
        case 'messages':
          return <Messages />;
        case 'agent-roles':
          return <AgentRoles />;
      }
  }
}

function Shell() {
  const { room, graph, projection, select, loadWarnings } = useStore();
  const canvasActive = room.kind === 'area' && room.area === 'canvas';
  const [canvasWasOpened, setCanvasWasOpened] = useState(canvasActive);

  useEffect(() => {
    if (canvasActive) setCanvasWasOpened(true);
  }, [canvasActive]);

  return (
    <div
      className="prototype-shell"
      onKeyDown={(event) => {
        // Esc closes the inspector first. It never navigates on its own.
        if (!canvasActive && event.key === 'Escape') select(null);
      }}
    >
      <NavigationRail />
      <div className="prototype-shell__main">
        {!canvasActive && <ContextHeader />}
        {!canvasActive && loadWarnings.length > 0 && (
          <p className="prototype-shell__warning" role="status">
            {loadWarnings.length} fixture {loadWarnings.length === 1 ? 'line' : 'lines'} could not be
            read: {loadWarnings[0]}
          </p>
        )}
        <main className="prototype-shell__workspace">
          {(canvasActive || canvasWasOpened) && <CanvasRoom active={canvasActive} />}
          {/* Ordinary Rooms remount on navigation; Canvas retains its in-memory session. */}
          {!canvasActive && <ActiveRoom key={roomKey(room)} />}
        </main>
      </div>
      {!canvasActive && (
        <InspectorPanel hidden={activeDesignOwnsInspector(room, graph, projection)} />
      )}
    </div>
  );
}

export default function PrototypeApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
