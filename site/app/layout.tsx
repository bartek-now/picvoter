import type { Metadata } from "next";
export const metadata: Metadata = { title: "Help me pick my glasses", description: "Compare eight frames and rank your favorites." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
