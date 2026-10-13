export interface DemoStore {
  id: string;
  name: string;
  slug: string;
  category: "groceries" | "stores";
  sub_category?: string;
  description: string;
  announcement?: string;
  logo_url: string;
  banner_url: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  lat?: number;
  lng?: number;
  distance_km?: number | null;
  is_open: number;
  delivery_enabled: number;
  pickup_enabled: number;
  min_order_amount: number;
  pro_tier: string;
  is_live: number;
  live_channel_title: string | null;
  live_stream_url: string | null;
  live_viewer_count: number;
  status: string;
}

export interface DemoProductVariant {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  inventory_quantity: number;
}

export interface DemoProduct {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  inventory_quantity: number;
  category_name: string;
  badge?: string;
  image_url: string;
  video_url?: string;
  has_variants: number;
  variants: DemoProductVariant[];
}

export interface DemoSpotlightItem {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  store_category: "groceries" | "stores";
  type: "live" | "video" | "image" | "carousel";
  media_url: string;
  carousel_images?: string[];
  title: string;
  description: string;
  product: {
    id: string;
    title: string;
    price: number;
    compare_at_price?: number;
    image_url: string;
    badge?: string;
  };
  viewer_count?: number;
  likes_count: number;
  comments_count: number;
}

export const DEMO_MARKETPLACE_STORES: DemoStore[] = [
  {
    id: "store_demo_fresh_mart",
    name: "FreshMart Supermarket",
    slug: "freshmart-kampala",
    category: "groceries",
    sub_category: "supermarket",
    description: "Kampala's premier organic produce, pantry staples, bakery & dairy delivered in minutes.",
    announcement: "Free delivery on grocery orders over UGX 40,000! 🥕",
    logo_url: "/stores/freshmart-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 700 123 456",
    whatsapp_number: "+256 700 123 456",
    address: "Acacia Mall Ground Floor, Kololo",
    lat: 0.3353,
    lng: 32.5857,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 5000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Fresh Morning Harvest! 🥑 Unpacking avocado crates & dairy offers",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    live_viewer_count: 142,
    status: "active",
  },
  {
    id: "store_demo_golden_crust",
    name: "Golden Crust Bakery",
    slug: "golden-crust-bakery",
    category: "groceries",
    sub_category: "bakery",
    description: "Sourdough loaves, flaky butter croissants, cinnamon rolls & artisanal pastries.",
    announcement: "Warm sourdough loaves out of the oven every morning at 7:30 AM! 🥐",
    logo_url: "/stores/goldencrust-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 701 445 566",
    whatsapp_number: "+256 701 445 566",
    address: "Bukoto Street, Kamwokya",
    lat: 0.3421,
    lng: 32.5872,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 5000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Live Baking 🥖 Shaping Sourdough & Glazing Cinnamon Rolls",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    live_viewer_count: 98,
    status: "active",
  },
  {
    id: "store_demo_urban_vogue",
    name: "Urban Vogue Boutique",
    slug: "urban-vogue-ug",
    category: "stores",
    sub_category: "fashion-boutique",
    description: "Contemporary street style, tailored linen shirts, denim essentials and designer sneakers.",
    announcement: "Flash Live Sale: 20% off all jackets tonight only! ✨",
    logo_url: "/stores/urbanvogue-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 772 987 654",
    whatsapp_number: "+256 772 987 654",
    address: "Garden City Mall Level 2, Kampala",
    lat: 0.3186,
    lng: 32.5898,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 10000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Fitting Room Live! 🧥 Trying on the new Autumn linen collection",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    live_viewer_count: 289,
    status: "active",
  },
  {
    id: "store_demo_tech_pulse",
    name: "TechPulse Electronics",
    slug: "techpulse-electronics",
    category: "stores",
    sub_category: "electronics",
    description: "Original audio gear, phone accessories, power stations & fast chargers.",
    announcement: "1-year warranty on all accessories & fast doorstep dispatch ⚡",
    logo_url: "/stores/techpulse-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 750 333 444",
    whatsapp_number: "+256 750 333 444",
    address: "Pioneer Mall, Kampala CBD",
    lat: 0.3138,
    lng: 32.5815,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 15000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Tech Unboxing Live 🎧 Testing Noise Cancelling Wireless Headphones & Powerbanks",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    live_viewer_count: 215,
    status: "active",
  },
  {
    id: "store_demo_glow_beauty",
    name: "Glow Essence Beauty",
    slug: "glow-essence-beauty",
    category: "stores",
    sub_category: "beauty",
    description: "Clean skincare, organic Shea butter creams, vitamin serums & natural cosmetics.",
    announcement: "Free rosewater mist with every order over UGX 50,000 ✨",
    logo_url: "/stores/glowbeauty-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 788 223 344",
    whatsapp_number: "+256 788 223 344",
    address: "Village Mall Bugolobi, Level 1",
    lat: 0.3142,
    lng: 32.6185,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 10000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Live Skincare Routine 🧴 Testing African Black Soap & Niacinamide",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    live_viewer_count: 175,
    status: "active",
  },
  {
    id: "store_demo_sneaker_hub",
    name: "Kampala Sneaker Hub",
    slug: "kampala-sneaker-hub",
    category: "stores",
    sub_category: "footwear",
    description: "Curated retro sneakers, street court kicks, slides and premium shoe protection.",
    announcement: "Friday Drop: New court high-tops in stock with same-day dispatch 👟",
    logo_url: "/stores/sneakerhub-logo.jpg",
    banner_url: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 702 889 900",
    whatsapp_number: "+256 702 889 900",
    address: "Arena Mall, Nsambya",
    lat: 0.2985,
    lng: 32.5852,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 20000,
    pro_tier: "pro_live",
    is_live: 1,
    live_channel_title: "Sneaker Drop Live 👟 Exclusive Unboxing of Retro High-Tops & Sizing Advice",
    live_stream_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
    live_viewer_count: 188,
    status: "active",
  },
];

