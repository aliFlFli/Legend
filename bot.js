/**
 * 🗡 افسانه‌ی گروه (نسخه ۴.۲) — ربات RPG کامل برای گروه‌های تلگرام
 * ------------------------------------------------------------------
 * ویژگی‌های اصلی:
 *  - کنترل کامل با دکمه‌های شیشه‌ای
 *  - سیستم کلاس‌ها، فروشگاه، پیشه‌ها، پت‌ها
 *  - سیستم ماموریت، کرفتینگ، گیلد، PvP
 *  - سیستم داستان‌سرایی، بازار، حالت سخت
 *  - منوی جذاب با ۳-۴ دکمه در هر ردیف
 *  - رفع باگ کامل کرفتینگ و مدیریت آیتم‌ها
 *  - مدیریت صحیح آیتم‌های تکراری در کوله
 */

const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
require('dotenv').config();

// ============================================================
//                      تنظیمات اولیه
// ============================================================

const PATHS = {
  PLAYERS: path.join(__dirname, 'players.json'),
  GUILDS: path.join(__dirname, 'guilds.json'),
  MARKET: path.join(__dirname, 'market.json'),
};

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf-8');
  }
}

ensureFile(PATHS.PLAYERS);
ensureFile(PATHS.GUILDS);
ensureFile(PATHS.MARKET);

// ============================================================
//                      دیتابیس
// ============================================================

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
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

let players = loadJSON(PATHS.PLAYERS);
let guilds = loadJSON(PATHS.GUILDS);
let market = loadJSON(PATHS.MARKET);

function saveAll() {
  saveJSON(PATHS.PLAYERS, players);
  saveJSON(PATHS.GUILDS, guilds);
  saveJSON(PATHS.MARKET, market);
}

// ============================================================
//                      توابع کمکی
// ============================================================

function getKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

function getPlayer(ctx) {
  const key = getKey(ctx.chat.id, ctx.from.id);
  return players[key] || null;
}

function savePlayer(ctx, data) {
  const key = getKey(ctx.chat.id, ctx.from.id);
  players[key] = data;
  saveAll();
}

function getPlayerByKey(key) {
  return players[key] || null;
}

function savePlayerByKey(key, data) {
  players[key] = data;
  saveAll();
}

function btn(text, data, style) {
  const b = { text, callback_data: data };
  if (style) b.style = style;
  return b;
}

