/**
 * 🗡 افسانه‌ی گروه (نسخه ۴) — نسخه‌ی اصلاح‌شده
 */

const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const DATA_PATH = path.join(__dirname, 'players.json');
const GUILDS_PATH = path.join(__dirname, 'guilds.json');
const MARKET_PATH = path.join(__dirname, 'market.json');

// ==================== ایجاد فایل‌های خالی ====================
function ensureFile(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({}), 'utf-8');
  }
}
ensureFile(DATA_PATH);
ensureFile(GUILDS_PATH);
ensureFile(MARKET_PATH);

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

// ==================== فروشگاه ====================
const WEAPONS = [
  { id: 'w1', label: '🗡 خنجر زنگ‌زده', type: 'weapon', rarity: 'common', atkBonus: 2, price: 15 },
  { id: 'w2', label: '⚔️ شمشیر آهنی', type: 'weapon', rarity: 'common', atkBonus: 4, price: 40 },
  { id: 'w3', label: '🔷 شمشیر نقره‌ای', type: 'weapon', rarity: 'rare', atkBonus: 9, price: 120 },
  { id: 'w4', label: '🟣 تبر جنگی حماسی', type: 'weapon', rarity: 'epic', atkBonus: 14, price: 220 },
  { id: 'w5', label: '🐉 نیزه‌ی اژدها', type: 'weapon', rarity: 'legendary', atkBonus: 20, price: 400 },
  { id: 'w6', label: '🔥 شمشیر ققنوس', type: 'weapon', rarity: 'mythic', atkBonus: 28, price: 700 },
];

const ARMORS = [
  { id: 'a1', label: '🥋 زره چرمی', type: 'armor', rarity: 'common', defBonus: 2, price: 30 },
  { id: 'a2', label: '🛡 زره آهنی', type: 'armor', rarity: 'common', defBonus: 5, price: 90 },
  { id: 'a3', label: '🔷 زره نقره‌ای', type: 'armor', rarity: 'rare', defBonus: 9, price: 180 },
  { id: 'a4', label: '🐲 زره فلس اژدها', type: 'armor', rarity: 'epic', defBonus: 15, price: 350 },
];

const CONSUMABLES = [
  { id: 'c1', label: '🧪 معجون سلامتی', type: 'consumable', effect: 'heal', price: 15, desc: '۴۰٪ سلامتی' },
  { id: 'c2', label: '💥 معجون قدرت', type: 'consumable', effect: 'power', price: 25, desc: '۵۰٪ حمله بیشتر' },
  { id: 'c3', label: '🍀 طلسم شانس', type: 'consumable', effect: 'luck', price: 25, desc: 'شانس کریتیکال' },
  { id: 'c4', label: '✨ سنگ احیا', type: 'consumable', effect: 'revive', price: 60, desc: 'یک‌بار نجات' },
];

const SHOP_ITEMS = [...WEAPONS, ...ARMORS, ...CONSUMABLES];

function shopItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

// ==================== پیشه‌ها ====================
const PROFESSIONS = {
  blacksmith: {
    name: '⚒️ آهنگر',
    desc: 'تخفیف ۲۰٪ سلاح و زره',
    ability: 'تعمیر زره (۵۰٪ دفاع بیشتر یک نبرد)',
    price: 100,
  },
  alchemist: {
    name: '🧪 کیمیاگر',
    desc: 'تخفیف ۲۰٪ معجون',
    ability: 'ساخت معجون تصادفی هر ۳ نبرد',
    price: 100,
  },
  merchant: {
    name: '💰 بازرگان',
    desc: 'فروش آیتم‌ها ۸۰٪ قیمت',
    ability: 'یک‌بار تخفیف ویژه روزانه',
    price: 150,
  },
  hunter: {
    name: '🏹 شکارچی',
    desc: '۲۰٪ شانس آیتم بعد از نبرد',
    ability: 'ردیابی باس (شانس باس ۲×)',
    price: 150,
  },
};

// ==================== پت‌ها ====================
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
};

// ==================== توابع اصلی ====================
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
    guild: null,
    pvpWins: 0,
    pvpLosses: 0,
    storyProgress: 0,
    hardMode: false,
    quests: [],
    completedQuests: [],
    craftingLevel: 1,
    itemsCrafted: 0,
  };
}

