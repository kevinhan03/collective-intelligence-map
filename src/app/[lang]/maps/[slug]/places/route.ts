import { directoryDocument, unavailablePage } from "@/server/seo-pages";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    return await directoryDocument((await params).slug);
  } catch {
    return unavailablePage();
  }
}