export const DEMO_MARKETPLACE_PRODUCTS: Record<string, DemoProduct[]> = {
  store_demo_fresh_mart: [
    {
      id: "prod_milk_1l",
      store_id: "store_demo_fresh_mart",
      title: "Fresh Whole Farm Milk (1 Litre)",
      slug: "fresh-whole-farm-milk-1l",
      description: "Pasteurised fresh dairy whole milk from local Western Uganda farms.",
      price: 3500,
      compare_at_price: 4000,
      inventory_quantity: 80,
      category_name: "Dairy & Eggs",
      badge: "Fresh Daily",
      image_url: "/products/farm-fresh-milk.jpg",
      has_variants: 1,
      variants: [
        { id: "var_milk_500ml", title: "500ml Pouch", price: 2000, inventory_quantity: 40 },
        { id: "var_milk_1l", title: "1 Litre Bottle", price: 3500, inventory_quantity: 50 },
        { id: "var_milk_2l", title: "2 Litre Family Jug", price: 6500, compare_at_price: 7000, inventory_quantity: 25 },
      ],
    },
    {
      id: "prod_eggs_tray",
      store_id: "store_demo_fresh_mart",
      title: "Farm Fresh Eggs (Crate of 30)",
      slug: "farm-fresh-eggs-crate",
      description: "Large golden yolk farm eggs, cleanly sorted and packaged.",
      price: 13500,
      compare_at_price: 15000,
      inventory_quantity: 45,
      category_name: "Dairy & Eggs",
      badge: "Best Seller",
      image_url: "/products/farm-fresh-eggs.jpg",
      has_variants: 1,
      variants: [
        { id: "var_eggs_6", title: "Pack of 6", price: 3200, inventory_quantity: 30 },
        { id: "var_eggs_12", title: "Pack of 12", price: 6000, inventory_quantity: 20 },
        { id: "var_eggs_30", title: "Full Tray (30)", price: 13500, compare_at_price: 15000, inventory_quantity: 45 },
      ],
    },
    {
      id: "prod_honey_glazed_chicken",
      store_id: "store_demo_fresh_mart",
      title: "Honey Glazed Chicken",
      slug: "honey-glazed-chicken",
      description: "Crispy chicken in a sweet & savory honey-soy glaze, served on jasmine rice with sesame seeds & scallions.",
      price: 24000,
      compare_at_price: 28000,
      inventory_quantity: 40,
      category_name: "Fresh Meals",
      badge: "Chef Choice",
      image_url: "/products/honey-glazed-chicken.jpg",
      has_variants: 1,
      variants: [
        { id: "var_chicken_reg", title: "Regular Portion", price: 24000, inventory_quantity: 25 },
        { id: "var_chicken_large", title: "Large Meal Box", price: 32000, compare_at_price: 36000, inventory_quantity: 15 },
      ],
    },
    {
      id: "prod_avocados_pack",
      store_id: "store_demo_fresh_mart",
      title: "Hass Avocados (Pack of 3)",
      slug: "hass-avocados-pack",
      description: "Creamy, perfectly ripe organic avocados hand-picked daily.",
      price: 5000,
      inventory_quantity: 60,
      category_name: "Fresh Produce",
      badge: "Organic",
      image_url: "/products/fresh-avocados.jpg",
      has_variants: 0,
      variants: [],
    },
    {
      id: "prod_rice_5kg",
      store_id: "store_demo_fresh_mart",
      title: "Super Aromatic Basmati Rice (5kg)",
      slug: "super-aromatic-basmati-rice-5kg",
      description: "Long grain aromatic rice, clean and stone-free.",
      price: 28000,
      compare_at_price: 32000,
      inventory_quantity: 30,
      category_name: "Pantry Staples",
      badge: "Special Offer",
      image_url: "/products/basmati-rice.jpg",
      has_variants: 0,
      variants: [],
    },
  ],
  store_demo_golden_crust: [
    {
      id: "prod_butter_croissant",
      store_id: "store_demo_golden_crust",
      title: "Flaky French Butter Croissant (Pack of 2)",
      slug: "flaky-french-butter-croissant",
      description: "Baked with real butter and layered 24 times for authentic airy honeycomb flakiness.",
      price: 7500,
      compare_at_price: 9000,
      inventory_quantity: 40,
      category_name: "Bakery",
      badge: "Warm & Fresh",
      image_url: "/products/croissant-bakery.jpg",
      has_variants: 1,
      variants: [
        { id: "var_croissant_2", title: "Pack of 2", price: 7500, inventory_quantity: 25 },
        { id: "var_croissant_4", title: "Box of 4", price: 14000, compare_at_price: 16000, inventory_quantity: 15 },
      ],
    },
    {
      id: "prod_sourdough_loaf",
      store_id: "store_demo_golden_crust",
      title: "Country Artisan Sourdough Loaf (800g)",
      slug: "country-artisan-sourdough-loaf",
      description: "Naturally fermented for 36 hours with wild yeast, crispy crust and soft chewy crumb.",
      price: 12000,
      inventory_quantity: 20,
      category_name: "Bakery",
      badge: "Handmade",
      image_url: "/products/sourdough-bread.jpg",
      has_variants: 0,
      variants: [],
    },
  ],
  store_demo_urban_vogue: [
    {
      id: "prod_pink_blazer",
      store_id: "store_demo_urban_vogue",
      title: "Minimalist Oversized Pink Blazer",
      slug: "minimalist-oversized-pink-blazer",
      description: "Modern minimalist single-breasted tailored blazer in soft blossom pink. Features structured shoulders, notch lapels, and full silk lining. Versatile for both power dressing and elevated casual evening looks.",
      price: 145000,
      compare_at_price: 175000,
      inventory_quantity: 22,
      category_name: "Fashion & Boutique",
      badge: "Best Seller",
      image_url: "/products/pink-blazer.jpg",
      has_variants: 1,
      variants: [
        { id: "var_blazer_s_blossom", title: "Size S / Blossom Pink", price: 145000, inventory_quantity: 5 },
        { id: "var_blazer_m_blossom", title: "Size M / Blossom Pink", price: 145000, inventory_quantity: 8 },
        { id: "var_blazer_l_blossom", title: "Size L / Blossom Pink", price: 145000, inventory_quantity: 6 },
        { id: "var_blazer_xl_blossom", title: "Size XL / Blossom Pink", price: 145000, inventory_quantity: 3 },
      ],
    },
    {
      id: "prod_linen_shirt",
      store_id: "store_demo_urban_vogue",
      title: "Relaxed Fit Cuban Linen Shirt",
      slug: "relaxed-fit-cuban-linen-shirt",
      description: "Breathable 100% natural linen shirt with spread collar. Perfect for warm tropical days.",
      price: 65000,
      compare_at_price: 80000,
      inventory_quantity: 25,
      category_name: "Fashion & Boutique",
      badge: "Featured on Live",
      image_url: "/products/cuban-linen-shirt.jpg",
      has_variants: 1,
      variants: [
        { id: "var_shirt_m_white", title: "Medium / Crisp White", price: 65000, inventory_quantity: 8 },
        { id: "var_shirt_l_white", title: "Large / Crisp White", price: 65000, inventory_quantity: 10 },
        { id: "var_shirt_m_sand", title: "Medium / Desert Sand", price: 65000, inventory_quantity: 7 },
        { id: "var_shirt_l_sand", title: "Large / Desert Sand", price: 65000, inventory_quantity: 5 },
      ],
    },
    {
      id: "prod_denim_jacket",
      store_id: "store_demo_urban_vogue",
      title: "Oversized Vintage Wash Denim Jacket",
      slug: "oversized-vintage-wash-denim-jacket",
      description: "Durable vintage wash denim with brass hardware and side pockets.",
      price: 95000,
      compare_at_price: 120000,
      inventory_quantity: 15,
      category_name: "Fashion & Boutique",
      badge: "20% Off Tonight",
      image_url: "/products/denim-jacket.jpg",
      has_variants: 1,
      variants: [
        { id: "var_jacket_m", title: "Size M (Chest 40)", price: 95000, inventory_quantity: 6 },
        { id: "var_jacket_l", title: "Size L (Chest 42)", price: 95000, inventory_quantity: 6 },
        { id: "var_jacket_xl", title: "Size XL (Chest 44)", price: 95000, inventory_quantity: 3 },
      ],
    },
  ],
  store_demo_tech_pulse: [
    {
      id: "prod_anc_earbuds",
      store_id: "store_demo_tech_pulse",
      title: "PulsePro Wireless ANC Earbuds",
      slug: "pulsepro-wireless-anc-earbuds",
      description: "Active noise cancelling with 40-hour battery life, wireless charging case and deep bass profile.",
      price: 95000,
      compare_at_price: 120000,
      inventory_quantity: 35,
      category_name: "Gadgets",
      badge: "Trending",
      image_url: "/products/anc-earbuds.jpg",
      has_variants: 1,
      variants: [
        { id: "var_earbuds_black", title: "Midnight Black", price: 95000, inventory_quantity: 20 },
        { id: "var_earbuds_white", title: "Frost White", price: 95000, inventory_quantity: 15 },
      ],
    },
  ],
  store_demo_glow_beauty: [
    {
      id: "prod_whipped_shea",
      store_id: "store_demo_glow_beauty",
      title: "Organic Whipped Nilotica Shea Butter (250g)",
      slug: "organic-whipped-shea-butter",
      description: "Soft, whipped raw Nilotica Shea butter from Northern Uganda, enriched with Baobab and Vitamin E.",
      price: 28000,
      inventory_quantity: 45,
      category_name: "Beauty",
      badge: "100% Pure",
      image_url: "/products/shea-butter.jpg",
      has_variants: 1,
      variants: [
        { id: "var_shea_vanilla", title: "Madagascar Vanilla Scent (250g)", price: 28000, inventory_quantity: 25 },
        { id: "var_shea_unscented", title: "Fragrance Free Pure (250g)", price: 28000, inventory_quantity: 20 },
      ],
    },
  ],
  store_demo_sneaker_hub: [
    {
      id: "prod_retro_high_top",
      store_id: "store_demo_sneaker_hub",
      title: "Air Retro High-Top Court Edition",
      slug: "air-retro-high-top-court",
      description: "Classic high-top silhouette in contrast red, black and white leather with cushioned air sole.",
      price: 185000,
      compare_at_price: 220000,
      inventory_quantity: 18,
      category_name: "Footwear",
      badge: "Limited Drop",
      image_url: "/products/retro-sneakers.jpg",
      has_variants: 1,
      variants: [
        { id: "var_kicks_41", title: "EU 41 / UK 7", price: 185000, inventory_quantity: 4 },
        { id: "var_kicks_42", title: "EU 42 / UK 8", price: 185000, inventory_quantity: 6 },
        { id: "var_kicks_43", title: "EU 43 / UK 9", price: 185000, inventory_quantity: 5 },
        { id: "var_kicks_44", title: "EU 44 / UK 10", price: 185000, inventory_quantity: 3 },
      ],
    },
  ],
};

