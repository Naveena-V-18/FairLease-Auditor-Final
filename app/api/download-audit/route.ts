import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function isSafePdfName(fileName: string) {
  return /^[a-zA-Z0-9._-]+\.pdf$/.test(fileName);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (!file || !isSafePdfName(file)) {
    return NextResponse.json({ error: 'Invalid report file' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'public', 'reports', file);

  try {
    const bytes = await readFile(filePath);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
}
