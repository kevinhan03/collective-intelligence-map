import { notFound } from "next/navigation";

// Unmatched URLs are rewritten under /[lang], so render the localized 404 here.
export default function Missing() {
  notFound();
}
