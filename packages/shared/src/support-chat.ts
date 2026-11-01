/** The Peebee apps that can show the Help & support chat. One list, used by the API (admin switch), the apps and the admin inbox. */
export const SUPPORT_APPS = [
  { id: "website", label: "Website" },
  { id: "customer", label: "Customer app" },
  { id: "rider", label: "Rider app" },
  { id: "restaurant", label: "Restaurant app" },
  { id: "merchant", label: "Merchant app" },
  { id: "partner", label: "Partner app" },
  { id: "work", label: "Work app" },
  { id: "gas", label: "Gas app" },
  { id: "learn", label: "Learn app" },
  { id: "pharmacy", label: "Pharmacy app" },
  { id: "sales", label: "Sales app" },
  { id: "tv", label: "TV app" },
] as const;

export type SupportAppId = (typeof SUPPORT_APPS)[number]["id"];

export const isSupportApp = (value: unknown): value is SupportAppId => SUPPORT_APPS.some((a) => a.id === value);
export const supportAppLabel = (id: string | null | undefined): string => SUPPORT_APPS.find((a) => a.id === id)?.label ?? "Peebee";
