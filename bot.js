/**
 * 🗡 افسانه‌ی گروه (نسخه ۲) — ربات RPG متنی برای گروه‌های تلگرام
 * ------------------------------------------------------------------
 * ارتقاهای این نسخه نسبت به نسخه‌ی اول:
 *  - فروشگاه گسترده: ۶ سلاح + ۴ زره + ۴ معجون، با رتبه‌بندی کیفیت
 *    (عادی/کمیاب/حماسی/افسانه‌ای/اسطوره‌ای)
 *  - اسلات زره جدا از سلاح (دفاع مستقل از حمله)
 *  - ۱۸ هیولای معمولی + ۳ باس با شانس کم ظهور و جایزه‌ی بزرگ
 *  - ضربه‌ی بحرانی (کریتیکال) در نبرد برای هیجان بیشتر
 *  - سیستم عنوان/دستاورد بر اساس تعداد بردها و کشتن باس
 *  - جایزه‌ی روزانه با استریک (روزهای متوالی = جایزه‌ی بیشتر)
 *  - رتبه‌بندی چندگانه (سطح/طلا/بردها) با دکمه‌های تعویض
 *  - پنل کامل با دکمه‌های شیشه‌ای رنگی (style: primary/success/danger)
 *    که تقریباً همه‌چیز رو بدون تایپ دستور مدیریت می‌کنه
 *
 * ذخیره‌سازی: فایل JSON ساده (players.json)، هر بازیکن با کلید
 * `chatId:userId` تا هر گروه لیدربورد و پیشرفت جدای خودش را داشته باشد.
 */

const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const DATA_PATH = path.join(__dirname, 'players.json');

// ==================== ذخیره‌سازی پایدار ====================
function loadPlayers() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('⚠️ خطا در خواندن players.json:', err.message);
  }
  return {};
}

function savePlayers(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('⚠️ خطا در ذخیره players.json:', err.message);
  }
}

let players = loadPlayers();

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
  savePlayers(players);
}

// ==================== دکمه‌ی رنگی (Bot API 9.4+) ====================
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
  warrior: { label: 'جنگجو', hp: 40, atk: 8, def: 5, emoji: '⚔️' },
  mage: { label: 'جادوگر', hp: 26, atk: 12, def: 2, emoji: '🔮' },
  archer: { label: 'تیرانداز', hp: 32, atk: 10, def: 3, emoji: '🏹' },
};

function createPlayer(ctx, classKey) {
  const base = CLASSES[classKey];
  return {
    name: ctx.from.first_name || ctx.from.username || 'ماجراجو',
    classKey,
    level: 1,
    xp: 0,
    gold: 20,
    maxHp: base.hp,
    currentHp: base.hp,
    baseAtk: base.atk,
    baseDef: base.def,
    equippedWeapon: null,
    equippedArmor: null,
    inventory: [],
    activeEffects: { power: false, luck: false, revive: false },
    wins: 0,
    losses: 0,
    bossesDefeated: 0,
    lastDaily: 0,
    dailyStreak: 0,
    createdAt: Date.now(),
  };
}

