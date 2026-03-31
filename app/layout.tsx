import "./globals.css";

export const metadata = {
  title: 'Avalia.ai',
  description: 'Plataforma Pedagógica com IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
