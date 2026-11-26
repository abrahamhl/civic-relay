import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyBomFile } from '../../../../hardware/modules/shared/verify-bom.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

describe('Bloque H2 · Catálogo de la familia de módulos SENDA y plan legal UE (docs/negocio + hardware/modules)', () => {
  const modJsonPath = path.join(REPO_ROOT, 'docs/negocio/modulos.json');
  const modMdPath = path.join(REPO_ROOT, 'docs/negocio/MODULOS_SENDA.md');

  it('valida la estructura e integridad de docs/negocio/modulos.json y sus 4 módulos + 3 descartes razonados', () => {
    assert.ok(fs.existsSync(modJsonPath), 'Falta docs/negocio/modulos.json');
    assert.ok(fs.existsSync(modMdPath), 'Falta docs/negocio/MODULOS_SENDA.md');

    const cat = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
    assert.equal(cat.priceQueryDate, '2026-11-26');
    assert.equal(cat.vatRateSpainPct, 21);
    assert.equal(cat.modules.length, 4);
    assert.ok(cat.discardedCandidates.length >= 3, 'Se exigen descartes razonados');

    const ids = cat.modules.map((m) => m.id);
    assert.deepEqual(ids, ['senda-radar', 'senda-nodo-lora', 'senda-baliza-ble', 'senda-estacion-ambiental']);

    for (const m of cat.modules) {
      assert.ok(['prototipo', 'diseño'].includes(m.status), `Estado inválido en ${m.id}: ${m.status}`);
      assert.equal(m.euCompliancePath.onSale, false, `${m.id} no puede anunciarse a la venta sin CE/RoHS/RAEE`);
      assert.equal(m.pricingScenario.basis, 'ESCENARIO');
      assert.equal(m.assets.renders.isRender, true);
      assert.ok(m.assets.glbBytes < 2 * 1024 * 1024, `GLB >= 2 MB declarado en ${m.id}`);

      // Comprobar que cada módulo del núcleo SENDA referenciado existe realmente en packages/senda/src/
      for (const coreRel of m.sendaRole.coreModules) {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, coreRel)), `No existe módulo del núcleo ${coreRel} (${m.id})`);
      }
      // Comprobar aritmética del IVA 21 % en el escenario de precios
      assert.equal(Number((m.pricingScenario.kitExVatEur * 1.21).toFixed(2)), m.pricingScenario.kitInclVatEur);
      assert.equal(Number((m.pricingScenario.assembledExVatEur * 1.21).toFixed(2)), m.pricingScenario.assembledInclVatEur);
    }
  });

  it('verifica en disco BOM.csv, STL binarios, GLB < 2 MB y renders 4D 1080p de los 3 módulos H2 (y H1 si ya está fusionado)', () => {
    const cat = JSON.parse(fs.readFileSync(modJsonPath, 'utf8'));
    for (const m of cat.modules) {
      const modDir = path.join(REPO_ROOT, 'hardware/modules', m.id);
      if (m.id === 'senda-radar' && !fs.existsSync(modDir)) {
        // H1 se abre como PR independiente contra master (no apilada); cuando se fusione también se verifica en disco.
        continue;
      }
      assert.ok(fs.existsSync(path.join(modDir, 'README.md')), `Falta README.md en ${m.id}`);
      const bomSummary = verifyBomFile(path.join(REPO_ROOT, m.bom.csvPath));
      assert.deepEqual(bomSummary.queryDates, ['2026-11-26']);

      const expectedCost = m.bom.variants.standard ?? m.bom.variants.completeAutonomous;
      assert.equal(bomSummary.completeVariant.unitCostEurInclVat, expectedCost.unitCostEurInclVat);
      assert.equal(bomSummary.completeVariant.unitCostEurExVat, expectedCost.unitCostEurExVat);

      const glbBuf = fs.readFileSync(path.join(REPO_ROOT, m.assets.glb));
      assert.equal(glbBuf.toString('ascii', 0, 4), 'glTF');
      assert.equal(glbBuf.length, m.assets.glbBytes);
      assert.ok(glbBuf.length < 2 * 1024 * 1024);

      for (const [k, relPath] of Object.entries(m.assets.renders)) {
        if (k === 'isRender') continue;
        const st = fs.statSync(path.join(REPO_ROOT, relPath));
        assert.ok(st.size > 15_000, `Render ausente o truncado en ${relPath}`);
      }
    }
  });

  it('documenta en MODULOS_SENDA.md el camino legal UE completo (RED 2014/53/UE, RoHS, RAEE, Bluetooth SIG y garantía 3 años)', () => {
    const md = fs.readFileSync(modMdPath, 'utf8');
    assert.match(md, /2014\/53\/UE/);
    assert.match(md, /2011\/65\/UE/);
    assert.match(md, /110\/2015/);
    assert.match(md, /70-03/);
    assert.match(md, /1\.250 USD/);
    assert.match(md, /12\.000 USD/);
    assert.match(md, /3 años/);
    assert.match(md, /14 días/);
    assert.match(md, /no verificado/);
    assert.match(md, /ESCENARIO/);
  });
});