function kb(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

function back(data = 'menu_main') {
  return kb([[btn('« بازگشت', data, 'primary')]]);
}

// ============================================================
//                      کلاس‌ها
// ============================================================

const CLASSES = {
  warrior: { label: 'جنگجو', emoji: '⚔️', hp: 40, atk: 8, def: 5, desc: 'سلامتی و دفاع بالا' },
  mage: { label: 'جادوگر', emoji: '🔮', hp: 26, atk: 12, def: 2, desc: 'قدرت حمله بالا' },
  archer: { label: 'تیرانداز', emoji: '🏹', hp: 32, atk: 10, def: 3, desc: 'متعادل' }
};

// ============================================================
//                      آیتم‌ها
// ============================================================

const RARITY = {
  common: 'عادی',
  rare: '🔷 کمیاب',
  epic: '🟣 حماسی',
  legendary: '🟡 افسانه‌ای',
  mythic: '🔥 اسطوره‌ای'
};

const WEAPONS = [
  { id: 'w1', label: 'خنجر زنگ‌زده', emoji: '🗡', type: 'weapon', rarity: 'common', atk: 2, price: 15 },
  { id: 'w2', label: 'شمشیر آهنی', emoji: '⚔️', type: 'weapon', rarity: 'common', atk: 4, price: 40 },
  { id: 'w3', label: 'شمشیر نقره‌ای', emoji: '🔷', type: 'weapon', rarity: 'rare', atk: 9, price: 120 },
  { id: 'w4', label: 'تبر حماسی', emoji: '🟣', type: 'weapon', rarity: 'epic', atk: 14, price: 220 },
  { id: 'w5', label: 'نیزه اژدها', emoji: '🐉', type: 'weapon', rarity: 'legendary', atk: 20, price: 400 },
  { id: 'w6', label: 'شمشیر ققنوس', emoji: '🔥', type: 'weapon', rarity: 'mythic', atk: 28, price: 700 }
];

const ARMORS = [
  { id: 'a1', label: 'زره چرمی', emoji: '🥋', type: 'armor', rarity: 'common', def: 2, price: 30 },
  { id: 'a2', label: 'زره آهنی', emoji: '🛡', type: 'armor', rarity: 'common', def: 5, price: 90 },
  { id: 'a3', label: 'زره نقره‌ای', emoji: '🔷', type: 'armor', rarity: 'rare', def: 9, price: 180 },
  { id: 'a4', label: 'زره فلس اژدها', emoji: '🐲', type: 'armor', rarity: 'epic', def: 15, price: 350 }
];

const CONSUMABLES = [
  { id: 'c1', label: 'معجون سلامتی', emoji: '🧪', type: 'consumable', effect: 'heal', price: 15, desc: '۴۰٪ سلامتی' },
  { id: 'c2', label: 'معجون قدرت', emoji: '💥', type: 'consumable', effect: 'power', price: 25, desc: '۵۰٪ حمله بیشتر' },
  { id: 'c3', label: 'طلسم شانس', emoji: '🍀', type: 'consumable', effect: 'luck', price: 25, desc: 'شانس کریت بیشتر' },
  { id: 'c4', label: 'سنگ احیا', emoji: '✨', type: 'consumable', effect: 'revive', price: 60, desc: 'یک‌بار نجات' }
];

const ALL_ITEMS = [...WEAPONS, ...ARMORS, ...CONSUMABLES];

function findItem(id) {
  return ALL_ITEMS.find(i => i.id === id);
}

// ============================================================
//                      پیشه‌ها
// ============================================================

const PROFESSIONS = {
  blacksmith: { name: 'آهنگر', emoji: '⚒️', desc: 'تخفیف ۲۰٪ سلاح و زره', price: 100, discount: 0.2 },
  alchemist: { name: 'کیمیاگر', emoji: '🧪', desc: 'تخفیف ۲۰٪ معجون', price: 100, discount: 0.2 },
  merchant: { name: 'بازرگان', emoji: '💰', desc: 'فروش با ۸۰٪ قیمت', price: 150, sellBonus: 1.3 },
  hunter: { name: 'شکارچی', emoji: '🏹', desc: 'شانس آیتم بعد از نبرد', price: 150, dropChance: 0.2 }
};

// ============================================================
//                      پت‌ها
// ============================================================

const PETS = {
  wolf: { name: 'گرگ خاکستری', emoji: '🐺', type: 'atk', value: 3, price: 100, desc: '+۳ حمله' },
  phoenix: { name: 'ققنوس کوچک', emoji: '🔥', type: 'revive', value: 1, price: 300, desc: 'یک‌بار احیا' },
  dragon: { name: 'اژدهای زاده', emoji: '🐉', type: 'all', value: 2, price: 500, desc: '+۲ به همه چیز' },
  fairy: { name: 'پری جنگل', emoji: '🧚', type: 'heal', value: 15, price: 200, desc: 'شانس بهبودی' }
};

// ============================================================
//                      ماموریت‌ها
// ============================================================

const QUESTS = [
  { id: 'q1', name: 'شکارچی مبتدی', desc: '۳ هیولا بکش', target: 3, type: 'kill', gold: 30, xp: 20 },
  { id: 'q2', name: 'شکارچی حرفه‌ای', desc: '۱۰ هیولا بکش', target: 10, type: 'kill', gold: 80, xp: 50 },
  { id: 'q3', name: 'باس‌کش', desc: '۱ باس بکش', target: 1, type: 'boss', gold: 100, xp: 80 },
  { id: 'q4', name: 'ثروتمند', desc: '۲۰۰ طلا جمع کن', target: 200, type: 'gold', gold: 40, xp: 30 },
  { id: 'q5', name: 'تجهیزات‌باز', desc: '۳ آیتم بخر', target: 3, type: 'buy', gold: 50, xp: 25 },
  { id: 'q6', name: 'کامل‌گرا', desc: '۵ نبرد ببر', target: 5, type: 'win', gold: 60, xp: 40 }
];

// ============================================================
//                      دستورهای کرفتینگ
// ============================================================

const RECIPES = [
  {
    id: 'r1',
    name: 'شمشیر نقره‌ای',
    emoji: '⚔️',
    result: 'w3',
    need: ['w2', 'w2', 'a2'],
    cost: 30,
    desc: '۲ شمشیر آهنی + زره آهنی'
  },
  {
    id: 'r2',
    name: 'تبر حماسی',
    emoji: '🟣',
    result: 'w4',
    need: ['w3', 'w3', 'a3'],
    cost: 50,
    desc: '۲ شمشیر نقره‌ای + زره نقره‌ای'
  },
  {
    id: 'r3',
    name: 'سنگ احیا',
    emoji: '✨',
    result: 'c4',
    need: ['c1', 'c2', 'c3'],
    cost: 20,
    desc: 'معجون سلامتی + قدرت + شانس'
  },
  {
    id: 'r4',
    name: 'زره فلس اژدها',
    emoji: '🐲',
    result: 'a4',
    need: ['a3', 'a3', 'w5'],
    cost: 100,
    desc: '۲ زره نقره‌ای + نیزه اژدها'
  },
  {
    id: 'r5',
    name: 'شمشیر ققنوس',
    emoji: '🔥',
    result: 'w6',
    need: ['w5', 'w5', 'a4', 'c4'],
    cost: 200,
    desc: '۲ نیزه اژدها + زره اژدها + سنگ احیا'
  }
];

// ============================================================
//                      هیولاها
// ============================================================

const MONSTERS = [
  { name: 'گرگ جنگلی', emoji: '🐺' },
  { name: 'اسکلت', emoji: '💀' },
  { name: 'عنکبوت غول‌پیکر', emoji: '🕷️' },
  { name: 'گابلین', emoji: '👺' },
  { name: 'خفاش خون‌آشام', emoji: '🦇' },
  { name: 'گولم سنگی', emoji: '🗿' },
  { name: 'روح سرگردان', emoji: '👻' },
  { name: 'ترول', emoji: '🧌' },
  { name: 'شوالیه سیاه', emoji: '🖤' },
  { name: 'مومیایی', emoji: '🧟' },
  { name: 'جن صحرا', emoji: '🧞' },
  { name: 'کرکس غول‌آسا', emoji: '🦅' },
  { name: 'مار سمی', emoji: '🐍' },
  { name: 'خرچنگ غول‌پیکر', emoji: '🦀' },
  { name: 'گرگینه', emoji: '🐾' },
  { name: 'شبح جنگل', emoji: '🌲' },
  { name: 'دیو کوچک', emoji: '👹' }
];

const BOSSES = [
  { name: 'اژدهای سیاه', emoji: '🐲' },
  { name: 'لیچ پادشاه', emoji: '👑' },
  { name: 'دیو آتشین', emoji: '🌋' }
];

const BOSS_CHANCE = 0.08;

// ============================================================
//                      داستان
// ============================================================

const STORY = [
  {
    id: 1,
    title: '🌅 شروع ماجراجویی',
    desc: 'در دهکده آریا بیدار میشی. یادداشتی روی میز: "به دنبال اژدهای سیاه برو!"',
    options: [
      { text: '🍺 به میخانه برو', next: 2, effect: 'gold+20' },
      { text: '🌲 به جنگل برو', next: 3, effect: 'xp+15' }
    ]
  },
  {
    id: 2,
    title: '🍺 میخانه',
    desc: 'پیرمردی میگه: "اژدها تو کوهستان آتشینه..."',
    options: [
      { text: '🗺️ نقشه بگیر', next: 4, effect: 'nothing' }
    ]
  },
  {
    id: 3,
    title: '🌲 جنگل',
    desc: 'گرگ زخمی پیدا میکنی...',
    options: [
      { text: '❤️ کمک کن', next: 4, effect: 'pet+wolf' }
    ]
  },
  {
    id: 4,
    title: '🏔️ کوهستان',
    desc: 'به کوهستان آتشین رسیدی! اژدها رو می‌بینی...',
    options: [
      { text: '⚔️ بجنگ', next: 5, effect: 'gold+100' },
      { text: '🏠 برگرد', next: 6, effect: 'nothing' }
    ]
  },
  {
    id: 5,
    title: '🐉 پیروزی!',
    desc: 'اژدها رو شکست دادی! قهرمان دهکده شدی! 🎉',
    options: []
  },
  {
    id: 6,
    title: '🏠 بازگشت',
    desc: 'به دهکده برگشتی... حسرت موند توی دلت.',
    options: [
      { text: '🔄 از اول', next: 1, effect: 'nothing' }
    ]
  }
];

// ============================================================
//                      توابع اصلی بازی
// ============================================================

function xpNeed(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function newPlayer(ctx, classKey) {
  const c = CLASSES[classKey];
  return {
    name: ctx.from.first_name || 'ماجراجو',
    class: classKey,
    level: 1,
    xp: 0,
    gold: 50,
    maxHp: c.hp,
    hp: c.hp,
    atk: c.atk,
    def: c.def,
    weapon: null,
    armor: null,
    items: [],
    pet: null,
    profession: null,
    effects: { power: false, luck: false, revive: false },
    wins: 0,
    losses: 0,
    bosses: 0,
    daily: 0,
    streak: 0,
    guild: null,
    pvpWins: 0,
    pvpLosses: 0,
    story: 0,
    hard: false,
    quests: [],
    doneQuests: [],
    craftLevel: 1,
    crafted: 0,
    created: Date.now()
  };
}

function getAtk(p) {
  const w = findItem(p.weapon);
  let a = p.atk + (w ? w.atk : 0);
  if (p.effects.power) a = Math.round(a * 1.5);
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && (pet.type === 'atk' || pet.type === 'all')) a += pet.value;
  }
  if (p.hard) a = Math.round(a * 0.9);
  return a;
}

function getDef(p) {
  const a = findItem(p.armor);
  let d = p.def + (a ? a.def : 0);
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && pet.type === 'all') d += pet.value;
  }
  return d;
}

function getCrit(p) {
  let c = p.effects.luck ? 0.35 : 0.15;
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && pet.type === 'crit') c += pet.value;
  }
  return c;
}

function getDiscount(p) {
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    if (prof && prof.discount) return prof.discount;
  }
  return 0;
}

function getSellBonus(p) {
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    if (prof && prof.sellBonus) return prof.sellBonus;
  }
  return 1;
}

function levelUp(p) {
  const gained = [];
  while (p.xp >= xpNeed(p.level)) {
    p.xp -= xpNeed(p.level);
    p.level++;
    p.maxHp += 6;
    p.hp = p.maxHp;
    p.atk += 2;
    p.def += 1;
    gained.push(p.level);
  }
  return gained;
}

function makeMonster(level) {
  const lv = Math.max(1, level);
  const isBoss = Math.random() < BOSS_CHANCE;
  const pool = isBoss ? BOSSES : MONSTERS;
  const base = pool[Math.floor(Math.random() * pool.length)];
  const scale = 0.5 + (lv * 0.05) + Math.random() * 0.2;
  const m = isBoss ? 1.5 : 1;
  return {
    ...base,
    isBoss,
    hp: Math.round((15 + lv * 5) * scale * m),
    atk: Math.round((5 + lv * 1.8) * scale * (isBoss ? 1.2 : 1)),
    def: Math.round((2 + lv * 0.7) * scale * (isBoss ? 1.15 : 1)),
    xp: Math.round((12 + lv * 4) * scale * (isBoss ? 3 : 1)),
    gold: Math.round((15 + lv * 5) * scale * (isBoss ? 3.5 : 1))
  };
}

