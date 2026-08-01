/**
 * 🗡 افسانه‌ی گروه (نسخه ۴.۲) — ربات RPG کامل برای گروه‌های تلگرام
 * ------------------------------------------------------------------
 * قابلیت‌ها:
 *  ۱. سیستم کلاس‌ها (جنگجو/جادوگر/تیرانداز)
 *  ۲. فروشگاه با سلاح/زره/معجون (با رتبه‌بندی کیفیت)
 *  ۳. سیستم پیشه‌ها (آهنگر/کیمیاگر/بازرگان/شکارچی)
 *  ۴. سیستم پت (حیوان همراه با قابلیت‌های مختلف و سطح‌گیری)
 *  ۵. سیستم ماموریت‌های روزانه
 *  ۶. سیستم کرفتینگ (ساخت آیتم) — رفع باگ کامل
 *  ۷. سیستم گیلد (گروه‌های بازیکنی) — با امکان جوین از لیست
 *  ۸. سیستم PvP (نبرد بین بازیکنان)
 *  ۹. سیستم رتبه‌بندی چندگانه
 *  ۱۰. سیستم جایزه‌ی روزانه با استریک
 *  ۱۱. سیستم حالت سخت
 *  ۱۲. سیستم داستان‌سرایی (۹ فصل کامل) — رفع باگ پرش فصل
 *  ۱۳. سیستم بازار آزاد بین بازیکنان
 *  ۱۴. سیستم بهبودی با طلا
 *  ۱۵. سیستم ضربه‌ی بحرانی
 *  ۱۶. سیستم هیولاها با شانس باس
 *  ۱۷. نمایش انباشته‌ی آیتم‌های تکراری در کوله
 *  ۱۸. ذخیره‌سازی هوشمند (فقط فایل‌های تغییرکرده)
 * 
 * ذخیره‌سازی: فایل‌های JSON (players.json, guilds.json, market.json)
 * کنترل: کاملاً کیبوردی (بدون نیاز به تایپ)
 */

const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
require('dotenv').config();

// ============================================================
//                      مسیرهای فایل‌ها
// ============================================================

const PATHS = {
  PLAYERS: path.join(__dirname, 'players.json'),
  GUILDS: path.join(__dirname, 'guilds.json'),
  MARKET: path.join(__dirname, 'market.json'),
};

// ============================================================
//                      ایجاد فایل‌های خالی
// ============================================================

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf-8');
    console.log(`📁 فایل ${path.basename(filePath)} ایجاد شد.`);
  }
}

ensureFile(PATHS.PLAYERS);
ensureFile(PATHS.GUILDS);
ensureFile(PATHS.MARKET);

// ============================================================
//                      بارگذاری و ذخیره‌سازی
// ============================================================

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`⚠️ خطا در خواندن ${path.basename(filePath)}:`, err.message);
  }
  return {};
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`⚠️ خطا در ذخیره ${path.basename(filePath)}:`, err.message);
  }
}

// ============================================================
//                      داده‌های اصلی با پرچم تغییر
// ============================================================

let players = loadJSON(PATHS.PLAYERS);
let guilds = loadJSON(PATHS.GUILDS);
let market = loadJSON(PATHS.MARKET);

let playersChanged = false;
let guildsChanged = false;
let marketChanged = false;

function markPlayersChanged() {
  playersChanged = true;
}

function markGuildsChanged() {
  guildsChanged = true;
}

function markMarketChanged() {
  marketChanged = true;
}

function saveAllData() {
  if (playersChanged) {
    saveJSON(PATHS.PLAYERS, players);
    playersChanged = false;
  }
  if (guildsChanged) {
    saveJSON(PATHS.GUILDS, guilds);
    guildsChanged = false;
  }
  if (marketChanged) {
    saveJSON(PATHS.MARKET, market);
    marketChanged = false;
  }
}

// ============================================================
//                      توابع کمکی پایه
// ============================================================

function getPlayerKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function getPlayerByCtx(ctx) {
  const key = getPlayerKey(ctx.chat.id, ctx.from.id);
  return players[key] || null;
}

function savePlayerByCtx(ctx, playerData) {
  const key = getPlayerKey(ctx.chat.id, ctx.from.id);
  players[key] = playerData;
  markPlayersChanged();
  saveAllData();
}

function getPlayerByKey(key) {
  return players[key] || null;
}

function savePlayerByKey(key, playerData) {
  players[key] = playerData;
  markPlayersChanged();
  saveAllData();
}

// ============================================================
//                      دکمه‌های شیشه‌ای
// ============================================================

function styledButton(text, callbackData, style) {
  const button = { text, callback_data: callbackData };
  if (style) {
    button.style = style;
  }
  return button;
}

