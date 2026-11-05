import Link from "@/i18n/link";
import { getTranslator } from "@/i18n/server";
export default async function NotFound() {
  const t = await getTranslator();
  return (
    <main id="main" className="page-wrap py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <Link href="/" className="mt-5 inline-block text-primary underline">
        {t("notFound.back")}
      </Link>
    </main>
  );
}
