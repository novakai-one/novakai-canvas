/** Pure translation: real Novakai stores + agent registry → three canvas maps as DSL. */

export interface StoreRef { kind?: string; value?: string; label?: string }

export interface StoreBlock {
  id: string;
  title?: string;
  status?: string;
  owner?: string;
  outcome?: string;
  stage?: string;
  team?: unknown;
  refs?: StoreRef[];
}

export interface RegistryAgent {
  agentId?: string;
  title?: string;
  provider?: string;
  status?: string;
  archived?: boolean;
}

export interface MailMessage { from?: string; to?: string; createdAt?: string }

export interface MissionStores {
  projects: StoreBlock[];
  missions: StoreBlock[];
  tasks: StoreBlock[];
  okrs: StoreBlock[];
  agents: RegistryAgent[];
  messages: MailMessage[];
  /** ISO timestamp treated as "now"; keeps the translation deterministic. */
  now: string;
}

/** Mail older than this cannot pull an exited agent into the right-now map. */
const MAIL_WINDOW_DAYS = 7;

const OBJECT_MODEL = 'Mission Object Model';
const DATA_TREE = 'Mission Data Tree';
const RIGHT_NOW = 'Mission Right Now';

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function q(label: string): string {
  return `"${label.replaceAll('"', "'")}"`;
}

function refs(block: StoreBlock, kind: string, valuePrefix: string): string[] {
  return (block.refs ?? [])
    .filter((ref) => ref.kind === kind || (ref.value ?? '').startsWith(valuePrefix))
    .map((ref) => ref.value ?? '')
    .filter((value) => value.length > 0);
}

function teamEntries(block: StoreBlock): string[] {
  if (Array.isArray(block.team)) return block.team.filter((entry): entry is string => typeof entry === 'string');
  if (typeof block.team === 'string' && block.team.length > 0) return [block.team];
  return [];
}

// ---------------------------------------------------------------- diagram 1

function objectModelScope(stores: MissionStores): string[] {
  const missions = stores.missions;
  const total = missions.length;
  const count = (field: 'outcome' | 'stage') => missions.filter((mission) => mission[field]).length;
  const teamCount = missions.filter((mission) => teamEntries(mission).length > 0).length;
  const projectRefs = missions.reduce((sum, mission) => sum + refs(mission, 'project', 'proj_').length, 0);
  const objectiveRefs = missions.reduce((sum, mission) => sum + refs(mission, 'objective', 'okr_').length, 0);
  const taskLinks = missions.reduce((sum, mission) => sum + refs(mission, 'task', 'task_').length, 0)
    + stores.tasks.reduce((sum, task) => sum + refs(task, 'mission', 'mission_').length, 0);

  const box = (label: string, description: string | undefined, typeLine: string): string[] => [
    `  module ${q(label)}${description ? ` ${q(description)}` : ''}`,
    `    ${typeLine}`,
  ];
  return [
    `scope ${q(OBJECT_MODEL)} ${q('Every box is a real data root; every wire is a link type')}`,
    ...box('objective (okrs.jsonl)', 'KRs are flat blocks that ref back to their objective', 'type Objective { id, title, horizon }'),
    ...box('project (projects.jsonl)', undefined, 'type Project { id, title, status, path }'),
    ...box('mission (missions.jsonl)', `optional, not enforced: outcome ${count('outcome')}/${total}, stage ${count('stage')}/${total}, team ${teamCount}/${total}`, 'type Mission { id, title, status, owner, refs }'),
    ...box('task (tasks.jsonl)', undefined, 'type Task { id, title, status, refs }'),
    ...box('agent (agents.json)', undefined, 'type Agent { agentId, title, provider, status }'),
    ...box('journal (messages.jsonl)', 'agent-to-agent mail', 'type Message { from, to, body, createdAt }'),
    `  object ${q('Mission Room')} ${q('Read-only composition; joins the roots; never writes')}`,
    `  wire ${q('mission (missions.jsonl)')} -> ${q('project (projects.jsonl)')} : typed ref (${projectRefs}x) [references]`,
    `  wire ${q('mission (missions.jsonl)')} -> ${q('objective (okrs.jsonl)')} : typed ref (${objectiveRefs}x) [references]`,
    `  wire ${q('mission (missions.jsonl)')} -> ${q('task (tasks.jsonl)')} : typed refs, sparse (${taskLinks}x) [references]`,
    `  wire ${q('mission (missions.jsonl)')} -> ${q('agent (agents.json)')} : team = free-text strings (${teamCount}x) [mentions]`,
    `  wire ${q('agent (agents.json)')} -> ${q('mission (missions.jsonl)')} : no field either side [missing]`,
    `  wire ${q('agent (agents.json)')} -> ${q('journal (messages.jsonl)')} : mail about work, no mission field [mentions]`,
    `  wire ${q('mission (missions.jsonl)')} -> ${q('Mission Room')} : read-only join [queries]`,
    `  wire ${q('task (tasks.jsonl)')} -> ${q('Mission Room')} : read-only join [queries]`,
    `  wire ${q('journal (messages.jsonl)')} -> ${q('Mission Room')} : read-only join [queries]`,
  ];
}