function keyboard(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

function backButton(callbackData = 'menu_main') {
  return keyboard([[styledButton('« بازگشت', callbackData, 'primary')]]);
}

// ============================================================
//                      کلاس‌های شخصیت
// ============================================================

const CLASSES = {
  warrior: {
    label: 'جنگجو',
    emoji: '⚔️',
    hp: 40,
    atk: 8,
    def: 5,
    desc: 'سلامتی و دفاع بالا'
  },
  mage: {
    label: 'جادوگر',
    emoji: '🔮',
    hp: 26,
    atk: 12,
    def: 2,
    desc: 'قدرت حمله‌ی بالا'
  },
  archer: {
    label: 'تیرانداز',
    emoji: '🏹',
    hp: 32,
    atk: 10,
    def: 3,
    desc: 'متعادل'
  }
};

// ============================================================
//                      آیتم‌های فروشگاه
// ============================================================

const RARITY_LABELS = {
  common: 'عادی',
  rare: '🔷 کمیاب',
  epic: '🟣 حماسی',
  legendary: '🟡 افسانه‌ای',
  mythic: '🔥 اسطوره‌ای'
};

const WEAPONS = [
  { id: 'w1', label: '🗡 خنجر زنگ‌زده', type: 'weapon', rarity: 'common', atkBonus: 2, price: 15 },
  { id: 'w2', label: '⚔️ شمشیر آهنی', type: 'weapon', rarity: 'common', atkBonus: 4, price: 40 },
  { id: 'w3', label: '🔷 شمشیر نقره‌ای', type: 'weapon', rarity: 'rare', atkBonus: 9, price: 120 },
  { id: 'w4', label: '🟣 تبر جنگی حماسی', type: 'weapon', rarity: 'epic', atkBonus: 14, price: 220 },
  { id: 'w5', label: '🐉 نیزه‌ی اژدها', type: 'weapon', rarity: 'legendary', atkBonus: 20, price: 400 },
  { id: 'w6', label: '🔥 شمشیر ققنوس', type: 'weapon', rarity: 'mythic', atkBonus: 28, price: 700 }
];

const ARMORS = [
  { id: 'a1', label: '🥋 زره چرمی', type: 'armor', rarity: 'common', defBonus: 2, price: 30 },
  { id: 'a2', label: '🛡 زره آهنی', type: 'armor', rarity: 'common', defBonus: 5, price: 90 },
  { id: 'a3', label: '🔷 زره نقره‌ای', type: 'armor', rarity: 'rare', defBonus: 9, price: 180 },
  { id: 'a4', label: '🐲 زره فلس اژدها', type: 'armor', rarity: 'epic', defBonus: 15, price: 350 }
];

const CONSUMABLES = [
  { id: 'c1', label: '🧪 معجون سلامتی', type: 'consumable', effect: 'heal', price: 15, desc: '۴۰٪ سلامتی بازیابی' },
  { id: 'c2', label: '💥 معجون قدرت', type: 'consumable', effect: 'power', price: 25, desc: '۵۰٪ حمله بیشتر یک نبرد' },
  { id: 'c3', label: '🍀 طلسم شانس', type: 'consumable', effect: 'luck', price: 25, desc: 'شانس ضربه‌ی بحرانی بیشتر' },
  { id: 'c4', label: '✨ سنگ احیا', type: 'consumable', effect: 'revive', price: 60, desc: 'یک‌بار نجات در نبرد' }
];

const ALL_ITEMS = [...WEAPONS, ...ARMORS, ...CONSUMABLES];

function findItemById(itemId) {
  return ALL_ITEMS.find(item => item.id === itemId);
}

// ============================================================
//                      پیشه‌ها (Professions)
// ============================================================

const PROFESSIONS = {
  blacksmith: {
    name: '⚒️ آهنگر',
    desc: 'تخفیف ۲۰٪ در خرید سلاح و زره',
    ability: 'تعمیر زره (۵۰٪ دفاع بیشتر یک نبرد)',
    price: 100,
    bonus: { shopDiscount: 0.2, repair: true }
  },
  alchemist: {
    name: '🧪 کیمیاگر',
    desc: 'تخفیف ۲۰٪ در خرید معجون',
    ability: 'ساخت معجون تصادفی هر ۳ نبرد',
    price: 100,
    bonus: { shopDiscount: 0.2, potionCraft: true }
  },
  merchant: {
    name: '💰 بازرگان',
    desc: 'فروش آیتم‌ها با ۸۰٪ قیمت',
    ability: 'یک‌بار تخفیف ویژه روزانه',
    price: 150,
    bonus: { sellMultiplier: 1.3, dailyDeal: true }
  },
  hunter: {
    name: '🏹 شکارچی',
    desc: '۲۰٪ شانس پیدا کردن آیتم بعد از نبرد',
    ability: 'ردیابی باس (شانس باس ۲×)',
    price: 150,
    bonus: { dropChance: 0.2, bossChance: 2 }
  }
};

// ============================================================
//                      پت‌ها (Pets) با قابلیت سطح‌گیری
// ============================================================

const PETS = {
  wolf: {
    name: '🐺 گرگ خاکستری',
    type: 'atk',
    value: 3,
    price: 100,
    desc: '+۳ حمله دائمی',
    level: 1,
    xp: 0,
    xpNeeded: 20
  },
  phoenix: {
    name: '🔥 ققنوس کوچک',
    type: 'revive',
    value: 1,
    price: 300,
    desc: 'یک‌بار احیا در هر نبرد',
    level: 1,
    xp: 0,
    xpNeeded: 30
  },
  dragon: {
    name: '🐉 اژدهای زاده',
    type: 'all',
    value: 2,
    price: 500,
    desc: '+۲ به همه چیز',
    level: 1,
    xp: 0,
    xpNeeded: 40
  },
  fairy: {
    name: '🧚 پری جنگل',
    type: 'heal',
    value: 15,
    price: 200,
    desc: 'هر راند ۱۵٪ شانس بهبودی',
    level: 1,
    xp: 0,
    xpNeeded: 25
  }
};

// ============================================================
//                      ماموریت‌ها (Quests)
// ============================================================

const QUEST_TEMPLATES = [
  { id: 'q1', name: 'شکارچی مبتدی', desc: '۳ هیولا بکش', target: 3, type: 'kill', reward: { gold: 30, xp: 20 } },
  { id: 'q2', name: 'شکارچی حرفه‌ای', desc: '۱۰ هیولا بکش', target: 10, type: 'kill', reward: { gold: 80, xp: 50 } },
  { id: 'q3', name: 'باس‌کش', desc: '۱ باس بکش', target: 1, type: 'boss', reward: { gold: 100, xp: 80 } },
  { id: 'q4', name: 'ثروتمند', desc: '۲۰۰ طلا جمع کن', target: 200, type: 'gold', reward: { gold: 40, xp: 30 } },
  { id: 'q5', name: 'تجهیزات‌باز', desc: '۳ آیتم بخر', target: 3, type: 'buy', reward: { gold: 50, xp: 25 } },
  { id: 'q6', name: 'کامل‌گرا', desc: '۵ نبرد ببر', target: 5, type: 'win', reward: { gold: 60, xp: 40 } },
  { id: 'q7', name: 'پت‌پرور', desc: 'پتت رو به سطح ۳ برسون', target: 3, type: 'petLevel', reward: { gold: 70, xp: 50 } },
  { id: 'q8', name: 'PvP‌باز', desc: '۲ نبرد PvP ببر', target: 2, type: 'pvp', reward: { gold: 90, xp: 60 } }
];

// ============================================================
//                      دستورهای کرفتینگ
// ============================================================

const RECIPES = [
  {
    id: 'recipe_w3',
    name: '⚔️ شمشیر نقره‌ای',
    result: 'w3',
    ingredients: ['w2', 'w2', 'a2'],
    cost: 30,
    desc: '۲ شمشیر آهنی + زره آهنی'
  },
  {
    id: 'recipe_w4',
    name: '🟣 تبر حماسی',
    result: 'w4',
    ingredients: ['w3', 'w3', 'a3'],
    cost: 50,
    desc: '۲ شمشیر نقره‌ای + زره نقره‌ای'
  },
  {
    id: 'recipe_c4',
    name: '✨ سنگ احیا',
    result: 'c4',
    ingredients: ['c1', 'c2', 'c3'],
    cost: 20,
    desc: 'معجون سلامتی + قدرت + شانس'
  },
  {
    id: 'recipe_a4',
    name: '🐲 زره فلس اژدها',
    result: 'a4',
    ingredients: ['a3', 'a3', 'w5'],
    cost: 100,
    desc: '۲ زره نقره‌ای + نیزه اژدها'
  },
  {
    id: 'recipe_w6',
    name: '🔥 شمشیر ققنوس',
    result: 'w6',
    ingredients: ['w5', 'w5', 'a4', 'c4'],
    cost: 200,
    desc: '۲ نیزه اژدها + زره اژدها + سنگ احیا'
  }
];

// ============================================================
//                      هیولاها
// ============================================================

const MONSTERS = [
  { name: 'گرگ جنگلی', emoji: '🐺' },
  { name: 'اسکلت سرگردان', emoji: '💀' },
  { name: 'عنکبوت غول‌پیکر', emoji: '🕷️' },
  { name: 'گابلین دزد', emoji: '👺' },
  { name: 'خفاش خون‌آشام', emoji: '🦇' },
  { name: 'گولم سنگی', emoji: '🗿' },
  { name: 'روح سرگردان', emoji: '👻' },
  { name: 'ترول غارنشین', emoji: '🧌' },
  { name: 'کرم شنی غول‌پیکر', emoji: '🪱' },
  { name: 'شوالیه‌ی سیاه', emoji: '🖤' },
  { name: 'مومیایی نفرین‌شده', emoji: '🧟' },
  { name: 'جن صحرا', emoji: '🧞' },
  { name: 'کرکس غول‌آسا', emoji: '🦅' },
  { name: 'مار افعی سمی', emoji: '🐍' },
  { name: 'خرچنگ غول‌پیکر', emoji: '🦀' },
  { name: 'گرگینه‌ی وحشی', emoji: '🐾' },
  { name: 'شبح جنگل', emoji: '🌲' },
  { name: 'دیو کوچک', emoji: '👹' }
];

const BOSSES = [
  { name: 'اژدهای سیاه', emoji: '🐲' },
  { name: 'لیچ پادشاه', emoji: '👑' },
  { name: 'دیو آتشین کوهستان', emoji: '🌋' }
];

const BOSS_CHANCE = 0.08;

// ============================================================
//                      داستان‌ها (Story) — ۹ فصل کامل
// ============================================================

const STORY_CHAPTERS = [
  {
    id: 1,
    title: '🌅 شروع ماجراجویی',
    desc: 'تو در دهکده‌ی آریا از خواب بیدار میشی. خورشید تازه طلوع کرده و هوای بهاری دل‌انگیزه.\n\n' +
          'یادداشتی روی میزت پیدا میکنی:\n' +
          '"به دنبال گنجینه‌ی اژدهای سیاه برو... اما مواظب باش!"\n\n' +
          'چه کاری می‌خوای انجام بدی؟',
    choices: [
      { text: '🍺 به میخانه برو و اطلاعات جمع کن', next: 2, effect: 'gold+20' },
      { text: '🌲 به جنگل برو و راه بیفت', next: 3, effect: 'xp+15' },
      { text: '🏪 به فروشگاه برو و تجهیزات بخری', next: 4, effect: 'nothing' }
    ]
  },
  {
    id: 2,
    title: '🍺 میخانه‌ی دهکده',
    desc: 'وارد میخانه میشی. بوی شراب و دود توتون فضای گرمی ایجاد کرده.\n\n' +
          'یه پیرمرد ریش‌سفید توی گوشه نشسته و با نگاهش بهت اشاره میکنه.\n' +
          '"شنیدم دنبال اژدهایی... من می‌دونم کجاست."\n\n' +
          'چیکار میکنی؟',
    choices: [
      { text: '🤝 بهش نزدیک میشی و حرف می‌زنی', next: 5, effect: 'gold-10' },
      { text: '🚪 از میخانه خارج میشی', next: 3, effect: 'nothing' }
    ]
  },
  {
    id: 3,
    title: '🌲 جنگل انبوه',
    desc: 'توی جنگل قدم می‌زنی. درختان بلند سایه‌ی سنگینی انداختن.\n\n' +
          'ناگهان صدای ناله‌ای میشنوی. یه گرگ زخمی کنار درختی افتاده.\n\n' +
          'چیکار میکنی؟',
    choices: [
      { text: '❤️ به گرگ کمک می‌کنی', next: 6, effect: 'pet+wolf' },
      { text: '🏃 ادامه می‌دی و نادیده می‌گیری', next: 7, effect: 'nothing' }
    ]
  },
  {
    id: 4,
    title: '🏪 فروشگاه دهکده',
    desc: 'فروشنده با لبخند بهت خوش‌آمد می‌گه.\n' +
          '"به فروشگاه من خوش اومدی! بهترین وسایل رو دارم."\n\n' +
          'نگاهی به ویترین می‌اندازی. یه شمشیر براق توجّهت رو جلب می‌کنه.\n\n' +
          'چیکار میکنی؟',
    choices: [
      { text: '🛒 شمشیر رو می‌خری (۵۰ طلا)', next: 5, effect: 'gold-50' },
      { text: '🚪 از فروشگاه خارج میشی', next: 5, effect: 'nothing' }
    ]
  },
  {
    id: 5,
    title: '🗺️ نقشه‌ی گنج',
    desc: 'پیرمرد نقشه‌ای کهنه بهت میده:\n' +
          '"اژدها توی کوهستان آتشین زندگی می‌کنه. اما برای رسیدن به اونجا باید از سه دروازه بگذری."\n\n' +
          'نقشه رو برداشتی و راهی میشی.\n\n' +
          'به اولین دروازه رسیدی...',
    choices: [
      { text: '🚪 وارد دروازه اول میشی', next: 6, effect: 'xp+20' }
    ]
  },
  {
    id: 6,
    title: '🐺 دوست جدید',
    desc: 'به گرگ کمک کردی. زخمش رو بستی و بهش غذا دادی.\n\n' +
          'گرگ باهات میاد و تصمیم می‌گیره همراهت باشه!\n\n' +
          'حالا یه همراه وفادار داری که توی مسیر کمک‌ت می‌کنه.\n\n' +
          'به دروازه‌ی دوم رسیدی...',
    choices: [
      { text: '🚪 وارد دروازه دوم میشی', next: 7, effect: 'def+3' }
    ]
  },
  {
    id: 7,
    title: '🏔️ کوهستان آتشین',
    desc: 'پس از روزها سفر، به کوهستان آتشین رسیدی.\n' +
          'دود و آتش از دهانه‌ی کوه بیرون می‌زنه.\n\n' +
          'اژدهای سیاه رو می‌بینی که روی گنجینه‌اش خوابیده.\n\n' +
          'چیکار میکنی؟',
    choices: [
      { text: '⚔️ با اژدها می‌جنگی', next: 8, effect: 'gold+100' },
      { text: '🔄 برمی‌گردی و از این کار منصرف میشی', next: 9, effect: 'nothing' }
    ]
  },
  {
    id: 8,
    title: '🐉 نبرد با اژدها',
    desc: 'نبردی حماسی با اژدهای سیاه داری!\n\n' +
          'بعد از ساعتها جنگیدن، بالاخره اژدها رو شکست می‌دی!\n\n' +
          'گنجینه‌ی عظیمی پیدا میکنی و به عنوان قهرمان دهکده برمی‌گردی.\n\n' +
          '🎉 *داستان به پایان رسید!*\n' +
          'تو به یک قهرمان افسانه‌ای تبدیل شدی!',
    choices: []
  },
  {
    id: 9,
    title: '🏠 بازگشت به خانه',
    desc: 'تصمیم گرفتی از این ماجراجویی خطرناک منصرف بشی.\n\n' +
          'به دهکده برمی‌گردی و زندگی آرومی رو شروع می‌کنی.\n\n' +
          'اما همیشه یه حسرت توی دلت می‌مونه...\n\n' +
          'آیا روزی برمی‌گردی؟',
    choices: [
      { text: '🔄 داستان رو از اول شروع کن', next: 1, effect: 'nothing' }
    ]
  }
];

// ============================================================
//                      توابع اصلی بازی
// ============================================================

function getXpNeeded(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function createNewPlayer(ctx, classKey) {
  const classData = CLASSES[classKey];
  return {
    name: ctx.from.first_name || ctx.from.username || 'ماجراجو',
    classKey: classKey,
    level: 1,
    xp: 0,
    gold: 50,
    maxHp: classData.hp,
    currentHp: classData.hp,
    baseAtk: classData.atk,
    baseDef: classData.def,
    equippedWeapon: null,
    equippedArmor: null,
    inventory: [],
    pet: null,
    profession: null,
    activeEffects: { power: false, luck: false, revive: false },
    wins: 0,
    losses: 0,
    bossesDefeated: 0,
    lastDaily: 0,
    dailyStreak: 0,
    guild: null,
    pvpWins: 0,
    pvpLosses: 0,
    storyProgress: 0,
    hardMode: false,
    quests: [],
    completedQuests: [],
    craftingLevel: 1,
    itemsCrafted: 0,
    createdAt: Date.now()
  };
}

function calculateEffectiveAtk(player) {
  const weapon = findItemById(player.equippedWeapon);
  let atk = player.baseAtk + (weapon ? weapon.atkBonus : 0);
  
  if (player.activeEffects.power) {
    atk = Math.round(atk * 1.5);
  }
  
  if (player.pet) {
    const petData = PETS[player.pet];
    if (petData) {
      if (petData.type === 'atk') {
        atk += petData.value;
      } else if (petData.type === 'all') {
        atk += petData.value;
      }
    }
  }
  
  if (player.hardMode) {
    atk = Math.round(atk * 0.9);
  }
  
  return atk;
}

function calculateEffectiveDef(player) {
  const armor = findItemById(player.equippedArmor);
  let def = player.baseDef + (armor ? armor.defBonus : 0);
  
  if (player.pet) {
    const petData = PETS[player.pet];
    if (petData && petData.type === 'all') {
      def += petData.value;
    }
  }
  
  return def;
}

function calculateCritChance(player) {
  let chance = player.activeEffects.luck ? 0.35 : 0.15;
  
  if (player.pet) {
    const petData = PETS[player.pet];
    if (petData && petData.type === 'crit') {
      chance += petData.value;
    }
  }
  
  return chance;
}

function getShopDiscount(player) {
  if (player.profession) {
    const profData = PROFESSIONS[player.profession];
    if (profData && profData.bonus.shopDiscount) {
      return profData.bonus.shopDiscount;
    }
  }
  return 0;
}

function getSellMultiplier(player) {
  let mult = 0.6;
  if (player.profession) {
    const profData = PROFESSIONS[player.profession];
    if (profData && profData.bonus.sellMultiplier) {
      mult = profData.bonus.sellMultiplier;
    }
  }
  return mult;
}

function applyLevelUps(player) {
  const gainedLevels = [];
  while (player.xp >= getXpNeeded(player.level)) {
    player.xp -= getXpNeeded(player.level);
    player.level += 1;
    player.maxHp += 6;
    player.currentHp = player.maxHp;
    player.baseAtk += 2;
    player.baseDef += 1;
    gainedLevels.push(player.level);
  }
  return gainedLevels;
}

function generateMonster(playerLevel) {
  const level = Math.max(1, playerLevel);
  const isBoss = Math.random() < BOSS_CHANCE;
  const pool = isBoss ? BOSSES : MONSTERS;
  const base = pool[Math.floor(Math.random() * pool.length)];
  
  const scale = 0.5 + (playerLevel * 0.05) + (Math.random() * 0.2);
  const hpMul = isBoss ? 1.5 : 1;
  const atkMul = isBoss ? 1.2 : 1;
  const defMul = isBoss ? 1.15 : 1;
  
  let atk = Math.round((5 + level * 1.8) * scale * atkMul);
  let hp = Math.round((15 + level * 5) * scale * hpMul);
  let def = Math.round((2 + level * 0.7) * scale * defMul);
  
  if (playerLevel < 3) {
    atk = Math.min(atk, 10);
    hp = Math.min(hp, 25);
    def = Math.min(def, 4);
  }
  
  return {
    ...base,
    isBoss: isBoss,
    hp: hp,
    atk: atk,
    def: def,
    xpReward: Math.round((12 + level * 4) * scale * (isBoss ? 3 : 1)),
    goldReward: Math.round((15 + level * 5) * scale * (isBoss ? 3.5 : 1))
  };
}

function simulateFight(player, monster) {
  let playerHp = player.currentHp;
  let monsterHp = monster.hp;
  const log = [];
  const pAtk = calculateEffectiveAtk(player);
  const pDef = calculateEffectiveDef(player);
  const critChance = calculateCritChance(player);
  let round = 0;
  let anyCrit = false;
  
  while (playerHp > 0 && monsterHp > 0 && round < 25) {
    round++;
    
    let pDmg = Math.max(1, Math.round(pAtk * (0.8 + Math.random() * 0.4) - monster.def * 0.5));
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      pDmg = Math.round(pDmg * 1.8);
      anyCrit = true;
    }
    monsterHp -= pDmg;
    log.push(isCrit ? `💥 ضربه‌ی بحرانی! ${pDmg} آسیب زدی!` : `تو ${pDmg} آسیب زدی.`);
    
    if (monsterHp <= 0) break;
    
    const mDmg = Math.max(1, Math.round(monster.atk * (0.8 + Math.random() * 0.4) - pDef * 0.5));
    playerHp -= mDmg;
    log.push(`${monster.name} ${mDmg} آسیب زد.`);
  }
  
  let won = monsterHp <= 0 && playerHp > 0;
  let revived = false;
  
  if (!won && player.activeEffects.revive && playerHp <= 0) {
    won = true;
    revived = true;
    playerHp = Math.round(player.maxHp * 0.3);
  }
  
  if (!won && player.pet === 'phoenix' && playerHp <= 0) {
    won = true;
    revived = true;
    playerHp = Math.round(player.maxHp * 0.2);
  }
  
  player.currentHp = Math.max(0, playerHp);
  
  return {
    won: won,
    log: log,
    remainingHp: Math.max(0, playerHp),
    revived: revived,
    isBoss: monster.isBoss,
    goldReward: monster.goldReward,
    xpReward: monster.xpReward
  };
}

// ============================================================
//                      سیستم ماموریت‌ها
// ============================================================

function generateQuestsForPlayer(player) {
  const available = QUEST_TEMPLATES.filter(q =>
    !player.completedQuests.includes(q.id) &&
    !player.quests.find(qq => qq.id === q.id)
  );
  
  const shuffled = available.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  
  player.quests = selected.map(q => ({
    ...q,
    progress: 0,
    completed: false
  }));
}

function updatePlayerQuests(player, type, amount = 1) {
  const completed = [];
  player.quests.forEach(q => {
    if (!q.completed && q.type === type) {
      q.progress += amount;
      if (q.progress >= q.target) {
        q.completed = true;
        player.gold += q.reward.gold;
        player.xp += q.reward.xp;
        player.completedQuests.push(q.id);
        completed.push(q);
      }
    }
  });
  return completed;
}

// ============================================================
//                      تابع مشترک حذف آیتم از کوله
// ============================================================

function removeItemFromInventory(player, itemId) {
  // پیدا کردن آیتم در کوله
  const index = player.inventory.indexOf(itemId);
  if (index === -1) {
    return { success: false, msg: '❌ آیتم در کوله وجود ندارد!' };
  }
  
  // حذف از کوله
  player.inventory.splice(index, 1);
  
  // اگر آیتم تجهیز شده بود، از تجهیزات خارج کن
  if (player.equippedWeapon === itemId) {
    player.equippedWeapon = null;
  }
  if (player.equippedArmor === itemId) {
    player.equippedArmor = null;
  }
  
  return { success: true, msg: '✅ آیتم حذف شد!' };
}

// ============================================================
//                      سیستم پت (سطح‌گیری)
// ============================================================

function levelUpPet(player) {
  if (!player.pet) return null;
  
  const petKey = player.pet;
  const petData = PETS[petKey];
  
  if (!petData) return null;
  
  // محاسبه تجربه مورد نیاز برای سطح بعدی
  const xpNeeded = petData.level * 20;
  
  if (petData.xp >= xpNeeded) {
    petData.xp -= xpNeeded;
    petData.level += 1;
    
    // افزایش پاداش بر اساس نوع پت
    if (petData.type === 'atk') {
      petData.value += 1;
    } else if (petData.type === 'all') {
      petData.value += 1;
    } else if (petData.type === 'heal') {
      petData.value += 5;
    } else if (petData.type === 'crit') {
      petData.value += 0.05;
    }
    
    // بروزرسانی ماموریت پت‌پرور
    updatePlayerQuests(player, 'petLevel', petData.level);
    
    return petData.level;
  }
  
  return null;
}

function addPetXp(player, amount) {
  if (!player.pet) return null;
  
  const petKey = player.pet;
  const petData = PETS[petKey];
  
  if (!petData) return null;
  
  petData.xp = (petData.xp || 0) + amount;
  const newLevel = levelUpPet(player);
  
  return newLevel;
}

// ============================================================
//                      سیستم کرفتینگ (رفع باگ کامل)
// ============================================================

function canCraft(player, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  
  if (!recipe) {
    return { 
      success: false, 
      msg: '❌ دستور کرفتینگ پیدا نشد!' 
    };
  }
  
  if (player.gold < recipe.cost) {
    return { 
      success: false, 
      msg: `💰 طلای کافی نداری! (${recipe.cost} طلا نیاز است)` 
    };
  }
  
  // بررسی دقیق آیتم‌های تکراری
  const missingIngredients = [];
  const inventoryCopy = [...player.inventory];
  
  for (const needId of recipe.ingredients) {
    const index = inventoryCopy.indexOf(needId);
    if (index === -1) {
      const item = findItemById(needId);
      missingIngredients.push(item?.label || needId);
    } else {
      inventoryCopy.splice(index, 1);
    }
  }
  
  if (missingIngredients.length > 0) {
    return { 
      success: false, 
      msg: `❌ مواد لازم را نداری!\nنیاز: ${missingIngredients.join(' + ')}` 
    };
  }
  
  return { 
    success: true, 
    recipe: recipe 
  };
}

function performCraft(player, recipeId) {
  const check = canCraft(player, recipeId);
  
  if (!check.success) {
    return check;
  }
  
  const recipe = check.recipe;
  
  // استفاده از تابع مشترک برای هر ماده
  for (const needId of recipe.ingredients) {
    const removeResult = removeItemFromInventory(player, needId);
    if (!removeResult.success) {
      return { success: false, msg: `❌ ${removeResult.msg}` };
    }
  }
  
  player.gold -= recipe.cost;
  player.inventory.push(recipe.result);
  player.itemsCrafted = (player.itemsCrafted || 0) + 1;
  player.craftingLevel = (player.craftingLevel || 1) + 0.1;
  
  const resultItem = findItemById(recipe.result);
  
  return {
    success: true,
    msg: `✅ ${recipe.name} ساخته شد!`,
    item: resultItem,
    recipe: recipe
  };
}

// ============================================================
//                      سیستم گیلد
// ============================================================

function createNewGuild(name, leaderKey, chatId) {
  const id = `guild_${Date.now()}`;
  guilds[id] = {
    id: id,
    name: name,
    leader: leaderKey,
    chatId: chatId,
    members: [leaderKey],
    level: 1,
    xp: 0,
    bank: 0,
    bossHp: 1000,
    bossMaxHp: 1000,
    bossDefeated: 0,
    createdAt: Date.now(),
    lastBossFight: 0
  };
  markGuildsChanged();
  saveAllData();
  return id;
}

function getGuildById(guildId) {
  return guilds[guildId] || null;
}

function addMemberToGuild(guildId, playerKey) {
  const guild = getGuildById(guildId);
  if (!guild) return false;
  if (guild.members.includes(playerKey)) return false;
  guild.members.push(playerKey);
  markGuildsChanged();
  saveAllData();
  return true;
}

function removeMemberFromGuild(guildId, playerKey) {
  const guild = getGuildById(guildId);
  if (!guild) return false;
  const index = guild.members.indexOf(playerKey);
  if (index === -1) return false;
  guild.members.splice(index, 1);
  markGuildsChanged();
  saveAllData();
  return true;
}

// ============================================================
//                      سیستم PvP
// ============================================================

const PVP_QUEUE = [];

function findPvPOpponent(playerKey) {
  for (let i = 0; i < PVP_QUEUE.length; i++) {
    if (PVP_QUEUE[i] !== playerKey) {
      const opponent = PVP_QUEUE[i];
      PVP_QUEUE.splice(i, 1);
      return opponent;
    }
  }
  return null;
}

function simulatePvP(player1, player2) {
  const log = [];
  let hp1 = player1.maxHp;
  let hp2 = player2.maxHp;
  const atk1 = calculateEffectiveAtk(player1);
  const atk2 = calculateEffectiveAtk(player2);
  const def1 = calculateEffectiveDef(player1);
  const def2 = calculateEffectiveDef(player2);
  
  for (let round = 0; round < 5; round++) {
    const dmg1 = Math.max(1, Math.round(atk1 * (0.7 + Math.random() * 0.6) - def2 * 0.3));
    hp2 -= dmg1;
    log.push(`${player1.name} ${dmg1} آسیب زد`);
    
    if (hp2 <= 0) break;
    
    const dmg2 = Math.max(1, Math.round(atk2 * (0.7 + Math.random() * 0.6) - def1 * 0.3));
    hp1 -= dmg2;
    log.push(`${player2.name} ${dmg2} آسیب زد`);
    
    if (hp1 <= 0) break;
  }
  
  let winner = 0;
  if (hp2 <= 0) winner = 1;
  else if (hp1 <= 0) winner = 2;
  else winner = hp1 > hp2 ? 1 : 2;
  
  return {
    winner: winner,
    log: log,
    hp1: Math.max(0, hp1),
    hp2: Math.max(0, hp2)
  };
}

// ============================================================
//                      سیستم بازار
// ============================================================

function addToMarket(playerKey, itemId, price) {
  const listingId = `m_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  market[listingId] = {
    id: listingId,
    playerKey: playerKey,
    itemId: itemId,
    price: price,
    timestamp: Date.now()
  };
  markMarketChanged();
  saveAllData();
  return listingId;
}

function removeFromMarket(listingId) {
  if (market[listingId]) {
    delete market[listingId];
    markMarketChanged();
    saveAllData();
    return true;
  }
  return false;
}

function getMarketListings() {
  return Object.values(market);
}

// ============================================================
//                      توابع نمایشی
// ============================================================

function getXpBar(player) {
  const needed = getXpNeeded(player.level);
  const filled = Math.min(10, Math.round((player.xp / needed) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` (${player.xp}/${needed})`;
}

function getTitle(player) {
  let title = '🌱 مبتدی';
  if (player.wins >= 50) title = '👑 افسانه';
  else if (player.wins >= 25) title = '🏆 قهرمان';
  else if (player.wins >= 10) title = '⚔️ جنگجوی باتجربه';
  
  if (player.bossesDefeated >= 1) title += ' 🐉 اژدهاکش';
  if (player.pvpWins >= 10) title += ' ⚔️ PvP‌باز';
  
  return title;
}

function getProfileCard(player) {
  const classData = CLASSES[player.classKey];
  const weapon = findItemById(player.equippedWeapon);
  const armor = findItemById(player.equippedArmor);
  const pet = player.pet ? PETS[player.pet] : null;
  const profession = player.profession ? PROFESSIONS[player.profession] : null;
  
  let text = `${classData.emoji} *${player.name}* — ${classData.label}\n`;
  text += `${getTitle(player)}\n\n`;
  text += `📊 سطح: *${player.level}*\n`;
  text += `✨ تجربه: ${getXpBar(player)}\n`;
  text += `❤️ سلامتی: ${player.currentHp}/${player.maxHp}\n`;
  text += `💪 حمله: ${calculateEffectiveAtk(player)}${weapon ? ` (${weapon.label})` : ''}\n`;
  text += `🛡 دفاع: ${calculateEffectiveDef(player)}${armor ? ` (${armor.label})` : ''}\n`;
  text += `💰 طلا: ${player.gold}\n`;
  
  if (pet) text += `🐾 پت: ${pet.name} (سطح ${pet.level})\n`;
  if (profession) text += `⚒️ پیشه: ${profession.name}\n`;
  
  text += `\n📈 بردها: ${player.wins} | باخت‌ها: ${player.losses} | باس‌ها: ${player.bossesDefeated}`;
  if (player.hardMode) text += '\n🔥 حالت سخت: فعال';
  
  return text;
}

// ============================================================
//                      منوها و کیبوردها (۳-۴ دکمه‌ای)
// ============================================================

function getClassSelectionKeyboard() {
  return keyboard([
    [
      styledButton('⚔️ جنگجو — ' + CLASSES.warrior.desc, 'pick_warrior', 'primary'),
      styledButton('🔮 جادوگر — ' + CLASSES.mage.desc, 'pick_mage', 'primary')
    ],
    [
      styledButton('🏹 تیرانداز — ' + CLASSES.archer.desc, 'pick_archer', 'primary')
    ]
  ]);
}

function getMainMenuKeyboard(player) {
  return keyboard([
    // ردیف ۱: نبرد (برجسته)
    [styledButton('⚔️⚔️ نبرد ⚔️⚔️', 'menu_fight', 'danger')],
    // ردیف ۲: پروفایل، کوله، فروشگاه
    [
      styledButton('👤 پروفایل', 'menu_profile', 'primary'),
      styledButton('🎒 کوله', 'menu_inventory', 'primary'),
      styledButton('🏪 فروشگاه', 'menu_shop', 'primary')
    ],
    // ردیف ۳: رتبه‌بندی، پت، پیشه
    [
      styledButton('🏆 رتبه‌بندی', 'menu_leaderboard', 'primary'),
      styledButton('🐾 پت', 'menu_pet', 'primary'),
      styledButton('⚒️ پیشه', 'menu_profession', 'primary')
    ],
    // ردیف ۴: ماموریت، کرفتینگ، گیلد
    [
      styledButton('📜 ماموریت', 'menu_quests', 'primary'),
      styledButton('🔨 کرفتینگ', 'menu_crafting', 'primary'),
      styledButton('🏰 گیلد', 'menu_guild', 'primary')
    ],
    // ردیف ۵: PvP، بازار، حالت سخت
    [
      styledButton('⚔️ PvP', 'menu_pvp', 'danger'),
      styledButton('💰 بازار', 'menu_market', 'primary'),
      styledButton('🔥 سخت', 'menu_hardmode', player?.hardMode ? 'danger' : 'primary')
    ],
    // ردیف ۶: داستان، بهبودی، روزانه
    [
      styledButton('📖 داستان', 'menu_story', 'primary'),
      styledButton('💚 بهبودی', 'menu_heal', 'success'),
      styledButton('🎁 روزانه', 'menu_daily', 'success')
    ],
    // ردیف ۷: راهنما
    [styledButton('❓ راهنما', 'menu_help', 'primary')]
  ]);
}

function getShopCategoryKeyboard() {
  return keyboard([
    [
      styledButton('🗡 سلاح‌ها', 'shop_weapons', 'primary'),
      styledButton('🛡 زره‌ها', 'shop_armors', 'primary'),
      styledButton('🧪 معجون‌ها', 'shop_consumables', 'primary')
    ],
    [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function getShopItemsKeyboard(items) {
  const rows = [];
  
  for (let i = 0; i < items.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < items.length; j++) {
      const item = items[j];
      row.push(styledButton(
        `${item.label} 💰${item.price}`,
        `buy_${item.id}`,
        'success'
      ));
    }
    rows.push(row);
  }
  
  rows.push([styledButton('« بازگشت به فروشگاه', 'menu_shop', 'primary')]);
  return keyboard(rows);
}

function getInventoryKeyboard(player) {
  if (!player || player.inventory.length === 0) {
    return keyboard([
      [styledButton('🎒 کوله خالی است!', 'ignore', 'secondary')],
      [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
    ]);
  }
  
  // گروه‌بندی آیتم‌های تکراری
  const itemCount = {};
  for (const id of player.inventory) {
    itemCount[id] = (itemCount[id] || 0) + 1;
  }
  
  const uniqueItems = Object.keys(itemCount);
  const rows = [];
  
  rows.push([{ text: `🎒 ${player.inventory.length} آیتم در کوله`, callback_data: 'ignore' }]);
  rows.push([]);
  
  for (let i = 0; i < uniqueItems.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < uniqueItems.length; j++) {
      const id = uniqueItems[j];
      const item = findItemById(id);
      const count = itemCount[id];
      
      if (item) {
        const isEquipped = (player.equippedWeapon === id || player.equippedArmor === id);
        const emoji = item.type === 'weapon' ? '🗡' : item.type === 'armor' ? '🛡' : '🧪';
        const label = isEquipped ? `✅${item.label}` : item.label;
        const countText = count > 1 ? ` ×${count}` : '';
        row.push(styledButton(`${emoji} ${label}${countText}`, `inv_item_${id}`, 'primary'));
      }
    }
    rows.push(row);
  }
  
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  return keyboard(rows);
}

function getItemActionKeyboard(itemId) {
  const item = findItemById(itemId);
  if (!item) return backButton('menu_main');
  
  const rows = [];
  
  if (item.type === 'weapon' || item.type === 'armor') {
    rows.push([styledButton('⚙️ تجهیز', `equip_${itemId}`, 'success')]);
  }
  
  if (item.type === 'consumable') {
    rows.push([styledButton('🧪 مصرف', `use_${itemId}`, 'success')]);
  }
  
  const sellPrice = Math.round(item.price * getSellMultiplier({}));
  rows.push([styledButton(`💰 فروش (${sellPrice} طلا)`, `sell_${itemId}`, 'danger')]);
  rows.push([styledButton('« بازگشت به کوله', 'menu_inventory', 'primary')]);
  
  return keyboard(rows);
}

function getProfessionKeyboard(player) {
  if (player.profession) {
    const prof = PROFESSIONS[player.profession];
    return keyboard([
      [styledButton('🔄 تغییر پیشه (۵۰ طلا)', 'profession_change', 'danger')],
      [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  const profs = Object.entries(PROFESSIONS);
  
  for (let i = 0; i < profs.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < profs.length; j++) {
      const [key, prof] = profs[j];
      row.push(styledButton(
        `${prof.name} — ${prof.desc} (💰${prof.price})`,
        `profession_pick_${key}`,
        'primary'
      ));
    }
    rows.push(row);
  }
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  
  return keyboard(rows);
}

function getPetKeyboard(player) {
  if (player.pet) {
    const pet = PETS[player.pet];
    return keyboard([
      [styledButton(`🐾 ${pet.name} (سطح ${pet.level})`, 'ignore', 'secondary')],
      [styledButton('🔄 عوض کردن پت', 'pet_change', 'primary')],
      [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  const pets = Object.entries(PETS);
  
  for (let i = 0; i < pets.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < pets.length; j++) {
      const [key, pet] = pets[j];
      row.push(styledButton(
        `${pet.name} — ${pet.desc} (💰${pet.price})`,
        `pet_buy_${key}`,
        'success'
      ));
    }
    rows.push(row);
  }
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  
  return keyboard(rows);
}

function getQuestsKeyboard() {
  return keyboard([
    [styledButton('🔄 تازه‌سازی (۵۰ طلا)', 'quests_refresh', 'primary')],
    [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function getCraftingKeyboard(player) {
  const rows = RECIPES.map(recipe => {
    // بررسی دقیق مواد با شمارش
    const inventoryCopy = [...player.inventory];
    let hasAll = true;
    for (const needId of recipe.ingredients) {
      const index = inventoryCopy.indexOf(needId);
      if (index === -1) {
        hasAll = false;
        break;
      }
      inventoryCopy.splice(index, 1);
    }
    
    const canAfford = player.gold >= recipe.cost;
    const status = canAfford && hasAll ? '✅' : '❌';
    const style = canAfford && hasAll ? 'success' : 'secondary';
    return [styledButton(`${recipe.name} ${status}`, `craft_${recipe.id}`, style)];
  });
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  return keyboard(rows);
}

function getGuildKeyboard(player, ctx) {
  if (player.guild) {
    const guild = getGuildById(player.guild);
    if (!guild) {
      player.guild = null;
      return getGuildKeyboard(player, ctx);
    }
    
    const playerKey = ctx ? getPlayerKey(ctx.chat.id, ctx.from.id) : '';
    const isLeader = guild.leader === playerKey;
    
    const rows = [];
    
    rows.push([{ text: `🏰 ${guild.name} | ${guild.members.length} عضو`, callback_data: 'ignore' }]);
    rows.push([]);
    
    if (isLeader) {
      rows.push([
        styledButton('👤 دعوت عضو', 'guild_invite', 'primary'),
        styledButton('🗑 منحل کردن', 'guild_disband', 'danger')
      ]);
    }
    
    rows.push([
      styledButton('⚔️ باس گیلد', 'guild_boss', 'danger'),
      styledButton('💰 کمک به صندوق', 'guild_donate', 'success')
    ]);
    rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
    
    return keyboard(rows);
  }
  
  return keyboard([
    [
      styledButton('🏗 ساخت (۲۰۰ طلا)', 'guild_create', 'success'),
      styledButton('📋 لیست گیلدها', 'guild_list', 'primary')
    ],
    [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function getPvpKeyboard() {
  return keyboard([
    [styledButton('🔍 پیدا کردن حریف', 'pvp_find', 'danger')],
    [styledButton('🏆 رتبه‌بندی PvP', 'pvp_leaderboard', 'primary')],
    [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function getMarketKeyboard(player) {
  const playerKey = player ? getPlayerKey(0, 0) : '';
  const listings = getMarketListings().filter(m => m.playerKey !== playerKey);
  
  if (listings.length === 0) {
    return keyboard([
      [styledButton('📤 فروش آیتم', 'market_sell', 'primary')],
      [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  for (let i = 0; i < listings.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < listings.length; j++) {
      const listing = listings[j];
      const item = findItemById(listing.itemId);
      row.push(styledButton(
        `${item?.label || 'نامشخص'} 💰${listing.price}`,
        `market_buy_${listing.id}`,
        'success'
      ));
    }
    rows.push(row);
  }
  
  rows.push([styledButton('📤 فروش آیتم', 'market_sell', 'primary')]);
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  return keyboard(rows);
}

function getLeaderboardKeyboard(currentCategory) {
  return keyboard([
    [
      styledButton('📊 سطح', 'lb_level', currentCategory === 'level' ? 'success' : 'primary'),
      styledButton('💰 طلا', 'lb_gold', currentCategory === 'gold' ? 'success' : 'primary'),
      styledButton('⚔️ بردها', 'lb_wins', currentCategory === 'wins' ? 'success' : 'primary')
    ],
    [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function getGuildNameKeyboard() {
  return keyboard([
    [styledButton('🔥 آتشین', 'guild_name_Fire', 'primary')],
    [styledButton('⚡ صاعقه', 'guild_name_Storm', 'primary')],
    [styledButton('🌊 موج‌ها', 'guild_name_Wave', 'primary')],
    [styledButton('🗻 کوهستان', 'guild_name_Mountain', 'primary')],
    [styledButton('🌙 ماه‌تاب', 'guild_name_Moon', 'primary')],
    [styledButton('« انصراف', 'menu_main', 'primary')]
  ]);
}

function getSellPriceKeyboard(itemId) {
  return keyboard([
    [styledButton('۱۰ طلا', `market_price_${itemId}_10`, 'primary')],
    [styledButton('۲۰ طلا', `market_price_${itemId}_20`, 'primary')],
    [styledButton('۵۰ طلا', `market_price_${itemId}_50`, 'primary')],
    [styledButton('۱۰۰ طلا', `market_price_${itemId}_100`, 'primary')],
    [styledButton('۲۰۰ طلا', `market_price_${itemId}_200`, 'primary')],
    [styledButton('« انصراف', 'menu_market', 'primary')]
  ]);
}

function getStoryKeyboard(chapter) {
  if (!chapter || !chapter.choices || chapter.choices.length === 0) {
    return backButton('menu_main');
  }
  
  const rows = chapter.choices.map(choice => [
    styledButton(choice.text, `story_${choice.next}`, 'primary')
  ]);
  rows.push([styledButton('« بازگشت به منو', 'menu_main', 'primary')]);
  
  return keyboard(rows);
}

// ============================================================
//                      راه‌اندازی ربات
// ============================================================

if (!process.env.BOT_TOKEN) {
  console.error('❌ متغیر محیطی BOT_TOKEN تنظیم نشده است.');
  console.log('📝 یک فایل .env بسازید با محتوای: BOT_TOKEN=توکن_ربات_شما');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ============================================================
//                      دستورات
// ============================================================

bot.command('start', async (ctx) => {
  const existing = getPlayerByCtx(ctx);
  
  if (existing) {
    await ctx.reply(
      `👋 خوش برگشتی!\n\n${getProfileCard(existing)}`,
      { parse_mode: 'Markdown' }
    );
    await sendMainMenu(ctx);
    return;
  }
  
  await ctx.reply(
    '🗡 به *افسانه‌ی گروه (نسخه ۴.۲)* خوش اومدی!\n\n' +
    'یک کلاس برای شخصیتت انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...getClassSelectionKeyboard()
    }
  );
});

bot.command('menu', async (ctx) => {
  await sendMainMenu(ctx);
});

// ============================================================
//                      توابع اصلی منوها
// ============================================================

async function sendMainMenu(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    '🗡 *منوی اصلی افسانه‌ی گروه*\n\nیک گزینه رو انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...getMainMenuKeyboard(player)
    }
  );
}

async function showProfile(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    getProfileCard(player),
    {
      parse_mode: 'Markdown',
      ...backButton('menu_main')
    }
  );
}

async function showInventory(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.inventory.length === 0) {
    await ctx.reply(
      '🎒 کوله‌پشتیت خالیه!',
      backButton('menu_main')
    );
    return;
  }
  
  await ctx.reply(
    '🎒 *کوله‌پشتی تو*\n\nروی هر آیتم کلیک کن تا گزینه‌ها رو ببینی:',
    {
      parse_mode: 'Markdown',
      ...getInventoryKeyboard(player)
    }
  );
}

async function showFight(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.currentHp <= 0) {
    await ctx.reply(
      '💀 *سلامتی‌ات تموم شده!*\n' +
      'از دکمه‌ی بهبودی استفاده کن یا جایزه‌ی روزانه بگیر.',
      {
        parse_mode: 'Markdown',
        ...keyboard([
          [styledButton('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success')],
          [styledButton('🎁 جایزه روزانه', 'menu_daily', 'primary')],
          [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
        ])
      }
    );
    return;
  }
  
  let effectsMsg = '';
  if (player.activeEffects.power) effectsMsg += '💥 قدرت ۱.۵× فعال\n';
  if (player.activeEffects.luck) effectsMsg += '🍀 شانس کریت بیشتر\n';
  if (player.activeEffects.revive) effectsMsg += '✨ سنگ احیا همراهته\n';
  
  if (effectsMsg) {
    await ctx.reply(
      `✨ *افکت‌های فعال:*\n${effectsMsg}`,
      { parse_mode: 'Markdown' }
    );
  }
  
  const monster = generateMonster(player.level);
  const result = simulateFight(player, monster);
  
  const introEmoji = monster.isBoss ? '👑💀 *یک باس ظاهر شد!* 💀👑' : `${monster.emoji}`;
  let text = `${introEmoji} یک *${monster.name}* سر راهت ظاهر شد!\n\n`;
  
  const displayLog = result.log.slice(0, 10);
  text += displayLog.join('\n');
  if (result.log.length > 10) {
    text += `\n... و ${result.log.length - 10} حرکت دیگه`;
  }
  text += '\n\n';
  
  if (result.won) {
    const bonusGold = Math.round(result.goldReward * (1 + Math.random() * 0.3));
    player.xp += result.xpReward;
    player.gold += bonusGold;
    player.wins += 1;
    
    if (monster.isBoss) {
      player.bossesDefeated += 1;
    }
    
    updatePlayerQuests(player, monster.isBoss ? 'boss' : 'kill');
    updatePlayerQuests(player, 'win');
    updatePlayerQuests(player, 'gold', bonusGold);
    
    const levelsGained = applyLevelUps(player);
    
    // اضافه کردن تجربه به پت
    if (player.pet) {
      const petXp = 5 + Math.round(Math.random() * 10);
      const petLevelUp = addPetXp(player, petXp);
      if (petLevelUp) {
        text += `\n🐾 پتت به سطح ${petLevelUp} رسید!`;
      }
    }
    
    if (result.revived) {
      text += `✨ سنگ احیا فعال شد و در آخرین لحظه نجات پیدا کردی!\n`;
    }
    
    text += `✅ *پیروز شدی!* +${result.xpReward} تجربه، +${bonusGold} طلا\n`;
    
    if (monster.isBoss) {
      text += `🐉 *باس شکست خورد!* عنوان اژدهاکش رو گرفتی!\n`;
    }
    
    if (levelsGained.length > 0) {
      text += `\n🎊 *سطح جدید: ${levelsGained[levelsGained.length - 1]}!* آمارت افزایش پیدا کرد.`;
    }
    
    if (player.profession === 'hunter' && Math.random() < 0.2) {
      const randomItem = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
      if (randomItem) {
        player.inventory.push(randomItem.id);
        text += `\n🎁 *${randomItem.label}* پیدا کردی! (شکارچی)`;
      }
    }
    
  } else {
    player.losses += 1;
    
    const consolationXp = Math.round(result.xpReward * 0.3);
    const consolationGold = Math.round(result.goldReward * 0.2);
    player.xp += consolationXp;
    player.gold += consolationGold;
    
    const penalty = Math.min(player.gold, Math.round(result.goldReward * 0.05));
    player.gold -= penalty;
    
    if (player.gold < 10) player.gold = 10;
    
    text += `☠️ *شکست خوردی...*\n`;
    text += `💫 ${consolationXp} تجربه و ${consolationGold} طلا دلداری گرفتی!\n`;
    
    if (penalty > 0) {
      text += `💸 ${penalty} طلا از دست دادی.`;
    }
  }
  
  player.activeEffects = { power: false, luck: false, revive: false };
  savePlayerByCtx(ctx, player);
  
  await ctx.reply(
    text,
    {
      parse_mode: 'Markdown',
      ...keyboard([
        [styledButton('⚔️ دوباره بجنگ!', 'menu_fight', 'danger')],
        [styledButton('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success')],
        [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
      ])
    }
  );
}

async function showDaily(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;
  const remaining = player.lastDaily + cooldown - now;
  
  if (remaining > 0) {
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    await ctx.reply(
      `⏳ جایزه‌ی روزانه رو قبلاً گرفتی.\nحدود ${hours} ساعت دیگه دوباره سر بزن.`,
      backButton('menu_main')
    );
    return;
  }
  
  const streakBroken = now - player.lastDaily > cooldown * 2;
  player.dailyStreak = streakBroken ? 1 : player.dailyStreak + 1;
  if (player.lastDaily === 0) player.dailyStreak = 1;
  
  const streakMultiplier = 1 + Math.min(player.dailyStreak - 1, 9) * 0.15;
  const goldReward = Math.round((50 + player.level * 8) * streakMultiplier);
  const xpReward = Math.round((30 + player.level * 5) * streakMultiplier);
  
  let bonus = '';
  if (Math.random() < 0.15) {
    const bonusGold = Math.round(goldReward * 0.5);
    player.gold += bonusGold;
    bonus = `\n🎉 *جایزه‌ی ویژه!* +${bonusGold} طلای اضافی!`;
  }
  
  player.gold += goldReward;
  player.xp += xpReward;
  player.lastDaily = now;
  player.currentHp = player.maxHp;
  
  const levelsGained = applyLevelUps(player);
  savePlayerByCtx(ctx, player);
  
  let text =
    `🎁 *جایزه‌ی روزانه*\n` +
    `💰 +${goldReward} طلا\n` +
    `✨ +${xpReward} تجربه\n` +
    `🔥 استریک: ${player.dailyStreak} روز متوالی (ضریب ${streakMultiplier.toFixed(1)}×)`;
  
  if (bonus) text += bonus;
  if (levelsGained.length > 0) {
    text += `\n🎊 سطح جدید: ${levelsGained[levelsGained.length - 1]}!`;
  }
  
  text += '\n💚 سلامتی کامل شد!';
  
  await ctx.reply(
    text,
    {
      parse_mode: 'Markdown',
      ...keyboard([
        [styledButton('⚔️ برو نبرد!', 'menu_fight', 'danger')],
        [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
      ])
    }
  );
}

async function showShop(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    '🏪 *فروشگاه افسانه‌ی گروه*\n\nیک دسته انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...getShopCategoryKeyboard()
    }
  );
}

async function showShopCategory(ctx, items, title) {
  const player = getPlayerByCtx(ctx);
  const discount = player ? getShopDiscount(player) : 0;
  
  let discountText = '';
  if (discount > 0) {
    discountText = `\n💰 تخفیف پیشه: ${Math.round(discount * 100)}%`;
  }
  
  let itemsDesc = items.map(item => {
    const rarityLabel = RARITY_LABELS[item.rarity] || '';
    const price = Math.round(item.price * (1 - discount));
    const atkText = item.atkBonus ? `💪+${item.atkBonus}` : '';
    const defText = item.defBonus ? `🛡+${item.defBonus}` : '';
    const effectText = item.desc ? ` 📝${item.desc}` : '';
    return `${item.label} ${rarityLabel} — ${price}طلا ${atkText}${defText}${effectText}`;
  }).join('\n');
  
  await ctx.reply(
    `🏪 *${title}*\n\n${itemsDesc}${discountText}\n\nروی آیتم کلیک کن تا بخری:`,
    {
      parse_mode: 'Markdown',
      ...getShopItemsKeyboard(items)
    }
  );
}

async function showLeaderboard(ctx, category = 'level') {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p);
  
  if (chatPlayers.length === 0) {
    await ctx.reply(
      'هنوز کسی تو این گروه شخصیت نساخته.\nاولین نفر باش! /start',
      backButton('menu_main')
    );
    return;
  }
  
  let sorted, label;
  if (category === 'gold') {
    sorted = [...chatPlayers].sort((a, b) => b.gold - a.gold);
    label = '💰 بر اساس طلا';
  } else if (category === 'wins') {
    sorted = [...chatPlayers].sort((a, b) => b.wins - a.wins);
    label = '⚔️ بر اساس بردها';
  } else {
    sorted = [...chatPlayers].sort((a, b) => b.level - a.level || b.xp - a.xp);
    label = '📊 بر اساس سطح';
  }
  
  sorted = sorted.slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  
  const lines = sorted.map((p, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const classData = CLASSES[p.classKey];
    let statText;
    
    if (category === 'gold') {
      statText = `💰${p.gold}`;
    } else if (category === 'wins') {
      statText = `⚔️${p.wins} برد`;
    } else {
      statText = `سطح ${p.level}`;
    }
    
    return `${rank} ${classData.emoji} *${p.name}* — ${statText}`;
  });
  
  await ctx.reply(
    `🏆 *رتبه‌بندی گروه* (${label})\n\n${lines.join('\n')}`,
    {
      parse_mode: 'Markdown',
      ...getLeaderboardKeyboard(category)
    }
  );
}

async function showHelp(ctx) {
  await ctx.reply(
    '🗡 *راهنمای افسانه‌ی گروه (نسخه ۴.۲)*\n\n' +
    '✅ همه‌چیز با دکمه‌ها انجام میشه!\n\n' +
    '⚔️ نبرد — با هیولاها بجنگ (شانس باس!)\n' +
    '🎁 روزانه — هر ۲۴ ساعت جایزه بگیر\n' +
    '🏪 فروشگاه — سلاح/زره/معجون بخر\n' +
    '🎒 کوله‌پشتی — آیتم‌هات رو مدیریت کن\n' +
    '💚 بهبودی — سلامتی رو با ۲۰ طلا پر کن\n' +
    '🏆 رتبه‌بندی — ببین کی قوی‌تره\n' +
    '🐾 پت — حیوان همراه بگیر (سطح می‌گیره!)\n' +
    '⚒️ پیشه — یه شغل انتخاب کن\n' +
    '📜 ماموریت‌ها — کارهای روزانه\n' +
    '🔨 کرفتینگ — آیتم بساز\n' +
    '🏰 گیلد — گروه تشکیل بده (با جوین از لیست!)\n' +
    '⚔️ PvP — با بازیکن‌های دیگه بجنگ\n' +
    '💰 بازار — آیتم بخر و بفروش\n' +
    '🔥 حالت سخت — چالش بیشتر، پاداش بیشتر\n' +
    '📖 داستان — ماجراجویی کن (۹ فصل)\n\n' +
    '💡 نکته: هر روز جایزه بگیر تا استریک‌ات قوی‌تر بشه!',
    {
      parse_mode: 'Markdown',
      ...backButton('menu_main')
    }
  );
}

async function showPet(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.pet) {
    const pet = PETS[player.pet];
    const xpNeeded = pet.level * 20;
    await ctx.reply(
      `🐾 *پت تو:* ${pet.name}\n` +
      `سطح: ${pet.level} | تجربه: ${pet.xp || 0}/${xpNeeded}\n` +
      `اثر: ${pet.desc}`,
      {
        parse_mode: 'Markdown',
        ...getPetKeyboard(player)
      }
    );
    return;
  }
  
  await ctx.reply(
    '🐾 *انتخاب پت*\n\nهر پت یک قابلیت خاص داره:\n' +
    '🐺 گرگ — +۳ حمله\n' +
    '🔥 ققنوس — یک‌بار احیا\n' +
    '🐉 اژدها — +۲ به همه چیز\n' +
    '🧚 پری — شانس بهبودی',
    {
      parse_mode: 'Markdown',
      ...getPetKeyboard(player)
    }
  );
}

async function showProfession(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.profession) {
    const prof = PROFESSIONS[player.profession];
    await ctx.reply(
      `⚒️ *پیشه‌ی تو:* ${prof.name}\n` +
      `${prof.desc}\n` +
      `قابلیت: ${prof.ability}`,
      {
        parse_mode: 'Markdown',
        ...getProfessionKeyboard(player)
      }
    );
    return;
  }
  
  await ctx.reply(
    '⚒️ *انتخاب پیشه*\n\nهر پیشه مزایای خاص خودش رو داره:\n' +
    '⚒️ آهنگر — تخفیف سلاح و زره\n' +
    '🧪 کیمیاگر — تخفیف معجون\n' +
    '💰 بازرگان — فروش با قیمت بیشتر\n' +
    '🏹 شکارچی — شانس آیتم و باس',
    {
      parse_mode: 'Markdown',
      ...getProfessionKeyboard(player)
    }
  );
}

async function showQuests(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.quests.length === 0) {
    generateQuestsForPlayer(player);
    savePlayerByCtx(ctx, player);
  }
  
  const active = player.quests.filter(q => !q.completed);
  const completed = player.quests.filter(q => q.completed);
  
  let text = '📜 *ماموریت‌های فعال*\n\n';
  
  if (active.length === 0) {
    text += 'همه‌ی ماموریت‌ها رو تکمیل کردی! 🎉\n';
  } else {
    active.forEach(q => {
      const progress = Math.round((q.progress / q.target) * 100);
      const bar = '▰'.repeat(Math.round(progress / 10)) + '▱'.repeat(10 - Math.round(progress / 10));
      text += `${q.name}\n${bar} (${q.progress}/${q.target})\n`;
      text += `🎁 +${q.reward.gold} طلا | +${q.reward.xp} تجربه\n\n`;
    });
  }
  
  if (completed.length > 0) {
    text += `✅ *تکمیل شده:* ${completed.length} ماموریت\n`;
  }
  
  await ctx.reply(
    text,
    {
      parse_mode: 'Markdown',
      ...getQuestsKeyboard()
    }
  );
}

async function showCrafting(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    `🔨 *کارگاه کرفتینگ*\n\n` +
    `سطح کرفتینگ: ${player.craftingLevel}\n` +
    `آیتم‌های ساخته‌شده: ${player.itemsCrafted}\n\n` +
    `روی هر دستور کلیک کن تا ببینی موادش رو داری یا نه:`,
    {
      parse_mode: 'Markdown',
      ...getCraftingKeyboard(player)
    }
  );
}

async function showGuild(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.guild) {
    const guild = getGuildById(player.guild);
    
    if (!guild) {
      player.guild = null;
      savePlayerByCtx(ctx, player);
      await showGuild(ctx);
      return;
    }
    
    const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
    const isLeader = guild.leader === playerKey;
    const memberCount = guild.members.length;
    const bossProgress = Math.round((1 - guild.bossHp / guild.bossMaxHp) * 100);
    
    await ctx.reply(
      `🏰 *${guild.name}*\n` +
      `رهبر: ${isLeader ? '👑 شما' : 'عضو'}\n` +
      `اعضا: ${memberCount} نفر\n` +
      `سطح گیلد: ${guild.level}\n` +
      `صندوق: ${guild.bank} طلا\n` +
      `باس گیلد: ${bossProgress}%\n` +
      `باس‌های شکست‌خورده: ${guild.bossDefeated}`,
      {
        parse_mode: 'Markdown',
        ...getGuildKeyboard(player, ctx)
      }
    );
    return;
  }
  
  await ctx.reply(
    '🏰 *سیستم گیلد*\n\n' +
    'با دوستانت یه گروه تشکیل بده!\n' +
    'هزینه‌ی ساخت: ۲۰۰ طلا',
    {
      parse_mode: 'Markdown',
      ...getGuildKeyboard(player, ctx)
    }
  );
}

async function showPvp(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    '⚔️ *سیستم PvP*\n\n' +
    `بردها: ${player.pvpWins}\n` +
    `باخت‌ها: ${player.pvpLosses}\n\n` +
    `برای پیدا کردن حریف، روی دکمه‌ی زیر کلیک کن:`,
    {
      parse_mode: 'Markdown',
      ...getPvpKeyboard()
    }
  );
}

async function showMarket(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  await ctx.reply(
    '💰 *بازار آزاد*\n\n' +
    `آیتم‌های موجود برای خرید:`,
    {
      parse_mode: 'Markdown',
      ...getMarketKeyboard(player)
    }
  );
}

async function toggleHardMode(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  player.hardMode = !player.hardMode;
  savePlayerByCtx(ctx, player);
  
  await ctx.reply(
    player.hardMode ?
    '🔥 *حالت سخت فعال شد!*\nهیولاها قوی‌ترن ولی پاداش بیشتره!' :
    '☀️ *حالت عادی فعال شد*',
    {
      parse_mode: 'Markdown',
      ...backButton('menu_main')
    }
  );
}

async function showStory(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  // 🔧 اصلاح: استفاده از storyProgress به‌عنوان فصل فعلی
  const currentChapter = player.storyProgress || 0;
  const nextChapterId = currentChapter + 1;
  const chapter = STORY_CHAPTERS.find(c => c.id === nextChapterId) || STORY_CHAPTERS[0];
  
  await ctx.reply(
    `📖 *${chapter.title}*\n\n${chapter.desc}`,
    {
      parse_mode: 'Markdown',
      ...getStoryKeyboard(chapter)
    }
  );
}

async function doHeal(ctx) {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.reply(
      '🗡 هنوز شخصیت نساختی!\n' +
      'یک کلاس انتخاب کن:',
      getClassSelectionKeyboard()
    );
    return;
  }
  
  if (player.gold < 20) {
    await ctx.reply(
      '💰 طلای کافی نداری! (۲۰ طلا نیاز است)',
      backButton('menu_main')
    );
    return;
  }
  
  if (player.currentHp >= player.maxHp) {
    await ctx.reply(
      '💚 سلامتی‌ات کامل هست!',
      backButton('menu_main')
    );
    return;
  }
  
  player.gold -= 20;
  player.currentHp = player.maxHp;
  savePlayerByCtx(ctx, player);
  
  await ctx.reply(
    `💚 *سلامتی کامل شد!*\n💰 ${player.gold} طلا مونده.`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_main')
    }
  );
}

// ============================================================
//                      اکشن‌های انتخاب کلاس
// ============================================================

bot.action(/^pick_(warrior|mage|archer)$/, async (ctx) => {
  const existing = getPlayerByCtx(ctx);
  
  if (existing) {
    await ctx.answerCbQuery('تو قبلاً شخصیت داری!', { show_alert: true });
    return;
  }
  
  const classKey = ctx.match[1];
  const newPlayer = createNewPlayer(ctx, classKey);
  savePlayerByCtx(ctx, newPlayer);
  
  await ctx.answerCbQuery(`✅ شخصیت ${CLASSES[classKey].label} ساخته شد!`);
  
  await ctx.reply(
    `🎉 شخصیتت ساخته شد!\n\n${getProfileCard(newPlayer)}`,
    { parse_mode: 'Markdown' }
  );
  
  await sendMainMenu(ctx);
});

// ============================================================
//                      اکشن‌های منو
// ============================================================

bot.action('menu_main', async (ctx) => {
  await ctx.answerCbQuery();
  await sendMainMenu(ctx);
});

bot.action('menu_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await showProfile(ctx);
});

bot.action('menu_inventory', async (ctx) => {
  await ctx.answerCbQuery();
  await showInventory(ctx);
});

bot.action('menu_fight', async (ctx) => {
  await ctx.answerCbQuery();
  await showFight(ctx);
});

bot.action('menu_daily', async (ctx) => {
  await ctx.answerCbQuery();
  await showDaily(ctx);
});

bot.action('menu_shop', async (ctx) => {
  await ctx.answerCbQuery();
  await showShop(ctx);
});

bot.action('menu_leaderboard', async (ctx) => {
  await ctx.answerCbQuery();
  await showLeaderboard(ctx, 'level');
});

bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery();
  await showHelp(ctx);
});

bot.action('menu_pet', async (ctx) => {
  await ctx.answerCbQuery();
  await showPet(ctx);
});

bot.action('menu_profession', async (ctx) => {
  await ctx.answerCbQuery();
  await showProfession(ctx);
});

bot.action('menu_quests', async (ctx) => {
  await ctx.answerCbQuery();
  await showQuests(ctx);
});

bot.action('menu_crafting', async (ctx) => {
  await ctx.answerCbQuery();
  await showCrafting(ctx);
});

bot.action('menu_guild', async (ctx) => {
  await ctx.answerCbQuery();
  await showGuild(ctx);
});

bot.action('menu_pvp', async (ctx) => {
  await ctx.answerCbQuery();
  await showPvp(ctx);
});

bot.action('menu_market', async (ctx) => {
  await ctx.answerCbQuery();
  await showMarket(ctx);
});

bot.action('menu_hardmode', async (ctx) => {
  await ctx.answerCbQuery();
  await toggleHardMode(ctx);
});

bot.action('menu_story', async (ctx) => {
  await ctx.answerCbQuery();
  await showStory(ctx);
});

bot.action('menu_heal', async (ctx) => {
  await ctx.answerCbQuery();
  await doHeal(ctx);
});

// ============================================================
//                      اکشن‌های فروشگاه
// ============================================================

bot.action('shop_weapons', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, WEAPONS, '🗡 سلاح‌ها');
});

bot.action('shop_armors', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, ARMORS, '🛡 زره‌ها');
});

bot.action('shop_consumables', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, CONSUMABLES, '🧪 معجون‌ها');
});

// ============================================================
//                      اکشن‌های خرید
// ============================================================

bot.action(/^buy_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  const item = findItemById(itemId);
  
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر است!', { show_alert: true });
    return;
  }
  
  let price = item.price;
  const discount = getShopDiscount(player);
  if (discount > 0) {
    price = Math.round(price * (1 - discount));
  }
  
  if (player.gold < price) {
    await ctx.answerCbQuery(
      `طلای کافی نداری! (${price} طلا نیاز است)`,
      { show_alert: true }
    );
    return;
  }
  
  player.gold -= price;
  player.inventory.push(item.id);
  updatePlayerQuests(player, 'buy');
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ ${item.label} خریداری شد!`);
  
  await ctx.reply(
    `✅ *${item.label}* خریداری شد!\n💰 ${player.gold} طلا مونده.`,
    {
      parse_mode: 'Markdown',
      ...keyboard([
        [styledButton('🎒 رفتن به کوله', 'menu_inventory', 'primary')],
        [styledButton('« ادامه خرید', 'menu_shop', 'primary')]
      ])
    }
  );
});

