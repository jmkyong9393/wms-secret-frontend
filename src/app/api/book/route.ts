import { API_BASE_URL } from '@/shared/api/api-client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn');

  if (!isbn) {
    return NextResponse.json({ error: 'ISBN is required' }, { status: 400 });
  }

  try {
    // 100% Zero Key Exposure: Delegate to FastAPI backend proxy endpoint
    const backendUrl = `${API_BASE_URL}/api/v1/inbound/isbn-lookup?isbn=${isbn}`;
    const response = await fetch(backendUrl, { cache: 'no-store' });
    
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        isbn: data.isbn || isbn,
        title: data.title,
        author: data.author,
        publisher: data.publisher,
        pubDate: data.pubDate,
        price: data.price,
        imageUrl: data.imageUrl,
        description: data.description,
        categoryName: data.categoryName,
        source: data.source
      });
    } else {
      return NextResponse.json({ error: 'Book not found from backend proxy' }, { status: 404 });
    }
  } catch (error) {
    console.error("Backend Proxy ISBN lookup error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