// ---------------------------------------------------------------- diagram 2

function rowLine(id: string, kind: string, status?: string, parent?: string, badges?: string[], label?: string): string {
  return `    row ${id} ${kind}${status ? ` ${status}` : ''}${parent ? ` parent=${parent}` : ''}`
    + `${badges && badges.length > 0 ? ` badges=${badges.join(',')}` : ''}${label ? ` label ${q(label)}` : ''}`;
}

function dataTreeScope(stores: MissionStores): string[] {
  const lines = [
    `scope ${q(DATA_TREE)} ${q('What is actually in the stores — hierarchy of live blocks')}`,
    `  tree ${q('Store hierarchy')}`,
  ];
  const missionIdsInTree = new Set<string>();
  const missionBadges = (mission: StoreBlock): string[] => [
    ...(mission.outcome ? ['outcome'] : []),
    ...(teamEntries(mission).length > 0 ? ['team'] : []),
  ];
  const tasksByMission = new Map<string, StoreBlock[]>();
  const orphanTasks: StoreBlock[] = [];
  for (const task of stores.tasks) {
    const missionRef = refs(task, 'mission', 'mission_')[0];
    if (missionRef && stores.missions.some((mission) => mission.id === missionRef)) {
      const bucket = tasksByMission.get(missionRef) ?? [];
      bucket.push(task);
      tasksByMission.set(missionRef, bucket);
    } else {
      orphanTasks.push(task);
    }
  }
  const emitMission = (mission: StoreBlock, parent: string): void => {
    missionIdsInTree.add(mission.id);
    lines.push(rowLine(mission.id, 'mission', mission.status, parent, missionBadges(mission)));
    for (const task of tasksByMission.get(mission.id) ?? []) {
      lines.push(rowLine(task.id, 'task', task.status, mission.id));
    }
  };
  for (const project of stores.projects) {
    lines.push(rowLine(project.id, 'project', project.status));
    for (const mission of stores.missions) {
      if (refs(mission, 'project', 'proj_')[0] === project.id) emitMission(mission, project.id);
    }
  }
  const orphanMissions = stores.missions.filter((mission) => !missionIdsInTree.has(mission.id));
  if (orphanMissions.length > 0) {
    lines.push(rowLine('no-project', 'bucket', undefined, undefined, [], '(no project)'));
    for (const mission of orphanMissions) emitMission(mission, 'no-project');
  }
  if (orphanTasks.length > 0) {
    lines.push(rowLine('no-mission', 'bucket', undefined, undefined, [],
      `(no mission) ${orphanTasks.length} task${orphanTasks.length === 1 ? '' : 's'}`));
  }
  return lines;
}

// ---------------------------------------------------------------- diagram 3

interface RightNowAgent { label: string; agent: RegistryAgent }

