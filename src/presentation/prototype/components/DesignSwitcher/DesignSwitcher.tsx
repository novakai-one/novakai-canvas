/**
 * Throwaway floating panel for switching every room's registered design.
 *
 * Deliberately zero-coupled: switching writes the `?xDesign=` URL param and reloads,
 * so the registries do all the resolving and no store or context is touched. Only the
 * panel's own position and open-flag persist (sessionStorage) — design choices live in
 * the URL and nowhere else. Delete this folder and revert the rail chip to remove.
 */
import { useEffect, useRef, useState } from 'react';
import './design-switcher.css';
import { listHomeDesigns } from '../../rooms/Home/home-design-registry';
import { listCommandCenterDesigns } from '../../rooms/CommandCenter/command-center-design-registry';
import { listMissionsDesigns } from '../../rooms/Missions/missions-design-registry';
import { listMissionWorldDesigns } from '../../rooms/MissionRoom/mission-world-design-registry';
import { listStageDesigns } from '../../rooms/StageRoom/stage-design-registry';
import { listProjectsDesigns } from '../../rooms/Projects/projects-design-registry';
import { listObjectRoomDesigns } from '../../rooms/ObjectRoom/object-room-design-registry';
import { listMessagesDesigns } from '../../rooms/Messages/messages-design-registry';
import { listAgentRolesDesigns } from '../../rooms/AgentRoles/agent-roles-design-registry';

const POSITION_KEY = 'novakai-design-switcher-position';
const DEFAULT_DESIGN_ID = 'current';

type SwitchableRoom = {
  readonly label: string;
  readonly param: string;
  readonly designs: readonly { id: string; label: string }[];
};

const SWITCHABLE_ROOMS: readonly SwitchableRoom[] = [
  { label: 'Home', param: 'homeDesign', designs: listHomeDesigns() },
  { label: 'Command Center', param: 'commandDesign', designs: listCommandCenterDesigns() },
  { label: 'Missions', param: 'missionsDesign', designs: listMissionsDesigns() },
  { label: 'Mission World', param: 'missionDesign', designs: listMissionWorldDesigns() },
  { label: 'Stage sheet', param: 'stageDesign', designs: listStageDesigns() },
  { label: 'Projects', param: 'projectsDesign', designs: listProjectsDesigns() },
  { label: 'Object Room', param: 'objectRoomDesign', designs: listObjectRoomDesigns() },
  { label: 'Messages', param: 'messagesDesign', designs: listMessagesDesigns() },
  { label: 'Agent Roles', param: 'agentRolesDesign', designs: listAgentRolesDesigns() },
];

function activeDesignId(room: SwitchableRoom): string {
  const requested = new URLSearchParams(window.location.search).get(room.param);
  return room.designs.some((design) => design.id === requested)
    ? (requested as string)
    : DEFAULT_DESIGN_ID;
}

/** Applies one room's design choice. The URL is the only truth, so this reloads. */
function switchDesign(param: string, designId: string): void {
  const params = new URLSearchParams(window.location.search);
  if (designId === DEFAULT_DESIGN_ID) params.delete(param);
  else params.set(param, designId);
  window.location.search = params.toString();
}

function resetAllDesigns(): void {
  const params = new URLSearchParams(window.location.search);
  SWITCHABLE_ROOMS.forEach((room) => params.delete(room.param));
  window.location.search = params.toString();
}

type Position = { x: number; y: number };

function clampToViewport(position: Position): Position {
  return {
    x: Math.min(Math.max(position.x, 0), window.innerWidth - 260),
    y: Math.min(Math.max(position.y, 0), window.innerHeight - 48),
  };
}

function initialPosition(): Position {
  const saved = sessionStorage.getItem(POSITION_KEY);
  if (saved) {
    try {
      return clampToViewport(JSON.parse(saved) as Position);
    } catch {
      /* fall through to the default spot above the chip */
    }
  }
  return clampToViewport({ x: 76, y: window.innerHeight - 460 });
}

export function DesignSwitcher({ onClose }: { onClose: () => void }) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const dragOffset = useRef<Position | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="design-switcher" style={{ left: position.x, top: position.y }}>
      <header
        className="design-switcher__header"
        onPointerDown={(event) => {
          dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y };
          if (event.currentTarget.hasPointerCapture(event.pointerId) === false) {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* pointer capture is an assist, not a requirement — drag works without it */
            }
          }
        }}
        onPointerMove={(event) => {
          if (!dragOffset.current) return;
          setPosition(clampToViewport({
            x: event.clientX - dragOffset.current.x,
            y: event.clientY - dragOffset.current.y,
          }));
        }}
        onPointerUp={(event) => {
          dragOffset.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setPosition((settled) => {
            sessionStorage.setItem(POSITION_KEY, JSON.stringify(settled));
            return settled;
          });
        }}
      >
        <span className="design-switcher__title">Designs</span>
        <button type="button" className="design-switcher__close" aria-label="Close the design switcher" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="design-switcher__rooms">
        {SWITCHABLE_ROOMS.map((room) => {
          const activeId = activeDesignId(room);
          return (
            <section className="design-switcher__room" key={room.param}>
              <h3 className="design-switcher__room-label">{room.label}</h3>
              {room.designs.map((design) => (
                <button
                  type="button"
                  key={design.id}
                  className="design-switcher__design"
                  data-active={design.id === activeId}
                  onClick={() => switchDesign(room.param, design.id)}
                >
                  {design.label}
                </button>
              ))}
            </section>
          );
        })}
      </div>

      <button type="button" className="design-switcher__reset" onClick={resetAllDesigns}>
        Reset all to current
      </button>
    </div>
  );
}