function fight(p, monster) {
  let hp = p.hp;
  let mHp = monster.hp;
  const log = [];
  const atk = getAtk(p);
  const def = getDef(p);
  const crit = getCrit(p);
  let r = 0;
  
  while (hp > 0 && mHp > 0 && r < 25) {
    r++;
    let d = Math.max(1, Math.round(atk * (0.8 + Math.random() * 0.4) - monster.def * 0.5));
    if (Math.random() < crit) {
      d = Math.round(d * 1.8);
      log.push(`💥 کریت! ${d} آسیب`);
    } else {
      log.push(`⚔️ ${d} آسیب زدی`);
    }
    mHp -= d;
    if (mHp <= 0) break;
    const md = Math.max(1, Math.round(monster.atk * (0.8 + Math.random() * 0.4) - def * 0.5));
    hp -= md;
    log.push(`${monster.name} ${md} آسیب زد`);
  }
  
  let won = mHp <= 0 && hp > 0;
  let revived = false;
  
  if (!won && p.effects.revive && hp <= 0) {
    won = true;
    revived = true;
    hp = Math.round(p.maxHp * 0.3);
  }
  
  if (!won && p.pet === 'phoenix' && hp <= 0) {
    won = true;
    revived = true;
    hp = Math.round(p.maxHp * 0.2);
  }
  
  p.hp = Math.max(0, hp);
  return { won, log, revived, isBoss: monster.isBoss, gold: monster.gold, xp: monster.xp };
}

// ============================================================
//                      سیستم ماموریت
// ============================================================

function genQuests(p) {
  const available = QUESTS.filter(q =>
    !p.doneQuests.includes(q.id) &&
    !p.quests.find(qq => qq.id === q.id)
  );
  const shuffled = available.sort(() => Math.random() - 0.5);
  p.quests = shuffled.slice(0, 3).map(q => ({ ...q, progress: 0, done: false }));
}

function updateQuests(p, type, amount = 1) {
  p.quests.forEach(q => {
    if (!q.done && q.type === type) {
      q.progress += amount;
      if (q.progress >= q.target) {
        q.done = true;
        p.gold += q.gold;
        p.xp += q.xp;
        p.doneQuests.push(q.id);
      }
    }
  });
}

// ============================================================
//                      سیستم کرفتینگ (رفع باگ کامل)
// ============================================================

function canCraft(p, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { ok: false, msg: '❌ دستور پیدا نشد!' };
  if (p.gold < recipe.cost) {
    return { ok: false, msg: `💰 ${recipe.cost} طلا نیاز است!` };
  }
  
  // بررسی مواد اولیه - مهم: آیتم‌های تکراری رو درست بشمار
  const has = {};
  recipe.need.forEach(id => {
    has[id] = (has[id] || 0) + 1;
  });
  
  const missing = [];
  for (const [id, count] of Object.entries(has)) {
    const have = p.items.filter(i => i === id).length;
    if (have < count) {
      const item = findItem(id);
      missing.push(`${item?.label || id} (${have}/${count})`);
    }
  }
  
  if (missing.length > 0) {
    return { ok: false, msg: `❌ کم داری:\n${missing.join('\n')}` };
  }
  
  return { ok: true, recipe };
}

function doCraft(p, recipeId) {
  const check = canCraft(p, recipeId);
  if (!check.ok) return check;
  
  const recipe = check.recipe;
  
  // حذف مواد از کوله - یکی یکی
  recipe.need.forEach(id => {
    const idx = p.items.indexOf(id);
    if (idx > -1) p.items.splice(idx, 1);
  });
  
  p.gold -= recipe.cost;
  p.items.push(recipe.result);
  p.crafted = (p.crafted || 0) + 1;
  p.craftLevel = (p.craftLevel || 1) + 0.1;
  
  const item = findItem(recipe.result);
  return { ok: true, msg: `✅ ${recipe.emoji} ${recipe.name} ساخته شد!`, item };
}

// ============================================================
//                      سیستم گیلد
// ============================================================

function newGuild(name, leader, chatId) {
  const id = `g_${Date.now()}`;
  guilds[id] = {
    id, name, leader, chatId,
    members: [leader],
    level: 1,
    bank: 0,
    boss: 1000,
    maxBoss: 1000,
    defeated: 0,
    created: Date.now()
  };
  saveAll();
  return id;
}

function getGuild(id) {
  return guilds[id] || null;
}

// ============================================================
//                      سیستم PvP
// ============================================================

const PVP_QUEUE = [];

function findPvp(key) {
  for (let i = 0; i < PVP_QUEUE.length; i++) {
    if (PVP_QUEUE[i] !== key) {
      const opp = PVP_QUEUE[i];
      PVP_QUEUE.splice(i, 1);
      return opp;
    }
  }
  return null;
}

function pvpBattle(p1, p2) {
  const log = [];
  let h1 = p1.maxHp;
  let h2 = p2.maxHp;
  const a1 = getAtk(p1);
  const a2 = getAtk(p2);
  const d1 = getDef(p1);
  const d2 = getDef(p2);
  
  for (let r = 0; r < 5; r++) {
    const dmg1 = Math.max(1, Math.round(a1 * (0.7 + Math.random() * 0.6) - d2 * 0.3));
    h2 -= dmg1;
    log.push(`${p1.name} ${dmg1} آسیب زد`);
    if (h2 <= 0) break;
    const dmg2 = Math.max(1, Math.round(a2 * (0.7 + Math.random() * 0.6) - d1 * 0.3));
    h1 -= dmg2;
    log.push(`${p2.name} ${dmg2} آسیب زد`);
    if (h1 <= 0) break;
  }
  
  let winner = 0;
  if (h2 <= 0) winner = 1;
  else if (h1 <= 0) winner = 2;
  else winner = h1 > h2 ? 1 : 2;
  
  return { winner, log, h1: Math.max(0, h1), h2: Math.max(0, h2) };
}

// ============================================================
//                      سیستم بازار
// ============================================================

