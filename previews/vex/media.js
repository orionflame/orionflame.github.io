/* Lightweight media playback, resilient thumbnails, and page-load safeguards. */
(() => {
  'use strict';

  const VOLUME_2 = 'Volume 2';
  const externalImageDimensions = new Map([
    ['https://pragmatic-vfx.com/companies7.png', [800, 100]],
    ['https://pragmatic-vfx.com/artists7.png', [800, 300]],
    ['https://pragmatic-vfx.com/posters_filtered.png', [800, 480]],
  ]);

  function moveVolumeTwoFirst() {
    const trailerGrid = document.querySelector('.course-trailer-grid');
    if (trailerGrid) {
      const children = Array.from(trailerGrid.children);
      const volumeTwo = children.find((child) => child.querySelector(`[data-title^="${VOLUME_2}"]`));
      const volumeOne = children.find((child) => child !== volumeTwo && child.querySelector('[data-title^="Volume 1"]'));
      if (volumeTwo && volumeOne) trailerGrid.insertBefore(volumeTwo, volumeOne);
    }

    const filmGrid = document.querySelector('.course-film-grid');
    if (filmGrid) {
      const children = Array.from(filmGrid.children);
      const volumeTwo = children.find((child) => child.querySelector('.film-vol.blue') || child.textContent.includes(VOLUME_2));
      const volumeOne = children.find((child) => child !== volumeTwo && child.textContent.includes('Volume 1'));
      if (volumeTwo && volumeOne) filmGrid.insertBefore(volumeTwo, volumeOne);
    }
  }

  function addResourceHint(rel, href, crossOrigin = false) {
    if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    if (crossOrigin) link.crossOrigin = '';
    document.head.append(link);
  }

  function setKnownDimensions(image) {
    const source = image.getAttribute('src');
    const dimensions = externalImageDimensions.get(source);
    if (!dimensions) return;
    if (!image.hasAttribute('width')) image.setAttribute('width', String(dimensions[0]));
    if (!image.hasAttribute('height')) image.setAttribute('height', String(dimensions[1]));
  }

  function revealDeferredImage(image) {
    const source = image.dataset.perfSrc;
    if (!source) return;

    image.dataset.perfState = 'loading';
    image.addEventListener('load', () => {
      image.dataset.perfState = 'ready';
    }, { once: true });
    image.addEventListener('error', () => {
      image.dataset.perfState = 'error';
    }, { once: true });
    image.setAttribute('src', source);
    delete image.dataset.perfSrc;
  }

  function configureImages() {
    const priorityImages = new Set(
      Array.from(document.querySelectorAll('#volumes .course-trailer-grid img')),
    );

    document.querySelectorAll('img').forEach((image) => {
      setKnownDimensions(image);
      image.decoding = 'async';

      if (priorityImages.has(image) || image.closest('.site-nav')) {
        image.loading = 'eager';
        image.fetchPriority = image.closest('.course-trailer-grid')?.firstElementChild?.contains(image)
          ? 'high'
          : 'auto';
      } else {
        image.loading = 'lazy';
        image.fetchPriority = 'low';
      }
    });

    const remoteImages = Array.from(
      document.querySelectorAll('img[src^="https://pragmatic-vfx.com/"]'),
    );
    if (!remoteImages.length) return;

    if (!('IntersectionObserver' in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        observer.unobserve(image);
        revealDeferredImage(image);
      });
    }, { rootMargin: '1000px 0px' });

    remoteImages.forEach((image) => {
      const source = image.getAttribute('src');
      if (!source) return;
      image.dataset.perfSrc = source;
      image.dataset.perfState = 'deferred';
      image.removeAttribute('src');
      observer.observe(image);
    });
  }

  function installImageFallback(image, button) {
    const showFailure = () => {
      image.hidden = true;
      button.setAttribute('aria-label', `Preview image unavailable. Play ${button.dataset.title}`);
    };

    const handleError = () => {
      const previewId = button.dataset.previewVideo || button.dataset.video;
      if (!previewId || image.dataset.fallbackTried === 'true') {
        showFailure();
        return;
      }

      image.dataset.fallbackTried = 'true';
      image.hidden = false;
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = `https://i.ytimg.com/vi/${encodeURIComponent(previewId)}/hqdefault.jpg`;
    };

    image.addEventListener('error', handleError);
    if (image.complete && image.getAttribute('src') && image.naturalWidth === 0) {
      queueMicrotask(handleError);
    }
  }

  function addPlayerChrome(button, slot) {
    const title = button.dataset.title || 'Video';

    let titleLabel = button.querySelector('.player-title');
    if (!titleLabel) {
      titleLabel = document.createElement('span');
      titleLabel.className = 'player-title';
      titleLabel.textContent = title;
      button.append(titleLabel);
    }

    let direct = slot.querySelector(':scope > .player-link');
    if (!direct) {
      direct = document.createElement('a');
      direct.className = 'player-link';
      direct.textContent = '↗';
      direct.href = `https://www.youtube.com/watch?v=${encodeURIComponent(button.dataset.video)}`;
      direct.target = '_blank';
      direct.rel = 'noopener noreferrer';
      direct.title = 'Open on YouTube';
      direct.setAttribute('aria-label', `Open on YouTube: ${title}`);
      slot.append(direct);
    }

    return { title, direct };
  }

  moveVolumeTwoFirst();
  configureImages();

  addResourceHint('preconnect', 'https://i.ytimg.com', true);
  addResourceHint('preconnect', 'https://www.youtube-nocookie.com', true);
  addResourceHint('dns-prefetch', '//pragmatic-vfx.com');

  let activePlayer = null;

  function closePlayer(player, restoreFocus = true) {
    if (!player) return;
    clearTimeout(player.loadTimer);
    try {
      player.frame?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        'https://www.youtube-nocookie.com',
      );
    } catch (_) {
      // The iframe may already be gone or blocked; cleanup still continues.
    }

    player.slot.replaceChildren(player.button, player.direct);
    delete player.slot.dataset.state;
    player.status.remove();
    if (activePlayer === player) activePlayer = null;
    if (restoreFocus && player.button.isConnected) player.button.focus();
  }

  document.querySelectorAll('button.video-cover[data-video]').forEach((button) => {
    const slot = button.closest('.media-slot');
    const image = button.querySelector('img');
    if (!slot || !image) return;

    const { title, direct } = addPlayerChrome(button, slot);
    installImageFallback(image, button);

    button.addEventListener('click', () => {
      if (slot.dataset.state) return;
      if (activePlayer && activePlayer.slot !== slot) closePlayer(activePlayer, false);

      slot.dataset.state = 'loading';

      const status = document.createElement('p');
      status.className = 'media-status';
      status.setAttribute('role', 'status');
      status.textContent = 'Loading YouTube player…';
      slot.after(status);

      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = '×';
      restore.className = 'player-reset';
      restore.setAttribute('aria-label', `Close video: ${title}`);
      restore.title = 'Close video';

      const frame = document.createElement('iframe');
      frame.title = title;
      frame.loading = 'eager';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';

      const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        rel: '0',
        playsinline: '1',
        enablejsapi: '1',
        origin: location.origin,
        widget_referrer: location.href,
      });
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(button.dataset.video)}?${params}`;

      const player = {
        button,
        direct,
        frame,
        loadTimer: 0,
        restore,
        slot,
        status,
      };
      activePlayer = player;

      restore.addEventListener('click', () => closePlayer(player));
      frame.addEventListener('load', () => {
        if (activePlayer !== player) return;
        clearTimeout(player.loadTimer);
        slot.dataset.state = 'playing';
        status.textContent = 'Starts muted. Press play if your browser paused autoplay.';
      }, { once: true });
      frame.addEventListener('error', () => {
        if (activePlayer !== player) return;
        clearTimeout(player.loadTimer);
        slot.dataset.state = 'error';
        status.textContent = 'YouTube could not load this embed. Use the YouTube link in the player corner.';
      }, { once: true });

      player.loadTimer = window.setTimeout(() => {
        if (activePlayer !== player || slot.dataset.state !== 'loading') return;
        status.textContent = 'The player is taking longer than expected. The direct YouTube link is available in the corner.';
      }, 12000);

      slot.replaceChildren(frame, direct, restore);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activePlayer) closePlayer(activePlayer);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !activePlayer?.frame?.contentWindow) return;
    try {
      activePlayer.frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        'https://www.youtube-nocookie.com',
      );
    } catch (_) {
      // Ignore a player that was removed while the tab was being hidden.
    }
  });

  document.querySelectorAll('.look-row').forEach((row) => {
    const frame = row.parentElement?.querySelector('.asset-frame');
    if (!frame) return;
    row.querySelectorAll('[data-look-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        frame.dataset.look = button.dataset.lookChoice;
        row.querySelectorAll('button').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });
  });

  const curriculumButton = document.getElementById('toggle-curriculum');
  if (curriculumButton) {
    curriculumButton.addEventListener('click', () => {
      const items = Array.from(document.querySelectorAll('.topic-category'));
      const expand = !items.every((item) => item.open);
      items.forEach((item) => { item.open = expand; });
      curriculumButton.textContent = expand ? 'Collapse all topics' : 'Expand all topics';
      curriculumButton.setAttribute('aria-expanded', String(expand));
    });
  }
})();
