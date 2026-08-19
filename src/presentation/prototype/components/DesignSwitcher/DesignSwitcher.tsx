/**
 * Throwaway floating panel for switching every room's registered design.
 *
 * Deliberately zero-coupled: switching writes the `?xDesign=` URL param and reloads,
 * so the registries do all the resolving and no store or context is touched. Only the
 * panel's own position and open-flag persist (sessionStorage) — design choices live in
 * the URL and nowhere else. Delete this folder and revert the rail chip to remove.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
const PANEL_MAX_WIDTH = 640;
const PANEL_GUTTER = 12;

type SwitchableRoom = {
  readonly label: string;
  readonly param: string;
  readonly designs: readonly SwitchableDesign[];
};

type SwitchableDesign = { readonly id: string; readonly label: string };

type AlternativePlacement = {
  readonly baseDesignId: string;
  readonly alternativeDesignIds: readonly string[];
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

const ALTERNATIVE_COLUMN_COUNT = 3;
// A future variant is registered normally, then placed beside its base design here.
const ALTERNATIVE_PLACEMENTS: Readonly<
  Partial<Record<string, readonly AlternativePlacement[]>>
> = {};
const matrixStyle = {
  '--alternative-column-count': ALTERNATIVE_COLUMN_COUNT,
} as CSSProperties;

function designRowsFor(room: SwitchableRoom) {
  const placements = ALTERNATIVE_PLACEMENTS[room.param] ?? [];
  const alternativeIds = new Set(
    placements.flatMap((placement) => placement.alternativeDesignIds),
  );

  return room.designs
    .filter((design) => !alternativeIds.has(design.id))
    .map((baseDesign) => {
      const placement = placements.find((entry) => entry.baseDesignId === baseDesign.id);
      return {
        baseDesign,
        alternatives: Array.from(
          { length: ALTERNATIVE_COLUMN_COUNT },
          (_, index) => room.designs.find(
            (design) => design.id === placement?.alternativeDesignIds[index],
          ) ?? null,
        ),
      };
    });
}

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
  const panelWidth = Math.min(
    PANEL_MAX_WIDTH,
    Math.max(0, window.innerWidth - PANEL_GUTTER * 2),
  );
  const maximumX = Math.max(
    PANEL_GUTTER,
    window.innerWidth - panelWidth - PANEL_GUTTER,
  );

  return {
    x: Math.min(Math.max(position.x, PANEL_GUTTER), maximumX),
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
        <div
          className="design-switcher__column-headings"
          style={matrixStyle}
          aria-hidden="true"
        >
          <span>Room</span>
          {Array.from({ length: ALTERNATIVE_COLUMN_COUNT }, (_, index) => (
            <span key={index}>Alternative {index + 1}</span>
          ))}
        </div>
        {SWITCHABLE_ROOMS.map((room) => {
          const activeId = activeDesignId(room);
          return (
            <section className="design-switcher__room" key={room.param}>
              <h3 className="design-switcher__room-label">{room.label}</h3>
              {designRowsFor(room).map(({ baseDesign, alternatives }) => (
                <div className="design-switcher__design-row" style={matrixStyle} key={baseDesign.id}>
                  <button
                    type="button"
                    className="design-switcher__design design-switcher__design--base"
                    data-active={baseDesign.id === activeId}
                    onClick={() => switchDesign(room.param, baseDesign.id)}
                  >
                    {baseDesign.label}
                  </button>
                  {alternatives.map((alternative, index) => (
                    alternative ? (
                      <button
                        type="button"
                        key={alternative.id}
                        className="design-switcher__design design-switcher__alternative-slot"
                        data-active={alternative.id === activeId}
                        onClick={() => switchDesign(room.param, alternative.id)}
                      >
                        {alternative.label}
                      </button>
                    ) : (
                      <span
                        className="design-switcher__alternative-slot"
                        key={`${baseDesign.id}-alternative-${index + 1}`}
                        aria-hidden="true"
                      />
                    )
                  ))}
                </div>
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
