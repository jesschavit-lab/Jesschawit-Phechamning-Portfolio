/* Shared behaviour for the project pages: muted loops that play only on screen,
   a sound toggle, YouTube players that load on click, version switches and image zoom. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var play = function (v) { var pr = v.play(); if (pr) pr.catch(function () {}); };

  /* muted loops: load and play only while visible */
  $$('video[data-autoplay]').forEach(function (v) {
    if (reduce || !('IntersectionObserver' in window)) { if (!v.src && v.dataset.src) v.src = v.dataset.src; return; }
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; play(v); }
      else if (!v.paused) v.pause();
    }, { threshold: .2 }).observe(v);
  });

  /* sound on / off for a hero video */
  $$('[data-sound]').forEach(function (b) {
    var v = document.getElementById(b.getAttribute('data-sound'));
    if (!v) return;
    b.addEventListener('click', function () {
      v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; play(v); }
      b.setAttribute('aria-pressed', String(!v.muted));
    });
  });

  /* YouTube: thumbnail first, player after a click */
  $$('button[data-yt]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + b.getAttribute('data-yt') + '?autoplay=1&rel=0';
      f.title = b.getAttribute('aria-label') || 'YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      b.replaceChildren(f);
      b.style.cursor = 'default';
      b.removeAttribute('aria-label');
    }, { once: true });
  });

  /* version switch: [data-switch="<video id>"] holding buttons with data-src (+ data-link for the Drive button) */
  $$('[data-switch]').forEach(function (group) {
    var v = document.getElementById(group.getAttribute('data-switch'));
    var link = document.getElementById(group.getAttribute('data-link-target') || '');
    var buttons = $$('button', group);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        v.dataset.src = b.getAttribute('data-src');
        v.poster = b.getAttribute('data-poster') || v.poster;
        v.src = b.getAttribute('data-src');
        if (!reduce) play(v);
        if (link && b.getAttribute('data-link')) link.href = b.getAttribute('data-link');
      });
    });
  });

  /* ME MIND Y: pick an episode on the left, play it on the right */
  $$('[data-eplist]').forEach(function (box) {
    var items = $$('.ep-item', box), cover = box.querySelector('[data-ep-cover]'), cap = box.querySelector('[data-ep-caption]'), cur = 0;
    var thumb = function (id) {
      return '<img src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="" width="1280" height="720">' +
        '<span class="ep-play" aria-hidden="true"><svg><use href="#i-play"/></svg></span>';
    };
    items.forEach(function (it, i) {
      it.querySelector('.ep-head').addEventListener('click', function () {
        if (i === cur && !cover.dataset.playing) return;
        cur = i;
        items.forEach(function (x, k) {
          x.classList.toggle('is-open', k === i);
          x.querySelector('.ep-head').setAttribute('aria-expanded', String(k === i));
        });
        cover.classList.add('is-swapping'); cap.style.opacity = '0';
        setTimeout(function () {
          cover.innerHTML = thumb(it.dataset.id);
          var img = cover.querySelector('img');
          img.addEventListener('error', function () { img.src = 'https://i.ytimg.com/vi/' + it.dataset.id + '/hqdefault.jpg'; }, { once: true });
          delete cover.dataset.playing;
          cover.setAttribute('aria-label', 'เล่น EP.' + (i + 1));
          cap.textContent = it.dataset.title;
          cover.classList.remove('is-swapping'); cap.style.opacity = '1';
        }, reduce ? 0 : 260);
      });
    });
    cover.addEventListener('click', function () {
      if (cover.dataset.playing) return;
      var id = items[cur].dataset.id;
      if (location.protocol !== 'http:' && location.protocol !== 'https:') { window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener'); return; }
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = items[cur].dataset.title;
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      cover.replaceChildren(f);
      cover.dataset.playing = '1';
    });
  });

  /* project cards without a clip file: a muted YouTube loop, paused off screen */
  $$('[data-yt-loop]').forEach(function (box) {
    if (reduce || !('IntersectionObserver' in window) || !/^https?:$/.test(location.protocol)) return;
    var id = box.getAttribute('data-yt-loop'), f = null, wait = 0;
    var send = function (func) { if (f) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), '*'); };
    new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) { send('pauseVideo'); return; }
      if (f) { send('playVideo'); return; }
      f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=1&loop=1&playlist=' + id +
        '&controls=0&disablekb=1&playsinline=1&rel=0&iv_load_policy=3&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
      f.tabIndex = -1;
      f.setAttribute('aria-hidden', 'true');
      f.allow = 'autoplay; encrypted-media';
      f.addEventListener('load', function () { f.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*'); });
      box.appendChild(f);
    }, { threshold: .2 }).observe(box);
    window.addEventListener('message', function (m) {
      if (!f || m.source !== f.contentWindow || typeof m.data !== 'string') return;
      var d; try { d = JSON.parse(m.data); } catch (err) { return; }
      if (!d.info || typeof d.info.playerState !== 'number') return;
      /* the player draws its title, spinner and "More videos" while loading or paused: keep the photo up until it has played a moment */
      clearTimeout(wait);
      if (d.info.playerState === 1) wait = setTimeout(function () { box.classList.add('is-playing'); }, 1500);
      else box.classList.remove('is-playing');
    });
  });

  /* image zoom */
  var zoom = document.querySelector('[data-zoom-dialog]');
  if (zoom && typeof zoom.showModal === 'function') {
    var zimg = zoom.querySelector('img'), last = null;
    $$('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        last = b;
        zimg.src = b.getAttribute('data-zoom');
        zimg.alt = b.querySelector('img') ? b.querySelector('img').alt : '';
        zoom.showModal();
      });
    });
    zoom.addEventListener('click', function (e) { if (e.target === zoom || e.target.closest('[data-zoom-close]')) zoom.close(); });
    zoom.addEventListener('close', function () { if (last) last.focus({ preventScroll: true }); });
  }
})();
