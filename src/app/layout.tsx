import type { Metadata, Viewport } from "next";
import { Asap, Quicksand, Roboto } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AnalyticsTracker } from "@/components/analytics/AnalyticsTracker";
import { getSeoSettings } from "@/lib/seo";
import { getOrganizationJsonLd, getWebSiteJsonLd } from "@/lib/seo-structured-data";

const asap = Asap({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-asap",
  display: "swap",
})

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
})

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-roboto",
  display: "swap",
})

// Generate metadata dynamically from SEO settings (admin-configurable in /admin > SEO).
// No hardcoded site name / URL / description here — everything comes from the DB.
export async function generateMetadata(): Promise<Metadata> {
  let settings: Record<string, string> = {}
  try {
    settings = await getSeoSettings()
  } catch {}

  const siteName = settings.site_name || "Portal de Notícias"
  const siteUrl = settings.site_url || "http://localhost:3000"
  const description = settings.site_description || "Portal de notícias local. Cobertura completa do que acontece na cidade e região."
  const keywords = settings.site_keywords || "notícias,portal,jornalismo"
  const ogImage = settings.og_image || "/og-default.png"
  const siteLogo = settings.site_logo || "/logo.svg"
  const siteFavicon = settings.site_favicon || "/favicon.svg"
  const tagline = settings.site_tagline || "Portal de Notícias"

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${siteName} - ${tagline}`,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
    authors: [{ name: `Redação ${siteName}` }],
    creator: siteName,
    publisher: siteName,
    applicationName: siteName,
    category: "News",
    formatDetection: { telephone: false, address: false, email: false },
    alternates: { canonical: siteUrl },
    openGraph: {
      title: `${siteName} - ${tagline}`,
      description,
      url: siteUrl,
      siteName,
      locale: "pt_BR",
      type: "website",
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }] }),
      ...(settings.fb_app_id && { appId: settings.fb_app_id }),
    },
    twitter: {
      card: (settings.twitter_card as any) || "summary_large_image",
      title: `${siteName} - ${tagline}`,
      description,
      ...(settings.twitter_handle && { site: settings.twitter_handle }),
      ...(ogImage && { images: [ogImage] }),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    icons: {
      icon: siteFavicon,
      shortcut: siteFavicon,
      apple: siteFavicon,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let settings: Record<string, string> = {}
  try {
    settings = await getSeoSettings()
  } catch {}

  const orgJsonLd = getOrganizationJsonLd(settings)
  const websiteJsonLd = getWebSiteJsonLd(settings)

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${asap.variable} ${quicksand.variable} ${roboto.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --primary: ${settings.primary_color || '#2563eb'};
              --secondary: ${settings.secondary_color || '#0ea5e9'};
              --accent: ${settings.accent_color || '#f59e0b'};
              --header-bg: ${settings.header_bg_color || '#ffffff'};
              --header-text: ${settings.header_text_color || '#18181b'};
              --nav-bg: ${settings.nav_bg_color || '#fafafa'};
            }
            /* Override Tailwind's .bg-primary / .text-primary to use our CSS variable */
            .bg-primary { background-color: var(--primary) !important; }
            .text-primary { color: var(--primary) !important; }
            .border-primary { border-color: var(--primary) !important; }
            .ring-primary { --tw-ring-color: var(--primary) !important; }
            .bg-secondary { background-color: var(--secondary) !important; }
            .text-secondary { color: var(--secondary) !important; }
            .bg-accent-custom { background-color: var(--accent) !important; }
            .text-accent-custom { color: var(--accent) !important; }
            .bg-header-bg { background-color: var(--header-bg) !important; }
            .text-header-text { color: var(--header-text) !important; }
            .bg-nav-bg { background-color: var(--nav-bg) !important; }
          `,
        }} />
        <script
          type="application/ld+json"
          // P0-4b fix: escape `<` and `>` so a `</script>` sequence inside the
          // JSON payload cannot break out of the script tag and inject HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') }}
        />
      </head>
      <body
        className="antialiased bg-white text-zinc-800 min-h-screen flex flex-col"
        style={{ fontFamily: "var(--font-asap), -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        {children}
        <AnalyticsTracker />
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </body>
    </html>
  );
}
