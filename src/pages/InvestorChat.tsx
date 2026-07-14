import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { 
  Send, Users, Pin, VolumeX, ShieldAlert, ShieldCheck, 
  Bell, X, Search, ChevronDown, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { notifyUser, sendEmailToUser } from '../lib/notify';
import { HUMAN_MSGS, HUMAN_TOPIC_TEMPLATES, CURATED_TOPICS, PROCEDURAL_TOPICS } from './investorChatCorpus';

interface InvestorChatMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_country: string;
  body: string;
  is_pinned: boolean;
  reply_to_id: string | null;
  created_at: string;
  sender_email?: string;
  profiles?: { email: string } | null;
  // UI helper for replies
  reply_to_name?: string;
  reply_to_body?: string;
}

interface BannedUser {
  id: string;
  user_name: string;
  admin_id: string | null;
  created_at: string;
}

interface FollowedUser {
  id: string;
  admin_id: string;
  target_name: string;
  created_at: string;
  last_seen?: string | null;
  is_real?: boolean;
}

// 194 ISO Country Codes
const COUNTRIES = [
  "US", "GB", "DE", "AE", "JP", "IN", "RU", "CA", "BR", "NG", "ZA", "AU", "SG", "CH", "FR", "NZ", "HK", "ES", "IT", "NL",
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT", "BO",
  "BA", "BW", "BN", "BG", "BF", "BI", "KH", "CM", "CV", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD", "CR", "CI", "HR",
  "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI", "GA", "GM", "GE",
  "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "ID", "IR", "IQ", "IE", "IL", "JM", "JO", "KZ", "KE",
  "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT",
  "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM", "NA", "NR", "NP", "NI", "NE", "NO", "OM", "PK",
  "PW", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS",
  "SC", "SL", "SK", "SI", "SB", "SO", "LK", "SD", "SR", "SE", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN",
  "TR", "TM", "TV", "UG", "UA", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM", "ZW"
];

// Helper to translate country code to Unicode Flag Emoji
const getCountryFlag = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '🌐';
  }
};

// Procedural country flags mapping index
const COUNTRY_FLAGS = COUNTRIES.reduce((acc, code) => {
  acc[code] = getCountryFlag(code);
  return acc;
}, {} as Record<string, string>);

// 60,000 unique realistic usernames — 300 first names × 200 last-name-style tags
// Each name looks like a real handle a person would choose on a chat platform
const PROCEDURAL_USERNAMES = (() => {
  const firsts = [
    "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
    "christopher","daniel","matthew","anthony","mark","donald","steven","paul","andrew","joshua",
    "kenneth","kevin","brian","george","timothy","ronald","edward","jason","jeffrey","ryan",
    "jacob","gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon",
    "benjamin","samuel","raymond","frank","gregory","alexander","patrick","jack","dennis","jerry",
    "tyler","aaron","henry","jose","adam","douglas","nathan","peter","zachary","kyle",
    "walter","harold","carl","jeremy","keith","roger","gerald","christian","terry","sean",
    "austin","arthur","lawrence","noah","jesse","joe","bryan","billy","jordan","albert",
    "dylan","bruce","willie","alan","elijah","wayne","roy","juan","eugene","randy",
    "mason","louis","philip","bobby","johnny","bradley","sarah","jessica","emily","ashley",
    "jennifer","amanda","stephanie","melissa","nicole","elizabeth","helen","dorothy","sandra","donna",
    "carol","ruth","sharon","michelle","laura","kimberly","deborah","dorothy","lisa","nancy",
    "karen","betty","helen","anna","margaret","amber","pamela","rachel","samantha","alice",
    "marie","heather","julia","cynthia","diane","angela","kathryn","julia","joyce","virginia",
    "mia","charlotte","isabella","sofia","ava","luna","aria","zoey","penelope","layla",
    "riley","nora","lily","eleanor","hannah","lillian","addison","aubrey","ellie","stella",
    "natalie","zoe","leah","hazel","violet","aurora","savannah","audrey","brooklyn","bella",
    "claire","skylar","lucy","paisley","everly","anna","caroline","genesis","aaliyah","kennedy",
    "ora","nova","maya","willow","kinsley","naomi","alexis","ariana","elena","cathleen",
    "liam","oliver","ethan","aiden","lucas","caden","grayson","jackson","sebastian","julian",
    "ezra","mateo","leo","jayden","elias","jaxon","brayden","gabriel","lincoln","owen",
    "kaito","yuki","takeshi","hiroshi","kenji","akira","riku","haruto","sora","daiki",
    "wei","lei","fang","ming","chen","hui","jing","xin","yang","tao",
    "omar","hassan","ali","khalid","ahmed","ibrahim","yusuf","ismail","tariq","sameer",
    "raj","priya","arjun","kavya","rohit","ananya","vivek","pooja","manish","shreya",
    "dmitri","ivan","aleksei","nikolai","mikhail","boris","sergei","andrei","vadim","kirill",
    "sofia","lena","anastasia","katerina","olga","irina","natasha","polina","daria","yulia",
    "lorenzo","marcello","sandro","giovanni","luigi","paolo","vincenzo","stefano","claudio","fabio",
    "mathias","ludvig","rasmus","mikkel","magnus","emil","oskar","hugo","lukas_k","lucas_v",
    "chloe_f","elise_m","clara_g","emma_h","sophie_d","zoey_e","mia_r","ava_s","luna_t","lola_u"
  ];
  const tags = [
    "trades","holds","stacks","invests","wins","hodls","builds","earns","saves","grows",
    "btc","eth","defi","nft","dao","yield","stake","swap","bull","bear",
    "real","daily","passive","smart","crypto","alpha","beta","degen","ape","moon",
    "pro","vip","plus","max","ultra","prime","elite","club","squad","gang",
    "x","xyz","777","888","999","101","247","365","100","420",
    "official","real","verified","legit","trusted","safe","solid","base","core","root",
    "london","dubai","tokyo","nyc","paris","berlin","miami","lagos","sg","hk",
    "fx","rei","cap","mgmt","fund","hq","labs","works","io","fi",
    "23","24","25","88","99","00","01","7","77","2025",
    "one","two","three","go","now","fast","live","up","on","in",
    "reads","cooks","bakes","hikes","bikes","swims","runs","climbs","games","codes",
    "paints","writes","travels","explores","dreams","grinds","hustles","thrives","rises","shines",
    "vibes","chills","jams","rocks","grooves","flows","soars","wanders","roams","ventures",
    "forever","always","truly","simply","freely","boldly","quietly","loudly","gently","kindly",
    "junior","senior","original","classic","modern","vintage","retro","fresh","raw","genuine",
    "north","south","east","west","central","uptown","downtown","midtown","coastal","highland",
    "papa","mama","auntie","uncle","og","jr","sr","esq","doc","chief",
    "fit","strong","active","calm","bold","brave","kind","wise","sharp","steady",
    "star","spark","flame","storm","wave","river","stone","forest","summit","horizon",
    "52","63","74","85","96","07","13","19","31","42"
  ];

  const list: { name: string; country: string }[] = [];
  let idx = 0;
  for (const first of firsts) {
    for (const tag of tags) {
      const country = COUNTRIES[idx % COUNTRIES.length];
      // Vary separators and capitalisation so names look genuinely unique
      const sep = idx % 4 === 0 ? '_' : idx % 4 === 1 ? '.' : idx % 4 === 2 ? '-' : '';
      const cap = idx % 5 === 0 ? first.charAt(0).toUpperCase() + first.slice(1) : first;
      list.push({ name: `${cap}${sep}${tag}`, country });
      idx++;
    }
  }
  return list;
})();

const SIMULATED_USERS = PROCEDURAL_USERNAMES;

// ─────────────────────────────────────────────────────────────────────────────
// 50,000-pool human-sounding messages across 10 conversation categories.
// Written as FULL SENTENCES a real person would type in a group chat —
// including typos, abbreviations, reactions, casual register and natural flow.
// ─────────────────────────────────────────────────────────────────────────────

// Category A — genuine investment reactions (casual, personal)
const ALL_MSGS = HUMAN_MSGS;

const REPLY_STARTERS = [
  "yeah,", "honestly,", "same here,", "true,", "lol,", "ngl,", "wait,",
  "fr though,", "exactly,", "right?", "hmm,", "fair,", "yeah ngl,", "oof,",
  "haha", "oh wow,", "no way,", "ok so,", "wait actually,", "for real,",
  "solid point,", "good shout,", "that's wild,", "kind of agree,",
  "depends really but", "personally i think", "from my experience,",
  "not gonna lie,", "to be honest,", "i mean,", "yeah but also,",
  "@{name} yeah,", "@{name} honestly,", "@{name} same,", "@{name} true,",
  "@{name} agreed,", "@{name} lol same,", "@{name} ngl,", "@{name} fair point,",
];

// Fisher-Yates shuffle, used to build the rotating "no repeats for a while"
// draw pools for simulated posters/messages/topic templates.
const shuffleArray = <T,>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Sentence shapes used when a topic is actively selected by an admin — these
// weave the exact topic name (a property, staking plan, or current event) into
// the message so the simulated room actually looks like it's discussing it.
const TOPIC_TEMPLATES = HUMAN_TOPIC_TEMPLATES;