function xpForNextLevel(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function effectiveAtk(p) {
  const weapon = shopItemById(p.equippedWeapon);
  let atk = p.baseAtk + (weapon ? weapon.atkBonus : 0);
  if (p.activeEffects.power) atk = Math.round(atk * 1.5);
  return atk;
}
function effectiveDef(p) {
  const armor = shopItemById(p.equippedArmor);
  return p.baseDef + (armor ? armor.defBonus : 0);
}
function effectiveCritChance(p) {
  return p.activeEffects.luck ? 0.35 : 0.15;
}

function applyLevelUps(p) {
  const gained = [];
  while (p.xp >= xpForNextLevel(p.level)) {
    p.xp -= xpForNextLevel(p.level);
    p.level += 1;
    p.maxHp += 6;
    p.currentHp = p.maxHp;
    p.baseAtk += 2;
    p.baseDef += 1;
    gained.push(p.level);
  }
  return gained;
}

// ==================== عنوان‌ها / دستاوردها ====================
function computeTitle(p) {
  let title;
  if (p.wins >= 50) title = '👑 افسانه';
  else if (p.wins >= 25) title = '🏆 قهرمان';
  else if (p.wins >= 10) title = '⚔️ جنگجوی باتجربه';
  else title = '🌱 مبتدی';

  if (p.bossesDefeated >= 1) title += ' 🐉 اژدهاکش';
  return title;
}

// ==================== هیولاها ====================
const MONSTER_NAMES = [
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
  { name: 'دیو کوچک', emoji: '👹' },
];

const BOSSES = [
  { name: 'اژدهای سیاه', emoji: '🐲' },
  { name: 'لیچ پادشاه', emoji: '👑' },
  { name: 'دیو آتشین کوهستان', emoji: '🌋' },
];

const BOSS_CHANCE = 0.08;

function generateMonster(playerLevel) {
  const lvl = Math.max(1, playerLevel);
  const isBoss = Math.random() < BOSS_CHANCE;
  const pool = isBoss ? BOSSES : MONSTER_NAMES;
  const base = pool[Math.floor(Math.random() * pool.length)];
  const scale = 0.85 + Math.random() * 0.35;
  const hpMul = isBoss ? 1.7 : 1;
  const atkMul = isBoss ? 1.3 : 1;
  const defMul = isBoss ? 1.25 : 1;
  return {
    ...base,
    isBoss,
    hp: Math.round((20 + lvl * 6.5) * scale * hpMul),
    atk: Math.round((6 + lvl * 2.2) * scale * atkMul),
    def: Math.round((2.5 + lvl * 0.9) * scale * defMul),
    xpReward: Math.round((14 + lvl * 5) * scale * (isBoss ? 3.5 : 1)),
    goldReward: Math.round((9 + lvl * 4) * scale * (isBoss ? 4 : 1)),
  };
}

function simulateFight(p, monster) {
  let playerHp = p.currentHp;
  let monsterHp = monster.hp;
  const log = [];
  const pAtk = effectiveAtk(p);
  const pDef = effectiveDef(p);
  const critChance = effectiveCritChance(p);
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

  if (!won && p.activeEffects.revive && playerHp <= 0) {
    won = true;
    revived = true;
    playerHp = Math.round(p.maxHp * 0.3);
  }

  // به‌روزرسانی currentHp
  p.currentHp = Math.max(0, playerHp);

  return { won, log, remainingHp: Math.max(0, playerHp), revived, isBoss: monster.isBoss };
}

// ==================== فروشگاه ====================
const RARITY_LABEL = {
  common: 'عادی',
  rare: '🔷 کمیاب',
  epic: '🟣 حماسی',
  legendary: '🟡 افسانه‌ای',
  mythic: '🔥 اسطوره‌ای',
};

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
  { id: 'c1', label: '🧪 معجون سلامتی', type: 'consumable', effect: 'heal', price: 15, desc: '۴۰٪ سلامتی رو بازیابی می‌کنه' },
  { id: 'c2', label: '💥 معجون قدرت', type: 'consumable', effect: 'power', price: 25, desc: 'نبرد بعدی ۵۰٪ حمله‌ی بیشتر' },
  { id: 'c3', label: '🍀 طلسم شانس', type: 'consumable', effect: 'luck', price: 25, desc: 'نبرد بعدی شانس کریتیکال بیشتر' },
  { id: 'c4', label: '✨ سنگ احیا', type: 'consumable', effect: 'revive', price: 60, desc: 'اگر می‌باختی یک‌بار نجات پیدا می‌کنی' },
];

const SHOP_ITEMS = [...WEAPONS, ...ARMORS, ...CONSUMABLES];

function shopItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

