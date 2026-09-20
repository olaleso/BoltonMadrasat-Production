import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {title:"BNMC Madrasah Management System",description:"A secure, connected learning and administration experience for the Bolton Nigerian Muslim Community Madrasah.",icons:{icon:"/community-logo.png"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
