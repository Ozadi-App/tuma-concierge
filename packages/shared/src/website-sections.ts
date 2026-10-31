/**
 * What each Admin → Services module also controls on the website (peebee.online): doors, service pages and partner
 * pages. The site reads the same switches as the apps (apps/web/lib/module-map.ts decides which module each part follows);
 * this list only tells Admin what a switch reaches. A test keeps it in step with the site, so it cannot drift.
 */
export const WEBSITE_SECTIONS: Readonly<Record<string, readonly string[]>> = {
  "ride": ["Ride door", "Safety page"],
  "buy": ["Buy door"],
  "buy.food": ["Eat door", "Restaurants page", "Kitchens page", "Street food page", "Juices page", "Bakeries page", "Chat page", "Cart page", "Restaurant partner page", "Home kitchen partner page", "Street food partner page", "Juice bar partner page", "Bakery partner page"],
  "learn": ["Learn door", "Discover page", "Connect page", "Sprouts page", "Foundations page", "Academy page", "Compass page", "Skills page", "Teacher partner page", "School partner page"],
  "hive": ["Work door"],
  "ride.boda": ["Boda page", "Boda rider partner page"],
  "ride.car": ["Cars page", "Car driver partner page", "Car owner partner page"],
  "ride.car.carpool": ["Rideshare page", "Rideshare partner page"],
  "ride.car.selfdrive": ["Selfdrive page", "Self-drive partner page"],
  "ride.move": ["Move page", "Move / truck partner page"],
  "deliver.parcel": ["Parcel page"],
  "ride.taxipress": ["TaxiPress page", "Taxi partner page"],
  "ride.luxury": ["VIP page", "VIP car partner page"],
  "ride.ambulance": ["Ambulance page", "Ambulance partner page"],
  "buy.shopping": ["List page", "Groceries page", "Links page", "Substitutes page", "Grocery seller partner page"],
  "buy.marketplace": ["Stores page", "Store partner page"],
  "buy.pharmacy": ["Pharma page", "Pharmacy partner page"],
  "channels": ["Spotlight page"],
  "learn.enrolments": ["My Class page"],
  "learn.live": ["Live page"],
  "learn.tv": ["TV page"],
  "hive.work": ["Clean page", "Laundry page", "Fix page", "Cleaner partner page", "Laundry partner page", "Fixer partner page", "Worker partner page"],
  "hive.hire": ["Workers page", "Hire page", "Matching page", "Hire partner page"],
};
