/**
 * 🗡 افسانه‌ی گروه (نسخه ۴) — ربات RPG کامل با سیستم‌های پیشرفته
 * قابلیت‌های جدید:
 * - سیستم پیشه‌ها (۳)
 * - سیستم پت (۴)
 * - سیستم ماموریت (۵)
 * - سیستم کرفتینگ (۶)
 * - سیستم گیلد (۷)
 * - سیستم PvP (۸)
 * - بازار آزاد (۱۲)
 * - حالت سخت (۱۴)
 * - داستان‌سرایی (۱۵)
 */

const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const DATA_PATH = path.join(__dirname, 'players.json');
const GUILDS_PATH = path.join(__dirname, 'guilds.json');
const MARKET_PATH = path.join(__dirname, 'market.json');

// ==================== بارگذاری داده‌ها ====================
function loadJSON(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (err) {
    console.error(`⚠️ خطا در خواندن ${file}:`, err.message);
  }
  return {};
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`⚠️ خطا در ذخیره ${file}:`, err.message);
  }
}

let players = loadJSON(DATA_PATH);
let guilds = loadJSON(GUILDS_PATH);
let market = loadJSON(MARKET_PATH);

function saveAll() {
  saveJSON(DATA_PATH, players);
  saveJSON(GUILDS_PATH, guilds);
  saveJSON(MARKET_PATH, market);
}

// ==================== توابع کمکی ====================
function keyOf(chatId, userId) {
  return `${chatId}:${userId}`;
}
function playerKey(ctx) {
  return keyOf(ctx.chat.id, ctx.from.id);
}
function getPlayer(ctx) {
  return players[playerKey(ctx)] || null;
}
function savePlayer(ctx, p) {
  players[playerKey(ctx)] = p;
  saveAll();
}

