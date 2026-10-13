import { FoodMarketplace } from "../../components/FoodMarketplace";

export const metadata = {
  title: "Juice & Smoothies | Peebee",
  description: "Freshly pressed juices, smoothies, and wellness shots sealed in spill-proof packaging.",
};

export default function JuicesPage() {
  return <FoodMarketplace mode="directory" category="juices" />;
}
