import './globals.css';
import { Orbitron, Rajdhani, Share_Tech_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const orbitron = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--f-orbitron' });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-rajdhani' });
const mono = Share_Tech_Mono({ subsets: ['latin'], weight: '400', variable: '--f-mono' });

export const metadata = {
  title: 'APEX // TELEMETRY — Live F1 Command Center',
  description:
    'A live, auto-updating Formula 1 command center. Race countdown, live timing tower with gaps and tire compounds, championship standings, race results, weather telemetry and strategy — all in a sci-fi HUD.',
  keywords: ['F1 dashboard', 'live F1 timing', 'Formula 1 standings', 'F1 countdown', 'F1 telemetry'],
  openGraph: {
    title: 'APEX // TELEMETRY — Live F1 Command Center',
    description: 'Live timing, standings, strategy and race telemetry in a sci-fi HUD.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#04050a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable} ${mono.variable}`}>
      <body>
        <div className="atmosphere" />
        {children}
        <div className="vignette" />
        <div className="scanlines" />
        <Analytics />
      </body>
    </html>
  );
}
