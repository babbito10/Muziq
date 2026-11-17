'use client';

import { ROLE_DEFINITIONS } from '@musicverse/auth';
import { CAPABILITY_ROLES, type CapabilityRole } from '@musicverse/types';
import { Alert, Badge, Button, Card, CardHeader } from '@musicverse/ui';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { errorMessage } from '@/lib/errors';

/** One account, many roles: listeners can also be artists, producers, DJs, businesses and educators. */
export function CapabilitiesSection() {
  const { user, setUser } = useAuth();
  const [pendingRole, setPendingRole] = useState<CapabilityRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function toggle(role: CapabilityRole, enabled: boolean) {
    setError(null);
    setPendingRole(role);
    try {
      setUser(enabled ? await api.users.removeCapability(role) : await api.users.addCapability({ role }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPendingRole(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="How you use MusicVerse"
        description="Add the capabilities you need. You keep one account whatever you do."
      />
      {!user.emailVerified && (
        <Alert tone="info" className="mb-4">Verify your email to add creator capabilities.</Alert>
      )}
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {CAPABILITY_ROLES.map((role) => {
          const def = ROLE_DEFINITIONS[role];
          const enabled = user.roles.includes(role);
          return (
            <li key={role} className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-fg">{def.name}</h3>
                {enabled && <Badge tone="primary">Active</Badge>}
              </div>
              <p className="flex-1 text-sm text-fg-muted">{def.description}</p>
              <Button
                size="sm"
                variant={enabled ? 'secondary' : 'primary'}
                disabled={!user.emailVerified && !enabled}
                loading={pendingRole === role}
                onClick={() => toggle(role, enabled)}
                aria-label={`${enabled ? 'Remove' : 'Add'} ${def.name} capability`}
              >
                {enabled ? 'Remove' : 'Add'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
