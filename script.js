/* ==========================================================================
   Oakland On Top: site script (used by every page)

   Contents
   1. Early setup (runs immediately, before the page is drawn)
   2. Image fallback (tries to show every image)
   3. Scroll reveal (cards fade up as you scroll)
   4. Header (hides when scrolling down, returns when scrolling up)
   5. Mobile menu
   6. Scrolling slogan strip
   7. Close look (the story pop-up)
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ------------------------------------------------------------------------
     1. EARLY SETUP
     This file is loaded in the <head>, so this part runs before anything is
     painted. The "js" class lets the CSS hide things that will animate in.
     If this file ever fails to load, the class is never added and the whole
     page simply shows normally.
     ------------------------------------------------------------------------ */
  root.classList.add('js');

  // The opening curtain (home page only) plays once per browser session.
  if (root.hasAttribute('data-intro')) {
    try {
      if (sessionStorage.getItem('oot-intro')) {
        root.classList.add('seen');
      } else {
        sessionStorage.setItem('oot-intro', '1');
      }
    } catch (error) {
      root.classList.add('seen');
    }
  }


  /* ------------------------------------------------------------------------
     2. IMAGE FALLBACK
     Some websites refuse to show their pictures on other sites. When an image
     fails, we try again in this order:
       1st failure: reload it without hiding the referrer
       2nd failure: load it through a free public image proxy (weserv.nl)
       3rd failure: show a friendly "Image unavailable" box
     ------------------------------------------------------------------------ */
  function onImageError(event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG' || img.src.indexOf('data:') === 0) return;

    var attempt = Number(img.dataset.attempt || 0);
    img.dataset.attempt = attempt + 1;
    if (!img.dataset.original) img.dataset.original = img.src;
    var original = img.dataset.original;

    if (attempt === 0) {
      img.removeAttribute('referrerpolicy');
      img.src = original + (original.indexOf('#') < 0 ? '#retry' : '');
    } else if (attempt === 1) {
      img.src = 'https://images.weserv.nl/?url=' + encodeURIComponent(original) + '&w=1600&q=85';
    } else {
      showPlaceholder(img);
    }
  }

  function showPlaceholder(img) {
    if (img.closest('.sponsors')) {
      img.remove();                                   // drop broken sponsor logos
      return;
    }
    var box = img.closest('.thumb, .frame');
    if (box) {
      box.classList.add('missing');                   // CSS shows "Image unavailable"
    } else if (img.id !== 'm-img') {
      img.style.visibility = 'hidden';
    }
  }

  // Image errors do not bubble, so listen during the capture phase.
  document.addEventListener('error', onImageError, true);


  /* ------------------------------------------------------------------------
     3. SCROLL REVEAL
     Every element with class "reveal" fades up the first time it scrolls
     into view. Its --i variable staggers cards so they arrive one by one.
     ------------------------------------------------------------------------ */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');

    if (!('IntersectionObserver' in window)) {
      root.classList.remove('js');                    // very old browser: show everything
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var el = entry.target;
        el.classList.add('in');
        observer.unobserve(el);

        // Once it has arrived, drop the stagger delay so hover effects feel instant.
        setTimeout(function () { el.style.setProperty('--i', 0); }, 1400);
      });
    }, { threshold: 0.12 });

    items.forEach(function (el) { observer.observe(el); });
  }


  /* ------------------------------------------------------------------------
     4. HEADER
     Slides away while you scroll down, slides back as soon as you scroll up.
     Also toggles the back-to-top button and a soft shadow.
     ------------------------------------------------------------------------ */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var toTop = document.getElementById('backToTop');
    if (!header) return;

    var lastY = window.scrollY;
    var waiting = false;

    function update() {
      var y = Math.max(window.scrollY, 0);
      var change = y - lastY;
      var menuOpen = document.body.classList.contains('menu-open');

      if (y < 80) {
        header.classList.remove('hide');              // always visible at the top
        lastY = y;
      } else if (Math.abs(change) > 6) {                // ignore tiny wiggles
        if (change > 0 && !menuOpen) {
          header.classList.add('hide');
        } else if (change < 0) {
          header.classList.remove('hide');
        }
        lastY = y;
      }

      header.classList.toggle('stuck', y > 10);
      if (toTop) toTop.classList.toggle('show', y > 700);
      waiting = false;
    }

    window.addEventListener('scroll', function () {
      if (!waiting) {
        waiting = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    // Keyboard users tabbing into the header should always see it.
    header.addEventListener('focusin', function () { header.classList.remove('hide'); });
  }


  /* ------------------------------------------------------------------------
     5. MOBILE MENU
     ------------------------------------------------------------------------ */
  function initMenu() {
    var button = document.querySelector('.menu-btn');
    var nav = document.getElementById('nav');
    if (!button || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('open', open);
      document.body.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', open);
    }

    button.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) setOpen(false);
    });
  }


  /* ------------------------------------------------------------------------
     6. SCROLLING SLOGAN STRIP (home page)
     The page lists each slogan once. We repeat them until the strip is wider
     than the screen, then double it so the CSS animation can loop seamlessly.
     ------------------------------------------------------------------------ */
  function initTicker() {
    var track = document.querySelector('.track');
    if (!track) return;

    var original = track.innerHTML;
    var guard = 0;
    while (track.scrollWidth < window.innerWidth * 3 && guard < 12) {
      track.insertAdjacentHTML('beforeend', original);
      guard += 1;
    }
    track.insertAdjacentHTML('beforeend', track.innerHTML);
  }


  /* ------------------------------------------------------------------------
     7. CLOSE LOOK (story pop-up)
     Clicking a mural card opens a <dialog> that grows out of the card.
     Previous / Next, the arrow keys and swiping move between murals.
     ------------------------------------------------------------------------ */
  function initViewer() {
    var dialog = document.getElementById('modal');
    if (!dialog) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('button.card'));
    var body = dialog.querySelector('.modal-body');
    var image = document.getElementById('m-img');
    var current = 0;

    function byId(id) { return document.getElementById(id); }
    function twoDigits(n) { return n < 10 ? '0' + n : String(n); }

    // Put the chosen mural's details into the dialog.
    function show(index) {
      current = (index + cards.length) % cards.length;

      var card = cards[current];
      var data = card.dataset;
      var cardImage = card.querySelector('img');
      var group = card.closest('[data-tone]');

      // Reset the image fallback, then reuse the card's (already working) picture.
      delete image.dataset.attempt;
      delete image.dataset.original;
      image.setAttribute('referrerpolicy', 'no-referrer');
      image.src = (cardImage && cardImage.src) || data.img;
      image.alt = data.title + ' mural';

      byId('m-title').textContent = data.title;
      byId('m-by').textContent = data.by;
      byId('m-by').hidden = !data.by;
      byId('m-text').textContent = data.text;
      byId('m-count').textContent = twoDigits(current + 1) + ' / ' + twoDigits(cards.length);
      dialog.dataset.tone = group ? group.dataset.tone : 'red';

      // Restart the entrance animation (wipe, zoom, text rising in).
      if (!reduceMotion) {
        body.classList.remove('go');
        void body.offsetWidth;                         // forces a restart
        body.classList.add('go');
      }
    }

    // Open the dialog so it appears to grow out of the clicked card.
    function open(index, fromCard) {
      show(index);
      dialog.showModal();
      dialog.scrollTop = 0;

      if (reduceMotion || !fromCard) return;

      var box = dialog.getBoundingClientRect();
      var start = fromCard.getBoundingClientRect();
      var scale = Math.min(1, Math.max(0.2, start.width / box.width));
      var moveX = start.left + start.width / 2 - (box.left + box.width / 2);
      var moveY = start.top + start.height / 2 - (box.top + box.height / 2);

      dialog.animate([
        { transform: 'translate(' + moveX + 'px, ' + moveY + 'px) scale(' + scale + ')', opacity: 0 },
        { opacity: 1, offset: 0.35 },
        { transform: 'none', opacity: 1 }
      ], { duration: 560, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    }

    // Fade the dialog out, then close it.
    function close() {
      if (!dialog.open) return;
      if (reduceMotion) { dialog.close(); return; }

      var fade = dialog.animate([
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(24px) scale(.95)' }
      ], { duration: 220, easing: 'ease-in' });
      fade.onfinish = function () { dialog.close(); };
    }

    cards.forEach(function (card, index) {
      card.addEventListener('click', function () { open(index, card); });
    });

    dialog.querySelector('.close').addEventListener('click', close);
    dialog.querySelector('.prev').addEventListener('click', function () { show(current - 1); });
    dialog.querySelector('.next').addEventListener('click', function () { show(current + 1); });

    // Esc key and clicking the dark backdrop use the same animated close.
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });

    // Arrow keys.
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') show(current + 1);
      if (event.key === 'ArrowLeft') show(current - 1);
    });

    // Swipe left / right on touch screens.
    var touchStartX = 0;
    dialog.addEventListener('touchstart', function (event) {
      touchStartX = event.touches[0].clientX;
    }, { passive: true });
    dialog.addEventListener('touchend', function (event) {
      var distance = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(distance) > 70) show(current + (distance < 0 ? 1 : -1));
    }, { passive: true });
  }


  /* ------------------------------------------------------------------------
     START
     Each piece is wrapped so one problem can never stop the others.
     ------------------------------------------------------------------------ */
  function safely(task) {
    try { task(); } catch (error) { console.error(error); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    safely(initReveal);
    safely(initHeader);
    safely(initMenu);
    safely(initTicker);
    safely(initViewer);
  });
})();