function sbtn(text, callback_data, style) {
  const b = { text, callback_data };
  if (style) b.style = style;
  return b;
}
function kb(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

// ==================== کلاس‌های شخصیت ====================
const CLASSES = {
  warrior: { label: '⚔️ جنگجو', hp: 40, atk: 8, def: 5, emoji: '⚔️' },
  mage: { label: '🔮 جادوگر', hp: 26, atk: 12, def: 2, emoji: '🔮' },
  archer: { label: '🏹 تیرانداز', hp: 32, atk: 10, def: 3, emoji: '🏹' },
};

// ==================== ۳. سیستم پیشه‌ها ====================
const PROFESSIONS = {
  blacksmith: {
    name: '⚒️ آهنگر',
    desc: 'تخفیف ۲۰٪ سلاح و زره',
    ability: 'تعمیر زره (۵۰٪ دفاع بیشتر یک نبرد)',
    price: 100,
    bonus: { shopDiscount: 0.2, repair: true }
  },
  alchemist: {
    name: '🧪 کیمیاگر',
    desc: 'تخفیف ۲۰٪ معجون',
    ability: 'ساخت معجون تصادفی هر ۳ نبرد',
    price: 100,
    bonus: { shopDiscount: 0.2, potionCraft: true }
  },
  merchant: {
    name: '💰 بازرگان',
    desc: 'فروش آیتم‌ها ۸۰٪ قیمت',
    ability: 'یک‌بار تخفیف ویژه روزانه',
    price: 150,
    bonus: { sellMultiplier: 1.3, dailyDeal: true }
  },
  hunter: {
    name: '🏹 شکارچی',
    desc: '۲۰٪ شانس آیتم بعد از نبرد',
    ability: 'ردیابی باس (شانس باس ۲×)',
    price: 150,
    bonus: { dropChance: 0.2, bossChance: 2 }
  },
};

// ==================== ۴. سیستم پت ====================
const PETS = {
  wolf: {
    name: '🐺 گرگ خاکستری',
    type: 'atk',
    value: 3,
    price: 100,
    desc: '+۳ حمله دائمی',
    level: 1,
    xp: 0
  },
  phoenix: {
    name: '🔥 ققنوس کوچک',
    type: 'revive',
    value: 1,
    price: 300,
    desc: 'یک‌بار احیا در هر نبرد',
    level: 1,
    xp: 0
  },
  dragon: {
    name: '🐉 اژدهای زاده',
    type: 'all',
    value: 2,
    price: 500,
    desc: '+۲ به همه چیز',
    level: 1,
    xp: 0
  },
  fairy: {
    name: '🧚 پری جنگل',
    type: 'heal',
    value: 15,
    price: 200,
    desc: 'هر راند ۱۵٪ شانس بهبودی',
    level: 1,
    xp: 0
  },
  shadow: {
    name: '👻 سایه‌ی مرگ',
    type: 'crit',
    value: 0.2,
    price: 400,
    desc: '۲۰٪ شانس کریت بیشتر',
    level: 1,
    xp: 0
  },
};

// ==================== ۵. سیستم ماموریت ====================
const QUEST_TEMPLATES = [
  { id: 'q1', name: 'شکارچی مبتدی', desc: '۳ هیولا بکش', target: 3, type: 'kill', reward: { gold: 30, xp: 20 } },
  { id: 'q2', name: 'شکارچی حرفه‌ای', desc: '۱۰ هیولا بکش', target: 10, type: 'kill', reward: { gold: 80, xp: 50 } },
  { id: 'q3', name: 'باس‌کش', desc: '۱ باس بکش', target: 1, type: 'boss', reward: { gold: 100, xp: 80 } },
  { id: 'q4', name: 'ثروتمند', desc: '۲۰۰ طلا جمع کن', target: 200, type: 'gold', reward: { gold: 40, xp: 30 } },
  { id: 'q5', name: 'تجهیزات‌باز', desc: '۳ آیتم بخر', target: 3, type: 'buy', reward: { gold: 50, xp: 25 } },
  { id: 'q6', name: 'کامل‌گرا', desc: '۵ نبرد ببر', target: 5, type: 'win', reward: { gold: 60, xp: 40 } },
  { id: 'q7', name: 'پت‌پرور', desc: 'پتت رو به سطح ۳ برسون', target: 3, type: 'petLevel', reward: { gold: 70, xp: 50 } },
  { id: 'q8', name: 'PvP‌باز', desc: '۲ نبرد PvP ببر', target: 2, type: 'pvp', reward: { gold: 90, xp: 60 } },
];

// ==================== ۶. سیستم کرفتینگ ====================
const RECIPES = [
  {
    id: 'r1',
    name: '⚔️ شمشیر نقره‌ای',
    result: 'w3',
    ingredients: ['w2', 'w2', 'a2'],
    cost: 30,
    desc: '۲ شمشیر آهنی + زره آهنی'
  },
  {
    id: 'r2',
    name: '🟣 تبر حماسی',
    result: 'w4',
    ingredients: ['w3', 'w3', 'a3'],
    cost: 50,
    desc: '۲ شمشیر نقره‌ای + زره نقره‌ای'
  },
  {
    id: 'r3',
    name: '✨ سنگ احیا',
    result: 'c4',
    ingredients: ['c1', 'c2', 'c3'],
    cost: 20,
    desc: 'معجون سلامتی + قدرت + شانس'
  },
  {
    id: 'r4',
    name: '🐲 زره فلس اژدها',
    result: 'a4',
    ingredients: ['a3', 'a3', 'w5'],
    cost: 100,
    desc: '۲ زره نقره‌ای + نیزه اژدها'
  },
  {
    id: 'r5',
    name: '🔥 شمشیر ققنوس',
    result: 'w6',
    ingredients: ['w5', 'w5', 'a4', 'c4'],
    cost: 200,
    desc: '۲ نیزه اژدها + زره اژدها + سنگ احیا'
  },
];

// ==================== ۷. سیستم گیلد ====================
function createGuild(name, leaderId, chatId) {
  const id = `guild_${Date.now()}`;
  guilds[id] = {
    id,
    name,
    leader: leaderId,
    chatId,
    members: [leaderId],
    level: 1,
    xp: 0,
    bank: 0,
    bossHp: 1000,
    bossMaxHp: 1000,
    bossDefeated: 0,
    createdAt: Date.now(),
    lastBossFight: 0,
  };
  saveAll();
  return id;
}

// ==================== ۸. سیستم PvP ====================
const PVP_QUEUE = [];
const PVP_MATCHES = {};

function findPVPMatch(ctx) {
  const userId = ctx.from.id;
  // پیدا کردن حریف
  for (let i = 0; i < PVP_QUEUE.length; i++) {
    if (PVP_QUEUE[i] !== userId) {
      const opponent = PVP_QUEUE[i];
      PVP_QUEUE.splice(i, 1);
      return opponent;
    }
  }
  return null;
}

function simulatePVP(player1, player2) {
  // نبرد ۵ راند
  const log = [];
  let hp1 = player1.maxHp;
  let hp2 = player2.maxHp;
  const atk1 = effectiveAtk(player1);
  const atk2 = effectiveAtk(player2);
  const def1 = effectiveDef(player1);
  const def2 = effectiveDef(player2);
  
  for (let i = 0; i < 5; i++) {
    const dmg1 = Math.max(1, Math.round(atk1 * (0.7 + Math.random() * 0.6) - def2 * 0.3));
    hp2 -= dmg1;
    log.push(`${player1.name} ${dmg1} آسیب زد`);
    
    if (hp2 <= 0) break;
    
    const dmg2 = Math.max(1, Math.round(atk2 * (0.7 + Math.random() * 0.6) - def1 * 0.3));
    hp1 -= dmg2;
    log.push(`${player2.name} ${dmg2} آسیب زد`);
    
    if (hp1 <= 0) break;
  }
  
  const winner = hp2 <= 0 ? 1 : hp1 <= 0 ? 2 : (hp1 > hp2 ? 1 : 2);
  return { winner, log, hp1: Math.max(0, hp1), hp2: Math.max(0, hp2) };
}

// ==================== ۱۲. بازار آزاد ====================
function addToMarket(playerId, itemId, price) {
  const listing = {
    id: `m_${Date.now()}`,
    playerId,
    itemId,
    price,
    timestamp: Date.now(),
  };
  market[listing.id] = listing;
  saveAll();
  return listing.id;
}

// ==================== ۱۴. حالت سخت ====================
const HARD_MODE_MULTIPLIER = {
  monsterHp: 2,
  monsterAtk: 1.8,
  monsterDef: 1.5,
  rewardGold: 3,
  rewardXp: 2.5,
  bossChance: 0.15,
};

// ==================== ۱۵. داستان‌سرایی ====================
const STORY_CHAPTERS = [
  {
    id: 1,
    title: '🌅 شروع ماجراجویی',
    desc: 'تو وارد دهکده‌ی آریا میشی...',
    choices: [
      { text: 'به میخانه برو', next: 2, effect: 'gold+20' },
      { text: 'به جنگل برو', next: 3, effect: 'xp+15' },
      { text: 'به غار برو', next: 4, effect: 'item+random' },
    ]
  },
  {
    id: 2,
    title: '🍺 میخانه‌ی دهکده',
    desc: 'توی میخانه با یه ماجراجوی قدیمی آشنا میشی...',
    choices: [
      { text: 'ازش نصیحت بگیر', next: 5, effect: 'def+2' },
      { text: 'بهش شراب تعارف کن', next: 6, effect: 'gold-10' },
    ]
  },
  {
    id: 3,
    title: '🌲 جنگل انبوه',
    desc: 'توی جنگل با یه گرگ زخمی برخورد میکنی...',
    choices: [
      { text: 'بهش کمک کن', next: 7, effect: 'pet+wolf' },
      { text: 'فرار کن', next: 8, effect: 'nothing' },
    ]
  },
  // ... ادامه داستان
];

// ==================== توابع اصلی بازی ====================
function xpForNextLevel(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function createPlayer(ctx, classKey) {
  const base = CLASSES[classKey];
  return {
    name: ctx.from.first_name || ctx.from.username || 'ماجراجو',
    classKey,
    level: 1,
    xp: 0,
    gold: 50,
    maxHp: base.hp,
    currentHp: base.hp,
    baseAtk: base.atk,
    baseDef: base.def,
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
    createdAt: Date.now(),
    // جدید
    guild: null,
    pvpWins: 0,
    pvpLosses: 0,
    storyProgress: 0,
    hardMode: false,
    quests: [],
    completedQuests: [],
    craftingLevel: 1,
    // آمار
    totalGoldEarned: 0,
    totalXpEarned: 0,
    monstersKilled: 0,
    itemsCrafted: 0,
  };
}

function effectiveAtk(p) {
  const weapon = shopItemById(p.equippedWeapon);
  let atk = p.baseAtk + (weapon ? weapon.atkBonus : 0);
  if (p.activeEffects.power) atk = Math.round(atk * 1.5);
  
  // پت
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet) {
      if (pet.type === 'atk') atk += pet.value;
      else if (pet.type === 'all') atk += pet.value;
    }
  }
  
  // حالت سخت
  if (p.hardMode) atk = Math.round(atk * 0.9); // سختی بیشتر = حمله کمتر
  
  return atk;
}