function addMarket(key, itemId, price) {
  const id = `m_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  market[id] = { id, key, itemId, price, time: Date.now() };
  saveAll();
  return id;
}

function removeMarket(id) {
  if (market[id]) {
    delete market[id];
    saveAll();
    return true;
  }
  return false;
}

function getMarket() {
  return Object.values(market);
}

// ============================================================
//                      توابع نمایشی
// ============================================================

function xpBar(p) {
  const need = xpNeed(p.level);
  const filled = Math.min(10, Math.round((p.xp / need) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

function title(p) {
  let t = '🌱 مبتدی';
  if (p.wins >= 50) t = '👑 افسانه';
  else if (p.wins >= 25) t = '🏆 قهرمان';
  else if (p.wins >= 10) t = '⚔️ کهنه‌کار';
  if (p.bosses >= 1) t += ' 🐉 اژدهاکش';
  return t;
}

function profile(p) {
  const c = CLASSES[p.class];
  const w = findItem(p.weapon);
  const a = findItem(p.armor);
  const pet = p.pet ? PETS[p.pet] : null;
  const prof = p.profession ? PROFESSIONS[p.profession] : null;
  
  let text = `${c.emoji} *${p.name}* — ${c.label}\n`;
  text += `${title(p)}\n\n`;
  text += `📊 سطح ${p.level} | ${xpBar(p)} (${p.xp}/${xpNeed(p.level)})\n`;
  text += `❤️ ${p.hp}/${p.maxHp}\n`;
  text += `💪 ${getAtk(p)}${w ? ` (${w.emoji}${w.label})` : ''}\n`;
  text += `🛡 ${getDef(p)}${a ? ` (${a.emoji}${a.label})` : ''}\n`;
  text += `💰 ${p.gold} طلا\n`;
  if (pet) text += `🐾 ${pet.emoji} ${pet.name}\n`;
  if (prof) text += `⚒️ ${prof.emoji} ${prof.name}\n`;
  text += `\n🏆 ${p.wins} برد | ${p.losses} باخت | ${p.bosses} باس`;
  if (p.hard) text += '\n🔥 حالت سخت';
  return text;
}

// ============================================================
//                      منوها (۳-۴ دکمه در هر ردیف)
// ============================================================

function classMenu() {
  return kb([
    [btn('⚔️ جنگجو — ' + CLASSES.warrior.desc, 'pick_warrior', 'primary')],
    [btn('🔮 جادوگر — ' + CLASSES.mage.desc, 'pick_mage', 'primary')],
    [btn('🏹 تیرانداز — ' + CLASSES.archer.desc, 'pick_archer', 'primary')]
  ]);
}

function mainMenu() {
  return kb([
    [btn('⚔️⚔️ نبرد ⚔️⚔️', 'fight', 'danger')],
    [
      btn('👤 پروفایل', 'profile', 'primary'),
      btn('🎒 کوله', 'inventory', 'primary'),
      btn('🏪 فروشگاه', 'shop', 'primary')
    ],
    [
      btn('🐾 پت', 'pet', 'primary'),
      btn('⚒️ پیشه', 'profession', 'primary'),
      btn('📜 ماموریت', 'quests', 'primary')
    ],
    [
      btn('🔨 کرفتینگ', 'crafting', 'primary'),
      btn('🏰 گیلد', 'guild', 'primary'),
      btn('⚔️ PvP', 'pvp', 'danger')
    ],
    [
      btn('💰 بازار', 'market', 'primary'),
      btn('🔥 سخت', 'hard', 'primary'),
      btn('📖 داستان', 'story', 'primary')
    ],
    [
      btn('💚 بهبودی', 'heal', 'success'),
      btn('🎁 روزانه', 'daily', 'success'),
      btn('🏆 رتبه‌بندی', 'leaderboard', 'primary')
    ],
    [btn('❓ راهنما', 'help', 'primary')]
  ]);
}

function shopMenu() {
  return kb([
    [
      btn('🗡 سلاح‌ها', 'shop_weapons', 'primary'),
      btn('🛡 زره‌ها', 'shop_armors', 'primary'),
      btn('🧪 معجون‌ها', 'shop_consumables', 'primary')
    ],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function itemsMenu(items, title) {
  const rows = [];
  for (let i = 0; i < items.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < items.length; j++) {
      const item = items[j];
      row.push(btn(`${item.emoji} ${item.label} 💰${item.price}`, `buy_${item.id}`, 'success'));
    }
    rows.push(row);
  }
  rows.push([btn('« بازگشت', 'menu_shop', 'primary')]);
  return kb(rows);
}

function inventoryMenu(p) {
  if (!p || p.items.length === 0) {
    return kb([
      [btn('🎒 کوله خالی است', 'ignore', 'secondary')],
      [btn('« بازگشت', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  rows.push([{ text: `🎒 ${p.items.length} آیتم`, callback_data: 'ignore' }]);
  rows.push([]);
  
  for (let i = 0; i < p.items.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < p.items.length; j++) {
      const id = p.items[j];
      const item = findItem(id);
      if (item) {
        const eq = (p.weapon === id || p.armor === id);
        const label = eq ? `✅${item.emoji}` : item.emoji;
        row.push(btn(label, `item_${id}`, 'primary'));
      }
    }
    rows.push(row);
  }
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function itemActions(itemId) {
  const item = findItem(itemId);
  if (!item) return back();
  
  const rows = [];
  if (item.type === 'weapon' || item.type === 'armor') {
    rows.push([btn('⚙️ تجهیز', `equip_${itemId}`, 'success')]);
  }
  if (item.type === 'consumable') {
    rows.push([btn('🧪 مصرف', `use_${itemId}`, 'success')]);
  }
  rows.push([btn(`💰 فروش`, `sell_${itemId}`, 'danger')]);
  rows.push([btn('« بازگشت', 'menu_inventory', 'primary')]);
  return kb(rows);
}

function petMenu(p) {
  if (p.pet) {
    const pet = PETS[p.pet];
    return kb([
      [btn(`🐾 ${pet.emoji} ${pet.name}`, 'ignore', 'secondary')],
      [btn('🔄 عوض کردن', 'pet_change', 'primary')],
      [btn('« بازگشت', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  const pets = Object.entries(PETS);
  for (let i = 0; i < pets.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < pets.length; j++) {
      const [key, pet] = pets[j];
      row.push(btn(`${pet.emoji} ${pet.name} 💰${pet.price}`, `pet_buy_${key}`, 'success'));
    }
    rows.push(row);
  }
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function professionMenu(p) {
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    return kb([
      [btn(`⚒️ ${prof.emoji} ${prof.name}`, 'ignore', 'secondary')],
      [btn('🔄 تغییر (۵۰ طلا)', 'prof_change', 'danger')],
      [btn('« بازگشت', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  const profs = Object.entries(PROFESSIONS);
  for (let i = 0; i < profs.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < profs.length; j++) {
      const [key, prof] = profs[j];
      row.push(btn(`${prof.emoji} ${prof.name} 💰${prof.price}`, `prof_pick_${key}`, 'primary'));
    }
    rows.push(row);
  }
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function questsMenu(p) {
  if (p.quests.length === 0) genQuests(p);
  
  const active = p.quests.filter(q => !q.done);
  const done = p.quests.filter(q => q.done);
  
  let text = '📜 *ماموریت‌ها*\n\n';
  if (active.length === 0) {
    text += 'همه ماموریت‌ها تموم شد! 🎉\n';
  } else {
    active.forEach(q => {
      const prog = Math.round((q.progress / q.target) * 100);
      const bar = '▰'.repeat(Math.round(prog / 10)) + '▱'.repeat(10 - Math.round(prog / 10));
      text += `${q.emoji || '📌'} ${q.name}\n${bar} (${q.progress}/${q.target})\n`;
      text += `🎁 ${q.gold}طلا + ${q.xp}تجربه\n\n`;
    });
  }
  if (done.length > 0) text += `✅ ${done.length} تا تموم شد`;
  
  return kb([
    [btn('🔄 تازه‌سازی (۵۰ طلا)', 'quests_refresh', 'primary')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function craftingMenu(p) {
  const rows = [];
  RECIPES.forEach(r => {
    const can = p.items.filter(i => r.need.includes(i)).length >= r.need.length;
    const afford = p.gold >= r.cost;
    const status = can && afford ? '✅' : '❌';
    rows.push([btn(`${r.emoji} ${r.name} ${status}`, `craft_${r.id}`, can && afford ? 'success' : 'secondary')]);
  });
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function guildMenu(p) {
  if (p.guild) {
    const g = getGuild(p.guild);
    if (!g) {
      p.guild = null;
      return guildMenu(p);
    }
    const isLeader = g.leader === getKey(0, 0);
    const rows = [];
    if (isLeader) {
      rows.push([btn('👤 دعوت', 'guild_invite', 'primary'), btn('🗑 حذف', 'guild_delete', 'danger')]);
    }
    rows.push([btn('⚔️ باس گیلد', 'guild_boss', 'danger'), btn('💰 کمک', 'guild_donate', 'success')]);
    rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
    return kb(rows);
  }
  
  return kb([
    [btn('🏗 ساخت (۲۰۰ طلا)', 'guild_create', 'success'), btn('📋 لیست', 'guild_list', 'primary')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function pvpMenu() {
  return kb([
    [btn('🔍 پیدا کردن حریف', 'pvp_find', 'danger')],
    [btn('🏆 رتبه‌بندی PvP', 'pvp_rank', 'primary')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function marketMenu(p) {
  const list = getMarket().filter(m => m.key !== getKey(0, 0));
  
  if (list.length === 0) {
    return kb([
      [btn('📤 فروش آیتم', 'market_sell', 'primary')],
      [btn('« بازگشت', 'menu_main', 'primary')]
    ]);
  }
  
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    const row = [];
    for (let j = i; j < i + 2 && j < list.length; j++) {
      const m = list[j];
      const item = findItem(m.itemId);
      row.push(btn(`${item?.emoji || '❓'} ${item?.label || '???'} 💰${m.price}`, `market_buy_${m.id}`, 'success'));
    }
    rows.push(row);
  }
  rows.push([btn('📤 فروش آیتم', 'market_sell', 'primary')]);
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function sellItemsMenu(p) {
  if (p.items.length === 0) {
    return kb([[btn('کوله خالی!', 'ignore', 'secondary')]]);
  }
  
  const rows = [];
  for (let i = 0; i < p.items.length; i += 3) {
    const row = [];
    for (let j = i; j < i + 3 && j < p.items.length; j++) {
      const id = p.items[j];
      const item = findItem(id);
      if (item) row.push(btn(`${item.emoji}`, `market_sel_${id}`, 'primary'));
    }
    rows.push(row);
  }
  rows.push([btn('« انصراف', 'menu_market', 'primary')]);
  return kb(rows);
}

function priceMenu(itemId) {
  return kb([
    [btn('۱۰ طلا', `mprice_${itemId}_10`, 'primary'), btn('۲۰ طلا', `mprice_${itemId}_20`, 'primary')],
    [btn('۵۰ طلا', `mprice_${itemId}_50`, 'primary'), btn('۱۰۰ طلا', `mprice_${itemId}_100`, 'primary')],
    [btn('۲۰۰ طلا', `mprice_${itemId}_200`, 'primary')],
    [btn('« انصراف', 'menu_market', 'primary')]
  ]);
}

function leaderboardMenu(cat) {
  return kb([
    [
      btn('📊 سطح', 'lb_level', cat === 'level' ? 'success' : 'primary'),
      btn('💰 طلا', 'lb_gold', cat === 'gold' ? 'success' : 'primary'),
      btn('⚔️ برد', 'lb_wins', cat === 'wins' ? 'success' : 'primary')
    ],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function guildNameMenu() {
  return kb([
    [btn('🔥 آتشین', 'gname_Fire', 'primary'), btn('⚡ صاعقه', 'gname_Storm', 'primary')],
    [btn('🌊 موج‌ها', 'gname_Wave', 'primary'), btn('🗻 کوهستان', 'gname_Mountain', 'primary')],
    [btn('🌙 ماه‌تاب', 'gname_Moon', 'primary')],
    [btn('« انصراف', 'menu_main', 'primary')]
  ]);
}

function storyMenu(chapter) {
  if (!chapter || !chapter.options || chapter.options.length === 0) {
    return back();
  }
  const rows = [];
  chapter.options.forEach(o => {
    rows.push([btn(o.text, `story_${o.next}`, 'primary')]);
  });
  rows.push([btn('« بازگشت', 'menu_main', 'primary')]);
  return kb(rows);
}

function healMenu() {
  return kb([
    [btn('💚 بهبودی (۲۰ طلا)', 'do_heal', 'success')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

function dailyMenu() {
  return kb([
    [btn('🎁 دریافت جایزه', 'do_daily', 'success')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]);
}

// ============================================================
//                      راه‌اندازی ربات
// ============================================================

if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN تنظیم نشده!');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ============================================================
//                      دستورات
// ============================================================

bot.command('start', async (ctx) => {
  const p = getPlayer(ctx);
  if (p) {
    await ctx.reply(`👋 خوش برگشتی!\n\n${profile(p)}`, { parse_mode: 'Markdown' });
    await ctx.reply('🗡 منو:', mainMenu());
    return;
  }
  await ctx.reply('🗡 به افسانه‌ی گروه خوش اومدی!\nکلاس انتخاب کن:', classMenu());
});

bot.command('menu', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🗡 منو:', mainMenu());
});

// ============================================================
//                      اکشن‌های اصلی
// ============================================================

// منوی اصلی
bot.action('menu_main', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🗡 منو:', mainMenu());
});

// انتخاب کلاس
bot.action(/^pick_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (p) {
    await ctx.answerCbQuery('قبلاً شخصیت داری!', { show_alert: true });
    return;
  }
  const key = ctx.match[1];
  if (!CLASSES[key]) {
    await ctx.answerCbQuery('کلاس نامعتبر!', { show_alert: true });
    return;
  }
  const np = newPlayer(ctx, key);
  savePlayer(ctx, np);
  await ctx.answerCbQuery(`✅ ${CLASSES[key].label} ساخته شد!`);
  await ctx.reply(`🎉 شخصیت ساخته شد!\n\n${profile(np)}`, { parse_mode: 'Markdown' });
  await ctx.reply('🗡 منو:', mainMenu());
});

// پروفایل
bot.action('profile', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply(profile(p), { parse_mode: 'Markdown', ...back() });
});

// کوله
bot.action('inventory', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🎒 *کوله‌پشتی*\n\nروی آیتم کلیک کن:', { parse_mode: 'Markdown', ...inventoryMenu(p) });
});

// آیتم در کوله
bot.action(/^item_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!');
  const id = ctx.match[1];
  if (!p.items.includes(id)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  const item = findItem(id);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  const eq = p.weapon === id || p.armor === id;
  let text = `📦 *${item.emoji} ${item.label}*\n\n`;
  text += `نوع: ${item.type === 'weapon' ? '🗡 سلاح' : item.type === 'armor' ? '🛡 زره' : '🧪 معجون'}\n`;
  if (item.rarity) text += `کیفیت: ${RARITY[item.rarity] || item.rarity}\n`;
  if (item.atk) text += `💪 +${item.atk} حمله\n`;
  if (item.def) text += `🛡 +${item.def} دفاع\n`;
  if (item.desc) text += `📝 ${item.desc}\n`;
  if (eq) text += `✅ *تجهیز شده*`;
  await ctx.reply(text, { parse_mode: 'Markdown', ...itemActions(id) });
});

// تجهیز
bot.action(/^equip_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  if (!p.items.includes(id)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  const item = findItem(id);
  if (!item || (item.type !== 'weapon' && item.type !== 'armor')) {
    await ctx.answerCbQuery('فقط سلاح و زره!', { show_alert: true });
    return;
  }
  if (item.type === 'weapon') p.weapon = id;
  else p.armor = id;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${item.label} تجهیز شد!`);
  await ctx.reply(`✅ ${item.emoji} ${item.label} تجهیز شد!`, back('menu_inventory'));
});

