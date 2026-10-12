"use client";

import { Select } from "@peebee/shared/select";
import type { MarketplaceSettings } from "@peebee/shared";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronRight,
  Flame,
  Globe,
  Heart,
  Layers,
  Megaphone,
  Package,
  PackagePlus,
  Play,
  Plus,
  Radio,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Trash2,
  TrendingUp,
  Tv,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface ProStore {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  category: "groceries" | "stores";
  sub_category?: string;
  description: string | null;
  announcement?: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  min_order_amount?: number;
  pro_tier?: string;
  is_live?: number;
  live_channel_title?: string | null;
  live_stream_url?: string | null;
  live_viewer_count?: number;
  status: "active" | "inactive";
  created_at: string;
}

interface ProductVariant {
  title: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  inventory_quantity?: number;
}

interface StoreProduct {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  inventory_quantity: number;
  category_name?: string | null;
  badge?: string | null;
  image_url: string | null;
  video_url: string | null;
  has_variants?: number | boolean;
  variants?: ProductVariant[];
  status: string;
}

interface LiveChat {
  id: string;
  user_name: string;
  message: string;
  is_merchant_pinned: boolean;
  created_at: string;
}

interface AdCampaign {
  id: string;
  platform: "whatsapp" | "meta" | "tiktok";
  headline: string;
  daily_budget_ugx: number;
  duration_days: number;
  status: string;
  impressions: number;
  clicks: number;
  created_at: string;
}

const ugx = (val: number) => `UGX ${Number(val).toLocaleString()}`;