function effectiveDef(p) {
  const armor = shopItemById(p.equippedArmor);
  let def = p.baseDef + (armor ? armor.defBonus : 0);
  
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && pet.type === 'all') def += pet.value;
  }
  
  return def;
}

function effectiveCritChance(p) {
  let chance = p.activeEffects.luck ? 0.35 : 0.15;
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && pet.type === 'crit') chance += pet.value;
  }
  return chance;
}

function getShopDiscount(p) {
  let discount = 0;
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    if (prof && prof.bonus.shopDiscount) discount = prof.bonus.shopDiscount;
  }
  return discount;
}

function getSellMultiplier(p) {
  let mult = 0.6;
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    if (prof && prof.bonus.sellMultiplier) mult = prof.bonus.sellMultiplier;
  }
  return mult;
}

// ==================== سیستم ماموریت ====================
function generateQuests(p) {
  const available = QUEST_TEMPLATES.filter(q => 
    !p.completedQuests.includes(q.id) && 
    !p.quests.find(qq => qq.id === q.id)
  );
  
  // ۳ ماموریت تصادفی
  const shuffled = available.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  
  p.quests = selected.map(q => ({
    ...q,
    progress: 0,
    completed: false,
  }));
}

function updateQuests(p, type, amount = 1) {
  p.quests.forEach(q => {
    if (!q.completed && q.type === type) {
      q.progress += amount;
      if (q.progress >= q.target) {
        q.completed = true;
        // پاداش
        p.gold += q.reward.gold;
        p.xp += q.reward.xp;
        p.completedQuests.push(q.id);
        // نوتیفیکیشن بعداً
      }
    }
  });
}

// ==================== سیستم پت ====================
function levelUpPet(p) {
  if (!p.pet) return null;
  const pet = PETS[p.pet];
  const xpNeeded = pet.level * 20;
  if (pet.xp >= xpNeeded) {
    pet.xp -= xpNeeded;
    pet.level += 1;
    // افزایش پاداش
    if (pet.type === 'atk') pet.value += 1;
    else if (pet.type === 'all') pet.value += 1;
    else if (pet.type === 'heal') pet.value += 5;
    else if (pet.type === 'crit') pet.value += 0.05;
    return pet.level;
  }
  return null;
}

// ==================== سیستم کرفتینگ ====================
function canCraft(p, recipeId) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { success: false, msg: 'دستور نامعتبر' };
  
  if (p.gold < recipe.cost) {
    return { success: false, msg: `طلای کافی نداری (${recipe.cost} طلا نیازه)` };
  }
  
  // بررسی مواد
  const hasIngredients = recipe.ingredients.every(id => p.inventory.includes(id));
  if (!hasIngredients) {
    return { success: false, msg: 'مواد لازم رو نداری!' };
  }
  
  return { success: true };
}

