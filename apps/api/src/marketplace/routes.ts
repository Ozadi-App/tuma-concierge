import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getMarketplaceSettings, getPlatformEnvironment } from "../lib/settings.js";
import { hasColumn } from "../lib/schema.js";

export const marketplaceRoutes = new Hono();

type Row = Record<string, unknown>;

// Demo stores for sandbox and immediate testing
export const DEMO_MARKETPLACE_STORES = [
  {
    id: "store_demo_fresh_mart",
    name: "FreshMart Supermarket",
    slug: "freshmart-kampala",
    category: "groceries",
    sub_category: "supermarket",
    description: "Kampala's premier organic produce, pantry staples, bakery & dairy delivered in minutes.",
    announcement: "Free delivery on grocery orders over UGX 40,000! 🥕",
    logo_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 700 123 456",
    whatsapp_number: "+256 700 123 456",
    address: "Acacia Mall Ground Floor, Kololo",
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
    id: "store_demo_urban_vogue",
    name: "Urban Vogue Boutique",
    slug: "urban-vogue-ug",
    category: "stores",
    sub_category: "fashion-boutique",
    description: "Contemporary street style, tailored linen shirts, denim essentials and designer sneakers.",
    announcement: "Flash Live Sale: 20% off all jackets tonight only! ✨",
    logo_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 772 987 654",
    whatsapp_number: "+256 772 987 654",
    address: "Garden City Mall Level 2, Kampala",
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
    logo_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 750 333 444",
    whatsapp_number: "+256 750 333 444",
    address: "Pioneer Mall, Kampala CBD",
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 15000,
    pro_tier: "pro_store",
    is_live: 0,
    live_channel_title: null,
    live_stream_url: null,
    live_viewer_count: 0,
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
    logo_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 701 445 566",
    whatsapp_number: "+256 701 445 566",
    address: "Bukoto Street, Kamwokya",
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
    id: "store_demo_glow_beauty",
    name: "Glow Essence Beauty",
    slug: "glow-essence-beauty",
    category: "stores",
    sub_category: "beauty",
    description: "Clean skincare, organic Shea butter creams, vitamin serums & natural cosmetics.",
    announcement: "Free rosewater mist with every order over UGX 50,000 ✨",
    logo_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 788 223 344",
    whatsapp_number: "+256 788 223 344",
    address: "Village Mall Bugolobi, Level 1",
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
    logo_url: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=300&q=80",
    banner_url: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 702 889 900",
    whatsapp_number: "+256 702 889 900",
    address: "Arena Mall, Nsambya",
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 20000,
    pro_tier: "pro_store",
    is_live: 0,
    live_channel_title: null,
    live_stream_url: null,
    live_viewer_count: 0,
    status: "active",
  },
];

