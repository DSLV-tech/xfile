/* ════════════════════════════════════════════════════════════════
   DIGITAL SOLVING — Scroll Animation Showcase
   GSAP 3.12 · Lenis 1.0.34 · Splitting.js

   ARCHITECTURE (proven, final):
   ──────────────────────────────
   1. Splitting()  →  first, always
   2. Lenis RAF    →  single loop, no gsap.ticker
   3. Hero setup   →  immediate (no font metrics needed)
   4. Everything else  →  inside document.fonts.ready
   5. ONE ScrollTrigger.refresh()  →  end of fonts.ready

   KEY FIXES (kept from working version):
   • Hero entrance targets .hw (words), explosion targets .hw .char
     → different DOM nodes, zero state conflict
   • overflow:hidden on .horiz-clip child, NOT on pinned .s-horiz
     → clip survives GSAP's position:fixed pin
   • Word scrub uses opacity on .word spans, NOT color
     → opacity is independent, color inheritance causes conflicts
   • xPercent/yPercent for cylinder centering, not CSS transform
     → compatible with rotationX and transformOrigin
   • .cyl-row .char is inline-block, NOT absolute
     → absolute stacks all chars at origin, all invisible
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. SPLITTING (must be first) ───────────────────────────── */
  Splitting();

  gsap.registerPlugin(ScrollTrigger);

  /* ── 2. LENIS ────────────────────────────────────────────────
     Single RAF loop. lenis.on('scroll') syncs ScrollTrigger
     to the smooth scroll position rather than window.scrollY.
  ─────────────────────────────────────────────────────────────── */
  const lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });

  (function tick(t) { lenis.raf(t); requestAnimationFrame(tick); })(0);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  /* ── DEVICE FLAGS ─────────────────────────────────────────────
     isTouch  → no fine pointer: skip cursor, magnetic, tilt, parallax
     isMobile → small screen: skip aurora/glitch, simplify cylinder
     reduce   → user asked for less motion: shorten loader, calm CSS loops
     lite     → skip heavy background fx (small screens only)
     noPtrFx  → skip pointer-driven fx (touch only)
  ─────────────────────────────────────────────────────────────── */
  const isTouch  = window.matchMedia('(hover:none), (pointer:coarse)').matches;
  const isMobile = window.matchMedia('(max-width:900px)').matches;
  const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Glitch / aurora / cursor are the brand's signature — they stay on desktop
     even under reduced-motion. `reduce` only shortens the preloader and (via
     CSS) calms the continuous ambient loops. Heavy fx are gated by device,
     not by motion preference. */
  const lite     = isMobile;   // skip heavy background fx on small screens
  const noPtrFx  = isTouch;    // skip pointer-driven fx on touch devices

  /* ── AURORA CANVAS (hero background) — desktop only ─────────── */
  let auroraMouseX = window.innerWidth  / 2;
  let auroraMouseY = window.innerHeight / 2;
  if (!lite) (function initAurora() {
    const section = document.getElementById('s-hero');
    const canvas  = document.createElement('canvas');
    canvas.id = 'aurora-canvas';
    section.prepend(canvas);
    const ctx = canvas.getContext('2d');
    function resize() { canvas.width = section.offsetWidth; canvas.height = section.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);
    /* Orbs: [relative-x, relative-y, radius-ratio, hue, sat%, lit%] */
    const orbs = [
      { rx:.28, ry:.40, r:.56, h:0,   s:82, l:37 },   /* red   */
      { rx:.72, ry:.50, r:.50, h:174, s:80, l:40 },   /* ice   */
      { rx:.50, ry:.73, r:.38, h:42,  s:74, l:50 },   /* gold  */
      { rx:.14, ry:.62, r:.30, h:280, s:60, l:35 },   /* violet*/
    ];
    function draw(ts) {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const mx = auroraMouseX / window.innerWidth;
      const my = auroraMouseY / window.innerHeight;
      orbs.forEach((o, i) => {
        const ox = (o.rx + Math.sin(ts * .00024 + i * 1.85) * .15 + (mx - .5) * .07) * W;
        const oy = (o.ry + Math.cos(ts * .00018 + i * 2.30) * .11 + (my - .5) * .04) * H;
        const rr = o.r * Math.min(W, H);
        const g  = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
        g.addColorStop(0,   `hsla(${o.h},${o.s}%,${o.l}%,.16)`);
        g.addColorStop(.45, `hsla(${o.h},${o.s}%,${o.l}%,.05)`);
        g.addColorStop(1,   'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  })();

  /* ── GLITCH BARS (pre-create DOM nodes) — desktop only ──────── */
  const gBars = lite ? [] : Array.from({ length: 6 }, () => {
    const b = document.createElement('div');
    b.className = 'g-bar';
    document.body.appendChild(b);
    return b;
  });

  /* ── 3. PROGRESS BAR + VELOCITY CHROMATIC ABERRATION ──────────
     On mobile: progress bar only, skip velocity-driven glitch/aberration.
  ─────────────────────────────────────────────────────────────── */
  let fastTimer;
  lenis.on('scroll', ({ progress, velocity }) => {
    document.getElementById('progressBar').style.width = (progress * 100) + '%';
    if (lite) return;
    /* Chromatic aberration driven by scroll velocity */
    const spd = Math.abs(velocity);
    const ab  = Math.min(spd * .13, 7).toFixed(1);
    document.documentElement.style.setProperty('--aberr', ab + 'px');
    clearTimeout(fastTimer);
    if (spd > 10) {
      document.body.classList.add('is-fast');
      /* Random glitch scanlines */
      if (Math.random() > .62) {
        const bar = gBars[Math.floor(Math.random() * gBars.length)];
        gsap.fromTo(bar, {
          top: Math.random() * window.innerHeight,
          height: Math.random() * 4 + 1,
          background: Math.random() > .5 ? '#E5001E' : '#00E5C8',
          opacity: .6,
        }, { opacity: 0, duration: .13, ease: 'none' });
      }
    } else {
      fastTimer = setTimeout(() => {
        document.body.classList.remove('is-fast');
        document.documentElement.style.setProperty('--aberr', '0px');
      }, 160);
    }
  });

  /* ── 4. CURSOR ───────────────────────────────────────────────
     Morphs to show text label from data-cursor attribute.
     Square shape for nav links, circle for interactive areas.
  ─────────────────────────────────────────────────────────────── */
  const cDot   = document.getElementById('cDot');
  const cRing  = document.getElementById('cRing');
  const cLabel = document.getElementById('cLabel');

  if (!noPtrFx) window.addEventListener('mousemove', e => {
    /* Aurora orb mouse influence */
    auroraMouseX = e.clientX;
    auroraMouseY = e.clientY;
    cDot.style.left  = e.clientX + 'px';
    cDot.style.top   = e.clientY + 'px';
    gsap.to(cRing,  { x: e.clientX, y: e.clientY, duration: .14, ease: 'power2.out', overwrite: 'auto' });
    gsap.to(cLabel, { x: e.clientX, y: e.clientY, duration: .14, ease: 'power2.out', overwrite: 'auto' });
    /* Hero stage 3-D mouse parallax */
    const hx = (e.clientX / window.innerWidth  - .5) * 2;
    const hy = (e.clientY / window.innerHeight - .5) * 2;
    gsap.to('.hero-stage', {
      rotationY: hx * 2.8, rotationX: -hy * 1.6,
      transformPerspective: 2400,
      duration: .9, ease: 'power2.out', overwrite: 'auto',
    });
  });

  document.querySelectorAll('[data-cursor]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('hov');
      cLabel.textContent = el.dataset.cursor;
    });
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('hov');
      cLabel.textContent = '';
    });
  });

  document.querySelectorAll('.hdr-nav a').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hov-link'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hov-link'));
  });

  /* ── HEADER: scrolled state + smooth anchor navigation ───────── */
  const hdrEl = document.querySelector('.hdr');
  lenis.on('scroll', ({ scroll }) => {
    if (hdrEl) hdrEl.classList.toggle('scrolled', scroll > 60);
  });
  document.querySelectorAll('.hdr-nav a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    });
  });

  document.querySelectorAll('button, .mag-area, .btn-primary, .cyl-cta-wrap').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('hov'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('hov'));
  });

  /* ── CLICK RIPPLE (pointer devices only) ─────────────────────── */
  if (!noPtrFx) window.addEventListener('click', e => {
    const r = document.createElement('div');
    r.className = 'c-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top  = e.clientY + 'px';
    document.body.appendChild(r);
    gsap.fromTo(r,
      { width: 0, height: 0, opacity: .9 },
      { width: 90, height: 90, opacity: 0, duration: .65, ease: 'power2.out',
        onComplete: () => r.remove() }
    );
  });

  /* ══════════════════════════════════════════════════════════════
     §1  HERO  (set up immediately — no font metrics needed)
     ══════════════════════════════════════════════════════════════

     ENTRANCE: .hw block elements (three titles).
     Each lives in .lw (overflow:hidden). Set y:'100%' → they sit
     below the clip. GSAP slides each up staggered.

     EXPLOSION: .hw .char leaf nodes.
     Pre-computed random vectors → stable on resize refresh.
     All chars begin exploding at t=0 (simultaneous detonation).

     WHY TWO TARGETS:
     Entrance sets transforms on .hw. Explosion sets transforms on
     .hw .char. They never touch the same node → zero conflict.
  ══════════════════════════════════════════════════════════════ */
  const heroWords = gsap.utils.toArray('.hw');
  const heroChars = gsap.utils.toArray('.hw .char');

  /* Entrance initial state */
  gsap.set(heroWords,   { y: '100%' });
  gsap.set('.hero-sub', { opacity: 0 });
  gsap.set('.hero-tech',{ opacity: 0, x: 12 });

  /* Orchestrated entrance timeline — held until the preloader lifts */
  const entranceTl = gsap.timeline({ paused: true });
  entranceTl
    .to(heroWords, { y: '0%', stagger: .12, duration: 1.0, ease: 'power3.out' })
    .to('.hero-sub',  { opacity: 1, duration: .6, ease: 'power2.out' }, '-=.4')
    .to('.hero-tech', { opacity: 1, x: 0, stagger: .08, duration: .4, ease: 'power2.out' }, '-=.5');

  /* ══════════════════════════════════════════════════════════════
     PRELOADER — animated counter → curtain reveal → hero entrance
     Scroll is locked (lenis.stop) until the curtain lifts so the
     opening frame always lands on a composed hero.
  ══════════════════════════════════════════════════════════════ */
  (function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) { entranceTl.play(); return; }

    document.body.classList.add('is-loading');
    lenis.stop();

    const numEl  = document.getElementById('loaderNum');
    const fillEl = document.getElementById('loaderFill');
    let done = false;

    const reveal = () => {
      if (done) return; done = true;
      const tl = gsap.timeline({
        onComplete: () => {
          loader.style.display = 'none';
          document.body.classList.remove('is-loading');
          lenis.start();
          ScrollTrigger.refresh();
        }
      });
      tl.to(loader, {
        yPercent: -100,
        duration: reduce ? .3 : 1.05,
        ease: 'expo.inOut',
      });
      /* Hero rises as the curtain clears — a single, cohesive motion */
      tl.add(() => entranceTl.play(), reduce ? '>' : '-=.55');
    };

    /* Progress: eased count to 100, then reveal. Nudged to completion
       once the window fully loads so it never stalls under 100. */
    let pct = 0;
    const finish = { reached: false };
    const settle = () => { finish.reached = true; };
    if (document.readyState === 'complete') settle();
    else window.addEventListener('load', settle, { once: true });
    /* Safety: never hang on a slow asset */
    setTimeout(settle, 3200);

    (function count() {
      const ceil = finish.reached ? 100 : 92;
      pct += Math.max(.6, (ceil - pct) * (reduce ? .5 : .09));
      if (pct >= 100) pct = 100;
      const shown = Math.round(pct);
      if (numEl)  numEl.textContent = shown;
      if (fillEl) fillEl.style.width = shown + '%';
      if (pct >= 100) { setTimeout(reveal, reduce ? 0 : 260); return; }
      requestAnimationFrame(count);
    })();
  })();

  /* Parallax on the dot grid as user scrolls hero */
  gsap.to('#heroGrid', {
    yPercent: -25,
    ease: 'none',
    scrollTrigger: {
      trigger: '#s-hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    }
  });

  /* Pre-compute explosion vectors (stable across refreshes) */
  const vectors = heroChars.map(() => ({
    x:  (Math.random() - .5) * 1100,
    y:  (Math.random() - .5) * 900,
    z:   Math.random() * 1400 + 400,
    rz: (Math.random() - .5) * 80,
  }));

  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#s-hero',
      start: 'top top',
      end: '+=100%',
      pin: true, scrub: .8, anticipatePin: 1,
    }
  });

  /* All chars explode simultaneously (all at t=0) */
  heroChars.forEach((char, i) => {
    const v = vectors[i];
    heroTl.to(char, { x: v.x, y: v.y, z: v.z, rotationZ: v.rz, opacity: 0, ease: 'power2.in' }, 0);
  });

  /* ══════════════════════════════════════════════════════════════
     ALL OTHER TRIGGERS inside document.fonts.ready
     ══════════════════════════════════════════════════════════════
     Fonts.ready ensures:
     • Font metrics stable → cylinder radius correct
     • Element sizes correct → trigger positions accurate
     • Single refresh() at end → no race conditions
  ══════════════════════════════════════════════════════════════ */
  document.fonts.ready.then(() => {

    /* ── §2 CLIP-PATH REVEAL ──────────────────────────────────── */
    const rvChars = gsap.utils.toArray('.rv-line .char');
    gsap.set(rvChars, { clipPath: 'inset(100% 0 0 0)' });

    const rvTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#s-reveal',
        start: 'top 60%',
        end: 'center 35%',
        scrub: 1,
      }
    });

    /* Lines also rise slightly as chars reveal — double motion */
    gsap.utils.toArray('.rv-line').forEach((line, i) => {
      gsap.from(line, {
        y: 30, opacity: 0, duration: .8, ease: 'power3.out',
        scrollTrigger: { trigger: '#s-reveal', start: 'top 70%', toggleActions: 'play none none none' },
        delay: i * .12,
      });
    });

    rvTl.to(rvChars, {
      clipPath: 'inset(0% 0 0 0)',
      stagger: { each: .02, from: 'start' },
      ease: 'power3.out',
    });

    /* ── §3 CYLINDER ──────────────────────────────────────────────
       10 rows = 36° step → drum clearly visible in perspective.
       Timing: cyl pin is 200% of viewport height for drama.
    ─────────────────────────────────────────────────────────────── */
    const srcRow  = document.querySelector('.cyl-row');
    const wheelEl = document.getElementById('mainWheel');
    const ROWS = 10;

    for (let i = 0; i < ROWS - 1; i++) {
      wheelEl.appendChild(srcRow.cloneNode(true));
    }

    const fSize  = parseFloat(window.getComputedStyle(srcRow).fontSize) || 80;
    const radius = (fSize * .55) / Math.sin(Math.PI / ROWS);
    const step   = 360 / ROWS;
    const origin = `50% 50% -${radius}px`;

    gsap.utils.toArray('.cyl-row').forEach((row, i) => {
      gsap.set(row, {
        xPercent: -50,  /* centers on X — compatible with rotationX */
        yPercent: -50,  /* centers on Y — compatible with transformOrigin */
        rotationX: step * i,
        transformOrigin: origin,
      });
    });

    gsap.to('#cylStage', { autoAlpha: 1, duration: .6 });

    const ce = 'power3.inOut';

    if (lite) {
      /* MOBILE: no pin (would clip the stacked info).
         Drum rotates + weights breathe, scrubbed to the section's scroll. */
      const cylTlM = gsap.timeline({
        scrollTrigger: {
          trigger: '#s-cyl',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        }
      });
      cylTlM
        .to(wheelEl, { rotationX: -(step * 3), transformOrigin: '50% 50%', ease: 'none', duration: 3 })
        .to('.cyl-row .char:nth-of-type(odd)',  { fontWeight: 100, fontStretch: '10%',  ease: ce, duration: 2 }, '<.2')
        .to('.cyl-row .char:nth-of-type(even)', { fontWeight: 800, fontStretch: '240%', ease: ce, duration: 2 }, '<')
        .to(wheelEl, { rotationX: -(step * 5), ease: 'none', duration: 2 })
        .to('.cyl-row .char', { fontWeight: 400, fontStretch: '100%', ease: ce, duration: 1.5 }, '<');
    } else {
      const cylTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#s-cyl',
          start: 'top top',
          end: '+=200%',
          pin: true, scrub: 2, anticipatePin: 1,
        }
      });
      cylTl
        /* Phase 1: drum spins, odd chars thin, even chars wide */
        .to(wheelEl, { rotationX: -(step * 2), transformOrigin: '50% 50%', ease: 'none', duration: 3 })
        .to('.cyl-row .char:nth-of-type(odd)',  { fontWeight: 100, fontStretch: '10%',  ease: ce, duration: 2 }, '<.15')
        .to('.cyl-row .char:nth-of-type(even)', { fontWeight: 800, fontStretch: '280%', ease: ce, duration: 2 }, '<')
        /* Phase 2: drum continues, weights swap */
        .to(wheelEl, { rotationX: -(step * 4), transformOrigin: '50% 50%', ease: 'none', duration: 3 }, '+=.1')
        .to('.cyl-row .char:nth-of-type(odd)',  { fontWeight: 800, fontStretch: '280%', ease: ce, duration: 2 }, '<.15')
        .to('.cyl-row .char:nth-of-type(even)', { fontWeight: 100, fontStretch: '10%',  ease: ce, duration: 2 }, '<')
        /* Settle to neutral */
        .to(wheelEl, { rotationX: -(step * 5), ease: 'none', duration: 1.5 })
        .to('.cyl-row .char', { fontWeight: 400, fontStretch: '100%', ease: ce, duration: 1 }, '<');
    }

    /* CTA right side: headline chars + content stagger */
    gsap.from(gsap.utils.toArray('.cyl-headline .char'), {
      y: 40, opacity: 0, stagger: .018, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: '#s-cyl', start: 'top 68%', toggleActions: 'play none none none' }
    });
    gsap.from(['.cyl-body', '.cyl-cta-wrap', '.cyl-list'], {
      y: 22, opacity: 0, stagger: .1, duration: .65, ease: 'power3.out',
      scrollTrigger: { trigger: '#s-cyl', start: 'top 55%', toggleActions: 'play none none none' }
    });

    /* CTA micro-magnetic */
    const cylWrap = document.getElementById('cylCtaWrap');
    const cylBtn  = document.getElementById('cylBtn');
    const cylTxt  = document.getElementById('cylBtnTxt');
    if (!noPtrFx && cylWrap && cylBtn) {
      cylWrap.addEventListener('mousemove', e => {
        const r = cylBtn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top  - r.height / 2;
        gsap.to(cylBtn, { x: x*.22, y: y*.22, duration: .25, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(cylTxt, { x: x*.1,  y: y*.1,  duration: .25, ease: 'power2.out', overwrite: 'auto' });
      });
      cylWrap.addEventListener('mouseleave', () => {
        gsap.to(cylBtn, { x: 0, y: 0, duration: .55, ease: 'elastic.out(1,.5)', overwrite: 'auto' });
        gsap.to(cylTxt, { x: 0, y: 0, duration: .55, ease: 'elastic.out(1,.5)', overwrite: 'auto' });
      });
    }

    /* ── §4 HORIZONTAL SCROLL ─────────────────────────────────────
       Pin .s-horiz. Translate .horiz-track inside .horiz-clip.
       .horiz-clip (overflow:hidden) is a child of the pinned el
       → always clips correctly regardless of pin method.
       Image scale: each .h-img starts slightly zoomed, CSS hover
       undoes it — GSAP adds an enter animation per card.
    ─────────────────────────────────────────────────────────────── */
    const hSection = document.getElementById('s-horiz');
    const hTrack   = document.getElementById('horizTrack');
    const getAmt   = () => -(hTrack.scrollWidth - window.innerWidth);

    /* HUD refs */
    const hSlides = gsap.utils.toArray('#horizTrack .h-slide');
    const hFill   = document.getElementById('hFill');
    const hIndex  = document.getElementById('hIndex');
    const hTotal  = document.getElementById('hTotal');
    if (hTotal) hTotal.textContent = String(hSlides.length).padStart(2, '0');
    let hLastIdx = -1;

    const hScrollTl = gsap.to(hTrack, {
      x: getAmt,
      ease: 'none',
      scrollTrigger: {
        trigger: hSection,
        start: 'top top',
        end: () => `+=${Math.abs(getAmt())}`,
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => {
          const p = self.progress;
          if (hFill) hFill.style.transform = `scaleX(${p})`;
          const idx = Math.min(hSlides.length, Math.floor(p * hSlides.length) + 1);
          if (hIndex && idx !== hLastIdx) {
            hLastIdx = idx;
            hIndex.textContent = String(idx).padStart(2, '0');
          }
        }
      }
    });

    /* Horizontal parallax INSIDE each card image — depth as cards cross
       the viewport. Drives background-position (not transform) so it never
       collides with the pointer-driven 3D tilt on desktop. */
    gsap.utils.toArray('#horizTrack .h-card .h-img').forEach(img => {
      gsap.fromTo(img,
        { backgroundPosition: '20% center' },
        {
          backgroundPosition: '80% center', ease: 'none',
          scrollTrigger: {
            trigger: img.closest('.h-card'),
            containerAnimation: hScrollTl,
            start: 'left right', end: 'right left', scrub: true,
          }
        }
      );
    });

    /* ── §5 WORD SCRUB ────────────────────────────────────────────
       Opacity on .word spans (not color).
       Reason: color is CSS-inherited → fights GSAP inline writes.
       Opacity is stand-alone → GSAP has full exclusive control.
       scrubFill: thin red line tracks progress visually.
    ─────────────────────────────────────────────────────────────── */
    const words     = gsap.utils.toArray('#stmtText .word');
    const scrubFill = document.getElementById('scrubFill');

    gsap.set(words, { opacity: 0 });

    const stmtST = ScrollTrigger.create({
      trigger: '#s-stmt',
      start: 'top 60%',
      end: 'bottom 55%',
      scrub: 1.5,
      onUpdate: self => {
        if (scrubFill) scrubFill.style.width = (self.progress * 100) + '%';
      }
    });

    gsap.to(words, {
      opacity: 1,
      stagger: { each: .04, from: 'start' },
      ease: 'none',
      scrollTrigger: {
        trigger: '#s-stmt',
        start: 'top 60%',
        end: 'bottom 55%',
        scrub: 1.5,
      }
    });

    /* ── §6 STATS — counter animation on enter ────────────────── */
    /* Title chars slide up */
    gsap.from(gsap.utils.toArray('.stats-title .char'), {
      y: 60, opacity: 0, stagger: .02, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: '#s-stats', start: 'top 72%', toggleActions: 'play none none none' }
    });

    /* Stat items slide up staggered */
    gsap.from('.stat-item', {
      y: 40, opacity: 0, stagger: .1, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: '#s-stats', start: 'top 65%', toggleActions: 'play none none none' }
    });

    /* Number counters — slot-machine spin before settling */
    gsap.utils.toArray('.stat-n').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      ScrollTrigger.create({
        trigger: el,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          const FRAMES = 80;
          let f = 0;
          const spin = () => {
            f++;
            const p = f / FRAMES;
            if (p < .65) {
              /* Slot machine: rapid random numbers */
              el.textContent = Math.floor(Math.random() * (target * 1.6 + 5));
            } else {
              /* Ease in to exact target */
              const t = (p - .65) / .35;
              const ease = 1 - Math.pow(1 - t, 3);
              el.textContent = Math.round(ease * target);
            }
            if (f < FRAMES) requestAnimationFrame(spin);
            else el.textContent = target;
          };
          requestAnimationFrame(spin);
        }
      });
    });

    /* Bar fills */
    gsap.utils.toArray('.stat-bar-fill').forEach(el => {
      const pct = el.dataset.pct;
      gsap.to(el, {
        width: pct + '%',
        duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 80%', toggleActions: 'play none none none' }
      });
    });

    /* ── §7 FOOTER ────────────────────────────────────────────── */
    const ftChars = gsap.utils.toArray('.ft-line .char');
    gsap.set(ftChars, { y: '105%' });
    gsap.to(ftChars, {
      y: '0%', stagger: .018, duration: .85, ease: 'power3.out',
      scrollTrigger: { trigger: '#s-footer', start: 'top 72%', toggleActions: 'play none none none' }
    });

    /* Footer email + socials fade in */
    gsap.from(['.ft-contact', '.ft-credit'], {
      y: 20, opacity: 0, stagger: .12, duration: .6, ease: 'power2.out',
      scrollTrigger: { trigger: '#s-footer', start: 'top 60%', toggleActions: 'play none none none' }
    });

    /* Magnetic button — full elastic physics */
    const magArea = document.getElementById('magArea');
    const magBtn  = document.getElementById('magBtn');
    const magTxt  = document.getElementById('magTxt');
    if (!noPtrFx && magArea && magBtn) {
      magArea.addEventListener('mousemove', e => {
        const r = magArea.getBoundingClientRect();
        const x = e.clientX - r.left - r.width  / 2;
        const y = e.clientY - r.top  - r.height / 2;
        gsap.to(magBtn, { x: x*.45, y: y*.45, duration: .3, ease: 'power2.out', overwrite: 'auto' });
        gsap.to(magTxt, { x: x*.2,  y: y*.2,  duration: .3, ease: 'power2.out', overwrite: 'auto' });
      });
      magArea.addEventListener('mouseleave', () => {
        gsap.to(magBtn, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
        gsap.to(magTxt, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
      });
    }

    /* ── 3D CARD TILT (horizontal section) — pointer devices only ── */
    if (!noPtrFx) gsap.utils.toArray('.h-card').forEach(card => {
      const img = card.querySelector('.h-img');
      card.addEventListener('mousemove', e => {
        const rc = card.getBoundingClientRect();
        const x  = ((e.clientX - rc.left) / rc.width  - .5) * 2;
        const y  = ((e.clientY - rc.top)  / rc.height - .5) * 2;
        gsap.to(card, { rotationY: x * 7, rotationX: -y * 4, transformPerspective: 900, ease: 'power2.out', duration: .35, overwrite: 'auto' });
        if (img) gsap.to(img, { xPercent: x * -4, yPercent: y * -3, scale: 1.04, duration: .5, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(card, { rotationY: 0, rotationX: 0, duration: .9, ease: 'elastic.out(1,.5)', overwrite: 'auto' });
        if (img) gsap.to(img, { xPercent: 0, yPercent: 0, scale: 1.08, duration: .7, ease: 'power3.out', overwrite: 'auto' });
      });
    });

    /* ── CHAR GLITCH-IN on clip-path reveal section enter ────────── */
    ScrollTrigger.create({
      trigger: '#s-reveal',
      start: 'top 68%',
      once: true,
      onEnter: () => {
        /* Temporarily override clip-path to show chars, fire glitch anim */
        const chars = gsap.utils.toArray('.rv-line .char');
        chars.forEach((ch, i) => {
          setTimeout(() => {
            ch.classList.add('glit');
            /* Remove class after anim ends so GSAP clip-path scrub still works */
            setTimeout(() => ch.classList.remove('glit'), 460);
          }, i * 18);
        });
      }
    });

    /* ── ACTIVE NAV LINK — highlight the section in view ─────────── */
    gsap.utils.toArray('.hdr-nav a[href^="#"]').forEach(a => {
      const sec = document.querySelector(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: self => a.classList.toggle('active', self.isActive),
      });
    });

    /* ── SINGLE FINAL REFRESH ─────────────────────────────────────
       All triggers registered, all DOM mutations complete.
       One refresh recalculates every spacer and trigger position
       from a stable, loaded state.
    ─────────────────────────────────────────────────────────────── */
    ScrollTrigger.refresh();

  }); // end fonts.ready

  /* Resize */
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => ScrollTrigger.refresh(), 250);
  });

})();