// ============================================================
//                      اکشن‌های کوله‌پشتی
// ============================================================

bot.action(/^inv_item_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  
  if (!player.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  const item = findItemById(itemId);
  
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  
  const isEquipped = (player.equippedWeapon === itemId || player.equippedArmor === itemId);
  const rarityLabel = RARITY_LABELS[item.rarity] || '';
  const sellPrice = Math.round(item.price * getSellMultiplier(player));
  
  let info = `📦 *${item.label}*\n\n`;
  info += `نوع: ${item.type === 'weapon' ? '🗡 سلاح' : item.type === 'armor' ? '🛡 زره' : '🧪 معجون'}\n`;
  
  if (rarityLabel) {
    info += `کیفیت: ${rarityLabel}\n`;
  }
  
  if (item.atkBonus) {
    info += `💪 حمله: +${item.atkBonus}\n`;
  }
  if (item.defBonus) {
    info += `🛡 دفاع: +${item.defBonus}\n`;
  }
  if (item.desc) {
    info += `📝 ${item.desc}\n`;
  }
  
  info += `💰 قیمت خرید: ${item.price} طلا\n`;
  info += `💰 قیمت فروش: ${sellPrice} طلا\n`;
  
  if (isEquipped) {
    info += `✅ *تجهیز شده*`;
  }
  
  info += `\n\nچکار می‌خوای باهاش کنی؟`;
  
  await ctx.reply(
    info,
    {
      parse_mode: 'Markdown',
      ...getItemActionKeyboard(itemId)
    }
  );
});

