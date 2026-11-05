const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const out = process.argv[2];
  const shots = [
    ['/es', 0, 'a1'], ['/es', 1000, 'a2'], ['/es', 2200, 'a3'], ['/es', 3600, 'a4'], ['/es', 5200, 'a5'],
    ['/es/mission-control', 0, 'b1'], ['/es/mission-control', 900, 'b2'], ['/es/mission-control', 1900, 'b3'],
    ['/es/science', 0, 'c1'], ['/es/science', 1100, 'c2'],
  ];
  let last = '';
  for (const [path, y, name] of shots) {
    if (path !== last) { await p.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000); last = path; }
    await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/${name}.png` });
  }
  await b.close();
})();