function doCraft(p, recipeId) {
  const check = canCraft(p, recipeId);
  if (!check.success) return check;
  
  const recipe = RECIPES.find(r => r.id === recipeId);
  
  // مصرف مواد
  recipe.ingredients.forEach(id => {
    const index = p.inventory.indexOf(id);
    if (index > -1) p.inventory.splice(index, 1);
  });
  
  p.gold -= recipe.cost;
  p.inventory.push(recipe.result);
  p.itemsCrafted += 1;
  p.craftingLevel += 0.1;
  
  return { 
    success: true, 
    msg: `✅ ${recipe.name} ساخته شد!`,
    item: shopItemById(recipe.result)
  };
}

// ==================== راه‌اندازی ====================
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN تنظیم نشده');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ==================== منوهای جدید ====================

// منوی اصلی با گزینه‌های جدید
function mainMenuKeyboard(p) {
  const rows = [
    [sbtn('👤 پروفایل', 'menu_profile', 'primary'), sbtn('🎒 کوله‌پشتی', 'menu_inventory', 'primary')],
    [sbtn('⚔️ نبرد', 'menu_fight', 'danger'), sbtn('🎁 جایزه روزانه', 'menu_daily', 'success')],
    [sbtn('🏪 فروشگاه', 'menu_shop', 'primary'), sbtn('🏆 رتبه‌بندی', 'menu_leaderboard', 'primary')],
  ];
  
  // دکمه‌های جدید
  const newRows = [
    [sbtn('🐾 پت', 'menu_pet', 'primary'), sbtn('⚒️ پیشه', 'menu_profession', 'primary')],
    [sbtn('📜 ماموریت‌ها', 'menu_quests', 'primary'), sbtn('🔨 کرفتینگ', 'menu_crafting', 'primary')],
    [sbtn('🏰 گیلد', 'menu_guild', 'primary'), sbtn('⚔️ PvP', 'menu_pvp', 'danger')],
    [sbtn('💰 بازار', 'menu_market', 'primary'), sbtn('🔥 حالت سخت', 'menu_hardmode', p?.hardMode ? 'danger' : 'primary')],
    [sbtn('📖 داستان', 'menu_story', 'primary'), sbtn('💚 بهبودی', 'menu_heal', 'success')],
    [sbtn('❓ راهنما', 'menu_help', 'primary')],
  ];
  
  rows.push(...newRows);
  return kb(rows);
}

// ==================== توابع جدید ====================

// ۳. منوی پیشه‌ها
async function doProfessionMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    return ctx.reply(
      `⚒️ *پیشه‌ی تو:* ${prof.name}\n` +
      `${prof.desc}\n` +
      `قابلیت: ${prof.ability}`,
      { 
        parse_mode: 'Markdown',
        ...kb([
          [sbtn('🔄 تغییر پیشه (۵۰ طلا)', 'profession_change', 'danger')],
          [sbtn('« بازگشت', 'menu_main', 'primary')]
        ])
      }
    );
  }
  
  const rows = Object.entries(PROFESSIONS).map(([key, prof]) => [
    sbtn(`${prof.name} — ${prof.desc} (💰${prof.price})`, `profession_pick_${key}`, 'primary')
  ]);
  rows.push([sbtn('« بازگشت', 'menu_main', 'primary')]);
  
  await ctx.reply('⚒️ *انتخاب پیشه*\n\nهر پیشه مزایای خاص خودش رو داره:', {
    parse_mode: 'Markdown',
    ...kb(rows)
  });
}

// ۴. منوی پت
async function doPetMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  if (p.pet) {
    const pet = PETS[p.pet];
    return ctx.reply(
      `🐾 *پت تو:* ${pet.name}\n` +
      `سطح: ${pet.level} | تجربه: ${pet.xp}/${pet.level * 20}\n` +
      `اثر: ${pet.desc}`,
      {
        parse_mode: 'Markdown',
        ...kb([
          [sbtn('🔄 عوض کردن پت', 'pet_change', 'primary')],
          [sbtn('« بازگشت', 'menu_main', 'primary')]
        ])
      }
    );
  }
  
  const rows = Object.entries(PETS).map(([key, pet]) => [
    sbtn(`${pet.name} — ${pet.desc} (💰${pet.price})`, `pet_buy_${key}`, 'success')
  ]);
  rows.push([sbtn('« بازگشت', 'menu_main', 'primary')]);
  
  await ctx.reply('🐾 *انتخاب پت*\n\nهر پت یک قابلیت خاص داره:', {
    parse_mode: 'Markdown',
    ...kb(rows)
  });
}

// ۵. منوی ماموریت‌ها
async function doQuestsMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  if (p.quests.length === 0) {
    generateQuests(p);
    savePlayer(ctx, p);
  }
  
  const active = p.quests.filter(q => !q.completed);
  const completed = p.quests.filter(q => q.completed);
  
  let text = '📜 *ماموریت‌های فعال*\n\n';
  active.forEach(q => {
    const progress = `${'▰'.repeat(Math.round((q.progress/q.target)*10))}${'▱'.repeat(10-Math.round((q.progress/q.target)*10))}`;
    text += `${q.name}\n${progress} (${q.progress}/${q.target})\n`;
    text += `🎁 +${q.reward.gold} طلا | +${q.reward.xp} تجربه\n\n`;
  });
  
  if (completed.length > 0) {
    text += `✅ *تکمیل شده:* ${completed.length}\n`;
  }
  
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('🔄 تازه‌سازی ماموریت‌ها (۵۰ طلا)', 'quests_refresh', 'primary')],
      [sbtn('« بازگشت', 'menu_main', 'primary')]
    ])
  });
}

