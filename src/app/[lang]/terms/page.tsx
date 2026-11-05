import type { Metadata } from "next";
import Link from "@/i18n/link";
import { getTranslator } from "@/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("meta.terms") };
}

export default async function Terms() {
  const t = await getTranslator();
  return (
    <main id="main" className="page-wrap max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">
        {t("legal.termsOfServicePrivateMvp")}
      </h1>
      <p className="text-sm leading-7">{t("legal.tingMapIsAPublic")}</p>
      <p className="text-sm leading-7">
        {t("legal.onlySubmitInformationYouWrote")}
      </p>
      <p className="text-sm leading-7">
        {t("legal.googleMapsAndPlaceSearch")}{" "}
        <a
          className="underline"
          href="https://maps.google.com/help/terms_maps.html"
        >
          {t("legal.googleMapsTermsOfService")}
        </a>
        {t("legal.text1")}
      </p>
      <p className="rounded border p-4 text-sm text-muted-foreground">
        {t("legal.beforePublicLaunchTheOperator")}
      </p>
      <Link className="text-sm underline" href="/">
        {t("legal.back")}
      </Link>
    </main>
  );
}