// ==================== کمک‌های نمایشی ====================
function xpBar(p) {
  const need = xpForNextLevel(p.level);
  const filled = Math.min(10, Math.round((p.xp / need) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` (${p.xp}/${need})`;
}

function profileCard(p) {
  const cls = CLASSES[p.classKey];
  const weapon = shopItemById(p.equippedWeapon);
  const armor = shopItemById(p.equippedArmor);
  return (
    `${cls.emoji} *${p.name}* — ${cls.label}\n` +
    `${computeTitle(p)}\n\n` +
    `📊 سطح: *${p.level}*\n` +
    `✨ تجربه: ${xpBar(p)}\n` +
    `❤️ سلامتی: ${p.currentHp}/${p.maxHp}\n` +
    `💪 حمله: ${effectiveAtk(p)}${weapon ? ` (${weapon.label})` : ' (بدون سلاح)'}\n` +
    `🛡 دفاع: ${effectiveDef(p)}${armor ? ` (${armor.label})` : ' (بدون زره)'}\n` +
    `💰 طلا: ${p.gold}\n\n` +
    `📈 بردها: ${p.wins} | باخت‌ها: ${p.losses} | باس‌های شکست‌خورده: ${p.bossesDefeated}`
  );
}

// ==================== راه‌اندازی ربات ====================
if (!process.env.BOT_TOKEN) {
  console.error('❌ متغیر محیطی BOT_TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ==================== منوی اصلی (پنل رنگی) ====================
function mainMenuKeyboard() {
  return kb([
    [sbtn('👤 پروفایل', 'menu_profile', 'primary'), sbtn('🎒 کوله‌پشتی', 'menu_inventory', 'primary')],
    [sbtn('⚔️ نبرد', 'menu_fight', 'danger'), sbtn('🎁 جایزه روزانه', 'menu_daily', 'success')],
    [sbtn('🏪 فروشگاه', 'menu_shop', 'primary'), sbtn('🏆 رتبه‌بندی', 'menu_leaderboard', 'primary')],
    [sbtn('❓ راهنما', 'menu_help', 'primary')],
  ]);
}

async function sendMainMenu(ctx) {
  await ctx.reply('🗡 *منوی افسانه‌ی گروه*\n\nیکی از گزینه‌ها رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
  });
}

// ==================== منطق مشترک بین دستور و دکمه ====================

async function doProfile(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');
  await ctx.reply(profileCard(p), { parse_mode: 'Markdown' });
}

async function doInventory(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  if (p.inventory.length === 0) {
    return ctx.reply('🎒 کوله‌پشتیت خالیه. برو به فروشگاه یه چیزی بخر!');
  }

  const lines = p.inventory.map((id) => {
    const item = shopItemById(id);
    if (!item) return `\`${id}\` — آیتم نامشخص`;
    let tag = '';
    if (item.type === 'weapon' && p.equippedWeapon === id) tag = ' ✅ تجهیزشده';
    if (item.type === 'armor' && p.equippedArmor === id) tag = ' ✅ تجهیزشده';
    return `\`${id}\` — ${item.label}${tag}`;
  });

  await ctx.reply(
    '🎒 *کوله‌پشتی تو*\n\n' + lines.join('\n') + '\n\nتجهیز با: `/equip <id>`',
    { parse_mode: 'Markdown' }
  );
}

async function doFight(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  // بررسی افکت‌های فعال
  let effectsMsg = '';
  if (p.activeEffects.power) effectsMsg += '💥 قدرت ۱.۵× فعال\n';
  if (p.activeEffects.luck) effectsMsg += '🍀 شانس کریت بیشتر\n';
  if (p.activeEffects.revive) effectsMsg += '✨ سنگ احیا همراهته\n';
  if (effectsMsg) {
    await ctx.reply(`✨ *افکت‌های فعال:*\n${effectsMsg}`, { parse_mode: 'Markdown' });
  }

  const monster = generateMonster(p.level);
  const result = simulateFight(p, monster);

  const introEmoji = monster.isBoss ? '👑💀 *یک باس ظاهر شد!* 💀👑' : `${monster.emoji}`;
  let text = `${introEmoji} یک *${monster.name}* سر راهت ظاهر شد!\n\n`;
  
  // نمایش لاگ‌های نبرد (حداکثر ۱۰ تا)
  const displayLog = result.log.slice(0, 10);
  text += displayLog.join('\n');
  if (result.log.length > 10) {
    text += `\n... و ${result.log.length - 10} حرکت دیگه`;
  }
  text += '\n\n';

  if (result.won) {
    p.xp += monster.xpReward;
    p.gold += monster.goldReward;
    p.wins += 1;
    if (monster.isBoss) p.bossesDefeated += 1;
    const levelsGained = applyLevelUps(p);

    if (result.revived) {
      text += `✨ سنگ احیا فعال شد و در آخرین لحظه نجات پیدا کردی!\n`;
    }
    text += `✅ *پیروز شدی!* +${monster.xpReward} تجربه، +${monster.goldReward} طلا\n`;
    if (monster.isBoss) text += `🐉 *باس شکست خورد!* عنوان اژدهاکش رو گرفتی!\n`;
    if (levelsGained.length > 0) {
      text += `\n🎊 *سطح جدید: ${levelsGained[levelsGained.length - 1]}!* آمارت افزایش پیدا کرد.`;
    }
  } else {
    p.losses += 1;
    const goldLost = Math.min(p.gold, Math.round(monster.goldReward * 0.5));
    p.gold -= goldLost;
    text += `☠️ *شکست خوردی...* ${goldLost > 0 ? `و ${goldLost} طلا از دست دادی.` : ''}`;
  }

  // پاک کردن افکت‌های موقت
  p.activeEffects = { power: false, luck: false, revive: false };

  savePlayer(ctx, p);
  
  // دکمه‌های بعد از نبرد
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('⚔️ دوباره بجنگ!', 'menu_fight', 'danger')],
      [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
    ])
  });
}