/** Deterministic relevance rule (Manager ruling, plan S2). */
export function rightNowSelection(stores: MissionStores): {
  missions: StoreBlock[];
  running: RightNowAgent[];
  exited: RightNowAgent[];
  mailCounts: Map<string, number>;
} {
  const missions = stores.missions.filter((mission) => mission.status === 'in-progress');
  const usable = stores.agents.filter((agent) => agent.title && !agent.archived);
  const labelled = (pool: RegistryAgent[]): RightNowAgent[] => {
    const seen = new Map<string, number>();
    return pool.map((agent) => {
      const title = agent.title as string;
      const nth = (seen.get(title) ?? 0) + 1;
      seen.set(title, nth);
      return { label: nth === 1 ? title : `${title} #${nth}`, agent };
    });
  };
  const running = labelled(usable.filter((agent) => agent.status === 'running'));
  // Exited agents dedupe by title at selection, so their labels never need a suffix.
  const exitedPool = usable.filter((agent) => agent.status !== 'running')
    .map((agent) => ({ label: agent.title as string, agent }));

  const windowStart = Date.parse(stores.now) - MAIL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = stores.messages.filter((message) =>
    message.createdAt !== undefined && Date.parse(message.createdAt) >= windowStart);
  const runningBySlug = new Map(running.map((entry) => [slug(entry.agent.title as string), entry]));
  const exitedBySlug = new Map(exitedPool.map((entry) => [slug(entry.agent.title as string), entry]));

  // Unordered pair → message count, counting only ends that resolve to known agents.
  const mailCounts = new Map<string, number>();
  const exited = new Map<string, RightNowAgent>();
  for (const message of recent) {
    const fromSlug = slug(message.from ?? '');
    const toSlug = slug(message.to ?? '');
    const ends = [fromSlug, toSlug];
    if (ends.some((end) => !runningBySlug.has(end) && !exitedBySlug.has(end))) continue;
    if (fromSlug === toSlug) continue;
    if (runningBySlug.has(fromSlug) || runningBySlug.has(toSlug)) {
      for (const end of ends) {
        if (!runningBySlug.has(end) && exitedBySlug.has(end)) {
          exited.set(end, exitedBySlug.get(end) as RightNowAgent);
        }
      }
      const key = [...ends].sort().join('|');
      mailCounts.set(key, (mailCounts.get(key) ?? 0) + 1);
    }
  }
  return { missions, running, exited: [...exited.values()], mailCounts };
}

function agentMatch(mission: StoreBlock, title: string): 'hard' | 'soft' | 'none' {
  const titleSlug = slug(title);
  if (refs(mission, 'agent', 'agent_').some((value) => slug(value) === titleSlug)) return 'hard';
  const named = [mission.owner ?? '', ...teamEntries(mission)].map(slug).filter((entry) => entry.length > 0);
  if (named.some((entry) => entry === titleSlug || entry.includes(titleSlug) || titleSlug.includes(entry))) {
    return 'soft';
  }
  return 'none';
}

function rightNowScope(stores: MissionStores): string[] {
  const { missions, running, exited, mailCounts } = rightNowSelection(stores);
  const lines = [`scope ${q(RIGHT_NOW)} ${q('Registry truth: who is linked to what, right now')}`];
  for (const mission of missions) {
    lines.push(`  module ${q(mission.id)} ${q(`status: in-progress | owner: ${mission.owner ?? 'absent'} | outcome: ${mission.outcome ? 'present' : 'absent'}`)}`);
  }
  for (const { label, agent } of running) {
    lines.push(`  runtime ${q(label)} ${q(`provider: ${agent.provider ?? '?'} | status: running`)}`);
  }
  for (const { label, agent } of exited) {
    lines.push(`  runtime ${q(label)} ${q(`provider: ${agent.provider ?? '?'} | status: exited`)}`);
  }
  for (const mission of missions) {
    for (const { label, agent } of running) {
      const match = agentMatch(mission, agent.title as string);
      if (match === 'hard') lines.push(`  wire ${q(mission.id)} -> ${q(label)} : typed ref [references]`);
      else if (match === 'soft') lines.push(`  wire ${q(mission.id)} -> ${q(label)} : name match only (owner is a string) [mentions]`);
      else lines.push(`  wire ${q(mission.id)} -> ${q(label)} : no link at all [missing]`);
    }
    // Exited agents are present only via mail; a name match still earns its edge.
    for (const { label, agent } of exited) {
      const match = agentMatch(mission, agent.title as string);
      if (match === 'hard') lines.push(`  wire ${q(mission.id)} -> ${q(label)} : typed ref [references]`);
      else if (match === 'soft') lines.push(`  wire ${q(mission.id)} -> ${q(label)} : name match only (owner is a string) [mentions]`);
    }
  }
  const bySlug = new Map([...running, ...exited].map((entry) => [slug(entry.agent.title as string), entry.label]));
  for (const [key, count] of [...mailCounts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [a, b] = key.split('|');
    const labelA = bySlug.get(a);
    const labelB = bySlug.get(b);
    if (!labelA || !labelB) continue;
    lines.push(`  wire ${q(labelA)} -> ${q(labelB)} : mail thread (${count}x) [mentions]`);
  }
  return lines;
}

/** Three scopes, ready for `./canvas apply`. */
export function storesToDsl(stores: MissionStores): string {
  return [
    ...objectModelScope(stores), '',
    ...dataTreeScope(stores), '',
    ...rightNowScope(stores),
  ].join('\n') + '\n';
}
