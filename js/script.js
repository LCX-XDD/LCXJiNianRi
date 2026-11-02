/* ============================================================
 *  纪念日网页 · 主逻辑
 *  依赖：js/config.js （CONFIG 全局变量）
 *  说明：所有时间差计算统一用 UTC 毫秒，不受设备本地时区影响；
 *        "今天"的判定按东八区（北京时间）日期。
 * ============================================================ */

(function () {
  'use strict';

  /* ==========================================================
   *  一、农历数据表（1900 ~ 2100，纯前端内置，不依赖外部接口）
   *  每一年一个十六进制数，按通用农历编码规则：
   *    bit16~bit5  ：1~12 月大小（1=30天，0=29天）
   *    bit4~bit1   ：闰几月（0=无闰月）
   *    bit17       ：闰月大小（1=30天，0=29天）
   * ========================================================== */
  const lunarInfo = [
    0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
    0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
    0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
    0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
    0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
    0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
    0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
    0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
    0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
    0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
    0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
    0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
    0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
    0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
    0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
    0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
    0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
    0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
    0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
    0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d1b0,0x0c954,
    0x0d4a0,0x0da50
  ];

  // 农历 y 年一整年的天数
  function lYearDays(y) {
    let sum = 348; // 12 个月 * 29 天
    for (let i = 0x8000; i > 0x8; i >>= 1) {
      sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    }
    return sum + leapDays(y);
  }
  // 农历 y 年闰哪个月（0 = 无闰月）
  function leapMonth(y) {
    return lunarInfo[y - 1900] & 0xf;
  }
  // 农历 y 年闰月的天数（无闰月返回 0）
  function leapDays(y) {
    if (leapMonth(y)) {
      return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    }
    return 0;
  }
  // 农历 y 年 m 月（非闰月）的天数
  function monthDays(y, m) {
    return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29;
  }

  /**
   * 农历日期 → 阳历日期
   * @param {number} y 农历年
   * @param {number} m 农历月
   * @param {number} d 农历日
   * @param {boolean} isLeap 是否闰月（本项目生日不涉及闰月，固定 false）
   * @returns {{year:number, month:number, day:number}} 阳历日期
   */
  function lunarToSolar(y, m, d, isLeap) {
    let offset = 0;
    // 先累加 1900 到 y-1 整年的天数
    for (let i = 1900; i < y; i++) {
      offset += lYearDays(i);
    }
    // 累加 y 年 1 ~ m-1 月
    for (let i = 1; i < m; i++) {
      offset += monthDays(y, i);
    }
    // 如果是闰 m 月，再加一个闰 m 月
    if (isLeap) {
      offset += monthDays(y, m);
    }
    // 再加当月已过天数（d 日 = d-1 天）
    offset += d - 1;
    // 1900 年农历正月初一 = 1900-01-31（阳历）
    const solar = new Date(Date.UTC(1900, 0, 31 + offset));
    return {
      year: solar.getUTCFullYear(),
      month: solar.getUTCMonth() + 1,
      day: solar.getUTCDate()
    };
  }

  /* ==========================================================
   *  二、东八区时间工具
   * ========================================================== */
  // 东八区当前时刻（以 UTC 毫秒表达，便于做时间差）
  function nowBeijingMs() {
    return Date.now(); // 时间差与本地时区无关，直接用 UTC 毫秒即可
  }
  // 东八区的"今天"对象 {y, m, d}
  function todayBeijing() {
    const offsetMs = CONFIG.timezoneOffset * 3600 * 1000;
    const utc = new Date(Date.now() + offsetMs);
    return {
      year: utc.getUTCFullYear(),
      month: utc.getUTCMonth() + 1,
      day: utc.getUTCDate()
    };
  }
  // 把东八区的某个日期（00:00:00）转成 UTC 毫秒
  function beijingDateToMs(y, m, d, h, mi, s) {
    const offsetMs = CONFIG.timezoneOffset * 3600 * 1000;
    return Date.UTC(y, m - 1, d, h || 0, mi || 0, s || 0) - offsetMs;
  }

  /* ==========================================================
   *  三、根据用户配置，算"下一个生日"的 UTC 毫秒
   *  规则：
   *    - 今年生日没到 → 今年生日
   *    - 今年生日已过或正好今天 → 下一年生日
   * ========================================================== */
  function nextBirthdayMs(userCfg) {
    const t = todayBeijing();
    const candidates = [t.year, t.year + 1];
    for (let i = 0; i < candidates.length; i++) {
      const y = candidates[i];
      let m, d;
      if (userCfg.calendar === 'lunar') {
        const solar = lunarToSolar(y, userCfg.lunarMonth, userCfg.lunarDay, false);
        m = solar.month;
        d = solar.day;
      } else {
        m = userCfg.solarMonth;
        d = userCfg.solarDay;
      }
      // 今天已过今年生日（月日 > 今天），则跳下一年
      if (y === t.year && (m < t.month || (m === t.month && d < t.day))) {
        continue;
      }
      return beijingDateToMs(y, m, d, 0, 0, 0);
    }
    // 兜底：明年
    let m2, d2;
    if (userCfg.calendar === 'lunar') {
      const solar = lunarToSolar(t.year + 1, userCfg.lunarMonth, userCfg.lunarDay, false);
      m2 = solar.month; d2 = solar.day;
    } else {
      m2 = userCfg.solarMonth; d2 = userCfg.solarDay;
    }
    return beijingDateToMs(t.year + 1, m2, d2, 0, 0, 0);
  }

  // 判断今天是不是该用户的生日
  function isBirthdayToday(userCfg) {
    const t = todayBeijing();
    if (userCfg.calendar === 'lunar') {
      const solar = lunarToSolar(t.year, userCfg.lunarMonth, userCfg.lunarDay, false);
      return solar.month === t.month && solar.day === t.day;
    }
    return userCfg.solarMonth === t.month && userCfg.solarDay === t.day;
  }

  /* ==========================================================
   *  四、格式化时长：天:时:分:秒（时/分/秒 00~59，自然进位）
   * ========================================================== */
  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return days + ':' + pad(hours) + ':' + pad(mins) + ':' + pad(secs);
  }

  // 缓存每个卡片上一次的时间字符串，用于逐位对比
  const lastTimeStr = { user1: '', user2: '', anniversary: '' };

  /**
   * 把时间字符串逐位渲染到 DOM，只有和上次不同的位才加动画
   * @param {HTMLElement} targetEl  时间容器
   * @param {string}      newStr    新时间字符串，如 "129:08:53:08"
   * @param {string}      key       lastTimeStr 缓存键
   */
  function renderTimeDigits(targetEl, newStr, key) {
    const oldStr = lastTimeStr[key] || '';
    let html = '';
    for (let i = 0; i < newStr.length; i++) {
      const ch = newStr[i];
      if (ch === ':') {
        html += '<span class="colon">:</span>';
      } else {
        const changed = oldStr[i] !== ch;
        html += '<span class="digit' + (changed ? ' changed' : '') + '">' + ch + '</span>';
      }
    }
    targetEl.innerHTML = html;
    lastTimeStr[key] = newStr;
  }

  /* ==========================================================
   *  五、DOM 渲染
   * ========================================================== */
  const el = (id) => document.getElementById(id);

  // 把某个 UTC 毫秒时间转成东八区的日期字符串，如 "2027-03-12"
  function msToBeijingDateCn(ms) {
    const offsetMs = CONFIG.timezoneOffset * 3600 * 1000;
    const d = new Date(ms + offsetMs);
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  function renderBirthdayCard(prefix, userCfg) {
    const timeEl = el(prefix + '-time');
    const dateEl = el(prefix + '-date');
    if (isBirthdayToday(userCfg)) {
      timeEl.textContent = userCfg.birthdayWish;
      timeEl.classList.add('wish-text');
      timeEl.classList.remove('time');
      if (dateEl) dateEl.textContent = '今天就是大日子';
      lastTimeStr[prefix] = '';
    } else {
      const nextMs = nextBirthdayMs(userCfg);
      const remainMs = nextMs - nowBeijingMs();
      timeEl.classList.add('time');
      timeEl.classList.remove('wish-text');
      renderTimeDigits(timeEl, formatDuration(remainMs), prefix);
      if (dateEl) dateEl.textContent = msToBeijingDateCn(nextMs);
    }
  }

  // 今日已过去的时分秒（从东八区今天 00:00:00 开始累加）
  function todayElapsedHMS() {
    const t = todayBeijing();
    // 今天 00:00:00 东八区
    const todayStartMs = beijingDateToMs(t.year, t.month, t.day, 0, 0, 0);
    const elapsedSec = Math.max(0, Math.floor((nowBeijingMs() - todayStartMs) / 1000));
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  function renderAnniversary() {
    const a = CONFIG.anniversary;
    const startMs = beijingDateToMs(a.year, a.month, a.day, a.hour, a.minute, a.second);
    const diffMs = nowBeijingMs() - startMs;
    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSec / 86400);

    // 超大天数（逐位动画）
    const daysEl = el('anniversary-days');
    renderTimeDigits(daysEl, String(days), 'anniversary-days');

    // 起始日期（只渲染一次也行，但每秒设置也无害）
    el('anniversary-subdate').textContent =
      a.year + '-' + String(a.month).padStart(2, '0') + '-' + String(a.day).padStart(2, '0');

    // 今日已过去的时分秒（累加，跨天自动归 0、天数 +1）
    const subTimeEl = el('anniversary-subtime');
    renderTimeDigits(subTimeEl, todayElapsedHMS(), 'anniversary-subtime');
  }

  function tick() {
    renderBirthdayCard('user1', CONFIG.user1);
    renderBirthdayCard('user2', CONFIG.user2);
    renderAnniversary();
  }

  /* ==========================================================
   *  六、生日祝福特效（同一天只弹一次）
   * ========================================================== */
  function fireConfetti(wishTexts) {
    const overlay = el('overlay');
    const wishEl = el('overlay-wish');
    wishEl.textContent = wishTexts.join('  ');

    // 先清空旧粒子
    overlay.querySelectorAll('.confetti').forEach(n => n.remove());
    // 随机生成 80 片礼花
    const colors = ['#ff8fab', '#ffb3c1', '#ffd6a5', '#ffe066', '#a0c4ff', '#b9fbc0', '#e0aaff'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (2.5 + Math.random() * 2.5) + 's';
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      overlay.appendChild(c);
    }

    overlay.classList.add('show');
    // 3~5 秒后自动消失
    setTimeout(() => {
      overlay.classList.remove('show');
    }, 4200);
  }

  function maybeTriggerBirthdayEffect() {
    const today = todayBeijing();
    const key = 'bday_fired_' + today.year + '-' + today.month + '-' + today.day;
    if (localStorage.getItem(key)) return; // 今天已经弹过

    const wishes = [];
    if (isBirthdayToday(CONFIG.user1)) wishes.push(CONFIG.user1.birthdayWish);
    if (isBirthdayToday(CONFIG.user2)) wishes.push(CONFIG.user2.birthdayWish);
    if (wishes.length === 0) return;

    fireConfetti(wishes);
    try { localStorage.setItem(key, '1'); } catch (e) { /* 隐私模式下忽略 */ }
  }

  /* ==========================================================
   *  七、随机情话：先请求 API，失败用本地兜底
   *  窄屏（手机）自动避开长文案，避免换行撑高
   * ========================================================== */
  // 手机端认为多少字以内算"短"
  const MOBILE_MAX_LEN = 22;
  function isMobileNarrow() {
    return window.innerWidth <= 480;
  }
  // 从文案池里挑一条"合适"的：窄屏优先短文案
  function pickSuitable(pool) {
    const narrow = isMobileNarrow();
    const shortPool = pool.filter(q => q.length <= MOBILE_MAX_LEN);
    const src = (narrow && shortPool.length) ? shortPool : pool;
    return src[Math.floor(Math.random() * src.length)];
  }

  function showQuote(text) {
    // 窄屏且文案过长时，丢弃 API 长文案，换本地短的
    if (isMobileNarrow() && text.length > MOBILE_MAX_LEN) {
      showQuote(pickSuitable(CONFIG.backupLoveQuotes || []));
      return;
    }
    el('love-quote').textContent = '“' + text + '”';
  }

  async function loadLoveQuote() {
    const apis = CONFIG.loveApis || [];
    for (let i = 0; i < apis.length; i++) {
      try {
        const resp = await fetch(apis[i], { method: 'GET', cache: 'no-store' });
        if (!resp.ok) continue;
        const raw = await resp.text();
        let text = '';
        try {
          const json = JSON.parse(raw);
          text = json.data || json.love || json.content || json.text || '';
        } catch (e) {
          text = raw.trim();
        }
        if (text && text.length > 2) {
          // 窄屏长文案会在 showQuote 里自动换短的
          showQuote(text);
          return;
        }
      } catch (e) {
        // 接口失败，尝试下一个
      }
    }
    // 全部失败 → 本地兜底随机一条
    showQuote(pickSuitable(CONFIG.backupLoveQuotes || []));
  }

  /* ==========================================================
   *  八、启动
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    document.title = CONFIG.pageTitle;

    // 把名字填到卡片标题
    el('user1-label').textContent = '距离' + CONFIG.user1.name + '的生日';
    el('user2-label').textContent = '距离' + CONFIG.user2.name + '的生日';
    el('anniversary-label').textContent = CONFIG.anniversary.title;

    tick();
    setInterval(tick, 1000);

    loadLoveQuote();
    maybeTriggerBirthdayEffect();
  });
})();
