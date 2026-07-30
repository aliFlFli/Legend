/**
 * 🗡 افسانه‌ی گروه (نسخه ۳) — ربات RPG کاملاً کیبوردی
 * تمام عملیات از طریق دکمه‌های شیشه‌ای انجام میشه
 */

const fs = require('fs');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

const DATA_PATH = path.join(__dirname, 'players.json');

// ==================== ذخیره‌سازی ====================
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

// ==================== دکمه‌ها ====================
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
  warrior: { label: '⚔️ جنگجو', hp: 40, atk: 8, def: 5, emoji: '⚔️', desc: 'سلامتی و دفاع بالا' },
  mage: { label: '🔮 جادوگر', hp: 26, atk: 12, def: 2, emoji: '🔮', desc: 'قدرت حمله‌ی بالا' },
  archer: { label: '🏹 تیرانداز', hp: 32, atk: 10, def: 3, emoji: '🏹', desc: 'متعادل' },
};

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

// ==================== عنوان‌ها ====================
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
  const scale = 0.5 + (playerLevel * 0.05) + Math.random() * 0.2;
  const hpMul = isBoss ? 1.5 : 1;
  const atkMul = isBoss ? 1.2 : 1;
  const defMul = isBoss ? 1.15 : 1;
  
  let atk = Math.round((5 + lvl * 1.8) * scale * atkMul);
  let hp = Math.round((15 + lvl * 5) * scale * hpMul);
  let def = Math.round((2 + lvl * 0.7) * scale * defMul);
  
  if (playerLevel < 3) {
    atk = Math.min(atk, 10);
    hp = Math.min(hp, 25);
    def = Math.min(def, 4);
  }
  
  return {
    ...base,
    isBoss,
    hp,
    atk,
    def,
    xpReward: Math.round((12 + lvl * 4) * scale * (isBoss ? 3 : 1)),
    goldReward: Math.round((15 + lvl * 5) * scale * (isBoss ? 3.5 : 1)),
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
  { id: 'c1', label: '🧪 معجون سلامتی', type: 'consumable', effect: 'heal', price: 15, desc: '۴۰٪ سلامتی' },
  { id: 'c2', label: '💥 معجون قدرت', type: 'consumable', effect: 'power', price: 25, desc: '۵۰٪ حمله بیشتر' },
  { id: 'c3', label: '🍀 طلسم شانس', type: 'consumable', effect: 'luck', price: 25, desc: 'شانس کریتیکال' },
  { id: 'c4', label: '✨ سنگ احیا', type: 'consumable', effect: 'revive', price: 60, desc: 'یک‌بار نجات' },
];

const SHOP_ITEMS = [...WEAPONS, ...ARMORS, ...CONSUMABLES];

function shopItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

// ==================== نمایشی ====================
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
    `💪 حمله: ${effectiveAtk(p)}${weapon ? ` (${weapon.label})` : ''}\n` +
    `🛡 دفاع: ${effectiveDef(p)}${armor ? ` (${armor.label})` : ''}\n` +
    `💰 طلا: ${p.gold}\n\n` +
    `📈 بردها: ${p.wins} | باخت‌ها: ${p.losses} | باس: ${p.bossesDefeated}`
  );
}

