/**
 * 🗡 افسانه‌ی گروه — یک ربات RPG متنی برای گروه‌های تلگرام
 * ------------------------------------------------------------------
 * ایده: هر عضو گروه یک شخصیت می‌سازد، با هیولا می‌جنگد، تجربه و طلا
 * جمع می‌کند، سطح می‌گیرد، تجهیزات می‌خرد، و در لیدربورد گروه رقابت
 * می‌کند. کاملاً PvE (بدون جنگ بین بازیکن‌ها) — ساده، سریع، و برای
 * گروه‌های دوستانه طراحی شده.
 *
 * دستورات:
 *   /start        - ساخت شخصیت (انتخاب کلاس)
 *   /profile      - نمایش کارت شخصیت
 *   /fight        - رفتن به نبرد با یک هیولای تصادفی
 *   /shop         - دیدن فروشگاه
 *   /buy <id>     - خرید آیتم از فروشگاه
 *   /inventory    - دیدن کوله‌پشتی و تجهیز فعلی
 *   /equip <id>   - تجهیز کردن یک سلاح از کوله‌پشتی
 *   /daily        - جایزه‌ی روزانه (هر ۲۴ ساعت یک‌بار)
 *   /leaderboard  - رتبه‌بندی برترین‌های گروه
 *   /help         - راهنما
 *
 * ذخیره‌سازی: یک فایل JSON ساده (players.json)، هر بازیکن با کلید
 * `chatId:userId` تا هر گروه لیدربورد جدای خودش را داشته باشد.
 */

const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
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

function playerKey(ctx) {
  return `${ctx.chat.id}:${ctx.from.id}`;
}

function getPlayer(ctx) {
  return players[playerKey(ctx)] || null;
}

function savePlayer(ctx, p) {
  players[playerKey(ctx)] = p;
  savePlayers(players);
}

// ==================== تعریف کلاس‌های شخصیت ====================
const CLASSES = {
  warrior: { label: '⚔️ جنگجو', hp: 40, atk: 8, def: 5, emoji: '⚔️' },
  mage: { label: '🔮 جادوگر', hp: 26, atk: 12, def: 2, emoji: '🔮' },
  archer: { label: '🏹 تیرانداز', hp: 32, atk: 10, def: 3, emoji: '🏹' },
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
    baseAtk: base.atk,
    baseDef: base.def,
    equippedWeapon: null, // id سلاح تجهیزشده از inventory
    inventory: [], // آرایه‌ای از id آیتم‌ها
    lastDaily: 0, // timestamp آخرین دریافت جایزه روزانه
    createdAt: Date.now(),
  };
}

function xpForNextLevel(level) {
  return Math.round(30 * Math.pow(level, 1.5));
}

function effectiveAtk(p) {
  const weapon = SHOP_ITEMS.find((i) => i.id === p.equippedWeapon);
  return p.baseAtk + (weapon ? weapon.atkBonus : 0);
}

function effectiveDef(p) {
  return p.baseDef;
}

/**
 * بررسی و اعمال level up (ممکن است در یک نبرد چند سطح هم‌زمان بالا برود
 * اگر تجربه‌ی زیادی گرفته باشد؛ برای همین در یک حلقه چک می‌کنیم).
 * خروجی: آرایه‌ای از سطح‌هایی که در این فراخوانی کسب شده (برای پیام).
 */
function applyLevelUps(p) {
  const gained = [];
  while (p.xp >= xpForNextLevel(p.level)) {
    p.xp -= xpForNextLevel(p.level);
    p.level += 1;
    p.maxHp += 6;
    p.baseAtk += 2;
    p.baseDef += 1;
    gained.push(p.level);
  }
  return gained;
}

// ==================== هیولاها ====================
// هیولا بر اساس سطح بازیکن مقیاس می‌شود تا نبرد همیشه چالش معقولی داشته باشد.
const MONSTER_NAMES = [
  { name: 'گرگ جنگلی', emoji: '🐺' },
  { name: 'اسکلت سرگردان', emoji: '💀' },
  { name: 'عنکبوت غول‌پیکر', emoji: '🕷️' },
  { name: 'گابلین دزد', emoji: '👺' },
  { name: 'خفاش خون‌آشام', emoji: '🦇' },
  { name: 'اژدهای کوچک', emoji: '🐉' },
  { name: 'گولم سنگی', emoji: '🗿' },
  { name: 'روح سرگردان', emoji: '👻' },
];