async function doDaily(ctx) {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;
  const remaining = p.lastDaily + cooldown - now;

  if (remaining > 0) {
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    return ctx.reply(`⏳ جایزه‌ی روزانه رو قبلاً گرفتی. حدود ${hours} ساعت دیگه دوباره سر بزن.`);
  }

  const streakBroken = now - p.lastDaily > cooldown * 2;
  p.dailyStreak = streakBroken ? 1 : p.dailyStreak + 1;
  if (p.lastDaily === 0) p.dailyStreak = 1;

  const streakMultiplier = 1 + Math.min(p.dailyStreak - 1, 9) * 0.1;
  const goldReward = Math.round((20 + p.level * 3) * streakMultiplier);
  const xpReward = Math.round((10 + p.level * 2) * streakMultiplier);

  p.gold += goldReward;
  p.xp += xpReward;
  p.lastDaily = now;
  const levelsGained = applyLevelUps(p);
  savePlayer(ctx, p);

  let text =
    `🎁 جایزه‌ی روزانه: +${goldReward} طلا، +${xpReward} تجربه!\n` +
    `🔥 استریک: ${p.dailyStreak} روز متوالی (ضریب ${streakMultiplier.toFixed(1)}×)`;
  if (levelsGained.length > 0) {
    text += `\n🎊 سطح جدید: ${levelsGained[levelsGained.length - 1]}!`;
  }
  await ctx.reply(text);
}