// ==================== راه‌اندازی ربات ====================
if (!process.env.BOT_TOKEN) {
  console.error('❌ متغیر محیطی BOT_TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ==================== منوهای اصلی ====================

// منوی انتخاب کلاس
function classSelectionKeyboard() {
  return kb([
    [sbtn('⚔️ جنگجو — سلامتی بالا', 'pick_warrior', 'primary')],
    [sbtn('🔮 جادوگر — حمله بالا', 'pick_mage', 'primary')],
    [sbtn('🏹 تیرانداز — متعادل', 'pick_archer', 'primary')],
  ]);
}

// منوی اصلی
function mainMenuKeyboard() {
  return kb([
    [sbtn('👤 پروفایل', 'menu_profile', 'primary'), sbtn('🎒 کوله‌پشتی', 'menu_inventory', 'primary')],
    [sbtn('⚔️ نبرد', 'menu_fight', 'danger'), sbtn('🎁 جایزه روزانه', 'menu_daily', 'success')],
    [sbtn('🏪 فروشگاه', 'menu_shop', 'primary'), sbtn('🏆 رتبه‌بندی', 'menu_leaderboard', 'primary')],
    [sbtn('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success'), sbtn('❓ راهنما', 'menu_help', 'primary')],
  ]);
}

// ==================== منوی کوله‌پشتی ====================
function inventoryKeyboard(p) {
  if (!p || p.inventory.length === 0) {
    return kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]]);
  }
  
  const rows = [];
  // دکمه‌های آیتم‌ها (حداکثر ۸ تا در هر ردیف)
  for (let i = 0; i < p.inventory.length; i += 2) {
    const row = [];
    const id1 = p.inventory[i];
    const item1 = shopItemById(id1);
    if (item1) {
      const label1 = item1.type === 'weapon' ? '🗡' : item1.type === 'armor' ? '🛡' : '🧪';
      const equipped = (p.equippedWeapon === id1 || p.equippedArmor === id1) ? '✅' : '';
      row.push(sbtn(`${label1} ${item1.label.slice(0, 8)}${equipped}`, `inv_item_${id1}`, 'primary'));
    }
    
    if (i + 1 < p.inventory.length) {
      const id2 = p.inventory[i + 1];
      const item2 = shopItemById(id2);
      if (item2) {
        const label2 = item2.type === 'weapon' ? '🗡' : item2.type === 'armor' ? '🛡' : '🧪';
        const equipped = (p.equippedWeapon === id2 || p.equippedArmor === id2) ? '✅' : '';
        row.push(sbtn(`${label2} ${item2.label.slice(0, 8)}${equipped}`, `inv_item_${id2}`, 'primary'));
      }
    }
    rows.push(row);
  }
  
  rows.push([sbtn('« بازگشت به منو', 'menu_main', 'primary')]);
  return kb(rows);
}

// منوی اقدامات روی آیتم
function itemActionKeyboard(itemId) {
  const item = shopItemById(itemId);
  if (!item) return mainMenuKeyboard();
  
  const rows = [];
  if (item.type === 'weapon' || item.type === 'armor') {
    rows.push([sbtn('⚙️ تجهیز', `equip_${itemId}`, 'success')]);
  }
  if (item.type === 'consumable') {
    rows.push([sbtn('🧪 مصرف', `use_${itemId}`, 'success')]);
  }
  rows.push([sbtn('💰 فروش (۶۰٪ قیمت)', `sell_${itemId}`, 'danger')]);
  rows.push([sbtn('« بازگشت به کوله', 'menu_inventory', 'primary')]);
  return kb(rows);
}

// ==================== منوی فروشگاه ====================
function shopCategoryKeyboard() {
  return kb([
    [sbtn('🗡 سلاح‌ها', 'shop_weapons', 'primary'), sbtn('🛡 زره‌ها', 'shop_armors', 'primary')],
    [sbtn('🧪 معجون‌ها', 'shop_consumables', 'primary')],
    [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

function shopItemsKeyboard(items, category) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const row = [];
    const item1 = items[i];
    row.push(sbtn(`${item1.label} 💰${item1.price}`, `buy_${item1.id}`, 'success'));
    
    if (i + 1 < items.length) {
      const item2 = items[i + 1];
      row.push(sbtn(`${item2.label} 💰${item2.price}`, `buy_${item2.id}`, 'success'));
    }
    rows.push(row);
  }
  rows.push([sbtn('« بازگشت به فروشگاه', 'menu_shop', 'primary')]);
  return kb(rows);
}

// ==================== منوی رتبه‌بندی ====================
function leaderboardKeyboard(currentCategory) {
  return kb([
    [
      sbtn('📊 سطح', 'lb_level', currentCategory === 'level' ? 'success' : 'primary'),
      sbtn('💰 طلا', 'lb_gold', currentCategory === 'gold' ? 'success' : 'primary'),
      sbtn('⚔️ بردها', 'lb_wins', currentCategory === 'wins' ? 'success' : 'primary'),
    ],
    [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
  ]);
}

// ==================== توابع اصلی ====================

async function sendMainMenu(ctx) {
  await ctx.reply('🗡 *منوی افسانه‌ی گروه*\n\nیکی از گزینه‌ها رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...mainMenuKeyboard(),
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
    ...kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]])
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
      ...kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]])
    });
    return;
  }

  await ctx.reply('🎒 *کوله‌پشتی تو*\n\nروی هر آیتم کلیک کن:', {
    parse_mode: 'Markdown',
    ...inventoryKeyboard(p),
  });
}

