import { TripPlanner } from "@/components/plan/TripPlanner";

export const metadata = {
  title: "Planifier un voyage",
  description:
    "Trouvez les meilleurs spots de kitesurf et parapente selon vos dates et votre destination. Prévisions vent et scores de qualité.",
};

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PlanPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <div
      className="bg-white text-gray-900"
      style={{ height: "calc(100dvh - 56px)" }}
    >
      <TripPlanner searchParams={sp} />
    </div>
  );
}
