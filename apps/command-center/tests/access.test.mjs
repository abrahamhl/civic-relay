import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PERMISSIONS,
  PERMISSION_IDS,
  ROLE_IDS,
  ROLES,
  can,
  permissionGaps,
  permissionsForRole,
} from '../src/access/rbac.mjs';
import {
  DEMO_ORGS,
  DEMO_USERS,
  ORG_TYPE_LABEL,
  aggregateDirectory,
  highestRole,
} from '../src/access/directory.mjs';

test('every role declares a subset of the known permissions', () => {
  for (const role of ROLES) {
    assert.ok(role.permissions.length > 0, `${role.id} has no permissions`);
    for (const permission of role.permissions) {
      assert.ok(PERMISSION_IDS.includes(permission), `${role.id} declares unknown ${permission}`);
    }
    assert.equal(new Set(role.permissions).size, role.permissions.length, `${role.id} has duplicates`);
  }
});

test('permission metadata is complete and uniquely keyed', () => {
  const ids = PERMISSIONS.map((permission) => permission.id);
  assert.equal(new Set(ids).size, PERMISSIONS.length);
  for (const permission of PERMISSIONS) {
    assert.ok(permission.label && permission.group && permission.description);
  }
});

test('super_admin holds everything; observer holds very little', () => {
  const superAdmin = permissionsForRole('super_admin');
  assert.deepEqual([...superAdmin].sort(), [...PERMISSION_IDS].sort());

  const observer = permissionsForRole('observer');
  assert.ok(observer.length <= 3);
  assert.ok(!observer.includes('user.manage'));
  assert.ok(!observer.includes('settings.manage'));
});

test('can() and permissionGaps() agree with the role definitions', () => {
  assert.equal(can(['operator'], 'incident.view'), true);
  assert.equal(can(['operator'], 'user.manage'), false);
  assert.equal(can(['operator', 'entity_admin'], 'user.manage'), true, 'union of roles');

  const gaps = permissionGaps(['observer']);
  assert.equal(gaps.length, PERMISSION_IDS.length - permissionsForRole('observer').length);
  assert.ok(gaps.every((permission) => !permissionsForRole('observer').includes(permission.id)));
});

test('every role id is resolvable and highestRole ranks deterministically', () => {
  for (const roleId of ROLE_IDS) {
    assert.ok(permissionsForRole(roleId).length > 0, `${roleId} unresolved`);
  }
  assert.equal(highestRole(['observer', 'coordinator', 'operator']), 'coordinator');
  assert.equal(highestRole(['super_admin', 'entity_admin']), 'super_admin');
  assert.equal(highestRole([]), null);
});

test('demo directory has no dangling references', () => {
  const orgIds = new Set(DEMO_ORGS.map((org) => org.id));
  const emails = new Set();
  for (const user of DEMO_USERS) {
    assert.ok(orgIds.has(user.orgId), `${user.id} points to missing org ${user.orgId}`);
    assert.ok(user.roles.length > 0, `${user.id} has no role`);
    for (const role of user.roles) assert.ok(ROLE_IDS.includes(role), `${user.id} has bad role ${role}`);
    assert.ok(!emails.has(user.email), `duplicate email ${user.email}`);
    emails.add(user.email);
  }
  const orgNames = new Set(DEMO_ORGS.map((org) => org.name));
  assert.equal(orgNames.size, DEMO_ORGS.length);
});

test('aggregateDirectory reconciles counts with the source rows', () => {
  const stats = aggregateDirectory(DEMO_ORGS, DEMO_USERS);
  assert.equal(stats.orgs, DEMO_ORGS.length);
  assert.equal(stats.users, DEMO_USERS.length);
  assert.equal(
    Object.values(stats.orgsByType).reduce((a, b) => a + b, 0),
    DEMO_ORGS.length,
  );
  assert.equal(
    Object.values(stats.usersByStatus).reduce((a, b) => a + b, 0),
    DEMO_USERS.length,
  );

  const roleAccount = Object.values(stats.usersByRole).reduce((a, b) => a + b, 0);
  const expectedAssignments = DEMO_USERS.reduce((sum, user) => sum + user.roles.length, 0);
  assert.equal(roleAccount, expectedAssignments);

  assert.ok(stats.mfaCoverage >= 0 && stats.mfaCoverage <= 1);
  assert.ok(stats.orgsByType.research >= 1);
  assert.ok(stats.usersByStatus.invited >= 1);
  assert.ok(stats.multiRoleUsers >= 1);
  assert.equal(Object.keys(stats.orgsByType).length, Object.keys(ORG_TYPE_LABEL).length);
});
