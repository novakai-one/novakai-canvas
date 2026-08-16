/** Inline blueprint editor. Saving goes through one host command — never a raw patch. */
import { useState } from 'react';
import { field } from '../../../../object-graph/graph';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { ActionButton } from '../../../../components/ui/ui';
import {
  EFFORT_OPTIONS,
  PERMISSION_OPTIONS,
  type AgentRolesDesignCommands,
} from '../../agent-roles-design';

export function RoleEditor({ role, commands, onDone }: {
  role: ObjectRecord;
  commands: AgentRolesDesignCommands;
  onDone: () => void;
}) {
  const [name, setName] = useState(role.title);
  const [description, setDescription] = useState(field(role, 'description'));
  const [permission, setPermission] = useState(
    String((role.fields.__envelope as { permissionLevel?: string })?.permissionLevel ?? 'workspace-write'),
  );
  const [effort, setEffort] = useState(
    String((role.fields.effortPolicy as { defaultEffort?: string })?.defaultEffort ?? 'medium'),
  );

  const save = () => {
    commands.saveRole({
      roleId: role.id,
      name,
      description,
      permissionLevel: permission,
      defaultEffort: effort,
    });
    onDone();
  };

  return (
    <form
      className="role-editor"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="role-editor__label">
        Name
        <input className="role-editor__input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="role-editor__label">
        What this role is responsible for
        <textarea
          className="role-editor__input role-editor__input--area"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="role-editor__row">
        <label className="role-editor__label">
          Permission
          <select
            className="role-editor__input"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            {PERMISSION_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="role-editor__label">
          Default effort
          <select className="role-editor__input" value={effort} onChange={(e) => setEffort(e.target.value)}>
            {EFFORT_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="role-editor__actions">
        <ActionButton variant="ghost" onClick={onDone}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" onClick={save}>
          Save role
        </ActionButton>
      </div>
    </form>
  );
}
