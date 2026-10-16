import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { db, executeBatch } from "../db/client.js";
import { newId } from "../lib/ids.js";
import { getDeliverySettings, getMarketplaceSettings, getMatchingSettings, getPlatformEnvironment } from "../lib/settings.js";
import { hasColumn, hasTable } from "../lib/schema.js";
import { haversineKm } from "../lib/geo.js";
import { roundFare, type MatchingMode } from "@peebee/shared";
import { snapshotTimeFees } from "../orders/time-fees.js";
import { notifyUser } from "../lib/webpush.js";
import { initialLastMile, insertRelayLegs, planRelay, relayChargeFor, type RelayLastMile, type RelayPlan } from "../relay/service.js";

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
    live_stream_url: "https://customer.peebee.online/demo-video/market.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/market.jpg",
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
    live_stream_url: "https://customer.peebee.online/demo-video/fashion.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/fashion.jpg",
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
    live_stream_url: "https://customer.peebee.online/demo-video/earbuds.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/earbuds.jpg",
    live_viewer_count: 215,
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
    live_stream_url: "https://customer.peebee.online/demo-video/bakery.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/bakery.jpg",
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
    live_stream_url: "https://customer.peebee.online/demo-video/skincare.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/skincare.jpg",
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
    live_stream_url: "https://customer.peebee.online/demo-video/sneakers.mp4",
    live_stream_poster_url: "https://customer.peebee.online/demo-video/sneakers.jpg",
    live_viewer_count: 188,
    status: "active",
  },
  {
    id: "store_demo_vine_pharmacy",
    name: "Vine Pharmacy — Acacia Mall",
    slug: "vine-pharmacy-acacia",
    category: "pharmacy",
    sub_category: "retail-pharmacy",
    description: "Full service licensed pharmacy dispensing authentic prescription medicines, cold care, baby wellness and vitamins.",
    announcement: "Supervising Pharmacist on duty 7 days a week. Express 25-min delivery across Kampala! 💊",
    logo_url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=200&q=80",
    banner_url: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 772 110 220",
    whatsapp_number: "+256 772 110 220",
    address: "Acacia Mall, Ground Floor, Kisementi, Kololo",
    lat: 0.3344,
    lng: 32.5891,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 5000,
    pro_tier: "pro_store",
    is_live: 0,
    live_channel_title: null,
    live_stream_url: null,
    live_viewer_count: 0,
    status: "active",
    nda_license_number: "NDA/PREM/KLA/2026/0418",
    supervising_pharmacist: "Dr. Sarah Namubiru, BPharm, MPS",
    is_nda_verified: true,
  },
  {
    id: "store_demo_first_pharmacy",
    name: "First Pharmacy — Wandegeya",
    slug: "first-pharmacy-wandegeya",
    category: "pharmacy",
    sub_category: "retail-pharmacy",
    description: "24/7 prescription dispensing, chronic care medication, allergy relief, first aid and diagnostics.",
    announcement: "Upload prescription online for rapid pharmacist verification and courier dispatch 🚑",
    logo_url: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=200&q=80",
    banner_url: "https://images.unsplash.com/photo-1586015555751-63c26210f462?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 701 445 566",
    whatsapp_number: "+256 701 445 566",
    address: "Wandegeya Commercial Centre, Opposite Makerere Gate",
    lat: 0.3312,
    lng: 32.5714,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 5000,
    pro_tier: "pro_store",
    is_live: 0,
    live_channel_title: null,
    live_stream_url: null,
    live_viewer_count: 0,
    status: "active",
    nda_license_number: "NDA/PREM/KLA/2026/0122",
    supervising_pharmacist: "Pharm. Brian Kigozi, BPharm",
    is_nda_verified: true,
  },
  {
    id: "store_demo_ecopharm",
    name: "Ecopharm — Lugogo Mall",
    slug: "ecopharm-lugogo",
    category: "pharmacy",
    sub_category: "retail-pharmacy",
    description: "Trusted community healthcare partner. Orthopedic supports, baby wellness, dermatology and pain management.",
    announcement: "Authentic medicines guaranteed under strict cold chain storage standards ❄️",
    logo_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80",
    banner_url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
    phone: "+256 782 990 011",
    whatsapp_number: "+256 782 990 011",
    address: "Lugogo Shopping Mall, Shop 14, Lugogo Bypass",
    lat: 0.3275,
    lng: 32.6092,
    is_open: 1,
    delivery_enabled: 1,
    pickup_enabled: 1,
    min_order_amount: 5000,
    pro_tier: "pro_store",
    is_live: 0,
    live_channel_title: null,
    live_stream_url: null,
    live_viewer_count: 0,
    status: "active",
    nda_license_number: "NDA/PREM/KLA/2026/0889",
    supervising_pharmacist: "Pharm. Agnes Tumusiime, MPS",
    is_nda_verified: true,
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
      image_url: "/products/cinnamon-rolls.jpg",
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
      image_url: "/products/powerbank-65w.jpg",
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
      image_url: "/products/shea-butter.jpg",
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
      image_url: "/products/glow-serum.jpg",
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
      image_url: "/products/retro-sneakers.jpg",
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
      image_url: "/products/canvas-sneakers.jpg",
      has_variants: 0,
      variants: [],
    },
  ],
  store_demo_vine_pharmacy: [
    {
      id: "prod_panadol_extra",
      store_id: "store_demo_vine_pharmacy",
      title: "Panadol Extra (Paracetamol 500mg + Caffeine 65mg)",
      slug: "panadol-extra-24s",
      description: "Fast relief for tough headaches, migraines, muscle aches, backaches and fever.",
      price: 6500,
      compare_at_price: 7500,
      inventory_quantity: 120,
      category_name: "Pain & Fever",
      badge: "Fast Acting",
      image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Tablets",
      strength: "500mg / 65mg",
      pack_size: "Pack of 24",
      active_ingredient: "Paracetamol, Caffeine",
    },
    {
      id: "prod_piriton_4mg",
      store_id: "store_demo_vine_pharmacy",
      title: "Piriton Allergy Relief 4mg",
      slug: "piriton-4mg-30s",
      description: "Rapid relief from hayfever, skin allergies, runny nose, sneezing, and insect bites.",
      price: 5000,
      inventory_quantity: 85,
      category_name: "Cold & Allergy",
      badge: "Allergy Relief",
      image_url: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Tablets",
      strength: "4mg",
      pack_size: "Strip of 30",
      active_ingredient: "Chlorpheniramine Maleate",
    },
    {
      id: "prod_strepsils_honey",
      store_id: "store_demo_vine_pharmacy",
      title: "Strepsils Honey & Lemon Lozenges",
      slug: "strepsils-honey-lemon-16s",
      description: "Dual antibacterial soothing relief for sore throats and mouth infections.",
      price: 12500,
      compare_at_price: 14000,
      inventory_quantity: 60,
      category_name: "Cold & Allergy",
      badge: "Sore Throat",
      image_url: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Lozenges",
      pack_size: "Pack of 16",
      active_ingredient: "Amylmetacresol, Dichlorobenzyl alcohol",
    },
    {
      id: "prod_redoxon_vit_c",
      store_id: "store_demo_vine_pharmacy",
      title: "Redoxon Double Action Vitamin C 1000mg + Zinc",
      slug: "redoxon-vit-c-zinc-15s",
      description: "Effervescent immune booster tablets with essential Vitamin C and Zinc antioxidant shield.",
      price: 28000,
      compare_at_price: 32000,
      inventory_quantity: 40,
      category_name: "Vitamins & Wellness",
      badge: "Immune Shield",
      image_url: "https://images.unsplash.com/photo-1577401239170-897942555fb3?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Effervescent Tablets",
      strength: "1000mg + 10mg",
      pack_size: "Tube of 15",
      active_ingredient: "Ascorbic Acid, Zinc",
    },
    {
      id: "prod_savlon_250ml",
      store_id: "store_demo_vine_pharmacy",
      title: "Savlon Antiseptic Disinfectant Liquid (250ml)",
      slug: "savlon-antiseptic-liquid-250ml",
      description: "Gentle hospital-grade antiseptic for cleaning cuts, grazes, bites, and wound cleansing.",
      price: 14000,
      inventory_quantity: 50,
      category_name: "First Aid",
      badge: "Hospital Grade",
      image_url: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Liquid",
      pack_size: "250ml Bottle",
      active_ingredient: "Chlorhexidine Gluconate, Cetrimide",
    },
    {
      id: "prod_omeprazole_20mg",
      store_id: "store_demo_vine_pharmacy",
      title: "Omeprazole 20mg Gastro-Resistant Capsules",
      slug: "omeprazole-20mg-14s",
      description: "Relief of frequent heartburn, acid indigestion, and gastric reflux.",
      price: 10000,
      inventory_quantity: 75,
      category_name: "Digestion & Stomach",
      badge: "Acid Relief",
      image_url: "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Capsules",
      strength: "20mg",
      pack_size: "Strip of 14",
      active_ingredient: "Omeprazole",
    },
    {
      id: "prod_woodwards_gripe_water",
      store_id: "store_demo_vine_pharmacy",
      title: "Woodward's Gripe Water for Infants (150ml)",
      slug: "woodwards-gripe-water-150ml",
      description: "Non-alcoholic gentle herbal formula for rapid relief of infant colic, wind, and tummy discomfort during teething.",
      price: 15000,
      inventory_quantity: 35,
      category_name: "Mother & Baby",
      badge: "Infant Care",
      image_url: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Syrup",
      pack_size: "150ml Bottle",
      active_ingredient: "Dill Oil, Sodium Bicarbonate",
    },
  ],
  store_demo_first_pharmacy: [
    {
      id: "prod_hedex_extra",
      store_id: "store_demo_first_pharmacy",
      title: "Hedex Extra Fast Pain Relief Tablets",
      slug: "hedex-extra-16s",
      description: "Targeted fast headache and toothache relief formulation with paracetamol and caffeine.",
      price: 4500,
      inventory_quantity: 90,
      category_name: "Pain & Fever",
      badge: "Targeted Relief",
      image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Tablets",
      strength: "500mg / 65mg",
      pack_size: "Pack of 16",
      active_ingredient: "Paracetamol, Caffeine",
    },
    {
      id: "prod_ascoril_cough",
      store_id: "store_demo_first_pharmacy",
      title: "Ascoril Expectorant Cough Syrup (100ml)",
      slug: "ascoril-cough-syrup-100ml",
      description: "Bronchodilator and expectorant syrup for chesty cough, bronchitis, and respiratory congestion.",
      price: 16000,
      compare_at_price: 18500,
      inventory_quantity: 45,
      category_name: "Cold & Allergy",
      badge: "Chesty Cough",
      image_url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Syrup",
      strength: "100ml",
      pack_size: "100ml Bottle",
      active_ingredient: "Terbutaline, Bromhexine, Guaiphenesin",
    },
    {
      id: "prod_sudocrem_60g",
      store_id: "store_demo_first_pharmacy",
      title: "Sudocrem Antiseptic Healing Cream (60g)",
      slug: "sudocrem-healing-cream-60g",
      description: "Clinically proven soothing protection for baby nappy rash, eczema, bedsores, and minor burns.",
      price: 24000,
      inventory_quantity: 30,
      category_name: "Mother & Baby",
      badge: "Dermatologist Approved",
      image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Topical Cream",
      pack_size: "60g Tub",
      active_ingredient: "Zinc Oxide, Benzyl Benzoate",
    },
    {
      id: "prod_digital_thermometer",
      store_id: "store_demo_first_pharmacy",
      title: "Accu-Scan Infrared Forehead & Ear Thermometer",
      slug: "accu-scan-digital-thermometer",
      description: "Instant 1-second non-contact clinical body temperature measurement with fever alarm.",
      price: 45000,
      compare_at_price: 52000,
      inventory_quantity: 20,
      category_name: "First Aid",
      badge: "Clinical Precision",
      image_url: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&w=400&q=80",
      has_variants: 0,
      variants: [],
      rx_required: false,
      dosage_form: "Diagnostic Device",
      pack_size: "1 Unit",
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
    media_url: "https://customer.peebee.online/demo-video/market.mp4",
    poster_url: "https://customer.peebee.online/demo-video/market.jpg",
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
    media_url: "https://customer.peebee.online/demo-video/fashion.mp4",
    poster_url: "https://customer.peebee.online/demo-video/fashion.jpg",
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
    media_url: "https://customer.peebee.online/demo-video/bakery.mp4",
    poster_url: "https://customer.peebee.online/demo-video/bakery.jpg",
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
    media_url: "https://customer.peebee.online/demo-video/earbuds.mp4",
    poster_url: "https://customer.peebee.online/demo-video/earbuds.jpg",
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
  const streamUrl = body.streamUrl || "https://customer.peebee.online/demo-video/earbuds.mp4";
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
  const latParam = c.req.query("lat");
  const lngParam = c.req.query("lng");
  const userLat = latParam != null && latParam !== "" ? parseFloat(latParam) : null;
  const userLng = lngParam != null && lngParam !== "" ? parseFloat(lngParam) : null;
  const hasUserCoords = userLat != null && !isNaN(userLat) && userLng != null && !isNaN(userLng);
  const environment = await getPlatformEnvironment();

  let query = "SELECT * FROM stores WHERE status = 'active' AND environment = ?";
  const args: (string | number)[] = [environment];

  if (category && (category === "groceries" || category === "stores" || category === "pharmacy")) {
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

  if (hasUserCoords) {
    stores = stores.map((s) => {
      const sLat = typeof s.lat === "number" ? s.lat : typeof s.lat === "string" ? parseFloat(s.lat) : null;
      const sLng = typeof s.lng === "number" ? s.lng : typeof s.lng === "string" ? parseFloat(s.lng) : null;
      const distanceKm = sLat != null && sLng != null && !isNaN(sLat) && !isNaN(sLng)
        ? Math.round(haversineKm(userLat, userLng, sLat, sLng) * 10) / 10
        : null;
      return {
        ...s,
        distance_km: distanceKm,
      };
    });

    stores.sort((a, b) => {
      const distA = typeof a.distance_km === "number" ? a.distance_km : 999999;
      const distB = typeof b.distance_km === "number" ? b.distance_km : 999999;
      return distA - distB;
    });
  }

  return c.json({ stores });
});

marketplaceRoutes.get("/marketplace/stores/:id", async (c) => {
  const id = c.req.param("id");
  const latParam = c.req.query("lat");
  const lngParam = c.req.query("lng");
  const userLat = latParam != null && latParam !== "" ? parseFloat(latParam) : null;
  const userLng = lngParam != null && lngParam !== "" ? parseFloat(lngParam) : null;

  const res = await db.execute({
    sql: "SELECT * FROM stores WHERE id = ? OR slug = ?",
    args: [id, id],
  });

  let store = (res.rows[0] as Row | undefined) ?? null;
  if (!store) {
    store = DEMO_MARKETPLACE_STORES.find((s) => s.id === id || s.slug === id) || null;
  }

  if (!store) return c.json({ error: "store_not_found" }, 404);

  if (userLat != null && !isNaN(userLat) && userLng != null && !isNaN(userLng)) {
    const sLat = typeof store.lat === "number" ? store.lat : typeof store.lat === "string" ? parseFloat(store.lat) : null;
    const sLng = typeof store.lng === "number" ? store.lng : typeof store.lng === "string" ? parseFloat(store.lng) : null;
    const distanceKm = sLat != null && sLng != null && !isNaN(sLat) && !isNaN(sLng)
      ? Math.round(haversineKm(userLat, userLng, sLat, sLng) * 10) / 10
      : null;
    store = { ...store, distance_km: distanceKm };
  }

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

marketplaceRoutes.get("/marketplace/products/:id", async (c) => {
  const id = c.req.param("id");

  // 1. Try database lookup
  const prodRes = await db.execute({
    sql: "SELECT * FROM store_products WHERE id = ? OR slug = ?",
    args: [id, id],
  });

  let product = (prodRes.rows[0] as Row | undefined) || null;
  let store: Row | null = null;

  if (product) {
    const variantsRes = await db.execute({
      sql: "SELECT * FROM store_product_variants WHERE product_id = ? ORDER BY created_at",
      args: [String(product.id)],
    });
    product.variants = variantsRes.rows;

    const storeRes = await db.execute({
      sql: "SELECT id, name, slug, logo_url, banner_url, address, is_open, is_live, delivery_enabled, category FROM stores WHERE id = ?",
      args: [String(product.store_id)],
    });
    store = (storeRes.rows[0] as Row | undefined) || null;
  } else {
    // 2. Fall back to demo products
    for (const [storeId, prods] of Object.entries(DEMO_MARKETPLACE_PRODUCTS)) {
      const match = prods.find((p: any) => p.id === id || p.slug === id);
      if (match) {
        product = { ...match } as unknown as Row;
        const demoStore = DEMO_MARKETPLACE_STORES.find((s) => s.id === storeId);
        if (demoStore) {
          store = { ...demoStore } as unknown as Row;
        }
        break;
      }
    }
  }

  if (!product) {
    return c.json({ error: "product_not_found" }, 404);
  }

  return c.json({ product, store });
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

async function ensureDemoStoreInDb(demoStoreId: string, environment: string) {
  if (!(await hasTable("stores"))) return;
  const existing = await db.execute({ sql: "SELECT id FROM stores WHERE id = ?", args: [demoStoreId] });
  if (existing.rows.length > 0) return;

  const demo = DEMO_MARKETPLACE_STORES.find((s) => s.id === demoStoreId);
  if (!demo) return;

  const merchantId = `${demoStoreId}-merchant`;
  await db.execute({
    sql: `INSERT OR IGNORE INTO merchants (id, legal_name, display_name, status, trust_tier, environment)
          VALUES (?, ?, ?, 'active', 'standard', ?)`,
    args: [merchantId, demo.name, demo.name, environment],
  });

  await db.execute({
    sql: `INSERT OR IGNORE INTO stores (
      id, merchant_id, name, slug, category, sub_category, description,
      announcement, phone, whatsapp_number, address, lat, lng,
      min_order_amount, pro_tier, is_live, status, environment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    args: [
      demo.id,
      merchantId,
      demo.name,
      demo.slug,
      demo.category,
      demo.sub_category || "general",
      demo.description,
      demo.announcement || "",
      demo.phone,
      demo.whatsapp_number,
      demo.address,
      demo.lat || null,
      demo.lng || null,
      demo.min_order_amount,
      demo.pro_tier,
      demo.is_live,
      environment,
    ],
  });
}

const checkoutItemSchema = z.object({
  productId: z.string(),
  storeId: z.string(),
  title: z.string(),
  price: z.number().int().nonnegative(),
  quantity: z.number().int().positive().max(50),
  variantId: z.string().optional(),
  variantTitle: z.string().optional(),
  imageUrl: z.string().optional(),
});

const marketplaceCheckoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  paymentRail: z.enum(["escrow", "float"]).optional(),
  paymentMethod: z.enum(["momo", "airtel", "wallet", "cod"]).optional(),
  destinationAddress: z.string().optional(),
  destinationArea: z.string().optional(),
  destinationLat: z.number().optional(),
  destinationLng: z.number().optional(),
  /** A long delivery dropped at a petrol station: bring it to the door, or collect it there. */
  relayLastMile: z.enum(["door", "collect"]).optional(),
});

// Marketplace Cart Checkout -> Real Orders linked to Boda Delivery System
marketplaceRoutes.post("/marketplace/checkout", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const parsed = marketplaceCheckoutSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;

  const environment = await getPlatformEnvironment();
  const deliverySettings = await getDeliverySettings();
  const { enabledModes, nearestWindowSeconds, maxAssignmentMinutes } = await getMatchingSettings();
  const userRow = await db.execute({ sql: "SELECT default_matching_mode FROM users WHERE id = ?", args: [user.sub] });
  const preferredMode = userRow.rows[0]?.default_matching_mode as MatchingMode | null | undefined;
  const matchingMode: MatchingMode = preferredMode && enabledModes.includes(preferredMode) ? preferredMode : enabledModes[0];
  const matchingDeadlineAt =
    matchingMode === "nearest_window"
      ? new Date(Date.now() + nearestWindowSeconds * 1000).toISOString()
      : matchingMode === "customer_selects"
        ? new Date(Date.now() + maxAssignmentMinutes * 60 * 1000).toISOString()
        : null;

  const paymentRail = d.paymentRail ?? (d.paymentMethod === "cod" ? "float" : "escrow");
  const stage = paymentRail === "float" ? "Match" : "Create";

  const stops = await planMarketplaceDelivery(d.items, d, environment);
  if (stops.some((stop) => stop.relay) && paymentRail === "float") {
    return c.json({ error: "relay_requires_prepay", message: "Long-distance deliveries are paid in the app, not in cash." }, 409);
  }
  const createdOrders: Row[] = [];
  const supportsStoreId = (await hasColumn("orders", "store_id")) && (await hasTable("stores"));

  for (const stop of stops) {
    const listId = newId("list");
    await db.execute({
      sql: "INSERT INTO lists (id, customer_id, title, status, environment) VALUES (?, ?, ?, 'active', ?)",
      args: [listId, user.sub, `${stop.storeName} Order`, environment],
    });

    for (const it of stop.items) {
      const itemName = it.variantTitle ? `${it.title} (${it.variantTitle})` : it.title;
      await db.execute({
        sql: "INSERT INTO list_items (id, list_id, name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)",
        args: [newId("item"), listId, itemName, it.quantity, it.price],
      });
    }

    const orderId = newId("ord");
    const storeCol = supportsStoreId ? ", store_id" : "";
    const storeVal = supportsStoreId ? ", ?" : "";
    const storeArgs = supportsStoreId ? [stop.storeId] : [];

    // The total is the items plus this stop's share of the delivery fee, which is what the customer pays.
    await db.execute({
      sql: `INSERT INTO orders (
              id, list_id, customer_id, stage, type, payment_rail, estimated_total, delivery_fee,
              pickup_area, pickup_address, pickup_lat, pickup_lng,
              destination_area, destination_address, destination_lat, destination_lng, distance_km,
              matching_mode, matching_deadline_at, environment${storeCol}
            )
            VALUES (?, ?, ?, ?, 'shopping', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${storeVal})`,
      args: [
        orderId,
        listId,
        user.sub,
        stage,
        paymentRail,
        stop.itemsTotal + stop.deliveryFee,
        stop.deliveryFee,
        stop.storeName,
        stop.storeAddress,
        stop.lat,
        stop.lng,
        d.destinationArea ?? null,
        d.destinationAddress ?? null,
        d.destinationLat ?? null,
        d.destinationLng ?? null,
        stop.distanceKm,
        matchingMode,
        matchingDeadlineAt,
        environment,
        ...storeArgs,
      ],
    });

    await db.execute({
      sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, ?, ?, ?)",
      args: [newId("evt"), orderId, stage, `Order placed from ${stop.storeName}`, user.sub],
    });

    await snapshotTimeFees(orderId, stop.deliveryFee);
    if (stop.relay) {
      await insertRelayLegs(orderId, stop.relay.plan, stop.relay.lastMile);
      await db.execute({
        sql: "INSERT INTO order_events (id, order_id, stage, note, actor_id) VALUES (?, ?, ?, ?, ?)",
        args: [newId("evt"), orderId, stage, `Relay delivery by boda and matatu (${stop.relay.plan.routeName})`, user.sub],
      });
    }
    createdOrders.push({ id: orderId });
  }

  // Several stores in one bag are one delivery: one rider collects from every
  // store in turn, and the customer pays once (see orders/bundle-funding.ts).
  if (createdOrders.length > 1 && (await hasColumn("orders", "delivery_bundle_id"))) {
    const leadId = String(createdOrders[0].id);
    await executeBatch(createdOrders.map((order) => ({
      sql: "UPDATE orders SET delivery_bundle_id = ? WHERE id = ?",
      args: [leadId, String(order.id)],
    })));
  }

  const ids = createdOrders.map((order) => String(order.id));
  const full = await db.execute({
    sql: `SELECT o.*, c.name as customer_name, r.name as rider_name FROM orders o
          LEFT JOIN users c ON c.id = o.customer_id
          LEFT JOIN users r ON r.id = o.rider_id
          WHERE o.id IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  const byId = new Map((full.rows as Row[]).map((row) => [String(row.id), row]));
  const orders = ids.map((id) => byId.get(id)).filter(Boolean) as Row[];

  // One notice per delivery, not one per store.
  try {
    const onlineRiders = await db.execute("SELECT u.id FROM riders r JOIN users u ON u.id = r.user_id WHERE r.verified = 1 AND r.is_online = 1");
    const deliveryFee = stops.reduce((sum, stop) => sum + stop.deliveryFee, 0);
    const where = stops.map((stop) => stop.storeName).join(", ");
    for (const rider of onlineRiders.rows as Row[]) {
      notifyUser(rider.id as string, {
        title: stops.length > 1 ? `New delivery: ${stops.length} pickups` : `New delivery order: ${where}`,
        body: `Pickup at ${where} · Delivery fee: UGX ${deliveryFee.toLocaleString()}`,
        url: "/riders",
        tag: `order-${ids[0]}`,
      }).catch(() => {});
    }
  } catch {
    // Ignore notification broadcast failures
  }

  return c.json({ ok: true, orders, order: orders[0] }, 201);
});

const quoteSchema = marketplaceCheckoutSchema.pick({ items: true, destinationLat: true, destinationLng: true, relayLastMile: true });

/** The exact delivery fee a bag will be charged, split by store. Checkout shows this, never an estimate. */
marketplaceRoutes.post("/marketplace/checkout/quote", requireAuth, async (c) => {
  const parsed = quoteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const stops = await planMarketplaceDelivery(parsed.data.items, parsed.data, await getPlatformEnvironment());
  const relayed = stops.find((stop) => stop.relay)?.relay;
  const itemsTotal = stops.reduce((sum, stop) => sum + stop.itemsTotal, 0);
  const deliveryFee = stops.reduce((sum, stop) => sum + stop.deliveryFee, 0);
  return c.json({
    itemsTotal,
    deliveryFee,
    total: itemsTotal + deliveryFee,
    stores: stops.map((stop) => ({ storeId: stop.storeId, storeName: stop.storeName, itemsTotal: stop.itemsTotal, deliveryFee: stop.deliveryFee })),
    // A long delivery from one store goes by matatu; the customer sees each leg.
    relay: relayed
      ? {
          routeName: relayed.plan.routeName,
          dropMode: relayed.plan.dropMode,
          station: relayed.plan.station?.name ?? null,
          lastMile: relayed.lastMile,
          doorTotal: relayed.plan.total,
          collectTotal: relayed.plan.collectTotal ?? null,
          choiceAtOrder: relayed.plan.dropMode === "station" && relayed.lastMile !== "pending",
          legs: relayed.plan.legs.map((leg) => ({ leg: leg.leg, kind: leg.kind, fromName: leg.fromName, toName: leg.toName, fee: leg.fee })),
        }
      : null,
  });
});

type CheckoutItem = z.infer<typeof checkoutItemSchema>;
type DeliveryStop = {
  storeId: string; storeName: string; storeAddress: string | null; lat: number | null; lng: number | null;
  items: CheckoutItem[]; itemsTotal: number; distanceKm: number | null; deliveryFee: number;
  relay?: { plan: RelayPlan; lastMile: RelayLastMile };
};

/**
 * Groups a bag by store and prices the delivery as one rider trip: store 1,
 * then store 2, ... then the customer, at the admin's rate per km. Each stop
 * carries the extra the route costs because of it, so the stops add up
 * exactly to the whole trip's fee.
 */
async function planMarketplaceDelivery(
  items: CheckoutItem[],
  destination: { destinationLat?: number; destinationLng?: number; relayLastMile?: "door" | "collect" },
  environment: Awaited<ReturnType<typeof getPlatformEnvironment>>,
): Promise<DeliveryStop[]> {
  const settings = await getDeliverySettings();
  const byStore = new Map<string, CheckoutItem[]>();
  for (const it of items) byStore.set(it.storeId, [...(byStore.get(it.storeId) ?? []), it]);

  const stops: DeliveryStop[] = [];
  for (const [storeId, storeItems] of byStore.entries()) {
    await ensureDemoStoreInDb(storeId, environment);
    let storeName = "Marketplace Store";
    let storeAddress: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    if (await hasTable("stores")) {
      const row = (await db.execute({ sql: "SELECT name, address, lat, lng FROM stores WHERE id = ?", args: [storeId] })).rows[0] as Row | undefined;
      if (row) {
        storeName = String(row.name ?? storeName);
        storeAddress = (row.address as string | null) ?? null;
        lat = (row.lat as number | null) ?? null;
        lng = (row.lng as number | null) ?? null;
      }
    }
    if (storeName === "Marketplace Store") {
      const demo = DEMO_MARKETPLACE_STORES.find((store) => store.id === storeId);
      if (demo) {
        storeName = demo.name;
        storeAddress = demo.address;
        lat = demo.lat ?? null;
        lng = demo.lng ?? null;
      }
    }
    stops.push({
      storeId, storeName, storeAddress, lat, lng, items: storeItems,
      itemsTotal: storeItems.reduce((sum, it) => sum + it.price * it.quantity, 0),
      distanceKm: null, deliveryFee: 0,
    });
  }

  const { destinationLat, destinationLng } = destination;
  const located = destinationLat != null && destinationLng != null && stops.every((stop) => stop.lat != null && stop.lng != null);
  if (!located) {
    // Without coordinates there's no route: the admin's flat shopping fee, once for the whole bag.
    stops.forEach((stop, i) => { stop.deliveryFee = i === 0 ? roundFare(settings.shoppingDeliveryFee) : 0; });
    return stops;
  }

  // One store far from the customer: relayed by matatu, each leg at its own rate.
  if (stops.length === 1) {
    const stop = stops[0];
    const plan = await planRelay(
      { lat: stop.lat!, lng: stop.lng!, name: stop.storeName },
      { lat: destinationLat!, lng: destinationLng!, name: "Your door" },
    );
    if (plan) {
      const lastMile = await initialLastMile(plan, destination.relayLastMile);
      stop.relay = { plan, lastMile };
      stop.deliveryFee = relayChargeFor(plan, lastMile);
      stop.distanceKm = Math.round(haversineKm(stop.lat!, stop.lng!, destinationLat!, destinationLng!) * 10) / 10;
      return stops;
    }
  }

  let travelled = 0;
  let charged = 0;
  stops.forEach((stop, i) => {
    if (i > 0) travelled += haversineKm(stops[i - 1].lat!, stops[i - 1].lng!, stop.lat!, stop.lng!);
    const lastMile = haversineKm(stop.lat!, stop.lng!, destinationLat!, destinationLng!);
    stop.distanceKm = Math.round(lastMile * 10) / 10;
    const routeFee = roundFare((travelled + lastMile) * settings.deliveryRatePerKm, settings.minimumDeliveryFee);
    stop.deliveryFee = Math.max(0, routeFee - charged);
    charged += stop.deliveryFee;
  });
  return stops;
}