// ۶. منوی کرفتینگ
async function doCraftingMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  const rows = RECIPES.map(recipe => {
    const hasIngredients = recipe.ingredients.every(id => p.inventory.includes(id));
    const canAfford = p.gold >= recipe.cost;
    const status = canAfford && hasIngredients ? '✅' : '❌';
    return [sbtn(`${recipe.name} ${status}`, `craft_${recipe.id}`, hasIngredients && canAfford ? 'success' : 'secondary')];
  });
  
  rows.push([sbtn('« بازگشت', 'menu_main', 'primary')]);
  
  await ctx.reply(
    `🔨 *کارگاه کرفتینگ*\n\n` +
    `سطح کرفتینگ: ${p.craftingLevel}\n` +
    `آیتم‌های ساخته‌شده: ${p.itemsCrafted}\n\n` +
    `روی هر دستور کلیک کن تا ببینی موادش رو داری یا نه:`,
    {
      parse_mode: 'Markdown',
      ...kb(rows)
    }
  );
}

// ۷. منوی گیلد
async function doGuildMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  if (p.guild) {
    const guild = guilds[p.guild];
    if (!guild) {
      p.guild = null;
      savePlayer(ctx, p);
      return ctx.reply('گیلد وجود نداره!');
    }
    
    const isLeader = guild.leader === playerKey(ctx);
    const memberCount = guild.members.length;
    const bossProgress = `${Math.round((1 - guild.bossHp/guild.bossMaxHp) * 100)}%`;
    
    return ctx.reply(
      `🏰 *${guild.name}*\n` +
      `رهبر: ${isLeader ? '👑 شما' : 'عضو'}\n` +
      `اعضا: ${memberCount} نفر\n` +
      `سطح گیلد: ${guild.level}\n` +
      `صندوق: ${guild.bank} طلا\n` +
      `باس گیلد: ${bossProgress}\n` +
      `باس‌های شکست‌خورده: ${guild.bossDefeated}`,
      {
        parse_mode: 'Markdown',
        ...kb([
          ...(isLeader ? [
            [sbtn('👤 دعوت عضو', 'guild_invite', 'primary')],
            [sbtn('🗑 منحل کردن گیلد', 'guild_disband', 'danger')]
          ] : []),
          [sbtn('⚔️ حمله به باس گیلد', 'guild_boss', 'danger')],
          [sbtn('💰 کمک به صندوق', 'guild_donate', 'success')],
          [sbtn('« بازگشت', 'menu_main', 'primary')]
        ])
      }
    );
  }
  
  await ctx.reply('🏰 *سیستم گیلد*\n\n' +
    'با دوستانت یه گروه تشکیل بده!\n' +
    'هزینه‌ی ساخت: ۲۰۰ طلا',
    {
      parse_mode: 'Markdown',
      ...kb([
        [sbtn('🏗 ساخت گیلد جدید', 'guild_create', 'success')],
        [sbtn('📋 لیست گیلدها', 'guild_list', 'primary')],
        [sbtn('« بازگشت', 'menu_main', 'primary')]
      ])
    }
  );
}

// ۸. منوی PvP
async function doPVPMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  await ctx.reply(
    '⚔️ *سیستم PvP*\n\n' +
    `بردها: ${p.pvpWins}\n` +
    `باخت‌ها: ${p.pvpLosses}\n\n` +
    `برای پیدا کردن حریف، روی دکمه‌ی زیر کلیک کن:`,
    {
      parse_mode: 'Markdown',
      ...kb([
        [sbtn('🔍 پیدا کردن حریف', 'pvp_find', 'danger')],
        [sbtn('🏆 رتبه‌بندی PvP', 'pvp_leaderboard', 'primary')],
        [sbtn('« بازگشت', 'menu_main', 'primary')]
      ])
    }
  );
}

// ۱۲. منوی بازار
async function doMarketMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  const listings = Object.values(market).filter(m => m.playerId !== playerKey(ctx));
  
  if (listings.length === 0) {
    return ctx.reply('💰 *بازار آزاد*\n\nهیچ آیتمی برای فروش نیست!', {
      parse_mode: 'Markdown',
      ...kb([
        [sbtn('📤 فروش آیتم', 'market_sell', 'primary')],
        [sbtn('« بازگشت', 'menu_main', 'primary')]
      ])
    });
  }
  
  const rows = listings.map(listing => {
    const item = shopItemById(listing.itemId);
    return [sbtn(`${item?.label || 'نامشخص'} — 💰${listing.price}`, `market_buy_${listing.id}`, 'success')];
  });
  
  rows.push([sbtn('📤 فروش آیتم', 'market_sell', 'primary')]);
  rows.push([sbtn('« بازگشت', 'menu_main', 'primary')]);
  
  await ctx.reply('💰 *بازار آزاد*\n\nآیتم‌های فروشی:', {
    parse_mode: 'Markdown',
    ...kb(rows)
  });
}

// ۱۴. حالت سخت
async function doHardMode(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  p.hardMode = !p.hardMode;
  savePlayer(ctx, p);
  
  await ctx.reply(
    p.hardMode ? 
    '🔥 *حالت سخت فعال شد!*\nهیولاها قوی‌ترن ولی پاداش بیشتره!' :
    '☀️ *حالت عادی فعال شد*',
    {
      parse_mode: 'Markdown',
      ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
    }
  );
}