// مصرف
bot.action(/^use_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  if (!p.items.includes(id)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  const item = findItem(id);
  if (!item || item.type !== 'consumable') {
    await ctx.answerCbQuery('قابل مصرف نیست!', { show_alert: true });
    return;
  }
  const idx = p.items.indexOf(id);
  p.items.splice(idx, 1);
  if (item.effect === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.4));
  } else if (item.effect === 'power') {
    p.effects.power = true;
  } else if (item.effect === 'luck') {
    p.effects.luck = true;
  } else if (item.effect === 'revive') {
    p.effects.revive = true;
  }
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${item.label} مصرف شد!`);
  await ctx.reply(`✅ ${item.emoji} ${item.label} مصرف شد!`, back('menu_inventory'));
});

// فروش آیتم از کوله
bot.action(/^sell_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  if (!p.items.includes(id)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  const item = findItem(id);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  const price = Math.round(item.price * getSellBonus(p));
  const idx = p.items.indexOf(id);
  p.items.splice(idx, 1);
  if (p.weapon === id) p.weapon = null;
  if (p.armor === id) p.armor = null;
  p.gold += price;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`💰 ${item.label} فروخته شد!`);
  await ctx.reply(`💰 ${item.emoji} ${item.label} به ${price} طلا فروخته شد!`, back('menu_inventory'));
});

// ============================================================
//                      فروشگاه
// ============================================================

bot.action('shop', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🏪 *فروشگاه*\n\nدسته رو انتخاب کن:', { parse_mode: 'Markdown', ...shopMenu() });
});

bot.action('shop_weapons', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🗡 *سلاح‌ها*', { parse_mode: 'Markdown', ...itemsMenu(WEAPONS, 'سلاح') });
});

bot.action('shop_armors', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛡 *زره‌ها*', { parse_mode: 'Markdown', ...itemsMenu(ARMORS, 'زره') });
});

bot.action('shop_consumables', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🧪 *معجون‌ها*', { parse_mode: 'Markdown', ...itemsMenu(CONSUMABLES, 'معجون') });
});

// خرید
bot.action(/^buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  const item = findItem(id);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  let price = item.price;
  const disc = getDiscount(p);
  if (disc > 0) price = Math.round(price * (1 - disc));
  if (p.gold < price) {
    await ctx.answerCbQuery(`طلای کافی نیست! (${price} طلا)`, { show_alert: true });
    return;
  }
  p.gold -= price;
  p.items.push(id);
  updateQuests(p, 'buy');
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${item.label} خریداری شد!`);
  await ctx.reply(`✅ ${item.emoji} ${item.label} خریداری شد!\n💰 ${p.gold} طلا مونده.`, back('menu_shop'));
});