async function doFight(ctx) {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.reply('هنوز شخصیت نساختی!', { ...classSelectionKeyboard() });
    return;
  }

  if (p.currentHp <= 0) {
    await ctx.reply('💀 *سلامتی‌ات تموم شده!*\nاز دکمه‌ی بهبودی استفاده کن یا جایزه‌ی روزانه بگیر.', {
      parse_mode: 'Markdown',
      ...kb([
        [sbtn('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success')],
        [sbtn('🎁 جایزه روزانه', 'menu_daily', 'primary')],
        [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
      ])
    });
    return;
  }

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
  
  const displayLog = result.log.slice(0, 10);
  text += displayLog.join('\n');
  if (result.log.length > 10) {
    text += `\n... و ${result.log.length - 10} حرکت دیگه`;
  }
  text += '\n\n';

  if (result.won) {
    const bonusGold = Math.round(monster.goldReward * (1 + Math.random() * 0.3));
    p.xp += monster.xpReward;
    p.gold += bonusGold;
    p.wins += 1;
    if (monster.isBoss) p.bossesDefeated += 1;
    const levelsGained = applyLevelUps(p);

    if (result.revived) text += `✨ سنگ احیا فعال شد!\n`;
    text += `✅ *پیروز شدی!* +${monster.xpReward} تجربه، +${bonusGold} طلا\n`;
    if (monster.isBoss) text += `🐉 *باس شکست خورد!*\n`;
    if (levelsGained.length > 0) {
      text += `\n🎊 *سطح ${levelsGained[levelsGained.length - 1]}!*`;
    }
  } else {
    p.losses += 1;
    const consolationXp = Math.round(monster.xpReward * 0.3);
    const consolationGold = Math.round(monster.goldReward * 0.2);
    p.xp += consolationXp;
    p.gold += consolationGold;
    
    const penalty = Math.min(p.gold, Math.round(monster.goldReward * 0.05));
    p.gold -= penalty;
    if (p.gold < 10) p.gold = 10;
    
    text += `☠️ *شکست خوردی...*\n`;
    text += `💫 ${consolationXp} تجربه و ${consolationGold} طلا دلداری!\n`;
    if (penalty > 0) text += `💸 ${penalty} طلا از دست دادی.`;
  }

  p.activeEffects = { power: false, luck: false, revive: false };
  savePlayer(ctx, p);
  
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('⚔️ دوباره بجنگ!', 'menu_fight', 'danger')],
      [sbtn('💚 بهبودی (۲۰ طلا)', 'menu_heal', 'success'), sbtn('« منو', 'menu_main', 'primary')]
    ])
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
  const remaining = p.lastDaily + cooldown - now;

  if (remaining > 0) {
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    await ctx.reply(`⏳ ${hours} ساعت دیگه`, {
      ...kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]])
    });
    return;
  }

  const streakBroken = now - p.lastDaily > cooldown * 2;
  p.dailyStreak = streakBroken ? 1 : p.dailyStreak + 1;
  if (p.lastDaily === 0) p.dailyStreak = 1;

  const streakMultiplier = 1 + Math.min(p.dailyStreak - 1, 9) * 0.15;
  const goldReward = Math.round((50 + p.level * 8) * streakMultiplier);
  const xpReward = Math.round((30 + p.level * 5) * streakMultiplier);
  
  let bonus = '';
  if (Math.random() < 0.15) {
    const bonusGold = Math.round(goldReward * 0.5);
    p.gold += bonusGold;
    bonus = `\n🎉 *جایزه‌ی ویژه!* +${bonusGold} طلا!`;
  }

  p.gold += goldReward;
  p.xp += xpReward;
  p.lastDaily = now;
  p.currentHp = p.maxHp;
  const levelsGained = applyLevelUps(p);
  savePlayer(ctx, p);

  let text =
    `🎁 *جایزه‌ی روزانه*\n` +
    `💰 +${goldReward} طلا\n` +
    `✨ +${xpReward} تجربه\n` +
    `🔥 استریک: ${p.dailyStreak} روز (×${streakMultiplier.toFixed(1)})`;
  if (bonus) text += bonus;
  if (levelsGained.length > 0) text += `\n🎊 سطح ${levelsGained[levelsGained.length - 1]}!`;
  text += '\n💚 سلامتی کامل شد!';
  
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('⚔️ برو نبرد!', 'menu_fight', 'danger')],
      [sbtn('« بازگشت به منو', 'menu_main', 'primary')]
    ])
  });
}

