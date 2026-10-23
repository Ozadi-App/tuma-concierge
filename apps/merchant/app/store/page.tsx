"use client";

import { Select } from "@peebee/shared/select";
import type {
  MarketplaceSettings,
  StoreCollection,
  StoreDiscount,
  StoreDraftOrder,
  StoreEliteAnalytics,
  StoreOutletInventoryRow,
} from "@peebee/shared";
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building2,
  Camera,
  Check,
  ChevronRight,
  Crown,
  Eye,
  FileText,
  Flame,
  Gift,
  Globe,
  Heart,
  Layers,
  LayoutGrid,
  Megaphone,
  Package,
  Palette,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Trash2,
  TrendingUp,
  Tv,
  Users,
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
  elite_tier?: number;
  custom_domain?: string | null;
  theme_layout?: "grid" | "editorial" | "compact";
  theme_accent?: "gold" | "ink" | "cream";
  hero_headline?: string | null;
  hero_subheadline?: string | null;
  hero_cta_text?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  meta_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  loyalty_enabled?: number;
  loyalty_cashback_percent?: number;
  b2b_wholesale_enabled?: number;
  b2b_min_order_amount?: number;
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
  cost_price?: number | null;
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

const ugx = (val: number) => `UGX ${Number(val || 0).toLocaleString()}`;

