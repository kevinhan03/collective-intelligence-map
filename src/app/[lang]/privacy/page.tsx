import type { Metadata } from "next";
import Link from "@/i18n/link";
import { getTranslator } from "@/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("meta.privacy") };
}

export default async function Privacy() {
  const t = await getTranslator();
  return (
    <main id="main" className="page-wrap max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">
        {t("legal.privacyPolicyMvpDraft")}
      </h1>
      <p className="text-sm leading-7">
        {t("legal.signInEmailAndAuthentication")}
      </p>
      <p className="text-sm leading-7">{t("legal.whenYouSearchForA")}</p>
      <p className="text-sm leading-7">
        {t("legal.whenUsingGoogleServicesPlease")}{" "}
        <a className="underline" href="https://policies.google.com/privacy">
          {t("legal.googlePrivacyPolicy")}
        </a>
        {t("legal.mapProvidersMayReceiveConnection")}
      </p>
      <p className="rounded border p-4 text-sm text-muted-foreground">
        {t("legal.beforePublicLaunchTheData")}
      </p>
      <Link href="/" className="text-sm underline">
        {t("legal.back")}
      </Link>
    </main>
  );
}