// ============================================================
//                      اکشن‌های تجهیز/مصرف/فروش آیتم
// ============================================================

bot.action(/^equip_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  
  if (!player.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  const item = findItemById(itemId);
  
  if (!item || (item.type !== 'weapon' && item.type !== 'armor')) {
    await ctx.answerCbQuery('فقط سلاح و زره قابل تجهیزن!', { show_alert: true });
    return;
  }
  
  if (item.type === 'weapon') {
    player.equippedWeapon = itemId;
  } else {
    player.equippedArmor = itemId;
  }
  
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ ${item.label} تجهیز شد!`);
  
  await ctx.reply(
    `✅ *${item.label}* تجهیز شد!`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_inventory')
    }
  );
});

bot.action(/^use_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  
  if (!player.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  const item = findItemById(itemId);
  
  if (!item || item.type !== 'consumable') {
    await ctx.answerCbQuery('این آیتم قابل مصرف نیست!', { show_alert: true });
    return;
  }
  
  const index = player.inventory.indexOf(itemId);
  player.inventory.splice(index, 1);
  
  if (item.effect === 'heal') {
    const healAmount = Math.round(player.maxHp * 0.4);
    player.currentHp = Math.min(player.maxHp, player.currentHp + healAmount);
  } else if (item.effect === 'power') {
    player.activeEffects.power = true;
  } else if (item.effect === 'luck') {
    player.activeEffects.luck = true;
  } else if (item.effect === 'revive') {
    player.activeEffects.revive = true;
  }
  
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ ${item.label} مصرف شد!`);
  
  await ctx.reply(
    `✅ *${item.label}* مصرف شد!\nاثر تا نبرد بعدی فعاله.`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_inventory')
    }
  );
});

