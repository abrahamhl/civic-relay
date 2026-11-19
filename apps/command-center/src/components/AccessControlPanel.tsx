import { Fragment, useMemo, useState } from 'react';
import {
  PERMISSIONS,
  ROLE_BY_ID,
  ROLE_IDS,
  ROLES,
  can,
  permissionsForRole,
} from '../access/rbac.mjs';
import {
  DEMO_ORGS,
  DEMO_USERS,
  ORG_STATUS_LABEL,
  ORG_TYPE_LABEL,
  USER_STATUS_LABEL,
  aggregateDirectory,
  highestRole,
} from '../access/directory.mjs';

type RoleId = (typeof ROLE_IDS)[number];
type Org = (typeof DEMO_ORGS)[number];
type DirectoryUser = (typeof DEMO_USERS)[number];
type UserStatus = 'active' | 'invited' | 'suspended';
type OrgStatus = 'active' | 'limited' | 'suspended';

type Section = 'directory' | 'orgs' | 'users' | 'roles' | 'access-check';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'directory', label: 'Resumen' },
  { id: 'orgs', label: 'Entidades' },
  { id: 'users', label: 'Usuarios' },
  { id: 'roles', label: 'Matriz de roles' },
  { id: 'access-check', label: 'Comprobador de acceso' },
];

const STATUS_CLASS: Record<string, string> = {
  active: 'ok',
  invited: 'sim',
  limited: 'warn',
  suspended: 'bad',
};

function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`prov-chip ${STATUS_CLASS[status] ?? ''}`}>{label}</span>;
}

export function AccessControlPanel() {
  const [section, setSection] = useState<Section>('directory');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatus | 'all'>('all');
  const [selectedRoles, setSelectedRoles] = useState<RoleId[]>(['operator']);

  const stats = useMemo(() => aggregateDirectory(DEMO_ORGS, DEMO_USERS), []);

  const visibleUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return DEMO_USERS.filter((user) => {
      if (orgFilter !== 'all' && user.orgId !== orgFilter) return false;
      if (userStatusFilter !== 'all' && user.status !== userStatusFilter) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)
      );
    });
  }, [orgFilter, userSearch, userStatusFilter]);

  const orgById = useMemo(
    () => Object.fromEntries(DEMO_ORGS.map((org) => [org.id, org])) as Record<string, Org>,
    [],
  );

  const toggleRole = (roleId: RoleId) => {
    setSelectedRoles((previous) =>
      previous.includes(roleId)
        ? previous.filter((id) => id !== roleId)
        : [...previous, roleId],
    );
  };

  return (
    <div className="view">
      <div>
        <h2>Control de acceso y entidades</h2>
        <p className="lede">
          Directorio y control de acceso por rol para entidades de emergencia, administración y
          cooperación. Todo lo que ves es <span className="mono">SIMULATOR</span>: cuentas ficticias,
          sin servidor de autenticación, sin sesiones firmadas y sin persistencia. La lógica de
          roles y permisos sí es real y está probada, lista para conectarse a un proveedor de
          identidad.
        </p>
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones del control de acceso">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'directory' && <DirectorySummary stats={stats} />}
      {section === 'orgs' && <OrgTable />}
      {section === 'users' && (
        <>
          <div className="filter-bar">
            <label className="field">
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Nombre o correo"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Entidad</span>
              <select
                className="select"
                value={orgFilter}
                onChange={(event) => setOrgFilter(event.target.value)}
              >
                <option value="all">Todas las entidades</option>
                {DEMO_ORGS.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.short} · {org.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                className="select"
                value={userStatusFilter}
                onChange={(event) => setUserStatusFilter(event.target.value as UserStatus | 'all')}
              >
                <option value="all">Cualquier estado</option>
                <option value="active">Activa</option>
                <option value="invited">Invitada</option>
                <option value="suspended">Suspendida</option>
              </select>
            </label>
          </div>
          <UserTable users={visibleUsers} orgById={orgById} total={DEMO_USERS.length} />
        </>
      )}
      {section === 'roles' && <RoleMatrix />}
      {section === 'access-check' && (
        <AccessChecker selectedRoles={selectedRoles} onToggle={toggleRole} />
      )}

      <div className="notice warn">
        <strong>Rigor:</strong> dar de alta identidades reales exige proveedor de identidad,
        sesiones firmadas, registro de auditoría y borrado verificable. Sin eso, este panel describe
        el modelo, no lo aplica.
      </div>
    </div>
  );
}

