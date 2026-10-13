export const FOOD_BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurants', navLabel: 'Restaurants', description: 'Established restaurants and dining venues' },
  { value: 'kitchen', label: 'Kitchens', navLabel: 'Kitchens', description: 'Home cooks and independent kitchens' },
  { value: 'street_food', label: 'Street Food', navLabel: 'Streetfood', description: 'Street stalls, Rolex, chapati and quick bites' },
  {
    value: 'juices',
    label: 'Juice and Smoothies',
    navLabel: 'Juices',
    description: 'Freshly pressed juices, smoothies, and wellness shots in spill-proof packaging',
  },
  { value: 'bakery', label: 'Bakeries', navLabel: 'Bakeries', description: 'Bread, cakes, pastries and baked treats' },
] as const;
export type FoodBusinessType = typeof FOOD_BUSINESS_TYPES[number]['value'];
export function foodBusinessLabel(value?: string | null) {
  return FOOD_BUSINESS_TYPES.find(type => type.value === value)?.label ?? 'Restaurants';
}
export function foodBusinessNavLabel(value?: string | null) {
  const item = FOOD_BUSINESS_TYPES.find(type => type.value === value);
  return item ? item.navLabel : 'Restaurants';
}
