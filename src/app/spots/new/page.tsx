import { CreateSpotForm } from "@/components/spot/CreateSpotForm";

export const metadata = {
  title: "Ajouter un spot",
  description:
    "Partagez un spot de kitesurf ou parapente avec la communauté open source OpenKite.",
};

export default function NewSpotPage() {
  return <CreateSpotForm />;
}