// ============================================================
//                      نبرد
// ============================================================

bot.action('fight', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  
  if (p.hp <= 0) {
    return ctx.reply('💀 مردی! بهبودی بگیر.', kb([
      [btn('💚 بهبودی', 'heal', 'success')],
      [btn('« بازگشت', 'menu_main', 'primary')]
    ]));
  }
  
  let eff = '';
  if (p.effects.power) eff += '💥 قدرت\n';
  if (p.effects.luck) eff += '🍀 شانس\n';
  if (p.effects.revive) eff += '✨ احیا\n';
  if (eff) await ctx.reply(`✨ افکت‌ها:\n${eff}`);
  
  const monster = makeMonster(p.level);
  const result = fight(p, monster);
  
  let text = `${monster.isBoss ? '👑💀 باس!' : monster.emoji} *${monster.name}*\n\n`;
  text += result.log.slice(0, 8).join('\n');
  if (result.log.length > 8) text += `\n...`;
  text += '\n\n';
  
  if (result.won) {
    const bonus = Math.round(result.gold * (1 + Math.random() * 0.3));
    p.xp += result.xp;
    p.gold += bonus;
    p.wins += 1;
    if (monster.isBoss) p.bosses += 1;
    updateQuests(p, monster.isBoss ? 'boss' : 'kill');
    updateQuests(p, 'win');
    updateQuests(p, 'gold', bonus);
    const lv = levelUp(p);
    if (result.revived) text += '✨ احیا شدی!\n';
    text += `✅ *برد!* +${result.xp} تجربه +${bonus} طلا\n`;
    if (monster.isBoss) text += '🐉 باس کشته شد!\n';
    if (lv.length > 0) text += `🎊 سطح ${lv[lv.length - 1]}!`;
    if (p.profession === 'hunter' && Math.random() < 0.2) {
      const rand = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
      if (rand) { p.items.push(rand.id); text += `\n🎁 ${rand.emoji} ${rand.label} پیدا کردی!`; }
    }
  } else {
    p.losses += 1;
    const conXp = Math.round(result.xp * 0.3);
    const conGold = Math.round(result.gold * 0.2);
    p.xp += conXp;
    p.gold += conGold;
    const pen = Math.min(p.gold, Math.round(result.gold * 0.05));
    p.gold -= pen;
    if (p.gold < 10) p.gold = 10;
    text += `☠️ *باخت!*\n💫 ${conXp} تجربه ${conGold} طلا دلداری\n`;
    if (pen > 0) text += `💸 ${pen} طلا از دست دادی`;
  }
  
  p.effects = { power: false, luck: false, revive: false };
  savePlayer(ctx, p);
  
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...kb([
      [btn('⚔️ دوباره', 'fight', 'danger'), btn('💚 بهبودی', 'heal', 'success')],
      [btn('« منو', 'menu_main', 'primary')]
    ])
  });
});

// ============================================================
//                      بهبودی و روزانه
// ============================================================

bot.action('heal', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  if (p.hp >= p.maxHp) return ctx.reply('💚 کامل هستی!', back());
  if (p.gold < 20) return ctx.reply('💰 ۲۰ طلا نیازه!', back());
  p.gold -= 20;
  p.hp = p.maxHp;
  savePlayer(ctx, p);
  await ctx.reply(`💚 سلامتی کامل شد!\n💰 ${p.gold} طلا مونده.`, back());
});

bot.action('daily', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  
  const now = Date.now();
  const cd = 24 * 60 * 60 * 1000;
  if (p.daily && now - p.daily < cd) {
    const h = Math.ceil((cd - (now - p.daily)) / (60 * 60 * 1000));
    return ctx.reply(`⏳ ${h} ساعت دیگه`, back());
  }
  
  const broken = now - p.daily > cd * 2;
  p.streak = broken ? 1 : (p.streak || 0) + 1;
  if (p.daily === 0) p.streak = 1;
  const mult = 1 + Math.min(p.streak - 1, 9) * 0.15;
  const gold = Math.round((50 + p.level * 8) * mult);
  const xp = Math.round((30 + p.level * 5) * mult);
  p.gold += gold;
  p.xp += xp;
  p.daily = now;
  p.hp = p.maxHp;
  const lv = levelUp(p);
  savePlayer(ctx, p);
  
  let text = `🎁 *جایزه روزانه*\n💰 +${gold} طلا\n✨ +${xp} تجربه\n🔥 ${p.streak} روز (×${mult.toFixed(1)})\n💚 سلامتی کامل`;
  if (lv.length > 0) text += `\n🎊 سطح ${lv[lv.length - 1]}!`;
  await ctx.reply(text, { parse_mode: 'Markdown', ...back() });
});

// ============================================================
//                      پت
// ============================================================

bot.action('pet', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🐾 *پت‌ها*', { parse_mode: 'Markdown', ...petMenu(p) });
});

bot.action(/^pet_buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const key = ctx.match[1];
  const pet = PETS[key];
  if (!pet) {
    await ctx.answerCbQuery('پت نامعتبر!', { show_alert: true });
    return;
  }
  if (p.gold < pet.price) {
    await ctx.answerCbQuery(`طلای کافی نیست! (${pet.price} طلا)`, { show_alert: true });
    return;
  }
  p.gold -= pet.price;
  p.pet = key;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${pet.name} خریداری شد!`);
  await ctx.reply(`🐾 ${pet.emoji} ${pet.name} همراهت شد!`, back('menu_pet'));
});

bot.action('pet_change', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  p.pet = null;
  savePlayer(ctx, p);
  await ctx.answerCbQuery('🔄 پت عوض شد!');
  await ctx.reply('🐾 پت عوض شد!', back('menu_pet'));
});

// ============================================================
//                      پیشه
// ============================================================

bot.action('profession', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('⚒️ *پیشه‌ها*', { parse_mode: 'Markdown', ...professionMenu(p) });
});

bot.action(/^prof_pick_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const key = ctx.match[1];
  const prof = PROFESSIONS[key];
  if (!prof) {
    await ctx.answerCbQuery('پیشه نامعتبر!', { show_alert: true });
    return;
  }
  if (p.profession) {
    if (p.gold < 50) {
      await ctx.answerCbQuery('۵۰ طلا برای تغییر نیازه!', { show_alert: true });
      return;
    }
    p.gold -= 50;
  }
  if (p.gold < prof.price) {
    await ctx.answerCbQuery(`طلای کافی نیست! (${prof.price} طلا)`, { show_alert: true });
    return;
  }
  p.gold -= prof.price;
  p.profession = key;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${prof.name} انتخاب شد!`);
  await ctx.reply(`✅ ${prof.emoji} ${prof.name} انتخاب شد!`, back('menu_profession'));
});

bot.action('prof_change', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  if (p.gold < 50) {
    await ctx.answerCbQuery('۵۰ طلا نیازه!', { show_alert: true });
    return;
  }
  p.gold -= 50;
  p.profession = null;
  savePlayer(ctx, p);
  await ctx.answerCbQuery('🔄 پیشه تغییر کرد!');
  await ctx.reply('⚒️ پیشه تغییر کرد!', back('menu_profession'));
});

// ============================================================
//                      ماموریت‌ها
// ============================================================

bot.action('quests', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  if (p.quests.length === 0) genQuests(p);
  await ctx.reply('📜 *ماموریت‌ها*', { parse_mode: 'Markdown', ...questsMenu(p) });
});

bot.action('quests_refresh', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  if (p.gold < 50) {
    await ctx.answerCbQuery('۵۰ طلا نیازه!', { show_alert: true });
    return;
  }
  p.gold -= 50;
  p.quests = [];
  genQuests(p);
  savePlayer(ctx, p);
  await ctx.answerCbQuery('🔄 ماموریت‌ها تازه شد!');
  await ctx.reply('📜 ماموریت‌ها تازه شد!', back('menu_quests'));
});

// ============================================================
//                      کرفتینگ (رفع باگ کامل)
// ============================================================