bot.action(/^sell_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  const item = findItemById(itemId);
  
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  
  // استفاده از تابع مشترک
  const removeResult = removeItemFromInventory(player, itemId);
  if (!removeResult.success) {
    await ctx.answerCbQuery(removeResult.msg, { show_alert: true });
    return;
  }
  
  const sellPrice = Math.round(item.price * getSellMultiplier(player));
  player.gold += sellPrice;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`💰 ${item.label} فروخته شد!`);
  
  await ctx.reply(
    `💰 *${item.label}* رو به ${sellPrice} طلا فروختی!\n💰 موجودی جدید: ${player.gold} طلا`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_inventory')
    }
  );
});

// ============================================================
//                      اکشن‌های پیشه
// ============================================================

bot.action(/^profession_pick_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const profKey = ctx.match[1];
  const prof = PROFESSIONS[profKey];
  
  if (!prof) {
    await ctx.answerCbQuery('پیشه نامعتبر!', { show_alert: true });
    return;
  }
  
  if (player.profession) {
    if (player.gold < 50) {
      await ctx.answerCbQuery('برای تغییر پیشه ۵۰ طلا نیازه!', { show_alert: true });
      return;
    }
    player.gold -= 50;
  }
  
  if (player.gold < prof.price) {
    await ctx.answerCbQuery(
      `طلای کافی نداری! (${prof.price} طلا نیاز است)`,
      { show_alert: true }
    );
    return;
  }
  
  player.gold -= prof.price;
  player.profession = profKey;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ ${prof.name} انتخاب شد!`);
  
  await ctx.reply(
    `✅ *${prof.name}* انتخاب شد!\n${prof.desc}\n💰 ${player.gold} طلا مونده.`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_profession')
    }
  );
});

bot.action('profession_change', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  if (player.gold < 50) {
    await ctx.answerCbQuery('۵۰ طلا نیازه!', { show_alert: true });
    return;
  }
  
  player.gold -= 50;
  player.profession = null;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery('🔄 پیشه تغییر کرد!');
  await showProfession(ctx);
});

// ============================================================
//                      اکشن‌های پت
// ============================================================

bot.action(/^pet_buy_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const petKey = ctx.match[1];
  const pet = PETS[petKey];
  
  if (!pet) {
    await ctx.answerCbQuery('پت نامعتبر!', { show_alert: true });
    return;
  }
  
  if (player.gold < pet.price) {
    await ctx.answerCbQuery(
      `طلای کافی نداری! (${pet.price} طلا)`,
      { show_alert: true }
    );
    return;
  }
  
  player.gold -= pet.price;
  player.pet = petKey;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ ${pet.name} خریداری شد!`);
  
  await ctx.reply(
    `🐾 *${pet.name}* همراهت شد!\n${pet.desc}`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_pet')
    }
  );
});