export const DEMO_MARKETPLACE_PRODUCTS: Record<string, any[]> = {
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
      image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
      has_variants: 1,
      variants: [
        { id: "var_eggs_6", title: "Pack of 6", price: 3200, inventory_quantity: 30 },
        { id: "var_eggs_12", title: "Pack of 12", price: 6000, inventory_quantity: 20 },
        { id: "var_eggs_30", title: "Full Tray (30)", price: 13500, compare_at_price: 15000, inventory_quantity: 45 },
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
      image_url: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
      has_variants: 0,
      variants: [],
    },
    {
      id: "prod_cinnamon_roll",
      store_id: "store_demo_golden_crust",
      title: "Glazed Cinnamon Swirl Rolls (Box of 3)",
      slug: "glazed-cinnamon-swirl-rolls",
      description: "Soft brioche dough packed with Ceylon cinnamon and cream cheese vanilla drizzle.",
      price: 15000,
      compare_at_price: 18000,
      inventory_quantity: 18,
      category_name: "Bakery",
      badge: "Best Seller",
      image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
      has_variants: 0,
      variants: [],
    },
  ],
  store_demo_urban_vogue: [
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
      image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=600&q=80",
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
      image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
      has_variants: 1,
      variants: [
        { id: "var_earbuds_black", title: "Midnight Black", price: 95000, inventory_quantity: 20 },
        { id: "var_earbuds_white", title: "Frost White", price: 95000, inventory_quantity: 15 },
      ],
    },
    {
      id: "prod_powerbank_65w",
      store_id: "store_demo_tech_pulse",
      title: "65W Fast Charge Laptop Power Station (20,000mAh)",
      slug: "65w-fast-charge-power-station",
      description: "Charges MacBooks, iPhones and Androids at full speed. Aviation-safe capacity.",
      price: 145000,
      compare_at_price: 165000,
      inventory_quantity: 20,
      category_name: "Gadgets",
      badge: "Power Gear",
      image_url: "https://images.unsplash.com/photo-1609592424109-dd9892f1b177?auto=format&fit=crop&w=600&q=80",
      has_variants: 0,
      variants: [],
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
      image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
      has_variants: 1,
      variants: [
        { id: "var_shea_vanilla", title: "Madagascar Vanilla Scent (250g)", price: 28000, inventory_quantity: 25 },
        { id: "var_shea_unscented", title: "Fragrance Free Pure (250g)", price: 28000, inventory_quantity: 20 },
      ],
    },
    {
      id: "prod_glow_serum",
      store_id: "store_demo_glow_beauty",
      title: "Vitamin C & Niacinamide Radiance Serum (30ml)",
      slug: "vitamin-c-niacinamide-radiance-serum",
      description: "Brightening active formula to clear blemishes, fade spots and even skin tone.",
      price: 45000,
      compare_at_price: 55000,
      inventory_quantity: 25,
      category_name: "Beauty",
      badge: "Best Seller",
      image_url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80",
      has_variants: 0,
      variants: [],
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
      image_url: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80",
      has_variants: 1,
      variants: [
        { id: "var_kicks_41", title: "EU 41 / UK 7", price: 185000, inventory_quantity: 4 },
        { id: "var_kicks_42", title: "EU 42 / UK 8", price: 185000, inventory_quantity: 6 },
        { id: "var_kicks_43", title: "EU 43 / UK 9", price: 185000, inventory_quantity: 5 },
        { id: "var_kicks_44", title: "EU 44 / UK 10", price: 185000, inventory_quantity: 3 },
      ],
    },
    {
      id: "prod_canvas_low",
      store_id: "store_demo_sneaker_hub",
      title: "Everyday Clean Canvas Low-Tops",
      slug: "everyday-clean-canvas-low-tops",
      description: "Minimalist off-white canvas with vulcanised gum rubber sole. Effortless daily wear.",
      price: 75000,
      compare_at_price: 90000,
      inventory_quantity: 22,
      category_name: "Footwear",
      badge: "Wardrobe Essential",
      image_url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=600&q=80",
      has_variants: 0,
      variants: [],
    },
  ],
};

