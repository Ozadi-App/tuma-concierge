/**
 * Every Channels option, defined once. The API validates and clamps saved settings against this list
 * and the Admin app draws its settings screen from it, so an option cannot exist without an Admin
 * control, a safe default and server-side limits. Nothing here is a constant in the code beyond
 * these defaults; an admin can change any value at will.
 *
 * Features that handle money or identity ship switched off (`monetization.enabled`, `causes.enabled`,
 * `rewards.enabled`, `kyc.withdrawalsEnabled`), so they stay dark until the business is licensed for them.
 */

export type ChannelsConfig = {
  enabled: boolean;
  general: {
    channelsOpen: boolean;
    ageDeclarationRequired: boolean;
    minAge: number;
    handleMinLength: number;
    handleMaxLength: number;
    handleChangeDays: number;
    reservedHandles: string;
    maxBioChars: number;
    maxLinks: number;
    sitemapEnabled: boolean;
  };
  publishing: {
    personalPosting: boolean;
    publishers: string[];
    postTypes: string[];
    postsPerDay: number;
    maxCaptionChars: number;
    maxCarouselImages: number;
    maxPollOptions: number;
    maxTags: number;
    maxImageMb: number;
    maxAudioMb: number;
    schedulingEnabled: boolean;
    driverBlockWhileOnJob: boolean;
    commentsEnabled: boolean;
    reactionsEnabled: boolean;
    commentsPerHour: number;
    maxCommentChars: number;
  };
  moderation: {
    mode: "after" | "before";
    reviewFirstPosts: number;
    autoHideAtReports: number;
    blockedWords: string;
    reportsPerDay: number;
  };
  ranking: {
    pageSize: number;
    followedBoost: number;
    recencyWeight: number;
    engagementWeight: number;
    storeWeight: number;
    channelWeight: number;
    otherWeight: number;
    recencyHours: number;
  };
  monetization: {
    enabled: boolean;
    memberships: boolean;
    payPerView: boolean;
    tips: boolean;
    gifts: boolean;
    giftOptions: string;
    maxTiers: number;
    minTierPriceUgx: number;
    maxTierPriceUgx: number;
    minPayPerViewUgx: number;
    maxPayPerViewUgx: number;
    minTipUgx: number;
    maxTipUgx: number;
    maxPreviewSeconds: number;
    previewCooldownMinutes: number;
    membersGetPayPerViewFree: boolean;
    earningsToWalletEnabled: boolean;
    membershipCutPercent: number;
    payPerViewCutPercent: number;
    tipCutPercent: number;
    giftCutPercent: number;
  };
  kyc: {
    required: boolean;
    withdrawalsEnabled: boolean;
    minWithdrawUgx: number;
    maxWithdrawUgx: number;
    dailyCapUgx: number;
    monthlyCapUgx: number;
    minAgeToWithdraw: number;
    requireSelfie: boolean;
    requireIdBack: boolean;
    idTypes: string[];
    payoutAccountCooldownDays: number;
    reverifyDays: number;
    maxDocumentMb: number;
  };
  causes: {
    enabled: boolean;
    requireApproval: boolean;
    requireKycAboveGoalUgx: number;
    minGoalUgx: number;
    maxGoalUgx: number;
    minDays: number;
    maxDays: number;
    maxActivePerChannel: number;
    allowAllOrNothing: boolean;
    defaultFundingMode: "keep" | "all_or_nothing";
    releaseMode: "anytime" | "on_end";
    holdDays: number;
    guestDonations: boolean;
    donorTipEnabled: boolean;
    minDonationUgx: number;
    maxDonationUgx: number;
    allowAnonymous: boolean;
    allowWalletPayment: boolean;
    allowMobileMoney: boolean;
    updatesEnabled: boolean;
    donorWallVisible: boolean;
    reviewEditsAfterApproval: boolean;
    donationCutPercent: number;
  };
  live: {
    enabled: boolean;
    minFollowers: number;
    maxMinutes: number;
    maxPerDay: number;
    commentsEnabled: boolean;
    maxCommentChars: number;
    commentCooldownSeconds: number;
    helperEnabled: boolean;
    helperCodeMinutes: number;
    showViewerCount: boolean;
    showInSpotlight: boolean;
    requireVerifiedPublisher: boolean;
    broadcastsEnabled: boolean;
    premieresEnabled: boolean;
    maxProgramItems: number;
    maxProgramMinutes: number;
    minLeadMinutes: number;
    maxLeadDays: number;
    maxUpcomingPerPublisher: number;
    remindersEnabled: boolean;
    notifyFollowersOnAir: boolean;
  };
  rewards: {
    enabled: boolean;
    qualifiedViewSeconds: number;
    qualifiedViewsPerViewerPerHour: number;
    pointsPerQualifiedView: number;
    countAnonymousViews: boolean;
    rateLock: "at_earn" | "at_cashout";
    minCashoutPoints: number;
    cashoutCooldownDays: number;
    monthlyBudgetUgx: number;
    monthlyCapPerCreatorUgx: number;
    adShareEnabled: boolean;
  };
};

