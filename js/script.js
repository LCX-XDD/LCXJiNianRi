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

  // 加载动画结束恢复渲染时置 true：一次性抑制 digitChange，静默对齐实时值（避免"停了又跳一下"）
  let suppressDigitAnim = false;

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
        const changed = !suppressDigitAnim && oldStr[i] !== ch;
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
      // 加载动画进行中时跳过写入，由 count-up 接管
      if (!countUpActive[prefix + '-time']) {
        renderTimeDigits(timeEl, formatDuration(remainMs), prefix);
      }
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

    // 超大天数（逐位动画）；count-up 动画进行中时跳过，由动画接管
    const daysEl = el('anniversary-days');
    if (!countUpActive['anniversary-days']) {
      renderTimeDigits(daysEl, String(days), 'anniversary-days');
    }

    // 起始日期（只渲染一次也行，但每秒设置也无害）
    el('anniversary-subdate').textContent =
      a.year + '-' + String(a.month).padStart(2, '0') + '-' + String(a.day).padStart(2, '0');

    // 今日已过去的时分秒（累加，跨天自动归 0、天数 +1）
    const subTimeEl = el('anniversary-subtime');
    if (!countUpActive['anniversary-subtime']) {
      renderTimeDigits(subTimeEl, todayElapsedHMS(), 'anniversary-subtime');
    }
  }

  function tick() {
    renderBirthdayCard('user1', CONFIG.user1);
    renderBirthdayCard('user2', CONFIG.user2);
    renderAnniversary();
  }

  /* ==========================================================
   *  五·五、页面加载 count-up：所有数字从 0 滚动到真实值
   *   - 超大天数：整体单段滚动
   *   - 生日倒计时"天:时:分:秒"：按 天→时→分→秒 错峰启动滚动
   *   - 今日已过"时:分:秒"：按 时→分→秒 错峰启动滚动
   *  缓动：easeOutCubic（先快后慢），每段 1500ms
   * ========================================================== */
  const LOAD_DURATION = 1500;     // 每段动画时长
  const SEG_DELAY_STEP = 140;     // 相邻两段启动间隔（天最先启动）
  const countUpActive = {};       // 元素 id → 是否正在加载动画

  // 单段数字滚动（从 0 到目标；getTarget 每帧取最新目标，秒位可动态追实时值，避免结束滞后跳变）
  function countUpSegment(el, getTarget, duration, padWidth, onDone) {
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const target = getTarget();
      let v = Math.floor(target * (1 - Math.pow(1 - t, 3)));
      if (padWidth) v = String(v).padStart(padWidth, '0');
      el.textContent = v;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // 结束帧同样按最新目标 + 目标位宽显示，恢复逐位渲染瞬间无内容跳变
        const fin = getTarget();
        el.textContent = padWidth ? String(fin).padStart(padWidth, '0') : fin;
        if (onDone) onDone();
      }
    };
    requestAnimationFrame(tick);
  }

  // 单个数字整体滚动（如超大天数，目标固定）
  function countUpSingle(el, target, duration, onDone) {
    countUpActive[el.id] = true;
    countUpSegment(el, () => target, duration, 0, () => {
      countUpActive[el.id] = false;
      if (onDone) onDone();
    });
  }

  /**
   * 分段滚动："天:时:分:秒" 或 "时:分:秒"
   * 天最先启动，其次小时、分钟、秒依次错峰；动画期间保持位宽避免布局抖动
   * getTargetStr 每帧取最新完整时间串：秒位目标动态追实时值，其余位目标固定
   */
  function countUpTimeSegments(el, getTargetStr, onDone) {
    countUpActive[el.id] = true;
    const parts = getTargetStr().split(':');
    el.innerHTML = '';
    const segs = [];
    parts.forEach((part, i) => {
      if (i > 0) {
        const colon = document.createElement('span');
        colon.className = 'colon';
        colon.textContent = ':';
        el.appendChild(colon);
      }
      const seg = document.createElement('span');
      seg.className = 'digit';
      seg.style.minWidth = part.length + 'ch'; // 滚动期间数字位数会变，固定位宽
      seg.textContent = '0';
      el.appendChild(seg);
      segs.push(seg);
    });

    let remaining = segs.length;
    segs.forEach((seg, i) => {
      setTimeout(() => {
        const isLast = i === segs.length - 1; // 秒位（最右）动态追实时值
        const getTarget = isLast
          ? () => parseInt(getTargetStr().split(':')[i], 10)
          : () => parseInt(parts[i], 10);
        countUpSegment(seg, getTarget, LOAD_DURATION, parts[i].length, () => {
          remaining--;
          if (remaining === 0) {
            countUpActive[el.id] = false;
            if (onDone) onDone();
          }
        });
      }, i * SEG_DELAY_STEP);
    });
  }

  // 生日倒计时加载动画（生日当天直接显示祝福文字，不走滚动）
  function startCountUpTime(prefix, userCfg) {
    const timeEl = el(prefix + '-time');
    if (isBirthdayToday(userCfg)) {
      timeEl.textContent = userCfg.birthdayWish;
      timeEl.classList.add('wish-text');
      timeEl.classList.remove('time');
      lastTimeStr[prefix] = '';
      return;
    }
    const nextMs = nextBirthdayMs(userCfg);
    countUpTimeSegments(timeEl, () => formatDuration(nextMs - nowBeijingMs()), () => {
      // 静默对齐实时值：恢复逐位渲染时不触发 digitChange，避免"停了又跳一下"
      suppressDigitAnim = true;
      renderBirthdayCard(prefix, userCfg);
      suppressDigitAnim = false;
    });
  }

  /* ==========================================================
   *  五·六、标题乱码解码效果（参考用户提供的 scramble 逻辑）
   *  50ms/帧，每 3 帧解码一个字符，全部解码后停止；
   *  乱码池用高频汉字，避免中文字宽差异造成标题抖动
   * ========================================================== */
  function scrambleDecode(el, target) {
    const chars = '的一是不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究纬越影织礼气株检足';
    let frame = 0;
    const interval = setInterval(() => {
      el.textContent = target.split('').map((c, i) =>
        i < frame / 3 ? c : chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      if (frame++ > target.length * 3) clearInterval(interval);
    }, 50);
  }

  /* ==========================================================
   *  五·七、背景爱心粒子（纯 Canvas 2D，全屏飘落小爱心）
   *  两层：后层（卡片后面）数量多、密度高；前层（卡片前面）少量漂浮
   *  用相对坐标(0~1)存储位置，窗口大小变化自动自适应
   * ========================================================== */
  function initBgParticles() {
    const bgCanvas = el('bg-canvas');
    const fgCanvas = el('fg-canvas');
    if (!bgCanvas || !fgCanvas) return;

    const bgCtx = bgCanvas.getContext('2d');
    const fgCtx = fgCanvas.getContext('2d');
    if (!bgCtx || !fgCtx) return;

    let W, H;
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      bgCanvas.width = W;
      bgCanvas.height = H;
      fgCanvas.width = W;
      fgCanvas.height = H;
    }
    resize();
    window.addEventListener('resize', resize);

    // 画一个小爱心路径（size 是爱心的大致宽度）
    function drawHeart(ctx, x, y, size, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      const s = size;
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s / 2, y, x - s / 2, y + s * 0.3);
      ctx.bezierCurveTo(x - s / 2, y + s * 0.6, x, y + s * 0.8, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.8, x + s / 2, y + s * 0.6, x + s / 2, y + s * 0.3);
      ctx.bezierCurveTo(x + s / 2, y, x, y, x, y + s * 0.3);
      ctx.fill();
      ctx.restore();
    }

    const pinkColors = ['#ff8fab', '#ffb3c6', '#ffc2d1', '#ff7096', '#ffafcc'];

    // ===== 后层粒子（卡片后面，数量多、密度高） =====
    const BACK_COUNT = 130;
    const backParticles = [];
    for (let i = 0; i < BACK_COUNT; i++) {
      backParticles.push({
        rx: Math.random(),
        ry: Math.random(),
        size: 5 + Math.random() * 10,
        speedY: 0.0005 + Math.random() * 0.0015,
        speedX: (Math.random() - 0.5) * 0.0003,
        alpha: 0.28 + Math.random() * 0.4,    // 透明度调高：0.28~0.68
        color: pinkColors[Math.floor(Math.random() * pinkColors.length)],
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.008 + Math.random() * 0.015
      });
    }

    // ===== 前层粒子（卡片前面，少量漂浮、若隐若现） =====
    const FRONT_COUNT = 20;
    const frontParticles = [];
    for (let i = 0; i < FRONT_COUNT; i++) {
      frontParticles.push({
        rx: Math.random(),
        ry: Math.random(),
        size: 8 + Math.random() * 10,
        speedY: 0.0003 + Math.random() * 0.0008,
        speedX: (Math.random() - 0.5) * 0.0004,
        alpha: 0.4 + Math.random() * 0.3,      // 透明度调高：0.4~0.7
        color: pinkColors[Math.floor(Math.random() * pinkColors.length)],
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.005 + Math.random() * 0.01
      });
    }

    function updateAndDraw(ctx, particles) {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.swayPhase += p.swaySpeed;
        p.ry += p.speedY;
        p.rx += p.speedX + Math.sin(p.swayPhase) * 0.0002;

        // 飘出屏幕底部后，从顶部重新进来
        if (p.ry > 1.05) {
          p.ry = -0.05;
          p.rx = Math.random();
        }
        // 左右出界就回弹
        if (p.rx < -0.05) p.rx = 1.05;
        if (p.rx > 1.05) p.rx = -0.05;

        const x = p.rx * W;
        const y = p.ry * H;
        drawHeart(ctx, x, y, p.size, p.color, p.alpha);
      }
    }

    (function animate() {
      updateAndDraw(bgCtx, backParticles);
      updateAndDraw(fgCtx, frontParticles);
      requestAnimationFrame(animate);
    })();
  }

  /* ==========================================================
   *  五·八、卡片 3D 倾斜（鼠标跟随，参考代码 rotateX/rotateY）
   *  角度取 14° 更柔和；离开复位，保留 hover 上浮
   * ========================================================== */
  function setupTilt() {
    const maxDeg = 14;
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(600px) rotateY(' + (x * maxDeg) + 'deg) rotateX(' + (-y * maxDeg) + 'deg) translateY(-3px)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ==========================================================
   *  五·九、目标日期折叠：默认隐藏，点击卡片展开/收起
   *  借鉴手风琴 max-height 展开效果（不借鉴样式）
   * ========================================================== */
  function setupDateToggle() {
    const pairs = [
      ['user1-card', 'user1-date'],
      ['anniversary-card', 'anniversary-subdate'],
      ['user2-card', 'user2-date']
    ];
    pairs.forEach(function (p) {
      const card = el(p[0]);
      const dateEl = el(p[1]);
      if (!card || !dateEl) return;
      card.addEventListener('click', function () {
        dateEl.classList.toggle('open');
      });
    });
  }

  /* ==========================================================
   *  六、生日祝福特效（同一天只弹一次）
   * ========================================================== */
  function fireConfetti(wishTexts) {
    const overlay = el('overlay');
    const wishEl = el('overlay-wish');
    wishEl.textContent = wishTexts.join('  ');

    // 清掉上一次的粒子画布
    overlay.querySelectorAll('.cv').forEach(n => n.remove());

    // canvas 粒子爆发（参考代码：中心发射 + 重力 + 随机色，另加淡出）
    // 先让 overlay 显示出来，否则 clientWidth/Height 是 0
    overlay.classList.add('show');
    const cv = document.createElement('canvas');
    cv.className = 'cv';
    overlay.appendChild(cv);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const cx = W / 2;
    const cy = H / 2;
    const particles = [];
    for (let i = 0; i < 250; i++) {
      particles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -18 - 3,
        g: 0.3,
        size: 6 + Math.random() * 8,        // 6~14px，更大
        life: 1,
        c: 'hsl(' + Math.floor(Math.random() * 360) + ' 90% 60%)'
      });
    }
    let running = true;
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.006;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);   // 长方形纸屑，更像真实彩纸
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();

    // 3~5 秒后自动消失
    setTimeout(() => {
      overlay.classList.remove('show');
      running = false;
      cv.remove();
    }, 4200);
  }

  function maybeTriggerBirthdayEffect() {
    const wishes = [];
    if (isBirthdayToday(CONFIG.user1)) wishes.push(CONFIG.user1.birthdayWish);
    if (isBirthdayToday(CONFIG.user2)) wishes.push(CONFIG.user2.birthdayWish);
    if (wishes.length === 0) return;

    fireConfetti(wishes);
  }

  /* ==========================================================
   *  七、随机情话：先请求 API，失败用本地兜底
   *  长文案自动跑马灯（从右往左循环）；加载时显示小转圈
   * ========================================================== */
  function showQuote(text) {
    const container = el('love-quote');
    container.innerHTML = '';
    container.classList.remove('marquee');

    // 所有文案末尾句号都去掉
    let displayText = text.trim();
    if (displayText.endsWith('。')) {
      displayText = displayText.slice(0, -1);
    }

    const inner = document.createElement('span');
    inner.className = 'quote-text';
    inner.textContent = displayText;
    container.appendChild(inner);

    // 等下一帧测量宽度，超容器就加跑马灯
    requestAnimationFrame(() => {
      const cw = container.clientWidth;
      const iw = inner.scrollWidth;
      if (iw > cw + 4) {
        // 长文案：包一层 track，放两份文本循环跑马灯
        container.innerHTML = '';
        const track = document.createElement('span');
        track.className = 'marquee-track';
        const t1 = inner.cloneNode(true);
        const t2 = inner.cloneNode(true);
        track.appendChild(t1);
        track.appendChild(t2);
        container.appendChild(track);
        container.classList.add('marquee');
      }
      // 短文案：保持居中（justify-content: center 已在 CSS 里设置）
    });
  }

  // 显示加载小转圈
  function showQuoteLoading() {
    const container = el('love-quote');
    container.innerHTML = '<span class="spinner"></span>';
  }

  // 从 API 返回的原始文本/JSON 里抽出情话
  function extractQuote(raw) {
    const t = raw.trim();
    try {
      const j = JSON.parse(t);
      return j.hitokoto || j.data || j.love || j.content || j.text || '';
    } catch (e) {
      return t;
    }
  }

  // 单个请求加超时（AbortController）
  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        signal: ctrl.signal
      });
      if (!resp.ok) throw new Error('http ' + resp.status);
      return await resp.text();
    } finally {
      clearTimeout(timer);
    }
  }

  // 并行请求两个 API，谁先返回用谁；5 秒内都没回来就 reject
  function tryOnce(apis, timeoutMs) {
    const tasks = apis.map(url =>
      fetchWithTimeout(url, timeoutMs).then(raw => {
        const text = extractQuote(raw);
        if (text && text.length > 2) return text;
        throw new Error('bad text');
      })
    );
    return Promise.any(tasks);
  }

  async function loadLoveQuote() {
    // 1) 先显示加载小转圈，不直接出本地文案
    showQuoteLoading();

    const apis = CONFIG.loveApis || [];
    const MAX_ROUNDS = 2;     // 最多两轮
    const PER_ROUND_TIMEOUT = 5000;  // 每轮 5 秒

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      try {
        const text = await tryOnce(apis, PER_ROUND_TIMEOUT);
        showQuote(text);
        return;
      } catch (e) {
        // 本轮两个都超时/失败，进入下一轮
      }
    }

    // 2) 两轮都失败 → 本地兜底
    const pool = CONFIG.backupLoveQuotes || [];
    if (pool.length) {
      showQuote(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  /* ==========================================================
   *  八、启动
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    document.title = CONFIG.pageTitle;

    // 把名字填到卡片标题，并依次启动乱码解码动画（顶部→中部→底部，错峰 200ms）
    const labelJobs = [
      { el: el('user1-label'), text: '距离' + CONFIG.user1.name + '的生日', delay: 0 },
      { el: el('anniversary-label'), text: CONFIG.anniversary.title, delay: 200 },
      { el: el('user2-label'), text: '距离' + CONFIG.user2.name + '的生日', delay: 400 }
    ];
    labelJobs.forEach(job => {
      job.el.textContent = job.text;
      setTimeout(() => scrambleDecode(job.el, job.text), job.delay);
    });

    /* ---------- 页面加载：所有数字 count-up 滚动 ---------- */

    // 1) 超大天数：整体从 0 滚动到真实值
    const a = CONFIG.anniversary;
    const targetDays = Math.max(0, Math.floor(
      (nowBeijingMs() - beijingDateToMs(a.year, a.month, a.day, a.hour, a.minute, a.second)) / 86400000
    ));
    countUpSingle(el('anniversary-days'), targetDays, LOAD_DURATION, () => {
      // 静默对齐实时值：恢复逐位渲染时不触发 digitChange，避免"停了又跳一下"
      suppressDigitAnim = true;
      renderAnniversary();
      suppressDigitAnim = false;
    });

    // 2) 生日倒计时：天→时→分→秒 依次错峰滚动
    startCountUpTime('user1', CONFIG.user1);
    startCountUpTime('user2', CONFIG.user2);

    // 3) 今日已过去的时分秒：时→分→秒 依次错峰滚动（秒位动态追实时值）
    countUpTimeSegments(el('anniversary-subtime'), () => todayElapsedHMS(), () => {
      suppressDigitAnim = true;
      renderAnniversary();
      suppressDigitAnim = false;
    });

    // 动画标记已全部设置，立即渲染一次：日期/起始日期马上显示（时间容器由动画接管，不会被覆盖）
    tick();

    // 背景爱心粒子云 / 卡片 3D 倾斜 / 目标日期点击折叠
    initBgParticles();
    setupTilt();
    setupDateToggle();

    setInterval(tick, 1000);

    loadLoveQuote();
    maybeTriggerBirthdayEffect();
  });
})();
