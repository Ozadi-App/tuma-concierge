// Demo Spotlight posts for practice mode: something under every button of Spotlight's menu
// (For you, Following, Creators, Market, Learn). Practice mode never touches the real feed.
import type { ChannelView, PostView, PublisherView } from "./channels-client.js";
import { PRACTICE_ENTEBBE_STORES, PRACTICE_FOOD_RESTAURANTS } from "./practice-entebbe.js";

const svg = (bg: string, emoji: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1200'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' font-size='260' text-anchor='middle' dominant-baseline='middle'>${emoji}</text></svg>`)}`;

type Base = Pick<PostView, "type" | "caption"> & Partial<Pick<PostView, "tags" | "poll" | "productRef">> & { images?: string[]; publisher: PublisherView; ago: number; likes: number; comments: number; views: number };

let counter = 0;
function post(b: Base): PostView {
  counter += 1;
  const at = new Date(Date.now() - b.ago * 60_000).toISOString();
  return {
    id: `practice_post_${counter}`, publisher: b.publisher, type: b.type, caption: b.caption, tags: b.tags ?? [], language: "en",
    media: { images: b.images ?? [], audioUrl: null, liveUrl: null, videoAssetId: null, coverUrl: null, durationSeconds: null },
    poll: b.poll ?? null, productRef: b.productRef ?? null,
    access: "free", priceUgx: 0, previewSeconds: 0, locked: null,
    status: "published", publishedAt: at, scheduledAt: null, liveStatus: null,
    counts: { views: b.views, likes: b.likes, comments: b.comments }, liked: false, toChannel: true, toSpotlight: true, isMine: false, removedReason: null, createdAt: at,
  };
}

const channel = (id: string, handle: string, name: string, emoji: string, bg: string): PublisherView => ({ type: "channel", id, name, handle, avatarUrl: svg(bg, emoji), verified: id === "practice-ch-amina", href: `/c/${handle}` });
const AMINA = channel("practice-ch-amina", "amina-cooks", "Amina Cooks", "🍲", "#FDE7C8");
const KATO = channel("practice-ch-kato", "kato-fixes", "Kato Fixes", "🔧", "#D9ECF7");
const ZAWADI = channel("practice-ch-zawadi", "zawadi-beats", "Zawadi Beats", "🎧", "#EBDDF7");

const store = PRACTICE_ENTEBBE_STORES;
const storeBy = (i: number): PublisherView => {
  const s = store[i % store.length]!;
  return { type: "store", id: s.id, name: s.name, handle: null, avatarUrl: s.logo_url, verified: true, href: `/store/${s.id}` };
};
const food = PRACTICE_FOOD_RESTAURANTS;
const restaurantBy = (i: number): PublisherView => {
  const r = food[i % food.length]!;
  return { type: "restaurant", id: r.id, name: r.name, handle: null, avatarUrl: svg("#FFE3D1", "🍽️"), verified: true, href: `/restaurants/${r.id}` };
};
const person = (id: string, name: string, type: "personal" | "driver" | "learn", emoji: string, bg: string): PublisherView => ({ type, id, name, handle: null, avatarUrl: svg(bg, emoji), verified: false, href: null });

const POSTS: PostView[] = [
  // Creators: channels (some followed in practice) and personal posts
  post({ type: "image", publisher: AMINA, caption: "Sunday pilau, the way my grandmother made it. Full recipe soon!", tags: ["cooking", "pilau"], images: ["/demo-food/chicken-pilau.webp"], ago: 12, likes: 482, comments: 36, views: 5200 }),
  post({ type: "carousel", publisher: AMINA, caption: "Three street-food plates under UGX 10,000 around Entebbe. Swipe!", tags: ["streetfood"], images: ["/demo-food/loaded-chips.webp", "/demo-food/garlic-bread.webp", "/demo-food/beef-luwombo.webp"], ago: 95, likes: 311, comments: 22, views: 3800 }),
  post({ type: "text", publisher: KATO, caption: "Phone won't charge? Before you buy a new charger, clean the port with a dry toothbrush. Nine times out of ten, that is the whole problem.", tags: ["tips", "phones"], ago: 40, likes: 205, comments: 18, views: 2900 }),
  post({ type: "image", publisher: ZAWADI, caption: "Road-testing these retro sneakers for a week around town. Verdict in the next post.", tags: ["style"], images: ["/products/retro-sneakers.jpg"], ago: 180, likes: 267, comments: 15, views: 3100 }),
  post({ type: "text", publisher: ZAWADI, caption: "Which sound should I mix next on Friday's live set?", poll: { question: "Which sound should I mix next?", options: [{ text: "Kidandali", votes: 128 }, { text: "Afrobeats", votes: 214 }, { text: "Amapiano", votes: 305 }, { text: "Gospel", votes: 61 }], total: 708, myVote: null }, ago: 260, likes: 143, comments: 40, views: 2100 }),
  post({ type: "text", publisher: person("practice-user-joseph", "Joseph O.", "personal", "🙂", "#E6F2E6"), caption: "Ordered groceries at 4pm, they were at my door by 4:25. Peebee riders are quick.", ago: 70, likes: 58, comments: 6, views: 640 }),
  // Market: stores and restaurants
  post({ type: "image", publisher: storeBy(0), caption: "Fresh avocados just in. Pick up or we deliver within the hour.", images: ["/products/fresh-avocados.jpg"], ago: 25, likes: 190, comments: 11, views: 2400 }),
  post({ type: "image", publisher: storeBy(1), caption: "Warm sourdough out of the oven until 6pm. Order early, it goes fast.", images: ["/products/sourdough-bread.jpg"], ago: 130, likes: 164, comments: 9, views: 1900 }),
  post({ type: "image", publisher: storeBy(2), caption: "New this week: shea butter and glow serum, made in Uganda.", images: ["/products/shea-butter.jpg"], ago: 300, likes: 121, comments: 7, views: 1500 }),
  post({ type: "image", publisher: restaurantBy(0), caption: "Lunch special: chicken pilau with kachumbari, UGX 12,000 until 3pm.", images: ["/demo-food/chicken-pilau.webp"], ago: 55, likes: 233, comments: 14, views: 2700 }),
  post({ type: "image", publisher: restaurantBy(1), caption: "Cold mango smoothies are back. Perfect for this heat.", images: ["/demo-food/mango-smoothie.webp"], ago: 210, likes: 176, comments: 10, views: 2000 }),
  // Learn
  post({ type: "image", publisher: person("practice-learn-skills", "Entebbe Skills Academy", "learn", "📚", "#E3E8FA"), caption: "New evening class: Bookkeeping for small shops. Starts Monday 6pm. Enrol in Learn.", images: [svg("#E3E8FA", "📒")], ago: 85, likes: 97, comments: 12, views: 1300 }),
  post({ type: "text", publisher: person("practice-learn-codehub", "Lake Code Hub", "learn", "💻", "#DDEFF2"), caption: "Free Saturday workshop: build your first website on your phone. Bring a friend, seats are limited.", ago: 340, likes: 84, comments: 9, views: 1100 }),
  // Drivers
  post({ type: "text", publisher: person("practice-driver-peter", "Peter · Driver", "driver", "🚗", "#F7EBD0"), caption: "Thank you Entebbe for another great week on the road. Ride safe!", ago: 150, likes: 72, comments: 5, views: 800 }),
  post({ type: "text", publisher: person("practice-driver-daniel", "Daniel · Boda rider", "driver", "🏍️", "#F1E0D6"), caption: "Kitoro stage is open until late tonight. Quick and safe rides, helmets provided.", ago: 410, likes: 63, comments: 4, views: 700 }),
];

const CHANNEL_PUBLISHERS = [AMINA, KATO, ZAWADI];
const followed = new Set<string>([AMINA.id, KATO.id]);
const likedIds = new Set<string>();

const channelView = (p: PublisherView): ChannelView => ({
  id: p.id, handle: p.handle ?? p.id, displayName: p.name, bio: "", avatarUrl: p.avatarUrl, bannerUrl: null, category: null, links: [], verified: p.verified, status: "active",
  followerCount: 1200, postCount: POSTS.filter((x) => x.publisher?.id === p.id).length, createdAt: new Date().toISOString(), isOwner: false, isFollowing: followed.has(p.id),
});

/** The practice answers to the Spotlight posts API. Returns null for anything else so the caller can refuse it. */
export function practiceSpotlightPosts(path: string, method: string, query: URLSearchParams): unknown | null {
  if (method === "GET" && path === "/v1/spotlight/feed") {
    const following = query.get("filter") === "following";
    const list = (following ? POSTS.filter((p) => p.publisher?.type === "channel" && followed.has(p.publisher.id)) : POSTS).map((p) => ({ ...p, liked: likedIds.has(p.id) }));
    return { posts: list, nextCursor: null };
  }
  if (method === "GET" && path === "/v1/channels/following") return { channels: CHANNEL_PUBLISHERS.filter((c) => followed.has(c.id)).map(channelView) };
  const follow = /^\/v1\/channels\/([^/]+)\/follow$/.exec(path);
  if (follow) {
    if (method === "POST") { followed.add(decodeURIComponent(follow[1]!)); return { following: true }; }
    if (method === "DELETE") { followed.delete(decodeURIComponent(follow[1]!)); return { following: false }; }
  }
  const act = /^\/v1\/posts\/([^/]+)\/(like|view|vote)$/.exec(path);
  if (act && method === "POST") {
    const id = decodeURIComponent(act[1]!);
    const found = POSTS.find((p) => p.id === id);
    if (!found) return null;
    if (act[2] === "like") {
      const liked = !likedIds.has(id);
      if (liked) likedIds.add(id); else likedIds.delete(id);
      return { liked, likeCount: found.counts.likes + (liked ? 1 : 0) };
    }
    return act[2] === "view" ? { counted: false } : { ok: true };
  }
  const one = /^\/v1\/posts\/([^/]+)$/.exec(path);
  if (one && method === "GET") {
    const found = POSTS.find((p) => p.id === decodeURIComponent(one[1]!));
    return found ? { post: { ...found, liked: likedIds.has(found.id) } } : null;
  }
  return null;
}