export const DEMO_MARKETPLACE_SPOTLIGHT: DemoSpotlightItem[] = [
  {
    id: "spot_live_fresh_harvest",
    store_id: "store_demo_fresh_mart",
    store_name: "FreshMart Supermarket",
    store_slug: "freshmart-kampala",
    store_logo: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80",
    store_category: "groceries",
    type: "live",
    media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    title: "Fresh Morning Harvest! 🥑 Unpacking avocado crates & dairy offers",
    description: "Watch live as we unpack fresh farm organic avocados and cold milk pouches directly from Mbale orchards.",
    product: {
      id: "prod_avocados_pack",
      title: "Hass Avocados (Pack of 3)",
      price: 5000,
      image_url: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=400&q=80",
      badge: "Organic",
    },
    viewer_count: 142,
    likes_count: 1240,
    comments_count: 88,
  },
  {
    id: "spot_video_linen_shirt",
    store_id: "store_demo_urban_vogue",
    store_name: "Urban Vogue Boutique",
    store_slug: "urban-vogue-ug",
    store_logo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&q=80",
    store_category: "stores",
    type: "video",
    media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    title: "Summer Linen Collection ☀️ Styling relaxed fit Cuban shirts for weekend vibes",
    description: "Breathable 100% natural linen shirt with spread collar. Watch our fitting room walkthrough.",
    product: {
      id: "prod_linen_shirt",
      title: "Relaxed Fit Cuban Linen Shirt",
      price: 65000,
      compare_at_price: 80000,
      image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80",
      badge: "20% Off",
    },
    likes_count: 2890,
    comments_count: 142,
  },
  {
    id: "spot_live_croissant_bake",
    store_id: "store_demo_golden_crust",
    store_name: "Golden Crust Bakery",
    store_slug: "golden-crust-bakery",
    store_logo: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=200&q=80",
    store_category: "groceries",
    type: "live",
    media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    title: "Live Baking 🥐 Glazing Cinnamon Swirls & Butter Croissants Fresh from Oven",
    description: "Watch the master baker glaze golden pastry layers live. Order now for 20-min express delivery in Kampala.",
    product: {
      id: "prod_butter_croissant",
      title: "Flaky French Butter Croissant (Pack of 2)",
      price: 7500,
      compare_at_price: 9000,
      image_url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80",
      badge: "Warm & Fresh",
    },
    viewer_count: 98,
    likes_count: 940,
    comments_count: 56,
  },
  {
    id: "spot_carousel_retro_sneakers",
    store_id: "store_demo_sneaker_hub",
    store_name: "Kampala Sneaker Hub",
    store_slug: "kampala-sneaker-hub",
    store_logo: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=200&q=80",
    store_category: "stores",
    type: "carousel",
    media_url: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80",
    carousel_images: [
      "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80",
    ],
    title: "Friday Kicks Drop! 🔥 Retro High-Tops & Minimalist Streetwear Court Sneakers",
    description: "Swipe to view all angles of the Court Edition Air Retros. Original leather, verified authentic box.",
    product: {
      id: "prod_retro_high_top",
      title: "Air Retro High-Top Court Edition",
      price: 185000,
      compare_at_price: 220000,
      image_url: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=400&q=80",
      badge: "Limited Drop",
    },
    likes_count: 3410,
    comments_count: 215,
  },
  {
    id: "spot_video_anc_earbuds",
    store_id: "store_demo_tech_pulse",
    store_name: "TechPulse Electronics",
    store_slug: "techpulse-electronics",
    store_logo: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
    store_category: "stores",
    type: "video",
    media_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    title: "Active Noise Cancelling Test 🎧 40hr Battery & Crystal Clear Bass Unboxing",
    description: "Testing Bluetooth 5.3 instant pairing and wireless fast charge. Works with both iOS and Android.",
    product: {
      id: "prod_anc_earbuds",
      title: "PulsePro Wireless ANC Earbuds",
      price: 95000,
      compare_at_price: 120000,
      image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80",
      badge: "Trending",
    },
    likes_count: 1720,
    comments_count: 94,
  },
  {
    id: "spot_image_organic_shea",
    store_id: "store_demo_glow_beauty",
    store_name: "Glow Essence Beauty",
    store_slug: "glow-essence-beauty",
    store_logo: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&q=80",
    store_category: "stores",
    type: "image",
    media_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    title: "Whipped Shea Butter Body Silk 🍯 Infused with Madagascar Vanilla & Baobab Oil",
    description: "Pure organic moisture for dry skin. Melts instantly on contact with hands. Made in Uganda.",
    product: {
      id: "prod_whipped_shea",
      title: "Organic Whipped Nilotica Shea Butter (250g)",
      price: 28000,
      image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
      badge: "100% Pure",
    },
    likes_count: 890,
    comments_count: 42,
  },
];