// ۱۵. منوی داستان
async function doStoryMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('اول شخصیت بساز!');
  
  const chapter = STORY_CHAPTERS.find(c => c.id === p.storyProgress + 1) || STORY_CHAPTERS[0];
  
  const rows = chapter.choices.map(choice => [
    sbtn(choice.text, `story_${choice.next}`, 'primary')
  ]);
  
  await ctx.reply(
    `📖 *${chapter.title}*\n\n${chapter.desc}`,
    {
      parse_mode: 'Markdown',
      ...kb(rows)
    }
  );
}

// ==================== اکشن‌های جدید ====================

// ۳. پیشه‌ها
bot.action(/^profession_pick_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const profKey = ctx.match[1];
  const prof = PROFESSIONS[profKey];
  
  if (p.gold < prof.price) {
    await ctx.answerCbQuery(`طلای کافی نداری! (${prof.price} طلا نیازه)`, { show_alert: true });
    return;
  }
  
  if (p.profession) {
    // تغییر پیشه
    if (p.gold < 50) {
      await ctx.answerCbQuery('برای تغییر پیشه ۵۰ طلا نیازه!', { show_alert: true });
      return;
    }
    p.gold -= 50;
  }
  
  p.gold -= prof.price;
  p.profession = profKey;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${prof.name} انتخاب شد!`);
  await ctx.reply(`✅ *${prof.name}* انتخاب شد!\n${prof.desc}\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
});

// ۴. پت
bot.action(/^pet_buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const petKey = ctx.match[1];
  const pet = PETS[petKey];
  
  if (p.gold < pet.price) {
    await ctx.answerCbQuery(`طلای کافی نداری! (${pet.price} طلا)`, { show_alert: true });
    return;
  }
  
  p.gold -= pet.price;
  p.pet = petKey;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${pet.name} خریداری شد!`);
  await ctx.reply(`🐾 *${pet.name}* همراهت شد!\n${pet.desc}`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
});

// ۶. کرفتینگ
bot.action(/^craft_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const recipeId = ctx.match[1];
  const result = doCraft(p, recipeId);
  
  if (!result.success) {
    await ctx.answerCbQuery(result.msg, { show_alert: true });
    return;
  }
  
  savePlayer(ctx, p);
  await ctx.answerCbQuery(`✅ ${result.item.label} ساخته شد!`);
  await ctx.reply(`${result.msg}\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت به کرفتینگ', 'menu_crafting', 'primary')]])
  });
});

// ۷. گیلد - ساخت
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
  await ctx.reply('🏗 *ساخت گیلد جدید*\n\nاسم گیلد رو انتخاب کن (با دکمه):', {
    ...kb([
      [sbtn('🔥 آتشین', 'guild_name_Fire', 'primary')],
      [sbtn('⚡ صاعقه', 'guild_name_Storm', 'primary')],
      [sbtn('🌊 موج‌ها', 'guild_name_Wave', 'primary')],
      [sbtn('🗻 کوهستان', 'guild_name_Mountain', 'primary')],
      [sbtn('🌙 ماه‌تاب', 'guild_name_Moon', 'primary')],
      [sbtn('« انصراف', 'menu_main', 'primary')]
    ])
  });
});

bot.action(/^guild_name_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
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
  p.gold -= 200;
  const guildId = createGuild(name, playerKey(ctx), ctx.chat.id);
  p.guild = guildId;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ گیلد ${name} ساخته شد!`);
  await ctx.reply(`🏰 *${name}* ساخته شد!\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« ورود به گیلد', 'menu_guild', 'primary')]])
  });
});

// ۸. PvP - پیدا کردن حریف
bot.action('pvp_find', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const userId = ctx.from.id;
  PVP_QUEUE.push(userId);
  
  await ctx.answerCbQuery('🔍 در صف PvP قرار گرفتی...');
  
  // چک کردن حریف
  const opponentId = findPVPMatch(ctx);
  if (opponentId) {
    // پیدا کردن حریف
    const opponentKey = keyOf(ctx.chat.id, opponentId);
    const opponent = players[opponentKey];
    
    if (opponent) {
      // شروع نبرد
      const result = simulatePVP(p, opponent);
      
      let text = '⚔️ *نبرد PvP*\n\n';
      text += result.log.join('\n') + '\n\n';
      
      if (result.winner === 1) {
        p.pvpWins += 1;
        opponent.pvpLosses += 1;
        const goldReward = 30 + Math.round(Math.random() * 20);
        p.gold += goldReward;
        text += `🎉 *برنده شدی!* +${goldReward} طلا`;
      } else {
        p.pvpLosses += 1;
        opponent.pvpWins += 1;
        text += `😔 *باختی...*`;
      }
      
      savePlayer(ctx, p);
      savePlayer({ chat: ctx.chat, from: { id: opponentId } }, opponent);
      
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
      });
      
      // خبر دادن به حریف
      try {
        await bot.telegram.sendMessage(
          opponentId,
          `⚔️ نبرد PvP با ${p.name} تمام شد!\n${result.winner === 2 ? '🎉 برنده شدی!' : '😔 باختی...'}`
        );
      } catch (e) {}
      
      return;
    }
  }
  
  await ctx.reply('🔍 *در صف PvP هستی...*\nمنتظر حریف بمان.', {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('❌ خروج از صف', 'pvp_leave', 'danger')],
      [sbtn('« بازگشت', 'menu_main', 'primary')]
    ])
  });
});