export default function MerchantProStorePage() {
  const { merchant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<ProStore | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "live" | "ads" | "settings">("catalog");

  // Onboarding wizard state (if no store yet)
  const [wizardName, setWizardName] = useState("");
  const [wizardCategory, setWizardCategory] = useState<"groceries" | "stores">("groceries");
  const [wizardDesc, setWizardDesc] = useState("");
  const [wizardCreating, setWizardCreating] = useState(false);

  // New product modal state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productTitle, setProductTitle] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productComparePrice, setProductComparePrice] = useState("");
  const [productStock, setProductStock] = useState("50");
  const [productCategory, setProductCategory] = useState("General");
  const [productBadge, setProductBadge] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [newVariantTitle, setNewVariantTitle] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Live broadcast studio state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [showLiveStudio, setShowLiveStudio] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveStreamUrl, setLiveStreamUrl] = useState("");
  const [pinnedProductId, setPinnedProductId] = useState<string>("");
  const [chats, setChats] = useState<LiveChat[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [liveHearts, setLiveHearts] = useState<number[]>([]);
  const [startingLive, setStartingLive] = useState(false);

  // Social ads state
  const [adPlatform, setAdPlatform] = useState<"whatsapp" | "meta" | "tiktok">("whatsapp");
  const [adHeadline, setAdHeadline] = useState("");
  const [adBudget, setAdBudget] = useState("15000");
  const [adDuration, setAdDuration] = useState("7");
  const [adTargetProduct, setAdTargetProduct] = useState("");
  const [launchingAd, setLaunchingAd] = useState(false);
  const [adCampaigns, setAdCampaigns] = useState<AdCampaign[]>([]);

  useEffect(() => {
    loadData();
  }, [merchant]);

  async function loadData() {
    if (!merchant) return;
    setLoading(true);
    setError("");
    try {
      const storeRes = await api.getMerchantProStore().catch(() => ({ store: null, settings: undefined }));

      if (storeRes && "settings" in storeRes && storeRes.settings) {
        setSettings(storeRes.settings);
      }

      if (storeRes?.store) {
        setStore(storeRes.store);
        setIsLiveActive(Boolean(storeRes.store.is_live));
        if (storeRes.store.live_channel_title) {
          setLiveTitle(storeRes.store.live_channel_title);
        }
        if (storeRes.store.live_stream_url) {
          setLiveStreamUrl(storeRes.store.live_stream_url);
        }

        const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
        setProducts(prodRes.products || []);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStore() {
    if (!wizardName.trim()) {
      setError("Please provide a store name.");
      return;
    }
    setWizardCreating(true);
    setError("");
    try {
      const res = await api.createMerchantProStore({
        name: wizardName.trim(),
        category: wizardCategory,
        description: wizardDesc.trim() || undefined,
        min_order_amount: 5000,
      });
      setStore(res.store);
      setNotice("🎉 Store created successfully! Let's populate your catalog.");
      const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
      setProducts(prodRes.products || []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWizardCreating(false);
    }
  }

  async function handleLoadStarterPack() {
    if (!store) return;
    setError("");
    setNotice("Loading starter pack items…");
    try {
      const res = await api.triggerMerchantProStarterPack();
      const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
      setProducts(prodRes.products || []);
      setNotice(`✅ Loaded ${res.addedCount} starter pack items! Your store is now ready for customers.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleAddVariant() {
    if (!newVariantTitle.trim() || !newVariantPrice) return;
    setProductVariants((prev) => [
      ...prev,
      {
        title: newVariantTitle.trim(),
        price: Number(newVariantPrice),
        inventory_quantity: 50,
      },
    ]);
    setNewVariantTitle("");
    setNewVariantPrice("");
  }

  function handleRemoveVariant(idx: number) {
    setProductVariants((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveProduct() {
    if (!store || !productTitle.trim() || !productPrice) {
      setError("Please enter product title and price.");
      return;
    }
    setSavingProduct(true);
    setError("");
    try {
      await api.createMerchantProProduct({
        title: productTitle.trim(),
        description: productDesc.trim() || undefined,
        price: Number(productPrice),
        compare_at_price: productComparePrice ? Number(productComparePrice) : undefined,
        inventory_quantity: Number(productStock) || 50,
        category_name: productCategory.trim() || "General",
        badge: productBadge.trim() || undefined,
        image_url: productImage.trim() || undefined,
        has_variants: productVariants.length > 0,
        variants: productVariants.length ? productVariants : undefined,
      });

      const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
      setProducts(prodRes.products || []);
      setShowAddProduct(false);
      resetProductForm();
      setNotice(`✅ "${productTitle.trim()}" added to your catalog!`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingProduct(false);
    }
  }

  function resetProductForm() {
    setProductTitle("");
    setProductDesc("");
    setProductPrice("");
    setProductComparePrice("");
    setProductStock("50");
    setProductCategory("General");
    setProductBadge("");
    setProductImage("");
    setProductVariants([]);
    setNewVariantTitle("");
    setNewVariantPrice("");
  }

  async function handleStartLiveSession() {
    if (!store || !liveTitle.trim()) {
      setError("Please give your live stream a title.");
      return;
    }
    setStartingLive(true);
    setError("");
    try {
      await api.startMerchantProLive({
        title: liveTitle.trim(),
        streamUrl: liveStreamUrl.trim() || undefined,
      });
      setIsLiveActive(true);
      setShowLiveStudio(true);
      setNotice("🔴 You are now LIVE! Shoppers are receiving live stream notifications.");
      // Seed welcome chat
      setChats([
        {
          id: "welcome-1",
          user_name: "Peebee Live Bot",
          message: "Broadcast connected! Shoppers can tap the pinned product to checkout instantly.",
          is_merchant_pinned: true,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStartingLive(false);
    }
  }

  async function handleEndLiveSession() {
    try {
      await api.endMerchantProLive();
      setIsLiveActive(false);
      setShowLiveStudio(false);
      setNotice("Live session ended and saved for replay.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleSendMerchantChat() {
    if (!newChatMessage.trim()) return;
    const msg: LiveChat = {
      id: `chat-${Date.now()}`,
      user_name: `${store?.name || "Merchant"} (Host)`,
      message: newChatMessage.trim(),
      is_merchant_pinned: true,
      created_at: new Date().toISOString(),
    };
    setChats((prev) => [...prev, msg]);
    setNewChatMessage("");
  }

  function triggerReaction() {
    setLiveHearts((prev) => [...prev, Date.now()]);
    setTimeout(() => {
      setLiveHearts((prev) => prev.slice(1));
    }, 1500);
  }

  async function handleLaunchAd() {
    if (!store || !adHeadline.trim()) {
      setError("Please provide an ad headline.");
      return;
    }
    setLaunchingAd(true);
    setError("");
    try {
      const campaign: AdCampaign = {
        id: `ad-${Date.now()}`,
        platform: adPlatform,
        headline: adHeadline.trim(),
        daily_budget_ugx: Number(adBudget),
        duration_days: Number(adDuration),
        status: "active",
        impressions: 120,
        clicks: 8,
        created_at: new Date().toISOString(),
      };
      setAdCampaigns((prev) => [campaign, ...prev]);
      setNotice(`🚀 ${adPlatform.toUpperCase()} campaign funded and queued for automated launch!`);
      setAdHeadline("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLaunchingAd(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-gold border-t-transparent" />
          <p className="text-sm font-semibold text-ink-500">Loading your Pro Store Studio…</p>
        </div>
      </div>
    );
  }

  const isProFree = settings?.proPricingMode !== "paid";
  const proStorePrice = settings?.proStorePriceUgx ?? 35000;

  // 1. Initial State: No store created yet -> Chap Chap 2-Minute Onboarding Wizard
  if (!store) {
    return (
      <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-[28px] border border-gold/30 bg-gradient-to-br from-black-900 via-neutral-900 to-black-900 p-6 text-white shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/20 text-gold">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span className="text-xs font-bold tracking-wider text-gold uppercase">Peebee Pro Engine</span>
          </div>

          <h1 className="mt-3 font-serif text-2xl font-black text-white sm:text-3xl">
            Power of Shopify. Simplicity of Snake Game.
          </h1>
          <p className="mt-2 text-sm text-neutral-300">
            Launch your full online supermarket or boutique store in under 2 minutes. Tap below to start "Chap Chap".
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-400">
            <span className="rounded-full bg-white/10 px-3 py-1">⚡ 1-Click Starter Packs</span>
            <span className="rounded-full bg-white/10 px-3 py-1">🔴 TikTok Live Selling</span>
            <span className="rounded-full bg-white/10 px-3 py-1">📢 WhatsApp & Meta Ads</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-500/10 p-3.5 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Wizard Form */}
        <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-ink">Step 1 of 2: Store Identity</h2>

          <div>
            <label className="text-xs font-semibold text-ink-500">Store Name</label>
            <input
              type="text"
              value={wizardName}
              onChange={(e) => setWizardName(e.target.value)}
              placeholder="e.g. Fresh Bites Groceries or Chic Kampala Boutique"
              className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500">Category</label>
            <Select
              aria-label="Category"
              value={wizardCategory}
              onValueChange={(val) => setWizardCategory(val as "groceries" | "stores")}
              className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink focus:border-gold"
            >
              <option value="groceries">🥦 Groceries & Fresh Produce</option>
              <option value="stores">👗 Stores, Boutique & Retail</option>
            </Select>
            <p className="mt-1 text-[11px] text-ink-500">
              * Note: Pharmacies are managed via specialized NDA medical verification.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500">Short Tagline (Optional)</label>
            <input
              type="text"
              value={wizardDesc}
              onChange={(e) => setWizardDesc(e.target.value)}
              placeholder="e.g. Farm fresh fruits and vegetables delivered in 25 mins"
              className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
            />
          </div>

          <button
            onClick={handleCreateStore}
            disabled={wizardCreating || !wizardName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-sm font-bold text-ink-gold shadow-md transition active:scale-98 disabled:opacity-50"
          >
            {wizardCreating ? "Creating Store…" : "Launch Store (Chap Chap) →"}
          </button>
        </div>
      </div>
    );
  }

  // 2. Active Pro Store Dashboard
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-4">
      {/* Top Banner / Store Header */}
      <div className="relative overflow-hidden rounded-[26px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold font-bold text-xl">
              {store.category === "groceries" ? "🥦" : "🛍️"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-xl font-black text-ink">{store.name}</h1>
                <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                  {store.status === "active" ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <p className="text-xs text-ink-500 font-medium">
                peebee.online/{store.category}/{store.slug}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowLiveStudio(true)}
            className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-red-700 active:scale-95"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Go Live</span>
          </button>
        </div>

        {/* Snake-Game 4-Step Interactive Progression Bar */}
        <div className="mt-5 rounded-2xl bg-[rgb(var(--surface-muted))] p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gold" />
              <span>Launch Readiness (Snake Progress)</span>
            </span>
            <span className="font-mono font-bold text-gold">
              {products.length > 0 ? "100% Launch Ready" : "50% Step 2 Next"}
            </span>
          </div>

          {/* Snake track */}
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            <div className="h-2 rounded-full bg-gold transition-all" title="Step 1: Identity" />
            <div
              className={`h-2 rounded-full transition-all ${products.length > 0 ? "bg-gold" : "bg-gold/40 animate-pulse"}`}
              title="Step 2: Catalog"
            />
            <div
              className={`h-2 rounded-full transition-all ${products.length > 0 ? "bg-gold" : "bg-neutral-300 dark:bg-neutral-700"}`}
              title="Step 3: Delivery Rules"
            />
            <div
              className={`h-2 rounded-full transition-all ${isLiveActive ? "bg-red-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
              title="Step 4: Go Live"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-ink-500">
            <span className="text-gold">1. Identity</span>
            <span className={products.length > 0 ? "text-gold" : "text-ink"}>2. Products ({products.length})</span>
            <span>3. Delivery</span>
            <span>4. Live Sell</span>
          </div>
        </div>

        {/* Pricing / Paywall Badge */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-gold/10 px-3 py-2 text-xs font-semibold text-ink-gold">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span>
              {isProFree
                ? "✨ Platform Launch Promo: All Pro Store & Live features unlocked (Free)"
                : `Pro Subscription Active · ${ugx(proStorePrice)}/mo`}
            </span>
          </span>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-2xl bg-gold/15 p-3.5 text-sm font-semibold text-ink">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} className="text-ink-500 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl bg-red-500/10 p-3.5 text-sm font-semibold text-red-600 dark:text-red-400">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1.5 rounded-2xl bg-[rgb(var(--surface-muted))] p-1">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === "catalog"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Products ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === "live"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Tv className="h-3.5 w-3.5 text-red-500" />
          <span>TikTok Live</span>
        </button>

        <button
          onClick={() => setActiveTab("ads")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === "ads"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Megaphone className="h-3.5 w-3.5 text-gold" />
          <span>1-Click Ads</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === "settings"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <StoreIcon className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Quick Action Bar */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-xs font-bold text-ink-gold shadow transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>

            {products.length === 0 && (
              <button
                onClick={handleLoadStarterPack}
                className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs font-bold text-gold transition hover:bg-gold/20 active:scale-95"
              >
                <Zap className="h-4 w-4" />
                <span>1-Click Starter Pack</span>
              </button>
            )}
          </div>

          {/* Product List */}
          {products.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-8 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 text-gold text-2xl">
                📦
              </div>
              <h3 className="text-base font-bold text-ink">Your Catalog is Empty</h3>
              <p className="text-xs text-ink-500 max-w-sm mx-auto">
                Add your first product or tap "1-Click Starter Pack" to instantly populate 6 bestselling{" "}
                {store.category === "groceries" ? "produce items" : "store products"}.
              </p>
              <button
                onClick={handleLoadStarterPack}
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-xs font-bold text-ink-gold shadow transition active:scale-95"
              >
                <Zap className="h-4 w-4" />
                <span>Load Starter Pack (Chap Chap)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {products.map((p) => {
                const variants = p.variants || [];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-[22px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-3.5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            className="h-full w-full object-cover transition duration-300 hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-3xl">🛍️</div>
                        )}
                        {p.badge ? (
                          <span className="absolute top-2 left-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-black text-ink-gold uppercase">
                            {p.badge}
                          </span>
                        ) : null}
                        {p.compare_at_price && p.compare_at_price > p.price && (
                          <span className="absolute top-2 right-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white">
                            Sale
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <h4 className="font-bold text-sm text-ink leading-snug line-clamp-1">{p.title}</h4>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-ink-500 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[var(--border-faint)] pt-2.5 flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono font-black text-sm text-ink">{ugx(p.price)}</span>
                          {p.compare_at_price && (
                            <span className="font-mono text-[10px] text-ink-500 line-through">
                              {ugx(p.compare_at_price)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-ink-500 font-medium">
                          {p.inventory_quantity} in stock {variants.length > 0 && `· ${variants.length} variants`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setPinnedProductId(p.id);
                            setNotice(`📌 Pinned "${p.title}" for your live stream!`);
                          }}
                          title="Pin in Live Stream"
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 ${
                            pinnedProductId === p.id
                              ? "bg-gold text-ink font-bold"
                              : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-gold"
                          }`}
                        >
                          <Flame className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TIKTOK LIVE SELLING STUDIO */}
      {activeTab === "live" && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-red-500/20 bg-gradient-to-br from-red-950/20 via-neutral-900 to-black-900 p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  TikTok Live Commerce Hub
                </span>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-neutral-300">
                HD Video & Instant Checkout
              </span>
            </div>

            <h3 className="font-serif text-xl font-black text-white">
              Sell Products Live on Camera
            </h3>
            <p className="text-xs text-neutral-300">
              Go live directly to Peebee shoppers. Pin featured products so viewers can buy with 1 tap without leaving
              the video! Replay videos are automatically saved.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setShowLiveStudio(true)}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-red-700 active:scale-95"
              >
                <Radio className="h-4 w-4" />
                <span>Open Live Studio</span>
              </button>
            </div>
          </div>

          {/* Live Studio Modal / Drawer */}
          {showLiveStudio && (
            <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <h3 className="font-bold text-base text-ink">Broadcast Studio</h3>
                </div>
                <button
                  onClick={() => setShowLiveStudio(false)}
                  className="rounded-full p-1.5 text-ink-500 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!isLiveActive ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Stream Title</label>
                    <input
                      type="text"
                      value={liveTitle}
                      onChange={(e) => setLiveTitle(e.target.value)}
                      placeholder="e.g. Flash Sale! 30% Off Fresh Fruit & Organic Veg"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">
                      Replay / Restream Video URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={liveStreamUrl}
                      onChange={(e) => setLiveStreamUrl(e.target.value)}
                      placeholder="https://commondatastorage.googleapis.com/... or Leave blank for Camera"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-ink-500">
                      Supports direct camera streaming or pre-recorded MP4 restreaming as live.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">Pin Starting Product</label>
                    <Select
                      aria-label="Pin Starting Product"
                      value={pinnedProductId}
                      onValueChange={(val) => setPinnedProductId(val)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink focus:border-gold"
                    >
                      <option value="">No product pinned</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {ugx(p.price)}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <button
                    onClick={handleStartLiveSession}
                    disabled={startingLive || !liveTitle.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 active:scale-98 disabled:opacity-50"
                  >
                    {startingLive ? "Connecting Broadcast…" : "🔴 Start Live Stream Now"}
                  </button>
                </div>
              ) : (
                /* Interactive Live Studio Player Simulator */
                <div className="space-y-3">
                  <div className="relative aspect-[9/16] w-full max-w-sm mx-auto overflow-hidden rounded-[24px] bg-black shadow-2xl">
                    {/* Simulated video or video tag */}
                    {liveStreamUrl ? (
                      <video
                        src={liveStreamUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-black text-white p-6 text-center">
                        <Camera className="h-12 w-12 text-gold animate-bounce mb-3" />
                        <h4 className="font-bold text-lg">Camera Live Feed</h4>
                        <p className="text-xs text-neutral-400 mt-1">
                          You are broadcasting to shoppers across Kampala.
                        </p>
                      </div>
                    )}

                    {/* Overlay: Live Badge & Audience */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wider">
                        <Radio className="h-3 w-3" /> LIVE
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        <Users className="h-3 w-3 text-gold" /> 148 watching
                      </span>
                    </div>

                    {/* Overlay: End button */}
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={handleEndLiveSession}
                        className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-red-400 backdrop-blur-md hover:bg-red-600 hover:text-white transition"
                      >
                        End
                      </button>
                    </div>

                    {/* Pinned Product Card on Video Screen */}
                    {pinnedProductId && (
                      <div className="absolute bottom-20 inset-x-3 rounded-2xl bg-black/75 p-2.5 backdrop-blur-md border border-gold/40 flex items-center justify-between gap-3 text-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold text-ink font-bold text-xs">
                            🏷️
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {products.find((p) => p.id === pinnedProductId)?.title || "Featured Item"}
                            </p>
                            <p className="text-[11px] font-mono text-gold font-bold">
                              {ugx(products.find((p) => p.id === pinnedProductId)?.price || 0)}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-full bg-gold px-3 py-1 text-[10px] font-black text-ink">
                          PINNED
                        </span>
                      </div>
                    )}

                    {/* Chat Stream overlay */}
                    <div className="absolute bottom-4 inset-x-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={newChatMessage}
                        onChange={(e) => setNewChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMerchantChat()}
                        placeholder="Say something to viewers…"
                        className="flex-1 rounded-full bg-black/60 px-3.5 py-2 text-xs text-white placeholder:text-neutral-400 backdrop-blur-md border border-white/20 focus:outline-none"
                      />
                      <button
                        onClick={handleSendMerchantChat}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={triggerReaction}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white"
                      >
                        <Heart className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Floating Hearts Reaction Animation */}
                    {liveHearts.map((id) => (
                      <div
                        key={id}
                        className="absolute bottom-16 right-6 text-red-500 animate-bounce text-2xl transition duration-1000"
                      >
                        ❤️
                      </div>
                    ))}
                  </div>

                  {/* Pin different product controls */}
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-ink-500">Switch Pinned Product Live:</label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPinnedProductId(p.id);
                            setNotice(`📌 Pinned "${p.title}" on live stream!`);
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                            pinnedProductId === p.id
                              ? "bg-gold text-ink-gold"
                              : "bg-[rgb(var(--surface-muted))] text-ink-500 hover:text-ink"
                          }`}
                        >
                          {p.title} ({ugx(p.price)})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 1-CLICK SOCIAL ADS (WhatsApp, Meta, TikTok) */}
      {activeTab === "ads" && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-gold/30 bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Megaphone className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold text-base text-ink">1-Click Social Ads Launcher</h3>
                <p className="text-xs text-ink-500">
                  Target shoppers on WhatsApp, Instagram & TikTok with direct Click-to-Chat & Buy.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-ink-500">Target Social Channel</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAdPlatform("whatsapp")}
                    className={`rounded-2xl border p-3 text-center transition ${
                      adPlatform === "whatsapp"
                        ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-bold"
                        : "border-[var(--border-faint)] text-ink-500"
                    }`}
                  >
                    <span className="block text-lg">💬</span>
                    <span className="text-xs">WhatsApp</span>
                  </button>

                  <button
                    onClick={() => setAdPlatform("meta")}
                    className={`rounded-2xl border p-3 text-center transition ${
                      adPlatform === "meta"
                        ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold"
                        : "border-[var(--border-faint)] text-ink-500"
                    }`}
                  >
                    <span className="block text-lg">📸</span>
                    <span className="text-xs">Instagram</span>
                  </button>

                  <button
                    onClick={() => setAdPlatform("tiktok")}
                    className={`rounded-2xl border p-3 text-center transition ${
                      adPlatform === "tiktok"
                        ? "border-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-300 font-bold"
                        : "border-[var(--border-faint)] text-ink-500"
                    }`}
                  >
                    <span className="block text-lg">🎵</span>
                    <span className="text-xs">TikTok</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500">Ad Headline / Offer</label>
                <input
                  type="text"
                  value={adHeadline}
                  onChange={(e) => setAdHeadline(e.target.value)}
                  placeholder="e.g. Fresh Mangoes & Avocados delivered in 25 mins · Tap to chat on WhatsApp"
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500">Daily Budget (UGX)</label>
                  <input
                    type="number"
                    value={adBudget}
                    onChange={(e) => setAdBudget(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Duration (Days)</label>
                  <Select
                    aria-label="Duration"
                    value={adDuration}
                    onValueChange={(val) => setAdDuration(val)}
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink focus:border-gold"
                  >
                    <option value="3">3 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500">Promote Specific Product</label>
                <Select
                  aria-label="Promote Product"
                  value={adTargetProduct}
                  onValueChange={(val) => setAdTargetProduct(val)}
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-3 text-sm text-ink focus:border-gold"
                >
                  <option value="">Storewide Brand Promotion</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({ugx(p.price)})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Estimate box */}
              <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-500">Total Campaign Spend:</span>
                  <span className="font-bold font-mono text-ink">
                    {ugx(Number(adBudget) * Number(adDuration))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Estimated Reach:</span>
                  <span className="font-bold text-gold">14,000 - 35,000 Local Shoppers</span>
                </div>
              </div>

              <button
                onClick={handleLaunchAd}
                disabled={launchingAd || !adHeadline.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 text-sm font-bold text-ink-gold shadow-md transition active:scale-98 disabled:opacity-50"
              >
                {launchingAd ? "Submitting Campaign…" : "Fund & Launch Ad Campaign →"}
              </button>
            </div>
          </div>

          {/* Active Campaigns list */}
          {adCampaigns.length > 0 && (
            <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
              <h4 className="font-bold text-sm text-ink">Active Social Campaigns</h4>
              {adCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-ink uppercase">{c.platform}</span> · {c.headline}
                    <p className="text-[10px] text-ink-500">
                      {c.duration_days} days · {ugx(c.daily_budget_ugx)}/day
                    </p>
                  </div>
                  <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-bold text-green-600">
                    RUNNING
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STORE SETTINGS */}
      {activeTab === "settings" && (
        <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-ink">Store Profile & Delivery Rules</h3>

          <div>
            <label className="text-xs font-semibold text-ink-500">Store Name</label>
            <input
              type="text"
              value={store.name}
              disabled
              className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-3 text-sm text-ink font-bold opacity-75"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-500">Minimum Order (UGX)</label>
            <input
              type="number"
              value={store.min_order_amount ?? 5000}
              disabled
              className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-3 text-sm text-ink font-mono opacity-75"
            />
          </div>

          <div className="pt-2 border-t border-[var(--border-faint)]">
            <p className="text-xs text-ink-500">
              Customer Storefront URL:{" "}
              <Link
                href={`/store/${store.id}`}
                target="_blank"
                className="font-bold text-gold underline underline-offset-2"
              >
                preview.peebee.online/{store.category}/{store.slug}
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-[28px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-3">
              <h3 className="font-bold text-lg text-ink">Add New Product</h3>
              <button
                onClick={() => setShowAddProduct(false)}
                className="rounded-full p-1.5 text-ink-500 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-ink-500">Product Title</label>
                <input
                  type="text"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="e.g. Fresh Hass Avocados (1kg pack)"
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500">Short Description</label>
                <textarea
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  placeholder="e.g. Ripe, creamy Hass avocados sourced directly from Mbale orchards."
                  rows={2}
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-500/50 focus:border-gold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500">Selling Price (UGX)</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="8000"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Compare Price (Strike-through)</label>
                  <input
                    type="number"
                    value={productComparePrice}
                    onChange={(e) => setProductComparePrice(e.target.value)}
                    placeholder="10000"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500">Initial Stock</label>
                  <input
                    type="number"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Category Name</label>
                  <input
                    type="text"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    placeholder="e.g. Produce or Apparel"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500">Product Image URL</label>
                <input
                  type="text"
                  value={productImage}
                  onChange={(e) => setProductImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                />
              </div>

              {/* Variants Builder ("Shopify Power") */}
              <div className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">Product Variants (Size, Color, Weight)</label>
                  <span className="text-[10px] text-ink-500">{productVariants.length} configured</span>
                </div>

                {productVariants.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-[rgb(var(--surface-card))] p-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-ink">{v.title}</span> —{" "}
                      <span className="text-gold font-mono">{ugx(v.price)}</span>
                    </div>
                    <button onClick={() => handleRemoveVariant(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <input
                    type="text"
                    value={newVariantTitle}
                    onChange={(e) => setNewVariantTitle(e.target.value)}
                    placeholder="Variant (e.g. Small / 1kg)"
                    className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-2.5 py-1.5 text-xs text-ink"
                  />
                  <input
                    type="number"
                    value={newVariantPrice}
                    onChange={(e) => setNewVariantPrice(e.target.value)}
                    placeholder="Price (UGX)"
                    className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-2.5 py-1.5 text-xs text-ink"
                  />
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="rounded-xl bg-gold text-ink-gold text-xs font-bold py-1.5"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-500">Badge (Optional)</label>
                <input
                  type="text"
                  value={productBadge}
                  onChange={(e) => setProductBadge(e.target.value)}
                  placeholder="e.g. Fresh Daily, Best Seller, Organic"
                  className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveProduct}
                disabled={savingProduct || !productTitle.trim() || !productPrice}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3 text-sm font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
              >
                {savingProduct ? "Saving Product…" : "Save & Publish Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
