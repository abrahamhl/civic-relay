import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const dynamic = 'force-static';

export async function GET() {
  const filePath = resolve(process.cwd(), 'public/vision-master.md');
  const content = readFileSync(filePath, 'utf8');
  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'inline; filename="vision-master.md"'
    }
  });
}