bot.action('pvp_leave', async (ctx) => {
  const userId = ctx.from.id;
  const index = PVP_QUEUE.indexOf(userId);
  if (index > -1) PVP_QUEUE.splice(index, 1);
  
  await ctx.answerCbQuery('✅ از صف خارج شدی!');
  await ctx.reply('✅ از صف PvP خارج شدی.', {
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
});

// ۱۲. بازار
bot.action('market_sell', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  if (p.inventory.length === 0) {
    await ctx.answerCbQuery('کوله‌پشتیت خالیه!', { show_alert: true });
    return;
  }
  
  const rows = p.inventory.map(id => {
    const item = shopItemById(id);
    return [sbtn(`${item?.label || 'نامشخص'}`, `market_sell_item_${id}`, 'primary')];
  });
  rows.push([sbtn('« انصراف', 'menu_market', 'primary')]);
  
  await ctx.reply('💰 *انتخاب آیتم برای فروش*\n\nروی آیتم کلیک کن:', {
    parse_mode: 'Markdown',
    ...kb(rows)
  });
});

bot.action(/^market_sell_item_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  if (!p.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  await ctx.reply(`💰 *قیمت فروش ${shopItemById(itemId)?.label || 'آیتم'} رو وارد کن*\n\n(با دکمه‌ها):`, {
    ...kb([
      [sbtn('۱۰ طلا', `market_price_${itemId}_10`, 'primary')],
      [sbtn('۲۰ طلا', `market_price_${itemId}_20`, 'primary')],
      [sbtn('۵۰ طلا', `market_price_${itemId}_50`, 'primary')],
      [sbtn('۱۰۰ طلا', `market_price_${itemId}_100`, 'primary')],
      [sbtn('۲۰۰ طلا', `market_price_${itemId}_200`, 'primary')],
      [sbtn('« انصراف', 'menu_market', 'primary')]
    ])
  });
});

bot.action(/^market_price_(.+)_(\d+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  const price = parseInt(ctx.match[2]);
  
  if (!p.inventory.includes(itemId)) {
    await ctx.answerCbQuery('این آیتم رو نداری!', { show_alert: true });
    return;
  }
  
  // حذف از کوله
  const index = p.inventory.indexOf(itemId);
  p.inventory.splice(index, 1);
  
  // اضافه به بازار
  const listingId = addToMarket(playerKey(ctx), itemId, price);
  savePlayer(ctx, p);
  
  const item = shopItemById(itemId);
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} با قیمت ${price} طلا در بازار قرار گرفت!`);
  await ctx.reply(`✅ *${item?.label || 'آیتم'}* در بازار قرار گرفت!\n💰 قیمت: ${price} طلا`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازار', 'menu_market', 'primary')]])
  });
});

bot.action(/^market_buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const listingId = ctx.match[1];
  const listing = market[listingId];
  
  if (!listing) {
    await ctx.answerCbQuery('این آیتم دیگه فروخته شده!', { show_alert: true });
    return;
  }
  
  if (p.gold < listing.price) {
    await ctx.answerCbQuery(`طلای کافی نداری! (${listing.price} طلا)`, { show_alert: true });
    return;
  }
  
  // خرید
  p.gold -= listing.price;
  p.inventory.push(listing.itemId);
  
  // پول به فروشنده
  const sellerKey = listing.playerId;
  const seller = players[sellerKey];
  if (seller) {
    seller.gold += listing.price;
    players[sellerKey] = seller;
  }
  
  delete market[listingId];
  savePlayer(ctx, p);
  saveAll();
  
  const item = shopItemById(listing.itemId);
  await ctx.answerCbQuery(`✅ ${item?.label || 'آیتم'} خریداری شد!`);
  await ctx.reply(`✅ *${item?.label || 'آیتم'}* خریداری شد!\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازار', 'menu_market', 'primary')]])
  });
});

// ==================== منوهای اصلی ====================

// منوی اصلی
bot.action('menu_main', async (ctx) => {
  await ctx.answerCbQuery();
  const p = getPlayer(ctx);
  await ctx.reply('🗡 *منوی اصلی افسانه‌ی گروه*\n\nیک گزینه رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(p)
  });
});

// منوهای جدید
bot.action('menu_profession', async (ctx) => {
  await ctx.answerCbQuery();
  await doProfessionMenu(ctx);
});

bot.action('menu_pet', async (ctx) => {
  await ctx.answerCbQuery();
  await doPetMenu(ctx);
});

bot.action('menu_quests', async (ctx) => {
  await ctx.answerCbQuery();
  await doQuestsMenu(ctx);
});

bot.action('menu_crafting', async (ctx) => {
  await ctx.answerCbQuery();
  await doCraftingMenu(ctx);
});

bot.action('menu_guild', async (ctx) => {
  await ctx.answerCbQuery();
  await doGuildMenu(ctx);
});

bot.action('menu_pvp', async (ctx) => {
  await ctx.answerCbQuery();
  await doPVPMenu(ctx);
});

bot.action('menu_market', async (ctx) => {
  await ctx.answerCbQuery();
  await doMarketMenu(ctx);
});

bot.action('menu_hardmode', async (ctx) => {
  await ctx.answerCbQuery();
  await doHardMode(ctx);
});

