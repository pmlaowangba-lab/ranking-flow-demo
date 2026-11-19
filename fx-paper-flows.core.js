/* =====================================================================
   fx-paper-flows.core.js · 黄白纸风 · 正文口播动态流（2026-11-19 · Opus 5.5 工艺）
   ---------------------------------------------------------------------
   暴露：window.FX_PAPER_FLOWS = { W, H, types, meta, themes, render }
   用法：FX_PAPER_FLOWS.render(container, spec, progress, themeColor)
     · container  任意尺寸的定位容器（模板里是 952×920 主视觉舞台），内部按 476×460 设计稿等比放大、居中
     · spec       'paper_funnel' 或 { type:'paper_funnel', ...文案覆盖 }
     · progress   0→1 生长进度（纯函数：同一 progress 永远同一帧，无 rAF / Date / 随机）
     · themeColor 主题强调色（克莱因蓝 #2563EB / 森林绿 #0F9D76 / 暖琥珀 #D97706 / 珊瑚红 #E11D48 / 靛紫 #6D28D9）
   类型：paper_funnel · paper_router · paper_remote · paper_slabs · paper_laser · paper_flywheel · ab_compare · kinetic_meter
   约束：根节点带 .fx（版面检查据此识别「动效」不查素材停住）；所有类名 pf- 前缀，不用 .hl/.cell/.lane/.row3/.ok/.stamp
   字体：宿主页面只声明 RouHei 一个 400 字重 @font-face（./assets/RouHei.ttf），粗体统一由浏览器合成，避免 CJK 字重不均
   ===================================================================== */