async function doShopMenu(ctx) {
  await ctx.reply('🏪 *فروشگاه*\n\nدسته‌بندی رو انتخاب کن:', {
    parse_mode: 'Markdown',
    ...shopCategoryKeyboard(),
  });
}

async function showShopCategory(ctx, items, title) {
  await ctx.reply(`🏪 *${title}*\n\nروی آیتم کلیک کن تا بخری:`, {
    parse_mode: 'Markdown',
    ...shopItemsKeyboard(items, title),
  });
}

async function doLeaderboard(ctx, category = 'level') {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p);

  if (chatPlayers.length === 0) {
    await ctx.reply('هنوز کسی تو این گروه شخصیت نساخته.', {
      ...kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]])
    });
    return;
  }

  let sorted, label;
  if (category === 'gold') {
    sorted = [...chatPlayers].sort((a, b) => b.gold - a.gold);
    label = '💰 طلا';
  } else if (category === 'wins') {
    sorted = [...chatPlayers].sort((a, b) => b.wins - a.wins);
    label = '⚔️ بردها';
  } else {
    sorted = [...chatPlayers].sort((a, b) => b.level - a.level || b.xp - a.xp);
    label = '📊 سطح';
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

  await ctx.reply(`🏆 *رتبه‌بندی* (${label})\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    ...leaderboardKeyboard(category),
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
    '🏆 رتبه‌بندی — ببین کی قوی‌تره\n\n' +
    '💡 نکته: هر روز جایزه بگیر تا استریک‌ات قوی‌تر بشه!',
    {
      parse_mode: 'Markdown',
      ...kb([[sbtn('« بازگشت به منو', 'menu_main', 'primary')]])
    }
  );
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

// منوهای اصلی
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

// بهبودی
bot.action('menu_heal', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) {
    await ctx.answerCbQuery('اول شخصیت بساز!', { show_alert: true });
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
  
  await ctx.answerCbQuery('💚 سلامتی کامل شد!');
  await ctx.reply(`💚 *سلامتی کامل شد!*\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('⚔️ برو نبرد!', 'menu_fight', 'danger')],
      [sbtn('« منو', 'menu_main', 'primary')]
    ])
  });
});

