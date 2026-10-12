"use client";

import { observeNotificationSnapshot } from "@peebee/shared";

import type { OrderRow } from "@peebee/shared";
import {
  Archive,
  Bike,
  BookOpen,
  Briefcase,
  Car,
  CarFront,
  ChefHat,
  ChevronRight,
  CookingPot,
  Croissant,
  Flame,
  Home,
  ListChecks,
  Package,
  Pill,
  Route,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Store,
  UtensilsCrossed,
  Truck,
  UsersRound,
  WashingMachine,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useTranslate } from "../lib/i18n";
import { orderTitle, stageLabel } from "../lib/order-display";
import { useLivePolling } from "../lib/use-live-polling";
import { BottomDrawer } from "./BottomDrawer";

type MenuGroup = "original" | "ride" | "shopping" | "food" | "deliver" | "services";
type MenuItem = { id: string; label: string; icon: LucideIcon; href?: string; group?: Exclude<MenuGroup, "original">; disabled?: boolean };

const originalMenu: MenuItem[] = [
  { id: "ride", label: "Ride", icon: Route, group: "ride" },
  { id: "shopping", label: "Buy", icon: ShoppingBag, group: "shopping" },
  { id: "food", label: "Eat", icon: UtensilsCrossed, group: "food" },
  { id: "deliver", label: "Send", icon: Package, group: "deliver" },
  { id: "services", label: "Services", icon: Sparkles, group: "services" },
];

const submenuItems: Record<Exclude<MenuGroup, "original">, MenuItem[]> = {
  ride: [
    { id: "boda", label: "Boda", icon: Bike, href: "/ride/boda" },
    { id: "car", label: "Car", icon: Car, href: "/ride/car" },
    { id: "rideshare", label: "Rideshare", icon: UsersRound, href: "/carpool" },
    { id: "selfdrive", label: "Selfdrive", icon: CarFront, href: "/rent" },
  ],
  shopping: [
    { id: "shoplist", label: "List", icon: ListChecks, href: "/shoplist" },
    { id: "markets", label: "Groceries", icon: Store, href: "/groceries" },
    { id: "stores", label: "Stores", icon: ShoppingBasket, href: "/stores" },
    { id: "pharmacy", label: "Pharma", icon: Pill, disabled: true },
    { id: "spotlight", label: "Spotlight", icon: Flame, href: "/spotlight" },
  ],
  food: [
    { id: "restaurant", label: "Restaurants", icon: UtensilsCrossed, href: "/restaurants" },
    { id: "kitchen", label: "Kitchens", icon: CookingPot, href: "/kitchens" },
    { id: "street_food", label: "Streetfood", icon: ChefHat, href: "/streetfood" },
    { id: "bakery", label: "Bakeries", icon: Croissant, href: "/bakeries" },
  ],
  deliver: [
    { id: "parcel", label: "Parcels", icon: Package, href: "/deliver/parcel" },
    { id: "laundry", label: "Goods", icon: ShoppingBasket, disabled: true },
    { id: "fix", label: "Move", icon: Truck, disabled: true },
    { id: "move", label: "Storage", icon: Archive, disabled: true },
  ],
  services: [
    { id: "laundry", label: "Laundry", icon: WashingMachine, href: "/services/laundry" },
    { id: "fix", label: "Fix", icon: Wrench, href: "/services/fix" },
    { id: "jobs", label: "Jobs", icon: Briefcase, href: "/service" },
    { id: "learn", label: "Learn", icon: BookOpen, href: "/services/learn" },
  ],
};