export default function MerchantProStorePage() {
  const { merchant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<ProStore | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "live" | "ads" | "elite" | "settings">("catalog");

  // Elite OS sub-navigation
  const [eliteSection, setEliteSection] = useState<
    "overview" | "theme" | "collections" | "discounts" | "inventory" | "b2b"
  >("overview");
  const [upgradingTier, setUpgradingTier] = useState(false);

  // Elite data states
  const [analytics, setAnalytics] = useState<StoreEliteAnalytics | null>(null);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [discounts, setDiscounts] = useState<StoreDiscount[]>([]);
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string; code: string; address: string | null; status: string }>>([]);
  const [outletInventory, setOutletInventory] = useState<StoreOutletInventoryRow[]>([]);
  const [draftOrders, setDraftOrders] = useState<StoreDraftOrder[]>([]);

  // Elite Theme & Brand Builder state
  const [customDomain, setCustomDomain] = useState("");
  const [themeLayout, setThemeLayout] = useState<"grid" | "editorial" | "compact">("grid");
  const [themeAccent, setThemeAccent] = useState<"gold" | "ink" | "cream">("gold");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroCtaText, setHeroCtaText] = useState("Shop Now");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [tiktokPixelId, setTiktokPixelId] = useState("");
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyCashback, setLoyaltyCashback] = useState("5");
  const [savingTheme, setSavingTheme] = useState(false);

  // Elite Collections form state
  const [colTitle, setColTitle] = useState("");
  const [colKind, setColKind] = useState<"smart" | "manual">("smart");
  const [colRuleField, setColRuleField] = useState<"category" | "price_lte" | "price_gte" | "badge" | "in_stock">("price_lte");
  const [colRuleValue, setColRuleValue] = useState("50000");
  const [savingCol, setSavingCol] = useState(false);

  // Elite Discounts form state
  const [discCode, setDiscCode] = useState("");
  const [discTitle, setDiscTitle] = useState("");
  const [discKind, setDiscKind] = useState<"percent" | "fixed" | "free_delivery" | "bogo">("percent");
  const [discValue, setDiscValue] = useState("15");
  const [discMinOrder, setDiscMinOrder] = useState("20000");
  const [discAuto, setDiscAuto] = useState(false);
  const [savingDisc, setSavingDisc] = useState(false);

  // Elite Multi-Outlet Inventory form state
  const [selectedInvOutlet, setSelectedInvOutlet] = useState("");
  const [selectedInvProduct, setSelectedInvProduct] = useState("");
  const [invQuantity, setInvQuantity] = useState("25");
  const [savingInv, setSavingInv] = useState(false);

  // Elite B2B Draft Order form state
  const [b2bCustomerName, setB2bCustomerName] = useState("");
  const [b2bCompany, setB2bCompany] = useState("");
  const [b2bPhone, setB2bPhone] = useState("");
  const [b2bProductId, setB2bProductId] = useState("");
  const [b2bQty, setB2bQty] = useState("10");
  const [b2bUnitPrice, setB2bUnitPrice] = useState("");
  const [b2bDiscountUgx, setB2bDiscountUgx] = useState("0");
  const [b2bTerms, setB2bTerms] = useState<"immediate" | "net_7" | "net_14" | "net_30">("net_14");
  const [savingDraft, setSavingDraft] = useState(false);

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
  const [productCostPrice, setProductCostPrice] = useState("");
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

  // Storefront mobile preview state (Inspiration UI 3-screens)
  const [showStorefrontPreview, setShowStorefrontPreview] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<"storefront" | "product" | "cart">("storefront");
  const [previewSelectedSize, setPreviewSelectedSize] = useState("M");

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
        const s: ProStore = storeRes.store;
        setStore(s);
        setIsLiveActive(Boolean(s.is_live));
        if (s.live_channel_title) setLiveTitle(s.live_channel_title);
        if (s.live_stream_url) setLiveStreamUrl(s.live_stream_url);
        if (s.custom_domain) setCustomDomain(s.custom_domain);
        if (s.theme_layout) setThemeLayout(s.theme_layout);
        if (s.theme_accent) setThemeAccent(s.theme_accent);
        if (s.hero_headline) setHeroHeadline(s.hero_headline);
        if (s.hero_subheadline) setHeroSubheadline(s.hero_subheadline);
        if (s.hero_cta_text) setHeroCtaText(s.hero_cta_text);
        if (s.meta_pixel_id) setMetaPixelId(s.meta_pixel_id);
        if (s.tiktok_pixel_id) setTiktokPixelId(s.tiktok_pixel_id);
        setLoyaltyEnabled(Boolean(s.loyalty_enabled));
        if (s.loyalty_cashback_percent != null) setLoyaltyCashback(String(s.loyalty_cashback_percent));

        const [prodRes, colRes, discRes, invRes, drfRes, anaRes] = await Promise.all([
          api.getMerchantProProducts().catch(() => ({ products: [] })),
          api.getMerchantCollections().catch(() => ({ collections: [] })),
          api.getMerchantDiscounts().catch(() => ({ discounts: [] })),
          api.getMerchantOutletInventory().catch(() => ({ outlets: [], inventory: [] })),
          api.getMerchantDraftOrders().catch(() => ({ draftOrders: [] })),
          api.getMerchantEliteAnalytics().catch(() => ({ analytics: null })),
        ]);
        const loadedProducts = prodRes.products || [];
        setProducts(loadedProducts);
        setCollections(colRes.collections || []);
        setDiscounts(discRes.discounts || []);
        setOutlets(invRes.outlets || []);
        setOutletInventory(invRes.inventory || []);
        setDraftOrders(drfRes.draftOrders || []);
        if (anaRes.analytics) setAnalytics(anaRes.analytics);

        if (invRes.outlets?.[0] && !selectedInvOutlet) {
          setSelectedInvOutlet(invRes.outlets[0].id);
        }
        if (loadedProducts[0] && !selectedInvProduct) {
          setSelectedInvProduct(loadedProducts[0].id);
          setB2bProductId(loadedProducts[0].id);
          setB2bUnitPrice(String(Math.round(loadedProducts[0].price * 0.85)));
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshEliteData() {
    const [colRes, discRes, invRes, drfRes, anaRes] = await Promise.all([
      api.getMerchantCollections().catch(() => ({ collections: [] })),
      api.getMerchantDiscounts().catch(() => ({ discounts: [] })),
      api.getMerchantOutletInventory().catch(() => ({ outlets: [], inventory: [] })),
      api.getMerchantDraftOrders().catch(() => ({ draftOrders: [] })),
      api.getMerchantEliteAnalytics().catch(() => ({ analytics: null })),
    ]);
    setCollections(colRes.collections || []);
    setDiscounts(discRes.discounts || []);
    setOutlets(invRes.outlets || []);
    setOutletInventory(invRes.inventory || []);
    setDraftOrders(drfRes.draftOrders || []);
    if (anaRes.analytics) setAnalytics(anaRes.analytics);
  }

  async function handleUpgradeTier(tier: "pro_store" | "pro_live" | "elite") {
    if (!store) return;
    setUpgradingTier(true);
    setError("");
    try {
      const res = await api.upgradeMerchantStoreTier({ tier, billingCycle: "monthly" });
      setStore(res.store);
      if (tier === "elite") {
        setActiveTab("elite");
        setNotice("👑 Upgraded to Merchant Elite (Shopify Plus OS)! Custom themes, Smart Collections, B2B Wholesale & Multi-Outlet Inventory are now unlocked.");
      } else {
        setNotice(`✅ Switched to ${tier === "pro_live" ? "Merchant Marketplace (Pro Live)" : "Merchant Marketplace (Pro)"}!`);
      }
      await refreshEliteData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUpgradingTier(false);
    }
  }

  async function handleSaveTheme() {
    if (!store) return;
    setSavingTheme(true);
    setError("");
    try {
      const res = await api.updateMerchantProStore({
        custom_domain: customDomain.trim() || undefined,
        theme_layout: themeLayout,
        theme_accent: themeAccent,
        hero_headline: heroHeadline.trim() || undefined,
        hero_subheadline: heroSubheadline.trim() || undefined,
        hero_cta_text: heroCtaText.trim() || undefined,
        meta_pixel_id: metaPixelId.trim() || undefined,
        tiktok_pixel_id: tiktokPixelId.trim() || undefined,
        loyalty_enabled: loyaltyEnabled,
        loyalty_cashback_percent: Number(loyaltyCashback) || 0,
      });
      setStore(res.store);
      setNotice("🎨 Online Store 2.0 Theme, Custom Domain & VIP Loyalty settings saved!");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingTheme(false);
    }
  }

  async function handleCreateCollection() {
    if (!colTitle.trim()) {
      setError("Enter a collection title.");
      return;
    }
    setSavingCol(true);
    setError("");
    try {
      await api.createMerchantCollection({
        title: colTitle.trim(),
        kind: colKind,
        rule_field: colKind === "smart" ? colRuleField : null,
        rule_value: colKind === "smart" ? colRuleValue : null,
        pinned: true,
      });
      setColTitle("");
      await refreshEliteData();
      setNotice("📚 Smart Collection created and pinned to your storefront!");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingCol(false);
    }
  }

  async function handleDeleteCollection(id: string) {
    try {
      await api.deleteMerchantCollection(id);
      await refreshEliteData();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCreateDiscount() {
    if (!discCode.trim() || !discTitle.trim()) {
      setError("Enter a promo code and campaign title.");
      return;
    }
    setSavingDisc(true);
    setError("");
    try {
      await api.createMerchantDiscount({
        code: discCode.trim().toUpperCase(),
        title: discTitle.trim(),
        kind: discKind,
        value: discKind === "free_delivery" ? 0 : Number(discValue) || 10,
        min_order_amount: Number(discMinOrder) || 0,
        is_automatic: discAuto,
      });
      setDiscCode("");
      setDiscTitle("");
      await refreshEliteData();
      setNotice("🏷️ Promo code & discount rule activated!");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingDisc(false);
    }
  }

  async function handleDeleteDiscount(id: string) {
    try {
      await api.deleteMerchantDiscount(id);
      await refreshEliteData();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleSaveOutletInventory() {
    if (!selectedInvOutlet || !selectedInvProduct) {
      setError("Select both a branch outlet and a product.");
      return;
    }
    setSavingInv(true);
    setError("");
    try {
      const res = await api.updateMerchantOutletInventory({
        outletId: selectedInvOutlet,
        productId: selectedInvProduct,
        quantity: Number(invQuantity) || 0,
        lowStockThreshold: 5,
      });
      const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
      setProducts(prodRes.products || []);
      await refreshEliteData();
      setNotice(`📦 Branch inventory updated! Total synced product stock: ${res.totalQuantity} units.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingInv(false);
    }
  }

  async function handleCreateDraftOrder() {
    const prod = products.find((p) => p.id === b2bProductId) || products[0];
    if (!b2bCustomerName.trim() || !prod) {
      setError("Enter B2B buyer name and select a product.");
      return;
    }
    setSavingDraft(true);
    setError("");
    try {
      const unitPrice = Number(b2bUnitPrice) || prod.price;
      const qty = Math.max(1, Number(b2bQty) || 1);
      const res = await api.createMerchantDraftOrder({
        customer_name: b2bCustomerName.trim(),
        customer_company: b2bCompany.trim() || undefined,
        customer_phone: b2bPhone.trim() || undefined,
        items: [
          {
            productId: prod.id,
            title: prod.title,
            unitPrice,
            quantity: qty,
          },
        ],
        discount_amount: Number(b2bDiscountUgx) || 0,
        payment_terms: b2bTerms,
      });
      setB2bCustomerName("");
      setB2bCompany("");
      setB2bPhone("");
      await refreshEliteData();
      setNotice(`🤝 B2B Wholesale Invoice created (${ugx(res.total)}) — 1-Tap Payment Link ready to share!`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingDraft(false);
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
      await refreshEliteData();
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
        cost_price: productCostPrice ? Number(productCostPrice) : undefined,
        inventory_quantity: Number(productStock) || 50,
        category_name: productCategory.trim() || "General",
        badge: productBadge.trim() || undefined,
        image_url: productImage.trim() || undefined,
        has_variants: productVariants.length > 0,
        variants: productVariants.length ? productVariants : undefined,
      });

      const prodRes = await api.getMerchantProProducts().catch(() => ({ products: [] }));
      setProducts(prodRes.products || []);
      await refreshEliteData();
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
    setProductCostPrice("");
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
          <p className="text-sm font-semibold text-ink-500">Loading your Store Studio…</p>
        </div>
      </div>
    );
  }

  const isProFree = settings?.proPricingMode !== "paid";
  const proStorePrice = settings?.proStorePriceUgx ?? 35000;
  const elitePrice = settings?.elitePriceUgx ?? 150000;
  const isElite = Boolean(store?.elite_tier) || store?.pro_tier === "elite" || isProFree;

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
            <span className="text-xs font-bold tracking-wider text-gold uppercase">Peebee Commerce Ladder</span>
          </div>

          <h1 className="mt-3 font-serif text-2xl font-black text-white sm:text-3xl">
            Power of Shopify. Simplicity of Snake Game.
          </h1>
          <p className="mt-2 text-sm text-neutral-300">
            Upgrade from basic Merchant Code payments to a full Marketplace Store (Pro) or Shopify Plus Commerce OS (Elite).
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-400">
            <span className="rounded-full bg-white/10 px-3 py-1">1. Merchant Code (Free)</span>
            <span className="rounded-full bg-gold/20 text-gold px-3 py-1">2. Marketplace (Pro)</span>
            <span className="rounded-full bg-gold text-ink-gold font-bold px-3 py-1">3. Advanced OS (Elite)</span>
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

  // 2. Active Pro & Elite Store Dashboard
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-xl font-black text-ink">{store.name}</h1>
                <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                  {store.status === "active" ? "OPEN" : "CLOSED"}
                </span>
                {isElite && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-black text-ink-gold">
                    <Crown className="h-3 w-3" /> ELITE OS
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 font-medium">
                {store.custom_domain ? store.custom_domain : `peebee.online/${store.category}/${store.slug}`}
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

        {/* 3-Tier Merchant Upgrade Ladder (Free Code -> Pro Marketplace -> Elite Shopify Plus) */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link
            href="/outlets"
            className="rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-2.5 text-left transition hover:border-gold/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-ink-500">Tier 1 · Free</span>
              <Check className="h-3.5 w-3.5 text-green-600" />
            </div>
            <p className="mt-0.5 text-xs font-extrabold text-ink">Merchant Code</p>
            <p className="text-[10px] text-ink-500 truncate">QR & Rider Payments</p>
          </Link>

          <button
            type="button"
            disabled={upgradingTier}
            onClick={() => handleUpgradeTier("pro_live")}
            className={`rounded-2xl border p-2.5 text-left transition ${
              !isElite
                ? "border-gold bg-gold/15 text-ink"
                : "border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] text-ink"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-gold">Tier 2 · Pro</span>
              <Check className="h-3.5 w-3.5 text-gold" />
            </div>
            <p className="mt-0.5 text-xs font-extrabold text-ink">Marketplace</p>
            <p className="text-[10px] text-ink-500 truncate">
              {isProFree ? "Free Launch" : `${ugx(proStorePrice)}/mo`} · {settings?.commissionPercent ?? 10}% fee
            </p>
          </button>

          <button
            type="button"
            disabled={upgradingTier}
            onClick={() => {
              if (isElite) {
                setActiveTab("elite");
              } else {
                handleUpgradeTier("elite");
              }
            }}
            className={`rounded-2xl border p-2.5 text-left transition ${
              isElite
                ? "border-gold bg-gold text-ink-gold shadow-sm"
                : "border-gold/40 bg-gold/10 text-ink hover:bg-gold/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase flex items-center gap-1">
                <Crown className="h-3 w-3" /> Tier 3 · Elite
              </span>
              {isElite && <Check className="h-3.5 w-3.5" />}
            </div>
            <p className="mt-0.5 text-xs font-black">Advanced OS</p>
            <p className={`text-[10px] truncate ${isElite ? "text-ink-gold/80 font-semibold" : "text-ink-500"}`}>
              {isProFree ? "Unlocked" : `${ugx(elitePrice)}/mo`} · {settings?.eliteCommissionPercent ?? 5}% fee
            </p>
          </button>
        </div>

        {/* Dual-Channel Auto-Sync Status: Peebee Customer App vs Dedicated Storefront */}
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[var(--border-faint)] pt-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-2">
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-ink-500">
                Channel 1 · Peebee Customer App
              </span>
              <span className="block truncate font-mono text-xs font-bold text-ink">
                app.peebee.online/store/{store.slug}
              </span>
              <span className="block text-[10px] text-ink-500">
                Peebee UI &amp; branding · Auto-syncs catalog &amp; stock
              </span>
            </div>
            <a
              href={`https://app.peebee.online/store/${store.slug}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-[rgb(var(--surface-card))] px-2.5 py-1 text-[10px] font-bold text-ink border border-[var(--border-faint)]"
            >
              Open App ↗
            </a>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2">
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-gold">
                Channel 2 · Dedicated Storefront
              </span>
              <span className="block truncate font-mono text-xs font-black text-ink">
                {store.custom_domain || `${store.slug}.peebee.online`}
              </span>
              <span className="block text-[10px] text-ink-500">
                Custom Store 2.0 theme, branding, collections &amp; B2B
              </span>
            </div>
            <a
              href={`https://${store.custom_domain || `${store.slug}.peebee.online`}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-[10px] font-black text-ink-gold"
            >
              Visit Site ↗
            </a>
          </div>
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
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-[rgb(var(--surface-muted))] p-1">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "catalog"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("elite")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "elite"
              ? "bg-gold text-ink-gold shadow-sm"
              : "text-gold hover:bg-gold/10"
          }`}
        >
          <Crown className="h-3.5 w-3.5" />
          <span>Elite OS</span>
        </button>

        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "live"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Tv className="h-3.5 w-3.5 text-red-500" />
          <span>Live</span>
        </button>

        <button
          onClick={() => setActiveTab("ads")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ads"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <Megaphone className="h-3.5 w-3.5 text-gold" />
          <span>Ads</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-[rgb(var(--surface-card))] text-ink shadow-sm"
              : "text-ink-500 hover:text-ink"
          }`}
        >
          <StoreIcon className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* TAB: ELITE OS (Shopify & Shopify Plus Advanced Layer) */}
      {activeTab === "elite" && (
        <div className="space-y-4">
          {!isElite && (
            <div className="rounded-[24px] border border-gold bg-gradient-to-br from-black-900 via-neutral-900 to-black-900 p-5 text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-gold">
                  <Crown className="h-3.5 w-3.5" /> Tier 3 Upgrade · Shopify Plus Power
                </span>
                <span className="font-mono text-sm font-black text-gold">{ugx(elitePrice)}/mo</span>
              </div>
              <h3 className="font-serif text-xl font-black">Upgrade to Merchant Advanced Marketplace (Elite)</h3>
              <p className="text-xs text-neutral-300">
                Unlock lower platform commissions ({settings?.eliteCommissionPercent ?? 5}% instead of{" "}
                {settings?.commissionPercent ?? 10}%), up to {settings?.eliteMaxProducts ?? 5000} products, Online Store 2.0
                custom themes & domains, Smart Collections, Promo/BOGO codes, Multi-Outlet stock matrix, and B2B Wholesale
                Draft Orders.
              </p>
              <button
                type="button"
                disabled={upgradingTier}
                onClick={() => handleUpgradeTier("elite")}
                className="w-full rounded-full bg-gold py-3 text-xs font-black text-ink-gold shadow-md transition active:scale-98"
              >
                {upgradingTier ? "Activating Elite OS…" : `Upgrade to Merchant Elite (${ugx(elitePrice)}/mo) →`}
              </button>
            </div>
          )}

          {/* Elite Sub-Navigation Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "overview", label: "P&L Analytics", icon: BarChart3 },
              { id: "theme", label: "Store 2.0 Theme", icon: Palette },
              { id: "collections", label: `Collections (${collections.length})`, icon: Layers },
              { id: "discounts", label: `Promos (${discounts.length})`, icon: Tag },
              { id: "inventory", label: "Multi-Outlet Stock", icon: Building2 },
              { id: "b2b", label: `B2B Quotes (${draftOrders.length})`, icon: Briefcase },
            ].map((item) => {
              const Icon = item.icon;
              const active = eliteSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEliteSection(item.id as typeof eliteSection)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                    active
                      ? "bg-gold text-ink-gold shadow-xs"
                      : "bg-[rgb(var(--surface-card))] border border-[var(--border-faint)] text-ink-500 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* ELITE SECTION 1: EXECUTIVE P&L & MARGIN ANALYTICS */}
          {eliteSection === "overview" && (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-ink flex items-center gap-2">
                      <BarChart3 className="h-4.5 w-4.5 text-gold" />
                      <span>Executive Profit & Margin OS</span>
                    </h3>
                    <p className="text-xs text-ink-500">
                      Real-time net margin after Cost of Goods Sold (COGS) and {settings?.eliteCommissionPercent ?? 5}% Elite fee
                    </p>
                  </div>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-black text-gold">
                    {analytics?.netMarginPercent ?? 28}% Net Margin
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                    <span className="text-[10px] font-bold uppercase text-ink-500">Gross Merchandise</span>
                    <p className="mt-1 font-mono text-sm font-black text-ink">{ugx(analytics?.grossRevenueUgx ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                    <span className="text-[10px] font-bold uppercase text-ink-500">Est. COGS</span>
                    <p className="mt-1 font-mono text-sm font-bold text-ink-500">{ugx(analytics?.estimatedCogsUgx ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3">
                    <span className="text-[10px] font-bold uppercase text-ink-500">Take-Rate Fee</span>
                    <p className="mt-1 font-mono text-sm font-bold text-ink-500">{ugx(analytics?.platformCommissionUgx ?? 0)}</p>
                  </div>
                  <div className="rounded-2xl bg-gold/15 p-3">
                    <span className="text-[10px] font-bold uppercase text-gold">Net Profit</span>
                    <p className="mt-1 font-mono text-sm font-black text-ink">{ugx(analytics?.netMarginUgx ?? 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--border-faint)] pt-3 text-center">
                  <div>
                    <p className="text-lg font-black text-ink">{analytics?.totalStockUnits ?? 0}</p>
                    <p className="text-[10px] font-semibold text-ink-500">Total Stock Units</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gold">{analytics?.lowStockCount ?? 0}</p>
                    <p className="text-[10px] font-semibold text-ink-500">Low-Stock Alerts</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-black text-ink mt-1">{ugx(analytics?.b2bPipelineUgx ?? 0)}</p>
                    <p className="text-[10px] font-semibold text-ink-500">B2B Quote Pipeline</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ELITE SECTION 2: ONLINE STORE 2.0 THEME, CUSTOM DOMAIN & PIXELS */}
          {eliteSection === "theme" && (
            <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-ink">Online Store 2.0 Theme & Custom Domain</h3>
                  <p className="text-xs text-ink-500">
                    Customize standalone storefront layout, hero banner, loyalty cashback, and tracking pixels
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewScreen("storefront");
                    setShowStorefrontPreview(true);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-gold/30 bg-gold/10 p-3 text-xs">
                  <p className="font-bold text-ink">
                    Dedicated Storefront Subdomain: <span className="font-mono text-gold">https://{store.slug}.peebee.online</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    Your custom Store 2.0 theme, brand accent, hero banner, and smart collections power your standalone{" "}
                    <span className="font-mono font-semibold">{store.slug}.peebee.online</span> site. The Peebee Customer App
                    maintains its unified Peebee UI while auto-syncing your products, inventory, and promotions in real time.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Optional Custom Domain Override (CNAME to {store.slug}.peebee.online)</label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="e.g. shop.mybrand.ug"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Storefront Layout</label>
                    <Select
                      aria-label="Storefront Layout"
                      value={themeLayout}
                      onValueChange={(val) => setThemeLayout(val as "grid" | "editorial" | "compact")}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    >
                      <option value="grid">2-Column Modern Grid</option>
                      <option value="editorial">Editorial Lookbook (Fashion)</option>
                      <option value="compact">Rapid Aisle List (Supermarket)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">Brand Accent Token</label>
                    <Select
                      aria-label="Brand Accent Token"
                      value={themeAccent}
                      onValueChange={(val) => setThemeAccent(val as "gold" | "ink" | "cream")}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    >
                      <option value="gold">Peebee Gold</option>
                      <option value="ink">Obsidian Ink</option>
                      <option value="cream">Warm Cream</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Hero Banner Headline</label>
                    <input
                      type="text"
                      value={heroHeadline}
                      onChange={(e) => setHeroHeadline(e.target.value)}
                      placeholder="e.g. New Season Collection"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Hero Subtitle</label>
                    <input
                      type="text"
                      value={heroSubheadline}
                      onChange={(e) => setHeroSubheadline(e.target.value)}
                      placeholder="e.g. Same-day Kampala delivery on all orders"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    />
                  </div>
                </div>

                {/* VIP Loyalty Cashback */}
                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-bold text-ink flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-gold" /> Store VIP Loyalty Points & Cashback
                      </span>
                      <span className="text-[10px] text-ink-500">
                        Automatically reward repeat shoppers with store credit (Max{" "}
                        {settings?.eliteMaxLoyaltyCashbackPercent ?? 15}%)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={loyaltyEnabled}
                      onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                      className="h-4 w-4 accent-gold"
                    />
                  </div>
                  {loyaltyEnabled && (
                    <div>
                      <label className="text-[11px] font-semibold text-ink-500">Cashback Reward (%)</label>
                      <input
                        type="number"
                        min={1}
                        max={settings?.eliteMaxLoyaltyCashbackPercent ?? 15}
                        value={loyaltyCashback}
                        onChange={(e) => setLoyaltyCashback(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2 text-xs text-ink"
                      />
                    </div>
                  )}
                </div>

                {/* Retargeting Pixels */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Meta / Instagram Pixel ID</label>
                    <input
                      type="text"
                      value={metaPixelId}
                      onChange={(e) => setMetaPixelId(e.target.value)}
                      placeholder="e.g. 1092837465"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">TikTok Pixel ID</label>
                    <input
                      type="text"
                      value={tiktokPixelId}
                      onChange={(e) => setTiktokPixelId(e.target.value)}
                      placeholder="e.g. C9A8B7D6E5"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTheme}
                  disabled={savingTheme}
                  className="w-full rounded-full bg-gold py-3 text-xs font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
                >
                  {savingTheme ? "Saving Storefront 2.0…" : "Save Theme, Domain & Loyalty Settings"}
                </button>
              </div>
            </div>
          )}

          {/* ELITE SECTION 3: SMART & MANUAL COLLECTIONS */}
          {eliteSection === "collections" && (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-base text-ink">Smart Automated Collections</h3>
                <p className="text-xs text-ink-500">
                  Group products automatically by price cap, category, badge, or stock level (Shopify Smart Collections)
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Collection Title</label>
                    <input
                      type="text"
                      value={colTitle}
                      onChange={(e) => setColTitle(e.target.value)}
                      placeholder="e.g. Under UGX 50,000 Deals"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Collection Type</label>
                    <Select
                      aria-label="Collection Type"
                      value={colKind}
                      onValueChange={(val) => setColKind(val as "smart" | "manual")}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    >
                      <option value="smart">⚡ Smart Rule-Based</option>
                      <option value="manual">📌 Manual Curated</option>
                    </Select>
                  </div>
                </div>

                {colKind === "smart" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-ink-500">Auto-Match Condition</label>
                      <Select
                        aria-label="Auto-Match Condition"
                        value={colRuleField}
                        onValueChange={(val) => setColRuleField(val as typeof colRuleField)}
                        className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                      >
                        <option value="price_lte">Price ≤ (UGX)</option>
                        <option value="price_gte">Price ≥ (UGX)</option>
                        <option value="category">Category matches</option>
                        <option value="badge">Badge matches</option>
                        <option value="in_stock">Currently in stock</option>
                      </Select>
                    </div>
                    {colRuleField !== "in_stock" && (
                      <div>
                        <label className="text-xs font-semibold text-ink-500">Target Value</label>
                        <input
                          type="text"
                          value={colRuleValue}
                          onChange={(e) => setColRuleValue(e.target.value)}
                          placeholder="50000 or Organic"
                          className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                        />
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCreateCollection}
                  disabled={savingCol || !colTitle.trim()}
                  className="w-full rounded-full bg-gold py-3 text-xs font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
                >
                  {savingCol ? "Creating Collection…" : "+ Create Smart Collection"}
                </button>
              </div>

              {collections.length > 0 && (
                <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-ink-500">Active Storefront Collections</h4>
                  {collections.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-ink">{c.title}</span>
                        <p className="text-[10px] text-ink-500">
                          {c.kind === "smart" ? `Smart Rule: ${c.rule_field} ${c.rule_value || ""}` : "Manual"} ·{" "}
                          <strong className="text-gold">{c.matching_products_count ?? 0} products matched</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCollection(c.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ELITE SECTION 4: PROMOTIONS, COUPON CODES & BOGO ENGINE */}
          {eliteSection === "discounts" && (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-base text-ink">Promotions, Coupon Codes & BOGO Engine</h3>
                <p className="text-xs text-ink-500">
                  Create checkout discount codes, automatic cart spend rewards, or merchant-subsidized free delivery
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Promo Code</label>
                    <input
                      type="text"
                      value={discCode}
                      onChange={(e) => setDiscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. KAMPALA20"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 font-mono text-sm font-bold text-ink uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Campaign Title</label>
                    <input
                      type="text"
                      value={discTitle}
                      onChange={(e) => setDiscTitle(e.target.value)}
                      placeholder="e.g. Weekend Flash Sale"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3.5 py-2.5 text-sm text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Discount Type</label>
                    <Select
                      aria-label="Discount Type"
                      value={discKind}
                      onValueChange={(val) => setDiscKind(val as typeof discKind)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    >
                      <option value="percent">% Percentage Off</option>
                      <option value="fixed">Fixed UGX Off</option>
                      <option value="free_delivery">Free Delivery</option>
                      <option value="bogo">Buy 1 Get 1 (BOGO)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">
                      {discKind === "percent" ? "Percent (%)" : "Value (UGX)"}
                    </label>
                    <input
                      type="number"
                      disabled={discKind === "free_delivery"}
                      value={discKind === "free_delivery" ? 0 : discValue}
                      onChange={(e) => setDiscValue(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-ink-500">Min Spend (UGX)</label>
                    <input
                      type="number"
                      value={discMinOrder}
                      onChange={(e) => setDiscMinOrder(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discAuto}
                    onChange={(e) => setDiscAuto(e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  <span>Apply automatically at checkout when minimum cart spend is reached</span>
                </label>

                <button
                  type="button"
                  onClick={handleCreateDiscount}
                  disabled={savingDisc || !discCode.trim() || !discTitle.trim()}
                  className="w-full rounded-full bg-gold py-3 text-xs font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
                >
                  {savingDisc ? "Saving Promo…" : "+ Launch Discount Campaign"}
                </button>
              </div>

              {discounts.length > 0 && (
                <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-ink-500">Active Promotions</h4>
                  {discounts.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-gold px-2 py-0.5 font-mono text-[11px] font-black text-ink-gold">
                            {d.code}
                          </span>
                          <span className="font-bold text-ink">{d.title}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-ink-500">
                          {d.kind === "percent"
                            ? `${d.value}% OFF`
                            : d.kind === "fixed"
                              ? `${ugx(d.value)} OFF`
                              : d.kind === "free_delivery"
                                ? "Free Delivery"
                                : "BOGO Offer"}{" "}
                          · Min order {ugx(d.min_order_amount)} {d.is_automatic ? "· Auto-applied" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDiscount(d.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ELITE SECTION 5: MULTI-OUTLET INVENTORY MATRIX */}
          {eliteSection === "inventory" && (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-base text-ink">Multi-Outlet Branch Stock Matrix</h3>
                <p className="text-xs text-ink-500">
                  Assign stock quantities per physical branch (`merchant_outlets`) for intelligent nearest-branch boda
                  and matatu dispatch
                </p>

                {outlets.length === 0 ? (
                  <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 text-xs text-ink-500">
                    No physical outlets found.{" "}
                    <Link href="/outlets" className="font-bold text-gold underline">
                      Create an outlet branch
                    </Link>{" "}
                    to track multi-location inventory.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="text-xs font-semibold text-ink-500">Physical Branch</label>
                        <Select
                          aria-label="Physical Branch"
                          value={selectedInvOutlet}
                          onValueChange={(val) => setSelectedInvOutlet(val)}
                          className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                        >
                          {outlets.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name} ({o.code})
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-ink-500">Product SKU</label>
                        <Select
                          aria-label="Product SKU"
                          value={selectedInvProduct}
                          onValueChange={(val) => setSelectedInvProduct(val)}
                          className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-ink-500">Branch Qty</label>
                        <input
                          type="number"
                          min={0}
                          value={invQuantity}
                          onChange={(e) => setInvQuantity(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveOutletInventory}
                      disabled={savingInv || !selectedInvOutlet || !selectedInvProduct}
                      className="w-full rounded-full bg-gold py-3 text-xs font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
                    >
                      {savingInv ? "Syncing Branch Stock…" : "Update Branch Stock & Sync Catalog Total"}
                    </button>
                  </div>
                )}
              </div>

              {outletInventory.length > 0 && (
                <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-ink-500">Live Stock by Branch</h4>
                  {outletInventory.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="flex items-center justify-between rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-ink">{row.product_title || "Product"}</span>
                        <p className="text-[10px] text-ink-500">Branch: {row.outlet_name}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-xs font-black ${
                          row.quantity <= row.low_stock_threshold
                            ? "bg-red-500/15 text-red-600"
                            : "bg-gold/15 text-gold"
                        }`}
                      >
                        {row.quantity} units
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ELITE SECTION 6: B2B WHOLESALE & DRAFT ORDERS */}
          {eliteSection === "b2b" && (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-base text-ink">B2B Wholesale & Draft Orders (Shopify Plus)</h3>
                <p className="text-xs text-ink-500">
                  Create custom wholesale quotes with negotiated unit pricing, Net-7/14/30 credit terms, and 1-tap
                  WhatsApp payment links
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Buyer Contact Name</label>
                    <input
                      type="text"
                      value={b2bCustomerName}
                      onChange={(e) => setB2bCustomerName(e.target.value)}
                      placeholder="e.g. Sarah Namubiru"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Business / Kiosk Name</label>
                    <input
                      type="text"
                      value={b2bCompany}
                      onChange={(e) => setB2bCompany(e.target.value)}
                      placeholder="e.g. Ntinda Mini Mart"
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">WhatsApp / Phone</label>
                    <input
                      type="text"
                      value={b2bPhone}
                      onChange={(e) => setB2bPhone(e.target.value)}
                      placeholder="+256 772..."
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Product</label>
                    <Select
                      aria-label="B2B Product"
                      value={b2bProductId}
                      onValueChange={(val) => {
                        setB2bProductId(val);
                        const found = products.find((p) => p.id === val);
                        if (found) setB2bUnitPrice(String(Math.round(found.price * 0.85)));
                      }}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} (Retail {ugx(p.price)})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Wholesale Unit Price (UGX)</label>
                    <input
                      type="number"
                      value={b2bUnitPrice}
                      onChange={(e) => setB2bUnitPrice(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Case / Carton Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={b2bQty}
                      onChange={(e) => setB2bQty(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Payment Terms</label>
                    <Select
                      aria-label="Payment Terms"
                      value={b2bTerms}
                      onValueChange={(val) => setB2bTerms(val as typeof b2bTerms)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    >
                      <option value="immediate">Due on Receipt (1-Tap Escrow)</option>
                      <option value="net_7">Net 7 Days Credit</option>
                      <option value="net_14">Net 14 Days Credit</option>
                      <option value="net_30">Net 30 Days Credit</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Extra Invoice Discount (UGX)</label>
                    <input
                      type="number"
                      min={0}
                      value={b2bDiscountUgx}
                      onChange={(e) => setB2bDiscountUgx(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-xs text-ink"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateDraftOrder}
                  disabled={savingDraft || !b2bCustomerName.trim() || products.length === 0}
                  className="w-full rounded-full bg-gold py-3 text-xs font-bold text-ink-gold shadow transition active:scale-98 disabled:opacity-50"
                >
                  {savingDraft ? "Generating B2B Invoice…" : "Create Wholesale Draft Order & Payment Link →"}
                </button>
              </div>

              {draftOrders.length > 0 && (
                <div className="rounded-[24px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-5 shadow-sm space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-ink-500">B2B Wholesale Quotes & Invoices</h4>
                  {draftOrders.map((drf) => (
                    <div
                      key={drf.id}
                      className="flex items-center justify-between rounded-2xl bg-[rgb(var(--surface-muted))] p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-ink">
                          {drf.customer_company ? `${drf.customer_company} (${drf.customer_name})` : drf.customer_name}
                        </span>
                        <p className="text-[10px] text-ink-500">
                          {drf.payment_terms.replace("_", " ").toUpperCase()} · {drf.items?.length || 1} line item(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block font-mono font-black text-gold">{ugx(drf.total_amount)}</span>
                        <span className="text-[10px] font-bold uppercase text-green-600">{drf.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: PRODUCT CATALOG */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Quick Action Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-xs font-bold text-ink-gold shadow transition active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewScreen("storefront");
                  setShowStorefrontPreview(true);
                }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] px-3.5 py-2.5 text-xs font-bold text-ink transition hover:border-gold active:scale-95 shadow-xs"
              >
                <Eye className="h-4 w-4 text-gold" />
                <span>Preview Storefront</span>
              </button>
            </div>

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
                <div className="space-y-3">
                  <div className="relative aspect-[9/16] w-full max-w-sm mx-auto overflow-hidden rounded-[24px] bg-black shadow-2xl">
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

                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wider">
                        <Radio className="h-3 w-3" /> LIVE
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        <Users className="h-3 w-3 text-gold" /> 148 watching
                      </span>
                    </div>

                    <div className="absolute top-4 right-4">
                      <button
                        onClick={handleEndLiveSession}
                        className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-red-400 backdrop-blur-md hover:bg-red-600 hover:text-white transition"
                      >
                        End
                      </button>
                    </div>

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

                    {liveHearts.map((id) => (
                      <div
                        key={id}
                        className="absolute bottom-16 right-6 text-red-500 animate-bounce text-2xl transition duration-1000"
                      >
                        ❤️
                      </div>
                    ))}
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

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-ink-500">Selling Price (UGX)</label>
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="8000"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Compare Price</label>
                  <input
                    type="number"
                    value={productComparePrice}
                    onChange={(e) => setProductComparePrice(e.target.value)}
                    placeholder="10000"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-500">Cost Price (COGS)</label>
                  <input
                    type="number"
                    value={productCostPrice}
                    onChange={(e) => setProductCostPrice(e.target.value)}
                    placeholder="5500"
                    className="mt-1 w-full rounded-2xl border border-[var(--border-faint)] bg-[rgb(var(--surface-input))] px-3 py-2.5 text-sm text-ink focus:border-gold focus:outline-none"
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

      {/* STOREFRONT PREVIEW MODAL */}
      {showStorefrontPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-[32px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-4 shadow-2xl space-y-3 my-4">
            <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-2.5">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-gold" />
                  <span>Customer View Preview ({themeLayout.toUpperCase()})</span>
                </h3>
                <p className="text-[10px] text-ink-500">
                  {customDomain ? customDomain : `peebee.online/${store.category}/${store.slug}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowStorefrontPreview(false)}
                className="rounded-full p-1.5 text-ink-500 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[rgb(var(--surface-muted))] p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPreviewScreen("storefront")}
                className={`rounded-xl py-2 transition text-center ${
                  previewScreen === "storefront"
                    ? "bg-gold text-ink-gold shadow-sm font-extrabold"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                1. Storefront
              </button>
              <button
                type="button"
                onClick={() => setPreviewScreen("product")}
                className={`rounded-xl py-2 transition text-center ${
                  previewScreen === "product"
                    ? "bg-gold text-ink-gold shadow-sm font-extrabold"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                2. Product
              </button>
              <button
                type="button"
                onClick={() => setPreviewScreen("cart")}
                className={`rounded-xl py-2 transition text-center ${
                  previewScreen === "cart"
                    ? "bg-gold text-ink-gold shadow-sm font-extrabold"
                    : "text-ink-500 hover:text-ink"
                }`}
              >
                3. Cart
              </button>
            </div>

            <div className="rounded-[32px] border-2 border-neutral-700 bg-[rgb(var(--color-bg))] p-3.5 space-y-3 max-h-[580px] overflow-y-auto no-scrollbar shadow-inner text-ink">
              {previewScreen === "storefront" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-ink">
                      <LayoutGrid className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-center min-w-0 px-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
                        {store.address || "Kampala, UG"}
                      </p>
                      <h4 className="text-xs font-black text-ink truncate">{store.name}</h4>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-xs font-bold text-gold">
                      {store.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {loyaltyEnabled && (
                    <div className="rounded-xl bg-gold/15 px-3 py-1.5 text-[10px] font-bold text-gold flex items-center justify-between">
                      <span>🎁 VIP Loyalty Active: Earn {loyaltyCashback}% cashback points</span>
                      <span>ELITE</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="field-box flex-1 flex items-center rounded-xl px-3 py-2 text-xs">
                      <Search className="h-3.5 w-3.5 text-ink-500 mr-2 shrink-0" />
                      <span className="text-[11px] text-ink-500">Search products…</span>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[24px] border border-gold/30 bg-gradient-to-r from-gold/20 via-gold/10 to-[rgb(var(--surface-card))] p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-16 w-16 rounded-xl bg-neutral-900 overflow-hidden shrink-0">
                        {products[0]?.image_url ? (
                          <img src={products[0].image_url || undefined} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">🛍️</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="rounded-full bg-gold/30 px-2 py-0.5 text-[8px] font-black uppercase text-gold">
                          {heroCtaText || "Featured"}
                        </span>
                        <h5 className="text-xs font-bold text-ink truncate mt-0.5">
                          {heroHeadline || products[0]?.title || "Store Collection"}
                        </h5>
                        <p className="text-[9px] text-ink-500 line-clamp-1">
                          {heroSubheadline || "Up to 40% OFF trending products"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto text-[10px] font-bold">
                    <span className="rounded-full bg-gold px-3 py-1 text-ink-gold">All</span>
                    {collections.map((c) => (
                      <span
                        key={c.id}
                        className="rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-ink whitespace-nowrap"
                      >
                        {c.title}
                      </span>
                    ))}
                    <span className="rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-ink-500">Popular</span>
                  </div>

                  <div className={themeLayout === "compact" ? "space-y-2 pt-1" : "grid grid-cols-2 gap-2 pt-1"}>
                    {(products.length > 0 ? products.slice(0, 4) : [1, 2]).map((item, idx) => {
                      const prod = typeof item === "object" ? item : null;
                      return (
                        <div
                          key={idx}
                          className="rounded-[20px] border border-[var(--border-faint)] bg-[rgb(var(--surface-card))] p-2.5 space-y-1.5"
                        >
                          <div className="relative aspect-[4/5] rounded-[16px] bg-neutral-900 overflow-hidden">
                            {prod?.image_url ? (
                              <img src={prod.image_url || undefined} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl">🛍️</div>
                            )}
                            <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
                              <Heart className="h-3 w-3" />
                            </div>
                          </div>
                          <div className="text-[11px] font-bold text-ink truncate">{prod?.title || `Product Item ${idx + 1}`}</div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-[11px] font-black text-ink">{ugx(prod?.price || 15000)}</span>
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink-gold text-[10px] font-bold">
                              +
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {previewScreen === "product" && (
                <div className="space-y-3">
                  <div className="relative h-48 w-full rounded-b-[28px] bg-neutral-900 overflow-hidden -mx-3.5 -mt-3.5 mb-2">
                    {products[0]?.image_url ? (
                      <img src={products[0].image_url || undefined} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">🛍️</div>
                    )}
                    <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </div>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-ink">{products[0]?.title || "Designer Item"}</h4>
                      <p className="text-[10px] text-gold font-semibold">Premium Collection</p>
                    </div>
                    <span className="text-sm font-black text-gold">{ugx(products[0]?.price || 25000)}</span>
                  </div>

                  <p className="text-[10px] text-ink-500 leading-relaxed">
                    {products[0]?.description || "Soft comfortable fabric with elegant tailoring and versatile styling."}
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-ink">Size</span>
                    <div className="flex gap-1.5">
                      {["S", "M", "L", "XL"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPreviewSelectedSize(s)}
                          className={`h-7 w-8 rounded-lg text-[10px] font-bold ${
                            previewSelectedSize === s ? "bg-gold text-ink-gold" : "bg-[rgb(var(--surface-muted))] text-ink-500"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-faint)]">
                    <button
                      type="button"
                      className="flex-1 h-10 rounded-full bg-gold text-xs font-bold text-ink-gold shadow-sm"
                    >
                      Buy Now
                    </button>
                    <div className="h-10 w-10 rounded-full bg-[rgb(var(--surface-muted))] border border-[var(--border-faint)] flex items-center justify-center text-ink">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              )}

              {previewScreen === "cart" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-faint)] pb-2">
                    <LayoutGrid className="h-4 w-4 text-ink-500" />
                    <span className="text-xs font-bold text-ink">Cart</span>
                    <div className="h-6 w-6 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-bold">
                      PB
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[var(--border-faint)] bg-[rgb(var(--surface-muted))] p-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="h-10 w-10 rounded-lg bg-neutral-900 overflow-hidden shrink-0">
                          {products[i - 1]?.image_url ? (
                            <img src={products[i - 1]?.image_url || undefined} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs">🛍️</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-ink truncate">
                            {products[i - 1]?.title || `Store Item ${i}`}
                          </p>
                          <span className="text-[10px] font-black text-gold">{ugx(products[i - 1]?.price || 15000)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-ink">- 1 +</span>
                          <span className="h-4 w-4 rounded-md bg-gold flex items-center justify-center text-ink-gold text-[9px] font-black">
                            ✓
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {discounts.length > 0 && (
                    <div className="rounded-xl bg-gold/15 px-3 py-1.5 text-[10px] font-bold text-gold flex items-center justify-between">
                      <span>🏷️ Promo applied: {discounts[0].code}</span>
                      <span>{discounts[0].title}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[var(--border-faint)] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-ink-500 block">Total</span>
                      <span className="text-xs font-black text-gold">{ugx(35000)}</span>
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-gold px-5 py-2 text-xs font-bold text-ink-gold shadow-sm"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
