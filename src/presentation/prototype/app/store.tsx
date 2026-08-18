/**
 * Session state for the prototype: the object records, where you are, and what is selected.
 *
 * The rule this module exists to keep is that selecting and moving are different actions.
 * `select` changes one field and returns nothing else; `enterRoom` is the only function
 * that pushes onto a Room stack. Nothing calls the second from inside the first.
 *
 * Fixtures are the starting point, not a database: everything a person does here edits
 * records in memory and is gone on reload. That is deliberate for a prototype.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ObjectId, ObjectKind, ObjectRecord } from '../object-graph/contract';
import { buildGraph, type ObjectGraph } from '../object-graph/graph';
import { loadFixtures } from '../object-graph/load';
import { buildFeed, electAttention, type AttentionItem } from '../attention/feed';

/** The seven product areas on the rail. */
export type AreaKey =
  | 'home'
  | 'command-center'
  | 'missions'
  | 'projects'
  | 'canvas'
  | 'messages'
  | 'agent-roles';

export const AREAS: readonly { key: AreaKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'command-center', label: 'Command Center' },
  { key: 'missions', label: 'Missions' },
  { key: 'projects', label: 'Projects' },
  { key: 'messages', label: 'Messages' },
  { key: 'agent-roles', label: 'Agent Roles' },
  { key: 'canvas', label: 'Canvas' },
];

/** A Room identifies the object that owns the current context. */
export type Room =
  | { kind: 'area'; area: AreaKey }
  | { kind: 'mission'; subjectId: ObjectId }
  | { kind: 'stage'; subjectId: ObjectId }
  | { kind: 'project'; subjectId: ObjectId }
  | { kind: 'agent'; subjectId: ObjectId }
  | { kind: 'role'; subjectId: ObjectId }
  | { kind: 'thread'; subjectId: ObjectId };

export type Projection = 'world' | 'document';

export function roomKey(room: Room): string {
  return room.kind === 'area' ? `area:${room.area}` : `${room.kind}:${room.subjectId}`;
}

const { records: FIXTURES, skipped: SKIPPED } = loadFixtures();

type State = {
  records: ObjectRecord[];
  area: AreaKey;
  stacks: Record<AreaKey, Room[]>;
  selected: ObjectId | null;
  /** Stage IDs whose internal structure is shown on the Mission canvas, per Room. */
  revealed: Record<string, string[]>;
  projection: Record<string, Projection>;
  railCollapsed: boolean;
};

const initialState: State = {
  records: FIXTURES,
  area: 'home',
  stacks: {
    home: [{ kind: 'area', area: 'home' }],
    'command-center': [{ kind: 'area', area: 'command-center' }],
    missions: [{ kind: 'area', area: 'missions' }],
    projects: [{ kind: 'area', area: 'projects' }],
    canvas: [{ kind: 'area', area: 'canvas' }],
    messages: [{ kind: 'area', area: 'messages' }],
    'agent-roles': [{ kind: 'area', area: 'agent-roles' }],
  },
  selected: null,
  revealed: {},
  projection: {},
  railCollapsed: false,
};

export type Store = {
  graph: ObjectGraph;
  feed: AttentionItem[];
  elected: AttentionItem | null;
  loadWarnings: string[];

  area: AreaKey;
  stack: Room[];
  room: Room;
  selected: ObjectRecord | null;
  railCollapsed: boolean;
  projection: Projection;
  revealed: string[];

  goToArea(area: AreaKey): void;
  enterRoom(room: Room): void;
  goBack(): void;
  goToDepth(depth: number): void;
  select(id: ObjectId | null): void;
  setProjection(projection: Projection): void;
  toggleReveal(stageId: string): void;
  toggleRail(): void;

  patch(id: ObjectId, fields: Record<string, unknown>): void;
  addRecord(record: ObjectRecord): void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);

  const graph = useMemo(() => buildGraph(state.records), [state.records]);
  const feed = useMemo(() => buildFeed(graph), [graph]);
  const elected = useMemo(() => electAttention(feed), [feed]);

  const stack = state.stacks[state.area];
  const room = stack[stack.length - 1];
  const key = roomKey(room);

  const goToArea = useCallback((area: AreaKey) => {
    setState((s) => (s.area === area ? s : { ...s, area, selected: null }));
  }, []);

  /** The only function that changes which Room you are in. */
  const enterRoom = useCallback((next: Room) => {
    setState((s) => ({
      ...s,
      selected: null,
      stacks: { ...s.stacks, [s.area]: [...s.stacks[s.area], next] },
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((s) => {
      const current = s.stacks[s.area];
      if (current.length < 2) return s;
      const leaving = current[current.length - 1];
      return {
        ...s,
        // Returning re-selects the child just left, so you land where you were.
        selected: leaving.kind === 'area' ? null : leaving.subjectId,
        stacks: { ...s.stacks, [s.area]: current.slice(0, -1) },
      };
    });
  }, []);

  const goToDepth = useCallback((depth: number) => {
    setState((s) => ({
      ...s,
      selected: null,
      stacks: { ...s.stacks, [s.area]: s.stacks[s.area].slice(0, depth + 1) },
    }));
  }, []);

  /** Selection only. It does not read the Room stack and it cannot write to it. */
  const select = useCallback((id: ObjectId | null) => {
    setState((s) => ({ ...s, selected: id }));
  }, []);

  const setProjection = useCallback(
    (projection: Projection) => {
      setState((s) => ({ ...s, projection: { ...s.projection, [key]: projection } }));
    },
    [key],
  );

  const toggleReveal = useCallback(
    (stageId: string) => {
      setState((s) => {
        const open = s.revealed[key] ?? [];
        const next = open.includes(stageId)
          ? open.filter((id) => id !== stageId)
          : [...open, stageId];
        return { ...s, revealed: { ...s.revealed, [key]: next } };
      });
    },
    [key],
  );

  const toggleRail = useCallback(() => {
    setState((s) => ({ ...s, railCollapsed: !s.railCollapsed }));
  }, []);

  const patch = useCallback((id: ObjectId, fields: Record<string, unknown>) => {
    setState((s) => ({
      ...s,
      records: s.records.map((record) =>
        record.id === id
          ? {
              ...record,
              title: typeof fields.title === 'string' ? fields.title : record.title,
              fields: { ...record.fields, ...fields },
            }
          : record,
      ),
    }));
  }, []);

  const addRecord = useCallback((record: ObjectRecord) => {
    setState((s) => ({ ...s, records: [...s.records, record] }));
  }, []);

  const value: Store = {
    graph,
    feed,
    elected,
    loadWarnings: SKIPPED,
    area: state.area,
    stack,
    room,
    selected: state.selected ? (graph.get(state.selected) ?? null) : null,
    railCollapsed: state.railCollapsed,
    projection: state.projection[key] ?? 'world',
    revealed: state.revealed[key] ?? [],
    goToArea,
    enterRoom,
    goBack,
    goToDepth,
    select,
    setProjection,
    toggleReveal,
    toggleRail,
    patch,
    addRecord,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Mints an id for something created in this session. Same shape as the fixtures use. */
export function sessionId(prefix: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${prefix}_${slug || 'untitled'}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

/** Builds a record in the same normalised shape the loader produces. */
export function makeRecord(
  id: ObjectId,
  kind: ObjectKind,
  title: string,
  fields: Record<string, unknown>,
  refs: { kind: string; value: string }[] = [],
): ObjectRecord {
  return {
    id,
    kind,
    title,
    createdAt: new Date().toISOString(),
    fields: { id, kind, title, refs, ...fields },
    refs,
  };
}