function groupForPath(pathname: string): MenuGroup {
  if (["/food", "/restaurants", "/kitchens", "/streetfood", "/bakeries"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "food";
  if (pathname === "/ride" || pathname === "/rent" || pathname === "/carpool" || pathname.startsWith("/ride/")) return "ride";
  if (["/shopping", "/shoplist", "/groceries", "/stores", "/store", "/spotlight"].some((path) => pathname === path || pathname.startsWith(`${path}/`)) || pathname.startsWith("/orders")) return "shopping";
  if (pathname === "/deliver" || pathname.startsWith("/deliver/")) return "deliver";
  if (["/services", "/service"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "services";
  return "original";
}

const ACTIVE_ORDER_POLL_MS = 10000;

export function BottomNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);
  const [trackerDrawerOpen, setTrackerDrawerOpen] = useState(false);
  const [menuGroup, setMenuGroup] = useState<MenuGroup>(() => groupForPath(pathname));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const t = useTranslate();

  useEffect(() => {
    const group = groupForPath(pathname);
    setMenuGroup(group);
    if (pathname === "/restaurants" || pathname.startsWith("/restaurants/")) setSelectedItem("restaurant");
    else if (pathname === "/kitchens" || pathname.startsWith("/kitchens/")) setSelectedItem("kitchen");
    else if (pathname === "/streetfood" || pathname.startsWith("/streetfood/")) setSelectedItem("street_food");
    else if (pathname === "/bakeries" || pathname.startsWith("/bakeries/")) setSelectedItem("bakery");
    else if (pathname === "/ride/boda") setSelectedItem("boda");
    else if (pathname === "/ride/car") setSelectedItem("car");
    else if (pathname === "/carpool") setSelectedItem("rideshare");
    else if (pathname === "/rent") setSelectedItem("selfdrive");
    else if (pathname === "/shoplist" || pathname.startsWith("/orders")) setSelectedItem("shoplist");
    else if (pathname === "/groceries" || pathname.startsWith("/groceries/")) setSelectedItem("markets");
    else if (pathname === "/stores" || pathname.startsWith("/store/")) setSelectedItem("stores");
    else if (pathname === "/spotlight") setSelectedItem("spotlight");
    else if (pathname === "/services/laundry") setSelectedItem("laundry");
    else if (pathname === "/services/fix") setSelectedItem("fix");
    else if (pathname === "/service" || pathname === "/services/jobs") setSelectedItem("jobs");
    else if (pathname === "/services/learn") setSelectedItem("learn");
    else if (pathname === "/deliver/parcel") setSelectedItem("parcel");
    else setSelectedItem(null);
  }, [pathname]);

  useLivePolling(
    () => {
      if (!user) return;
      api
        .getActiveOrder()
        .then((res) => {
          const order = res.activeOrder;
          observeNotificationSnapshot("active-order", order ? [order.id + ":" + order.stage] : []);
          setActiveOrder(order);
        })
        .catch(() => setActiveOrder(null));
    },
    ACTIVE_ORDER_POLL_MS,
    [user],
  );

  // Skip the floating badge where it would repeat what's already on screen:
  // the active order's own tracking page, and Home (which has the Active
  // order card — the chip just sat on top of it while scrolling).
  const isOnActiveOrderPage = activeOrder ? pathname === `/orders/${activeOrder.id}` : false;
  const showActiveDeliveryBadge = !overlay && !!activeOrder && !isOnActiveOrderPage && pathname !== "/";

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Keep the content clearance tied to the rendered footer, including its
    // optional active-order chip and the device's safe-area inset.
    const updateClearance = () => {
      const gap = Math.ceil(window.innerHeight - nav.getBoundingClientRect().top + 15);
      document.documentElement.style.setProperty("--customer-nav-content-gap", `${gap}px`);
    };

    updateClearance();
    const observer = new ResizeObserver(updateClearance);
    observer.observe(nav);
    window.addEventListener("resize", updateClearance);
    window.visualViewport?.addEventListener("resize", updateClearance);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateClearance);
      window.visualViewport?.removeEventListener("resize", updateClearance);
      document.documentElement.style.removeProperty("--customer-nav-content-gap");
    };
  }, [showActiveDeliveryBadge]);

  return (
    <>
      <nav ref={navRef} aria-label="Primary navigation" className={`customer-nav fixed inset-x-0 bottom-3 z-40 px-3 pointer-events-none pb-[env(safe-area-inset-bottom)] ${overlay ? "customer-nav-overlay" : ""}`}>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-2">
          {/* Active Delivery Floating Capsule Chip */}
          {showActiveDeliveryBadge && (
            <button
              type="button"
              onClick={() => setTrackerDrawerOpen(true)}
              className="pointer-events-auto flex items-center gap-2 rounded-full glass-panel border border-gold/30 px-3.5 py-1.5 shadow-[var(--shadow-float-capsule)] animate-drawer-in active:scale-95 transition-transform"
            >
              <span className="flex h-2 w-2 rounded-full bg-green animate-pulse" />
              <ShoppingBag className="h-3.5 w-3.5 text-gold" strokeWidth={2.2} />
              <span className="text-xs font-bold text-ink truncate max-w-[170px]">
                {stageLabel(activeOrder.stage, activeOrder.type)}
              </span>
              {activeOrder.pin_code && (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-ink tracking-wider">
                  {t("nav_tracker_pin_label", { pin: activeOrder.pin_code })}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-ink-500" />
            </button>
          )}

          {/* Home stays separate; the wider menu changes between the four service groups. */}
          <div className="pointer-events-auto flex w-full items-center gap-1.5">
            {/* Detached Home Capsule on Left */}
            <div className="customer-nav-capsule flex w-[64px] sm:w-[72px] shrink-0 items-center justify-center rounded-[24px] p-1.5 shadow-[var(--shadow-float-capsule)]">
              <button
                type="button"
                aria-label="Home and reset menu"
                aria-current={pathname === "/" ? "page" : undefined}
                onClick={() => {
                  setMenuGroup("original");
                  setSelectedItem(null);
                  router.push("/");
                }}
                className={`customer-nav-item relative flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                  pathname === "/" ? "is-active" : ""
                }`}
              >
                <Home className="h-5 w-5" strokeWidth={pathname === "/" ? 2.4 : 1.8} aria-hidden />
                <span className="leading-none truncate max-w-[54px]">{t("nav_home")}</span>
                {pathname === "/" && (
                  <span
                    className="customer-nav-indicator absolute bottom-1.5 h-1 w-3.5 rounded-full"
                    aria-hidden
                  />
                )}
              </button>
            </div>

            {/* Main Menu Capsule on Right */}
            <div className="customer-nav-capsule flex flex-1 min-w-0 items-center justify-around rounded-[24px] p-1.5 shadow-[var(--shadow-float-capsule)]">
              <ul
                key={menuGroup}
                className="customer-nav-items flex h-full w-full items-stretch justify-around gap-1"
                aria-label={menuGroup === "original" ? "Main menu" : `${menuGroup} menu`}
              >
                {(menuGroup === "original" ? originalMenu : submenuItems[menuGroup]).map((item) => {
                  const Icon = item.icon;
                  const active = item.id === selectedItem;

                  const content = (
                    <>
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                      <span className="leading-none truncate max-w-full text-[10px] sm:text-[11px] font-bold">
                        {item.label}
                      </span>
                      {active && (
                        <span
                          className="customer-nav-indicator absolute bottom-1.5 h-1 w-3.5 rounded-full"
                          aria-hidden
                        />
                      )}
                    </>
                  );

                  const btnClass = `customer-nav-item relative flex h-[58px] w-full flex-col items-center justify-center gap-1 rounded-[18px] px-0.5 sm:px-1 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                    active ? "is-active" : ""
                  } ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}`;

                  return (
                    <li key={item.id} className="flex-1 min-w-0">
                      {item.group ? (
                        <button
                          type="button"
                          aria-label={`${item.label} home and submenu`}
                          aria-expanded={menuGroup === item.group}
                          onClick={() => {
                            setMenuGroup(item.group!);
                            setSelectedItem(null);
                            router.push(
                              {
                                ride: "/ride",
                                shopping: "/shopping",
                                food: "/food",
                                deliver: "/deliver",
                                services: "/services",
                              }[item.group!]
                            );
                          }}
                          className={btnClass}
                        >
                          {content}
                        </button>
                      ) : item.disabled ? (
                        <button
                          type="button"
                          aria-disabled="true"
                          aria-label={`${item.label}, coming soon`}
                          title="Coming soon"
                          onClick={() => setSelectedItem(item.id)}
                          className={btnClass}
                        >
                          {content}
                        </button>
                      ) : (
                        <Link
                          href={item.href!}
                          onClick={() => setSelectedItem(item.id)}
                          aria-current={active ? "page" : undefined}
                          className={btnClass}
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {/* Mini Tracker Bottom Sheet for Active Delivery */}
      {activeOrder && (
        <BottomDrawer
          isOpen={trackerDrawerOpen}
          onClose={() => setTrackerDrawerOpen(false)}
          title={t("nav_tracker_title")}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-[rgb(var(--surface-muted))] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  {activeOrder.type === "parcel" ? t("nav_tracker_parcel") : t("nav_tracker_shopping")}
                </span>
                <span className="rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-bold text-green">
                  {stageLabel(activeOrder.stage, activeOrder.type)}
                </span>
              </div>
              <h3 className="text-base font-bold text-ink">{orderTitle(activeOrder)}</h3>
              {activeOrder.pin_code && (
                <div className="rounded-xl bg-gold/10 p-3 text-center">
                  <p className="text-xs font-semibold uppercase text-ink-500">{t("nav_tracker_handover_pin")}</p>
                  <p className="text-2xl font-bold tracking-[0.25em] text-ink">{activeOrder.pin_code}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setTrackerDrawerOpen(false);
                router.push(`/orders/${activeOrder.id}`);
              }}
              className="min-h-12 w-full rounded-full bg-gold px-4 text-sm font-bold text-ink-gold shadow-[var(--shadow-glow-gold)] active:scale-95 transition-transform"
            >
              {t("nav_tracker_open_full")}
            </button>
          </div>
        </BottomDrawer>
      )}
    </>
  );
}