export const DEMO_MARKETPLACE_SPOTLIGHT = [
  {
    id: "spot_live_fresh_harvest",
    store_id: "store_demo_fresh_mart",
    store_name: "FreshMart Supermarket",
    store_slug: "freshmart-kampala",
    store_logo: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80",
    store_category: "groceries",
    type: "live" as const,
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
    type: "video" as const,
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
    type: "live" as const,
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
    type: "carousel" as const,
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
    type: "video" as const,
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
    type: "image" as const,
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

// ---------------------------------------------------------------------------
// Merchant Pro Store Endpoints
// ---------------------------------------------------------------------------

async function getMerchantStore(merchantId: string): Promise<Row | null> {
  const res = await db.execute({
    sql: "SELECT * FROM stores WHERE merchant_id = ? LIMIT 1",
    args: [merchantId],
  });
  return (res.rows[0] as Row | undefined) ?? null;
}

// 1. Get Merchant's Store Profile & Status
marketplaceRoutes.get("/merchants/me/store", requireAuth, async (c) => {
  const user = c.get("user");
  // Find merchant linked to this user
  const memberRes = await db.execute({
    sql: "SELECT merchant_id, role FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const member = memberRes.rows[0] as Row | undefined;
  if (!member) return c.json({ error: "no_merchant_membership" }, 403);

  const merchantId = String(member.merchant_id);
  const store = await getMerchantStore(merchantId);
  const settings = await getMarketplaceSettings();

  if (!store) {
    return c.json({
      store: null,
      canCreate: true,
      trialDays: settings.proTrialDays,
      pricing: {
        proPricingMode: settings.proPricingMode,
        proStoreUgx: settings.proStorePriceUgx,
        proLiveUgx: settings.proLivePriceUgx,
        isProFree: settings.proPricingMode === "free",
      },
    });
  }

  // Count active products
  const countRes = await db.execute({
    sql: "SELECT COUNT(*) as count FROM store_products WHERE store_id = ? AND status != 'archived'",
    args: [String(store.id)],
  });
  const productCount = Number((countRes.rows[0] as Row)?.count || 0);

  const isProFree = settings.proPricingMode === "free";
  const effectiveProTier = isProFree ? "pro_live" : (store.pro_tier as string || "free");

  return c.json({
    store: {
      ...store,
      pro_tier: effectiveProTier,
      is_pro_free: isProFree,
      productCount,
    },
    settings,
  });
});

// 2. Create Store (Assisted Quick Setup)
const createStoreSchema = z.object({
  name: z.string().min(2).max(60),
  category: z.enum(["groceries", "stores"]),
  sub_category: z.string().optional(),
  description: z.string().max(500).optional(),
  announcement: z.string().max(160).optional(),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  address: z.string().optional(),
  min_order_amount: z.number().int().nonnegative().optional(),
});

marketplaceRoutes.post("/merchants/me/store", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id, role FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const member = memberRes.rows[0] as Row | undefined;
  if (!member) return c.json({ error: "no_merchant_membership" }, 403);
  const merchantId = String(member.merchant_id);

  const existing = await getMerchantStore(merchantId);
  if (existing) return c.json({ error: "store_already_exists", storeId: existing.id }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = createStoreSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const storeId = newId("store");
  const baseSlug = slugify(parsed.data.name);
  const slug = `${baseSlug}-${storeId.slice(-4)}`;
  const environment = await getPlatformEnvironment();
  const settings = await getMarketplaceSettings();

  // Automatic 14-day Pro Live trial so sellers experience live selling immediately!
  const trialExpiresAt = new Date(Date.now() + settings.proTrialDays * 86400000).toISOString();

  await db.execute({
    sql: `INSERT INTO stores (
      id, merchant_id, name, slug, category, sub_category, description,
      announcement, phone, whatsapp_number, address, min_order_amount,
      pro_tier, pro_expires_at, status, environment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [
      storeId,
      merchantId,
      parsed.data.name,
      slug,
      parsed.data.category,
      parsed.data.sub_category || "general",
      parsed.data.description || "",
      parsed.data.announcement || "Welcome to our store! Shop online for fast delivery.",
      parsed.data.phone || "",
      parsed.data.whatsapp_number || "",
      parsed.data.address || "",
      parsed.data.min_order_amount || settings.minOrderAmountUgx,
      "pro_live",
      trialExpiresAt,
      environment,
    ],
  });

  const created = await getMerchantStore(merchantId);
  return c.json({ store: created, trialActive: true });
});

// 3. Update Store Settings
marketplaceRoutes.put("/merchants/me/store", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ error: "no_store" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const updateSchema = z.object({
    name: z.string().min(2).max(60).optional(),
    description: z.string().max(500).optional(),
    announcement: z.string().max(160).optional(),
    logo_url: z.string().url().or(z.string().length(0)).optional(),
    banner_url: z.string().url().or(z.string().length(0)).optional(),
    phone: z.string().optional(),
    whatsapp_number: z.string().optional(),
    address: z.string().optional(),
    is_open: z.boolean().optional(),
    delivery_enabled: z.boolean().optional(),
    pickup_enabled: z.boolean().optional(),
    min_order_amount: z.number().int().nonnegative().optional(),
  });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const updates: string[] = [];
  const args: (string | number)[] = [];

  if (parsed.data.name != null) { updates.push("name = ?"); args.push(parsed.data.name); }
  if (parsed.data.description != null) { updates.push("description = ?"); args.push(parsed.data.description); }
  if (parsed.data.announcement != null) { updates.push("announcement = ?"); args.push(parsed.data.announcement); }
  if (parsed.data.logo_url != null) { updates.push("logo_url = ?"); args.push(parsed.data.logo_url); }
  if (parsed.data.banner_url != null) { updates.push("banner_url = ?"); args.push(parsed.data.banner_url); }
  if (parsed.data.phone != null) { updates.push("phone = ?"); args.push(parsed.data.phone); }
  if (parsed.data.whatsapp_number != null) { updates.push("whatsapp_number = ?"); args.push(parsed.data.whatsapp_number); }
  if (parsed.data.address != null) { updates.push("address = ?"); args.push(parsed.data.address); }
  if (parsed.data.is_open != null) { updates.push("is_open = ?"); args.push(parsed.data.is_open ? 1 : 0); }
  if (parsed.data.delivery_enabled != null) { updates.push("delivery_enabled = ?"); args.push(parsed.data.delivery_enabled ? 1 : 0); }
  if (parsed.data.pickup_enabled != null) { updates.push("pickup_enabled = ?"); args.push(parsed.data.pickup_enabled ? 1 : 0); }
  if (parsed.data.min_order_amount != null) { updates.push("min_order_amount = ?"); args.push(parsed.data.min_order_amount); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    args.push(String(store.id));
    await db.execute({
      sql: `UPDATE stores SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });
  }

  const updated = await getMerchantStore(merchantId);
  return c.json({ store: updated });
});

// 4. Products Management
marketplaceRoutes.get("/merchants/me/products", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ products: [] });

  const productsRes = await db.execute({
    sql: "SELECT * FROM store_products WHERE store_id = ? AND status != 'archived' ORDER BY sort_order, created_at DESC",
    args: [String(store.id)],
  });

  const variantsRes = await db.execute({
    sql: `SELECT v.* FROM store_product_variants v
          JOIN store_products p ON p.id = v.product_id
          WHERE p.store_id = ? ORDER BY v.created_at`,
    args: [String(store.id)],
  });

  const variantsByProduct: Record<string, any[]> = {};
  for (const v of variantsRes.rows as Row[]) {
    const pid = String(v.product_id);
    variantsByProduct[pid] = variantsByProduct[pid] || [];
    variantsByProduct[pid].push(v);
  }

  const products = productsRes.rows.map((p) => ({
    ...p,
    variants: variantsByProduct[String(p.id)] || [],
  }));

  return c.json({ products });
});

const productSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  price: z.number().int().positive(),
  compare_at_price: z.number().int().positive().optional(),
  cost_price: z.number().int().nonnegative().optional(),
  sku: z.string().max(40).optional(),
  barcode: z.string().max(40).optional(),
  track_inventory: z.boolean().default(true),
  inventory_quantity: z.number().int().nonnegative().default(100),
  category_name: z.string().max(60).optional(),
  badge: z.string().max(30).optional(),
  image_url: z.string().url().or(z.string().length(0)).optional(),
  video_url: z.string().url().or(z.string().length(0)).optional(),
  has_variants: z.boolean().default(false),
  variants: z
    .array(
      z.object({
        title: z.string().min(1),
        price: z.number().int().positive(),
        compare_at_price: z.number().int().positive().optional(),
        sku: z.string().optional(),
        inventory_quantity: z.number().int().nonnegative().default(100),
      })
    )
    .optional(),
});

marketplaceRoutes.post("/merchants/me/products", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ error: "no_store" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);

  const productId = newId("prod");
  const slug = slugify(parsed.data.title);

  await db.execute({
    sql: `INSERT INTO store_products (
      id, store_id, title, slug, description, price, compare_at_price,
      cost_price, sku, barcode, track_inventory, inventory_quantity,
      category_name, badge, image_url, video_url, has_variants, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    args: [
      productId,
      String(store.id),
      parsed.data.title,
      slug,
      parsed.data.description || "",
      parsed.data.price,
      parsed.data.compare_at_price || null,
      parsed.data.cost_price || null,
      parsed.data.sku || "",
      parsed.data.barcode || "",
      parsed.data.track_inventory ? 1 : 0,
      parsed.data.inventory_quantity,
      parsed.data.category_name || "General",
      parsed.data.badge || "",
      parsed.data.image_url || "",
      parsed.data.video_url || "",
      parsed.data.has_variants ? 1 : 0,
    ],
  });

  if (parsed.data.has_variants && parsed.data.variants && parsed.data.variants.length > 0) {
    for (const v of parsed.data.variants) {
      await db.execute({
        sql: `INSERT INTO store_product_variants (
          id, product_id, title, price, compare_at_price, sku, inventory_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          newId("var"),
          productId,
          v.title,
          v.price,
          v.compare_at_price || null,
          v.sku || "",
          v.inventory_quantity,
        ],
      });
    }
  }

  return c.json({ ok: true, productId });
});