function generateMonster(playerLevel) {
  const base = MONSTER_NAMES[Math.floor(Math.random() * MONSTER_NAMES.length)];
  // مقیاس‌دهی بر اساس سطح بازیکن؛ این ضرایب طوری تنظیم شده‌اند که در
  // سطوح پایین نبرد آسان و دلگرم‌کننده باشد (~۹۰-۹۸٪ برد)، ولی در سطوح
  // بالاتر بدون تجهیزات بهتر واقعاً چالش‌برانگیز شود (~۶۰-۷۲٪ برد) — این
  // باعث می‌شود خرید سلاح از فروشگاه یک انتخاب معنادار باشد، نه تزئینی.
  const scale = 0.85 + Math.random() * 0.35;
  const lvl = Math.max(1, playerLevel);
  return {
    ...base,
    hp: Math.round((20 + lvl * 6.5) * scale),
    atk: Math.round((6 + lvl * 2.2) * scale),
    def: Math.round((2.5 + lvl * 0.9) * scale),
    xpReward: Math.round((14 + lvl * 5) * scale),
    goldReward: Math.round((9 + lvl * 4) * scale),
  };
}

/**
 * شبیه‌سازی سریع نبرد نوبتی: بازیکن اول ضربه می‌زند، بعد هیولا، تا یکی
 * HP اش صفر شود یا سقف نوبت (برای جلوگیری از حلقه‌ی بی‌پایان) برسد.
 * خروجی شامل نتیجه (win/lose) و یک لاگ کوتاه متنی است.
 */
function simulateFight(p, monster) {
  let playerHp = p.maxHp;
  let monsterHp = monster.hp;
  const log = [];
  const pAtk = effectiveAtk(p);
  const pDef = effectiveDef(p);
  let round = 0;

  while (playerHp > 0 && monsterHp > 0 && round < 20) {
    round++;
    // ضربه بازیکن (با کمی تصادفی بودن ±20٪)
    const pDmg = Math.max(1, Math.round(pAtk * (0.8 + Math.random() * 0.4) - monster.def * 0.5));
    monsterHp -= pDmg;
    if (monsterHp <= 0) {
      log.push(`💥 ضربه‌ی نهایی تو ${pDmg} آسیب زد و ${monster.name} را شکست داد!`);
      break;
    }
    // ضربه هیولا
    const mDmg = Math.max(1, Math.round(monster.atk * (0.8 + Math.random() * 0.4) - pDef * 0.5));
    playerHp -= mDmg;
    if (round <= 3) {
      log.push(`تو ${pDmg} آسیب زدی، ${monster.name} ${mDmg} آسیب زد.`);
    }
  }

  const won = monsterHp <= 0 && playerHp > 0;
  return { won, log, remainingHp: Math.max(0, playerHp), rounds: round };
}

// ==================== فروشگاه ====================
const SHOP_ITEMS = [
  { id: 'sword1', label: '🗡 شمشیر آهنی', type: 'weapon', atkBonus: 4, price: 40 },
  { id: 'sword2', label: '⚔️ شمشیر نقره‌ای', type: 'weapon', atkBonus: 9, price: 120 },
  { id: 'sword3', label: '🔱 نیزه‌ی اژدها', type: 'weapon', atkBonus: 16, price: 300 },
  { id: 'potion', label: '🧪 معجون سلامتی (بازیابی کامل قبل از نبرد بعدی)', type: 'consumable', price: 15 },
];

function shopItemById(id) {
  return SHOP_ITEMS.find((i) => i.id === id);
}

// ==================== کمک‌های نمایشی ====================
function xpBar(p) {
  const need = xpForNextLevel(p.level);
  const filled = Math.round((p.xp / need) * 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled) + ` (${p.xp}/${need})`;
}

function profileCard(p) {
  const cls = CLASSES[p.classKey];
  const weapon = shopItemById(p.equippedWeapon);
  return (
    `${cls.emoji} *${p.name}* — ${cls.label}\n\n` +
    `📊 سطح: *${p.level}*\n` +
    `✨ تجربه: ${xpBar(p)}\n` +
    `❤️ سلامتی: ${p.maxHp}\n` +
    `💪 قدرت حمله: ${effectiveAtk(p)}${weapon ? ` (شامل ${weapon.label})` : ''}\n` +
    `🛡 دفاع: ${effectiveDef(p)}\n` +
    `💰 طلا: ${p.gold}`
  );
}