bot.action('crafting', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply(
    `🔨 *کرفتینگ*\nسطح: ${p.craftLevel}\nساخته: ${p.crafted} آیتم\n\nروی دستور کلیک کن:`,
    { parse_mode: 'Markdown', ...craftingMenu(p) }
  );
});

bot.action(/^craft_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  const result = doCraft(p, id);
  if (!result.ok) {
    await ctx.answerCbQuery(result.msg, { show_alert: true });
    return;
  }
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${result.item?.label || 'آیتم'} ساخته شد!`);
  await ctx.reply(
    `${result.msg}\n💰 ${p.gold} طلا مونده.`,
    { parse_mode: 'Markdown', ...back('menu_crafting') }
  );
});

// ============================================================
//                      گیلد
// ============================================================

bot.action('guild', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('🏰 *گیلد*', { parse_mode: 'Markdown', ...guildMenu(p) });
});

bot.action('guild_create', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  if (p.gold < 200) {
    await ctx.answerCbQuery('۲۰۰ طلا نیازه!', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();
  await ctx.reply('🏗 اسم گیلد:', guildNameMenu());
});

bot.action(/^gname_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const names = { Fire: '🔥 آتشین', Storm: '⚡ صاعقه', Wave: '🌊 موج‌ها', Mountain: '🗻 کوهستان', Moon: '🌙 ماه‌تاب' };
  const name = names[ctx.match[1]] || ctx.match[1];
  p.gold -= 200;
  const key = getKey(ctx.chat.id, ctx.from.id);
  const gid = newGuild(name, key, ctx.chat.id);
  p.guild = gid;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${name} ساخته شد!`);
  await ctx.reply(`🏰 ${name} ساخته شد!`, back('menu_guild'));
});

bot.action('guild_list', async (ctx) => {
  const list = Object.values(guilds)
    .filter(g => g.chatId === ctx.chat.id)
    .map(g => `🏰 ${g.name} — ${g.members.length} عضو`);
  if (list.length === 0) return ctx.reply('هیچ گیلدی نیست!', back('menu_guild'));
  await ctx.reply(`📋 *گیلدها*\n\n${list.join('\n')}`, { parse_mode: 'Markdown', ...back('menu_guild') });
});

bot.action('guild_delete', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p || !p.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  const g = getGuild(p.guild);
  if (!g) {
    p.guild = null;
    savePlayer(ctx, p);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  const key = getKey(ctx.chat.id, ctx.from.id);
  if (g.leader !== key) {
    await ctx.answerCbQuery('فقط رهبر!', { show_alert: true });
    return;
  }
  delete guilds[p.guild];
  p.guild = null;
  savePlayer(ctx, p);
  saveAll();
  await ctx.answerCbQuery('🗑 گیلد حذف شد!');
  await ctx.reply('🗑 گیلد منحل شد!', back('menu_guild'));
});

bot.action('guild_boss', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p || !p.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  const g = getGuild(p.guild);
  if (!g) {
    p.guild = null;
    savePlayer(ctx, p);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  if (g.boss <= 0) {
    g.boss = g.maxBoss;
    g.defeated += 1;
    saveAll();
    await ctx.answerCbQuery('🐉 باس ریست شد!');
    return ctx.reply('🐉 باس گیلد ریست شد!', back('menu_guild'));
  }
  const dmg = Math.round(10 + Math.random() * 20 + p.level * 2);
  g.boss = Math.max(0, g.boss - dmg);
  const gold = Math.round(5 + Math.random() * 10);
  const xp = Math.round(5 + Math.random() * 10);
  p.gold += gold;
  p.xp += xp;
  savePlayer(ctx, p);
  saveAll();
  let text = `⚔️ باس گیلد!\n💥 ${dmg} آسیب\n❤️ ${g.boss}/${g.maxBoss}\n💰 +${gold} طلا ✨ +${xp} تجربه`;
  if (g.boss <= 0) {
    text += `\n🎉 *باس کشته شد!*\n🏆 همه پاداش می‌گیرن!`;
    g.members.forEach(k => {
      const m = getPlayerByKey(k);
      if (m) {
        m.gold += 50 + Math.round(Math.random() * 30);
        m.xp += 30 + Math.round(Math.random() * 20);
        savePlayerByKey(k, m);
      }
    });
  }
  await ctx.reply(text, { parse_mode: 'Markdown', ...back('menu_guild') });
});

bot.action('guild_donate', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p || !p.guild) {
    await ctx.answerCbQuery('در گیلد نیستی!', { show_alert: true });
    return;
  }
  const g = getGuild(p.guild);
  if (!g) {
    p.guild = null;
    savePlayer(ctx, p);
    await ctx.answerCbQuery('گیلد وجود نداره!', { show_alert: true });
    return;
  }
  const amt = 10 + Math.round(Math.random() * 20);
  if (p.gold < amt) {
    await ctx.answerCbQuery('طلای کافی نیست!', { show_alert: true });
    return;
  }
  p.gold -= amt;
  g.bank += amt;
  savePlayer(ctx, p);
  saveAll();
  await ctx.answerCbQuery(`💰 ${amt} طلا کمک شد!`);
  await ctx.reply(`💰 ${amt} طلا به صندوق کمک شد!`, back('menu_guild'));
});

bot.action('guild_invite', async (ctx) => {
  await ctx.answerCbQuery('🔜 در حال توسعه...');
});

// ============================================================
//                      PvP
// ============================================================

bot.action('pvp', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply(`⚔️ *PvP*\nبرد: ${p.pvpWins} | باخت: ${p.pvpLosses}`, {
    parse_mode: 'Markdown',
    ...pvpMenu()
  });
});

bot.action('pvp_find', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const key = getKey(ctx.chat.id, ctx.from.id);
  PVP_QUEUE.push(key);
  await ctx.answerCbQuery('🔍 در صف...');
  
  const oppKey = findPvp(key);
  if (oppKey) {
    const opp = getPlayerByKey(oppKey);
    if (opp) {
      const result = pvpBattle(p, opp);
      let text = '⚔️ *PvP*\n\n' + result.log.join('\n') + '\n\n';
      if (result.winner === 1) {
        p.pvpWins += 1;
        opp.pvpLosses += 1;
        const gold = 30 + Math.round(Math.random() * 20);
        p.gold += gold;
        updateQuests(p, 'pvp');
        text += `🎉 *برد!* +${gold} طلا`;
      } else {
        p.pvpLosses += 1;
        opp.pvpWins += 1;
        text += `😔 *باخت...*`;
      }
      savePlayer(ctx, p);
      savePlayerByKey(oppKey, opp);
      await ctx.reply(text, { parse_mode: 'Markdown', ...back('menu_pvp') });
      try {
        await bot.telegram.sendMessage(
          parseInt(oppKey.split(':')[1]),
          `⚔️ PvP با ${p.name} تموم شد! ${result.winner === 2 ? '🎉 برد!' : '😔 باخت...'}`
        );
      } catch (e) {}
      return;
    }
  }
  
  await ctx.reply('🔍 در صف... منتظر حریف.', kb([
    [btn('❌ خروج', 'pvp_leave', 'danger')],
    [btn('« بازگشت', 'menu_main', 'primary')]
  ]));
});

bot.action('pvp_leave', async (ctx) => {
  const key = getKey(ctx.chat.id, ctx.from.id);
  const idx = PVP_QUEUE.indexOf(key);
  if (idx > -1) PVP_QUEUE.splice(idx, 1);
  await ctx.answerCbQuery('✅ خارج شدی!');
  await ctx.reply('✅ از صف خارج شدی.', back('menu_pvp'));
});