// Helper to get active topic string
const getActiveTopic = (topicSetting: string, topics: string[]): string | undefined => {
  if (!topicSetting) return undefined;
  if (topicSetting === "__random__") {
    if (topics.length === 0) return undefined;
    return topics[Math.floor(Math.random() * topics.length)];
  }
  if (topicSetting.includes(',')) {
    const parts = topicSetting.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[Math.floor(Math.random() * parts.length)];
    }
  }
  return topicSetting;
};

// Helper to generate consistent avatars
const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-orange-600',
  'from-red-500 to-rose-600',
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600'
];

// Telegram-style: each sender gets a consistent distinct color for their name
const NAME_COLORS = [
  'text-[#E17076]', // red
  'text-[#7BC862]', // green
  'text-[#65AADD]', // blue
  'text-[#FF7F50]', // orange
  'text-[#A695E7]', // purple
  'text-[#7EC4CF]', // teal
  'text-[#E5CA77]', // yellow
  'text-[#EF7BA3]', // pink
];
const getNameColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
};

export default function InvestorChat() {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<InvestorChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [systemTopics, setSystemTopics] = useState<string[]>([]);

  useEffect(() => {
    const loadSystemTopics = async () => {
      const topics: string[] = [...CURATED_TOPICS];
      try {
        const { data: props } = await supabase.from('properties').select('title');
        if (props) {
          props.forEach(p => {
            if (p.title) topics.push(p.title);
          });
        }
        const { data: stakings } = await supabase.from('staking_products').select('name');
        if (stakings) {
          stakings.forEach(s => {
            if (s.name) topics.push(s.name);
          });
        }
      } catch (e) {
        console.error("Failed to fetch system topics", e);
      }
      setSystemTopics(topics);
    };
    loadSystemTopics();
  }, []);
  
  // Real-time dynamic user count — seeded by time of day, 1M-4M range
  const [onlineCount, setOnlineCount] = useState(() => {
    // Base count varies by hour of day (peak midday UTC, trough 3-5am UTC)
    const hour = new Date().getUTCHours();
    // Sine wave: peak ~3.2M at 14:00 UTC, trough ~1.1M at 04:00 UTC
    const base = 2_150_000 + Math.sin(((hour - 4) / 24) * 2 * Math.PI) * 1_050_000;
    // Add ±80k random jitter so each load feels fresh
    const jitter = Math.floor((Math.random() - 0.5) * 160_000);
    return Math.round(base + jitter);
  });

  // Telegram-like Pinned Message
  const [pinnedMessage, setPinnedMessage] = useState<InvestorChatMessage | null>(null);

  // Impersonation state (Admin only)
  const [impersonatedUser, setImpersonatedUser] = useState<{ name: string; country: string } | null>(null);
  
  // Banned users state (synced with DB)
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  
  // Followed users state (Admin only, synced with DB)
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [simSpeedMs, setSimSpeedMs] = useState<number>(() => Number(localStorage.getItem('rpm_chat_sim_speed') || '5000'));

  useEffect(() => {
    localStorage.setItem('rpm_chat_sim_speed', simSpeedMs.toString());
  }, [simSpeedMs]);
  
  const [followAlerts, setFollowAlerts] = useState<{ id: string; msg: InvestorChatMessage }[]>([]);

  // Admin custom scheduling states
  const [openAdminSections, setOpenAdminSections] = useState<Record<string, boolean>>({
    topic: true,
    countries: false,
    impersonate: false,
    speed: false,
    followed: false,
    bans: false,
  });

  const toggleAdminSection = (section: string) => {
    setOpenAdminSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [activeSimCountries, setActiveSimCountries] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('rpm_chat_active_countries') || '[]');
  });
  const [scheduledCountry, setScheduledCountry] = useState<string | null>(() => {
    return localStorage.getItem('rpm_chat_scheduled_country');
  });
  const [scheduledUntil, setScheduledUntil] = useState<string | null>(() => {
    return localStorage.getItem('rpm_chat_scheduled_until');
  });
  // The active discussion topic is a shared, platform-wide setting (stored in
  // the `settings` table, key 'investor_chat_topic') rather than a per-browser
  // localStorage value — otherwise it only ever affected the one browser that
  // set it (never what real investors actually saw), and any other admin
  // session/device/incognito window would show the hardcoded default.
  const [simCustomTopic, setSimCustomTopic] = useState<string>('');
  const [simTopicDraft, setSimTopicDraft] = useState<string>('');
  const [showOfflineNotice, setShowOfflineNotice] = useState(true);

  // Persist scheduling settings in localStorage
  useEffect(() => {
    localStorage.setItem('rpm_chat_active_countries', JSON.stringify(activeSimCountries));
  }, [activeSimCountries]);
  useEffect(() => {
    if (scheduledCountry) localStorage.setItem('rpm_chat_scheduled_country', scheduledCountry);
    else localStorage.removeItem('rpm_chat_scheduled_country');
  }, [scheduledCountry]);
  useEffect(() => {
    if (scheduledUntil) localStorage.setItem('rpm_chat_scheduled_until', scheduledUntil);
    else localStorage.removeItem('rpm_chat_scheduled_until');
  }, [scheduledUntil]);
  // Load the shared discussion-topic setting and stay in sync with it live,
  // so every viewer (admin or investor) sees whatever an admin last applied.
  useEffect(() => {
    const applyRow = (value: string | null | undefined) => {
      const topic = value || '';
      setSimCustomTopic(topic);
      setSimTopicDraft(topic);
    };

    supabase.from('settings').select('value').eq('key', 'investor_chat_topic').maybeSingle()
      .then(({ data }) => applyRow(data?.value));

    const channel = supabase
      .channel('investor_chat_topic_setting')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `key=eq.investor_chat_topic` }, (payload: any) => {
        applyRow(payload.new?.value);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Controlled state for admin panel uncontrolled inputs (prevents reset on re-render)
  const [schedCountrySelect, setSchedCountrySelect] = useState<string>(Object.keys({
    US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', NG: '🇳🇬', GH: '🇬🇭', ZA: '🇿🇦', KE: '🇰🇪',
  })[0] || 'US');
  const [schedHoursSelect, setSchedHoursSelect] = useState<number>(1);
  const [impersonateNameInput, setImpersonateNameInput] = useState('');
  const [impersonateCountryInput, setImpersonateCountryInput] = useState('US');

  // Shuffled sequence list ref for rotating posters. The random shuffle runs
  // inside a useState lazy initializer (React's sanctioned one-time-only
  // execution point) rather than directly in the render body, since the
  // render body itself must stay a pure function of props/state.
  const [initialShuffledUsers] = useState(() => shuffleArray(SIMULATED_USERS));
  const shuffledUsersRef = useRef(initialShuffledUsers);
  const simUserIndexRef = useRef(0);

  // Shuffled message pool — walking this sequentially (instead of striding
  // through the original template-ordered ALL_MSGS) avoids long runs of the
  // same template family showing up back-to-back in scrollback history.
  const [initialShuffledMsgs] = useState(() => shuffleArray(ALL_MSGS));
  const shuffledMsgsRef = useRef<string[] | null>(initialShuffledMsgs);
  const simMsgIndexRef = useRef(0);

  // Shuffled topic templates pool
  const [initialShuffledTopicTemplates] = useState(() => shuffleArray(TOPIC_TEMPLATES));
  const shuffledTopicTemplatesRef = useRef<string[] | null>(initialShuffledTopicTemplates);
  const simTopicTemplateIndexRef = useRef(0);

  // Track topic messages count to rotate topic after it runs its course
  const topicMessageCountRef = useRef(0);
  const [initialTopicThreshold] = useState(() => Math.floor(Math.random() * 16) + 15); // 15 to 30 messages
  const topicThresholdRef = useRef(initialTopicThreshold);

  // Helper to draw sequentially from message shuffle bag
  const drawNextBaseMessage = (): string => {
    if (!shuffledMsgsRef.current || shuffledMsgsRef.current.length === 0) {
      shuffledMsgsRef.current = shuffleArray(ALL_MSGS);
      simMsgIndexRef.current = 0;
    }

    const msg = shuffledMsgsRef.current[simMsgIndexRef.current];
    simMsgIndexRef.current++;

    // Seamlessly reshuffle and reset when we reach the end
    if (simMsgIndexRef.current >= shuffledMsgsRef.current.length) {
      shuffledMsgsRef.current = shuffleArray(ALL_MSGS);
      simMsgIndexRef.current = 0;
    }
    return msg;
  };

  // Helper to draw sequentially from topic template shuffle bag
  const drawNextTopicTemplate = (): string => {
    if (!shuffledTopicTemplatesRef.current || shuffledTopicTemplatesRef.current.length === 0) {
      shuffledTopicTemplatesRef.current = shuffleArray(TOPIC_TEMPLATES);
      simTopicTemplateIndexRef.current = 0;
    }

    const template = shuffledTopicTemplatesRef.current[simTopicTemplateIndexRef.current];
    simTopicTemplateIndexRef.current++;

    if (simTopicTemplateIndexRef.current >= shuffledTopicTemplatesRef.current.length) {
      shuffledTopicTemplatesRef.current = shuffleArray(TOPIC_TEMPLATES);
      simTopicTemplateIndexRef.current = 0;
    }
    return template;
  };

  const generateRandomMessage = (
    replyToName?: string,
    activeTopic?: string,
    isLive = false
  ): string => {
    let base: string;
    if (activeTopic && Math.random() < 0.7) {
      if (isLive) {
        const template = drawNextTopicTemplate();
        base = template.replace('{topic}', activeTopic);
      } else {
        const template = TOPIC_TEMPLATES[Math.floor(Math.random() * TOPIC_TEMPLATES.length)];
        base = template.replace('{topic}', activeTopic);
      }
    } else {
      if (isLive) {
        base = drawNextBaseMessage();
      } else {
        base = ALL_MSGS[Math.floor(Math.random() * ALL_MSGS.length)];
      }
    }

    if (replyToName && Math.random() > 0.3) {
      const starterTemplate = REPLY_STARTERS[Math.floor(Math.random() * REPLY_STARTERS.length)];
      const starter = starterTemplate.replace('{name}', replyToName);
      const lowerBase = base.charAt(0).toLowerCase() + base.slice(1);
      return `${starter} ${lowerBase}`;
    }
    return base;
  };

  // Resets the "how long has this topic been running" counter once it hits
  // its threshold. This used to also silently overwrite simCustomTopic with
  // a random pick — which meant a topic an admin explicitly set (or "discuss
  // random"/a curated multi-topic list, which already vary per-message via
  // getActiveTopic) would get clobbered on its own a few messages later.
  // Whatever the admin set now stays exactly as set until they change it.
  const resetTopicCounter = () => {
    topicMessageCountRef.current = 0;
    topicThresholdRef.current = Math.floor(Math.random() * 16) + 15;
  };

  // Reply target message state
  const [replyTarget, setReplyTarget] = useState<InvestorChatMessage | null>(null);

  // Keep track of simulated user post timestamps to enforce "twice a day (24h)" limit
  const userPostTimesRef = useRef<Record<string, number[]>>({});

  const canUserPost = (username: string): boolean => {
    const now = Date.now();
    const times = userPostTimesRef.current[username] || [];
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentTimes = times.filter(t => t > oneDayAgo);
    userPostTimesRef.current[username] = recentTimes;
    return recentTimes.length < 2;
  };

  const recordUserPost = (username: string) => {
    const times = userPostTimesRef.current[username] || [];
    times.push(Date.now());
    userPostTimesRef.current[username] = times;
  };

  // Trigger alert if current user is tagged or replied to
  const checkAndAlertMentions = (msg: InvestorChatMessage) => {
    if (!profile || msg.sender_id === profile.id || msg.sender_name === 'System') return;

    const myName = profile.name?.toLowerCase() || '';
    const myUsername = myName.replace(/\s+/g, '_');
    const bodyText = msg.body.toLowerCase();

    const isTagged = myName && (
      bodyText.includes(`@${myName}`) || 
      (myUsername && bodyText.includes(`@${myUsername}`))
    );

    const isReplied = msg.reply_to_name && (
      msg.reply_to_name.toLowerCase() === myName ||
      msg.reply_to_name.toLowerCase() === myUsername
    );

    if (isTagged || isReplied) {
      toast(isTagged ? `You were tagged by @${msg.sender_name}` : `Reply from @${msg.sender_name}`, {
        description: msg.body.substring(0, 60) + (msg.body.length > 60 ? '...' : ''),
        action: {
          label: "View",
          onClick: () => {
            const el = document.getElementById(`msg-${msg.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('!bg-[#2b5278]/20');
              setTimeout(() => el.classList.remove('!bg-[#2b5278]/20'), 2000);
            }
          }
        },
        duration: 6000
      });

      // Persist so the Investor Chat nav badge (Layout.tsx) reflects this
      // even when the user isn't currently on the page.
      notifyUser({
        userId: profile.id,
        title: isTagged ? 'You were mentioned in Investor Chat' : 'New reply in Investor Chat',
        message: `@${msg.sender_name}: ${msg.body.substring(0, 80)}${msg.body.length > 80 ? '...' : ''}`,
        type: 'info',
        link: '/app/investor-chat'
      });
    }
  };

  // Scroll details for virtual scrollback
  const [virtualHistoryCount, setVirtualHistoryCount] = useState(40);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Clear the Investor Chat nav badge (mentions, replies, and — for admins —
  // followed-user alerts) the moment the user actually opens this page.
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('link', '/app/investor-chat')
      .eq('read', false)
      .then(() => {});
  }, [profile?.id]);

  // Fetch initial db entries and setup real-time channels
  useEffect(() => {
    fetchBannedUsers();
    fetchFollowedUsers();
    fetchInitialMessages();

    // Setup realtime subscription
    const messagesChannel = supabase
      .channel('investor_chat_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'investor_chat_messages' },
        async (payload) => {
          const newMsg = payload.new as InvestorChatMessage;
          
          // Reply details are already populated in newMsg from database insert columns

          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Check if current user is tagged or responded to
          checkAndAlertMentions(newMsg);

          // Check if followed user posted (Admin alert)
          if (profile?.is_admin) {
            const isFollowed = followedUsersRef.current.some(f => f.target_name.toLowerCase() === newMsg.sender_name.toLowerCase());
            if (isFollowed && newMsg.sender_id !== profile.id) {
              toast(`Followed User Alert`, {
                description: `${newMsg.sender_name} posted: "${newMsg.body.substring(0, 40)}..."`,
                action: {
                  label: "View",
                  onClick: () => {
                    const el = document.getElementById(`msg-${newMsg.id}`);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              });
              // Persisted notification + push is dispatched server-side (a
              // Postgres trigger on investor_chat_messages insert),
              // independent of any admin tab being open; this toast is just
              // for immediate feedback while this page happens to be open.
              // Append to follow alerts log
              setFollowAlerts(prev => [...prev, { id: newMsg.id, msg: newMsg }]);
            }
          }

          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'investor_chat_messages' },
        (payload) => {
          const updated = payload.new as InvestorChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          if (updated.is_pinned) {
            setPinnedMessage(updated);
          } else {
            setPinnedMessage(prev => prev?.id === updated.id ? null : prev);
          }
        }
      )
      .subscribe();

    const bannedChannel = supabase
      .channel('investor_chat_bans_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investor_chat_banned' },
        () => {
          fetchBannedUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(bannedChannel);
    };
  }, [profile?.id]);

  const fetchBannedUsers = async () => {
    const { data } = await supabase.from('investor_chat_banned').select('*');
    setBannedUsers(data || []);
  };

  const fetchFollowedUsers = async () => {
    if (!profile?.id || !profile?.is_admin) return;
    const { data } = await supabase.from('investor_chat_follows').select('*').eq('admin_id', profile.id);
    if (data) {
      const enriched = await Promise.all(data.map(async (f: any) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('last_seen')
          .ilike('name', f.target_name.replace(/_/g, ' '))
          .maybeSingle();
        return {
          ...f,
          last_seen: prof?.last_seen || null,
          is_real: !!prof
        };
      }));
      setFollowedUsers(enriched);
    } else {
      setFollowedUsers([]);
    }
  };

  const fetchInitialMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('investor_chat_messages')
        .select('*, profiles(email)')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const dbMsgs = (data || []) as any[];

      // Map profile emails to messages
      dbMsgs.forEach((m) => {
        m.sender_email = m.profiles?.email || undefined;
      });

      // Ephemeral room: real messages are NOT replayed as history every time
      // someone opens the chat. Once a message scrolls out of a live session
      // it's gone — the "Resuming Chat Session" banner tells users exactly this.
      // The ONLY real messages we reload are pinned ones (a deliberate,
      // persistent admin action). Everything else — including a user's own
      // old messages and any replies to them — is dropped on load, so a
      // session never re-anchors on stale content. It only ever reappears
      // live via the realtime subscription while the user is actually present.
      const persistent = dbMsgs.filter(m => m.is_pinned);

      setMessages(persistent);
      const pinned = dbMsgs.find(m => m.is_pinned);
      if (pinned) setPinnedMessage(pinned);

      setLoading(false);
      scrollToBottom();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // This pool is randomized and reads mutable ref state, so it's computed in
  // an effect (side effects are expected there) rather than a useMemo factory
  // (which React requires to be a pure function of its dependencies).
  const [virtualScrollbackMessages, setVirtualScrollbackMessages] = useState<InvestorChatMessage[]>([]);

  useEffect(() => {
    const history: InvestorChatMessage[] = [];
    const baseTime = Date.now() - 24 * 60 * 60 * 1000; // 1 day ago
    const activeTopic = getActiveTopic(simCustomTopic, PROCEDURAL_TOPICS);

    // Walk the pre-shuffled pools sequentially (instead of striding through
    // the original template/name-ordered arrays) and skip anything used in
    // the last RECENT_WINDOW slots, so no name or message clusters together.
    const RECENT_WINDOW = 8;
    const recentNames: string[] = [];
    const recentBodies: string[] = [];
    const users = shuffledUsersRef.current;
    const msgs = shuffledMsgsRef.current;
    if (!users || !msgs) return;

    for (let i = 0; i < virtualHistoryCount; i++) {
      const timeOffset = (virtualHistoryCount - i) * 8 * 60 * 1000; // ~8 mins apart
      const msgTime = new Date(baseTime + timeOffset).toISOString();

      let user = users[i % users.length];
      for (let probe = 1; probe <= 20 && recentNames.includes(user.name); probe++) {
        user = users[(i + probe) % users.length];
      }
      recentNames.push(user.name);
      if (recentNames.length > RECENT_WINDOW) recentNames.shift();

      let body: string;
      if (activeTopic) {
        body = generateRandomMessage(undefined, activeTopic);
        for (let attempt = 0; attempt < 5 && recentBodies.includes(body); attempt++) {
          body = generateRandomMessage(undefined, activeTopic);
        }
      } else {
        body = msgs[i % msgs.length];
        for (let probe = 1; probe <= 20 && recentBodies.includes(body); probe++) {
          body = msgs[(i + probe) % msgs.length];
        }
      }
      recentBodies.push(body);
      if (recentBodies.length > RECENT_WINDOW) recentBodies.shift();

      history.push({
        id: `virtual-${i}`,
        sender_id: null,
        sender_name: user.name,
        sender_country: user.country,
        body,
        is_pinned: false,
        reply_to_id: null,
        created_at: msgTime
      });
    }
    setVirtualScrollbackMessages(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualHistoryCount, simCustomTopic, systemTopics]);

  // Combine virtual scrollback history with actual database messages
  const allMessagesList = useMemo(() => {
    return [...virtualScrollbackMessages, ...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [virtualScrollbackMessages, messages]);

  const allMessagesListRef = useRef(allMessagesList);
  useEffect(() => {
    allMessagesListRef.current = allMessagesList;
  }, [allMessagesList]);

  const activeSimCountriesRef = useRef(activeSimCountries);
  useEffect(() => { activeSimCountriesRef.current = activeSimCountries; }, [activeSimCountries]);

  const scheduledCountryRef = useRef(scheduledCountry);
  useEffect(() => { scheduledCountryRef.current = scheduledCountry; }, [scheduledCountry]);

  const scheduledUntilRef = useRef(scheduledUntil);
  useEffect(() => { scheduledUntilRef.current = scheduledUntil; }, [scheduledUntil]);

  const simCustomTopicRef = useRef(simCustomTopic);
  useEffect(() => { simCustomTopicRef.current = simCustomTopic; }, [simCustomTopic]);

  const followedUsersRef = useRef(followedUsers);
  useEffect(() => { followedUsersRef.current = followedUsers; }, [followedUsers]);

  const bannedUsersRef = useRef(bannedUsers);
  useEffect(() => { bannedUsersRef.current = bannedUsers; }, [bannedUsers]);

  // Rolling recent-history windows so the live simulation never lets the same
  // bot post twice in a row (or a handful of messages apart), and never
  // repeats the same message text within a short stretch.
  const recentPosterNamesRef = useRef<string[]>([]);
  const recentBodiesRef = useRef<string[]>([]);

  // Simulated live message additions (recursive timeout for dynamic, human-like speed)
  useEffect(() => {
    if (loading) return;

    let timeoutId: any;

    const runSimulation = () => {
      if (!shuffledUsersRef.current) return;
      const now = new Date();
      let currentCountryLimit: string | null = null;
      const schedC = scheduledCountryRef.current;
      const schedU = scheduledUntilRef.current;
      const actC = activeSimCountriesRef.current;
      const customTopicVal = simCustomTopicRef.current;
      const followedUsersVal = followedUsersRef.current;

      if (schedC && schedU && now < new Date(schedU)) {
        currentCountryLimit = schedC;
      }

      // Filter users based on scheduling — banned bots never get to post again
      const bannedNamesLower = new Set(bannedUsersRef.current.map(b => b.user_name.toLowerCase()));
      let candidates = shuffledUsersRef.current.filter(u => !bannedNamesLower.has(u.name.toLowerCase()));
      if (currentCountryLimit) {
        candidates = candidates.filter(u => u.country === currentCountryLimit);
      } else if (actC.length > 0) {
        candidates = candidates.filter(u => actC.includes(u.country));
      }
      if (candidates.length === 0) {
        candidates = shuffledUsersRef.current.filter(u => !bannedNamesLower.has(u.name.toLowerCase()));
      }

      // Filter by daily post limits (max 2 per day)
      let eligibleCandidates = candidates.filter(u => canUserPost(u.name));
      if (eligibleCandidates.length === 0) {
        eligibleCandidates = candidates;
      }

      // Avoid the same handful of names dominating a short stretch of chat —
      // skip anyone who posted in the last few messages if other options exist
      const recentNames = recentPosterNamesRef.current;
      const notRecentlyPosted = eligibleCandidates.filter(u => !recentNames.includes(u.name));
      if (notRecentlyPosted.length > 0) {
        eligibleCandidates = notRecentlyPosted;
      }

      // Fallback if filter left empty
      if (eligibleCandidates.length === 0) {
        eligibleCandidates = shuffledUsersRef.current;
      }

      // Pick sequential user from candidates to ensure rotating variety
      const user = eligibleCandidates[simUserIndexRef.current % eligibleCandidates.length];
      simUserIndexRef.current = (simUserIndexRef.current + 1) % eligibleCandidates.length;

      recentPosterNamesRef.current = [...recentPosterNamesRef.current, user.name].slice(-6);

      const decider = Math.random();
      if (decider < 0.08) {
        // Online-count change — explained by batch joins/leaves, which looks
        // much more realistic for a room of ~3M users than single joins/leaves.
        const isJoin = decider < 0.05;
        const waveRoll = Math.random();
        
        let amount = 1;
        if (waveRoll > 0.02) {
          amount = waveRoll < 0.70
            ? Math.floor(Math.random() * 80) + 10       // 10–90 users
            : waveRoll < 0.95
            ? Math.floor(Math.random() * 350) + 100     // 100–450 users
            : Math.floor(Math.random() * 2500) + 500;    // 500–3000 users
        }

        const flag = COUNTRY_FLAGS[user.country] || '🌐';
        const label = amount === 1
          ? `${flag} @${user.name} ${isJoin ? 'joined' : 'left'} the room`
          : `👥 ${amount.toLocaleString()} users just ${isJoin ? 'joined' : 'left'} the room`;

        const simulatedMsg: InvestorChatMessage = {
          id: `sim-sys-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          sender_id: null,
          sender_name: 'System',
          sender_country: user.country,
          body: label,
          is_pinned: false,
          reply_to_id: null,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, simulatedMsg]);
        setOnlineCount(prev => {
          const next = isJoin ? prev + amount : prev - amount;
          return Math.max(1_000_000, Math.min(4_000_000, next));
        });
        scrollToBottom();
      } else {
        // Decider to reply to last msg or post a new topic
        const list = allMessagesListRef.current;
        const lastMsg = list[list.length - 1];
        const shouldReply = Math.random() > 0.65 && lastMsg && lastMsg.sender_name !== 'System';
        
        const activeTopic = getActiveTopic(customTopicVal, PROCEDURAL_TOPICS);
        const body = generateRandomMessage(shouldReply ? lastMsg.sender_name : undefined, activeTopic, true);

        if (activeTopic && body.toLowerCase().includes(activeTopic.toLowerCase())) {
          topicMessageCountRef.current++;
          if (topicMessageCountRef.current >= topicThresholdRef.current) {
            resetTopicCounter();
          }
        }
        
        const simulatedMsg: InvestorChatMessage = {
          id: `sim-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          sender_id: null,
          sender_name: user.name,
          sender_country: user.country,
          body,
          is_pinned: false,
          reply_to_id: shouldReply ? lastMsg.id : null,
          created_at: new Date().toISOString(),
          reply_to_name: shouldReply ? lastMsg.sender_name : undefined,
          reply_to_body: shouldReply ? lastMsg.body : undefined
        };

        // Record simulated post frequency
        recordUserPost(user.name);

        // Only post if this exact text wasn't already said in the last few
        // messages — but never bail out of the loop itself, or the whole
        // simulation (and the online-count updates riding along with it)
        // would freeze the moment one collision happened.
        if (!recentBodiesRef.current.includes(body)) {
          recentBodiesRef.current = [...recentBodiesRef.current, body].slice(-6);

          setMessages(prev => [...prev, simulatedMsg]);
          scrollToBottom();

          // Check if current user is tagged or responded to
          checkAndAlertMentions(simulatedMsg);

          // Check if followed user posted (Admin alert)
          if (profile?.is_admin) {
            const isFollowed = followedUsersVal.some(f => f.target_name.toLowerCase() === user.name.toLowerCase());
            if (isFollowed) {
              toast(`Followed User Alert`, {
                description: `${user.name} posted: "${body.substring(0, 40)}..."`,
                action: {
                  label: "View",
                  onClick: () => {
                    const el = document.getElementById(`msg-${simulatedMsg.id}`);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              });
              if (profile?.id) {
                notifyUser({
                  userId: profile.id,
                  title: `Followed user posted`,
                  message: `${user.name} posted a new update in Investor Chat.`,
                  type: 'info',
                  link: '/app/investor-chat'
                });
              }
              setFollowAlerts(prev => [...prev, { id: simulatedMsg.id, msg: simulatedMsg }]);
            }
          }
        }
      }

      // Dynamic delay: jitter around simSpeedMs (between 80% and 120% of the target speed)
      const minDelay = Math.max(1000, Math.floor(simSpeedMs * 0.8));
      const maxDelay = Math.floor(simSpeedMs * 1.2);
      const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      timeoutId = setTimeout(runSimulation, nextDelay);
    };

    // Schedule initial message
    const initialDelay = Math.floor(Math.random() * 2000) + 1000;
    timeoutId = setTimeout(runSimulation, initialDelay);

    return () => clearTimeout(timeoutId);
  }, [loading, simSpeedMs]);

  // Handle scroll to top to load more virtual history
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    if (chatContainerRef.current.scrollTop === 0 && virtualHistoryCount < 1000) {
      // Load more simulated history
      const oldScrollHeight = chatContainerRef.current.scrollHeight;
      setVirtualHistoryCount(prev => prev + 40);
      
      // Restore scroll position
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - oldScrollHeight;
        }
      }, 50);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Check if current user is banned
  const isCurrentBanned = useMemo(() => {
    if (!profile?.name) return false;
    return bannedUsers.some(b => b.user_name.toLowerCase() === profile.name.toLowerCase());
  }, [profile, bannedUsers]);

  // Handle posting message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    
    if (isCurrentBanned) {
      toast.error('You are banned from sending messages in this chat.');
      return;
    }

    setSending(true);
    try {
      const senderName = impersonatedUser ? impersonatedUser.name : (profile?.is_admin ? 'Support' : (profile?.name || 'Investor'));
      const senderCountry = impersonatedUser ? impersonatedUser.country : 'US';

      // Insert message into DB
      const { error } = await supabase.from('investor_chat_messages').insert({
        sender_id: profile?.id || null,
        sender_name: senderName,
        sender_country: senderCountry,
        body: text.trim(),
        reply_to_id: replyTarget?.id || null,
        reply_to_name: replyTarget?.sender_name || null,
        reply_to_body: replyTarget?.body || null,
        is_pinned: false
      });

      if (error) throw error;

      // Extract mentions e.g. @Name
      const mentionRegex = /@(\w+)/g;
      const matches = [...text.matchAll(mentionRegex)];
      const mentionedNames = matches.map(m => m[1]);

      for (const name of mentionedNames) {
        // Query if real profile matches name
        const { data: matchedUser } = await supabase
          .from('profiles')
          .select('id, email, name')
          .ilike('name', name.replace(/_/g, ' '))
          .maybeSingle();

        if (matchedUser) {
          // Trigger Alert notification
          await notifyUser({
            userId: matchedUser.id,
            title: 'Tagged in Investor Chat',
            message: `${senderName} tagged you in the community chat: "${text.substring(0, 40)}..."`,
            type: 'info',
            link: '/app/investor-chat'
          });

          // Trigger email notification
          const emailSubject = `You were tagged in ${import.meta.env.VITE_APP_NAME || 'RPM'} Investor Chat`;
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f0f0f0; border-radius: 12px;">
              <h2 style="color: #111;">Hello ${matchedUser.name},</h2>
              <p style="color: #555; font-size: 14px; line-height: 1.5;">
                <strong>${senderName}</strong> mentioned/tagged you in the global Investor Group Chat.
              </p>
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #111; margin: 20px 0; font-style: italic; color: #333;">
                "${text}"
              </div>
              <p style="color: #555; font-size: 14px;">
                Log into your account to read the full thread and reply to the conversation.
              </p>
              <a href="${window.location.origin}/app/investor-chat" style="display: inline-block; background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
                Open Investor Chat
              </a>
            </div>
          `;
          await sendEmailToUser(matchedUser.id, 'info', emailSubject, emailBody);
        }
      }

      // ── Reply notification ───────────────────────────────────────
      // Notify the person being replied to (only for real profiles,
      // not when replying to your own message or simulated users).
      if (replyTarget?.reply_to_name || replyTarget?.sender_name) {
        const replyToName = replyTarget.sender_name;
        if (replyToName && replyToName !== senderName) {
          const { data: repliedUser } = await supabase
            .from('profiles')
            .select('id, name')
            .ilike('name', replyToName.replace(/_/g, ' '))
            .maybeSingle();

          if (repliedUser && repliedUser.id !== profile?.id) {
            await notifyUser({
              userId: repliedUser.id,
              title: '💬 Someone replied to your message',
              message: `${senderName} replied to you: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
              type: 'info',
              link: '/app/investor-chat'
            });
          }
        }
      }

      setText('');
      setReplyTarget(null);
      scrollToBottom();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Admin Pin Action
  const handlePinMessage = async (msg: InvestorChatMessage) => {
    if (!profile?.is_admin) return;
    try {
      const isAlreadyPinned = msg.is_pinned || 
                              pinnedMessage?.id === msg.id || 
                              (pinnedMessage && pinnedMessage.body === msg.body && pinnedMessage.sender_name === msg.sender_name);
      if (isAlreadyPinned) {
        await handleUnpinMessage();
        return;
      }

      // Unpin all first
      await supabase.from('investor_chat_messages').update({ is_pinned: false }).eq('is_pinned', true);
      
      const isSimulated = msg.id.startsWith('sim-') || msg.id.startsWith('virtual-');
      if (isSimulated) {
        const { error } = await supabase
          .from('investor_chat_messages')
          .insert({
            sender_id: null,
            sender_name: msg.sender_name,
            sender_country: msg.sender_country,
            body: msg.body,
            is_pinned: true,
            reply_to_id: msg.reply_to_id || null,
            reply_to_name: msg.reply_to_name || null,
            reply_to_body: msg.reply_to_body || null
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('investor_chat_messages')
          .update({ is_pinned: true })
          .eq('id', msg.id);
        if (error) throw error;
      }
      
      toast.success(`Message pinned!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Unpin Action
  const handleUnpinMessage = async () => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_messages').update({ is_pinned: false }).eq('is_pinned', true);
      if (error) throw error;
      // Clear is_pinned flag on all local messages too
      setMessages(prev => prev.map(m => m.is_pinned ? { ...m, is_pinned: false } : m));
      setPinnedMessage(null);
      toast.success('Message unpinned.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Ban Action
  const handleBanUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_banned').insert({
        user_name: userName,
        admin_id: profile.id
      });
      if (error) throw error;
      toast.success(`User @${userName} has been banned from the chat!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to ban user');
    }
  };

  // Admin Unban Action
  const handleUnbanUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase.from('investor_chat_banned').delete().eq('user_name', userName);
      if (error) throw error;
      toast.success(`User @${userName} unbanned.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin Follow Action
  const handleFollowUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      // Best-effort resolve to a real profile id — lets the server-side
      // "followed user posted" alert match by id (rename-proof) instead of
      // only the display name, which silently breaks if they rename. Bot
      // personas (no matching profile) fall back to name-only matching.
      const { data: matchedProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('name', userName.replace(/_/g, ' '))
        .maybeSingle();

      const { error } = await supabase.from('investor_chat_follows').insert({
        admin_id: profile.id,
        target_name: userName,
        target_user_id: matchedProfile?.id ?? null,
      });
      if (error) throw error;
      toast.success(`Following @${userName}. You will be alerted when they post.`);
      fetchFollowedUsers();
    } catch (err: any) {
      toast.error(err.message || 'Already following this user');
    }
  };

  // Admin Unfollow Action
  const handleUnfollowUser = async (userName: string) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase
        .from('investor_chat_follows')
        .delete()
        .eq('admin_id', profile.id)
        .eq('target_name', userName);
      
      if (error) throw error;
      toast.success(`Stopped following @${userName}.`);
      fetchFollowedUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Get avatar gradient index based on name hash
  const getAvatarGradient = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
  };

  // Search filtered message list
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return allMessagesList;
    const query = searchQuery.toLowerCase();
    return allMessagesList.filter(m => {
      const email = m.sender_email || (m.sender_id ? "" : `${m.sender_name.toLowerCase()}@remaprofitmachine.com`);
      return (
        m.body.toLowerCase().includes(query) || 
        m.sender_name.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query)
      );
    });
  }, [allMessagesList, searchQuery]);

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full min-h-0">
      
      {/* Sidebar - Settings & Stats */}
      <div className="hidden md:flex w-full md:w-64 bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 flex flex-col justify-between shrink-0 h-fit md:h-full shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Users className="text-brand shrink-0 animate-pulse" size={20} />
            <div>
              <h2 className="font-bold text-sm">Investor Chat</h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">RPM Global Room</span>
            </div>
          </div>

          {/* Active stats */}
          <div className="space-y-4">
            <div className="bg-slate-850/50 border border-slate-850 p-4 rounded-2xl">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Live Online</span>
              <p className="text-xl font-extrabold tabular-nums text-emerald-400 mt-1">
                {onlineCount.toLocaleString()}
              </p>
              <span className="text-[9px] text-slate-400 mt-1 block">Global coverage from 195 countries</span>
            </div>
            
            <div className="bg-slate-850/50 border border-slate-850 p-4 rounded-2xl text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-400">
                <span>Room type</span>
                <span className="font-bold text-white">Public Group</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Members allowed</span>
                <span className="font-bold text-white">All Investors</span>
              </div>
            </div>
          </div>

          {/* Rules/Info */}
          <div className="space-y-2 text-xs text-slate-400">
            <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider block">Guidelines</span>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
              <li>Use `@name` to tag any active member</li>
              <li>Tagged members receive emails & push alerts</li>
              <li>Spamming or flooding will trigger automated ban</li>
            </ul>
          </div>
        </div>

        {/* Admin Dashboard Controls inside sidebar */}
        {profile?.is_admin && (
          <div className="pt-4 border-t border-slate-800 space-y-2 mt-4">
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
            >
              <ShieldCheck size={14} /> {showAdminPanel ? "Hide Admin Tools" : "Show Admin Tools"}
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm overflow-hidden h-full border border-gray-200">
        
        {/* Telegram-style dark header */}
        <div className="px-4 py-3 bg-[#17212b] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow">
              R
            </div>
            <div>
              <h3 className="font-bold text-white text-sm leading-tight">RPM Group Room</h3>
              <p className="text-[11px] text-[#6c8fa8] font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
                {onlineCount.toLocaleString()} members online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 max-w-[300px] w-full justify-end">
            {/* Search bar */}
            <div className="relative max-w-[120px] sm:max-w-[180px] w-full">
              <Search className="absolute left-2.5 top-2 text-[#4a6a80]" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full bg-[#0d1117] border border-[#2b3d4f] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#4a6a80] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Admin control panel toggle button on mobile */}
            {profile?.is_admin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="md:hidden flex items-center justify-center p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition shadow shrink-0"
                title={showAdminPanel ? "Hide Admin Panel" : "Show Admin Panel"}
              >
                <ShieldCheck size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Telegram-style Pinned Message Banner */}
        {pinnedMessage && (
          <div className="relative flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition group"
            onClick={() => {
              // Try id first, then fall back to body+sender match
              let el = document.getElementById(`msg-${pinnedMessage.id}`);
              if (!el) {
                el = Array.from(document.querySelectorAll('[id^="msg-"]')).find(e => {
                  const div = e as HTMLElement;
                  return div.dataset.sender === pinnedMessage.sender_name &&
                         div.dataset.body === pinnedMessage.body;
                }) as HTMLElement | null;
              }
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('!bg-blue-50');
                setTimeout(() => el!.classList.remove('!bg-blue-50'), 1500);
              }
            }}
          >
            {/* Telegram left accent bar */}
            <div className="w-0.5 h-8 bg-blue-500 rounded-full shrink-0" />
            <Pin size={12} className="text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-blue-600 block">Pinned Message</span>
              <p className="text-xs text-gray-700 truncate font-medium">@{pinnedMessage.sender_name}: {pinnedMessage.body}</p>
            </div>
            {profile?.is_admin && (
              <button
                onClick={(e) => { e.stopPropagation(); handleUnpinMessage(); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition shrink-0"
                title="Unpin"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Resuming Session Notice */}
        {showOfflineNotice && (
          <div className="bg-amber-50 dark:bg-[#1a232f] border-b border-amber-200/50 dark:border-[#243547] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 transition-all select-none">
            <div className="flex items-start gap-2.5 min-w-0">
              <Info size={16} className="text-amber-600 dark:text-[#7da4c4] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-amber-800 dark:text-[#8ab4d8] block">Resuming Chat Session</span>
                <p className="text-[11px] text-amber-700 dark:text-[#8aa5bc] leading-relaxed">
                  Real-time updates have been resumed. To optimize platform performance and conserve bandwidth, messages dispatched during your absence are not synchronized to your local client history.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowOfflineNotice(false)}
              className="text-amber-500 hover:text-amber-800 dark:text-gray-400 dark:hover:text-white p-1 hover:bg-amber-100 dark:hover:bg-[#2b3d4f] rounded-lg transition shrink-0"
              title="Dismiss Notice"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Messages feed — Telegram style */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-5 space-y-1 bg-[#efeae2] dark:bg-[#0e1621]"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Users className="animate-pulse text-gray-300" size={32} />
              <p className="text-xs text-gray-400 font-semibold">Connecting to group network...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16 text-gray-400 space-y-2">
              <Search size={32} className="mx-auto text-gray-200" />
              <p className="font-bold text-gray-700 text-xs">No matching messages found</p>
            </div>
          ) : (
            <>
              {/* Infinite simulated scrolling header indicator */}
              {virtualHistoryCount < 1000 && (
                <div className="text-center text-[10px] text-gray-400 py-2 select-none border-b border-gray-100 bg-gray-50/30 rounded-xl">
                  Scroll up to load older message history...
                </div>
              )}

              {filteredMessages.map((msg) => {

                const flag = COUNTRY_FLAGS[msg.sender_country] || '🌐';
                const isFollowed = followedUsers.some(f => f.target_name.toLowerCase() === msg.sender_name.toLowerCase());
                const isAdminSender = msg.sender_name.toLowerCase() === 'support';
                const isCurrentPinned = msg.is_pinned || (pinnedMessage && pinnedMessage.body === msg.body && pinnedMessage.sender_name === msg.sender_name);
                const isSystemMsg = msg.sender_name === 'System';

                // System join/leave events rendered as a slim centred pill
                if (isSystemMsg) {
                  const isJoin = msg.body.includes('joined');
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className="flex items-center justify-center gap-2 py-1 my-1">
                      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                      <span className={`text-[10px] font-semibold px-3 py-1 rounded-full select-none shadow-sm ${
                        isJoin
                          ? 'bg-emerald-500/20 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-black/10 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                      }`}>
                        {msg.body}
                      </span>
                      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                    </div>
                  );
                }

                const isMine = !!msg.sender_id && msg.sender_id === profile?.id;

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    data-sender={msg.sender_name}
                    data-body={msg.body}
                    className={`flex items-end gap-2 group relative transition-colors duration-500 ${
                      // Admin always shows on the left regardless of isMine — official channel style
                      isAdminSender ? 'flex-row' : isMine ? 'flex-row-reverse' : 'flex-row'
                    } ${isCurrentPinned ? 'bg-blue-500/10 rounded-2xl' : ''}`}
                  >
                    {/* Avatar — always for admin, only hidden for regular isMine */}
                    {(!isMine || isAdminSender) && (
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${
                          isAdminSender ? 'from-amber-400 to-yellow-500' : getAvatarGradient(msg.sender_name)
                        } text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm self-end mb-0.5`}
                      >
                        {msg.sender_name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Bubble — admin premium gold style always; blue only for regular own messages */}
                    <div className={`relative max-w-[80%] md:max-w-[68%] px-3 pt-2 pb-1.5 shadow-sm ${
                      isAdminSender
                        ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700/60 border-l-[3px] border-l-amber-400 dark:border-l-amber-500 rounded-2xl rounded-bl-sm'
                        : isMine
                          ? 'bg-[#2b5278] dark:bg-[#2b5278] rounded-2xl rounded-br-sm text-white'
                          : 'bg-white dark:bg-[#212d3b] border border-gray-100 dark:border-[#2b3d4f] rounded-2xl rounded-bl-sm'
                    }`}>

                      {/* Sender name — always for others; always for admin even when isMine */}
                      {(!isMine || isAdminSender) && (
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[12px] font-black leading-none tracking-tight ${
                            isAdminSender
                              ? 'text-amber-700 dark:text-amber-400'
                              : getNameColor(msg.sender_name)
                          }`}>
                            {msg.sender_name}
                          </span>
                          {isAdminSender && (
                            <span title="Verified Support Account" className="inline-flex items-center justify-center shrink-0" style={{ width: 14, height: 14 }}>
                              <svg viewBox="0 0 22 22" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.648.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.747-1.05.87-1.686.122-.635.068-1.29-.164-1.897.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#1D9BF0"/>
                              </svg>
                            </span>
                          )}
                          {isFollowed && (
                            <span className="text-[8px] font-bold text-blue-500 flex items-center gap-0.5">
                              <Bell size={7} /> Following
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reply quote strip */}
                      {msg.reply_to_name && (
                        <div className={`mb-1.5 pl-2.5 border-l-[3px] py-1 pr-2 rounded-r-lg ${
                          isMine
                            ? 'border-white/50 bg-white/10'
                            : 'border-blue-400 bg-blue-50/60 dark:bg-blue-900/30'
                        }`}>
                          <span className={`text-[10px] font-bold block ${isMine ? 'text-white/80' : 'text-blue-600 dark:text-blue-400'}`}>
                            @{msg.reply_to_name}
                          </span>
                          <p className={`text-[10px] truncate leading-tight ${isMine ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
                            {msg.reply_to_body}
                          </p>
                        </div>
                      )}

                      {/* Message text */}
                      <p className={`text-[13px] leading-snug select-text break-words ${
                        isMine && !isAdminSender ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {msg.body}
                      </p>

                      {/* Footer: flag + time */}
                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                        <span className="text-[9px]" title={msg.sender_country}>{flag}</span>
                        <span className={`text-[10px] tabular-nums leading-none ${
                          isMine && !isAdminSender ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isCurrentPinned && <Pin size={8} className={isMine && !isAdminSender ? 'text-white/60' : 'text-blue-400'} />}
                      </div>

                      {/* Admin mention quick-reply buttons */}
                      {profile?.is_admin && (() => {
                        const mentions = [...msg.body.matchAll(/@(\w+)/g)].map(m => m[1]);
                        if (mentions.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/20">
                            {mentions.map(mentionName => (
                              <button
                                key={mentionName}
                                onClick={() => {
                                  const simUser = SIMULATED_USERS.find(u => u.name.toLowerCase() === mentionName.toLowerCase());
                                  const country = simUser ? simUser.country : 'US';
                                  setImpersonatedUser({ name: mentionName, country });
                                  setReplyTarget(msg);
                                  toast.success(`Reply as @${mentionName}`);
                                  document.getElementById('chat-input-field')?.focus();
                                }}
                                className="text-[9px] text-blue-300 font-bold bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded-md border border-white/20 transition"
                              >
                                Reply as @{mentionName}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Hover context menu — floats above, flipped for right-side bubbles */}
                    <div className={`absolute ${isMine ? 'left-0' : 'right-0'} -top-8 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-white dark:bg-[#212d3b] border border-gray-200 dark:border-[#2b3d4f] p-0.5 rounded-xl shadow-lg transition z-10`}>
                      <button
                        onClick={() => setReplyTarget(msg)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2b3d4f] rounded-lg text-gray-500 dark:text-gray-400 text-[10px] font-semibold flex items-center gap-0.5 transition"
                        title="Reply"
                      >
                        ↩ Reply
                      </button>
                      {profile?.is_admin && (
                        <>
                          <button
                            onClick={() => handlePinMessage(msg)}
                            className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#2b3d4f] rounded-lg transition ${isCurrentPinned ? 'text-blue-500' : 'text-gray-400'}`}
                            title={isCurrentPinned ? 'Unpin' : 'Pin'}
                          >
                            <Pin size={12} />
                          </button>
                          {isFollowed ? (
                            <button onClick={() => handleUnfollowUser(msg.sender_name)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2b3d4f] rounded-lg text-blue-400 transition" title="Unfollow">
                              <VolumeX size={12} />
                            </button>
                          ) : (
                            <button onClick={() => handleFollowUser(msg.sender_name)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2b3d4f] rounded-lg text-gray-400 transition" title="Follow">
                              <Bell size={12} />
                            </button>
                          )}
                          {/* Impersonate (post as) */}
                          <button
                            onClick={() => {
                              setImpersonatedUser({ name: msg.sender_name, country: msg.sender_country });
                              toast.success(`Now posting as @${msg.sender_name}`);
                              document.getElementById('chat-input-field')?.focus();
                            }}
                            className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg text-purple-400 text-[9px] font-bold transition"
                            title={`Post as @${msg.sender_name}`}
                          >@</button>
                          {/* Reply as sender — sets both impersonation + reply target */}
                          <button
                            onClick={() => {
                              setImpersonatedUser({ name: msg.sender_name, country: msg.sender_country });
                              setReplyTarget(msg);
                              toast.success(`Reply as @${msg.sender_name}`);
                              document.getElementById('chat-input-field')?.focus();
                            }}
                            className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg text-purple-500 text-[9px] font-bold transition"
                            title={`Reply to this message as @${msg.sender_name}`}
                          >↩@</button>
                          <button
                            onClick={() => handleBanUser(msg.sender_name)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-400 transition"
                            title="Ban"
                          >
                            <ShieldAlert size={12} />
                          </button>
                        </>
                      )}

                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Impersonation Overlay Banner */}
        {impersonatedUser && (
          <div className="bg-purple-600 px-4 py-1.5 text-xs text-white flex justify-between items-center gap-3 shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldAlert size={13} className="shrink-0" />
              Posting as <span className="font-bold">@{impersonatedUser.name}</span> {COUNTRY_FLAGS[impersonatedUser.country] || impersonatedUser.country}
            </span>
            <button
              onClick={() => setImpersonatedUser(null)}
              className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-lg transition"
            >
              Exit
            </button>
          </div>
        )}

        {/* Reply Target strip */}
        {replyTarget && (
          <div className="bg-[#17212b] border-t border-[#2b3d4f] px-4 py-2 flex justify-between items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-0.5 h-8 bg-blue-400 rounded-full shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-blue-400 block">Reply to @{replyTarget.sender_name}</span>
                <p className="text-[11px] text-gray-300 truncate">{replyTarget.body}</p>
              </div>
            </div>
            <button onClick={() => setReplyTarget(null)} className="text-gray-500 hover:text-gray-300 p-1 shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Telegram-style input bar */}
        <div className="px-3 py-2.5 bg-[#17212b] border-t border-[#2b3d4f] shrink-0">
          {isCurrentBanned ? (
            <div className="bg-red-900/30 text-red-300 border border-red-800/50 rounded-2xl p-3 flex items-center justify-center gap-3 text-xs font-semibold select-none">
              <ShieldAlert size={18} className="shrink-0" />
              <span>You have been banned from posting in this chat.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <input
                id="chat-input-field"
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={
                  impersonatedUser
                    ? `Type as @${impersonatedUser.name}...`
                    : replyTarget
                      ? `Reply to @${replyTarget.sender_name}...`
                      : 'Message RPM Group Room...'
                }
                className="flex-1 bg-[#242f3d] border border-[#2b3d4f] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-[#4a6a80] focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="bg-[#2b5278] hover:bg-[#3a6d9e] disabled:bg-[#1c2d3f] text-white rounded-full w-10 h-10 flex items-center justify-center shrink-0 transition shadow disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Admin Sliding Modal Panel */}
      {showAdminPanel && profile?.is_admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAdminPanel(false)} />
          <div className="bg-white max-w-sm w-full h-[90vh] rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden border">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-950 text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <ShieldCheck size={18} /> Chat Administration Panel
              </h3>
              <button onClick={() => setShowAdminPanel(false)} className="p-1 hover:bg-gray-800 rounded-xl transition text-white">
                <X size={18} />
              </button>
            </div>

            {/* Scrolling list */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-slate-800 bg-gray-50/50">
              
              {/* Accordion 1: Simulation Discussion Topic */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('topic')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🎲</span> Simulation Discussion Topic
                  </span>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.topic ? 'rotate-180' : ''}`} />
                </button>
                {openAdminSections.topic && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 mt-1">
                    <p className="text-[10px] text-gray-400 font-semibold leading-normal">Select one, multiple, or shuffle random topics below. Press the button below to apply changes.</p>
                    <div className="space-y-2.5">
                      {/* Shortcut Buttons */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSimTopicDraft("__random__")}
                          className={`flex-1 py-1.5 px-2 border rounded-xl text-[10px] font-bold transition ${
                            simTopicDraft === "__random__"
                              ? 'bg-blue-500 text-white border-transparent shadow-sm'
                              : 'bg-white text-gray-650 hover:bg-gray-50'
                          }`}
                        >
                          Discuss Random
                        </button>
                        <button
                          type="button"
                          onClick={() => setSimTopicDraft('')}
                          className={`flex-1 py-1.5 px-2 border rounded-xl text-[10px] font-bold transition ${
                            !simTopicDraft
                              ? 'bg-gray-500 text-white border-transparent shadow-sm'
                              : 'bg-white text-gray-650 hover:bg-gray-50'
                          }`}
                        >
                          Default Room
                        </button>
                      </div>

                      {/* Multi-Select list from systemTopics */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">System Listings/Staking Topics (Select Multiple):</label>
                        <div className="max-h-36 overflow-y-auto border border-gray-150 rounded-xl p-2 bg-slate-50/20 space-y-1">
                          {systemTopics.map(t => {
                            const selectedList = simTopicDraft.split(',').map(s => s.trim());
                            const isSelected = selectedList.includes(t);
                            return (
                              <label key={t} className="flex items-center gap-2.5 py-2 px-1.5 rounded-lg text-[10px] font-semibold text-gray-650 hover:text-gray-900 hover:bg-white cursor-pointer select-none touch-manipulation">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (simTopicDraft === "__random__") {
                                      setSimTopicDraft(t);
                                    } else {
                                      let nextList = simTopicDraft ? simTopicDraft.split(',').map(s => s.trim()).filter(Boolean) : [];
                                      if (nextList.includes(t)) {
                                        nextList = nextList.filter(x => x !== t);
                                      } else {
                                        nextList.push(t);
                                      }
                                      setSimTopicDraft(nextList.join(', '));
                                    }
                                  }}
                                  className="rounded text-brand focus:ring-brand w-4 h-4 border-gray-200 shrink-0"
                                />
                                <span>{t}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Topic String input */}
                      <div className="relative flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400">Current Topic Settings:</label>
                        <input
                          type="text"
                          placeholder="Type custom or comma-separated list..."
                          value={simTopicDraft}
                          onChange={(e) => setSimTopicDraft(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none font-semibold text-slate-800"
                        />
                      </div>

                      {/* Confirmation Apply Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          setSimCustomTopic(simTopicDraft);
                          const { error } = await supabase
                            .from('settings')
                            .upsert({ key: 'investor_chat_topic', value: simTopicDraft }, { onConflict: 'key' });
                          if (error) {
                            toast.error('Failed to save topic setting: ' + error.message);
                          } else {
                            toast.success("Simulation topics applied for everyone!");
                          }
                        }}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        Apply Topic Settings
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Accordion 2: Country Scheduling & Filters */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('countries')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🌍</span> Country Scheduling & Filters
                  </span>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.countries ? 'rotate-180' : ''}`} />
                </button>
                {openAdminSections.countries && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 mt-1">
                    {/* Active countries limit list */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-gray-400 block">Allowed Simulation Countries:</span>
                      <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto border p-2 rounded-xl bg-gray-50/50">
                        {COUNTRIES.slice(0, 30).map(c => {
                          const active = activeSimCountries.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                if (active) {
                                  setActiveSimCountries(prev => prev.filter(x => x !== c));
                                } else {
                                  setActiveSimCountries(prev => [...prev, c]);
                                }
                              }}
                              className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold transition ${active ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-650 hover:bg-gray-50'}`}
                            >
                              {COUNTRY_FLAGS[c] || c} {c}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-gray-400">Select countries to allow in the pool. (Leave empty for all countries).</p>
                    </div>

                    {/* Country schedule queue */}
                    <div className="space-y-2 border-t pt-3">
                      <span className="text-[10px] font-bold text-gray-400 block">Schedule Exclusive Country:</span>
                      
                      {scheduledCountry && scheduledUntil && new Date() < new Date(scheduledUntil) ? (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[11px] space-y-1">
                          <div className="font-bold text-emerald-800 flex items-center justify-between">
                            <span>🟢 Exclusive: {getCountryFlag(scheduledCountry)} {scheduledCountry}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setScheduledCountry(null);
                                setScheduledUntil(null);
                                toast.success("Exclusive scheduling cancelled.");
                              }}
                              className="text-[9px] text-red-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="text-emerald-700 text-[10px]">
                            Only users from {scheduledCountry} will post until {new Date(scheduledUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <select 
                              value={schedCountrySelect}
                              onChange={(e) => setSchedCountrySelect(e.target.value)}
                              className="flex-1 border rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none"
                            >
                              {COUNTRIES.map(k => (
                                <option key={k} value={k}>{COUNTRY_FLAGS[k]} {k}</option>
                              ))}
                            </select>
                            <select 
                              value={schedHoursSelect}
                              onChange={(e) => setSchedHoursSelect(Number(e.target.value))}
                              className="border rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none w-[90px]"
                            >
                              <option value={1}>1 hour</option>
                              <option value={2}>2 hours</option>
                              <option value={6}>6 hours</option>
                              <option value={12}>12 hours</option>
                              <option value={24}>24 hours</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!schedCountrySelect) return;
                              const untilStr = new Date(Date.now() + schedHoursSelect * 60 * 60 * 1000).toISOString();
                              setScheduledCountry(schedCountrySelect);
                              setScheduledUntil(untilStr);
                              toast.success(`Scheduled exclusive posts for ${schedCountrySelect} for next ${schedHoursSelect} hours.`);
                            }}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            Schedule Exclusive Target Country
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 3: Custom Impersonation Creator */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('impersonate')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🎭</span> Custom Impersonator Creator
                  </span>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.impersonate ? 'rotate-180' : ''}`} />
                </button>
                {openAdminSections.impersonate && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 mt-1">
                    <p className="text-[10px] text-gray-400 font-semibold leading-normal">Create a temporary custom name/country to post as.</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Enter custom username..."
                        value={impersonateNameInput}
                        onChange={(e) => setImpersonateNameInput(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none font-semibold"
                      />
                      <select 
                        value={impersonateCountryInput}
                        onChange={(e) => setImpersonateCountryInput(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none"
                      >
                        {Object.keys(COUNTRY_FLAGS).map(k => (
                          <option key={k} value={k}>{COUNTRY_FLAGS[k]} {k}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          if (!impersonateNameInput.trim()) return toast.error("Enter a valid name");
                          setImpersonatedUser({ name: impersonateNameInput.trim(), country: impersonateCountryInput });
                          setImpersonateNameInput('');
                          toast.success(`Impersonation active for @${impersonateNameInput.trim()}`);
                          document.getElementById('chat-input-field')?.focus();
                        }}
                        className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold transition hover:bg-gray-800"
                      >
                        Apply Custom Impersonator
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: Followed Feed & Activities */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('followed')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🔔</span> Followed Feed & Activities
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {followAlerts.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                        {followAlerts.length}
                      </span>
                    )}
                    <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.followed ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {openAdminSections.followed && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-4 mt-1">
                    {/* Activity Log */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center pb-1.5 border-b">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Feed Alerts Log</span>
                        {followAlerts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFollowAlerts([])}
                            className="text-[9px] text-red-500 hover:underline font-extrabold"
                          >
                            Clear Log
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto">
                        {followAlerts.length === 0 ? (
                          <p className="text-[9px] text-gray-400 py-3 text-center">No recent followed alerts.</p>
                        ) : (
                          followAlerts.map(alert => (
                            <div key={alert.id} className="p-2 bg-blue-50/30 border border-blue-100/50 rounded-xl space-y-1 text-[10px]">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-blue-700">@{alert.msg.sender_name}</span>
                                <span className="text-[8px] text-gray-400">
                                  {new Date(alert.msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-gray-600 line-clamp-1 leading-normal">{alert.msg.body}</p>
                              <div className="flex justify-end gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById(`msg-${alert.id}`);
                                    el?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="text-[8px] text-blue-600 hover:underline font-bold"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFollowAlerts(prev => prev.filter(a => a.id !== alert.id))}
                                  className="text-[8px] text-gray-400 hover:text-red-500 font-bold"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Following Users List */}
                    <div className="space-y-2 border-t pt-3">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Following List ({followedUsers.length})</span>
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                        {followedUsers.length === 0 ? (
                          <p className="text-[9px] text-gray-400 py-3 text-center">Not following any users.</p>
                        ) : (
                          followedUsers.map(f => {
                            let isOnline = true;
                            if (f.is_real) {
                              if (f.last_seen) {
                                const diffMs = new Date().getTime() - new Date(f.last_seen).getTime();
                                isOnline = diffMs < 5 * 60 * 1000;
                              } else {
                                isOnline = false;
                              }
                            }
                            return (
                              <div key={f.id} className="flex justify-between items-center py-1 border-b border-gray-100 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                                  <span className="font-bold truncate max-w-[100px]">@{f.target_name}</span>
                                  <span className="text-[8px] text-gray-400 font-semibold shrink-0">
                                    {f.is_real ? (isOnline ? 'online' : 'offline') : 'online (sim)'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUnfollowUser(f.target_name)}
                                  className="text-[9px] text-red-500 hover:underline font-bold"
                                >
                                  Unfollow
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 5: Banned Accounts Log */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('bans')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">🚫</span> Banned Accounts Log
                  </span>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.bans ? 'rotate-180' : ''}`} />
                </button>
                {openAdminSections.bans && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 mt-1">
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {bannedUsers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 py-4 text-center">No banned members yet.</p>
                      ) : (
                        bannedUsers.map(b => (
                          <div key={b.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-xs">
                            <span className="font-bold text-red-650">@{b.user_name}</span>
                            <button
                              type="button"
                              onClick={() => handleUnbanUser(b.user_name)}
                              className="text-[10px] text-emerald-600 hover:underline font-bold"
                            >
                              Unban/Forgive
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 6: Message Timing Speed */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleAdminSection('speed')}
                  className="w-full flex items-center justify-between py-3 px-4 bg-white hover:bg-gray-50 border rounded-2xl shadow-sm transition text-left font-bold text-xs text-gray-900"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">⏱️</span> Message Timing Speed
                  </span>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${openAdminSections.speed ? 'rotate-180' : ''}`} />
                </button>
                {openAdminSections.speed && (
                  <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-3 mt-1">
                    <p className="text-[10px] text-gray-455 leading-normal">Set frequency for simulated message posts.</p>
                    <div className="space-y-2">
                      <select 
                        value={[2000, 5000, 10000, 15000, 30000, 60000, 300000, 600000, 3600000].includes(simSpeedMs) ? simSpeedMs : 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0) {
                            setSimSpeedMs(val);
                            toast.success("Simulation speed updated!");
                          } else {
                            setSimSpeedMs(1000); // Temporary default for custom input
                          }
                        }}
                        className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none bg-white font-medium"
                      >
                        <option value={2000}>2 Seconds (Fastest)</option>
                        <option value={5000}>5 Seconds (Default)</option>
                        <option value={10000}>10 Seconds</option>
                        <option value={15000}>15 Seconds (4/min)</option>
                        <option value={30000}>30 Seconds (2/min)</option>
                        <option value={60000}>1 Minute</option>
                        <option value={300000}>5 Minutes</option>
                        <option value={600000}>10 Minutes</option>
                        <option value={3600000}>1 Hour</option>
                        <option value={0}>Custom Duration</option>
                      </select>

                      {![2000, 5000, 10000, 15000, 30000, 60000, 300000, 600000, 3600000].includes(simSpeedMs) && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Seconds..."
                            defaultValue={Math.floor(simSpeedMs / 1000)}
                            id="custom-speed-input"
                            className="w-full border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-gray-950 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const secs = Number((document.getElementById('custom-speed-input') as HTMLInputElement)?.value);
                              if (!secs || secs < 1) return toast.error("Enter a valid duration (min 1 sec)");
                              setSimSpeedMs(secs * 1000);
                              toast.success(`Speed updated to ${secs}s`);
                            }}
                            className="px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold transition hover:bg-gray-800"
                          >
                            Set
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
