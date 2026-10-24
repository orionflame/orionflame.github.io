/* Preview images and playback IDs intentionally remain independent. */
(() => {
  'use strict';
  const dialog = document.querySelector('#still-dialog');
  const still = document.querySelector('#still-image');
  const size = document.querySelector('#still-size');
  let returnFocus;
  document.querySelector('#close-still').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => returnFocus?.focus());
  size.addEventListener('click', () => {
    const native = dialog.querySelector('.still-scroll').classList.toggle('native');
    size.setAttribute('aria-pressed', String(native));
    size.textContent = native ? 'Fit to window' : 'Actual pixels';
  });

  let apiPromise;
  function loadAPI() {
    if (window.YT?.Player) return Promise.resolve();
    if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = resolve;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => reject(new Error('YouTube could not load.'));
      document.head.appendChild(script);
      setTimeout(() => { if (!window.YT?.Player) reject(new Error('YouTube did not respond.')); }, 15000);
    });
    return apiPromise;
  }
  const players = new Set();
  document.querySelectorAll('button.video-cover[data-video]').forEach(button => {
    const slot = button.closest('.media-slot');
    const title = button.dataset.title;
    const image = button.querySelector('img');
    const controls = document.createElement('div');
    controls.className = 'media-actions';
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.textContent = 'Inspect still ↗';
    inspect.setAttribute('aria-label', 'Inspect full-resolution still: ' + title);
    inspect.addEventListener('click', () => {
      returnFocus = inspect;
      still.src = image.dataset.full || image.src;
      still.alt = image.alt;
      document.querySelector('#still-title').textContent = title;
      document.querySelector('#still-file').href = still.src;
      dialog.querySelector('.still-scroll').classList.remove('native');
      size.setAttribute('aria-pressed', 'false'); size.textContent = 'Actual pixels';
      dialog.showModal();
    });
    const direct = document.createElement('a');
    direct.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(button.dataset.video);
    direct.target = '_blank'; direct.rel = 'noopener noreferrer';
    direct.textContent = 'Watch on YouTube ↗';
    direct.setAttribute('aria-label', 'Watch on YouTube: ' + title);
    controls.append(inspect, direct);
    slot.after(controls);
    image.addEventListener('error', () => {
      // A missing asset must remain explicit, never become an unrelated thumbnail.
      image.hidden = true;
      button.setAttribute('aria-label', 'Preview image unavailable. Play ' + title);
      inspect.disabled = true;
    });
    button.addEventListener('click', () => {
      if (slot.dataset.state) return;
      slot.dataset.state = 'loading';
      const status = document.createElement('p');
      status.className = 'media-status'; status.setAttribute('role', 'status');
      status.textContent = 'Loading YouTube player…'; controls.after(status);
      const restore = document.createElement('button');
      restore.type = 'button'; restore.textContent = 'Return to still';
      controls.append(restore);
      let player;
      restore.addEventListener('click', () => {
        if (player) { players.delete(player); player.destroy(); }
        slot.replaceChildren(button); delete slot.dataset.state;
        status.remove(); restore.remove(); button.focus();
      });
      loadAPI().then(() => {
        if (!restore.isConnected) return;
        const frame = document.createElement('iframe');
        frame.title = title;
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        const params = new URLSearchParams({enablejsapi:'1', autoplay:'1', mute:'1', rel:'0', playsinline:'1', origin:location.origin, widget_referrer:location.href});
        frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(button.dataset.video) + '?' + params;
        slot.replaceChildren(frame);
        player = new YT.Player(frame, {events: {
          onReady: event => { event.target.mute(); status.textContent = 'Starts muted. Press play if your browser paused autoplay.'; event.target.playVideo(); },
          onStateChange: event => {
            if (event.data === YT.PlayerState.PLAYING) {
              slot.dataset.state = 'playing'; status.textContent = '';
              players.forEach(other => { if (other !== player) other.pauseVideo(); });
            }
          },
          onError: event => {
            slot.dataset.state = 'error';
            status.textContent = 'YouTube could not play this embed (error ' + event.data + '). Use “Watch on YouTube” above.';
          },
          onAutoplayBlocked: () => { status.textContent = 'Autoplay was paused by your browser. Press play in the video.'; }
        }});
        players.add(player);
      }).catch(() => {
        slot.dataset.state = 'error';
        status.textContent = 'YouTube could not load. Use “Watch on YouTube” above.';
      });
    });
  });
  document.querySelectorAll('.look-row').forEach(row => {
    const frame = row.parentElement.querySelector('.asset-frame');
    row.querySelectorAll('[data-look-choice]').forEach(button => {
      button.addEventListener('click', () => {
        frame.dataset.look = button.dataset.lookChoice;
        row.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      });
    });
  });
})();