// 5. 1-Click Catalog Starter Pack (Snake-game chap-chap speed)
marketplaceRoutes.post("/merchants/me/products/starter-pack", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ error: "no_store" }, 404);

  const category = String(store.category);
  const starterItems =
    category === "groceries"
      ? [
          {
            title: "Fresh Whole Milk (1L)",
            category: "Dairy & Eggs",
            price: 3500,
            compare_at_price: 4000,
            badge: "Fresh Daily",
            image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Farm Fresh Eggs (Crate of 30)",
            category: "Dairy & Eggs",
            price: 13500,
            compare_at_price: 15000,
            badge: "Popular",
            image_url: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Super White Sliced Bread (400g)",
            category: "Bakery",
            price: 4500,
            badge: "Baked Today",
            image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Pure White Sugar (1kg)",
            category: "Pantry Staples",
            price: 5000,
            image_url: "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Pure Vegetable Cooking Oil (2 Litres)",
            category: "Pantry Staples",
            price: 16500,
            compare_at_price: 18000,
            badge: "Special Offer",
            image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Sweet Cavendish Bananas (Bunch)",
            category: "Fresh Produce",
            price: 4000,
            badge: "Organic",
            image_url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80",
          },
        ]
      : [
          {
            title: "Premium Heavyweight Cotton T-Shirt",
            category: "Apparel",
            price: 45000,
            compare_at_price: 55000,
            badge: "Best Seller",
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Slim Stretch Denim Jeans",
            category: "Apparel",
            price: 75000,
            compare_at_price: 90000,
            badge: "Top Rated",
            image_url: "https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Classic Low-Top Canvas Sneakers",
            category: "Footwear",
            price: 85000,
            compare_at_price: 110000,
            badge: "Sale",
            image_url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Minimalist Leather Bifold Wallet",
            category: "Accessories",
            price: 35000,
            image_url: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80",
          },
          {
            title: "Wireless Bluetooth Earbuds with ANC",
            category: "Gadgets",
            price: 95000,
            compare_at_price: 120000,
            badge: "Trending",
            image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80",
          },
        ];

  let addedCount = 0;
  for (const item of starterItems) {
    const pid = newId("prod");
    await db.execute({
      sql: `INSERT INTO store_products (
        id, store_id, title, slug, description, price, compare_at_price,
        track_inventory, inventory_quantity, category_name, badge, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 50, ?, ?, ?, 'active')`,
      args: [
        pid,
        String(store.id),
        item.title,
        slugify(item.title),
        `Authentic quality ${item.title}. Carefully selected and inspected.`,
        item.price,
        item.compare_at_price || null,
        item.category,
        item.badge || "",
        item.image_url,
      ],
    });
    addedCount++;
  }

  return c.json({ ok: true, addedCount });
});

// 6. TikTok Live Studio Endpoints
marketplaceRoutes.post("/merchants/me/store/live/start", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ error: "no_store" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const sessionId = newId("live");
  const title = body.title || `${store.name} Live Showcase! ✨`;
  const streamUrl = body.streamUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
  const isRestream = body.isRestream ? 1 : 0;

  await db.execute({
    sql: `INSERT INTO store_live_sessions (
      id, store_id, title, status, stream_url, is_restream, started_at
    ) VALUES (?, ?, ?, 'live', ?, ?, datetime('now'))`,
    args: [sessionId, store.id, title, streamUrl, isRestream],
  });

  await db.execute({
    sql: `UPDATE stores SET
      is_live = 1,
      live_channel_title = ?,
      live_stream_url = ?,
      live_started_at = datetime('now'),
      live_viewer_count = 1
      WHERE id = ?`,
    args: [title, streamUrl, store.id],
  });

  return c.json({ ok: true, sessionId });
});

