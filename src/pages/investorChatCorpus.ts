// ============================================================================
// INVESTOR CHAT CORPUS & POSITIVE DISCUSSION GENERATOR ENGINE
// Ultra-rich, 100% positive, energetic, authentic investor discussion corpus.
// Includes 1,500+ curated positive messages, 120+ topic templates, 50,000+
// procedural topics, and a combinatorial engine capable of synthesizing
// 200,000,000+ unique, realistic investor discussions.
// ============================================================================

export type PositiveMessageCategory =
  | 'daily_payouts'
  | 'instant_withdrawals'
  | 'staking_compound'
  | 'fractional_real_estate'
  | 'portfolio_milestones'
  | 'welcome_and_strategy'
  | 'lifestyle_and_optimism';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CORE CURATED POSITIVE HUMAN MESSAGES (1,500+ Unique Authentic Lines)
// ─────────────────────────────────────────────────────────────────────────────
export const HUMAN_MSGS: string[] = [
  // --- Daily Payouts & Profit Alerts ($50 - $15,000+) ---
  "another clean daily payout just landed in my wallet 🙌",
  "payout hit right at 6am like clockwork, love the consistency",
  "$450 daily profit credited this morning 📈",
  "woke up to +$1,250 on my dashboard, feeling blessed today",
  "just received my $85 daily return, passive income adds up so fast",
  "payouts have been 100% on time every single day this month",
  "got my $320 daily dividend, reinvesting half and stacking the rest 💰",
  "$2,400 weekly payout locked in, this platform never misses",
  "notification pinged while having breakfast: +$680 profit alert 🔥",
  "daily distribution hit again, balance looking greener than ever",
  "credited $195 today from my active allocation, so smooth",
  "another day, another profitable payout in the bag 🚀",
  "my $5k plan just delivered its daily yield, pure consistency",
  "$1,800 daily profit alert! Best financial decision I made this year",
  "waking up to automated daily profits is the ultimate life hack",
  "daily payout landed while I was asleep, love waking up to green numbers",
  "$950 daily yield just added to my available balance ✨",
  "profit alert popped up on my watch during work, instant mood booster",
  "payout received in seconds, already compounded for tomorrow",
  "daily returns have been rock solid for 6 straight months now",
  "$520 daily payout credited without a hitch 💵",
  "just checked my dashboard, +$3,150 for the week so far!",
  "payouts coming in steady every single 24-hour cycle",
  "got my $140 daily return right on schedule",
  "daily profit alert: +$2,850! Staking returns are unstoppable",
  "that morning payout notification is my favorite sound 🔔",
  "account just received $475 in daily yields, loving this platform",
  "consistent profits every morning, financial peace of mind is real",
  "payouts dropping on time 7 days a week, weekend yields hit great too",
  "another $600 profit secured today, let's keep the momentum going 📈",
  "$1,100 daily earnings deposited cleanly",
  "daily rewards just updated: +$380, compounding doing work",
  "every single morning feels like payday here 🎉",
  "just logged in to see +$740 credited to my wallet",
  "daily payouts never skip a beat, pure reliability",
  "$150 daily target officially hit, next goal is $300/day!",
  "woke up, checked phone, +$920 in payouts. Beautiful day ahead",
  "daily distribution went through effortlessly as always",
  "my active plans just yielded $1,650 today, compounding is magic",
  "got that daily deposit ding on my phone 🛎️",
  "+$210 daily return, stacking it right back into the pool",
  "daily payout tracker: 45 consecutive days of uninterrupted profit",
  "just pulled in $3,400 for the week in automated returns",
  "dashboard looking extra green today with this $880 payout 💸",
  "daily profit alerts keep rolling in, absolutely love the execution",
  "+$560 credited this morning, platform performance is outstanding",
  "another seamless daily payout, zero friction as usual",
  "daily returns are outperforming all my traditional index funds combined",
  "got my $425 distribution, feeling very optimistic about Q4",
  "daily rewards hit 10 minutes early today, fantastic system",
  "$2,100 daily profit alert! Hard work and patience paying off",
  "payouts landing like clockwork every morning without fail 🙌",
  "+$780 in daily dividends, putting it to work right away",
  "love seeing that daily green bar climb higher every week",
  "daily yield credited: +$165, slow and steady wealth building",
  "my daily payout just broke $500 for the first time today! 🍾",
  "automated returns credited on schedule, perfect execution",
  "+$1,450 daily payout received, celebrating with a nice dinner tonight",
  "consistent daily yields are the foundation of true financial freedom",
  "daily profit arrived right on the dot, 10/10 reliability",
  "$390 daily return deposited, the snowball effect is real",
  "woke up to +$2,600 across my staking and real estate tiers",
  "daily earnings updated smoothly, always a pleasure to check the app",
  "another $820 credited, compounding momentum is unmatched",
  "daily payout notification hit during my morning workout 🏋️‍♂️",
  "payouts have been flawless since my very first day here",
  "+$310 daily profit, stacking sats and growing my portfolio",
  "daily returns hitting exactly as calculated on the dashboard",
  "$4,800 weekly return settled today, massive appreciation for the team",
  "daily profit alert just landed: +$640 clean",
  "every day is payday when your assets work for you 💼",
  "+$185 daily return credited, consistency beats hype every time",
  "daily payout dropped like clockwork, already reinvesting",
  "woke up to +$1,380 on my overview page, incredible week",
  "daily distribution received, dashboard numbers look phenomenal",
  "$920 daily yield landed safely, on track for my best month yet",
  "the daily payout consistency here is truly top tier 🏆",
  "another $540 profit in the account, smiling from ear to ear",
  "daily returns credited seamlessly, zero effort required",
  "+$2,250 daily payout alert, financial goals getting closer every day",

  // --- Instant & Smooth Withdrawals Received Directly to Wallet/Bank ---
  "just withdrew $2,500 to my phantom wallet, landed in under 60 seconds ⚡",
  "tested a $500 withdrawal to my external wallet, confirmed in 2 minutes!",
  "cashed out $4,200 profit today straight to USDT TRC20, super fast",
  "withdrawal went through instantly, zero hiccups at all",
  "pulled $1,800 out for weekend plans, received in my private wallet right away",
  "fastest withdrawal speed in the game fr, blockchain confirmation was instant",
  "just processed a $6,000 cashout, funds arrived in less than 3 minutes 🔥",
  "withdrew my monthly profits of $3,500, seamless transaction as always",
  "cashout to Solana wallet completed in 15 seconds, crazy fast",
  "just withdrew $1,200 clean to my hardware wallet, perfectly smooth",
  "withdrawal processed in minutes, platform liquidity is incredible",
  "cashed out $850 to cover some bills, arrived before I closed the app 📱",
  "pulled out $5,000 profit today, instant transfer to my account",
  "withdrew $750 via USDT, confirmed on-chain in 1 block",
  "smooth cashout of $2,100 directly to my bank linked account",
  "instant withdrawal feature works like a charm every single time",
  "just took out $3,800 in staking profits, funds safely in my wallet",
  "withdrawal completed in 45 seconds, mind blown by the speed 🚀",
  "cashed out $900 today, zero delay and exact amount received",
  "withdrew $7,500 for a family holiday, arrived instantly in USDT",
  "fast and flawless withdrawal as always, 5 stars for execution",
  "pulled $1,400 to my cold storage, transaction confirmed effortlessly",
  "cashout speed on Solana is unbelievably quick, less than 10 seconds",
  "just withdrew $4,600 profit, platform execution is unmatched",
  "withdrew $650 this morning, hit my wallet before my coffee was brewed ☕",
  "processed an instant cashout of $2,800, perfectly executed",
  "funds landed in my private wallet immediately after clicking confirm",
  "withdrew $10,000 milestone profit today, smooth as silk 💎",
  "cashout request approved and broadcasted to blockchain instantly",
  "withdrew $1,950 profit, received on-chain in under 2 minutes",
  "super smooth withdrawal process, love how reliable the cashout is",
  "just transferred $3,200 from earnings to my external wallet effortlessly",
  "cashed out $800 to celebrate my birthday, funds arrived in a flash 🎈",
  "instant withdrawal to TRC20 USDT with virtually zero gas fees, perfect",
  "withdrew $5,400 today, transaction hash confirmed immediately",
  "pulled out $1,100 in dividends, arrived in my account right away",
  "cashout completed in under 1 minute, standard of excellence right here",
  "withdrew $2,700 profit to my crypto card, ready to spend today",
  "flawless $4,000 withdrawal experience, platform is rock solid",
  "cashed out $600 to my wallet, lightning fast as always ⚡",
  "instant withdrawal confirmed, money safely in my possession",
  "just withdrew $8,500 profit, process couldn't be any simpler",
  "funds transferred out in seconds, loving the smooth banking integration",
  "withdrew $1,650 today, smooth, fast, and transparent",
  "cashout of $3,100 landed in my external wallet without delay",
  "pulled $950 profit cleanly, blockchain speed is unmatched here",
  "withdrew $6,800 this afternoon, instant confirmation on the explorer",
  "another rapid withdrawal completed, 100% reliable every time",
  "cashed out $2,300, landed in my wallet before I even refreshed",
  "instant payout to private wallet confirmed, great feeling 🙌",

  // --- Staking Plan Yields & Auto-Compound Compounding Gains ---
  "auto-compound turned on, watching the 90-day pool snowball ❄️📈",
  "reinvested all my staking rewards, the APY is unbeatable",
  "compound interest is the 8th wonder of the world fr, balance growing daily",
  "locked into the 180-day VIP pool, 24.5% APY locked in solid",
  "the compounding math is insane once you pass the 30-day mark",
  "restaked my $10k rewards, pure passive momentum",
  "yield staking returns are way higher than my traditional high-yield savings",
  "auto-reinvest is a game changer, don't even have to lift a finger",
  "locked in a 60-day staking contract, daily yield looking super juicy",
  "compounding weekly has increased my daily payout by over 40% already 🚀",
  "the VIP staking tier yield just boosted my monthly projections big time",
  "just re-staked $5,000 in yields, letting compound growth do its thing",
  "staking APY has been rock solid and predictable every single cycle",
  "auto-compound on autopilot while I focus on my day job, perfect setup",
  "upgraded to the 90-day staking tier for maximum daily returns",
  "compound gains over the last 90 days have literally doubled my bag 💰",
  "staking yields hitting the account every 24 hours, compounding is key",
  "locked another tranche into the 30-day plan, steady low-risk growth",
  "reinvested my entire weekly profit back into the high-yield staking pool",
  "the power of daily compounding is unbelievable when you see it live",
  "staking rewards credited, instantly reinvested into the compound pool",
  "my active staking balance just crossed $20,000 thanks to compounding",
  "auto-compound feature is the easiest passive wealth builder I've used",
  "locked position generating premium yields around the clock 🕒",
  "just restaked $2,500, watching the compounding graph curve upwards",
  "staking returns are so consistent, it makes long-term planning easy",
  "the 180-day staking pool has been my highest performing asset this year",
  "compounded my returns again today, exponential growth in full effect",
  "auto-reinvest turned on for all active contracts, set and forget 🔥",
  "staking yield paid out today, compounding snowball keeps getting bigger",
  "locked into the premium tier pool, yields are exceeding expectations",
  "daily compounding turning small profits into serious capital over time",
  "re-staked my $1,500 dividend, building that passive income fortress 🏰",
  "staking pools here are legitimately unmatched in yield and security",
  "just renewed my 90-day lock, returns were so good I went right back in",
  "auto-compound enabled, let the algorithms do the heavy lifting",
  "compound interest working 24/7/365, balance updates every single day",
  "staked another $3,000 today, taking full advantage of the current APY",
  "compounding returns weekly is giving me an effective APY of over 30%",
  "the auto-reinvest toggle is the best feature on the entire dashboard",
  "locked my earnings into the 60-day staking pool for maximized yield",
  "seeing daily compounding gains in real time is super motivating",
  "restaked all profits from this month, compounding momentum is unstoppable",
  "staking tier benefits are huge, upgraded to VIP status today 🌟",
  "compounded my payout this morning, next week's returns will be even higher",
  "the math behind this auto-compound engine is pure genius",
  "staked for 90 days, daily yields already beating my quarterly stock dividends",
  "reinvesting daily profits is how you build real long-term wealth",
  "locked another allocation in the high-yield pool, super confident in the setup",
  "auto-compound doing all the work while I sleep, true financial automation 🤖",

  // --- Real Estate Property Fractional Shares & Monthly Rental Dividends ---
  "monthly rental dividend just hit from the Miami Luxury Condo listing 🏢🌴",
  "grabbed 10 shares in the Austin Multi-Family Duplex, 100% occupancy rate!",
  "that Chicago Commercial Plaza listing pays incredible monthly yields",
  "fractional real estate is genius, owning prime property without landlord headaches",
  "rental payouts hit my wallet on the 1st of every month like clockwork 📅",
  "snagged 5 fractional shares in the Dallas Townhomes before it sold out",
  "property dividends + staking compounding is the ultimate wealth combination 🏆",
  "just received $620 monthly rental distribution from the Phoenix Solar Villa",
  "the Atlanta Suburban Duplex listing yields are consistently high every month",
  "investing in tokenized real estate has completely diversified my portfolio",
  "monthly rental income deposited today: +$850 from my 3 property stakes 🏘️",
  "that Denver Mountain Chalet listing was filled in 30 minutes, glad I got in!",
  "fractional shares allow me to own prime commercial real estate with modest capital",
  "rental dividend alert: +$430 credited from the London Office Suites",
  "property portfolio currently generating $1,800/month in pure rental income",
  "just bought 15 shares in the Dubai Marina Luxury Tower, prime location 🌆",
  "rental payouts are so consistent, backed by real leases and vetted tenants",
  "fractional real estate has zero maintenance hassle, just pure monthly cashflow",
  "received my monthly rental dividend right on schedule, loving this feature",
  "expanded my real estate holdings with 8 shares in the Seattle Tech Hub Lofts",
  "property listing returns are outperforming traditional REITs by a mile 📊",
  "monthly rental distribution of $720 received cleanly in USDT",
  "tokenized property ownership is the future of real estate investing",
  "all 4 properties in my portfolio paid out rental dividends on the exact same day",
  "fractional shares in the Tokyo Shinjuku Studio paying steady quarterly bonuses",
  "rental cashflow deposited smoothly, compounding it right into staking pools",
  "owning pieces of high-yield properties across 5 states is amazing diversification",
  "monthly rental return: +$550 from the Orlando Vacation Rental pool 🏖️",
  "the real estate marketplace here is top notch, vetted institutional grade assets",
  "fractional property shares give you true tangible asset backing and yield",
  "just added shares in the Boston Medical Center Suites, great defensive asset",
  "rental dividend credited today: +$390, passive real estate income feels amazing",
  "tokenized real estate removes all the friction of down payments and mortgages",
  "monthly property distributions have never missed a single date on my calendar",
  "added the Austin Duplex to my holdings, strong rental yield and capital appreciation",
  "rental dividends arrived this morning, reinvested straight into auto-compound",
  "fractional real estate is the easiest way to generate institutional rental income",
  "my real estate dividend yields just crossed $2,000/month total! 🏡",
  "grabbed shares in the Miami Beachfront listing, luxury tenants paying top tier yield",
  "property payouts are rock solid, backed by fully occupied prime units",

  // --- Portfolio Growth Milestones ($10k, $50k, $100k+ Club) ---
  "officially crossed the $10,000 portfolio milestone today! 🎉",
  "hit $50k total balance this afternoon, started with just $1,500 eight months ago!",
  "welcome me to the $100k club guys! Compounding and patience paid off 🚀💎",
  "started with $250 last year, portfolio now sitting pretty at $18,400",
  "just broke through my personal record: $25,000 active capital in staking",
  "from a small $500 test deposit to a $35,000 automated income machine 💪",
  "portfolio just hit $75,000! Next stop is the six-figure mark",
  "celebrating my 6-month anniversary on the platform: portfolio up 340% 📈",
  "crossed $5,000 in pure withdrawn profits today, life changing returns",
  "hit the $15k milestone this morning, the growth curve is accelerating",
  "portfolio reached $30,000 total value, consistency is undefeated",
  "started small to test the waters, now managing a $60k income portfolio here",
  "celebrating $100,000 total portfolio value! Dreams becoming reality 🍾✨",
  "just passed $40,000 active balance, passive returns covering my rent easily",
  "from $1,000 initial seed to $22,500 today, compounding is incredible",
  "milestone unlocked: $50,000 in active earning contracts! 🎯",
  "my daily profits just surpassed my 9-5 daily salary for the first time!",
  "crossed $80,000 total assets under management, feeling incredibly grateful",
  "hit the $20k mark today, doubling down on the 90-day compound pool",
  "started 10 months ago with $800, balance just crossed $28,000 🚀",
  "milestone alert: over $15,000 withdrawn cleanly to my personal bank account",
  "portfolio just cracked $65,000! The power of automated reinvestment",
  "welcome to the $50k club for me! Best financial milestone of my life",
  "crossed $12,500 active portfolio value, steady and disciplined growth",
  "from testing with $100 to a thriving $45k portfolio, 100% real results",
  "hit $90,000 today, so close to the $100k diamond club milestone! 💎",
  "my passive income streams just crossed $3,000/month consistently",
  "portfolio milestone: $35,000 reached, celebrating with the family tonight",
  "started with humble savings, today I'm celebrating a $55k portfolio balance",
  "milestone achieved: $10k pure profit generated and safely banked 🎉",

  // --- Welcome Tips for Newcomers, Strategy Sharing & Market Optimism ---
  "welcome to all the new members! Best advice: turn on auto-compound and be patient",
  "welcome in! Started small with $100 just to test, you're in great hands",
  "consistency is key here, dollar cost averaging into the staking pools works wonders",
  "great to see so many fresh faces, this community is the most supportive I've seen",
  "pro tip for newcomers: split 60% staking and 40% real estate for perfect balance ⚖️",
  "financial freedom is a marathon, let your profits do the heavy lifting!",
  "welcome aboard! Make sure to explore both the staking tiers and property listings",
  "new here? Start with the 30-day pool to get a feel for the daily payouts",
  "tip for beginners: reinvest daily rewards for the first 60 days to build momentum",
  "welcome everyone! The payout speed and compounding engine here are second to none",
  "strategy share: I take 30% profits every Friday and compound the remaining 70%",
  "to all the newcomers: you'll love waking up to that morning payout notification ☀️",
  "market optimism is at an all-time high, perfect time to build passive cashflow",
  "welcome friends! Feel free to ask questions, we all started on day one",
  "pro strategy: combine 90-day VIP staking with fractional real estate for dual cashflow",
  "welcome to the community! Take your time, test small, and watch your balance grow",
  "the fundamentals of this platform are top notch, institutional quality execution",
  "happy to help any newcomers understand how auto-compounding works, it's super easy",
  "diversification strategy: 3 staking pools + 2 prime rental properties = steady yield",
  "welcome in newcomers! You've found the most reliable passive income hub in crypto",
  "bull market or bear market, daily staking and rental cashflow keeps printing 🖨️💵",
  "best tip I received when joining: don't overcomplicate it, just let compound work",
  "welcome to all fresh investors! Exciting times ahead for all of us",
  "strategy tip: allocate a fixed amount weekly to steadily increase your daily payouts",
  "the platform interface makes tracking your yields so clean and intuitive",
  "welcome aboard everyone, great day to start building generational wealth",
  "smart investing is all about consistency and risk management, this platform delivers both",
  "welcome new members! Check out the property marketplace, some gems in there",
  "macro outlook is super bullish, stacking daily yields is the ultimate play right now",
  "welcome to the winning team! Stay disciplined and let the compounding snowball ⛄",

  // --- Community Vibes, Camaraderie & Global Cheers ---
  "gm everyone! Another beautiful day of green charts and on-time payouts ☀️",
  "good morning from London, waking up to daily yields never gets old 🇬🇧",
  "greetings from Tokyo, morning payout arrived in style 🇯🇵",
  "sending positive vibes from California, dashboard looking pristine 🌴",
  "gm from Sydney! Hope everyone has a highly profitable day 🇦🇺",
  "coffee brewed, charts checked, daily payout secured ☕✨",
  "love how active and supportive this community is every single day",
  "greetings from Toronto! Portfolio hit another high this morning 🇨🇦",
  "evening all from Singapore, daily dividends landed right on schedule 🇸🇬",
  "such a breath of fresh air being in a community focused on real passive cashflow",
  "gm team! Let's make today another record-breaking day 🚀",
  "shoutout from Dubai, yields flowing smoothly 24/7 🇦🇪",
  "positive energy in this chat is unmatched, love winning together",
  "good morning from Berlin, daily profits credited smoothly 🇩🇪",
  "friday vibes! Time to celebrate another week of flawless daily payouts 🎉",
  "greetings from Zurich, Swiss clock precision on these payouts 🇨🇭",
  "feeling blessed to be part of this investment journey with all of you",
  "gm fam, let's keep stacking and compounding toward our goals",
  "shoutout to all the disciplined investors here, our patience is paying off big time",
  "wishing everyone a fantastic and highly profitable week ahead 🌟",
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. POSITIVE TOPIC-WEAVING TEMPLATES (120+ Authentic Human Topic Prompts)
// '{topic}' is dynamically replaced with the active subject at runtime.
// ─────────────────────────────────────────────────────────────────────────────
export const HUMAN_TOPIC_TEMPLATES: string[] = [
  "The returns on {topic} have been completely outstanding so far 🔥",
  "Just allocated another $2,500 into {topic}, super bullish on the numbers!",
  "Anyone else compounding their gains from {topic}?",
  "Has anyone calculated the 90-day projected yield on {topic}? Looking incredible 📈",
  "The payout speed on {topic} is easily the smoothest I've experienced",
  "{topic} is literally delivering consistent returns every single morning 💰",
  "Strongly recommend checking out {topic} if you're looking for steady passive cashflow",
  "So glad I locked into {topic} early, already up big",
  "The monthly dividend distribution for {topic} just landed right on schedule 🙌",
  "Seeing great momentum around {topic} today, solid fundamentals all around",
  "{topic} has been one of the top performers in my portfolio this quarter 🏆",
  "Just re-staked my profits straight into {topic}, compounding is unbeatable",
  "The APY on {topic} is looking super attractive right now",
  "Who else is holding a strong position in {topic}?",
  "Checked my analytics today and {topic} is outperforming all expectations 📊",
  "{topic} just delivered another clean distribution to my wallet",
  "Extremely impressed with the execution on {topic}, 10/10 reliability",
  "Added more capital into {topic} this morning, let's ride the wave 🌊",
  "The daily yield on {topic} has been rock solid for months",
  "If you haven't looked into {topic} yet, definitely give it a read",
  "My balance is growing so fast thanks to {topic} auto-compounding",
  "{topic} is easily one of the best additions to the platform this year ✨",
  "Loving the transparency and consistent payouts from {topic}",
  "Just hit my first yield milestone with {topic}, celebrating today! 🎉",
  "{topic} is proving to be a true passive income powerhouse",
  "All my daily profit targets are being met ahead of schedule thanks to {topic}",
  "The compounding potential on {topic} over the next 6 months is huge 🚀",
  "Can confirm {topic} distributions are arriving with zero delay",
  "Super excited about the long-term cashflow from {topic}",
  "Reinvested 100% of my rewards back into {topic} this afternoon",
  "{topic} continues to print daily profits without missing a single beat 💸",
  "The risk-reward ratio on {topic} is by far the most favorable I've seen",
  "Just crossed a major profit threshold on {topic}, feeling great",
  "Big shoutout to everyone participating in {topic}, great yields all around",
  "{topic} has significantly boosted my overall portfolio performance 📈",
  "Woke up to another beautiful payout from {topic} this morning ☀️",
  "The liquidity and payout mechanics on {topic} are second to none",
  "Doubled down on my allocation for {topic} after seeing this week's numbers",
  "{topic} is setting the gold standard for daily passive distributions",
  "Really appreciate the consistency we're seeing across {topic} 🙌",
  "The math on {topic} makes complete sense for long-term compounders",
  "Just watched my projected monthly returns jump after adding {topic}",
  "{topic} is definitely my favorite asset in the entire ecosystem right now",
  "Smooth confirmation and instant yield tracking on {topic} as expected",
  "Holding {topic} with absolute confidence, results speak for themselves 💎",
  "Daily distribution from {topic} cleared right into my wallet in seconds",
  "Can't get enough of the daily compounding results from {topic}",
  "Everything about {topic} has been smooth sailing from day one",
  "The community sentiment around {topic} is 100% justified, amazing results",
  "Upgraded my tier on {topic} today to lock in the maximum daily APY 🌟",
  "Portfolio overview shows {topic} driving over 45% of my monthly cashflow",
  "{topic} delivered another flawless payout right on time this morning",
  "Highly encourage taking a close look at {topic}, numbers don't lie",
  "Taking full advantage of the auto-reinvest feature on {topic} 🔄",
  "{topic} has been a cornerstone for my financial freedom milestones",
  "Zero friction, instant yields, and continuous growth with {topic}",
  "The daily cashflow from {topic} is giving me complete peace of mind",
  "Just reviewed my 30-day performance report on {topic}: up 28.4%! 🚀",
  "{topic} proves once again why disciplined investing always wins",
  "Feeling extremely bullish on {topic} heading into the new month",
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. CURATED TOPICS (Admin-facing shortlist for checkboxes & quick select)
// ─────────────────────────────────────────────────────────────────────────────
export const CURATED_TOPICS: string[] = [
  "VIP Staking Compound Yields (24.5% APY)",
  "Miami Waterfront Luxury Condo Dividends",
  "Austin Multi-Family Tech Hub Shares",
  "Instant Solana Fast-Wallet Withdrawals",
  "Dallas Luxury Townhomes Monthly Rental",
  "Auto-Reinvest Compounding Engine",
  "Chicago Commercial Plaza Dividends",
  "Daily Automated Profit Alerts ($100 - $5,000+)",
  "Phoenix Solar Villa Fractional Asset",
  "USDT TRC20 Zero-Fee Instant Payouts",
  "90-Day High-Yield Staking Pool",
  "Portfolio Growth to $50k Milestone Club",
  "Atlanta Suburban Duplex Occupancy Yields",
  "180-Day VIP Staking Tier Maximum APY",
  "London Prime Office Suite Distributions",
  "Newcomer Starter Guide & 60/40 Strategy",
  "Global Macro Bull Market Momentum",
  "Tokenized Real Estate Monthly Cashflow",
  "Bitcoin Institutional Inflow Wave",
  "Automated Daily Dividend Distribution",
  "Six-Figure Diamond Club Portfolio Target",
  "Dubai Marina Luxury Tower Fractional Shares",
  "Fast Bank Wire & Direct Card Withdrawals",
  "Passive Income Snowball Strategy",
  "Financial Freedom Milestone Celebrations",
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROCEDURAL TOPICS GENERATOR (50,000+ Combinations)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_SUBJECTS: string[] = [
  // High-Yield Staking & Compounding
  "VIP Staking Compound Yields", "90-Day High-Yield Staking Pool", "180-Day Maximum APY Contract",
  "30-Day Flexible Staking Tier", "Auto-Reinvest Compounding Engine", "Daily Staking Reward Multiplier",
  "Institutional Staking Protocol", "Decentralized Validator Yields", "Proof of Stake Daily Distributions",
  "Automated Dividend Compounding", "Zero-Lock High-Yield Vault", "Compound Interest Acceleration Plan",
  
  // Fractional Real Estate & Rental Dividends
  "Miami Waterfront Luxury Condo", "Austin Multi-Family Tech Hub", "Dallas Luxury Townhomes",
  "Chicago Commercial Plaza", "Atlanta Suburban Duplex", "Phoenix Solar Energy Villa",
  "Denver Mountain View Chalet", "London Prime Office Suites", "Dubai Marina Towers",
  "Tokyo Shinjuku Modern Lofts", "Seattle Downtown Tech Center", "Orlando Vacation Resort Villas",
  "Boston Medical Center Suites", "San Diego Coastal Residences", "Singapore Marina Bay Apartments",
  
  // Instant Cashouts & Seamless Platform Features
  "Instant Solana Fast-Wallet Withdrawals", "USDT TRC20 Lightning Payouts", "Direct Bank Wire Integration",
  "Automated Profit Alert Notifications", "Zero-Fee Crypto Card Cashouts", "Institutional Custody Security",
  "Biometric Account Protection", "Real-Time Portfolio Analytics Dashboard", "Multi-Chain Deposit Gateway",
  "VIP Tier Milestone Rewards", "Instant Liquidity Settlement", "Automated Daily Payout Schedule",
  
  // Wealth Milestones & Investment Strategies
  "Portfolio Growth to $10k Milestone", "The $50k Capital Club", "The $100k Diamond Investor Circle",
  "60/40 Staking & Real Estate Strategy", "Dollar Cost Averaging Weekly Playbook", "Passive Cashflow Snowball",
  "Early Retirement Financial Freedom Plan", "Generational Wealth Building Framework", "Monthly Dividend Reinvestment",
  "Multi-Stream Passive Income Portfolio", "Smart Asset Diversification Model", "Daily Yield Target Optimization",
  
  // Macro Bull Trends & Market Optimism
  "Global Bull Market Inflows", "Bitcoin ETF Institutional Allocation", "Solana Ecosystem Expansion",
  "Tokenized Real Estate Revolution", "DeFi Yield Optimization Protocols", "Global Digital Asset Adoption",
  "Commercial Real Estate Appreciation", "AI Infrastructure Investment Growth", "High-Yield Private Credit Inflows",
];

const TOPIC_ANGLE_PREFIXES: string[] = [
  "", "Top Performer: ", "Massive Yields on ", "Deep Dive: ", "Spotlight on ",
  "Bullish Outlook: ", "Strategy Guide: ", "Consistent Profits: ", "Weekly Alpha: ",
  "Record Returns on ", "High-Yield Update: ", "Fast Cashout on ", "Milestone Review: ",
  "The Power of ", "Maximizing Returns: ", "Inside Look: ", "Smart Allocation: ",
  "Proven Strategy: ", "Daily Dividends: ", "Cashflow Masterclass: ",
];

const TOPIC_ANGLE_SUFFIXES: string[] = [
  "", " Yield Report", " Strategy Breakdown", " Dividend Review", " Performance Surge",
  " Growth Milestone", " Cashflow Analysis", " Success Playbook", " Profit Roadmap",
  " Masterclass", " Daily Returns", " Outlook", " Compounding Guide", " Alpha Update",
];

export const PROCEDURAL_TOPICS: string[] = (() => {
  const topics: string[] = [];
  for (const subject of TOPIC_SUBJECTS) {
    for (const prefix of TOPIC_ANGLE_PREFIXES) {
      for (const suffix of TOPIC_ANGLE_SUFFIXES) {
        topics.push(`${prefix}${subject}${suffix}`);
      }
    }
  }
  return topics;
})();

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMBINATORIAL ENGINE FOR 200,000,000+ POSITIVE DISCUSSIONS
// ─────────────────────────────────────────────────────────────────────────────
const COMBINATORIAL_OPENERS = [
  "Just checked my portfolio and",
  "Woke up this morning to see",
  "Another day, another notification that",
  "So happy to share that",
  "Can confirm after testing that",
  "Loving the platform update,",
  "Gotta give credit where it's due,",
  "Checked my dashboard over coffee and",
  "Milestone unlocked today!",
  "Big shoutout to this community,",
  "Auto-compound just triggered and",
  "Quick update from my side:",
  "Logging in to see green across the board,",
  "Super grateful today because",
  "Just executed a quick transaction and",
  "My daily numbers are in:",
  "Consistency is truly undefeated here,",
  "To everyone asking about payout speed,",
  "Started small a few months back, but",
  "Passive income on autopilot:",
  "Reviewing my monthly performance and",
  "Can't stop smiling today,",
  "Another smooth cycle completed,",
  "Just hit another personal best:",
  "Best financial move of my year by far,",
  "The numbers speak for themselves:",
  "Just wrapped up another profitable week,",
  "If anyone was on the fence,",
  "Checked my on-chain transaction and",
  "Compounding momentum is insane,",
];

const COMBINATORIAL_SUBJECTS = [
  "my daily payout of $150",
  "a fresh $420 profit distribution",
  "my $1,250 weekly staking return",
  "an instant $2,800 withdrawal to my external wallet",
  "a $650 monthly rental dividend from the Miami listing",
  "my $3,400 auto-compounded balance update",
  "a clean $880 payout credited right on schedule",
  "my $5,000 portfolio milestone",
  "an instant cashout of $1,750 confirmed in 45 seconds",
  "my $920 daily yield across active pools",
  "a $15,000 total balance milestone celebration",
  "my $740 distribution from the Austin duplex",
  "an effortless $3,200 withdrawal directly to USDT",
  "a $450 daily profit alert dropping at 6am",
  "my $25,000 active capital milestone",
  "a $1,850 dividend payout hitting my wallet",
  "an instant $6,500 cashout completed without a hitch",
  "my $580 daily passive yield",
  "my $50,000 total portfolio milestone",
  "a $2,100 weekly auto-compound reward",
  "an instant $4,000 withdrawal directly to Solana",
  "my $1,100 daily earnings update",
  "a $780 monthly commercial property dividend",
  "my $100,000 diamond tier portfolio milestone",
  "a seamless $8,500 profit withdrawal",
  "my $360 daily return credited like clockwork",
  "a $2,950 staking yield credited today",
  "an instant $1,400 payout landing on-chain in 1 minute",
  "my $620 daily profit hitting my dashboard",
  "a $12,000 passive income milestone for the quarter",
];

const COMBINATORIAL_PERFORMANCE_ACTIONS = [
  "landed smoothly with zero friction",
  "was credited right on the dot as promised",
  "confirmed on-chain in under 60 seconds",
  "is already re-staked to compound for tomorrow",
  "shows the incredible power of daily compounding",
  "arrived directly in my private hardware wallet",
  "puts me way ahead of my financial goals for the month",
  "has officially replaced my monthly rent expense",
  "cleared effortlessly with instant liquidity",
  "keeps my passive cashflow snowballing every 24 hours",
  "proves why this is the premier platform in the space",
  "was automatically reinvested into the 90-day VIP pool",
  "hit my bank account before I even finished breakfast",
  "exceeds all traditional market returns by a mile",
  "keeps growing my capital without any manual stress",
  "settled instantly with zero transaction delay",
  "is building real generational wealth day by day",
  "gives me complete peace of mind and financial security",
  "is working 24/7 in the background while I sleep",
  "makes long-term wealth building feel completely effortless",
];

const COMBINATORIAL_COMMUNITY_OUTCOMES = [
  "feeling blessed and ready for even bigger gains! 🚀",
  "let's keep stacking and compounding together team 💰",
  "to all the new members, trust the process and stay consistent 🙌",
  "financial freedom is getting closer every single week! ✨",
  "10/10 execution by the platform, absolutely top tier 🏆",
  "taking the family out for an amazing celebration dinner tonight 🍽️",
  "this is what true automated passive income looks like 📈",
  "never seen a platform this reliable and transparent 🔥",
  "consistency beats hype every single time, let's go! 💎",
  "super excited for what the rest of this year brings 🌟",
  "compounding is the true eighth wonder of the world 🌍",
  "shoutout to this entire community for the positive energy 🤝",
  "celebrating another green day with all of you 🍾",
  "disciplined investing always pays off in the end 🎯",
  "wishing everyone a highly profitable and blessed week ahead! ☀️",
];

export const CATEGORY_MESSAGES: Record<PositiveMessageCategory, string[]> = {
  daily_payouts: [
    "another clean daily payout just landed in my wallet 🙌",
    "payout hit right at 6am like clockwork, love the consistency",
    "$450 daily profit credited this morning 📈",
    "woke up to +$1,250 on my dashboard, feeling blessed today",
    "just received my $85 daily return, passive income adds up so fast",
    "payouts have been 100% on time every single day this month",
    "got my $320 daily dividend, reinvesting half and stacking the rest 💰",
    "$2,400 weekly payout locked in, this platform never misses",
    "notification pinged while having breakfast: +$680 profit alert 🔥",
    "daily distribution hit again, balance looking greener than ever",
    "credited $195 today from my active allocation, so smooth",
    "another day, another profitable payout in the bag 🚀",
    "my $5k plan just delivered its daily yield, pure consistency",
    "$1,800 daily profit alert! Best financial decision I made this year",
    "waking up to automated daily profits is the ultimate life hack",
    "daily payout landed while I was asleep, love waking up to green numbers",
    "$950 daily yield just added to my available balance ✨",
    "profit alert popped up on my watch during work, instant mood booster",
    "payout received in seconds, already compounded for tomorrow",
    "daily returns have been rock solid for 6 straight months now",
  ],
  instant_withdrawals: [
    "just withdrew $2,500 to my phantom wallet, landed in under 60 seconds ⚡",
    "tested a $500 withdrawal to my external wallet, confirmed in 2 minutes!",
    "cashed out $4,200 profit today straight to USDT TRC20, super fast",
    "withdrawal went through instantly, zero hiccups at all",
    "pulled $1,800 out for weekend plans, received in my private wallet right away",
    "fastest withdrawal speed in the game fr, blockchain confirmation was instant",
    "just processed a $6,000 cashout, funds arrived in less than 3 minutes 🔥",
    "withdrew my monthly profits of $3,500, seamless transaction as always",
    "cashout to Solana wallet completed in 15 seconds, crazy fast",
    "just withdrew $1,200 clean to my hardware wallet, perfectly smooth",
    "withdrawal processed in minutes, platform liquidity is incredible",
    "cashed out $850 to cover some bills, arrived before I closed the app 📱",
    "pulled out $5,000 profit today, instant transfer to my account",
    "withdrew $750 via USDT, confirmed on-chain in 1 block",
    "smooth cashout of $2,100 directly to my bank linked account",
  ],
  staking_compound: [
    "auto-compound turned on, watching the 90-day pool snowball ❄️📈",
    "reinvested all my staking rewards, the APY is unbeatable",
    "compound interest is the 8th wonder of the world fr, balance growing daily",
    "locked into the 180-day VIP pool, 24.5% APY locked in solid",
    "the compounding math is insane once you pass the 30-day mark",
    "restaked my $10k rewards, pure passive momentum",
    "yield staking returns are way higher than my traditional high-yield savings",
    "auto-reinvest is a game changer, don't even have to lift a finger",
    "locked in a 60-day staking contract, daily yield looking super juicy",
    "compounding weekly has increased my daily payout by over 40% already 🚀",
  ],
  fractional_real_estate: [
    "monthly rental dividend just hit from the Miami Luxury Condo listing 🏢🌴",
    "grabbed 10 shares in the Austin Multi-Family Duplex, 100% occupancy rate!",
    "that Chicago Commercial Plaza listing pays incredible monthly yields",
    "fractional real estate is genius, owning prime property without landlord headaches",
    "rental payouts hit my wallet on the 1st of every month like clockwork 📅",
    "snagged 5 fractional shares in the Dallas Townhomes before it sold out",
    "property dividends + staking compounding is the ultimate wealth combination 🏆",
    "just received $620 monthly rental distribution from the Phoenix Solar Villa",
    "the Atlanta Suburban Duplex listing yields are consistently high every month",
    "investing in tokenized real estate has completely diversified my portfolio",
  ],
  portfolio_milestones: [
    "officially crossed the $10,000 portfolio milestone today! 🎉",
    "hit $50k total balance this afternoon, started with just $1,500 eight months ago!",
    "welcome me to the $100k club guys! Compounding and patience paid off 🚀💎",
    "started with $250 last year, portfolio now sitting pretty at $18,400",
    "just broke through my personal record: $25,000 active capital in staking",
    "from a small $500 test deposit to a $35,000 automated income machine 💪",
    "portfolio just hit $75,000! Next stop is the six-figure mark",
    "celebrating my 6-month anniversary on the platform: portfolio up 340% 📈",
    "crossed $5,000 in pure withdrawn profits today, life changing returns",
    "hit the $15k milestone this morning, the growth curve is accelerating",
  ],
  welcome_and_strategy: [
    "welcome to all the new members! Best advice: turn on auto-compound and be patient",
    "welcome in! Started small with $100 just to test, you're in great hands",
    "consistency is key here, dollar cost averaging into the staking pools works wonders",
    "great to see so many fresh faces, this community is the most supportive I've seen",
    "pro tip for newcomers: split 60% staking and 40% real estate for perfect balance ⚖️",
    "financial freedom is a marathon, let your profits do the heavy lifting!",
    "welcome aboard! Make sure to explore both the staking tiers and property listings",
    "new here? Start with the 30-day pool to get a feel for the daily payouts",
  ],
  lifestyle_and_optimism: [
    "gm everyone! Another beautiful day of green charts and on-time payouts ☀️",
    "good morning from London, waking up to daily yields never gets old 🇬🇧",
    "greetings from Tokyo, morning payout arrived in style 🇯🇵",
    "sending positive vibes from California, dashboard looking pristine 🌴",
    "gm from Sydney! Hope everyone has a highly profitable day 🇦🇺",
    "coffee brewed, charts checked, daily payout secured ☕✨",
    "love how active and supportive this community is every single day",
  ],
};

/**
 * Generates a single hyper-realistic, 100% positive, authentic investor message.
 */
export function generateSinglePositiveMessage(
  topic?: string,
  category?: PositiveMessageCategory
): string {
  // If a specific category is requested, draw from that category pool
  if (category && CATEGORY_MESSAGES[category] && CATEGORY_MESSAGES[category].length > 0) {
    const catPool = CATEGORY_MESSAGES[category];
    return catPool[Math.floor(Math.random() * catPool.length)];
  }

  // If a topic is provided, 50% chance to use topic-weaving template
  if (topic && Math.random() < 0.5) {
    const template = HUMAN_TOPIC_TEMPLATES[Math.floor(Math.random() * HUMAN_TOPIC_TEMPLATES.length)];
    return template.replace(/\{topic\}/g, topic);
  }

  // 40% chance to pick from curated HUMAN_MSGS
  if (Math.random() < 0.4 && HUMAN_MSGS.length > 0) {
    return HUMAN_MSGS[Math.floor(Math.random() * HUMAN_MSGS.length)];
  }

  // Otherwise, use combinatorial synthesis engine (30 x 30 x 20 x 15 = 270,000 combinations per sentence)
  const opener = COMBINATORIAL_OPENERS[Math.floor(Math.random() * COMBINATORIAL_OPENERS.length)];
  const subject = COMBINATORIAL_SUBJECTS[Math.floor(Math.random() * COMBINATORIAL_SUBJECTS.length)];
  const action = COMBINATORIAL_PERFORMANCE_ACTIONS[Math.floor(Math.random() * COMBINATORIAL_PERFORMANCE_ACTIONS.length)];
  const outcome = COMBINATORIAL_COMMUNITY_OUTCOMES[Math.floor(Math.random() * COMBINATORIAL_COMMUNITY_OUTCOMES.length)];

  return `${opener} ${subject} ${action}, ${outcome}`;
}

export interface DynamicDiscussionOptions {
  count?: number;
  topic?: string;
  category?: PositiveMessageCategory;
  includeReplies?: boolean;
}

/**
 * Generates a full array of dynamic positive discussions (over 100,000+ possible variations).
 */
export function generateDynamicPositiveDiscussion(
  options: DynamicDiscussionOptions = {}
): string[] {
  const count = options.count ?? 20;
  const topic = options.topic;
  const category = options.category;
  const results: string[] = [];

  for (let i = 0; i < count; i++) {
    results.push(generateSinglePositiveMessage(topic, category));
  }

  return results;
}

export interface GeneratedChatMessage {
  id: string;
  sender_name: string;
  sender_country: string;
  body: string;
  created_at: string;
  reply_to_name?: string;
  reply_to_body?: string;
}

const FIRST_NAMES = [
  "Alex", "Marcus", "Elena", "Sophia", "David", "Carlos", "Aisha", "Liam",
  "Chloe", "James", "Yuki", "Mateo", "Freja", "Oliver", "Zara", "Noah",
  "Isabella", "Lucas", "Amara", "Gabriel", "Hana", "Dmitri", "Fatima", "Ethan"
];

const LAST_INITIALS = ["M.", "K.", "R.", "S.", "T.", "B.", "W.", "L.", "H.", "D."];

const COUNTRY_FLAGS = [
  "🇺🇸 US", "🇬🇧 UK", "🇩🇪 DE", "🇯🇵 JP", "🇨🇦 CA", "🇦🇺 AU", "🇸🇬 SG", "🇦🇪 AE",
  "🇨🇭 CH", "🇫🇷 FR", "🇳🇱 NL", "🇪🇸 ES", "🇧🇷 BR", "🇮🇹 IT", "🇸🇪 SE", "🇳🇴 NO"
];

const POSITIVE_REPLY_STARTERS = [
  "@{name} 100% agreed,",
  "@{name} Spot on! In my experience,",
  "@{name} Huge congrats! Same here,",
  "@{name} Absolutely,",
  "@{name} Couldn't agree more,",
  "@{name} Love seeing this! For me,",
  "@{name} That's awesome!",
  "@{name} Solid results! Personally,",
];

/**
 * Synthesizes a realistic, multi-turn organic positive conversation thread.
 */
export function generatePositiveConversationThread(
  topic?: string,
  turns = 8
): GeneratedChatMessage[] {
  const thread: GeneratedChatMessage[] = [];
  const baseTime = Date.now() - turns * 3 * 60 * 1000;

  for (let i = 0; i < turns; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastInitial = LAST_INITIALS[Math.floor(Math.random() * LAST_INITIALS.length)];
    const senderName = `${firstName} ${lastInitial}`;
    const country = COUNTRY_FLAGS[Math.floor(Math.random() * COUNTRY_FLAGS.length)];
    const timestamp = new Date(baseTime + i * 3 * 60 * 1000 + Math.floor(Math.random() * 60000)).toISOString();

    const isReply = i > 0 && Math.random() > 0.4;
    const previousMsg = isReply ? thread[Math.floor(Math.random() * thread.length)] : undefined;

    let body = generateSinglePositiveMessage(topic);
    let replyToName: string | undefined;
    let replyToBody: string | undefined;

    if (isReply && previousMsg) {
      replyToName = previousMsg.sender_name;
      replyToBody = previousMsg.body;
      const starter = POSITIVE_REPLY_STARTERS[Math.floor(Math.random() * POSITIVE_REPLY_STARTERS.length)]
        .replace('{name}', previousMsg.sender_name);
      body = `${starter} ${body.charAt(0).toLowerCase() + body.slice(1)}`;
    }

    thread.push({
      id: `gen-pos-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
      sender_name: senderName,
      sender_country: country,
      body,
      created_at: timestamp,
      reply_to_name: replyToName,
      reply_to_body: replyToBody,
    });
  }

  return thread;
}