function DirectorySummary({ stats }: { stats: ReturnType<typeof aggregateDirectory> }) {
  const typeRows = (Object.keys(ORG_TYPE_LABEL) as Array<keyof typeof ORG_TYPE_LABEL>).map((type) => ({
    type,
    label: ORG_TYPE_LABEL[type],
    count: stats.orgsByType[type],
  }));
  const maxType = Math.max(1, ...typeRows.map((row) => row.count));

  const roleRows = ROLE_IDS.map((roleId) => ({
    roleId,
    label: ROLE_BY_ID[roleId].label,
    count: stats.usersByRole[roleId] ?? 0,
  }));
  const maxRole = Math.max(1, ...roleRows.map((row) => row.count));

  return (
    <>
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="stat">
          <div className="k">Entidades</div>
          <div className="v" style={{ fontSize: 24 }}>{stats.orgs}</div>
          <div className="h">
            {stats.orgsByStatus.active} activas · {stats.orgsByStatus.limited} limitadas ·{' '}
            {stats.orgsByStatus.suspended} suspendidas
          </div>
        </div>
        <div className="stat">
          <div className="k">Usuarios</div>
          <div className="v" style={{ fontSize: 24 }}>{stats.users}</div>
          <div className="h">
            {stats.usersByStatus.active} activas · {stats.usersByStatus.invited} invitadas ·{' '}
            {stats.usersByStatus.suspended} suspendidas
          </div>
        </div>
        <div className="stat">
          <div className="k">Cobertura MFA</div>
          <div className="v" style={{ fontSize: 24 }}>{(stats.mfaCoverage * 100).toFixed(0)}%</div>
          <div className="h">segundo factor registrado</div>
        </div>
        <div className="stat">
          <div className="k">Usuarios multirrol</div>
          <div className="v" style={{ fontSize: 24 }}>{stats.multiRoleUsers}</div>
          <div className="h">más de un rol asignado</div>
        </div>
      </div>

      <div className="rf-grid">
        <div className="floor-plan">
          <h3 className="section-label">Entidades por tipo</h3>
          {typeRows.map((row) => (
            <div key={row.type} className="bar-row">
              <span className="bar-label">{row.label}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${(row.count / maxType) * 100}%` }}
                />
              </span>
              <span className="bar-value mono">{row.count}</span>
            </div>
          ))}
        </div>
        <div className="floor-plan">
          <h3 className="section-label">Usuarios por rol</h3>
          {roleRows.map((row) => (
            <div key={row.roleId} className="bar-row">
              <span className="bar-label">{row.label}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${(row.count / maxRole) * 100}%` }}
                />
              </span>
              <span className="bar-value mono">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function OrgTable() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Entidad</th>
            <th>Tipo</th>
            <th>País / región</th>
            <th>Alcance</th>
            <th>Estado</th>
            <th>Contacto</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ORGS.map((org) => (
            <tr key={org.id}>
              <td>
                <strong>{org.short}</strong>
                <div className="muted">{org.name}</div>
              </td>
              <td>{ORG_TYPE_LABEL[org.type]}</td>
              <td className="mono">{org.country} · {org.region}</td>
              <td className="mono">{org.reach} pers.</td>
              <td>
                <StatusChip status={org.status} label={ORG_STATUS_LABEL[org.status as OrgStatus]} />
              </td>
              <td>
                {org.contactName}
                <div className="muted mono">{org.contactEmail}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserTable({
  users,
  orgById,
  total,
}: {
  users: readonly DirectoryUser[];
  orgById: Record<string, Org>;
  total: number;
}) {
  return (
    <>
      <div className="prov-chip" style={{ marginBottom: 8 }}>
        {users.length} de {total} usuarios · SIMULATOR
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Entidad</th>
              <th>Roles</th>
              <th>Estado</th>
              <th>MFA</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const primary = highestRole(user.roles);
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <div className="muted mono">{user.email}</div>
                  </td>
                  <td className="mono">{orgById[user.orgId]?.short ?? user.orgId}</td>
                  <td>
                    {user.roles.map((roleId) => (
                      <span key={roleId} className="prov-chip" title={ROLE_BY_ID[roleId].description}>
                        {ROLE_BY_ID[roleId].label}
                      </span>
                    ))}
                    {primary && user.roles.length > 1 && (
                      <div className="muted">Ámbito por {ROLE_BY_ID[primary].label}</div>
                    )}
                  </td>
                  <td>
                    <StatusChip status={user.status} label={USER_STATUS_LABEL[user.status as UserStatus]} />
                  </td>
                  <td className="mono">{user.mfa ? 'Sí' : '—'}</td>
                  <td className="mono">
                    {user.lastSeenUTC ? user.lastSeenUTC.slice(0, 16).replace('T', ' ') + 'Z' : 'Nunca'}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">Ningún usuario coincide con el filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RoleMatrix() {
  const groups = [...new Set(PERMISSIONS.map((permission) => permission.group))];

  return (
    <div className="table-wrap">
      <table className="data-table role-matrix">
        <thead>
          <tr>
            <th>Permiso</th>
            {ROLES.map((role) => (
              <th key={role.id} title={role.description}>
                {role.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group}>
              <tr className="group-row">
                <td colSpan={ROLES.length + 1}>{group}</td>
              </tr>
              {PERMISSIONS.filter((permission) => permission.group === group).map((permission) => (
                <tr key={permission.id}>
                  <td title={permission.description}>{permission.label}</td>
                  {ROLES.map((role) => (
                    <td key={role.id} className="mono" style={{ textAlign: 'center' }}>
                      {role.permissions.includes(permission.id) ? (
                        <span style={{ color: 'var(--ok)' }}>●</span>
                      ) : (
                        <span className="muted">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessChecker({
  selectedRoles,
  onToggle,
}: {
  selectedRoles: RoleId[];
  onToggle: (roleId: RoleId) => void;
}) {
  return (
    <div className="rf-grid">
      <div className="rf-controls">
        <h3 className="section-label">Roles activos</h3>
        {ROLES.map((role) => (
          <label key={role.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedRoles.includes(role.id)}
              onChange={() => onToggle(role.id)}
            />
            <span>
              {role.label}
              <span className="muted"> · {role.scope}</span>
            </span>
          </label>
        ))}
        <p className="muted" style={{ fontSize: 11 }}>
          Los permisos efectivos son la unión de los roles marcados. Así funciona la concesión
          acumulativa real: un rol añade permisos, nunca los quita.
        </p>
      </div>
      <div className="rf-readout">
        <h3 className="section-label">Permisos efectivos</h3>
        {selectedRoles.length === 0 ? (
          <div className="notice bad">Sin roles seleccionados: acceso nulo por defecto.</div>
        ) : (
          PERMISSIONS.map((permission) => {
            const granted = can(selectedRoles, permission.id);
            return (
              <div key={permission.id} className="check-row" data-granted={granted}>
                <span className="mono" style={{ color: granted ? 'var(--ok)' : 'var(--muted)' }}>
                  {granted ? 'CONCEDIDO' : 'DENEGADO'}
                </span>
                <span>{permission.label}</span>
                <span className="muted">{permission.group}</span>
              </div>
            );
          })
        )}
        <div className="prov-chip" style={{ marginTop: 8 }}>
          {selectedRoles.reduce((sum, roleId) => sum + permissionsForRole(roleId).length, 0)}{' '}
          asignaciones · {PERMISSIONS.length} permisos · unión acumulativa
        </div>
      </div>
    </div>
  );
}