marketplaceRoutes.post("/merchants/me/store/live/end", requireAuth, async (c) => {
  const user = c.get("user");
  const memberRes = await db.execute({
    sql: "SELECT merchant_id FROM merchant_members WHERE user_id = ? AND status = 'active' LIMIT 1",
    args: [user.sub],
  });
  const merchantId = (memberRes.rows[0] as Row | undefined)?.merchant_id as string | undefined;
  if (!merchantId) return c.json({ error: "no_merchant_membership" }, 403);

  const store = await getMerchantStore(merchantId);
  if (!store) return c.json({ error: "no_store" }, 404);

  await db.execute({
    sql: `UPDATE store_live_sessions SET status = 'ended', ended_at = datetime('now')
          WHERE store_id = ? AND status = 'live'`,
    args: [String(store.id)],
  });

  await db.execute({
    sql: `UPDATE stores SET is_live = 0, live_viewer_count = 0 WHERE id = ?`,
    args: [String(store.id)],
  });

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Customer Public Marketplace Endpoints
// ---------------------------------------------------------------------------

marketplaceRoutes.get("/marketplace/stores", async (c) => {
  const category = c.req.query("category"); // 'groceries' | 'stores'
  const environment = await getPlatformEnvironment();

  let query = "SELECT * FROM stores WHERE status = 'active' AND environment = ?";
  const args: (string | number)[] = [environment];

  if (category && (category === "groceries" || category === "stores")) {
    query += " AND category = ?";
    args.push(category);
  }

  query += " ORDER BY is_live DESC, is_open DESC, name";
  const res = await db.execute({ sql: query, args });

  let stores = res.rows as Row[];
  if (stores.length === 0) {
    // Fallback to demo stores so browsing and testing works immediately!
    stores = DEMO_MARKETPLACE_STORES.filter((s) => !category || s.category === category);
  }

  return c.json({ stores });
});

marketplaceRoutes.get("/marketplace/stores/:id", async (c) => {
  const id = c.req.param("id");
  const res = await db.execute({
    sql: "SELECT * FROM stores WHERE id = ? OR slug = ?",
    args: [id, id],
  });

  let store = (res.rows[0] as Row | undefined) ?? null;
  if (!store) {
    store = DEMO_MARKETPLACE_STORES.find((s) => s.id === id || s.slug === id) || null;
  }

  if (!store) return c.json({ error: "store_not_found" }, 404);
  return c.json({ store });
});

marketplaceRoutes.get("/marketplace/stores/:id/products", async (c) => {
  const id = c.req.param("id");
  const storeRes = await db.execute({
    sql: "SELECT id FROM stores WHERE id = ? OR slug = ?",
    args: [id, id],
  });

  const realStoreId = (storeRes.rows[0] as Row | undefined)?.id as string | undefined || id;

  const productsRes = await db.execute({
    sql: "SELECT * FROM store_products WHERE store_id = ? AND status = 'active' ORDER BY sort_order, created_at DESC",
    args: [realStoreId],
  });

  let products = productsRes.rows as Row[];
  if (products.length === 0 && DEMO_MARKETPLACE_PRODUCTS[realStoreId]) {
    products = DEMO_MARKETPLACE_PRODUCTS[realStoreId];
  }

  const variantsRes = await db.execute({
    sql: `SELECT v.* FROM store_product_variants v
          JOIN store_products p ON p.id = v.product_id
          WHERE p.store_id = ? ORDER BY v.created_at`,
    args: [realStoreId],
  });

  const variantsByProduct: Record<string, any[]> = {};
  for (const v of variantsRes.rows as Row[]) {
    const pid = String(v.product_id);
    variantsByProduct[pid] = variantsByProduct[pid] || [];
    variantsByProduct[pid].push(v);
  }

  const enriched = products.map((p) => ({
    ...p,
    variants: (p.variants as any[]) || variantsByProduct[String(p.id)] || [],
  }));

  return c.json({ products: enriched });
});

// Live Channels Feed (for top "LIVE NOW" rail)
marketplaceRoutes.get("/marketplace/live", async (c) => {
  const res = await db.execute({
    sql: `SELECT s.id, s.name, s.slug, s.logo_url, s.banner_url, s.category,
                 s.live_channel_title, s.live_stream_url, s.live_viewer_count,
                 s.live_started_at
          FROM stores s
          WHERE s.is_live = 1 AND s.status = 'active'`,
    args: [],
  });

  let liveChannels = res.rows as Row[];
  if (liveChannels.length === 0) {
    liveChannels = DEMO_MARKETPLACE_STORES.filter((s) => s.is_live === 1);
  }

  return c.json({ liveChannels });
});

// Spotlight Endless Feed (TikTok / Reels / Shorts style)
marketplaceRoutes.get("/marketplace/spotlight", async (c) => {
  const category = c.req.query("category"); // 'all' | 'groceries' | 'stores' | 'live'
  let items = DEMO_MARKETPLACE_SPOTLIGHT;

  if (category && category !== "all") {
    if (category === "live") {
      items = items.filter((item) => item.type === "live");
    } else {
      items = items.filter((item) => item.store_category === category);
    }
  }

  return c.json({ spotlight: items });
});