bot.action('menu_story', async (ctx) => {
  await ctx.answerCbQuery();
  await doStoryMenu(ctx);
});

// ==================== داستان ====================
bot.action(/^story_(\d+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const chapterId = parseInt(ctx.match[1]);
  const chapter = STORY_CHAPTERS.find(c => c.id === chapterId);
  
  if (!chapter) {
    await ctx.answerCbQuery('داستان تمام شد!', { show_alert: true });
    return;
  }
  
  // اعمال اثر
  if (chapter.choices) {
    // اینجا باید اثر انتخاب رو اعمال کنی
  }
  
  p.storyProgress = chapterId;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery();
  await doStoryMenu(ctx);
});

// ==================== دستور start ====================
bot.command('start', async (ctx) => {
  const existing = getPlayer(ctx);
  if (existing) {
    await ctx.reply(`👋 خوش برگشتی!\n\n${profileCard(existing)}`, { 
      parse_mode: 'Markdown' 
    });
    await sendMainMenu(ctx);
    return;
  }
  
  await ctx.reply(
    '🗡 به *افسانه‌ی گروه (نسخه ۴)* خوش اومدی!\n\n' +
    'یک کلاس برای شخصیتت انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...kb([
        [sbtn('⚔️ جنگجو', 'pick_warrior', 'primary')],
        [sbtn('🔮 جادوگر', 'pick_mage', 'primary')],
        [sbtn('🏹 تیرانداز', 'pick_archer', 'primary')],
      ])
    }
  );
});

// انتخاب کلاس
bot.action(/^pick_(warrior|mage|archer)$/, async (ctx) => {
  if (getPlayer(ctx)) {
    await ctx.answerCbQuery('تو قبلاً شخصیت داری!', { show_alert: true });
    return;
  }
  
  const classKey = ctx.match[1];
  const p = createPlayer(ctx, classKey);
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ شخصیت ${CLASSES[classKey].label} ساخته شد!`);
  await ctx.reply(`🎉 شخصیتت ساخته شد!\n\n${profileCard(p)}`, { 
    parse_mode: 'Markdown' 
  });
  await sendMainMenu(ctx);
});

// ==================== توابع کمکی ====================

function profileCard(p) {
  const cls = CLASSES[p.classKey];
  const weapon = shopItemById(p.equippedWeapon);
  const armor = shopItemById(p.equippedArmor);
  const pet = p.pet ? PETS[p.pet] : null;
  const prof = p.profession ? PROFESSIONS[p.profession] : null;
  
  return (
    `${cls.emoji} *${p.name}* — ${cls.label}\n` +
    `${computeTitle(p)}\n\n` +
    `📊 سطح: *${p.level}*\n` +
    `✨ تجربه: ${xpBar(p)}\n` +
    `❤️ سلامتی: ${p.currentHp}/${p.maxHp}\n` +
    `💪 حمله: ${effectiveAtk(p)}${weapon ? ` (${weapon.label})` : ''}\n` +
    `🛡 دفاع: ${effectiveDef(p)}${armor ? ` (${armor.label})` : ''}\n` +
    `💰 طلا: ${p.gold}\n` +
    `${pet ? `🐾 پت: ${pet.name}\n` : ''}` +
    `${prof ? `⚒️ پیشه: ${prof.name}\n` : ''}` +
    `\n📈 بردها: ${p.wins} | باخت‌ها: ${p.losses} | باس: ${p.bossesDefeated}` +
    `${p.hardMode ? '\n🔥 حالت سخت: فعال' : ''}`
  );
}

function xpBar(p) {
  const need = xpForNextLevel(p.level);
  const filled = Math.min(10, Math.round((p.xp / need) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` (${p.xp}/${need})`;
}

function computeTitle(p) {
  let title;
  if (p.wins >= 50) title = '👑 افسانه';
  else if (p.wins >= 25) title = '🏆 قهرمان';
  else if (p.wins >= 10) title = '⚔️ جنگجوی باتجربه';
  else title = '🌱 مبتدی';
  if (p.bossesDefeated >= 1) title += ' 🐉 اژدهاکش';
  if (p.pvpWins >= 10) title += ' ⚔️ PvP‌باز';
  return title;
}

// ==================== فروشگاه (بقیه آیتم‌ها) ====================
// ... (همون فروشگاه قبلی با آیتم‌های بیشتر)

// ==================== راه‌اندازی ====================
async function sendMainMenu(ctx) {
  const p = getPlayer(ctx);
  await ctx.reply('🗡 *منوی اصلی افسانه‌ی گروه*\n\nیک گزینه رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(p)
  });
}

// ==================== Fallback ====================
bot.on('text', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('🗡 به ربات خوش اومدی! اول یه شخصیت بساز:', {
      ...kb([
        [sbtn('⚔️ جنگجو', 'pick_warrior', 'primary')],
        [sbtn('🔮 جادوگر', 'pick_mage', 'primary')],
        [sbtn('🏹 تیرانداز', 'pick_archer', 'primary')],
      ])
    });
    return;
  }
  await sendMainMenu(ctx);
});

// ==================== راه‌اندازی نهایی ====================
bot.catch((err, ctx) => {
  console.error(`❌ خطا:`, err.message);
});

bot.launch();
console.log('🗡 افسانه‌ی گروه (نسخه ۴) با تمام قابلیت‌ها شروع شد!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
