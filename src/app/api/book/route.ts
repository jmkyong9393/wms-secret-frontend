import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get('isbn');

  if (!isbn) {
    return NextResponse.json({ error: 'ISBN is required' }, { status: 400 });
  }

  const TTB_KEY = process.env.ALADIN_TTB_KEY;

  if (!TTB_KEY) {
    return NextResponse.json({ error: 'ALADIN_TTB_KEY is not configured in .env.local' }, { status: 500 });
  }

  try {
    const url = `http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${TTB_KEY}&itemIdType=ISBN13&ItemId=${isbn}&output=js&Version=20131101`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.item && data.item.length > 0) {
      const book = data.item[0];
      return NextResponse.json({
        isbn: book.isbn13 || isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        pubDate: book.pubDate,
        price: book.priceStandard,
        imageUrl: book.cover,
        description: book.description,
        categoryName: book.categoryName,
      });
    } else {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Aladin API fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
