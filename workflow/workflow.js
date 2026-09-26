(() => {
  "use strict";

  const mediaSlots = {
    "WF-HERO": {
      kind: "placeholder",
      title: "Workflow overview",
      placeholder: "Video coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Pragmatic Workflow overview inside Houdini",
      caption: ""
    },
    "WF-NETWORK": {
      kind: "placeholder",
      title: "Overlay Network Editor + Hotkey System",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Overlay Network Editor shown over the Houdini viewport",
      caption: ""
    },
    "WF-PARAMETERS": {
      kind: "placeholder",
      title: "Parameter Editor",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Pragmatic Workflow Parameter Editor controls",
      caption: ""
    },
    "WF-CODE": {
      kind: "placeholder",
      title: "Code editing",
      placeholder: "VEX · OpenCL · Python · C++ clips coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Monaco-based code editing integrated with Pragmatic Workflow",
      caption: ""
    },
    "WF-NODE-INFO": {
      kind: "placeholder",
      title: "Node Info",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Node Info showing geometry and volume information",
      caption: ""
    },
    "WF-SPREADSHEET": {
      kind: "placeholder",
      title: "Spreadsheet",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Pragmatic Workflow Spreadsheet inspecting Houdini geometry data",
      caption: ""
    },
    "WF-PROFILER": {
      kind: "placeholder",
      title: "Profiler",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Pragmatic Workflow Profiler comparing Houdini performance captures",
      caption: ""
    },
    "WF-FIND": {
      kind: "placeholder",
      title: "Node Treeview + Tab Menu",
      placeholder: "Product clips coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Node Treeview and context-aware node creation palette",
      caption: ""
    },
    "WF-HUD": {
      kind: "placeholder",
      title: "Performance HUD",
      placeholder: "Product clip coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Customizable CPU, RAM, GPU and VRAM performance gauges",
      caption: ""
    },
    "WF-CUSTOMIZE": {
      kind: "placeholder",
      title: "Personalization",
      placeholder: "Settings image coming soon",
      imageSrc: "",
      videoSrc: "",
      posterSrc: "",
      alt: "Pragmatic Workflow personalization settings",
      caption: ""
    }
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const liveVideos = new Set();

  function makePlaceholder(slotId, slot) {
    const placeholder = document.createElement("div");
    placeholder.className = "media-placeholder";
    placeholder.innerHTML = `
      <div class="media-placeholder-inner">
        <span class="media-placeholder-id">${slotId}</span>
        <span class="media-placeholder-title">${slot.title}</span>
        <span class="media-placeholder-note">${slot.placeholder}</span>
      </div>
    `;
    return placeholder;
  }

  function makeImage(slot) {
    const image = document.createElement("img");
    image.src = slot.imageSrc;
    image.alt = slot.alt || "";
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }

  function makeVideo(slot) {
    const video = document.createElement("video");
    video.src = slot.videoSrc;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", slot.alt || slot.title || "Product demonstration");

    if (slot.posterSrc) {
      video.poster = slot.posterSrc;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "media-toggle";
    toggle.textContent = "Play";
    toggle.setAttribute("aria-label", `Play ${slot.title} demonstration`);

    const setState = (playing) => {
      toggle.textContent = playing ? "Pause" : "Play";
      toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${slot.title} demonstration`);
    };

    toggle.addEventListener("click", async () => {
      if (video.paused) {
        try {
          await video.play();
          setState(true);
        } catch (_) {
          setState(false);
        }
      } else {
        video.pause();
        setState(false);
      }
    });

    video.addEventListener("play", () => setState(true));
    video.addEventListener("pause", () => setState(false));

    liveVideos.add(video);
    return { video, toggle };
  }

  function mountMedia() {
    document.querySelectorAll("[data-media-slot]").forEach((mount) => {
      const slotId = mount.getAttribute("data-media-slot");
      const slot = mediaSlots[slotId];

      if (!slot) {
        mount.append(makePlaceholder(slotId || "UNKNOWN", {
          title: "Media slot",
          placeholder: "Configuration missing"
        }));
        return;
      }

      if (slot.videoSrc) {
        const { video, toggle } = makeVideo(slot);
        mount.append(video, toggle);
      } else if (slot.imageSrc) {
        mount.append(makeImage(slot));
      } else {
        mount.append(makePlaceholder(slotId, slot));
      }

      if (slot.caption) {
        const caption = document.createElement("figcaption");
        caption.className = "media-caption";
        caption.textContent = slot.caption;
        mount.parentElement?.append(caption);
      }
    });
  }

  function installVideoVisibility() {
    if (!liveVideos.size || reduceMotion || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.45, 0.8] });

    liveVideos.forEach((video) => observer.observe(video));
  }

  function installExplorer() {
    const filter = document.querySelector("[data-feature-filter]");
    const groups = [...document.querySelectorAll(".feature-group")];
    const expand = document.querySelector("[data-expand-all]");
    const collapse = document.querySelector("[data-collapse-all]");
    const empty = document.querySelector("[data-filter-empty]");

    if (!filter || !groups.length) return;

    const applyFilter = () => {
      const query = filter.value.trim().toLowerCase();
      let visibleCount = 0;

      groups.forEach((group) => {
        const haystack = group.textContent.toLowerCase();
        const matches = !query || haystack.includes(query);
        group.hidden = !matches;

        if (matches) {
          visibleCount += 1;
          if (query) group.open = true;
        }
      });

      if (empty) {
        empty.classList.toggle("visible", visibleCount === 0);
      }
    };

    filter.addEventListener("input", applyFilter);
    expand?.addEventListener("click", () => groups.forEach((group) => {
      if (!group.hidden) group.open = true;
    }));
    collapse?.addEventListener("click", () => groups.forEach((group) => {
      if (!group.hidden) group.open = false;
    }));
  }

  function updateYear() {
    const year = document.querySelector("[data-current-year]");
    if (year) year.textContent = new Date().getFullYear();
  }

  mountMedia();
  installVideoVisibility();
  installExplorer();
  updateYear();

  window.PRAGMATIC_WORKFLOW_MEDIA = mediaSlots;
})();