type Paths<T> = {
  [K in keyof T & string]: T[K] extends readonly unknown[] ? K : T[K] extends object ? `${K}.${Paths<T[K]>}` : K;
}[keyof T & string];

export type ChannelsConfigPath = Paths<ChannelsConfig>;

export const CHANNELS_SECTIONS = [
  { id: "general", label: "Channels", hint: "Who can open a channel, handles and profiles" },
  { id: "publishing", label: "Posting and the Spotlight", hint: "Who can post what, limits, comments" },
  { id: "moderation", label: "Moderation", hint: "Review, reports and blocked words" },
  { id: "ranking", label: "Spotlight ranking", hint: "How the feed is ordered and mixed" },
  { id: "monetization", label: "Memberships, paid posts and tips", hint: "Money from audiences. Needs the right licences before you switch it on." },
  { id: "kyc", label: "Verification and withdrawals", hint: "ID checks are asked for only when someone withdraws" },
  { id: "causes", label: "Causes (fundraising)", hint: "Approval, goals, donations and releases. Needs the right licences before you switch it on." },
  { id: "live", label: "Go live, broadcasts and premieres", hint: "Going live from a phone camera needs a video provider that supports live (Cloudflare Stream). Broadcasts and premieres only air videos already uploaded, so they work with any video provider." },
  { id: "rewards", label: "Rewards", hint: "Points for views, and turning points into money" },
] as const;

export type ChannelsSectionId = (typeof CHANNELS_SECTIONS)[number]["id"];

export type ChannelsField = {
  path: ChannelsConfigPath;
  section: ChannelsSectionId | "master";
  label: string;
  hint: string;
} & (
  | { kind: "bool"; default: boolean }
  | { kind: "int"; default: number; min: number; max: number; step?: number; unit?: string }
  | { kind: "enum"; default: string; options: { value: string; label: string }[] }
  | { kind: "multi"; default: string[]; options: { value: string; label: string }[] }
  | { kind: "text"; default: string; maxLength: number }
);

export const POST_TYPE_OPTIONS = [
  { value: "video", label: "Video" },
  { value: "image", label: "Single image" },
  { value: "carousel", label: "Carousel" },
  { value: "text", label: "Text and polls" },
  { value: "audio", label: "Audio" },
  { value: "live", label: "Live" },
];

export const PUBLISHER_OPTIONS = [
  { value: "channel", label: "Channels" },
  { value: "store", label: "Stores" },
  { value: "restaurant", label: "Restaurants" },
  { value: "learn", label: "Learn schools" },
  { value: "driver", label: "Drivers" },
];

export const ID_TYPE_OPTIONS = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_permit", label: "Driving permit" },
];

const B = (section: ChannelsField["section"], path: ChannelsConfigPath, label: string, hint: string, def: boolean): ChannelsField => ({ section, path, label, hint, kind: "bool", default: def });
const N = (section: ChannelsField["section"], path: ChannelsConfigPath, label: string, hint: string, def: number, min: number, max: number, unit?: string, step?: number): ChannelsField => ({ section, path, label, hint, kind: "int", default: def, min, max, unit, step });