function xpForNextLevel(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function effectiveAtk(p) {
  const weapon = shopItemById(p.equippedWeapon);
  let atk = p.baseAtk + (weapon ? weapon.atkBonus : 0);
  if (p.activeEffects.power) atk = Math.round(atk * 1.5);
  if (p.pet) {
    const pet = PETS[p.pet];
    if (pet && (pet.type === 'atk' || pet.type === 'all')) atk += pet.value;
  }
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

function xpBar(p) {
  const need = xpForNextLevel(p.level);
  const filled = Math.min(10, Math.round((p.xp / need) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` (${p.xp}/${need})`;
}

function computeTitle(p) {
  let title = '🌱 مبتدی';
  if (p.wins >= 50) title = '👑 افسانه';
  else if (p.wins >= 25) title = '🏆 قهرمان';
  else if (p.wins >= 10) title = '⚔️ جنگجوی باتجربه';
  if (p.bossesDefeated >= 1) title += ' 🐉 اژدهاکش';
  return title;
}

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

// ==================== منوها ====================

// منوی انتخاب کلاس
function classSelectionKeyboard() {
  return kb([
    [sbtn('⚔️ جنگجو', 'pick_warrior', 'primary')],
    [sbtn('🔮 جادوگر', 'pick_mage', 'primary')],
    [sbtn('🏹 تیرانداز', 'pick_archer', 'primary')],
  ]);
}

// منوی اصلی
function mainMenuKeyboard(p) {
  const rows = [
    [sbtn('👤 پروفایل', 'menu_profile', 'primary'), sbtn('🎒 کوله‌پشتی', 'menu_inventory', 'primary')],
    [sbtn('⚔️ نبرد', 'menu_fight', 'danger'), sbtn('🎁 جایزه روزانه', 'menu_daily', 'success')],
    [sbtn('🏪 فروشگاه', 'menu_shop', 'primary'), sbtn('🏆 رتبه‌بندی', 'menu_leaderboard', 'primary')],
    [sbtn('🐾 پت', 'menu_pet', 'primary'), sbtn('⚒️ پیشه', 'menu_profession', 'primary')],
    [sbtn('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success'), sbtn('❓ راهنما', 'menu_help', 'primary')],
  ];
  return kb(rows);
}

// ==================== توابع منوها ====================

async function sendMainMenu(ctx) {
  const p = getPlayer(ctx);
  await ctx.reply('🗡 *منوی اصلی افسانه‌ی گروه*\n\nیک گزینه رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(p)
  });
}

async function doProfile(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  await ctx.reply(profileCard(p), {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

async function doInventory(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  if (p.inventory.length === 0) {
    await ctx.reply('🎒 کوله‌پشتیت خالیه!', {
      ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
    });
    return;
  }
  const lines = p.inventory.map((id) => {
    const item = shopItemById(id);
    if (!item) return `\`${id}\` — نامشخص`;
    let tag = '';
    if (p.equippedWeapon === id || p.equippedArmor === id) tag = ' ✅';
    return `${item.label}${tag}`;
  });
  await ctx.reply('🎒 *کوله‌پشتی*\n\n' + lines.join('\n'), {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

async function doFight(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  await ctx.reply('⚔️ *نبرد*\n\nدر حال توسعه...', {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

async function doDaily(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;
  if (p.lastDaily && now - p.lastDaily < cooldown) {
    const remaining = Math.ceil((cooldown - (now - p.lastDaily)) / (60 * 60 * 1000));
    await ctx.reply(`⏳ ${remaining} ساعت دیگه`, {
      ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
    });
    return;
  }
  
  const goldReward = 30 + p.level * 5;
  const xpReward = 20 + p.level * 3;
  p.gold += goldReward;
  p.xp += xpReward;
  p.lastDaily = now;
  p.dailyStreak = (p.dailyStreak || 0) + 1;
  savePlayer(ctx, p);
  
  await ctx.reply(`🎁 *جایزه روزانه*\n💰 +${goldReward} طلا\n✨ +${xpReward} تجربه\n🔥 استریک: ${p.dailyStreak} روز`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

async function doShopMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  
  const rows = SHOP_ITEMS.map(item => [
    sbtn(`${item.label} — 💰${item.price}`, `buy_${item.id}`, 'success')
  ]);
  rows.push([sbtn('« بازگشت', 'menu_main', 'primary')]);
  
  await ctx.reply('🏪 *فروشگاه*\n\nروی آیتم کلیک کن تا بخری:', {
    parse_mode: 'Markdown',
    ...kb(rows)
  });
}

async function doLeaderboard(ctx) {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p)
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 10);
  
  if (chatPlayers.length === 0) {
    await ctx.reply('هنوز کسی تو این گروه شخصیت نساخته.', {
      ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
    });
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  const lines = chatPlayers.map((p, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const cls = CLASSES[p.classKey];
    return `${rank} ${cls.emoji} *${p.name}* — سطح ${p.level}`;
  });
  
  await ctx.reply(`🏆 *رتبه‌بندی*\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

async function doHelp(ctx) {
  await ctx.reply(
    '🗡 *راهنمای افسانه‌ی گروه*\n\n' +
    '✅ همه‌چیز با دکمه‌ها انجام میشه!\n\n' +
    '⚔️ نبرد — با هیولاها بجنگ\n' +
    '🎁 روزانه — هر ۲۴ ساعت جایزه بگیر\n' +
    '🏪 فروشگاه — سلاح/زره/معجون بخر\n' +
    '🎒 کوله‌پشتی — آیتم‌هات رو مدیریت کن\n' +
    '💚 بهبودی — سلامتی رو با ۲۰ طلا پر کن\n' +
    '🏆 رتبه‌بندی — ببین کی قوی‌تره\n' +
    '🐾 پت — حیوان همراه بگیر\n' +
    '⚒️ پیشه — یه شغل انتخاب کن',
    {
      parse_mode: 'Markdown',
      ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
    }
  );
}

async function doPetMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  
  if (p.pet) {
    const pet = PETS[p.pet];
    await ctx.reply(
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
    return;
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

async function doProfessionMenu(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  
  if (p.profession) {
    const prof = PROFESSIONS[p.profession];
    await ctx.reply(
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
    return;
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

async function doHeal(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }
  
  if (p.gold < 20) {
    await ctx.answerCbQuery('۲۰ طلا نداری!', { show_alert: true });
    return;
  }
  
  if (p.currentHp >= p.maxHp) {
    await ctx.answerCbQuery('سلامتی‌ات کامل هست!', { show_alert: true });
    return;
  }
  
  p.gold -= 20;
  p.currentHp = p.maxHp;
  savePlayer(ctx, p);
  
  await ctx.reply(`💚 *سلامتی کامل شد!*\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
}

// ==================== اکشن‌ها ====================

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

// منوی اصلی
bot.action('menu_main', async (ctx) => {
  await ctx.answerCbQuery();
  await sendMainMenu(ctx);
});

// سایر منوها
bot.action('menu_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await doProfile(ctx);
});

bot.action('menu_inventory', async (ctx) => {
  await ctx.answerCbQuery();
  await doInventory(ctx);
});

bot.action('menu_fight', async (ctx) => {
  await ctx.answerCbQuery();
  await doFight(ctx);
});

bot.action('menu_daily', async (ctx) => {
  await ctx.answerCbQuery();
  await doDaily(ctx);
});

bot.action('menu_shop', async (ctx) => {
  await ctx.answerCbQuery();
  await doShopMenu(ctx);
});

bot.action('menu_leaderboard', async (ctx) => {
  await ctx.answerCbQuery();
  await doLeaderboard(ctx);
});

bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery();
  await doHelp(ctx);
});

bot.action('menu_pet', async (ctx) => {
  await ctx.answerCbQuery();
  await doPetMenu(ctx);
});

bot.action('menu_profession', async (ctx) => {
  await ctx.answerCbQuery();
  await doProfessionMenu(ctx);
});

bot.action('menu_heal', async (ctx) => {
  await ctx.answerCbQuery();
  await doHeal(ctx);
});

// خرید
bot.action(/^buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const itemId = ctx.match[1];
  const item = shopItemById(itemId);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  
  if (p.gold < item.price) {
    await ctx.answerCbQuery(`طلای کافی نداری! (${item.price} طلا)`, { show_alert: true });
    return;
  }
  
  p.gold -= item.price;
  p.inventory.push(item.id);
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${item.label} خریداری شد!`);
  await ctx.reply(`✅ *${item.label}* خریداری شد!\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« ادامه خرید', 'menu_shop', 'primary')]])
  });
});

// خرید پت
bot.action(/^pet_buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const petKey = ctx.match[1];
  const pet = PETS[petKey];
  if (!pet) {
    await ctx.answerCbQuery('پت نامعتبر!', { show_alert: true });
    return;
  }
  
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

// انتخاب پیشه
bot.action(/^profession_pick_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
    return;
  }
  
  const profKey = ctx.match[1];
  const prof = PROFESSIONS[profKey];
  if (!prof) {
    await ctx.answerCbQuery('پیشه نامعتبر!', { show_alert: true });
    return;
  }
  
  if (p.gold < prof.price) {
    await ctx.answerCbQuery(`طلای کافی نداری! (${prof.price} طلا)`, { show_alert: true });
    return;
  }
  
  p.gold -= prof.price;
  p.profession = profKey;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${prof.name} انتخاب شد!`);
  await ctx.reply(`✅ *${prof.name}* انتخاب شد!\n${prof.desc}`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت', 'menu_main', 'primary')]])
  });
});

// ==================== دستورات ====================

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
      ...classSelectionKeyboard()
    }
  );
});

bot.command('menu', sendMainMenu);

// Fallback
bot.on('text', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('🗡 به ربات خوش اومدی! اول یه شخصیت بساز:', {
      ...classSelectionKeyboard()
    });
    return;
  }
  await sendMainMenu(ctx);
});

// ==================== راه‌اندازی ====================
bot.catch((err, ctx) => {
  console.error(`❌ خطا:`, err.message);
});

bot.launch();
console.log('🗡 افسانه‌ی گروه (نسخه ۴) شروع شد!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