bot.action('pet_change', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  player.pet = null;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery('🔄 پت عوض شد!');
  await showPet(ctx);
});

// ============================================================
//                      اکشن‌های کرفتینگ (رفع باگ)
// ============================================================

bot.action(/^craft_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const recipeId = ctx.match[1];
  
  try {
    const result = performCraft(player, recipeId);
    
    if (!result.success) {
      await ctx.answerCbQuery(result.msg, { show_alert: true });
      return;
    }
    
    savePlayerByCtx(ctx, player);
    
    await ctx.answerCbQuery(`✅ ${result.item?.label || 'آیتم'} ساخته شد!`);
    
    await ctx.reply(
      `${result.msg}\n` +
      `📦 ${result.item?.label || 'آیتم'} به کوله‌پشتی اضافه شد!\n` +
      `💰 ${player.gold} طلا مونده.`,
      {
        parse_mode: 'Markdown',
        ...keyboard([
          [styledButton('🎒 رفتن به کوله', 'menu_inventory', 'primary')],
          [styledButton('🔨 ادامه کرفتینگ', 'menu_crafting', 'primary')],
          [styledButton('« بازگشت به منو', 'menu_main', 'primary')]
        ])
      }
    );
    
  } catch (error) {
    console.error('❌ خطا در کرفتینگ:', error.message);
    await ctx.reply(
      '⚠️ خطایی در کرفتینگ رخ داد! لطفاً دوباره تلاش کن.',
      backButton('menu_crafting')
    );
  }
});

