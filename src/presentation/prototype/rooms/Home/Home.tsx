/**
 * Personal orientation, and the way into everything else.
 *
 * Home duplicates the rail's job so a collapsed rail costs nothing, and it holds the
 * objects you pinned. The host resolves each pin's subject and the navigation policy;
 * designs only ever see subject + canOpen.
 */
import { AREAS, useStore, type AreaKey } from '../../app/store';
import { roomFor } from '../../room-navigation/room-for';
import type { HomeDesignCommands, HomeDesignData, HomeDestination, HomePin } from './home-design';
import { resolveHomeDesign } from './home-design-registry';

const DESTINATION_LINE: Record<AreaKey, string> = {
  home: 'Where you are.',
  'command-center': 'Decisions, blocked work and agents that stopped.',
  missions: 'Every mission, planned through completed.',
  projects: 'The containers missions belong to.',
  canvas: 'Map systems, dependencies and decisions.',
  messages: 'Conversations attached to their work.',
  'agent-roles': 'Blueprints a seat can request.',
};

/** Composition root that supplies orientation data and host commands to a Home design. */
export function Home() {
  const { graph, goToArea, feed, select, selected, enterRoom, elected } = useStore();
  const design = resolveHomeDesign(typeof window === 'undefined' ? '' : window.location.search);
  const DesignView = design.View;

  const counts: Partial<Record<AreaKey, string>> = {
    'command-center': `${feed.length} waiting`,
    missions: `${graph.byKind('mission').length} missions`,
    projects: `${graph.byKind('project').length} projects`,
    messages: `${graph.byKind('thread').length} conversations`,
    'agent-roles': `${graph.byKind('agentRoleProfile').length} blueprints`,
  };

  const destinations: HomeDestination[] = AREAS
    .filter((area) => area.key !== 'home')
    .map((area) => ({
      key: area.key,
      label: area.label,
      line: DESTINATION_LINE[area.key],
      count: counts[area.key] ?? '',
      needsAttention: area.key === 'command-center' && Boolean(elected),
    }));

  const pins: HomePin[] = graph
    .byKind('pin')
    .slice()
    .sort((a, b) => Number(a.fields.order ?? 0) - Number(b.fields.order ?? 0))
    .flatMap((pin) => {
      const subject = graph.relatedBy(pin.id, 'pins')[0];
      return subject ? [{ pin, subject, canOpen: roomFor(subject) !== null }] : [];
    });

  const data: HomeDesignData = {
    graph,
    destinations,
    pins,
    selected,
    attentionSubjectId: elected?.subject.id ?? null,
  };

  const commands: HomeDesignCommands = {
    select: (record) => select(record?.id ?? null),
    open: (record) => {
      const room = roomFor(record);
      if (room) enterRoom(room);
    },
    goToArea,
  };

  return <DesignView data={data} commands={commands} />;
}
