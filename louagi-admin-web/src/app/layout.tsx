import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// App-matching typefaces: Plus Jakarta Sans (Latin) and Cairo (Arabic), the
// same families the mobile app loads via @expo-google-fonts. next/font
// self-hosts them and exposes the CSS variables Tailwind's font stack reads.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Louagi Admin",
  description: "Louagi platform administration dashboard",
};

// Applied before first paint to avoid a flash of the wrong theme / direction.
const bootInit = `(function(){try{
var m=localStorage.getItem('louagi.admin.theme')||'system';
var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(d){document.documentElement.classList.add('dark');}
var l=localStorage.getItem('louagi.admin.locale');
if(l){document.documentElement.lang=l;document.documentElement.dir=(l==='ar')?'rtl':'ltr';}
}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${sans.variable} ${cairo.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootInit }} />
      </head>
      {/* suppressHydrationWarning: security / password-manager extensions
          (Bitdefender's bis_register / bis_skin_checked, form-filler
          __processed_*, etc.) inject attributes before React hydrates, which
          would otherwise trip a hydration mismatch warning. NOTE: this only
          suppresses THIS element's own attribute diff (one level deep) — it does
          not cascade to descendants, so extensions that tag nested <div>s (e.g.
          Bitdefender's bis_skin_checked) still warn. That noise is harmless and
          only appears for the dev's own browser; real users without the
          extension never trigger it. Fix: whitelist the extension on localhost
          or use an extension-free window — do NOT chase it in code. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