export const CHANNELS_FIELDS: ChannelsField[] = [
  B("master", "enabled", "Channels", "The master switch. When off, channels, creator posts and everything below are hidden. Store and other module posts in the Spotlight are not affected.", false),

  B("general", "general.channelsOpen", "Anyone can open a channel", "Any Peebee account can open or convert to a channel. Turn off to stop new channels.", true),
  B("general", "general.ageDeclarationRequired", "Ask for an age declaration", "A person confirms they meet the minimum age when opening a channel.", true),
  N("general", "general.minAge", "Minimum age to open a channel", "Years", 13, 0, 21),
  N("general", "general.handleMinLength", "Shortest handle", "Characters", 3, 2, 10),
  N("general", "general.handleMaxLength", "Longest handle", "Characters", 30, 10, 50),
  N("general", "general.handleChangeDays", "Days between handle changes", "0 lets a creator change it at any time", 30, 0, 365, "days"),
  { section: "general", path: "general.reservedHandles", label: "Reserved handles", hint: "Comma separated words nobody can use as a handle", kind: "text", default: "admin,peebee,support,official,help,staff,moderator,team,security,billing,news", maxLength: 1000 },
  N("general", "general.maxBioChars", "Longest bio", "Characters", 300, 50, 2000),
  N("general", "general.maxLinks", "Links on a channel", "Most links a creator can add to their profile", 5, 0, 20),
  B("general", "general.sitemapEnabled", "List channels for search engines", "Public channels and causes appear in the sitemap", true),

  B("publishing", "publishing.personalPosting", "Accounts without a channel can post", "A lightweight personal profile lets any account publish to the Spotlight", true),
  { section: "publishing", path: "publishing.publishers", label: "Publishers that can post to the Spotlight", hint: "Which parts of Peebee may publish into the shared feed", kind: "multi", default: ["channel", "store", "restaurant", "learn", "driver"], options: PUBLISHER_OPTIONS },
  { section: "publishing", path: "publishing.postTypes", label: "Post types allowed", hint: "Live and audio are off until you are ready for them", kind: "multi", default: ["video", "image", "carousel", "text"], options: POST_TYPE_OPTIONS },
  N("publishing", "publishing.postsPerDay", "Posts per day per publisher", "", 20, 1, 500),
  N("publishing", "publishing.maxCaptionChars", "Longest caption", "Characters", 2200, 50, 20000),
  N("publishing", "publishing.maxCarouselImages", "Images in a carousel", "", 10, 2, 30),
  N("publishing", "publishing.maxPollOptions", "Poll options", "", 4, 2, 10),
  N("publishing", "publishing.maxTags", "Tags per post", "", 10, 0, 30),
  N("publishing", "publishing.maxImageMb", "Largest image", "MB", 8, 1, 20, "MB"),
  N("publishing", "publishing.maxAudioMb", "Largest audio file", "MB (100 MB is the most the platform accepts)", 25, 1, 100, "MB"),
  B("publishing", "publishing.schedulingEnabled", "Scheduling", "Creators can schedule posts for later", true),
  B("publishing", "publishing.driverBlockWhileOnJob", "Drivers cannot post during a job", "A driver with an active trip or delivery cannot publish", true),
  B("publishing", "publishing.commentsEnabled", "Comments", "People can comment on posts", true),
  B("publishing", "publishing.reactionsEnabled", "Likes", "People can like posts", true),
  N("publishing", "publishing.commentsPerHour", "Comments per person per hour", "", 30, 1, 500),
  N("publishing", "publishing.maxCommentChars", "Longest comment", "Characters", 500, 20, 5000),

  { section: "moderation", path: "moderation.mode", label: "When posts are checked", hint: "After: posts show at once and are reviewed if reported. Before: every post waits for staff approval.", kind: "enum", default: "after", options: [{ value: "after", label: "After they show" }, { value: "before", label: "Before they show" }] },
  N("moderation", "moderation.reviewFirstPosts", "New publishers: posts reviewed first", "The first posts of a new publisher wait for approval whatever the setting above. 0 turns it off.", 3, 0, 50),
  N("moderation", "moderation.autoHideAtReports", "Hide a post after this many reports", "The post goes to review. 0 turns it off.", 5, 0, 100),
  N("moderation", "moderation.reportsPerDay", "Reports per person per day", "", 20, 1, 200),
  { section: "moderation", path: "moderation.blockedWords", label: "Blocked words", hint: "Comma separated. A post or comment containing one is held for review.", kind: "text", default: "", maxLength: 4000 },

  N("ranking", "ranking.pageSize", "Posts per page", "", 10, 5, 30),
  N("ranking", "ranking.followedBoost", "Boost for accounts someone follows", "Points added to a followed channel's posts", 50, 0, 100),
  N("ranking", "ranking.recencyWeight", "How much newness counts", "", 30, 0, 100),
  N("ranking", "ranking.engagementWeight", "How much likes and comments count", "", 20, 0, 100),
  N("ranking", "ranking.recencyHours", "Hours until a post is considered old", "", 72, 1, 720, "hours"),
  N("ranking", "ranking.storeWeight", "Store posts weight", "100 is normal; lower shows them less", 100, 0, 300),
  N("ranking", "ranking.channelWeight", "Channel posts weight", "", 100, 0, 300),
  N("ranking", "ranking.otherWeight", "Other posts weight", "Restaurants, schools, drivers and personal profiles", 100, 0, 300),

  B("monetization", "monetization.enabled", "Money from audiences", "The master switch for memberships, paid posts, tips and gifts. Off until licensed.", false),
  B("monetization", "monetization.memberships", "Memberships", "Creators can sell monthly memberships", true),
  B("monetization", "monetization.payPerView", "Pay-per-view posts", "Creators can charge for single posts", true),
  B("monetization", "monetization.tips", "Tips", "People can tip a creator", true),
  B("monetization", "monetization.gifts", "Gifts", "People can send gifts on posts and live streams", true),
  { section: "monetization", path: "monetization.giftOptions", label: "Gift menu", hint: "Name:price pairs, comma separated, for example Rose:1000,Star:5000", kind: "text", default: "Rose:1000,Star:5000,Crown:20000", maxLength: 500 },
  N("monetization", "monetization.maxTiers", "Tiers per channel", "", 3, 1, 10),
  N("monetization", "monetization.minTierPriceUgx", "Cheapest tier", "UGX", 1000, 100, 10000000, "UGX", 100),
  N("monetization", "monetization.maxTierPriceUgx", "Dearest tier", "UGX", 500000, 1000, 100000000, "UGX", 1000),
  N("monetization", "monetization.minPayPerViewUgx", "Cheapest paid post", "UGX", 500, 100, 10000000, "UGX", 100),
  N("monetization", "monetization.maxPayPerViewUgx", "Dearest paid post", "UGX", 100000, 1000, 100000000, "UGX", 1000),
  N("monetization", "monetization.minTipUgx", "Smallest tip", "UGX", 500, 100, 1000000, "UGX", 100),
  N("monetization", "monetization.maxTipUgx", "Largest tip", "UGX", 500000, 1000, 100000000, "UGX", 1000),
  N("monetization", "monetization.maxPreviewSeconds", "Longest free preview", "Seconds a locked video can show before the unlock prompt. 0 turns previews off.", 60, 0, 600, "seconds"),
  N("monetization", "monetization.previewCooldownMinutes", "Wait between previews", "A viewer gets one preview of a locked post in this window", 60, 0, 1440, "minutes"),
  B("monetization", "monetization.membersGetPayPerViewFree", "Members watch paid posts free", "Any paying member of a channel also gets its pay-per-view posts", false),
  B("monetization", "monetization.earningsToWalletEnabled", "Creators can move earnings to their wallet", "Spend inside Peebee without an ID check. Cash withdrawal still needs verification.", true),
  N("monetization", "monetization.membershipCutPercent", "Peebee's cut of memberships", "Percent", 15, 0, 90, "%"),
  N("monetization", "monetization.payPerViewCutPercent", "Peebee's cut of paid posts", "Percent", 20, 0, 90, "%"),
  N("monetization", "monetization.tipCutPercent", "Peebee's cut of tips", "Percent", 10, 0, 90, "%"),
  N("monetization", "monetization.giftCutPercent", "Peebee's cut of gifts", "Percent", 10, 0, 90, "%"),

  B("kyc", "kyc.required", "Verification before withdrawing", "People must pass an ID check before they can withdraw cash. Never asked at sign-up or when opening a channel.", true),
  B("kyc", "kyc.withdrawalsEnabled", "Cash withdrawals", "The master switch for paying creators out. Off until licensed.", false),
  N("kyc", "kyc.minWithdrawUgx", "Smallest withdrawal", "UGX", 5000, 100, 100000000, "UGX", 500),
  N("kyc", "kyc.maxWithdrawUgx", "Largest single withdrawal", "UGX", 5000000, 1000, 1000000000, "UGX", 1000),
  N("kyc", "kyc.dailyCapUgx", "Daily withdrawal cap", "UGX per person. 0 means no cap.", 5000000, 0, 1000000000, "UGX", 1000),
  N("kyc", "kyc.monthlyCapUgx", "Monthly withdrawal cap", "UGX per person. 0 means no cap.", 50000000, 0, 10000000000, "UGX", 1000),
  N("kyc", "kyc.minAgeToWithdraw", "Minimum age to withdraw", "Years, checked against the verified date of birth", 18, 0, 25),
  B("kyc", "kyc.requireSelfie", "Selfie required", "", true),
  B("kyc", "kyc.requireIdBack", "Back of the ID required", "", false),
  { section: "kyc", path: "kyc.idTypes", label: "Accepted ID types", hint: "", kind: "multi", default: ["national_id", "passport", "driving_permit"], options: ID_TYPE_OPTIONS },
  N("kyc", "kyc.payoutAccountCooldownDays", "Wait after changing a payout account", "Days before the new account can receive a withdrawal", 3, 0, 30, "days"),
  N("kyc", "kyc.reverifyDays", "Re-verify every", "Days. 0 means never.", 0, 0, 3650, "days"),
  N("kyc", "kyc.maxDocumentMb", "Largest document photo", "MB", 6, 1, 15, "MB"),

  B("causes", "causes.enabled", "Causes", "The master switch for fundraising. Off until licensed.", false),
  B("causes", "causes.requireApproval", "Staff approve every cause", "A cause is not public until a staff member approves it", true),
  N("causes", "causes.requireKycAboveGoalUgx", "Verification before going live above", "UGX goal. A creator must be verified before a larger cause goes live. 0 means never.", 10000000, 0, 10000000000, "UGX", 100000),
  N("causes", "causes.minGoalUgx", "Smallest goal", "UGX", 10000, 1000, 1000000000, "UGX", 1000),
  N("causes", "causes.maxGoalUgx", "Largest goal", "UGX", 100000000, 10000, 100000000000, "UGX", 100000),
  N("causes", "causes.minDays", "Shortest campaign", "Days", 1, 1, 90, "days"),
  N("causes", "causes.maxDays", "Longest campaign", "Days", 90, 1, 365, "days"),
  N("causes", "causes.maxActivePerChannel", "Live causes per channel", "", 3, 1, 20),
  B("causes", "causes.allowAllOrNothing", "Allow all-or-nothing", "A creator may choose to refund everyone if the goal is missed", false),
  { section: "causes", path: "causes.defaultFundingMode", label: "If the goal is missed", hint: "Keep what is raised, or refund everyone", kind: "enum", default: "keep", options: [{ value: "keep", label: "Keep what is raised" }, { value: "all_or_nothing", label: "Refund everyone" }] },
  { section: "causes", path: "causes.releaseMode", label: "When money is released", hint: "Anytime: the creator may withdraw as donations arrive (after verification). At the end: only once the cause ends.", kind: "enum", default: "anytime", options: [{ value: "anytime", label: "Anytime after verification" }, { value: "on_end", label: "Only when the cause ends" }] },
  N("causes", "causes.holdDays", "Days a donation is held", "Before it can be released, in case of fraud reports", 2, 0, 30, "days"),
  B("causes", "causes.guestDonations", "Donate without an account", "Public links accept gifts from people who are not signed in", true),
  B("causes", "causes.donorTipEnabled", "Optional tip to Peebee", "Donors can add a tip to Peebee at checkout", true),
  N("causes", "causes.minDonationUgx", "Smallest donation", "UGX", 1000, 100, 10000000, "UGX", 100),
  N("causes", "causes.maxDonationUgx", "Largest donation", "UGX", 5000000, 1000, 1000000000, "UGX", 1000),
  B("causes", "causes.allowAnonymous", "Anonymous donations", "Donors may hide their name", true),
  B("causes", "causes.allowWalletPayment", "Pay from wallet", "", true),
  B("causes", "causes.allowMobileMoney", "Pay by mobile money", "", true),
  B("causes", "causes.updatesEnabled", "Cause updates", "Creators can post updates to donors", true),
  B("causes", "causes.donorWallVisible", "Show the donor wall", "Names and amounts of donors who chose to be shown", true),
  B("causes", "causes.reviewEditsAfterApproval", "Review changes to live causes", "A material edit sends the cause back for approval", true),
  N("causes", "causes.donationCutPercent", "Peebee's cut of donations", "Percent", 0, 0, 50, "%"),

  B("live", "live.enabled", "Going live", "People can go live from their phone camera. Off until a live-capable video provider is set up. Live streams are never locked and never carry ads.", false),
  N("live", "live.minFollowers", "Followers needed to go live", "0 lets any publisher go live", 0, 0, 100000),
  N("live", "live.maxMinutes", "Longest live stream", "The stream ends by itself after this long", 120, 5, 720, "minutes"),
  N("live", "live.maxPerDay", "Live streams per publisher per day", "", 5, 1, 50),
  B("live", "live.commentsEnabled", "Live comments", "Viewers can comment while a stream is on", true),
  N("live", "live.maxCommentChars", "Longest live comment", "Characters", 200, 20, 1000),
  N("live", "live.commentCooldownSeconds", "Seconds between one person's comments", "Slows spam during a stream", 2, 0, 60, "seconds"),
  B("live", "live.helperEnabled", "Helper device", "The host can open the stream on a second device (or give a code to a helper) to read comments, hide or pin them", true),
  N("live", "live.helperCodeMinutes", "How long a helper code works", "", 120, 5, 720, "minutes"),
  B("live", "live.showViewerCount", "Show viewer count to everyone", "Off shows the count to the host only", true),
  B("live", "live.showInSpotlight", "Show live streams in the Spotlight", "Off keeps them on the host's channel page", true),
  B("live", "live.requireVerifiedPublisher", "Only verified publishers can go live", "A verified badge is given by staff", false),
  B("live", "live.broadcastsEnabled", "Broadcasts", "A channel can air pre-recorded videos back to back at a set time, like a TV station. Viewers all watch the same moment, with live chat.", false),
  B("live", "live.premieresEnabled", "Premieres", "A channel can premiere a video: a countdown, everyone watching it together the first time with live chat, then it stays up as a normal video.", false),
  N("live", "live.maxProgramItems", "Videos in one broadcast", "", 12, 1, 100),
  N("live", "live.maxProgramMinutes", "Longest broadcast", "Total running time of all its videos", 480, 5, 1440, "minutes"),
  N("live", "live.minLeadMinutes", "Least notice before an airing", "A broadcast or premiere cannot start sooner than this. 0 allows starting straight away.", 2, 0, 1440, "minutes"),
  N("live", "live.maxLeadDays", "Furthest ahead an airing can be scheduled", "", 30, 1, 365, "days"),
  N("live", "live.maxUpcomingPerPublisher", "Upcoming airings per publisher", "Broadcasts and premieres waiting to start", 10, 1, 100),
  B("live", "live.remindersEnabled", "Reminders", "People can tap Remind me and get a notification when an airing starts", true),
  B("live", "live.notifyFollowersOnAir", "Notify followers when a broadcast or premiere starts", "Sends a notification to a channel's followers (up to 500). Off by default to keep notifications rare.", false),

  B("rewards", "rewards.enabled", "Rewards", "The master switch for points and cash-outs. Needs a rate (below) before anything is paid. Off until licensed.", false),
  N("rewards", "rewards.qualifiedViewSeconds", "Seconds watched for a view to count", "", 3, 1, 60, "seconds"),
  N("rewards", "rewards.qualifiedViewsPerViewerPerHour", "Counted views per viewer per hour", "A fraud guard", 30, 1, 1000),
  N("rewards", "rewards.pointsPerQualifiedView", "Points per counted view", "", 1, 1, 100),
  B("rewards", "rewards.countAnonymousViews", "Count views from people not signed in", "Easier to farm. Off is safer.", false),
  { section: "rewards", path: "rewards.rateLock", label: "Which rate applies", hint: "At earning: points keep the rate they were earned at. At cash-out: all points use the rate on the day.", kind: "enum", default: "at_earn", options: [{ value: "at_earn", label: "The rate when earned" }, { value: "at_cashout", label: "The rate at cash-out" }] },
  N("rewards", "rewards.minCashoutPoints", "Fewest points to cash out", "", 1000, 1, 10000000),
  N("rewards", "rewards.cashoutCooldownDays", "Days between cash-outs", "", 7, 0, 90, "days"),
  N("rewards", "rewards.monthlyBudgetUgx", "Monthly budget for all creators", "UGX. When it runs out, cash-outs are scaled down. 0 means no budget.", 0, 0, 100000000000, "UGX", 100000),
  N("rewards", "rewards.monthlyCapPerCreatorUgx", "Monthly cap per creator", "UGX. 0 means no cap.", 0, 0, 10000000000, "UGX", 10000),
  B("rewards", "rewards.adShareEnabled", "Credit creators their share of ad revenue", "Moves each creator's share of ads on their videos into their earnings", true),
];