// ============================================================
//                      اکشن‌های گیلد
// ============================================================

bot.action('guild_create', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  if (player.gold < 200) {
    await ctx.answerCbQuery('۲۰۰ طلا نیازه!', { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  
  await ctx.reply(
    '🏗 *ساخت گیلد جدید*\n\nاسم گیلد رو انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...getGuildNameKeyboard()
    }
  );
});

bot.action(/^guild_name_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const nameMap = {
    Fire: '🔥 آتشین',
    Storm: '⚡ صاعقه',
    Wave: '🌊 موج‌ها',
    Mountain: '🗻 کوهستان',
    Moon: '🌙 ماه‌تاب'
  };
  
  const name = nameMap[ctx.match[1]] || ctx.match[1];
  
  player.gold -= 200;
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  const guildId = createNewGuild(name, playerKey, ctx.chat.id);
  player.guild = guildId;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery(`✅ گیلد ${name} ساخته شد!`);
  
  await ctx.reply(
    `🏰 *${name}* ساخته شد!\n💰 ${player.gold} طلا مونده.`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_guild')
    }
  );
});

bot.action('guild_list', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  const guildList = Object.values(guilds)
    .filter(g => g.chatId === ctx.chat.id)
    .filter(g => !g.members.includes(playerKey));
  
  if (guildList.length === 0) {
    await ctx.reply(
      'هیچ گیلد قابل‌جوینی وجود نداره!',
      backButton('menu_guild')
    );
    return;
  }
  
  const rows = guildList.map(g => [
    styledButton(`🏰 ${g.name} (${g.members.length} عضو)`, `guild_join_${g.id}`, 'success')
  ]);
  rows.push([styledButton('« بازگشت', 'menu_guild', 'primary')]);
  
  await ctx.reply(
    '📋 *لیست گیلدها*\n\nروی گیلد مورد نظر کلیک کن تا بهش بپیوندی:',
    {
      parse_mode: 'Markdown',
      ...keyboard(rows)
    }
  );
});

bot.action(/^guild_join_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const guildId = ctx.match[1];
  const guild = getGuildById(guildId);
  
  if (!guild) {
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  
  if (guild.members.includes(playerKey)) {
    await ctx.answerCbQuery('قبلاً عضو این گیلدی!', { show_alert: true });
    return;
  }
  
  guild.members.push(playerKey);
  player.guild = guildId;
  savePlayerByCtx(ctx, player);
  markGuildsChanged();
  saveAllData();
  
  await ctx.answerCbQuery(`✅ به ${guild.name} پیوستی!`);
  await ctx.reply(`🏰 به *${guild.name}* پیوستی!`, backButton('menu_guild'));
});

bot.action('guild_invite', async (ctx) => {
  await ctx.answerCbQuery('🔜 در حال توسعه...');
});

bot.action('guild_disband', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player || !player.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  
  const guild = getGuildById(player.guild);
  
  if (!guild) {
    player.guild = null;
    savePlayerByCtx(ctx, player);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  if (guild.leader !== playerKey) {
    await ctx.answerCbQuery('فقط رهبر می‌تونه گیلد رو منحل کنه!', { show_alert: true });
    return;
  }
  
  delete guilds[player.guild];
  player.guild = null;
  savePlayerByCtx(ctx, player);
  markGuildsChanged();
  saveAllData();
  
  await ctx.answerCbQuery('🗑 گیلد منحل شد!');
  await showGuild(ctx);
});

