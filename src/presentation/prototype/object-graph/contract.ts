/**
 * The public vocabulary of the object graph.
 *
 * Everything the six Rooms render is a projection of one of these records. Consumers
 * work in ObjectRecord and Relation; they never see which store a record came from,
 * which identifier key that store used, or how a ref was spelled.
 */

/** Every object kind the prototype projects. One literal per fixture store. */
export type ObjectKind =
  | 'principal'
  | 'project'
  | 'mission'
  | 'missionTemplate'
  | 'stage'
  | 'task'
  | 'team'
  | 'teamSeat'
  | 'agentRoleProfile'
  | 'agent'
  | 'agentRun'
  | 'loop'
  | 'step'
  | 'artifact'
  | 'evidence'
  | 'decision'
  | 'request'
  | 'issue'
  | 'thread'
  | 'message'
  | 'notification'
  | 'pin'
  | 'layout';

/** Opaque identity. Names are presentation data and are never used as joins. */
export type ObjectId = string;

/** The one relationship primitive. Stored in a single direction; reversed by the index. */
export type Ref = { readonly kind: string; readonly value: ObjectId };

/**
 * A typed relationship between two objects.
 *
 * `relation` is the meaning, not the storage: a stage's `parentStageId` and a task's
 * `stage` ref both arrive here as `belongsTo`, which is why a Room can ask one question
 * and get a coherent answer across three differently-shaped stores.
 */
export type RelationType =
  | 'belongsTo'
  | 'contains'
  | 'assignedTo'
  | 'assigned'
  | 'requests'
  | 'requestedBy'
  | 'occupiedBy'
  | 'occupies'
  | 'attempts'
  | 'attemptedBy'
  | 'pursues'
  | 'pursuedBy'
  | 'produces'
  | 'producedBy'
  | 'cites'
  | 'citedBy'
  | 'discusses'
  | 'discussedIn'
  | 'references'
  | 'referencedBy'
  | 'blocks'
  | 'blockedBy'
  | 'resolves'
  | 'resolvedBy'
  | 'raisedAgainst'
  | 'hasIssue'
  | 'about'
  | 'notified'
  | 'createdFrom'
  | 'originOf'
  | 'staffedBy'
  | 'pins'
  | 'pinnedBy';

/** One normalised object. `fields` carries the store's own payload, unaltered. */
export type ObjectRecord = {
  readonly id: ObjectId;
  readonly kind: ObjectKind;
  readonly title: string;
  readonly createdAt: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly refs: readonly Ref[];
};

/** One end of a typed relationship, as a Room consumes it. */
export type Related = {
  readonly relation: RelationType;
  readonly record: ObjectRecord;
};

/** Human-facing label for a kind. The only place kind vocabulary is written out. */
export const KIND_LABEL: Record<ObjectKind, string> = {
  principal: 'Person',
  project: 'Project',
  mission: 'Mission',
  missionTemplate: 'Template',
  stage: 'Stage',
  task: 'Task',
  team: 'Team',
  teamSeat: 'Seat',
  agentRoleProfile: 'Role',
  agent: 'Agent',
  agentRun: 'Run',
  loop: 'Loop',
  step: 'Step',
  artifact: 'Artifact',
  evidence: 'Evidence',
  decision: 'Decision',
  request: 'Decision request',
  issue: 'Issue',
  thread: 'Conversation',
  message: 'Message',
  notification: 'Notification',
  pin: 'Pinned',
  layout: 'Layout',
};

/** Human-facing label for a relationship, used on inspector section headings. */
export const RELATION_LABEL: Partial<Record<RelationType, string>> = {
  belongsTo: 'Belongs to',
  contains: 'Contains',
  assignedTo: 'Assigned to',
  assigned: 'Assigned work',
  requests: 'Requests role',
  requestedBy: 'Requested by',
  occupiedBy: 'Occupied by',
  occupies: 'Occupies',
  attempts: 'Attempts',
  attemptedBy: 'Attempted by',
  pursues: 'Pursues',
  pursuedBy: 'Pursued by',
  produces: 'Produces',
  producedBy: 'Produced by',
  cites: 'Cites',
  citedBy: 'Cited by',
  discusses: 'Discusses',
  discussedIn: 'Discussed in',
  references: 'References',
  referencedBy: 'Referenced by',
  blocks: 'Blocks',
  blockedBy: 'Blocked by',
  resolves: 'Resolves',
  resolvedBy: 'Resolved by',
  raisedAgainst: 'Raised against',
  hasIssue: 'Issues',
  about: 'About',
  createdFrom: 'Created from',
  originOf: 'Missions created',
  staffedBy: 'Staffed by',
};

/** Which kinds can be entered as their own Room. Everything else inspects only. */
export const ENTERABLE_KINDS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'mission',
  'stage',
  'project',
  'agent',
  'thread',
  'agentRoleProfile',
]);