(function (root) {
  'use strict';
  const W = 476, H = 460;

  /* ---------------- helpers ---------------- */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eb = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const f2 = (v) => (+v).toFixed(2);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hexRGB = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hexA = (hex, a) => { const [r, g, b] = hexRGB(hex); return `rgba(${r},${g},${b},${a})`; };
  const mix = (h1, h2, k) => { const a = hexRGB(h1), b = hexRGB(h2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const tint = (h, k) => mix(h, '#ffffff', k);
  const shade = (h, k) => mix(h, '#0b0c10', k);
  function fx(k, o = {}) {
    const dy = o.dy ?? 12, dx = o.dx ?? 0, s = o.s ?? 0.94;
    const e = eo(k), b = o.noBack ? e : eb(k);
    const sc = s + (1 - s) * b;
    return `opacity:${f2(clamp(k * 1.7))};transform:translate(${f2((1 - e) * dx)}px,${f2((1 - e) * dy)}px) scale(${sc.toFixed(4)});`;
  }
  function bz(P, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  }
  const bzD = (P) => `M${P[0]} C${P[1]} ${P[2]} ${P[3]}`;
  /* 纸面光纤：宽幅柔光底 + 主线 + 白芯描边光点（亮底上用主题色柔影代替霓虹） */
  function beam(P, k, col, o = {}) {
    if (k <= 0) return '';
    const w = o.w ?? 1.8;
    let s = `<path d="${bzD(P)}" fill="none" stroke="${col}" stroke-opacity="${o.base ?? 0.16}" stroke-width="${w + 5}" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - k)}" style="filter:blur(3px)"/>`;
    s += `<path d="${bzD(P)}" fill="none" stroke="${o.grad || col}" stroke-width="${w}" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - k)}"/>`;
    const tt = o.spark === undefined ? Math.min(k, 0.999) : o.spark;
    if (tt !== null) {
      const [x, y] = bz(P, eo(tt));
      s += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${o.r ?? 3.4}" fill="#fff" stroke="${col}" stroke-width="1.6" style="filter:drop-shadow(0 0 3px ${hexA(col, 0.9)}) drop-shadow(0 0 8px ${hexA(col, 0.55)})"/>`;
    }
    return s;
  }
  function gearPath(cx, cy, ro, ri, n, hole) {
    let d = ''; const st = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a = i * st;
      [[a - st * 0.27, ri], [a - st * 0.13, ro], [a + st * 0.13, ro], [a + st * 0.27, ri]].forEach(([g, r], j) => {
        d += (i === 0 && j === 0 ? 'M' : 'L') + f2(cx + r * Math.cos(g)) + ' ' + f2(cy + r * Math.sin(g)) + ' ';
      });
    }
    d += 'Z ';
    if (hole) d += `M${cx + hole} ${cy} A${hole} ${hole} 0 1 0 ${cx - hole} ${cy} A${hole} ${hole} 0 1 0 ${cx + hole} ${cy} Z`;
    return d;
  }
  function rand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const CHECK = (c = '#fff', w = 2, sz = 12) => `<svg width="${sz}" height="${sz}" viewBox="0 0 12 12"><path d="M2.5 6.3 L5 8.6 L9.6 3.6" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const INK = '#14161D', INK2 = '#5B6170', INK3 = '#9AA0AC', LINE = '#E6E0D3';

  /* brand glyphs（真实品牌形） */
  const ICON = {
    reddit: `<svg width="26" height="26" viewBox="0 0 24 24"><ellipse cx="12" cy="14.2" rx="7.6" ry="5.3" fill="#fff"/><circle cx="18.7" cy="10" r="1.7" fill="#fff"/><circle cx="5.3" cy="10" r="1.7" fill="#fff"/><circle cx="16.9" cy="4.4" r="1.5" fill="#fff"/><path d="M12 9 L13.1 4.1 L16.9 4.4" stroke="#fff" stroke-width="1.1" fill="none" stroke-linejoin="round"/><circle cx="9.3" cy="13.5" r="1.2" fill="#FF4500"/><circle cx="14.7" cy="13.5" r="1.2" fill="#FF4500"/><path d="M9.2 16.4 q2.8 1.7 5.6 0" stroke="#FF4500" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`,
    hn: `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M6.2 4.5 L12 13.4 L17.8 4.5 M12 13.4 V20" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="square"/></svg>`,
    gh: `<svg width="25" height="25" viewBox="0 0 16 16"><path fill="#fff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
    x: `<svg width="19" height="19" viewBox="0 0 24 24"><path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
  };

  /* ---------------- CSS（注入一次） ---------------- */
  const CSS = `
.pf-root{position:absolute;inset:0;overflow:hidden;font-family:'RouHei',-apple-system,'PingFang SC','Hiragino Sans GB',sans-serif;color:${INK};-webkit-font-smoothing:antialiased}
.pf-stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
.pf-ab{position:absolute}
.pf-mono{font-family:'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace}
.pf-num{font-family:-apple-system,'SF Pro Display','RouHei',sans-serif;font-variant-numeric:tabular-nums}
svg.pf-ov{position:absolute;left:0;top:0;overflow:visible}
.pf-card{position:absolute;border-radius:16px;background:linear-gradient(180deg,#FFFFFF 0%,#FCFBF7 100%);
  box-shadow:inset 0 0 0 1px ${LINE},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.06),0 12px 32px rgba(20,22,29,.07)}
.pf-card.lift{box-shadow:inset 0 0 0 1px ${LINE},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.07),0 18px 40px -8px rgba(20,22,29,.14)}
.pf-pill{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.pf-tag{font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:9.5px;font-weight:700;padding:3px 7px;border-radius:6px;letter-spacing:.5px}
/* P01 */
.p1-q{left:36px;top:14px;width:404px;height:46px;border-radius:15px;display:flex;align-items:center;gap:10px;padding:0 8px 0 14px}
.p1-q .txt{font-size:14px;color:${INK};white-space:nowrap;flex:1;overflow:hidden}
.p1-src{width:96px;margin-left:-48px;top:80px;display:flex;flex-direction:column;align-items:center}
.p1-ic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;position:relative;
  box-shadow:0 0 0 3px #fff,0 0 0 4px ${LINE},inset 0 1px 0 rgba(255,255,255,.35),inset 0 -2px 4px rgba(0,0,0,.18),0 10px 18px -6px rgba(20,22,29,.35)}
.p1-ic::after{content:'';position:absolute;inset:0;border-radius:13px;background:linear-gradient(180deg,rgba(255,255,255,.28),transparent 52%);pointer-events:none}
.p1-src .nm{margin-top:8px;font-size:11px;color:${INK};white-space:nowrap}
.p1-src .ct{margin-top:1px;font-size:9.5px;color:${INK3}}
.p1-rej{height:23px;padding:0 9px;border-radius:8px;display:flex;align-items:center;gap:5px;font-size:11px;color:#E11D48;white-space:nowrap;background:#FFF4F6;
  box-shadow:inset 0 0 0 1px rgba(225,29,72,.28),0 6px 12px -6px rgba(225,29,72,.45),0 1px 1px rgba(20,22,29,.05)}
.p1-rej s{text-decoration-color:rgba(225,29,72,.75);text-decoration-thickness:1.5px}
.p1-brief{left:32px;top:308px;width:412px;height:140px;border-radius:18px;padding:12px 16px}
.p1-bh{display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:1px solid #EFEAE0}
.p1-row{display:grid;grid-template-columns:22px 1fr 100px 34px;align-items:center;gap:8px;height:23px;font-size:12px;color:${INK}}
.p1-row .rk{font-size:10px;color:${INK3}}
.p1-row .tr{height:6px;border-radius:3px;background:#EFEBE2;overflow:hidden;box-shadow:inset 0 1px 1px rgba(20,22,29,.06)}
.p1-row .tr b{display:block;height:100%;border-radius:3px}
.p1-row .pc{font-size:11.5px;font-weight:600;text-align:right}
/* P02 */
.p2-pal{left:16px;top:16px;width:272px;height:124px;border-radius:15px;overflow:hidden}
.p2-ps{height:40px;display:flex;align-items:center;gap:8px;padding:0 10px 0 13px;border-bottom:1px solid #EFEAE0;font-size:12.5px;color:${INK};white-space:nowrap}
.p2-kbd{margin-left:auto;font-size:10px;color:${INK2};padding:2px 6px;border-radius:5px;background:#F6F4EF;box-shadow:inset 0 0 0 1px #E2DCCF,inset 0 -1.5px 0 #DCD5C6}
.p2-pr{height:36px;margin:4px 6px 0;border-radius:9px;display:flex;align-items:center;gap:9px;padding:0 9px;font-size:12px;color:${INK2};white-space:nowrap}
.p2-pri{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none}
.p2-deck{left:16px;top:158px;width:168px;height:98px;border-radius:20px;background:linear-gradient(180deg,#ECE9E2 0%,#DAD6CD 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -2px 6px rgba(20,22,29,.08),inset 0 0 0 1px rgba(20,22,29,.07),0 16px 28px -14px rgba(20,22,29,.4),0 2px 4px rgba(20,22,29,.06)}
.p2-deck::before{content:'';position:absolute;inset:6px;border-radius:15px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 1px,transparent 1px 3px);opacity:.6}
.p2-key{top:12px;width:68px;height:68px;border-radius:14px;background:linear-gradient(180deg,#F6F3EC 0%,#DDD8CC 100%)}
.p2-key .top{position:absolute;left:6px;right:6px;top:4px;height:50px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-family:-apple-system,'SF Pro Display',sans-serif;font-size:25px;font-weight:500;color:#2A2D36;
  background:radial-gradient(120% 100% at 50% 0%,#FFFFFF 0%,#F7F4ED 55%,#ECE7DC 100%);box-shadow:inset 0 2px 3px rgba(20,22,29,.07),inset 0 -1px 0 rgba(255,255,255,.95),inset 0 0 0 1px rgba(20,22,29,.05)}
.p2-led{position:absolute;right:9px;top:8px;width:5px;height:5px;border-radius:50%}
.p2-core{left:220px;top:162px;width:92px;height:92px;border-radius:50%}
.p2-card{width:128px;border-radius:16px;padding:12px 12px}
.p2-step{display:flex;align-items:center;gap:7px;height:22px;font-size:11.5px;color:${INK}}
.p2-step .t{margin-left:auto;font-size:9.5px;color:#B45309}
.p2-log{left:16px;top:298px;width:300px;height:146px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#FDFBF6,#F8F4EA);
  box-shadow:inset 0 0 0 1px ${LINE},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.06),0 12px 28px rgba(20,22,29,.07)}
.p2-lh{height:28px;display:flex;align-items:center;gap:6px;padding:0 11px;border-bottom:1px solid #ECE6D9;font-size:10px;color:${INK2};background:linear-gradient(180deg,#FFFFFF,#F7F3EA)}
.p2-lh i{width:7px;height:7px;border-radius:50%;background:#E3DDD0;box-shadow:inset 0 0 0 .5px rgba(20,22,29,.15)}
.p2-ll{display:grid;grid-template-columns:58px 1fr 42px 34px;align-items:center;height:32px;padding:0 11px;font-size:10.5px;color:${INK3};border-bottom:1px dashed #ECE6D9}
.p2-ll .q{color:${INK};font-family:'RouHei',sans-serif;font-size:11.5px;white-space:nowrap}
.p2-ll .tg{font-size:9.5px;font-weight:700;text-align:center;border-radius:5px;padding:2px 0}
.p2-ll .v{text-align:right;color:${INK2}}
/* P03 */
.p3-ph{left:24px;top:146px;width:130px;height:288px;border-radius:31px;padding:4px;
  background:linear-gradient(140deg,#FAFBFC 0%,#C6CAD1 18%,#EEF0F3 42%,#A7ACB4 72%,#E6E8EC 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 0 0 1px rgba(20,22,29,.12),0 26px 44px -16px rgba(20,22,29,.42),0 4px 10px rgba(20,22,29,.08)}
.p3-bz{position:relative;width:100%;height:100%;border-radius:27px;padding:3px;background:#0C0D10}
.p3-scr{position:relative;width:100%;height:100%;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,#F8F7FC 0%,#F0EEF6 100%)}
.p3-btn{position:absolute;width:3px;border-radius:2px;background:linear-gradient(90deg,#B9BEC6,#E9ECEF)}
.p3-island{position:absolute;left:50%;top:7px;height:20px;border-radius:11px;background:#000;display:flex;align-items:center;justify-content:center;gap:2px;overflow:hidden}
.p3-island b{display:block;width:2px;border-radius:1px}
.p3-bub{position:absolute;font-size:9.5px;line-height:1.45;border-radius:12px;padding:6px 8px}
.p3-ban{left:10px;top:196px;width:188px;height:50px;border-radius:17px;display:flex;align-items:center;gap:9px;padding:0 10px;
  background:rgba(255,255,255,.80);backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);
  box-shadow:inset 0 0 0 1px rgba(20,22,29,.07),inset 0 1px 0 #fff,0 16px 32px -10px rgba(20,22,29,.38),0 2px 6px rgba(20,22,29,.08)}
.p3-lid{left:194px;top:18px;width:264px;height:176px;border-radius:12px;padding:4px;background:linear-gradient(180deg,#EDEFF2 0%,#CDD1D7 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.8),0 0 0 1px rgba(20,22,29,.12),0 26px 40px -22px rgba(20,22,29,.45)}
.p3-bezel{position:relative;width:100%;height:100%;border-radius:9px;padding:5px;background:#0D0E11}
.p3-wall{position:relative;width:100%;height:100%;border-radius:5px;overflow:hidden;background:radial-gradient(90% 80% at 0% 0%,#E9E1FB,transparent 60%),radial-gradient(80% 90% at 100% 100%,#FDE6D6,transparent 60%),linear-gradient(135deg,#F3F0FA,#EAF0FA)}
.p3-term{position:absolute;left:10px;right:10px;top:9px;bottom:9px;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.97);box-shadow:inset 0 0 0 1px rgba(20,22,29,.08),0 10px 22px -8px rgba(20,22,29,.3)}
.p3-tb{height:19px;display:flex;align-items:center;gap:4px;padding:0 7px;background:linear-gradient(180deg,#F6F4EF,#EEEBE4);border-bottom:1px solid #E4DFD3}
.p3-tb i{width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.15)}
.p3-tb span{flex:1;text-align:center;margin-right:24px;font-size:8.5px;color:${INK3}}
.p3-tl{font-size:9.4px;line-height:15.5px;padding:0 9px;white-space:nowrap;color:#2A2D36}
.p3-base{left:178px;top:194px;width:296px;height:12px;border-radius:2px 2px 12px 12px;background:linear-gradient(180deg,#F1F2F4 0%,#D3D6DB 55%,#B7BBC2 100%);box-shadow:inset 0 1px 0 #fff,0 10px 16px -6px rgba(20,22,29,.4)}
.p3-notch{position:absolute;left:50%;top:0;width:52px;height:5px;margin-left:-26px;border-radius:0 0 6px 6px;background:linear-gradient(180deg,#C3C7CD,#DADDE1)}
.p3-lbl{font-size:10.5px;color:${INK2};display:flex;align-items:center;gap:6px;white-space:nowrap}
.p3-lbl i{width:6px;height:6px;border-radius:50%}
.p3-tlc{left:194px;top:330px;width:264px;height:104px;border-radius:16px;padding:12px 16px}
.p3-stp{position:absolute;top:46px;width:64px;margin-left:-32px;text-align:center}
.p3-stp .d{width:12px;height:12px;border-radius:50%;margin:0 auto}
.p3-stp .a{margin-top:7px;font-size:11px;color:${INK};white-space:nowrap}
.p3-stp .b{margin-top:1px;font-size:9.5px;color:${INK3}}
/* P04 */
.p4-face{position:absolute;left:0;top:0;transform-origin:0 0}
.p4-top{width:150px;height:150px;border-radius:8px;overflow:hidden}
.p4-side{width:150px;height:18px;overflow:hidden}
.p4-lbl{width:146px}
.p4-lbl .h{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;color:${INK};white-space:nowrap}
.p4-lbl .h em{font-style:normal;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;color:${INK};box-shadow:inset 0 0 0 1px ${INK}}
.p4-lbl .s{margin-top:5px;font-size:10.5px;color:${INK2};white-space:nowrap}
/* P05 */
.p5-frag{position:absolute;height:25px;padding:0 9px;border-radius:7px;display:flex;align-items:center;font-size:11.5px;white-space:nowrap}
.p5-frag.d0{color:#3A2E05;background:linear-gradient(180deg,#FFF6C9,#FDEBA0);box-shadow:0 1px 1px rgba(20,22,29,.08),0 8px 14px -8px rgba(120,90,10,.45)}
.p5-frag.d0::before{content:'';position:absolute;left:50%;top:-5px;width:26px;height:9px;margin-left:-13px;background:rgba(255,255,255,.62);box-shadow:inset 0 0 0 1px rgba(20,22,29,.05);transform:rotate(-4deg)}
.p5-frag.d1{color:${INK};background:#fff;box-shadow:inset 0 0 0 1px ${LINE},0 6px 12px -6px rgba(20,22,29,.28)}
.p5-frag.d2{color:${INK3};background:#F4F0E6;box-shadow:inset 0 0 0 1px #E8E1D2;filter:blur(.7px)}
.p5-card{left:22px;width:432px;height:66px;border-radius:16px;overflow:hidden}
.p5-card .strip{position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0}
.p5-card .p5-t{position:absolute;left:52px;top:13px;font-size:14px;font-weight:700;color:${INK};white-space:nowrap}
.p5-card .meta{position:absolute;left:52px;top:38px;display:flex;align-items:center;gap:6px;font-size:10.5px;color:${INK2};white-space:nowrap}
.p5-av{width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;box-shadow:0 0 0 1.5px #fff,0 1px 2px rgba(20,22,29,.25)}
.p5-pri{position:absolute;right:14px;top:12px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px}
.p5-due{position:absolute;right:14px;top:38px;font-size:10px;color:${INK2};display:flex;align-items:center;gap:4px;white-space:nowrap}
/* P06 */
.p6-top{left:16px;top:12px;width:444px;height:182px;border-radius:20px;padding:14px 18px;overflow:hidden}
.p6-big{position:absolute;left:12px;top:30px;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;font-size:94px;font-weight:800;letter-spacing:-5px;line-height:.92;color:${INK}}
.p6-bar{display:grid;grid-template-columns:34px 1fr 50px;align-items:center;gap:10px;height:20px;font-size:11px;color:${INK2}}
.p6-bar .v{font-size:12px;font-weight:600;text-align:right}
.p6-trk{height:8px;border-radius:5px;background:#F0ECE3;box-shadow:inset 0 1px 1px rgba(20,22,29,.07);position:relative;overflow:hidden}
.p6-node{width:128px;height:58px;margin-left:-64px;margin-top:-29px;border-radius:18px;display:flex;align-items:center;gap:9px;padding:0 10px 0 8px}
.p6-node .ic{width:40px;height:40px;flex:none;position:relative}
.p6-node .t{font-size:12.5px;font-weight:700;color:${INK};white-space:nowrap}
.p6-node .s{font-size:9.5px;color:${INK2};margin-top:2px;white-space:nowrap}
/* ab_compare / kinetic_meter */
.pc-side{top:58px;width:206px;height:300px;border-radius:20px;padding:16px 16px}
.pc-it{display:flex;align-items:center;gap:8px;height:30px;font-size:12.5px;white-space:nowrap}
.pc-dot{width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
`;
  function ensureCSS(doc) {
    if (!doc || doc.getElementById('fx-paper-flows-css')) return;
    const st = doc.createElement('style'); st.id = 'fx-paper-flows-css'; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* =====================================================================
     P01 · paper_funnel  瑞士精印 + 磨砂亚克力多源漏斗
     ===================================================================== */
  function P01(p, u, T, d) {
    const R = '#E11D48', GR = '#0F9D76';
    const kQ = seg(p, 0, 0.14), kSt = seg(p, 0.1, 0.2);
    const q = d.query;
    const shown = q.slice(0, Math.round(q.length * eo(kQ)));
    const srcs = [
      { n: 'Reddit', c: d.counts[0], x: 94, bg: 'linear-gradient(160deg,#ff7a3d,#ff4500 60%,#e03d00)', ic: ICON.reddit },
      { n: 'Hacker News', c: d.counts[1], x: 190, bg: 'linear-gradient(160deg,#ff9440,#ff6600 60%,#e05a00)', ic: ICON.hn },
      { n: 'GitHub', c: d.counts[2], x: 286, bg: 'linear-gradient(160deg,#3a4049,#161b22)', ic: ICON.gh },
      { n: 'X', c: d.counts[3], x: 382, bg: 'linear-gradient(160deg,#2a2a2e,#000)', ic: ICON.x }
    ];
    const kS = srcs.map((_, i) => seg(p, 0.12 + i * 0.045, 0.26 + i * 0.045));
    const kFlow = seg(p, 0.3, 0.5), kF = seg(p, 0.34, 0.52), kRej = seg(p, 0.48, 0.68), kOut = seg(p, 0.6, 0.76);
    const kR = [0, 1, 2].map((i) => seg(p, 0.7 + i * 0.06, 0.86 + i * 0.05));
    let h = '';
    const spin = (p * 900) % 360;
    h += `<div class="pf-ab pf-card p1-q" style="${fx(kQ, { dy: -8 })}">
      <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="${INK2}" stroke-width="1.6"/><path d="M11 11 L14 14" stroke="${INK2}" stroke-width="1.6" stroke-linecap="round"/></svg>
      <div class="txt">${esc(shown)}${p < 0.32 ? `<i style="display:inline-block;width:1.5px;height:15px;background:${T};margin-left:2px;vertical-align:-2px"></i>` : ''}</div>
      <div class="pf-pill" style="height:30px;padding:0 10px;border-radius:10px;font-size:11px;opacity:${f2(kSt)};${p < 0.62 ? `color:${T};background:${hexA(T, 0.07)};box-shadow:inset 0 0 0 1px ${hexA(T, 0.25)}` : `color:${GR};background:${hexA(GR, 0.08)};box-shadow:inset 0 0 0 1px ${hexA(GR, 0.28)}`}">${p < 0.62
        ? `<svg width="11" height="11" viewBox="0 0 12 12" style="transform:rotate(${f2(spin)}deg)"><circle cx="6" cy="6" r="4.5" fill="none" stroke="${hexA(T, 0.2)}" stroke-width="1.6"/><path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke="${T}" stroke-width="1.6" stroke-linecap="round"/></svg>抓取 4 源`
        : `${CHECK(GR, 1.8)}已完成`}</div></div>`;

    let sv = `<defs>
      <linearGradient id="${u}fb" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".96"/><stop offset=".3" stop-color="#F4F6FA" stop-opacity=".62"/><stop offset=".7" stop-color="#EEF1F6" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>
      <linearGradient id="${u}fv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T}" stop-opacity=".10"/><stop offset="1" stop-color="${T}" stop-opacity=".02"/></linearGradient>
      <linearGradient id="${u}rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${INK}" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="${INK}" stop-opacity=".22"/></linearGradient>
      <radialGradient id="${u}in" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="${tint(T, 0.55)}" stop-opacity=".95"/><stop offset=".6" stop-color="#E7EAF1"/><stop offset="1" stop-color="#D9DDE6"/></radialGradient>
      <linearGradient id="${u}st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T}" stop-opacity=".25"/><stop offset="1" stop-color="${T}"/></linearGradient>
    </defs>`;
    srcs.forEach((s, i) => {
      const ex = 238 + (s.x - 238) * 0.42;
      const P = [[s.x, 160], [s.x, 184], [ex, 176], [ex, 202]];
      const k = seg(kFlow, i * 0.08, 0.7 + i * 0.08);
      sv += beam(P, k, T, { grad: `url(#${u}st)`, w: 1.5, spark: null, base: 0.12 });
      if (k > 0) for (let j = 0; j < 2; j++) {
        const t = ((p * 2.2 + i * 0.27 + j * 0.5) % 1) * k;
        const [x, y] = bz(P, t);
        sv += `<circle cx="${f2(x)}" cy="${f2(y)}" r="${j ? 2 : 2.6}" fill="#fff" stroke="${T}" stroke-width="1.2" style="filter:drop-shadow(0 0 3px ${hexA(T, 0.7)})"/>`;
      }
    });
    const fy = (1 - eo(kF)) * 16;
    sv += `<g transform="translate(0 ${f2(fy)})" opacity="${f2(clamp(kF * 1.5))}">
      <ellipse cx="238" cy="316" rx="84" ry="8" fill="${INK}" opacity=".16" style="filter:blur(6px)"/>
      <ellipse cx="238" cy="306" rx="34" ry="9" fill="${T}" opacity="${f2(0.22 * kOut)}" style="filter:blur(7px)"/>
      <ellipse cx="238" cy="204" rx="116" ry="16" fill="url(#${u}in)"/>
      <path d="M122 204 C 134 236, 210 258, 222 280 L222 296 Q238 302 254 296 L254 280 C 266 258, 342 236, 354 204 A116 16 0 0 1 122 204 Z" fill="url(#${u}fb)"/>
      <path d="M122 204 C 134 236, 210 258, 222 280 L222 296 Q238 302 254 296 L254 280 C 266 258, 342 236, 354 204" fill="url(#${u}fv)" stroke="${INK}" stroke-opacity=".16" stroke-width="1"/>
      <ellipse cx="238" cy="230" rx="84" ry="8" fill="none" stroke="${T}" stroke-opacity=".5" stroke-dasharray="2 3"/>
      <ellipse cx="238" cy="256" rx="42" ry="5" fill="none" stroke="${T}" stroke-opacity=".5" stroke-dasharray="2 3"/>
      <path d="M134 212 C 150 236, 202 258, 224 282" fill="none" stroke="#fff" stroke-opacity="1" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M346 214 C 332 234, 286 252, 266 268" fill="none" stroke="${INK}" stroke-opacity=".08" stroke-width="1"/>
      <path d="M122 204 A116 16 0 0 0 354 204" fill="none" stroke="${INK}" stroke-opacity=".14" stroke-width="1"/>
      <path d="M122 204 A116 16 0 0 1 354 204" fill="none" stroke="url(#${u}rim)" stroke-width="1.6"/>
      <path d="M226 296 Q238 300 250 296" fill="none" stroke="${T}" stroke-opacity=".8" stroke-width="1.4"/>
    </g>`;
    if (kOut > 0) sv += `<line x1="238" y1="300" x2="238" y2="${f2(300 + 8 * eo(kOut))}" stroke="${T}" stroke-width="2" style="filter:drop-shadow(0 0 3px ${hexA(T, 0.6)})"/>`;
    h += `<svg class="pf-ov" width="${W}" height="${H}">${sv}</svg>`;
    srcs.forEach((s, i) => {
      h += `<div class="pf-ab p1-src" style="left:${s.x}px;${fx(kS[i], { dy: 14, s: 0.7 })}">
        <div class="p1-ic" style="background:${s.bg}">${s.ic}</div>
        <div class="nm">${s.n}</div><div class="ct pf-mono">${esc(s.c)}</div></div>`;
    });
    h += `<div class="pf-ab" style="left:138px;width:200px;text-align:center;top:${f2(214 + fy)}px;opacity:${f2(seg(p, 0.42, 0.56))}">
       <div style="font-size:10.5px;color:${INK2};letter-spacing:1px">${esc(d.filterLabel)}</div>
       <div class="pf-num" style="margin-top:11px;font-size:17px;font-weight:800;color:${INK}"><span style="color:${T}">${esc(d.noise)}</span><span style="font-size:10px;color:${INK2};margin-left:4px;font-weight:500">噪音</span></div></div>`;
    const rej = [[d.reject[0], 184, 232, 56, 246, -12], [d.reject[1], 256, 226, 398, 232, 9], [d.reject[2], 198, 262, 62, 286, -6], [d.reject[3], 270, 262, 404, 284, 7]];
    rej.forEach(([t, x0, y0, x1, y1, r], i) => {
      const k = seg(kRej, i * 0.1, 0.6 + i * 0.1); if (k <= 0) return;
      const e = eo(k), x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(e * Math.PI) * 14;
      h += `<div class="pf-ab p1-rej" style="left:${f2(x - 30)}px;top:${f2(y - 11)}px;transform:rotate(${f2(r * e)}deg);opacity:${f2(Math.min(1, k * 3))}">
        <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 2 L8 8 M8 2 L2 8" stroke="${R}" stroke-width="1.6" stroke-linecap="round"/></svg><s>${esc(t)}</s></div>`;
    });
    const rows = d.rows, mx = Math.max(...rows.map((r) => r[1]));
    h += `<div class="pf-ab pf-card lift p1-brief" style="${fx(kOut, { dy: -18, s: 0.9 })};transform-origin:50% 0%">
      <div class="p1-bh"><div style="width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,${tint(T, 0.2)},${shade(T, 0.15)});box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 6px 14px -4px ${hexA(T, 0.55)}"><svg width="15" height="15" viewBox="0 0 16 16"><rect x="3" y="1.5" width="10" height="13" rx="2" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg></div>
        <div><div style="font-size:13.5px;font-weight:700;color:${INK}">${esc(d.briefTitle)}</div><div style="font-size:10px;color:${INK3};margin-top:2px">${esc(d.briefSub)}</div></div>
        <div class="pf-pill pf-mono" style="margin-left:auto;height:22px;padding:0 9px;border-radius:7px;font-size:10px;font-weight:700;color:${GR};background:${hexA(GR, 0.08)};box-shadow:inset 0 0 0 1px ${hexA(GR, 0.3)}"><i style="width:5px;height:5px;border-radius:50%;background:${GR}"></i>READY</div></div>
      <div style="margin-top:6px">${rows.map((r, i) => `<div class="p1-row" style="opacity:${f2(clamp(kR[i] * 2))}"><span class="rk pf-mono">0${i + 1}</span><span>${esc(r[0])}</span><span class="tr"><b style="width:${f2(r[1] / mx * 100 * eo(kR[i]))}%;background:linear-gradient(90deg,${T},${tint(T, 0.45)})"></b></span><span class="pc pf-num" style="color:${T}">${Math.round(r[1] * eo(kR[i]))}%</span></div>`).join('')}</div>
    </div>`;
    return h;
  }

  /* =====================================================================
     P02 · paper_router  工业设计实体键帽 + 精密分流路由
     ===================================================================== */
  function P02(p, u, T, d) {
    const G = '#D97706', LED = '#F59E0B';
    const kDeck = seg(p, 0, 0.12), kPress = seg(p, 0.12, 0.19), kRel = seg(p, 0.2, 0.28);
    const press = kPress * (1 - 0.7 * kRel);
    const kPal = seg(p, 0.18, 0.32), kFib = seg(p, 0.3, 0.42), kCore = seg(p, 0.36, 0.5), kBr = seg(p, 0.48, 0.62);
    const kUp = seg(p, 0.56, 0.72), kDn = seg(p, 0.64, 0.82), kL = [0, 1, 2].map((i) => seg(p, 0.74 + i * 0.07, 0.84 + i * 0.07));
    let h = '';
    const q = d.query;
    const qs = q.slice(0, Math.round(q.length * eo(seg(kPal, 0.2, 1))));
    h += `<div class="pf-ab pf-card lift p2-pal" style="${fx(kPal, { dy: 10, s: 0.96 })};transform-origin:20% 100%">
      <div class="p2-ps"><svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="${INK3}" stroke-width="1.6"/><path d="M11 11 L14 14" stroke="${INK3}" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span>${esc(qs)}<span style="display:inline-block;width:1.5px;height:13px;background:${T};vertical-align:-2px;margin-left:1px;opacity:${p < 0.5 ? 1 : 0}"></span></span><span class="p2-kbd pf-mono">⌘K</span></div>
      <div class="p2-pr" style="color:${INK};background:${hexA(T, 0.08)};box-shadow:inset 0 0 0 1px ${hexA(T, 0.24)}"><span class="p2-pri" style="background:linear-gradient(160deg,${tint(T, 0.15)},${shade(T, 0.12)});box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 3px 6px -2px ${hexA(T, 0.5)}"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1 L7.2 4.8 L11 6 L7.2 7.2 L6 11 L4.8 7.2 L1 6 L4.8 4.8 Z" fill="#fff"/></svg></span>${esc(d.row1)}<span class="p2-kbd pf-mono" style="margin-left:auto">↵</span></div>
      <div class="p2-pr"><span class="p2-pri" style="background:#F4F1EA;box-shadow:inset 0 0 0 1px #E4DED1"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 3h8M2 6h5M2 9h7" stroke="${INK2}" stroke-width="1.3" stroke-linecap="round"/></svg></span>${esc(d.row2)}<span class="pf-mono" style="margin-left:auto;font-size:10px;color:${INK3}">Fast</span></div>
    </div>`;
    const keyHTML = (x, g) => {
      const dd = 6 - 4 * press;
      return `<div class="pf-ab p2-key" style="left:${x}px;transform:translateY(${f2(4 * press)}px);box-shadow:0 ${f2(dd)}px 0 #BDB6A8,0 ${f2(dd + 5)}px 12px rgba(20,22,29,.22),inset 0 1px 0 #fff,inset 0 0 0 1px rgba(20,22,29,.06)">
        <div class="top">${g}</div>
        <div class="p2-led" style="background:${press > 0.2 ? LED : '#D6CFC0'};box-shadow:${press > 0.2 ? `0 0 5px ${LED},0 0 12px ${hexA(LED, 0.7)}` : 'inset 0 1px 1px rgba(20,22,29,.2)'}"></div></div>`;
    };
    h += `<div class="pf-ab p2-deck" style="${fx(kDeck, { dy: 16 })}">${keyHTML(14, '⌘')}${keyHTML(86, 'K')}</div>`;
    h += `<div class="pf-ab pf-mono" style="left:22px;top:266px;font-size:10px;color:${INK3};letter-spacing:.5px;opacity:${f2(kDeck)}">⌘K · ${esc(d.keyHint)}</div>`;
    let sv = `<defs><linearGradient id="${u}gu" x1="0" x2="1"><stop offset="0" stop-color="${T}" stop-opacity=".3"/><stop offset="1" stop-color="${T}"/></linearGradient>
      <linearGradient id="${u}gd" x1="0" x2="1"><stop offset="0" stop-color="${G}" stop-opacity=".3"/><stop offset="1" stop-color="${G}"/></linearGradient></defs>`;
    sv += beam([[184, 207], [200, 207], [204, 208], [220, 208]], kFib, T, { w: 2, spark: kFib < 1 ? kFib : null });
    sv += beam([[306, 186], [326, 166], [316, 96], [334, 90]], kBr, T, { grad: `url(#${u}gu)`, w: 1.8, spark: kBr < 1 ? kBr : ((p * 1.5) % 1) });
    sv += beam([[306, 230], [326, 250], [316, 346], [334, 352]], seg(kBr, 0.15, 1), G, { grad: `url(#${u}gd)`, w: 1.8, spark: kBr < 1 ? seg(kBr, 0.15, 1) : ((p * 1.5 + 0.5) % 1) });
    h += `<svg class="pf-ov" width="${W}" height="${H}">${sv}</svg>`;
    const rot = p * 260;
    const ticks = [0, 90, 180, 270].map((a) => `<div style="position:absolute;left:45px;top:3px;width:2px;height:7px;border-radius:1px;background:${INK};opacity:.55;transform-origin:1px 43px;transform:rotate(${a}deg)"></div>`).join('');
    h += `<div class="pf-ab p2-core" style="${fx(kCore, { dy: 0, s: 0.6 })}">
      <div style="position:absolute;inset:-16px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,${hexA(T, 0.16)},transparent 70%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(90% 90% at 35% 25%,#FFFFFF,#F3F0E8 55%,#E2DDD1);box-shadow:inset 0 1px 0 #fff,inset 0 -3px 6px rgba(20,22,29,.08),0 0 0 1px rgba(20,22,29,.1),0 16px 28px -12px rgba(20,22,29,.42)"></div>
      <div style="position:absolute;inset:5px;border-radius:50%;background:repeating-conic-gradient(rgba(20,22,29,.32) 0 1.1deg,transparent 1.1deg 10deg);-webkit-mask:radial-gradient(circle,transparent 36px,#000 36.5px,#000 40px,transparent 40.5px);mask:radial-gradient(circle,transparent 36px,#000 36.5px,#000 40px,transparent 40.5px)"></div>
      ${ticks}
      <svg class="pf-ov" width="92" height="92" style="transform:rotate(${f2(rot)}deg)"><circle cx="46" cy="46" r="32" fill="none" stroke="${T}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="40 161"/><circle cx="46" cy="46" r="32" fill="none" stroke="${G}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="16 185" stroke-dashoffset="-100"/></svg>
      <div style="position:absolute;inset:19px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(80% 80% at 50% 20%,#FFFFFF,#F6F3EC 70%);box-shadow:inset 0 0 0 1px ${hexA(T, 0.35)},inset 0 2px 4px rgba(20,22,29,.06),0 2px 6px rgba(20,22,29,.08)">
        <div style="width:7px;height:7px;border-radius:50%;background:${T};box-shadow:0 0 0 3px ${hexA(T, 0.15)},0 0 8px ${hexA(T, 0.7)}"></div>
        <div class="pf-mono" style="font-size:8.5px;letter-spacing:1px;color:${INK2};margin-top:5px">ROUTER</div></div>
    </div>`;
    h += `<div class="pf-ab" style="left:204px;top:266px;width:124px;text-align:center;opacity:${f2(seg(p, 0.46, 0.56))}"><div style="font-size:12px;font-weight:700;color:${INK}">意图识别</div><div class="pf-mono" style="font-size:9.5px;color:${T};margin-top:2px">置信度 0.97</div></div>`;
    const pl = 1 - eo(kUp);
    h += `<div class="pf-ab pf-card lift p2-card" style="left:334px;top:24px;height:134px;${fx(kUp, { dx: -14, dy: 0 })}">
      <div style="display:flex;align-items:center"><div style="width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${hexA(T, 0.08)};box-shadow:inset 0 0 0 1px ${hexA(T, 0.25)}">
        <svg width="18" height="18" viewBox="0 0 24 24" style="transform:translate(${f2(-8 * pl)}px,${f2(8 * pl)}px)"><path d="M22 2 L2 10.5 L9.5 13.2 Z" fill="${tint(T, 0.35)}"/><path d="M22 2 L9.5 13.2 L12.2 21 Z" fill="${T}"/><path d="M9.5 13.2 L10.4 18.4 L12.2 21 Z" fill="${shade(T, 0.3)}"/></svg></div>
        <span class="pf-tag" style="margin-left:auto;color:#fff;background:${T};box-shadow:0 3px 8px -2px ${hexA(T, 0.55)}">FAST</span></div>
      <div style="margin-top:9px;font-size:13px;font-weight:700">${esc(d.fastName)}</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:4px">
        <div class="pf-num" style="font-size:28px;font-weight:700;letter-spacing:-.5px;line-height:1">${esc(d.fastV)}<span style="font-size:15px;color:${T};margin-left:1px">s</span></div>
        <div style="display:flex;align-items:flex-end;gap:3px;height:22px">${[6, 9, 5, 12, 8, 14, 7].map((v, i) => `<i style="display:block;width:3px;border-radius:1px;height:${f2(v * 1.4 * clamp(kUp * 2 - i * 0.08))}px;background:linear-gradient(180deg,${T},${hexA(T, 0.3)})"></i>`).join('')}</div></div>
    </div>`;
    const steps = d.steps;
    h += `<div class="pf-ab pf-card lift p2-card" style="left:334px;top:270px;height:172px;${fx(kDn, { dx: -14, dy: 0 })}">
      <div style="display:flex;align-items:center"><svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${f2(p * 140)}deg);filter:drop-shadow(0 3px 4px rgba(180,83,9,.35))"><defs><linearGradient id="${u}gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCD38A"/><stop offset=".5" stop-color="${G}"/><stop offset="1" stop-color="#92400E"/></linearGradient></defs><path d="${gearPath(17, 17, 16, 12.2, 10, 4.6)}" fill="url(#${u}gg)" fill-rule="evenodd"/><circle cx="17" cy="17" r="9" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>
        <span class="pf-tag" style="margin-left:auto;color:#fff;background:${G};box-shadow:0 3px 8px -2px ${hexA(G, 0.55)}">DEEP</span></div>
      <div style="margin-top:8px;font-size:13px;font-weight:700">${esc(d.deepName)}</div>
      <div style="margin-top:6px">${steps.map((s, i) => {
        const k = seg(kDn, 0.35 + i * 0.2, 0.6 + i * 0.2), done = i < steps.length - 1 ? k >= 1 : false;
        const ic = done ? `<span style="width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${G};box-shadow:0 2px 4px -1px ${hexA(G, 0.6)}">${CHECK('#fff', 2.2)}</span>`
          : `<span style="width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1.5px ${hexA(G, 0.3)};background:conic-gradient(${G} ${f2(((p * 3) % 1) * 360)}deg,transparent 0);-webkit-mask:radial-gradient(circle,transparent 4.5px,#000 5px);mask:radial-gradient(circle,transparent 4.5px,#000 5px)"></span>`;
        return `<div class="p2-step" style="opacity:${f2(clamp(k * 2))}">${ic}<span>${esc(s[0])}</span><span class="t pf-mono">${esc(s[1])}</span></div>`;
      }).join('')}</div>
    </div>`;
    const logs = d.logs;
    h += `<div class="pf-ab p2-log" style="${fx(seg(p, 0.7, 0.8), { dy: 12, s: 0.97 })}">
      <div class="p2-lh pf-mono"><i></i><i></i><i></i><span style="margin-left:4px">routing.log</span><span style="margin-left:auto;color:${T};display:flex;align-items:center;gap:5px"><b style="width:5px;height:5px;border-radius:50%;background:${T};box-shadow:0 0 0 2px ${hexA(T, 0.18)}"></b>LIVE</span></div>
      ${logs.map((l, i) => { const c = l[2] === 'DEEP' ? G : T; return `<div class="p2-ll pf-mono" style="${fx(kL[i], { dy: 6, s: 1, noBack: true })}"><span>${esc(l[0])}</span><span class="q">${esc(l[1])}</span><span class="tg" style="color:${c};background:${hexA(c, 0.1)};box-shadow:inset 0 0 0 1px ${hexA(c, 0.28)}">${l[2]}</span><span class="v">${esc(l[3])}</span></div>`; }).join('')}
    </div>`;
    return h;
  }

  /* =====================================================================
     P03 · paper_remote  Apple 浅色工业风 · 银白 iPhone → MacBook 跨端接力
     ===================================================================== */
  function P03(p, u, T, d) {
    const GR = '#0F9D76';
    const kPh = seg(p, 0, 0.12), rec = seg(p, 0.06, 0.12) * (1 - seg(p, 0.28, 0.34));
    const kVoice = seg(p, 0.16, 0.26), kTr = seg(p, 0.22, 0.32), kOut = seg(p, 0.28, 0.42), kMon = seg(p, 0.32, 0.46);
    const kLines = [0, 1, 2, 3, 4, 5].map((i) => seg(p, 0.44 + i * 0.05, 0.5 + i * 0.05));
    const kRet = seg(p, 0.74, 0.86), kBan = seg(p, 0.84, 0.96), kReply = seg(p, 0.4, 0.48);
    let h = '';
    h += `<div class="pf-ab p3-lbl" style="left:30px;top:124px;opacity:${f2(kPh)}"><i style="background:${T};box-shadow:0 0 0 2px ${hexA(T, 0.18)}"></i>iPhone · 你在外面</div>`;
    h += `<div class="pf-ab p3-lbl" style="left:372px;top:222px;opacity:${f2(kMon)}"><i style="background:${GR};box-shadow:0 0 0 2px ${hexA(GR, 0.18)}"></i>MacBook · 家里</div>`;
    let sv = `<defs><linearGradient id="${u}to" x1="0" x2="1"><stop offset="0" stop-color="${T}" stop-opacity=".25"/><stop offset="1" stop-color="${T}"/></linearGradient>
      <linearGradient id="${u}tr" x1="1" x2="0"><stop offset="0" stop-color="${GR}" stop-opacity=".25"/><stop offset="1" stop-color="${GR}"/></linearGradient></defs>`;
    sv += beam([[156, 262], [186, 262], [178, 150], [210, 132]], kOut, T, { grad: `url(#${u}to)`, w: 2, spark: kOut < 1 ? kOut : null, base: 0.18 });
    sv += beam([[318, 210], [300, 312], [214, 318], [158, 318]], kRet, GR, { grad: `url(#${u}tr)`, w: 2, spark: kRet < 1 ? kRet : null, base: 0.18 });
    sv += `<ellipse cx="326" cy="212" rx="140" ry="7" fill="${INK}" style="filter:blur(7px);opacity:${f2(kMon * 0.22)}"/>`;
    h += `<svg class="pf-ov" width="${W}" height="${H}">${sv}</svg>`;
    const lines = [
      `<span style="color:${GR}">laowang@MacBook</span> <span style="color:#2563EB">~</span> <span style="color:${INK3}">$</span> claude <span style="color:#B45309">"${esc(d.cmd)}"</span>`,
      `<span style="color:#2563EB">›</span> 读取 git log <span style="color:${INK3}">·</span> <span style="color:#7C3AED">32</span> commits`,
      `<span style="color:#2563EB">›</span> 汇总 Jira 进度 <span style="color:${INK3}">·</span> <span style="color:#7C3AED">8</span> 项`,
      `<span style="color:#2563EB">›</span> 生成图表 <span style="color:#B45309">chart.png</span>`,
      `<span style="color:${GR}">✓</span> 写入 <span style="color:#B45309">${esc(d.file)}</span>`,
      `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${GR};box-shadow:0 0 0 2px ${hexA(GR, 0.2)};margin-right:5px"></span><span style="color:${GR};font-weight:700">Done in 41s</span> <span style="color:${INK3}">· 已推送到手机</span>`
    ];
    const prog = eo(seg(p, 0.46, 0.72));
    const monT = fx(kMon, { dy: 14, s: 0.92 });
    h += `<div class="pf-ab p3-lid" style="${monT}"><div class="p3-bezel"><div class="p3-wall">
        <div class="p3-term"><div class="p3-tb"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="pf-mono">zsh — 80×24</span></div>
        <div style="padding-top:5px">${lines.slice(0, 5).map((l, i) => `<div class="p3-tl pf-mono" style="${fx(kLines[i], { dy: 4, dx: -6, s: 1, noBack: true })}">${l}</div>`).join('')}
          <div style="margin:3px 9px 2px;height:4px;border-radius:2px;background:#EFECE5;overflow:hidden;opacity:${f2(clamp(kLines[0] * 2))}"><div style="height:100%;width:${f2(prog * 100)}%;border-radius:2px;background:linear-gradient(90deg,${T},${tint(T, 0.45)})"></div></div>
          <div class="p3-tl pf-mono" style="${fx(kLines[5], { dy: 4, s: 1, noBack: true })}">${lines[5]}</div></div></div>
        <div style="position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.35),transparent 38%);pointer-events:none"></div>
        <div style="position:absolute;left:50%;top:0;width:44px;height:6px;margin-left:-22px;border-radius:0 0 5px 5px;background:#0D0E11"></div>
      </div></div></div>`;
    h += `<div class="pf-ab p3-base" style="${monT}"><div class="p3-notch"></div></div>`;
    const isW = 34 + 52 * rec + 34 * seg(p, 0.42, 0.5) * (1 - seg(p, 0.84, 0.9));
    let islandIn = '';
    if (rec > 0.05) {
      islandIn = `<span style="width:6px;height:6px;border-radius:50%;background:#ff3b30;margin-right:5px"></span>` +
        Array.from({ length: 9 }, (_, i) => `<b style="height:${f2(3 + 10 * rec * Math.abs(Math.sin(p * 46 + i * 1.25)))}px;background:linear-gradient(180deg,${tint(T, 0.5)},${T})"></b>`).join('');
    } else if (p > 0.42 && p < 0.88) {
      islandIn = `<span class="pf-mono" style="font-size:7.5px;color:#fff;display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:conic-gradient(${tint(T, 0.35)} ${f2(prog * 360)}deg,rgba(255,255,255,.18) 0);-webkit-mask:radial-gradient(circle,transparent 2.5px,#000 3px);mask:radial-gradient(circle,transparent 2.5px,#000 3px)"></span>Mac 运行中</span>`;
    }
    h += `<div class="pf-ab p3-ph" style="${fx(kPh, { dy: 20, s: 0.9 })}">
      <div class="p3-btn" style="left:-2px;top:62px;height:18px"></div><div class="p3-btn" style="left:-2px;top:90px;height:30px"></div><div class="p3-btn" style="left:auto;right:-2px;top:84px;height:40px"></div>
      <div class="p3-bz"><div class="p3-scr">
        <div style="position:absolute;inset:0;background:radial-gradient(110% 50% at 20% 0%,${hexA(T, 0.12)},transparent 60%)"></div>
        <div class="p3-island" style="width:${f2(isW)}px;margin-left:${f2(-isW / 2)}px">${islandIn}</div>
        <div style="position:absolute;left:0;right:0;top:36px;text-align:center;font-size:9px;color:${INK3}">AI 助手</div>
        <div class="p3-bub" style="right:7px;top:92px;width:82px;height:28px;display:flex;align-items:center;gap:2px;background:linear-gradient(160deg,${tint(T, 0.12)},${shade(T, 0.1)});box-shadow:0 6px 12px -4px ${hexA(T, 0.55)};${fx(kVoice, { dy: 8, s: 0.8 })};transform-origin:100% 100%">
          ${Array.from({ length: 11 }, (_, i) => `<b style="display:block;width:2px;border-radius:1px;background:#fff;height:${f2(3 + 9 * Math.abs(Math.sin(i * 1.7 + 0.6)))}px"></b>`).join('')}<span class="pf-mono" style="margin-left:auto;font-size:8.5px;color:#fff">0:03</span></div>
        <div class="p3-bub" style="right:7px;top:126px;width:96px;color:${INK};background:#fff;box-shadow:inset 0 0 0 1px ${LINE},0 4px 10px -6px rgba(20,22,29,.3);${fx(kTr, { dy: 6, s: 0.9 })}">“${esc(d.voice)}”</div>
        <div class="p3-bub" style="left:7px;top:178px;white-space:nowrap;color:${shade(GR, 0.2)};background:${hexA(GR, 0.1)};box-shadow:inset 0 0 0 1px ${hexA(GR, 0.28)};${fx(kReply, { dy: 6, s: 0.9 })}">已派发到 Mac ✓</div>
        <div style="position:absolute;left:50%;bottom:14px;width:34px;height:34px;margin-left:-17px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,${tint(T, 0.15)},${shade(T, 0.12)});box-shadow:0 0 0 ${f2(4 + 6 * rec)}px ${hexA(T, 0.12 + 0.1 * rec)},0 8px 16px -4px ${hexA(T, 0.55)}">
          <svg width="12" height="14" viewBox="0 0 12 14"><rect x="3.5" y="1" width="5" height="8" rx="2.5" fill="#fff"/><path d="M1.5 7 a4.5 4.5 0 0 0 9 0 M6 11.5 V13" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg></div>
        <div style="position:absolute;left:50%;bottom:4px;width:40px;height:3px;margin-left:-20px;border-radius:2px;background:rgba(20,22,29,.35)"></div>
      </div></div></div>`;
    h += `<div class="pf-ab p3-ban" style="${fx(kBan, { dy: -16, s: 0.8 })};transform-origin:30% 0%">
      <div style="width:28px;height:28px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#34D399,#0F9D76);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 4px 10px -2px ${hexA(GR, 0.5)}">${CHECK('#fff', 2.2)}</div>
      <div style="min-width:0"><div style="font-size:12px;font-weight:700;color:${INK};white-space:nowrap">已完成 · 点击预览</div><div class="pf-mono" style="font-size:8.5px;color:${INK2};margin-top:2px;white-space:nowrap">${esc(d.file)} · 刚刚</div></div></div>`;
    const stp = [['语音指令', '0:03', 0.2], ['跨端派发', '0.2s', 0.42], ['本机执行', '41s', 0.74], ['结果回传', '✓', 0.9]];
    const fill = clamp((p - 0.2) / 0.7);
    h += `<div class="pf-ab pf-card p3-tlc" style="${fx(seg(p, 0.18, 0.3), { dy: 10, s: 0.97 })}">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:${INK2}"><span>接力时间线</span><span class="pf-mono" style="color:${fill >= 1 ? GR : INK3};font-weight:${fill >= 1 ? 700 : 400}">${fill >= 1 ? '全程 44s ✓' : '进行中…'}</span></div>
      <div style="position:absolute;left:42px;right:42px;top:51px;height:2px;border-radius:1px;background:#ECE7DC"><div style="height:100%;width:${f2(fill * 100)}%;border-radius:1px;background:linear-gradient(90deg,${T},${GR})"></div></div>
      ${stp.map((s, i) => { const on = p >= s[2]; const c = i === 3 ? GR : T; return `<div class="p3-stp" style="left:${42 + i * 60}px"><div class="d" style="background:${on ? c : '#fff'};box-shadow:${on ? `0 0 0 3px ${hexA(c, 0.16)},0 2px 4px ${hexA(c, 0.4)}` : `inset 0 0 0 1.5px ${LINE}`}"></div><div class="a" style="opacity:${on ? 1 : 0.45}">${s[0]}</div><div class="b pf-mono">${s[1]}</div></div>`; }).join('')}
    </div>`;
    return h;
  }

  /* =====================================================================
     P04 · paper_slabs  2.5D 精装厚卡纸 + 磨砂玻璃等轴测三层架构
     ===================================================================== */
  function P04(p, u, T, d) {
    const a = 0.92, b = 0.4, Wd = 150, Th = 18, cx = 150;
    const layers = [
      { y: 262, k: seg(p, 0.0, 0.26), tag: 'L1', name: d.layers[0][0], sub: d.layers[0][1], mat: 'board' },
      { y: 146, k: seg(p, 0.3, 0.54), tag: 'L2', name: d.layers[1][0], sub: d.layers[1][1], mat: 'glass' },
      { y: 30, k: seg(p, 0.56, 0.8), tag: 'L3', name: d.layers[2][0], sub: d.layers[2][1], mat: 'board' }
    ];
    const icoC = INK2;
    const content = [
      () => {
        const tiles = [
          `<svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="${icoC}" stroke-width="1.6"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4.5" stroke="${icoC}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
          `<svg width="22" height="22" viewBox="0 0 24 24">${[4, 8, 12, 16, 20].map((x, i) => `<line x1="${x}" x2="${x}" y1="${12 - [3, 7, 9, 5, 2][i]}" y2="${12 + [3, 7, 9, 5, 2][i]}" stroke="${icoC}" stroke-width="2" stroke-linecap="round"/>`).join('')}</svg>`,
          `<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="${icoC}" stroke-width="1.6"/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" fill="none" stroke="${icoC}" stroke-width="1.3"/></svg>`,
          `<svg width="22" height="22" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="${icoC}" stroke-width="1.6"/><path d="M5.5 16.5 l4.5-5 3.5 3.5 2-2 3 3.5" fill="none" stroke="${icoC}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="16" cy="9" r="1.5" fill="${icoC}"/></svg>`
        ];
        return `<div style="position:absolute;inset:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">${tiles.map((t, i) => `<div style="border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFFFFF,#F6F2E9);box-shadow:inset 0 0 0 1px ${LINE},0 3px 6px rgba(20,22,29,.08);opacity:${f2(clamp(layers[0].k * 2.4 - i * 0.25))}">${t}</div>`).join('')}</div>`;
      },
      () => {
        const bars = [[90, 0], [62, 1], [100, 0], [48, 1], [78, 0], [86, 0]];
        const scan = seg(p, 0.42, 0.62);
        return `<div style="position:absolute;inset:18px 16px">${bars.map(([w, bad], i) => {
          const gone = bad && scan > 0.4;
          return `<div style="height:8px;margin-bottom:11px;border-radius:4px;width:${w}%;background:${bad ? (gone ? 'rgba(225,29,72,.14)' : 'rgba(225,29,72,.7)') : `linear-gradient(90deg,${T},${tint(T, 0.5)})`};box-shadow:${bad ? 'none' : `0 2px 4px ${hexA(T, 0.25)}`};opacity:${gone ? 0.6 : 1}"></div>`;
        }).join('')}<div style="position:absolute;top:-6px;bottom:-6px;left:${f2(scan * 100)}%;width:2px;background:${T};box-shadow:0 0 8px ${hexA(T, 0.8)};opacity:${f2(scan > 0 && scan < 1 ? 1 : 0)}"></div></div>`;
      },
      () => {
        const k = seg(p, 0.66, 0.86);
        return `<div style="position:absolute;left:22px;top:18px;width:106px;height:114px;border-radius:8px;padding:10px;background:#fff;box-shadow:inset 0 0 0 1px ${LINE},0 6px 12px rgba(20,22,29,.12)">
          <div style="height:9px;width:70%;border-radius:3px;background:${INK}"></div>
          ${[92, 100, 84, 96, 60].map((w, i) => `<div style="height:5px;margin-top:8px;border-radius:3px;width:${f2(w * clamp(k * 2 - i * 0.18))}%;background:${i === 0 ? T : '#D9D3C6'}"></div>`).join('')}
          <div style="position:absolute;right:-12px;bottom:-10px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#FDE68A,#F59E0B 60%,#B45309);box-shadow:inset 0 0 0 2px rgba(255,255,255,.45),inset 0 0 0 4px rgba(180,83,9,.35),0 6px 14px -4px rgba(180,83,9,.6);transform:scale(${f2(eb(seg(p, 0.78, 0.9)))}) rotate(-12deg)">${CHECK('#fff', 2.4, 18)}</div></div>`;
      }
    ];
    let h = '';
    h += `<div class="pf-ab pf-mono" style="right:16px;top:14px;font-size:9px;letter-spacing:1.5px;color:${INK3};opacity:${f2(layers[0].k)}">ISO · 3-LAYER STACK · A-A</div>`;
    h += `<div class="pf-ab" style="left:${cx - 150}px;top:384px;width:300px;height:48px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,rgba(20,22,29,.28),transparent 72%);opacity:${f2(layers[0].k)}"></div>`;
    layers.forEach((L, i) => {
      const k = L.k; if (k <= 0) return;
      const e = eo(k), dy = (1 - e) * 46, y0 = L.y + dy;
      const active = i === 2 ? seg(p, 0.7, 0.9) : 0.35;
      if (i > 0) {
        const top = y0 + Wd * b + Th, bot = layers[i - 1].y + Wd * b;
        const bk = seg(p, 0.24 + (i - 1) * 0.28, 0.36 + (i - 1) * 0.28);
        const len = (bot - top) * bk;
        h += `<div class="pf-ab" style="left:${cx - 8}px;top:${f2(bot - len)}px;width:16px;height:${f2(len)}px;background:linear-gradient(0deg,${hexA(T, 0.02)},${hexA(T, 0.18)});filter:blur(3px)"></div>`;
        h += `<div class="pf-ab" style="left:${cx - 1.5}px;top:${f2(bot - len)}px;width:3px;height:${f2(len)}px;border-radius:2px;background:linear-gradient(0deg,${hexA(T, 0.15)},${T});box-shadow:0 0 6px ${hexA(T, 0.7)}"></div>`;
        for (let j = 0; j < 3; j++) { const t = (p * 2.4 + j / 3) % 1; if (bk >= 1) h += `<div class="pf-ab" style="left:${cx - 3.5}px;top:${f2(bot - (bot - top) * t - 3.5)}px;width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.5px ${T},0 0 6px ${hexA(T, 0.7)}"></div>`; }
      }
      const op = clamp(k * 1.6);
      const glass = L.mat === 'glass';
      const sh = `<div class="pf-ab" style="left:${cx - 150}px;top:${f2(y0 + 96)}px;width:300px;height:56px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,rgba(20,22,29,${glass ? 0.14 : 0.22}),transparent 72%);opacity:${f2(op)}"></div>`;
      const pages = 'repeating-linear-gradient(180deg,rgba(20,22,29,.06) 0 1px,transparent 1px 3px)';
      const band = (dir) => `<div style="position:absolute;left:0;right:0;top:7px;height:3px;background:linear-gradient(90deg,${dir ? `${T},${hexA(T, 0.55)}` : `${hexA(T, 0.55)},${T}`});opacity:${f2(0.55 + 0.45 * active)}"></div>`;
      const leftSide = `<div class="p4-face p4-side" style="transform:matrix(${a},${b},0,1,${cx - Wd * a},${f2(y0 + Wd * b)});background:${glass ? `linear-gradient(90deg,${hexA(T, 0.10)},${hexA(T, 0.16)}),rgba(255,255,255,.55)` : `${pages},linear-gradient(90deg,#EFE9DC,#E4DCCB)`};box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(20,22,29,.12)">${glass ? '' : band(0)}</div>`;
      const rightSide = `<div class="p4-face p4-side" style="transform:matrix(${a},${-b},0,1,${cx},${f2(y0 + 2 * Wd * b)});background:${glass ? `linear-gradient(90deg,${hexA(T, 0.2)},${hexA(T, 0.12)}),rgba(240,236,228,.6)` : `${pages},linear-gradient(90deg,#DCD3C1,#CFC5B1)`};box-shadow:inset 0 1px 0 rgba(255,255,255,.75),inset 0 -1px 0 rgba(20,22,29,.16)">${glass ? '' : band(1)}</div>`;
      const topBg = glass ? `linear-gradient(135deg,rgba(255,255,255,.82),rgba(244,240,232,.62));backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)` : 'linear-gradient(135deg,#FFFFFF 0%,#FBF8F1 60%,#F2EDE2 100%)';
      const top = `<div class="p4-face p4-top" style="transform:matrix(${a},${b},${-a},${b},${cx},${f2(y0)});background:${topBg};box-shadow:inset 0 0 0 1px ${i === 2 ? hexA(T, 0.25 + 0.45 * active) : (glass ? hexA(T, 0.35) : LINE)},inset 1px 1px 0 #fff">
          ${content[i]()}
          ${i === 2 ? `<div style="position:absolute;top:-20%;bottom:-20%;width:40px;left:${f2(-40 + 230 * seg(p, 0.8, 0.95))}%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.8),transparent);transform:skewX(-20deg)"></div>` : ''}</div>`;
      h += `<div class="pf-ab" style="left:0;top:0;width:${W}px;height:${H}px;opacity:${f2(op)}">${sh}${leftSide}${rightSide}${top}</div>`;
    });
    layers.forEach((L, i) => {
      const k = seg(p, [0.18, 0.46, 0.72][i], [0.32, 0.6, 0.86][i]); if (k <= 0) return;
      const x0 = cx + Wd * a + 4, y = L.y + Wd * b;
      const len = 26 * eo(k);
      h += `<div class="pf-ab" style="left:${x0}px;top:${y}px;width:${f2(len)}px;height:0;border-top:1px solid ${INK};opacity:.55"></div>
        <div class="pf-ab" style="left:${f2(x0 - 3)}px;top:${y - 3}px;width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1.5px ${INK}"></div>
        <div class="pf-ab" style="left:${f2(x0 + len)}px;top:${y - 5}px;width:1px;height:11px;background:${INK};opacity:${f2(0.55 * k)}"></div>
        <div class="pf-ab p4-lbl" style="left:${x0 + 32}px;top:${y - 17}px;${fx(k, { dx: -8, dy: 0, s: 1 })}"><div class="h"><em class="pf-mono" style="${i === 2 ? `color:#fff;background:${T};box-shadow:none` : ''}">${L.tag}</em>${esc(L.name)}</div><div class="s">${esc(L.sub)}</div></div>`;
    });
    if (p > 0.8) { const r = rand(7); for (let j = 0; j < 7; j++) { const x = cx - 90 + r() * 180, t = (p * 1.5 + r()) % 1; h += `<div class="pf-ab" style="left:${f2(x)}px;top:${f2(130 - t * 100)}px;width:4px;height:4px;border-radius:50%;background:${tint(T, 0.3)};box-shadow:0 0 5px ${hexA(T, 0.7)};opacity:${f2((1 - t) * seg(p, 0.8, 0.9))}"></div>`; } }
    return h;
  }

  /* =====================================================================
     P05 · paper_laser  暖光扫描仪去噪转化 · 乱麻变清单
     ===================================================================== */
  function P05(p, u, T, d) {
    const BLUE = '#2563EB', GOLD = '#F59E0B', RED = '#B91C1C';
    const kCloud = seg(p, 0, 0.22), kLine = seg(p, 0.2, 0.3), kScan = seg(p, 0.28, 0.62);
    const headX = 16 + 444 * eo(kScan);
    let h = '';
    const reg = (x, y) => `<svg class="pf-ov" width="14" height="14" style="left:${x - 7}px;top:${y - 7}px"><circle cx="7" cy="7" r="3.6" fill="none" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/><path d="M7 0 V14 M0 7 H14" stroke="${INK}" stroke-opacity=".4" stroke-width="1"/></svg>`;
    h += `<div class="pf-ab" style="left:0;top:0;width:${W}px;height:180px;opacity:${f2(clamp(kCloud * 2))}">${reg(18, 16)}${reg(458, 16)}${reg(18, 168)}${reg(458, 168)}
      <div class="pf-ab pf-mono" style="left:34px;top:10px;font-size:9px;letter-spacing:1px;color:#E11D48">INPUT · ${esc(d.inN)} FRAGMENTS</div>
      <div class="pf-ab pf-mono" style="right:34px;top:10px;font-size:9px;letter-spacing:1px;color:${INK3}">NOISE 82% ●</div></div>`;
    const r = rand(11); let sv = '';
    for (let i = 0; i < 9; i++) {
      let x = 30 + r() * 60, y = 36 + r() * 120, dd = `M${f2(x)} ${f2(y)}`;
      for (let j = 0; j < 5; j++) { const nx = x + 40 + r() * 70, ny = 34 + r() * 130; dd += ` Q${f2((x + nx) / 2 + (r() - 0.5) * 60)} ${f2((y + ny) / 2 + (r() - 0.5) * 70)} ${f2(nx)} ${f2(ny)}`; x = nx; y = ny; }
      sv += `<path d="${dd}" fill="none" stroke="${i % 3 ? RED : INK}" stroke-opacity="${i % 3 ? 0.32 : 0.12}" stroke-width="${i % 2 ? 0.9 : 1.3}" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - eo(kCloud))}"/>`;
    }
    h += `<svg class="pf-ov" width="${W}" height="${H}" style="opacity:${f2(1 - 0.6 * kScan)}">${sv}</svg>`;
    const frags = d.frags;
    frags.forEach(([t, x, y, rot, dp], i) => {
      const k = seg(kCloud, i * 0.04, 0.5 + i * 0.04); if (k <= 0) return;
      const jit = (1 - eo(k)) * (i % 2 ? 14 : -14);
      const passed = headX > x + 30 && kScan > 0;
      const pk = passed ? clamp((headX - x - 30) / 80) : 0;
      const op = clamp(k * 1.8) * (dp === 2 ? 0.8 : 1) * (1 - 0.5 * pk);
      h += `<div class="p5-frag d${dp}" style="left:${x}px;top:${f2(y + 16 + jit + pk * 6)}px;transform:rotate(${rot}deg) scale(${f2(1 - 0.06 * pk)});opacity:${f2(op)};${pk > 0 ? `filter:grayscale(${f2(pk)}) blur(${f2((dp === 2 ? 0.7 : 0) + pk * 0.9)}px)` : ''}">${esc(t)}</div>`;
    });
    const LY = 192;
    h += `<div class="pf-ab" style="left:16px;top:${LY}px;width:444px;height:1px;background:repeating-linear-gradient(90deg,${hexA(INK, 0.25)} 0 4px,transparent 4px 8px);opacity:${f2(kLine)}"></div>`;
    if (kScan > 0) {
      const w = headX - 16;
      const fade = 1 - 0.7 * seg(p, 0.62, 0.72);
      h += `<div class="pf-ab" style="left:16px;top:${LY - 78}px;width:${f2(w)}px;height:78px;background:linear-gradient(0deg,${hexA(BLUE, 0.16)},${hexA(GOLD, 0.05)} 60%,transparent);-webkit-mask:linear-gradient(90deg,transparent,#000 85%);mask:linear-gradient(90deg,transparent,#000 85%);opacity:${f2(fade)}"></div>`;
      h += `<div class="pf-ab" style="left:16px;top:${LY + 1}px;width:${f2(w)}px;height:22px;background:linear-gradient(180deg,${hexA(GOLD, 0.16)},transparent);-webkit-mask:linear-gradient(90deg,transparent,#000 85%);mask:linear-gradient(90deg,transparent,#000 85%)"></div>`;
      h += `<div class="pf-ab" style="left:16px;top:${LY - 1.5}px;width:${f2(w)}px;height:3px;border-radius:2px;background:linear-gradient(90deg,${hexA(BLUE, 0.3)},${BLUE} 60%,#fff);box-shadow:0 0 4px ${BLUE},0 0 12px ${hexA(GOLD, 0.85)},0 0 26px ${hexA(GOLD, 0.45)}"></div>`;
      const hv = kScan < 1 ? 1 : 1 - seg(p, 0.62, 0.7);
      if (hv > 0) {
        h += `<div class="pf-ab" style="left:${f2(headX - 30)}px;top:${LY - 30}px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff 0%,${hexA(GOLD, 0.75)} 20%,${hexA(BLUE, 0.22)} 46%,transparent 70%);opacity:${f2(hv)}"></div>
          <div class="pf-ab" style="left:${f2(headX - 0.75)}px;top:${LY - 46}px;width:1.5px;height:92px;background:linear-gradient(180deg,transparent,${GOLD},transparent);opacity:${f2(hv * 0.9)}"></div>
          <div class="pf-ab" style="left:${f2(headX - 64)}px;top:${LY - 0.5}px;width:128px;height:1px;background:linear-gradient(90deg,transparent,#fff,transparent);opacity:${f2(hv)}"></div>`;
        const rr = rand(3);
        for (let j = 0; j < 10; j++) { const ang = rr() * Math.PI * 2, dist = 8 + rr() * 26 * ((p * 7 + j * 0.1) % 1); h += `<div class="pf-ab" style="left:${f2(headX + Math.cos(ang) * dist * 1.6)}px;top:${f2(LY + Math.sin(ang) * dist)}px;width:2.5px;height:2.5px;border-radius:50%;background:${j % 2 ? GOLD : BLUE};opacity:${f2(hv * (0.4 + rr() * 0.6))}"></div>`; }
      }
    }
    const kRd = seg(p, 0.6, 0.7);
    h += `<div class="pf-ab pf-mono" style="left:50%;top:${LY - 12}px;height:24px;padding:0 12px;border-radius:999px;display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.5px;color:${INK};white-space:nowrap;background:#fff;box-shadow:inset 0 0 0 1px ${LINE},0 6px 16px -6px ${hexA(BLUE, 0.5)},0 0 0 3px ${hexA(GOLD, 0.12)};transform:translateX(-50%) scale(${f2(0.8 + 0.2 * eb(kRd))});opacity:${f2(kRd)}"><span style="color:${BLUE}">✦</span> 提纯完成 · <b>${esc(d.inN)} → ${d.todos.length}</b></div>`;
    d.todos.forEach((t, i) => {
      const st = 0.5 + i * 0.1, k = seg(p, st, st + 0.13), kc = seg(p, st + 0.1, st + 0.2);
      const y = 212 + i * 78;
      h += `<div class="pf-ab pf-card p5-card" style="top:${y}px;${fx(k, { dy: 18, s: 0.86 })};box-shadow:inset 0 0 0 1px ${kc > 0.5 ? hexA(T, 0.25) : LINE},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.06),0 ${f2(10 + 8 * kc)}px ${f2(26 + 10 * kc)}px rgba(20,22,29,${f2(0.07 + 0.04 * kc)})">
        <div class="strip" style="background:${t[5]}"></div>
        <div class="pf-ab" style="left:16px;top:21px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${kc > 0.5 ? `linear-gradient(160deg,${tint(T, 0.15)},${shade(T, 0.12)})` : '#fff'};box-shadow:${kc > 0.5 ? `0 4px 10px -3px ${hexA(T, 0.6)},inset 0 1px 0 rgba(255,255,255,.4)` : `inset 0 0 0 1.5px ${LINE}`};transform:scale(${f2(1 + 0.25 * Math.sin(kc * Math.PI))})">
          <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2.5 6.3 L5 8.6 L9.6 3.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - seg(kc, 0.4, 1))}"/></svg></div>
        <div class="p5-t">${esc(t[0])}</div>
        <div class="meta"><span class="p5-av" style="background:${t[3]}">${esc(t[1])}</span>${esc(t[2])}<span style="opacity:.4">·</span>来自 00:${12 + i * 9}:${String((31 + i * 7) % 60).padStart(2, '0')} 录音</div>
        <span class="p5-pri pf-mono" style="color:${t[5]};background:${hexA(t[5], 0.09)};box-shadow:inset 0 0 0 1px ${hexA(t[5], 0.3)}">${t[4]}</span>
        <span class="p5-due pf-mono"><svg width="10" height="10" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5V6l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>${esc(t[6])}</span>
      </div>`;
    });
    return h;
  }

  /* =====================================================================
     P06 · paper_flywheel  瑞士排印超大数字 + 暖纸记忆闭环飞轮
     ===================================================================== */
  function P06(p, u, T, d) {
    const G = '#D99A2B';
    const kTop = seg(p, 0, 0.14), kNum = seg(p, 0.06, 0.4), kBar = seg(p, 0.14, 0.42);
    const kN = [seg(p, 0.36, 0.48), seg(p, 0.46, 0.58), seg(p, 0.56, 0.68), seg(p, 0.66, 0.8)];
    const kA = [seg(p, 0.42, 0.52), seg(p, 0.52, 0.62), seg(p, 0.62, 0.72), seg(p, 0.76, 0.9)];
    const lit = seg(p, 0.86, 0.96);
    let h = '';
    const n = Math.round(d.pct * eo(kNum));
    const before = d.before, after = d.after;
    const now = before - (before - after) * eo(kBar);
    h += `<div class="pf-ab pf-card lift p6-top" style="${fx(kTop, { dy: -10, s: 0.97 })}">
      <div style="position:absolute;right:-50px;top:-70px;width:240px;height:220px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,${hexA(T, 0.07)},transparent 70%)"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;position:relative"><span style="font-size:12px;color:${INK2}">${esc(d.metric)}</span>
        <span class="pf-mono" style="font-size:9.5px;color:${T};padding:3px 8px;border-radius:6px;background:${hexA(T, 0.07)};box-shadow:inset 0 0 0 1px ${hexA(T, 0.25)}">${esc(d.badge)}</span></div>
      <div class="p6-big"><span style="color:${T}">−</span>${n}<span style="font-size:52px;letter-spacing:-1px;margin-left:2px">%</span></div>
      <div style="position:absolute;right:20px;top:54px;text-align:right">
        <div style="font-size:10.5px;color:${INK2}">每次省下</div>
        <div class="pf-num" style="font-size:26px;font-weight:700;letter-spacing:-.5px;margin-top:2px">${(before - now).toFixed(0)}<span style="font-size:13px;color:${INK2};margin-left:3px;font-weight:500">分钟</span></div></div>
      <div style="position:absolute;left:18px;right:18px;top:120px">
        <div class="p6-bar"><span>以前</span><div class="p6-trk"><div style="position:absolute;inset:0;border-radius:5px;background:repeating-linear-gradient(135deg,#CFC8BA 0 4px,#C3BBAB 4px 8px)"></div></div><span class="v pf-num" style="color:${INK2}">${before} min</span></div>
        <div class="p6-bar" style="margin-top:4px"><span style="color:${T};font-weight:700">现在</span><div class="p6-trk"><div style="position:absolute;top:0;bottom:0;left:0;width:${f2(now / before * 100)}%;border-radius:5px;background:linear-gradient(90deg,${shade(T, 0.1)},${T} 70%,${tint(T, 0.45)});box-shadow:0 2px 6px ${hexA(T, 0.35)}"></div></div><span class="v pf-num" style="color:${T}">${now.toFixed(0)} min</span></div>
        <div style="position:relative;margin:5px 60px 0 44px;height:12px">${Array.from({ length: 16 }, (_, i) => `<i style="position:absolute;left:${f2(i / 15 * 100)}%;top:0;width:1px;height:${i % 5 ? 3 : 6}px;background:rgba(20,22,29,${i % 5 ? 0.18 : 0.45})"></i>`).join('')}
          ${[0, 5, 10, 15].map((v) => `<span class="pf-mono" style="position:absolute;left:${f2(v / 15 * 100)}%;top:5px;transform:translateX(-50%);font-size:8px;color:${INK3}">${Math.round(v / 15 * before)}</span>`).join('')}</div>
      </div></div>`;
    const C = [238, 330], RX = 160, RY = 76;
    const pt = (ang) => [C[0] + RX * Math.cos(ang), C[1] + RY * Math.sin(ang)];
    const arcPath = (a0, a1) => { const [x0, y0] = pt(a0), [x1, y1] = pt(a1); return `M${f2(x0)} ${f2(y0)} A${RX} ${RY} 0 0 1 ${f2(x1)} ${f2(y1)}`; };
    const PI = Math.PI;
    const arcs = [[PI, 1.5 * PI, T], [1.5 * PI, 2 * PI, T], [0, 0.5 * PI, T], [0.5 * PI, PI, G]];
    let sv = `<ellipse cx="${C[0]}" cy="${C[1]}" rx="${RX}" ry="${RY}" fill="none" stroke="${INK}" stroke-opacity=".14" stroke-width="1" stroke-dasharray="2 5" opacity="${f2(seg(p, 0.3, 0.4))}"/>
      <ellipse cx="${C[0]}" cy="${C[1]}" rx="${RX - 30}" ry="${RY - 16}" fill="${hexA(T, 0.025)}" stroke="${INK}" stroke-opacity=".05" opacity="${f2(seg(p, 0.3, 0.4))}"/>`;
    arcs.forEach(([a0, a1, col], i) => {
      const k = kA[i]; if (k <= 0) return;
      const dd = arcPath(a0, a1);
      sv += `<path d="${dd}" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="8" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - k)}" style="filter:blur(3px)"/>
        <path d="${dd}" fill="none" stroke="${col}" stroke-width="${i === 3 ? 2.6 : 2}" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${f2(1 - k)}"/>`;
      const tt = k < 1 ? eo(k) : ((p * 1.6 + i * 0.25) % 1);
      const [x, y] = pt(a0 + (a1 - a0) * tt);
      sv += `<circle cx="${f2(x)}" cy="${f2(y)}" r="3.6" fill="#fff" stroke="${col}" stroke-width="1.8" style="filter:drop-shadow(0 0 4px ${hexA(col, 0.7)})"/>`;
    });
    h += `<svg class="pf-ov" width="${W}" height="${H}">${sv}</svg>`;
    const mem = Math.round(d.mem * seg(p, 0.5, 0.92));
    h += `<div class="pf-ab" style="left:158px;top:306px;width:160px;text-align:center;opacity:${f2(seg(p, 0.4, 0.52))}">
      <div class="pf-mono" style="font-size:8.5px;letter-spacing:2px;color:${INK3}">MEMORY LOOP</div>
      <div style="font-size:13px;font-weight:700;margin-top:4px;color:${INK}">已记住 <span class="pf-num" style="color:${T};font-size:19px;font-weight:800">${mem}</span> 条偏好</div></div>`;
    const icPerson = `<div style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 200deg,${T},#6D28D9,${G},${T});padding:1.5px;box-shadow:0 4px 10px -3px ${hexA(T, 0.45)}"><div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(80% 80% at 50% 25%,#FFFFFF,#EFEBE2);overflow:hidden;position:relative">
        <div style="position:absolute;left:50%;top:8px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:linear-gradient(180deg,#5B6170,#2A2D36)"></div>
        <div style="position:absolute;left:50%;top:24px;width:26px;height:20px;margin-left:-13px;border-radius:13px 13px 4px 4px;background:linear-gradient(180deg,#5B6170,#2A2D36)"></div></div></div>`;
    const icLens = `<svg width="40" height="40" viewBox="0 0 44 44"><defs><radialGradient id="${u}lg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".55" stop-color="${tint(T, 0.8)}" stop-opacity=".85"/><stop offset="1" stop-color="${tint(T, 0.55)}" stop-opacity=".9"/></radialGradient><linearGradient id="${u}rm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAFBFC"/><stop offset=".5" stop-color="#9AA1AC"/><stop offset="1" stop-color="#D7DCE2"/></linearGradient></defs>
        <path d="M28 28 L39 39" stroke="url(#${u}rm)" stroke-width="5.5" stroke-linecap="round"/><path d="M28 28 L39 39" stroke="${INK}" stroke-opacity=".25" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="0 6 20"/><circle cx="19" cy="19" r="14" fill="url(#${u}lg)" stroke="url(#${u}rm)" stroke-width="2.8"/>
        <path d="M12 16h11M12 20h14M12 24h8" stroke="${T}" stroke-width="1.6" stroke-linecap="round"/><path d="M10 13 a10 10 0 0 1 8 -5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
    const icNote = `<div style="position:absolute;left:5px;top:3px;width:31px;height:36px;border-radius:5px;background:linear-gradient(160deg,#FFFFFF,#F4F0E7);box-shadow:inset 0 0 0 1px ${LINE},0 4px 8px rgba(20,22,29,.16);padding:10px 5px 0">
        ${[80, 100, 64].map((w) => `<div style="height:2.5px;margin-bottom:4px;border-radius:2px;width:${w}%;background:${hexA(T, 0.75)}"></div>`).join('')}
        <div style="position:absolute;right:4px;bottom:4px;width:8px;height:8px;border-radius:2px;background:${G}"></div></div>
        <div style="position:absolute;left:8px;top:0;display:flex;gap:4.5px">${[0, 1, 2, 3].map(() => `<i style="display:block;width:3px;height:7px;border-radius:2px;background:linear-gradient(180deg,#FAFBFC,#8E959F)"></i>`).join('')}</div>`;
    const icBulb = `<svg width="40" height="40" viewBox="0 0 44 44" style="overflow:visible"><defs><radialGradient id="${u}bl" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="${lit > 0 ? '#FFFBEA' : '#F4F2EC'}"/><stop offset="1" stop-color="${lit > 0 ? '#F5B83D' : '#DCD7CC'}"/></radialGradient></defs>
        ${lit > 0 ? [0, 1, 2, 3, 4].map((i) => { const ang = -PI / 2 + (i - 2) * 0.55; return `<line x1="${f2(22 + Math.cos(ang) * 19)}" y1="${f2(18 + Math.sin(ang) * 19)}" x2="${f2(22 + Math.cos(ang) * (19 + 5 * lit))}" y2="${f2(18 + Math.sin(ang) * (19 + 5 * lit))}" stroke="${G}" stroke-width="1.6" stroke-linecap="round" opacity="${f2(lit)}"/>`; }).join('') : ''}
        <circle cx="22" cy="18" r="12" fill="url(#${u}bl)" stroke="${lit > 0 ? '#E0A23B' : '#CFC8BA'}" stroke-width="1" style="filter:drop-shadow(0 0 ${f2(10 * lit)}px ${hexA('#F5B83D', 0.9)})"/><path d="M18 22 l2 -4 2 3 2 -3 2 4" fill="none" stroke="${lit > 0 ? '#B45309' : '#9AA0AC'}" stroke-width="1.2"/>
        <rect x="16.5" y="29" width="11" height="4" rx="1.5" fill="#B9BEC6"/><rect x="17.5" y="34" width="9" height="3.5" rx="1.5" fill="#8E959F"/></svg>`;
    const nodes = [
      { x: C[0] - RX, y: C[1], ic: icPerson, t: d.nodes[0][0], s: d.nodes[0][1], col: T },
      { x: C[0], y: C[1] - RY, ic: icLens, t: d.nodes[1][0], s: d.nodes[1][1], col: T },
      { x: C[0] + RX, y: C[1], ic: icNote, t: d.nodes[2][0], s: d.nodes[2][1], col: T },
      { x: C[0], y: C[1] + RY, ic: icBulb, t: d.nodes[3][0], s: d.nodes[3][1], col: G }
    ];
    nodes.forEach((N, i) => {
      const k = kN[i]; if (k <= 0) return;
      const glow = i === 3 ? lit : 0;
      const x = clamp(N.x, 82, 394);
      h += `<div class="pf-ab pf-card p6-node" style="left:${f2(x)}px;top:${N.y}px;${fx(k, { dy: 10, s: 0.8 })};box-shadow:inset 0 0 0 1px ${glow > 0 ? hexA(G, 0.3 + 0.4 * glow) : LINE},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.06),0 12px 28px rgba(20,22,29,.09),0 0 ${f2(30 * glow)}px ${hexA(G, 0.45 * glow)}">
        <div class="ic">${N.ic}</div><div><div class="t">${esc(N.t)}</div><div class="s">${esc(N.s)}</div></div></div>`;
    });
    return h;
  }

  /* =====================================================================
     ab_compare · 左右对照卡（以前 vs 现在）
     ===================================================================== */
  function PAB(p, u, T, d) {
    const R = '#E11D48';
    const kL = seg(p, 0, 0.2), kR = seg(p, 0.22, 0.42), kArrow = seg(p, 0.18, 0.34), kM = seg(p, 0.7, 0.9);
    let h = '';
    h += `<div class="pf-ab" style="left:0;right:0;top:14px;text-align:center;opacity:${f2(kL)}"><span class="pf-mono" style="font-size:10px;letter-spacing:2px;color:${INK3}">${esc(d.caption)}</span></div>`;
    const side = (x, s, on, k) => {
      const c = on ? T : INK3;
      const items = s.items.map((it, i) => {
        const ki = seg(p, (on ? 0.4 : 0.12) + i * 0.08, (on ? 0.52 : 0.24) + i * 0.08);
        const dot = on ? `<span class="pc-dot" style="background:${ki >= 1 ? T : '#fff'};box-shadow:${ki >= 1 ? `0 3px 6px -2px ${hexA(T, 0.6)}` : `inset 0 0 0 1.5px ${LINE}`}">${ki >= 1 ? CHECK('#fff', 2.2, 10) : ''}</span>`
          : `<span class="pc-dot" style="background:${hexA(R, 0.08)};box-shadow:inset 0 0 0 1px ${hexA(R, 0.3)}"><svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 2 L8 8 M8 2 L2 8" stroke="${R}" stroke-width="1.8" stroke-linecap="round"/></svg></span>`;
        return `<div class="pc-it" style="opacity:${f2(clamp(ki * 2))};color:${on ? INK : INK2}">${dot}${on ? esc(it) : `<s style="text-decoration-color:${hexA(R, 0.5)}">${esc(it)}</s>`}</div>`;
      }).join('');
      return `<div class="pf-ab pf-card ${on ? 'lift' : ''} pc-side" style="left:${x}px;${fx(k, { dx: on ? 18 : -18, dy: 0, s: 0.96 })};${on ? `box-shadow:inset 0 0 0 1.5px ${hexA(T, 0.4)},inset 0 1px 0 #fff,0 1px 2px rgba(20,22,29,.06),0 20px 40px -10px ${hexA(T, 0.28)}` : 'background:linear-gradient(180deg,#FBF9F4,#F5F1E8)'}">
        <div style="display:flex;align-items:center;gap:8px"><span class="pf-tag" style="color:${on ? '#fff' : INK2};background:${on ? T : '#EDE8DD'}">${esc(s.tag)}</span><span style="font-size:14px;font-weight:700;color:${on ? INK : INK2}">${esc(s.title)}</span></div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px dashed ${LINE}">${items}</div>
        <div style="position:absolute;left:16px;right:16px;bottom:14px;padding-top:10px;border-top:1px solid ${on ? hexA(T, 0.2) : LINE}">
          <div style="font-size:10.5px;color:${INK3}">${esc(s.mLabel)}</div>
          <div class="pf-num" style="font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:${c};${on ? '' : 'text-decoration:line-through;text-decoration-thickness:2px;text-decoration-color:' + hexA(R, 0.55)}">${esc(s.metric)}</div></div>
      </div>`;
    };
    h += side(20, d.left, false, kL);
    h += side(250, d.right, true, kR);
    h += `<div class="pf-ab" style="left:214px;top:184px;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${INK};box-shadow:0 0 0 5px #F7F4EC,0 10px 20px -6px rgba(20,22,29,.5);${fx(kArrow, { dy: 0, s: 0.4 })}">
      <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10 H15 M11 5.5 L15.5 10 L11 14.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    h += `<div class="pf-ab pf-card" style="left:20px;top:374px;width:436px;height:66px;border-radius:18px;display:flex;align-items:center;gap:14px;padding:0 18px;${fx(kM, { dy: 10, s: 0.96 })}">
      <div class="pf-num" style="font-size:30px;font-weight:800;letter-spacing:-1px;color:${T}">${esc(d.delta)}</div>
      <div style="flex:1;height:8px;border-radius:4px;background:#EFEBE2;overflow:hidden"><div style="height:100%;width:${f2(100 * eo(kM) * d.ratio)}%;border-radius:4px;background:linear-gradient(90deg,${T},${tint(T, 0.45)})"></div></div>
      <div style="font-size:12px;color:${INK2};white-space:nowrap">${esc(d.deltaLabel)}</div></div>`;
    return h;
  }

  /* =====================================================================
     kinetic_meter · 单指标大字冲击（排印大数 + 半环仪表 + 增长曲线）
     ===================================================================== */
  function PKM(p, u, T, d) {
    const kIn = seg(p, 0, 0.16), kNum = seg(p, 0.08, 0.6), kRing = seg(p, 0.1, 0.62), kChart = seg(p, 0.5, 0.85), kTag = seg(p, 0.72, 0.9);
    const v = Math.round(d.value * eo(kNum));
    const vs = d.fmt === 'plain' ? String(v) : v.toLocaleString('en-US');
    let h = '';
    const cx = 238, cy = 222, r = 150;
    const ang = Math.PI * eo(kRing) * d.ratio;
    const arc = (a) => { const x = cx - r * Math.cos(a), y = cy - r * Math.sin(a); return `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${f2(x)} ${f2(y)}`; };
    let sv = `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#ECE7DC" stroke-width="14" stroke-linecap="round"/>`;
    for (let i = 0; i <= 40; i++) { const a = Math.PI * i / 40, r1 = r - 22, r2 = r - (i % 5 ? 27 : 32); sv += `<line x1="${f2(cx - r1 * Math.cos(a))}" y1="${f2(cy - r1 * Math.sin(a))}" x2="${f2(cx - r2 * Math.cos(a))}" y2="${f2(cy - r2 * Math.sin(a))}" stroke="${INK}" stroke-opacity="${i % 5 ? 0.15 : 0.4}" stroke-width="1"/>`; }
    if (ang > 0.01) {
      sv += `<defs><linearGradient id="${u}kg" x1="0" x2="1"><stop offset="0" stop-color="${tint(T, 0.45)}"/><stop offset="1" stop-color="${T}"/></linearGradient></defs>`;
      sv += `<path d="${arc(ang)}" fill="none" stroke="${T}" stroke-opacity=".2" stroke-width="22" stroke-linecap="round" style="filter:blur(4px)"/><path d="${arc(ang)}" fill="none" stroke="url(#${u}kg)" stroke-width="14" stroke-linecap="round"/>`;
      sv += `<circle cx="${f2(cx - r * Math.cos(ang))}" cy="${f2(cy - r * Math.sin(ang))}" r="8" fill="#fff" stroke="${T}" stroke-width="3" style="filter:drop-shadow(0 2px 4px ${hexA(T, 0.5)})"/>`;
    }
    h += `<svg class="pf-ov" width="${W}" height="${H}" style="opacity:${f2(kIn)}">${sv}</svg>`;
    h += `<div class="pf-ab" style="left:0;right:0;top:118px;text-align:center;${fx(kIn, { dy: 10, s: 0.9 })}">
      <div style="font-size:12px;color:${INK2};letter-spacing:1px">${esc(d.label)}</div>
      <div class="pf-num" style="margin-top:4px;font-size:72px;font-weight:800;letter-spacing:-3px;line-height:1;color:${INK}">${esc(d.prefix || '')}${vs}<span style="font-size:30px;color:${T};letter-spacing:0;margin-left:2px">${esc(d.suffix || '')}</span></div></div>`;
    h += `<div class="pf-ab pf-mono" style="left:${cx - r - 8}px;top:${cy + 14}px;font-size:9px;color:${INK3}">0</div><div class="pf-ab pf-mono" style="left:${cx + r - 22}px;top:${cy + 14}px;font-size:9px;color:${INK3};width:40px;text-align:right">${esc(d.max)}</div>`;
    const pts = d.series, mx = Math.max(...pts), cw = 404, ch = 92, x0 = 36, y0 = 340;
    const P = pts.map((v2, i) => [x0 + cw * i / (pts.length - 1), y0 + ch - ch * v2 / mx]);
    const line = P.map((q, i) => `${i ? 'L' : 'M'}${f2(q[0])} ${f2(q[1])}`).join(' ');
    const area = `${line} L${x0 + cw} ${y0 + ch} L${x0} ${y0 + ch} Z`;
    h += `<div class="pf-ab pf-card" style="left:20px;top:262px;width:436px;height:184px;border-radius:18px;${fx(seg(p, 0.42, 0.58), { dy: 14, s: 0.97 })}">
      <div style="position:absolute;left:16px;top:12px;font-size:11px;color:${INK2}">${esc(d.chartLabel)}</div>
      <div class="pf-mono" style="position:absolute;right:16px;top:12px;font-size:10px;font-weight:700;color:${T};opacity:${f2(kTag)}">${esc(d.tag)}</div></div>`;
    h += `<svg class="pf-ov" width="${W}" height="${H}" style="opacity:${f2(seg(p, 0.46, 0.6))}"><defs><linearGradient id="${u}ka" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T}" stop-opacity=".22"/><stop offset="1" stop-color="${T}" stop-opacity="0"/></linearGradient><clipPath id="${u}kc"><rect x="${x0 - 6}" y="${y0 - 20}" width="${f2((cw + 12) * eo(kChart))}" height="${ch + 30}"/></clipPath></defs>
      ${[0, 1, 2].map((i) => `<line x1="${x0}" x2="${x0 + cw}" y1="${y0 + ch * i / 2}" y2="${y0 + ch * i / 2}" stroke="${INK}" stroke-opacity=".07" stroke-dasharray="2 4"/>`).join('')}
      <g clip-path="url(#${u}kc)"><path d="${area}" fill="url(#${u}ka)"/><path d="${line}" fill="none" stroke="${T}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${P.map((q, i) => `<circle cx="${f2(q[0])}" cy="${f2(q[1])}" r="${i === P.length - 1 ? 4.5 : 2.5}" fill="#fff" stroke="${T}" stroke-width="${i === P.length - 1 ? 2.5 : 1.5}"/>`).join('')}</g></svg>`;
    return h;
  }

  /* ---------------- 注册表 ---------------- */
  const FLOWS = {
    paper_funnel: { r: P01, theme: '#2563EB', name: '多源漏斗筛选流', style: '瑞士精印 + 磨砂亚克力多源漏斗',
      def: { query: 'AI 编程助手，大家最近都在吐槽什么？', counts: ['218 帖', '96 帖', '341 帖', '629 帖'], filterLabel: '去重 · 降噪 · 聚类', noise: '-82%', reject: ['水贴', '广告引流', '复读', '机器人'], briefTitle: '痛点简报 · AI 编程助手', briefSub: '来自 1,284 条真实讨论 · 生成用时 12s', rows: [['上下文总是丢失', 34], ['改一处炸三处', 27], ['订阅贵还限速', 19]] } },
    paper_router: { r: P02, theme: '#0F9D76', name: '智能道岔分流', style: '工业设计实体键帽 + 精密分流路由',
      def: { query: '重构支付模块，顺便补测试', row1: 'Ask AI · 自动选择模型', row2: '快速翻译剪贴板', keyHint: '一键唤起', fastName: '极速轻模型', fastV: '0.4', deepName: '深度推理链', steps: [['拆解任务', '1.2s'], ['多步推理', '3.8s'], ['自检校验', '…']], logs: [['14:02:11', '改个错别字', 'FAST', '0.4s'], ['14:02:19', '重构支付模块', 'DEEP', '6 步'], ['14:02:27', '翻译这段话', 'FAST', '0.3s']] } },
    paper_remote: { r: P03, theme: '#6D28D9', name: '手机遥控电脑', style: 'Apple 浅色工业风 · iPhone → MacBook 接力',
      def: { cmd: '跑本周周报', file: 'weekly-report.md', voice: '帮我把本周周报跑出来' } },
    paper_slabs: { r: P04, theme: '#D97706', name: '等轴测三层架构', style: '2.5D 精装厚卡纸 + 磨砂玻璃层叠',
      def: { layers: [['原料接入层', '文档 · 录音 · 网页 · 截图'], ['清洗提纯层', '去重 · 降噪 · 结构化'], ['成品输出层', '排版 · 配图 · 一键发布']] } },
    paper_laser: { r: P05, theme: '#2563EB', name: '乱麻变清单', style: '暖光扫描仪去噪 · 光幕提纯',
      def: { inN: 47, frags: [['嗯…那个就是说', 34, 26, -6, 1], ['周四？还是周五？', 164, 22, 4, 0], ['@张三 你看下', 322, 30, -3, 0], ['原型图放哪了', 52, 66, 5, 0], ['预算再议', 204, 64, -8, 2], ['竞品价格？', 292, 78, 7, 1], ['录音 00:47:12', 376, 70, -4, 2], ['先这样吧…', 28, 112, -3, 2], ['同步一下文档', 142, 106, 3, 0], ['谁来负责？', 262, 118, -6, 1], ['截图(3).png', 360, 112, 5, 1], ['47 条未读', 118, 146, -2, 2], ['再拉个会？', 296, 150, 4, 0]],
        todos: [['周四 15:00 前交付前端原型', '张', '张三', '#2563EB', 'P0', '#E11D48', '周四 15:00'], ['补齐 3 个竞品定价对比', '李', '李四', '#D97706', 'P1', '#D97706', '周五 18:00'], ['同步需求文档到项目群', '王', '王五', '#0F9D76', 'P2', '#2563EB', '今天 20:00']] } },
    paper_flywheel: { r: P06, theme: '#E11D48', name: '记忆闭环飞轮', style: '瑞士排印超大数字 + 暖纸记忆飞轮',
      def: { metric: '重复解释背景的耗时', badge: '第 12 次对话后', pct: 78, before: 15, after: 3, mem: 37, nodes: [['开口提需求', '自然语言即可'], ['召回偏好', '检索长期记忆'], ['写入笔记', '自动沉淀偏好'], ['下次秒懂', '无需再解释']] } },
    ab_compare: { r: PAB, theme: '#0F9D76', name: '左右对照卡', style: '以前 vs 现在 · 白卡对照',
      def: { caption: 'BEFORE  ·  AFTER', left: { tag: '以前', title: '手动来回折腾', items: ['每次重新解释背景', '复制粘贴 5 个窗口', '结果对不上再返工'], mLabel: '单次耗时', metric: '15 min' }, right: { tag: '现在', title: '一句话直接交付', items: ['自动读取上下文', '一个窗口全搞定', '成品直接可发布'], mLabel: '单次耗时', metric: '3 min' }, delta: '-80%', ratio: 0.8, deltaLabel: '时间直接省掉' } },
    kinetic_meter: { r: PKM, theme: '#2563EB', name: '单指标大字冲击', style: '排印大数 + 半环仪表 + 增长曲线',
      def: { label: '插件市场下载量', value: 17207, prefix: '', suffix: '', ratio: 0.86, max: '20k', chartLabel: '近 8 周下载趋势', tag: '▲ 分类第 1', series: [1200, 2100, 2900, 4300, 6100, 8800, 12600, 17207] } }
  };
  const ALIAS = { funnel: 'paper_funnel', router: 'paper_router', remote: 'paper_remote', slabs: 'paper_slabs', laser: 'paper_laser', flywheel: 'paper_flywheel', P01: 'paper_funnel', P02: 'paper_router', P03: 'paper_remote', P04: 'paper_slabs', P05: 'paper_laser', P06: 'paper_flywheel', compare: 'ab_compare', meter: 'kinetic_meter' };
  let UID = 0;

  function render(container, spec, progress, themeColor) {
    if (!container) return;
    if (typeof spec === 'string') spec = { type: spec };
    spec = spec || {};
    const type = ALIAS[spec.type] || spec.type || 'paper_funnel';
    const F = FLOWS[type] || FLOWS.paper_funnel;
    const T = themeColor || spec.theme || F.theme;
    const d = Object.assign({}, F.def, spec);
    const doc = container.ownerDocument || document;
    ensureCSS(doc);
    let st = container.__pfStage;
    if (!st || st.parentNode == null || st.parentNode.parentNode !== container) {
      container.innerHTML = `<div class="pf-root fx" data-flow="${type}"><div class="pf-stage"></div></div>`;
      st = container.querySelector('.pf-stage');
      container.__pfStage = st;
      container.__pfUid = 'pf' + (UID++) + '_';
    }
    const cw = spec.width || container.clientWidth || W, ch = spec.height || container.clientHeight || H;
    const s = Math.min(cw / W, ch / H);
    st.style.transform = `translate(${f2((cw - W * s) / 2)}px,${f2((ch - H * s) / 2)}px) scale(${s.toFixed(5)})`;
    st.parentNode.setAttribute('data-flow', type);
    st.innerHTML = F.r(clamp(+progress || 0), container.__pfUid, T, d);
  }

  root.FX_PAPER_FLOWS = {
    W, H, render,
    types: Object.keys(FLOWS),
    themes: { blue: '#2563EB', green: '#0F9D76', amber: '#D97706', coral: '#E11D48', violet: '#6D28D9' },
    meta: Object.fromEntries(Object.entries(FLOWS).map(([k, v]) => [k, { name: v.name, style: v.style, theme: v.theme, defaults: v.def }]))
  };
})(typeof window !== 'undefined' ? window : globalThis);