bot.action('pvp_rank', async (ctx) => {
  const prefix = `${ctx.chat.id}:`;
  const list = Object.entries(players)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, p]) => p)
    .sort((a, b) => b.pvpWins - a.pvpWins)
    .slice(0, 10);
  
  if (list.length === 0) return ctx.reply('هیچکس PvP نرفته!', back('menu_pvp'));
  const medals = ['🥇', '🥈', '🥉'];
  const lines = list.map((p, i) => {
    const rank = medals[i] || `${i+1}.`;
    const c = CLASSES[p.class];
    return `${rank} ${c.emoji} ${p.name} — ${p.pvpWins} برد`;
  });
  await ctx.reply(`🏆 *PvP رتبه‌بندی*\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    ...back('menu_pvp')
  });
});

// ============================================================
//                      بازار
// ============================================================

bot.action('market', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  await ctx.reply('💰 *بازار*', { parse_mode: 'Markdown', ...marketMenu(p) });
});

bot.action('market_sell', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  if (p.items.length === 0) {
    await ctx.answerCbQuery('کوله خالی!', { show_alert: true });
    return;
  }
  await ctx.reply('💰 آیتم برای فروش انتخاب کن:', sellItemsMenu(p));
});

bot.action(/^market_sel_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const id = ctx.match[1];
  await ctx.reply(`💰 قیمت ${findItem(id)?.label || 'آیتم'} رو انتخاب کن:`, priceMenu(id));
});

bot.action(/^mprice_(.+)_(\d+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = ctx.match[1];
  const price = parseInt(ctx.match[2]);
  if (!p.items.includes(id)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  const idx = p.items.indexOf(id);
  p.items.splice(idx, 1);
  const key = getKey(ctx.chat.id, ctx.from.id);
  addMarket(key, id, price);
  savePlayer(ctx, p);
  const item = findItem(id);
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} در بازار قرار گرفت!`);
  await ctx.reply(`✅ ${item?.emoji || '📦'} ${item?.label || 'آیتم'} با قیمت ${price} طلا در بازار قرار گرفت!`, back('menu_market'));
});

bot.action(/^market_buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const mid = ctx.match[1];
  const listing = market[mid];
  if (!listing) {
    await ctx.answerCbQuery('این آیتم فروخته شده!', { show_alert: true });
    return;
  }
  if (p.gold < listing.price) {
    await ctx.answerCbQuery(`طلای کافی نیست! (${listing.price} طلا)`, { show_alert: true });
    return;
  }
  p.gold -= listing.price;
  p.items.push(listing.itemId);
  const seller = getPlayerByKey(listing.key);
  if (seller) {
    seller.gold += listing.price;
    savePlayerByKey(listing.key, seller);
  }
  removeMarket(mid);
  savePlayer(ctx, p);
  const item = findItem(listing.itemId);
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} خریداری شد!`);
  await ctx.reply(`✅ ${item?.emoji || '📦'} ${item?.label || 'آیتم'} خریداری شد!\n💰 ${p.gold} طلا مونده.`, back('menu_market'));
});

// ============================================================
//                      رتبه‌بندی
// ============================================================

bot.action('leaderboard', async (ctx) => {
  await ctx.answerCbQuery();
  await leaderboardShow(ctx, 'level');
});

bot.action(/^lb_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await leaderboardShow(ctx, ctx.match[1]);
});

async function leaderboardShow(ctx, cat) {
  const prefix = `${ctx.chat.id}:`;
  const list = Object.entries(players)
    .filter(([k]) => k.startsWith(prefix))
    .map(([, p]) => p);
  
  if (list.length === 0) {
    return ctx.reply('هیچکس شخصیت نساخته!', back('menu_main'));
  }
  
  let sorted, label;
  if (cat === 'gold') {
    sorted = list.sort((a, b) => b.gold - a.gold);
    label = '💰 طلا';
  } else if (cat === 'wins') {
    sorted = list.sort((a, b) => b.wins - a.wins);
    label = '⚔️ برد';
  } else {
    sorted = list.sort((a, b) => b.level - a.level || b.xp - a.xp);
    label = '📊 سطح';
  }
  
  sorted = sorted.slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.map((p, i) => {
    const rank = medals[i] || `${i+1}.`;
    const c = CLASSES[p.class];
    let stat = cat === 'gold' ? `💰${p.gold}` : cat === 'wins' ? `⚔️${p.wins}` : `سطح ${p.level}`;
    return `${rank} ${c.emoji} *${p.name}* — ${stat}`;
  });
  
  await ctx.reply(`🏆 *رتبه‌بندی* (${label})\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    ...leaderboardMenu(cat)
  });
}

// ============================================================
//                      حالت سخت
// ============================================================

bot.action('hard', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  p.hard = !p.hard;
  savePlayer(ctx, p);
  await ctx.answerCbQuery(p.hard ? '🔥 سخت فعال' : '☀️ عادی');
  await ctx.reply(p.hard ? '🔥 حالت سخت فعال شد!' : '☀️ حالت عادی فعال شد.', back());
});

// ============================================================
//                      داستان
// ============================================================

bot.action('story', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول /start کن!', classMenu());
  const next = p.story + 1;
  const ch = STORY.find(s => s.id === next) || STORY[0];
  await ctx.reply(`📖 *${ch.title}*\n\n${ch.desc}`, {
    parse_mode: 'Markdown',
    ...storyMenu(ch)
  });
});

bot.action(/^story_(\d+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  const id = parseInt(ctx.match[1]);
  const ch = STORY.find(s => s.id === id);
  if (!ch) {
    await ctx.answerCbQuery('داستان تموم شد!', { show_alert: true });
    return;
  }
  // اعمال اثر انتخاب قبلی
  const prev = STORY.find(s => s.options && s.options.some(o => o.next === id));
  if (prev) {
    const opt = prev.options.find(o => o.next === id);
    if (opt && opt.effect) {
      if (opt.effect === 'pet+wolf' && !p.pet) p.pet = 'wolf';
      else if (opt.effect.startsWith('gold+')) p.gold += parseInt(opt.effect.split('+')[1]);
      else if (opt.effect.startsWith('xp+')) p.xp += parseInt(opt.effect.split('+')[1]);
    }
  }
  p.story = id;
  savePlayer(ctx, p);
  await ctx.answerCbQuery();
  await ctx.reply(`📖 *${ch.title}*\n\n${ch.desc}`, {
    parse_mode: 'Markdown',
    ...storyMenu(ch)
  });
});

// ============================================================
//                      راهنما
// ============================================================

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '🗡 *راهنما*\n\n' +
    '⚔️ نبرد — بجنگ و پاداش بگیر\n' +
    '🎁 روزانه — هر ۲۴ ساعت جایزه\n' +
    '🏪 فروشگاه — سلاح/زره/معجون بخر\n' +
    '🐾 پت — همراه بگیر\n' +
    '⚒️ پیشه — شغل انتخاب کن\n' +
    '🔨 کرفتینگ — آیتم بساز\n' +
    '🏰 گیلد — گروه تشکیل بده\n' +
    '⚔️ PvP — با بقیه بجنگ\n' +
    '💰 بازار — بخر و بفروش\n' +
    '🔥 سخت — چالش بیشتر\n' +
    '📖 داستان — ماجراجویی\n' +
    '💚 بهبودی — سلامتی پر کن\n' +
    '🏆 رتبه‌بندی — مقایسه کن',
    { parse_mode: 'Markdown', ...back() }
  );
});

// ============================================================
//                      دکمه بی‌استفاده
// ============================================================

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
});

// ============================================================
//                      فال‌بک
// ============================================================

bot.on('text', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('🗡 سلام! /start کن.', classMenu());
    return;
  }
  await ctx.reply('🗡 منو:', mainMenu());
});

// ============================================================
//                      مدیریت خطا
// ============================================================

bot.catch((err, ctx) => {
  console.error('❌ خطا:', err.message);
  if (ctx && ctx.reply) {
    ctx.reply('⚠️ مشکلی پیش اومد! دوباره تلاش کن.', back()).catch(() => {});
  }
});

// ============================================================
//                      راه‌اندازی نهایی
// ============================================================

bot.launch()
  .then(() => {
    console.log('🗡 افسانه‌ی گروه (نسخه ۴.۲) شروع شد!');
    console.log(`👤 ${Object.keys(players).length} بازیکن`);
    console.log(`🏰 ${Object.keys(guilds).length} گیلد`);
    console.log(`💰 ${Object.keys(market).length} آیتم در بازار`);
  })
  .catch(err => {
    console.error('❌ خطا در راه‌اندازی:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => { console.log('🛑 متوقف شد'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('🛑 متوقف شد'); bot.stop('SIGTERM'); });

// ============================================================
//                      پایان کد
// ============================================================
