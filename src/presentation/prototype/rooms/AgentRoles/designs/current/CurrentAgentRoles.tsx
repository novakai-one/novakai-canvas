/** The original role blueprint library, preserved as the default registered design. */
import { useState } from 'react';
import './current-agent-roles.css';
import { ActionButton, SearchField } from '../../../../components/ui/ui';
import type { AgentRolesDesignProps } from '../../agent-roles-design';
import { RoleCard } from './RoleCard';

/** Existing role library UI translated to the stable room design contract. */
export function CurrentAgentRoles({ data, commands }: AgentRolesDesignProps) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const roles = data.roles.filter((role) =>
    role.title.toLowerCase().includes(query.toLowerCase()),
  );

  const createAndEdit = () => {
    setEditing(commands.createRole());
  };

  return (
    <div className="agent-roles">
      <div className="agent-roles__sheet">
        <div className="agent-roles__toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search roles" />
          <ActionButton onClick={createAndEdit}>New role</ActionButton>
        </div>

        <div className="agent-roles__grid">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              data={data}
              commands={commands}
              editing={editing === role.id}
              onEdit={() => setEditing(role.id)}
              onDoneEditing={() => setEditing(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