// ==================== راه‌اندازی ربات ====================
if (!process.env.BOT_TOKEN) {
  console.error('❌ متغیر محیطی BOT_TOKEN تنظیم نشده است.');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', async (ctx) => {
  const existing = getPlayer(ctx);
  if (existing) {
    return ctx.reply(
      `تو قبلاً شخصیت ساختی! برای دیدن وضعیتت /profile رو بزن.\n\n${profileCard(existing)}`,
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.reply(
    '🗡 به *افسانه‌ی گروه* خوش اومدی!\n\n' +
      'یک کلاس برای شخصیتت انتخاب کن:\n\n' +
      '⚔️ *جنگجو* — سلامتی و دفاع بالا، مناسب مبتدی‌ها\n' +
      '🔮 *جادوگر* — قدرت حمله‌ی بالا، ولی سلامتی کم\n' +
      '🏹 *تیرانداز* — متعادل، حمله و دفاع متوسط\n\n' +
      'برای انتخاب یکی از این‌ها را بفرست:\n' +
      '`/pick warrior` یا `/pick mage` یا `/pick archer`',
    { parse_mode: 'Markdown' }
  );
});

bot.command('pick', async (ctx) => {
  if (getPlayer(ctx)) {
    return ctx.reply('تو قبلاً شخصیت داری! نمی‌تونی دوباره کلاس انتخاب کنی.');
  }
  const parts = ctx.message.text.trim().split(/\s+/);
  const classKey = parts[1];
  if (!CLASSES[classKey]) {
    return ctx.reply('کلاس نامعتبره. یکی از این‌ها رو بزن: `/pick warrior`, `/pick mage`, `/pick archer`', {
      parse_mode: 'Markdown',
    });
  }
  const p = createPlayer(ctx, classKey);
  savePlayer(ctx, p);
  await ctx.reply(
    `🎉 شخصیتت ساخته شد!\n\n${profileCard(p)}\n\nحالا با /fight برو به نبرد!`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('profile', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');
  await ctx.reply(profileCard(p), { parse_mode: 'Markdown' });
});

bot.command('fight', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  const monster = generateMonster(p.level);
  const result = simulateFight(p, monster);

  let text = `${monster.emoji} یک *${monster.name}* (سطح تقریبی ${p.level}) سر راهت ظاهر شد!\n\n`;
  text += result.log.join('\n') + '\n\n';

  if (result.won) {
    p.xp += monster.xpReward;
    p.gold += monster.goldReward;
    const levelsGained = applyLevelUps(p);
    text += `✅ *پیروز شدی!* +${monster.xpReward} تجربه، +${monster.goldReward} طلا\n`;
    if (levelsGained.length > 0) {
      text += `\n🎊 *سطح جدید: ${levelsGained[levelsGained.length - 1]}!* آمارت افزایش پیدا کرد.`;
    }
  } else {
    const goldLost = Math.min(p.gold, Math.round(monster.goldReward * 0.5));
    p.gold -= goldLost;
    text += `☠️ *شکست خوردی...* ${goldLost > 0 ? `و ${goldLost} طلا از دست دادی.` : ''}`;
  }

  savePlayer(ctx, p);
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('shop', async (ctx) => {
  const lines = SHOP_ITEMS.map((i) => `\`${i.id}\` — ${i.label} — 💰${i.price}`);
  await ctx.reply(
    '🏪 *فروشگاه*\n\n' + lines.join('\n') + '\n\nبرای خرید: `/buy <id>`\nمثال: `/buy sword1`',
    { parse_mode: 'Markdown' }
  );
});

bot.command('buy', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  const parts = ctx.message.text.trim().split(/\s+/);
  const itemId = parts[1];
  const item = shopItemById(itemId);
  if (!item) return ctx.reply('همچین آیتمی تو فروشگاه نیست. لیست رو با /shop ببین.');

  if (p.gold < item.price) {
    return ctx.reply(`طلای کافی نداری. قیمت: ${item.price}، موجودی تو: ${p.gold}`);
  }

  p.gold -= item.price;
  p.inventory.push(item.id);
  savePlayer(ctx, p);
  await ctx.reply(`✅ *${item.label}* خریداری شد!\nبرای تجهیز (اگه سلاحه): \`/equip ${item.id}\``, {
    parse_mode: 'Markdown',
  });
});

bot.command('inventory', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  if (p.inventory.length === 0) {
    return ctx.reply('کوله‌پشتیت خالیه. برو به /shop یه چیزی بخر!');
  }

  const lines = p.inventory.map((id) => {
    const item = shopItemById(id);
    const equipped = p.equippedWeapon === id ? ' ✅ (تجهیزشده)' : '';
    return `\`${id}\` — ${item ? item.label : 'آیتم نامشخص'}${equipped}`;
  });

  await ctx.reply('🎒 *کوله‌پشتی تو*\n\n' + lines.join('\n'), { parse_mode: 'Markdown' });
});

bot.command('equip', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  const parts = ctx.message.text.trim().split(/\s+/);
  const itemId = parts[1];
  if (!p.inventory.includes(itemId)) {
    return ctx.reply('این آیتم رو تو کوله‌پشتیت نداری.');
  }
  const item = shopItemById(itemId);
  if (!item || item.type !== 'weapon') {
    return ctx.reply('فقط سلاح‌ها قابل تجهیزن.');
  }
  p.equippedWeapon = itemId;
  savePlayer(ctx, p);
  await ctx.reply(`✅ *${item.label}* تجهیز شد!`, { parse_mode: 'Markdown' });
});

bot.command('daily', async (ctx) => {
  const p = getPlayer(ctx);
  if (!p) return ctx.reply('هنوز شخصیت نساختی. اول /start رو بزن.');

  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;
  const remaining = p.lastDaily + cooldown - now;

  if (remaining > 0) {
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    return ctx.reply(`⏳ جایزه‌ی روزانه رو قبلاً گرفتی. حدود ${hours} ساعت دیگه دوباره سر بزن.`);
  }

  const goldReward = 20 + p.level * 3;
  const xpReward = 10 + p.level * 2;
  p.gold += goldReward;
  p.xp += xpReward;
  p.lastDaily = now;
  const levelsGained = applyLevelUps(p);
  savePlayer(ctx, p);

  let text = `🎁 جایزه‌ی روزانه: +${goldReward} طلا، +${xpReward} تجربه!`;
  if (levelsGained.length > 0) {
    text += `\n🎊 سطح جدید: ${levelsGained[levelsGained.length - 1]}!`;
  }
  await ctx.reply(text);
});

bot.command('leaderboard', async (ctx) => {
  const chatPrefix = `${ctx.chat.id}:`;
  const chatPlayers = Object.entries(players)
    .filter(([key]) => key.startsWith(chatPrefix))
    .map(([, p]) => p)
    .sort((a, b) => b.level - a.level || b.xp - a.xp || b.gold - a.gold)
    .slice(0, 10);

  if (chatPlayers.length === 0) {
    return ctx.reply('هنوز کسی تو این گروه شخصیت نساخته. اولین نفر باش! /start');
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = chatPlayers.map((p, i) => {
    const rank = medals[i] || `${i + 1}.`;
    const cls = CLASSES[p.classKey];
    return `${rank} ${cls.emoji} *${p.name}* — سطح ${p.level} (💰${p.gold})`;
  });

  await ctx.reply('🏆 *رتبه‌بندی گروه*\n\n' + lines.join('\n'), { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '🗡 *راهنمای افسانه‌ی گروه*\n\n' +
      '/start — شروع و ساخت شخصیت\n' +
      '/profile — دیدن کارت شخصیت\n' +
      '/fight — نبرد با یک هیولای تصادفی\n' +
      '/shop — دیدن فروشگاه\n' +
      '/buy <id> — خرید آیتم\n' +
      '/inventory — دیدن کوله‌پشتی\n' +
      '/equip <id> — تجهیز کردن سلاح\n' +
      '/daily — جایزه‌ی روزانه\n' +
      '/leaderboard — رتبه‌بندی گروه',
    { parse_mode: 'Markdown' }
  );
});

bot.catch((err, ctx) => {
  console.error(`❌ خطای مدیریت‌نشده در آپدیت نوع ${ctx.updateType}:`, err.message);
});

bot.launch();
console.log('🗡 ربات افسانه‌ی گروه شروع شد!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
