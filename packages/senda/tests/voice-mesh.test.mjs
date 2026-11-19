import test from 'node:test';
import assert from 'node:assert/strict';
import { planVoiceMesh, routeBetween, streamsPerLink, floorControl, replanOnBattery, voiceMeshScenario, OPUS_VOICE_KBPS } from '../src/voice-mesh.mjs';

test('cadena simple: B repite entre A y C, que no se alcanzan', () => {
  const p = planVoiceMesh([{ id: 'A', battery: 0.9 }, { id: 'B', battery: 0.9 }, { id: 'C', battery: 0.9 }], [['A', 'B', 0.9], ['B', 'C', 0.9]]);
  assert.deepEqual(p.relays, ['B']); assert.equal(p.maxHops, 2);
  assert.deepEqual(routeBetween(p, 'A', 'C'), ['A', 'B', 'C']);
});

test('edificio: todos conectados, la persona con 12 % de batería nunca repite y la 4.ª planta llega a la calle por la escalera', () => {
  const { nodes, links } = voiceMeshScenario(), p = planVoiceMesh(nodes, links);
  assert.deepEqual(p.unreachable, []);
  assert.ok(!p.relays.includes('Marta'));
  const r = routeBetween(p, 'Ana', 'Equipo');
  assert.equal(r[0], 'Ana'); assert.equal(r[r.length - 1], 'Equipo'); assert.ok(r.includes('Iker') && r.includes('Portero'));
  assert.ok(p.maxHops <= 6, String(p.maxHops));
});

test('con turno de palabra cada enlace lleva 1 flujo; sin turno, tantos como personas hablando', () => {
  const { nodes, links } = voiceMeshScenario(), p = planVoiceMesh(nodes, links);
  assert.ok([...streamsPerLink(p, ['Ana']).values()].every((n) => n === 1));
  assert.ok([...streamsPerLink(p, ['Ana', 'Sara', 'Juan', 'Equipo']).values()].every((n) => n === 4));
  assert.equal(Math.max(...Object.values(p.uplinkKbps)) % OPUS_VOICE_KBPS, 0);
});

test('turno de palabra determinista: orden de petición, empate por id y turno máximo', () => {
  const f = floorControl({ maxTalkS: 30 });
  assert.equal(f.request('Sara', 0), 'Sara'); f.request('Juan', 5); f.request('Ana', 5);
  assert.deepEqual(f.queue, ['Juan', 'Ana']);
  assert.equal(f.release('Sara', 8), 'Ana'); // empate en t=5 → id menor
  assert.equal(f.tick(20), 'Ana'); assert.equal(f.tick(38), 'Juan'); // 30 s máximo
});

test('si el repetidor de la escalera se queda sin batería, el plan avisa de quién queda aislado', () => {
  const { nodes, links } = voiceMeshScenario(), prev = planVoiceMesh(nodes, links);
  const low = nodes.map((n) => (n.id === 'Iker' ? { ...n, battery: 0.1 } : n));
  const r = replanOnBattery(low, links, prev);
  assert.ok(r.retired.includes('Iker'));
  assert.deepEqual(r.isolated, ['Ana', 'Luis', 'Marta']);
});