function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function setAt(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== "object") o[k] = {};
    o = o[k] as Record<string, unknown>;
  }
  o[keys[keys.length - 1]!] = value;
}

function coerce(field: ChannelsField, raw: unknown): unknown {
  switch (field.kind) {
    case "bool":
      return typeof raw === "boolean" ? raw : field.default;
    case "int":
      return typeof raw === "number" && Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : field.default;
    case "enum":
      return typeof raw === "string" && field.options.some((o) => o.value === raw) ? raw : field.default;
    case "multi": {
      if (!Array.isArray(raw)) return field.default;
      const allowed = new Set(field.options.map((o) => o.value));
      return [...new Set(raw.filter((v): v is string => typeof v === "string" && allowed.has(v)))];
    }
    case "text":
      return typeof raw === "string" ? raw.slice(0, field.maxLength) : field.default;
  }
}

/** Defaults for every field. */
export const DEFAULT_CHANNELS_CONFIG: ChannelsConfig = (() => {
  const out: Record<string, unknown> = {};
  for (const f of CHANNELS_FIELDS) setAt(out, f.path, Array.isArray(f.default) ? [...f.default] : f.default);
  return out as ChannelsConfig;
})();

/** Turns anything stored or submitted into a complete, in-range config. Unknown keys are dropped. */
export function sanitizeChannelsConfig(input: unknown): ChannelsConfig {
  const out: Record<string, unknown> = {};
  for (const f of CHANNELS_FIELDS) setAt(out, f.path, coerce(f, getAt(input, f.path)));
  const cfg = out as ChannelsConfig;
  // Structural rails: ranges that make sense only together.
  if (cfg.general.handleMaxLength < cfg.general.handleMinLength) cfg.general.handleMaxLength = cfg.general.handleMinLength;
  if (cfg.monetization.maxTierPriceUgx < cfg.monetization.minTierPriceUgx) cfg.monetization.maxTierPriceUgx = cfg.monetization.minTierPriceUgx;
  if (cfg.monetization.maxPayPerViewUgx < cfg.monetization.minPayPerViewUgx) cfg.monetization.maxPayPerViewUgx = cfg.monetization.minPayPerViewUgx;
  if (cfg.monetization.maxTipUgx < cfg.monetization.minTipUgx) cfg.monetization.maxTipUgx = cfg.monetization.minTipUgx;
  if (cfg.causes.maxGoalUgx < cfg.causes.minGoalUgx) cfg.causes.maxGoalUgx = cfg.causes.minGoalUgx;
  if (cfg.causes.maxDays < cfg.causes.minDays) cfg.causes.maxDays = cfg.causes.minDays;
  if (cfg.causes.maxDonationUgx < cfg.causes.minDonationUgx) cfg.causes.maxDonationUgx = cfg.causes.minDonationUgx;
  if (cfg.kyc.maxWithdrawUgx < cfg.kyc.minWithdrawUgx) cfg.kyc.maxWithdrawUgx = cfg.kyc.minWithdrawUgx;
  if (!cfg.causes.allowAllOrNothing && cfg.causes.defaultFundingMode === "all_or_nothing") cfg.causes.defaultFundingMode = "keep";
  return cfg;
}

/** Applies a partial change (dotted paths or nested) on top of a config and re-validates. */
export function mergeChannelsConfig(base: ChannelsConfig, patch: unknown): ChannelsConfig {
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(base));
  for (const f of CHANNELS_FIELDS) {
    const v = getAt(patch, f.path);
    if (v !== undefined) setAt(merged, f.path, v);
  }
  return sanitizeChannelsConfig(merged);
}

/** "Rose:1000,Star:5000" → [{name, priceUgx}] */
export function parseGiftOptions(raw: string): { name: string; priceUgx: number }[] {
  return raw
    .split(",")
    .map((part) => part.trim().split(":"))
    .map(([name, price]) => ({ name: (name ?? "").trim().slice(0, 24), priceUgx: Math.round(Number(price)) }))
    .filter((g) => g.name && Number.isFinite(g.priceUgx) && g.priceUgx > 0)
    .slice(0, 12);
}

export function parseWordList(raw: string): string[] {
  return raw.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
}