function shopCategoryKeyboard() {
  return kb([
    [sbtn('🗡 سلاح‌ها', 'shop_weapons', 'primary'), sbtn('🛡 زره‌ها', 'shop_armors', 'primary')],
    [sbtn('🧪 معجون‌ها', 'shop_consumables', 'primary')],
    [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

async function doShopMenu(ctx) {
  await ctx.reply('🏪 *فروشگاه افسانه‌ی گروه*\n\nیک دسته انتخاب کن:', {
    parse_mode: 'Markdown',
    ...shopCategoryKeyboard(),
  });
}

function itemButtonRow(item) {
  return [sbtn(`${item.label} — 💰${item.price}`, `buy_${item.id}`, 'success')];
}

async function showShopCategory(ctx, items, title) {
  const rows = items.map(itemButtonRow);
  rows.push([sbtn('« بازگشت به فروشگاه', 'menu_shop', 'primary')]);
  const desc = items
    .map((i) => `${i.label}${i.rarity ? ` [${RARITY_LABEL[i.rarity]}]` : ''}${i.desc ? ` — ${i.desc}` : ''}`)
    .join('\n');
  await ctx.reply(`${title}\n\n${desc}`, { parse_mode: 'Markdown', ...kb(rows) });
}

async function doLeaderboard(ctx, category = 'level') {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p);

  if (chatPlayers.length === 0) {
    return ctx.reply('هنوز کسی تو این گروه شخصیت نساخته. اولین نفر باش! /start');
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
    const cls = CLASSES[p.classKey];
    let statText;
    if (category === 'gold') statText = `💰${p.gold}`;
    else if (category === 'wins') statText = `⚔️${p.wins} برد`;
    else statText = `سطح ${p.level}`;
    return `${rank} ${cls.emoji} *${p.name}* — ${statText}`;
  });

  await ctx.reply(`🏆 *رتبه‌بندی گروه* (${label})\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    ...kb([
      [
        sbtn('📊 سطح', 'lb_level', category === 'level' ? 'success' : 'primary'),
        sbtn('💰 طلا', 'lb_gold', category === 'gold' ? 'success' : 'primary'),
        sbtn('⚔️ بردها', 'lb_wins', category === 'wins' ? 'success' : 'primary'),
      ],
    ]),
  });
}

async function doHelp(ctx) {
  await ctx.reply(
    '🗡 *راهنمای افسانه‌ی گروه*\n\n' +
      '/menu — باز کردن پنل اصلی (دکمه‌ای)\n' +
      '/start — شروع و ساخت شخصیت\n' +
      '/pick <warrior|mage|archer> — انتخاب کلاس\n' +
      '/profile — کارت شخصیت\n' +
      '/fight — نبرد با هیولای تصادفی (شانس کم ظهور باس!)\n' +
      '/shop — فروشگاه (سلاح/زره/معجون)\n' +
      '/buy <id> — خرید آیتم\n' +
      '/inventory — کوله‌پشتی\n' +
      '/equip <id> — تجهیز سلاح یا زره\n' +
      '/use <id> — مصرف معجون (اثر تا نبرد بعدی)\n' +
      '/daily — جایزه‌ی روزانه (با پاداش استریک)\n' +
      '/leaderboard — رتبه‌بندی گروه',
    { parse_mode: 'Markdown' }
  );
}

// ==================== دستورات متنی ====================

bot.command('start', async (ctx) => {
  const existing = getPlayer(ctx);
  if (existing) {
    return ctx.reply(`تو قبلاً شخصیت ساختی!\n\n${profileCard(existing)}`, { parse_mode: 'Markdown' });
  }
  await ctx.reply(
    '🗡 به *افسانه‌ی گروه* خوش اومدی!\n\n' +
      'یک کلاس برای شخصیتت انتخاب کن:\n\n' +
      '⚔️ *جنگجو* — سلامتی و دفاع بالا\n' +
      '🔮 *جادوگر* — قدرت حمله‌ی بالا، سلامتی کم\n' +
      '🏹 *تیرانداز* — متعادل\n\n' +
      '`/pick warrior` یا `/pick mage` یا `/pick archer`',
    { parse_mode: 'Markdown' }
  );
});

bot.command('pick', async (ctx) => {
  if (getPlayer(ctx)) return ctx.reply('تو قبلاً شخصیت داری!');
  const classKey = ctx.message.text.trim().split(/\s+/)[1];
  if (!CLASSES[classKey]) {
    return ctx.reply('کلاس نامعتبره: `/pick warrior`, `/pick mage`, `/pick archer`', { parse_mode: 'Markdown' });
  }
  const p = createPlayer(ctx, classKey);
  savePlayer(ctx, p);
  await ctx.reply(`🎉 شخصیتت ساخته شد!\n\n${profileCard(p)}`, { parse_mode: 'Markdown' });
  await sendMainMenu(ctx);
});

bot.command('menu', sendMainMenu);
bot.command('profile', doProfile);
bot.command('inventory', doInventory);
bot.command('fight', doFight);
bot.command('daily', doDaily);
bot.command('shop', doShopMenu);
bot.command('help', doHelp);
bot.command('leaderboard', (ctx) => doLeaderboard(ctx, 'level'));

bot.command('buy', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');
  const itemId = ctx.message.text.trim().split(/\s+/)[1];
  await handleBuy(ctx, p, itemId);
});

bot.command('equip', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');
  const itemId = ctx.message.text.trim().split(/\s+/)[1];
  await handleEquip(ctx, p, itemId);
});

bot.command('use', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');
  const itemId = ctx.message.text.trim().split(/\s+/)[1];
  await handleUse(ctx, p, itemId);
});

// ==================== منطق خرید / تجهیز / مصرف (مشترک) ====================

async function handleBuy(ctx, p, itemId) {
  const item = shopItemById(itemId);
  if (!item) return ctx.reply('همچین آیتمی تو فروشگاه نیست.');
  if (p.gold < item.price) {
    return ctx.reply(`طلای کافی نداری. قیمت: ${item.price}، موجودی تو: ${p.gold}`);
  }
  p.gold -= item.price;
  p.inventory.push(item.id);
  savePlayer(ctx, p);
  const hint = item.type === 'consumable' ? `مصرف با: /use ${item.id}` : `تجهیز با: /equip ${item.id}`;
  await ctx.reply(`✅ *${item.label}* خریداری شد!\n${hint}`, { parse_mode: 'Markdown' });
}

async function handleEquip(ctx, p, itemId) {
  if (!p.inventory.includes(itemId)) return ctx.reply('این آیتم رو تو کوله‌پشتیت نداری.');
  const item = shopItemById(itemId);
  if (!item || (item.type !== 'weapon' && item.type !== 'armor')) {
    return ctx.reply('فقط سلاح و زره قابل تجهیزن.');
  }
  if (item.type === 'weapon') p.equippedWeapon = itemId;
  else p.equippedArmor = itemId;
  savePlayer(ctx, p);
  await ctx.reply(`✅ *${item.label}* تجهیز شد!`, { parse_mode: 'Markdown' });
}

async function handleUse(ctx, p, itemId) {
  if (!p.inventory.includes(itemId)) return ctx.reply('این آیتم رو تو کوله‌پشتیت نداری.');
  const item = shopItemById(itemId);
  if (!item || item.type !== 'consumable') return ctx.reply('این آیتم قابل مصرف نیست.');

  p.inventory.splice(p.inventory.indexOf(itemId), 1);
  
  if (item.effect === 'heal') {
    const healAmount = Math.round(p.maxHp * 0.4);
    p.currentHp = Math.min(p.maxHp, p.currentHp + healAmount);
  } else if (item.effect === 'power') {
    p.activeEffects.power = true;
  } else if (item.effect === 'luck') {
    p.activeEffects.luck = true;
  } else if (item.effect === 'revive') {
    p.activeEffects.revive = true;
  }
  
  savePlayer(ctx, p);
  await ctx.reply(`✅ *${item.label}* مصرف شد! اثرش تا نبرد بعدی فعاله.`, { parse_mode: 'Markdown' });
}

// ==================== اکشن‌های دکمه‌های شیشه‌ای ====================

bot.action('menu_main', async (ctx) => {
  await ctx.answerCbQuery();
  await sendMainMenu(ctx);
});

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
  await doLeaderboard(ctx, 'level'); 
});

bot.action('menu_help', async (ctx) => { 
  await ctx.answerCbQuery(); 
  await doHelp(ctx); 
});

bot.action('shop_weapons', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, WEAPONS, '🗡 *سلاح‌ها*');
});

bot.action('shop_armors', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, ARMORS, '🛡 *زره‌ها*');
});

bot.action('shop_consumables', async (ctx) => {
  await ctx.answerCbQuery();
  await showShopCategory(ctx, CONSUMABLES, '🧪 *معجون‌ها*');
});

bot.action(/^buy_(.+)$/, async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول باید شخصیت بسازی: /start', { show_alert: true });
    return;
  }
  const itemId = ctx.match[1];
  await ctx.answerCbQuery();
  await handleBuy(ctx, p, itemId);
});

bot.action(/^lb_(level|gold|wins)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await doLeaderboard(ctx, ctx.match[1]);
});

bot.catch((err, ctx) => {
  console.error(`❌ خطای مدیریت‌نشده در آپدیت نوع ${ctx.updateType}:`, err.message);
});

bot.launch();
console.log('🗡 ربات افسانه‌ی گروه (نسخه ۲) شروع شد!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