// فروشگاه
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
    await ctx.answerCbQuery(`طلای کافی نداری! (${item.price} طلا نیازه)`, { show_alert: true });
    return;
  }
  
  p.gold -= item.price;
  p.inventory.push(item.id);
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${item.label} خریداری شد!`);
  await ctx.reply(`✅ *${item.label}* خریداری شد!\n💰 ${p.gold} طلا مونده.`, {
    parse_mode: 'Markdown',
    ...kb([
      [sbtn('🎒 رفتن به کوله', 'menu_inventory', 'primary')],
      [sbtn('« ادامه خرید', 'menu_shop', 'primary')]
    ])
  });
});

// آیتم‌های کوله
bot.action(/^inv_item_(.+)$/, async (ctx) => {
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
  
  const item = shopItemById(itemId);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  
  await ctx.answerCbQuery();
  await ctx.reply(`📦 *${item.label}*\n\n` +
    `نوع: ${item.type === 'weapon' ? '🗡 سلاح' : item.type === 'armor' ? '🛡 زره' : '🧪 معجون'}\n` +
    `${item.rarity ? `کیفیت: ${RARITY_LABEL[item.rarity]}\n` : ''}` +
    `${item.atkBonus ? `💪 حمله: +${item.atkBonus}\n` : ''}` +
    `${item.defBonus ? `🛡 دفاع: +${item.defBonus}\n` : ''}` +
    `${item.desc ? `📝 ${item.desc}\n` : ''}` +
    `💰 قیمت فروش: ${Math.round(item.price * 0.6)} طلا\n\n` +
    `چکار می‌خوای باهاش کنی؟`,
    {
      parse_mode: 'Markdown',
      ...itemActionKeyboard(itemId)
    }
  );
});

// تجهیز
bot.action(/^equip_(.+)$/, async (ctx) => {
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
  
  const item = shopItemById(itemId);
  if (!item || (item.type !== 'weapon' && item.type !== 'armor')) {
    await ctx.answerCbQuery('فقط سلاح و زره قابل تجهیزن!', { show_alert: true });
    return;
  }
  
  if (item.type === 'weapon') p.equippedWeapon = itemId;
  else p.equippedArmor = itemId;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`✅ ${item.label} تجهیز شد!`);
  await ctx.reply(`✅ *${item.label}* تجهیز شد!`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت به کوله', 'menu_inventory', 'primary')]])
  });
});

// مصرف
bot.action(/^use_(.+)$/, async (ctx) => {
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
  
  const item = shopItemById(itemId);
  if (!item || item.type !== 'consumable') {
    await ctx.answerCbQuery('این آیتم قابل مصرف نیست!', { show_alert: true });
    return;
  }
  
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
  await ctx.answerCbQuery(`✅ ${item.label} مصرف شد!`);
  await ctx.reply(`✅ *${item.label}* مصرف شد!\nاثر تا نبرد بعدی فعاله.`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت به کوله', 'menu_inventory', 'primary')]])
  });
});

// فروش
bot.action(/^sell_(.+)$/, async (ctx) => {
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
  
  const item = shopItemById(itemId);
  if (!item) {
    await ctx.answerCbQuery('آیتم نامعتبر!', { show_alert: true });
    return;
  }
  
  const sellPrice = Math.round(item.price * 0.6);
  p.gold += sellPrice;
  p.inventory.splice(p.inventory.indexOf(itemId), 1);
  if (p.equippedWeapon === itemId) p.equippedWeapon = null;
  if (p.equippedArmor === itemId) p.equippedArmor = null;
  savePlayer(ctx, p);
  
  await ctx.answerCbQuery(`💰 ${item.label} به ${sellPrice} طلا فروخته شد!`);
  await ctx.reply(`💰 *${item.label}* رو به ${sellPrice} طلا فروختی!\n💰 موجودی جدید: ${p.gold} طلا`, {
    parse_mode: 'Markdown',
    ...kb([[sbtn('« بازگشت به کوله', 'menu_inventory', 'primary')]])
  });
});

// رتبه‌بندی
bot.action(/^lb_(level|gold|wins)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await doLeaderboard(ctx, ctx.match[1]);
});

// ==================== دستورات (فقط برای پشتیبانی) ====================
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
    '🗡 به *افسانه‌ی گروه* خوش اومدی!\n\n' +
    'یک کلاس برای شخصیتت انتخاب کن:\n\n' +
    '⚔️ جنگجو — سلامتی و دفاع بالا\n' +
    '🔮 جادوگر — قدرت حمله‌ی بالا\n' +
    '🏹 تیرانداز — متعادل',
    {
      parse_mode: 'Markdown',
      ...classSelectionKeyboard(),
    }
  );
});

bot.command('menu', sendMainMenu);

// Fallback برای هر چیز دیگه‌ای - منو رو نشون بده
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
console.log('🗡 ربات افسانه‌ی گروه (نسخه ۳ - کاملاً کیبوردی) شروع شد!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