bot.action('guild_boss', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player || !player.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  
  const guild = getGuildById(player.guild);
  
  if (!guild) {
    player.guild = null;
    savePlayerByCtx(ctx, player);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  
  if (guild.bossHp <= 0) {
    guild.bossHp = guild.bossMaxHp;
    guild.bossDefeated += 1;
    markGuildsChanged();
    saveAllData();
    await ctx.answerCbQuery('🐉 باس گیلد ریست شد!');
    await showGuild(ctx);
    return;
  }
  
  const damage = Math.round(10 + Math.random() * 20 + player.level * 2);
  guild.bossHp = Math.max(0, guild.bossHp - damage);
  
  // اگر باس کشته شد، تعداد رو افزایش بده
  let bossJustKilled = false;
  if (guild.bossHp <= 0) {
    guild.bossDefeated += 1;
    bossJustKilled = true;
  }
  
  const goldReward = Math.round(5 + Math.random() * 10);
  const xpReward = Math.round(5 + Math.random() * 10);
  player.gold += goldReward;
  player.xp += xpReward;
  
  savePlayerByCtx(ctx, player);
  markGuildsChanged();
  saveAllData();
  
  let text = `⚔️ *حمله به باس گیلد!*\n`;
  text += `💥 ${damage} آسیب زدی!\n`;
  text += `❤️ باس: ${Math.max(0, guild.bossHp)}/${guild.bossMaxHp}\n`;
  text += `💰 +${goldReward} طلا | ✨ +${xpReward} تجربه\n`;
  
  if (bossJustKilled) {
    text += `\n🎉 *باس گیلد شکست خورد!*\n`;
    text += `🏆 ${guild.members.length} عضو پاداش می‌گیرن!`;
    
    guild.members.forEach(memberKey => {
      const member = getPlayerByKey(memberKey);
      if (member) {
        member.gold += 50 + Math.round(Math.random() * 30);
        member.xp += 30 + Math.round(Math.random() * 20);
        savePlayerByKey(memberKey, member);
      }
    });
  }
  
  await ctx.reply(
    text,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_guild')
    }
  );
});

bot.action('guild_donate', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player || !player.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  
  const guild = getGuildById(player.guild);
  
  if (!guild) {
    player.guild = null;
    savePlayerByCtx(ctx, player);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  
  const amount = 10 + Math.round(Math.random() * 20);
  
  if (player.gold < amount) {
    await ctx.answerCbQuery('طلای کافی نداری!', { show_alert: true });
    return;
  }
  
  player.gold -= amount;
  guild.bank += amount;
  savePlayerByCtx(ctx, player);
  markGuildsChanged();
  saveAllData();
  
  await ctx.answerCbQuery(`💰 ${amount} طلا به صندوق کمک شد!`);
  await showGuild(ctx);
});

// ============================================================
//                      اکشن‌های PvP
// ============================================================

bot.action('pvp_find', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  PVP_QUEUE.push(playerKey);
  
  await ctx.answerCbQuery('🔍 در صف PvP قرار گرفتی...');
  
  const opponentKey = findPvPOpponent(playerKey);
  
  if (opponentKey) {
    const opponent = getPlayerByKey(opponentKey);
    
    if (opponent) {
      const result = simulatePvP(player, opponent);
      
      let text = '⚔️ *نبرد PvP*\n\n';
      text += result.log.slice(0, 5).join('\n');
      if (result.log.length > 5) text += '\n...';
      text += '\n\n';
      
      if (result.winner === 1) {
        player.pvpWins += 1;
        opponent.pvpLosses += 1;
        const goldReward = 30 + Math.round(Math.random() * 20);
        player.gold += goldReward;
        updatePlayerQuests(player, 'pvp');
        text += `🎉 *برنده شدی!* +${goldReward} طلا`;
      } else {
        player.pvpLosses += 1;
        opponent.pvpWins += 1;
        text += `😔 *باختی...*`;
      }
      
      savePlayerByCtx(ctx, player);
      savePlayerByKey(opponentKey, opponent);
      
      const index = PVP_QUEUE.indexOf(playerKey);
      if (index > -1) PVP_QUEUE.splice(index, 1);
      
      await ctx.reply(
        text,
        {
          parse_mode: 'Markdown',
          ...backButton('menu_pvp')
        }
      );
      
      try {
        await bot.telegram.sendMessage(
          parseInt(opponentKey.split(':')[1]),
          `⚔️ نبرد PvP با ${player.name} تمام شد!\n${result.winner === 2 ? '🎉 برنده شدی!' : '😔 باختی...'}`
        );
      } catch (e) {}
      
      return;
    }
  }
  
  await ctx.reply(
    '🔍 *در صف PvP هستی...*\nمنتظر حریف بمان.',
    {
      parse_mode: 'Markdown',
      ...keyboard([
        [styledButton('❌ خروج از صف', 'pvp_leave', 'danger')],
        [styledButton('« بازگشت', 'menu_main', 'primary')]
      ])
    }
  );
});

bot.action('pvp_leave', async (ctx) => {
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  const index = PVP_QUEUE.indexOf(playerKey);
  
  if (index > -1) {
    PVP_QUEUE.splice(index, 1);
  }
  
  await ctx.answerCbQuery('✅ از صف خارج شدی!');
  
  await ctx.reply(
    '✅ از صف PvP خارج شدی.',
    backButton('menu_pvp')
  );
});

bot.action('pvp_leaderboard', async (ctx) => {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p)
    .sort((a, b) => b.pvpWins - a.pvpWins)
    .slice(0, 10);
  
  if (chatPlayers.length === 0) {
    await ctx.reply(
      'هنوز کسی PvP نرفته!',
      backButton('menu_pvp')
    );
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  const lines = chatPlayers.map((p, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const classData = CLASSES[p.classKey];
    return `${rank} ${classData.emoji} *${p.name}* — ${p.pvpWins} برد`;
  });
  
  await ctx.reply(
    `🏆 *رتبه‌بندی PvP*\n\n${lines.join('\n')}`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_pvp')
    }
  );
});

// ============================================================
//                      اکشن‌های بازار
// ============================================================

bot.action('market_sell', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  if (player.inventory.length === 0) {
    await ctx.answerCbQuery('کوله‌پشتیت خالیه!', { show_alert: true });
    return;
  }
  
  const rows = [];
  const items = player.inventory;
  
  for (let i = 0; i < items.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < items.length; j++) {
      const id = items[j];
      const item = findItemById(id);
      row.push(styledButton(
        item?.label || 'نامشخص',
        `market_sell_item_${id}`,
        'primary'
      ));
    }
    rows.push(row);
  }
  
  rows.push([styledButton('« انصراف', 'menu_market', 'primary')]);
  
  await ctx.reply(
    '💰 *انتخاب آیتم برای فروش*\n\nروی آیتم کلیک کن:',
    {
      parse_mode: 'Markdown',
      ...keyboard(rows)
    }
  );
});

bot.action(/^market_sell_item_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  
  if (!player.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  const item = findItemById(itemId);
  
  await ctx.answerCbQuery();
  
  await ctx.reply(
    `💰 *قیمت فروش ${item?.label || 'آیتم'} رو انتخاب کن:*`,
    {
      parse_mode: 'Markdown',
      ...getSellPriceKeyboard(itemId)
    }
  );
});

bot.action(/^market_price_(.+)_(\d+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  const price = parseInt(ctx.match[2]);
  
  // استفاده از تابع مشترک
  const removeResult = removeItemFromInventory(player, itemId);
  if (!removeResult.success) {
    await ctx.answerCbQuery(removeResult.msg, { show_alert: true });
    return;
  }
  
  const playerKey = getPlayerKey(ctx.chat.id, ctx.from.id);
  addToMarket(playerKey, itemId, price);
  savePlayerByCtx(ctx, player);
  
  const item = findItemById(itemId);
  
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} در بازار قرار گرفت!`);
  
  await ctx.reply(
    `✅ *${item?.label || 'آیتم'}* در بازار قرار گرفت!\n💰 قیمت: ${price} طلا`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_market')
    }
  );
});

bot.action(/^market_buy_(.+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const listingId = ctx.match[1];
  const listing = market[listingId];
  
  if (!listing) {
    await ctx.answerCbQuery('این آیتم دیگه فروخته شده!', { show_alert: true });
    return;
  }
  
  if (player.gold < listing.price) {
    await ctx.answerCbQuery(
      `طلای کافی نداری! (${listing.price} طلا)`,
      { show_alert: true }
    );
    return;
  }
  
  player.gold -= listing.price;
  player.inventory.push(listing.itemId);
  
  const seller = getPlayerByKey(listing.playerKey);
  if (seller) {
    seller.gold += listing.price;
    savePlayerByKey(listing.playerKey, seller);
  }
  
  removeFromMarket(listingId);
  savePlayerByCtx(ctx, player);
  
  const item = findItemById(listing.itemId);
  
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} خریداری شد!`);
  
  await ctx.reply(
    `✅ *${item?.label || 'آیتم'}* خریداری شد!\n💰 ${player.gold} طلا مونده.`,
    {
      parse_mode: 'Markdown',
      ...backButton('menu_market')
    }
  );
});

// ============================================================
//                      اکشن‌های رتبه‌بندی
// ============================================================

bot.action(/^lb_(level|gold|wins)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await showLeaderboard(ctx, ctx.match[1]);
});

// ============================================================
//                      اکشن‌های داستان (رفع باگ)
// ============================================================

bot.action(/^story_(\d+)$/, async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const chapterId = parseInt(ctx.match[1]);
  const chapter = STORY_CHAPTERS.find(c => c.id === chapterId);
  
  if (!chapter) {
    await ctx.answerCbQuery('داستان تمام شد!', { show_alert: true });
    return;
  }
  
  // اعمال اثر انتخاب قبلی
  const prevChapter = STORY_CHAPTERS.find(c => c.choices && c.choices.some(ch => ch.next === chapterId));
  if (prevChapter) {
    const choice = prevChapter.choices.find(ch => ch.next === chapterId);
    if (choice && choice.effect) {
      const parts = choice.effect.split('+');
      if (parts.length === 2) {
        const type = parts[0];
        const value = parseInt(parts[1]);
        if (type === 'gold') {
          player.gold += value;
        } else if (type === 'xp') {
          player.xp += value;
        } else if (type === 'def') {
          player.baseDef += value;
        }
      } else if (choice.effect === 'pet+wolf') {
        if (!player.pet) {
          player.pet = 'wolf';
        }
      }
    }
  }
  
  // 🔧 اصلاح: storyProgress رو برابر فصل مقصد قرار بده
  player.storyProgress = chapterId;
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery();
  await showStory(ctx);
});

// ============================================================
//                      اکشن‌های ماموریت
// ============================================================

bot.action('quests_refresh', async (ctx) => {
  const player = getPlayerByCtx(ctx);
  
  if (!player) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  if (player.gold < 50) {
    await ctx.answerCbQuery('۵۰ طلا نیازه!', { show_alert: true });
    return;
  }
  
  player.gold -= 50;
  player.quests = [];
  generateQuestsForPlayer(player);
  savePlayerByCtx(ctx, player);
  
  await ctx.answerCbQuery('🔄 ماموریت‌ها تازه شد!');
  await showQuests(ctx);
});

// ============================================================
//                      دکمه‌های بی‌استفاده (ignore)
// ============================================================

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
});

// ============================================================
//                      فال‌بک (رفع باگ اسپم)
// ============================================================

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // فقط به دستورات خاص پاسخ بده
  if (text.startsWith('/')) {
    const player = getPlayerByCtx(ctx);
    if (!player) {
      await ctx.reply('🗡 اول /start کن!', getClassSelectionKeyboard());
    } else {
      await sendMainMenu(ctx);
    }
    return;
  }
  
  // برای پیام‌های عادی، کاری نکن (مزاحم نشو)
});

// ============================================================
//                      مدیریت خطاها
// ============================================================

bot.catch((err, ctx) => {
  console.error(`❌ خطا در آپدیت ${ctx.updateType}:`, err.message);
  console.error(err.stack);
  
  if (ctx && ctx.reply) {
    ctx.reply(
      '⚠️ یه مشکلی پیش اومد! لطفاً دوباره تلاش کن.',
      backButton('menu_main')
    ).catch(() => {});
  }
});

// ============================================================
//                      راه‌اندازی نهایی
// ============================================================

bot.launch()
  .then(() => {
    console.log('🗡 افسانه‌ی گروه (نسخه ۴.۲) شروع شد!');
    console.log(`📁 تعداد بازیکنان: ${Object.keys(players).length}`);
    console.log(`🏰 تعداد گیلدها: ${Object.keys(guilds).length}`);
    console.log(`💰 تعداد آیتم‌های بازار: ${Object.keys(market).length}`);
    console.log(`📖 تعداد فصل‌های داستان: ${STORY_CHAPTERS.length}`);
  })
  .catch((err) => {
    console.error('❌ خطا در راه‌اندازی ربات:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => {
  console.log('🛑 ربات متوقف شد (SIGINT)');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('🛑 ربات متوقف شد (SIGTERM)');
  bot.stop('SIGTERM');
});

// ============================================================
//                      پایان کد
// ============================================================
