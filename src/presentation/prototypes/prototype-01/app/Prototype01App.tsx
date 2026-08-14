/**
 * The application frame: rail, header, active surface, inspector.
 *
 * The shell persists across every Room. Only the workspace swaps, so a load failure or
 * a Room change never costs you your location.
 */
import './prototype-01-app.css';
import { roomKey, StoreProvider, useStore } from './store';
import { NavigationRail } from '../components/NavigationRail/NavigationRail';
import { ContextHeader } from '../components/ContextHeader/ContextHeader';
import { InspectorPanel } from '../components/InspectorPanel/InspectorPanel';
import { Home } from '../rooms/Home/Home';
import { CommandCenter } from '../rooms/CommandCenter/CommandCenter';
import { Missions } from '../rooms/Missions/Missions';
import { Projects } from '../rooms/Projects/Projects';
import { Messages } from '../rooms/Messages/Messages';
import { AgentRoles } from '../rooms/AgentRoles/AgentRoles';
import { MissionRoom } from '../rooms/MissionRoom/MissionRoom';
import { StageRoom } from '../rooms/StageRoom/StageRoom';
import { AgentRoom, ProjectRoom } from '../rooms/ObjectRoom/ObjectRoom';

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
        case 'messages':
          return <Messages />;
        case 'agent-roles':
          return <AgentRoles />;
      }
  }
}

function Shell() {
  const { room, select, loadWarnings } = useStore();

  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        // Esc closes the inspector first. It never navigates on its own.
        if (event.key === 'Escape') select(null);
      }}
    >
      <NavigationRail />
      <div className="app-shell__main">
        <ContextHeader />
        {loadWarnings.length > 0 && (
          <p className="app-shell__warning" role="status">
            {loadWarnings.length} fixture {loadWarnings.length === 1 ? 'line' : 'lines'} could not be
            read: {loadWarnings[0]}
          </p>
        )}
        {/* Keyed on the Room so a Room change is a real remount, not a partial redraw. */}
        <main className="app-shell__workspace" key={roomKey(room)}>
          <ActiveRoom />
        </main>
      </div>
      <InspectorPanel />
    </div>
  );
}

export default function Prototype01App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
