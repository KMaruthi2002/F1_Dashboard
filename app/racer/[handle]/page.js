import RacerProfile from '@/components/RacerProfile';

export async function generateMetadata({ params }) {
  return {
    title: `@${params.handle} · APEX // PADDOCK`,
    description: `Paddock Points, podium calls and garage of @${params.handle} on APEX // TELEMETRY.`,
  };
}

export default function RacerPage({ params }) {
  return <RacerProfile handle={params.handle} />;
}
