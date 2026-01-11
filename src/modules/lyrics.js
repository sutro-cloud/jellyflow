import { dom } from "./dom.js";
import { state } from "./state.js";
import { fetchJson } from "./api.js";
import { albumArtist, albumTitle } from "./music.js";
import { normalizeStartValue, parseTimeToSeconds, ticksToSeconds } from "./utils.js";

function parseLrc(text) {
  const lines = [];
  let hasTimestamps = false;
  const timeTag = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]/g;

  text.split(/\r?\n/).forEach((line) => {
    const times = [];
    let match;
    while ((match = timeTag.exec(line)) !== null) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
      if (Number.isFinite(minutes) && Number.isFinite(seconds) && Number.isFinite(fraction)) {
        times.push(minutes * 60 + seconds + fraction);
      }
    }
    timeTag.lastIndex = 0;
    const content = line.replace(timeTag, "").trim();
    if (times.length) {
      hasTimestamps = true;
      if (content) {
        times.forEach((time) => {
          lines.push({ time, text: content });
        });
      }
      return;
    }
    if (content) {
      lines.push({ time: null, text: content });
    }
  });

  return { lines, hasTimestamps };
}

function parseLyricsObject(payload) {
  if (Array.isArray(payload)) {
    return parseLyricsObject({ Lyrics: payload });
  }
  if (payload && Array.isArray(payload.Lyrics)) {
    const lines = payload.Lyrics
      .map((line) => {
        const text = (line.Text || line.text || "").toString().trim();
        if (!text) {
          return null;
        }
        let time = null;
        if (line.StartTicks != null) {
          time = ticksToSeconds(line.StartTicks);
        } else if (line.Start != null) {
          time = normalizeStartValue(line.Start);
        } else if (line.StartTime != null) {
          time = parseTimeToSeconds(line.StartTime);
        }
        if (time == null) {
          return null;
        }
        return { time, text };
      })
      .filter(Boolean);
    return { lines, hasTimestamps: true };
  }
  if (payload && typeof payload.Lyrics === "string") {
    return parseLrc(payload.Lyrics);
  }
  if (payload && typeof payload.Text === "string") {
    return parseLrc(payload.Text);
  }
  return { lines: [], hasTimestamps: false };
}

function parseLyricsPayload(payload) {
  if (!payload) {
    return { lines: [], hasTimestamps: false };
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return parseLyricsObject(parsed);
    } catch (error) {
      return parseLrc(payload);
    }
  }
  if (typeof payload === "object") {
    return parseLyricsObject(payload);
  }
  return { lines: [], hasTimestamps: false };
}

const lyricsCache = new Map();
const LYRICS_CACHE_LIMIT = 120;

function makeLyricsCacheKey(track, album) {
  if (!track) {
    return null;
  }
  const artist = track.AlbumArtist || (Array.isArray(track.Artists) ? track.Artists[0] : "");
  const albumName = track.Album || (album ? albumTitle(album) : "");
  return `${track.Id || ""}|${track.Name || ""}|${artist || ""}|${albumName || ""}`.toLowerCase();
}

function cacheLyrics(key, payload) {
  if (!key || !payload) {
    return;
  }
  if (lyricsCache.has(key)) {
    lyricsCache.delete(key);
  }
  lyricsCache.set(key, payload);
  if (lyricsCache.size > LYRICS_CACHE_LIMIT) {
    const firstKey = lyricsCache.keys().next().value;
    lyricsCache.delete(firstKey);
  }
}

function getCachedLyrics(key) {
  if (!key || !lyricsCache.has(key)) {
    return null;
  }
  const payload = lyricsCache.get(key);
  lyricsCache.delete(key);
  lyricsCache.set(key, payload);
  return payload;
}

async function fetchLyricsFromLrclib(track, album) {
  const title = track?.Name ? track.Name.trim() : "";
  const artist =
    track?.AlbumArtist ||
    (Array.isArray(track?.Artists) && track.Artists.length ? track.Artists[0] : "") ||
    (album ? albumArtist(album) : "");
  if (!title || !artist) {
    return null;
  }
  const albumName = track?.Album || (album ? albumTitle(album) : "");
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  });
  if (albumName) {
    params.set("album_name", albumName);
  }

  let response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
  if (response.status === 404) {
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    response = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`);
  }

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  return data;
}

function getTrackDurationSeconds(track) {
  if (track && track.RunTimeTicks) {
    return ticksToSeconds(track.RunTimeTicks);
  }
  if (Number.isFinite(dom.audio.duration) && dom.audio.duration > 0) {
    return dom.audio.duration;
  }
  return null;
}

function applyEstimatedTimings(lines, duration) {
  if (!lines.length || !duration) {
    return lines.map((line) => ({ time: null, text: line.text }));
  }
  const step = duration / Math.max(lines.length, 1);
  return lines.map((line, index) => ({
    time: Math.max(0, index * step),
    text: line.text,
  }));
}

function renderLyricsPlaceholder(message) {
  dom.lyricsTrack.style.transform = "translateY(0)";
  dom.lyricsTrack.innerHTML = "";
  const line = document.createElement("div");
  line.className = "lyrics-line is-active";
  line.textContent = message;
  dom.lyricsTrack.appendChild(line);
  state.lyricsLineEls = [line];
  state.lyrics.activeIndex = 0;
}

function updateLyricsStatus(message) {
  dom.lyricsStatus.textContent = message;
}

export function resetLyricsPanel() {
  state.lyrics = {
    trackId: null,
    lines: [],
    mode: "none",
    activeIndex: -1,
    pendingLines: null,
  };
  state.lyricsLineEls = [];
  updateLyricsStatus("No track playing");
  renderLyricsPlaceholder("Start playing a track to see lyrics.");
}

function setLyricsLines(lines, mode, pendingLines = null, statusLabel = null) {
  state.lyrics.lines = lines;
  state.lyrics.mode = mode;
  state.lyrics.activeIndex = -1;
  state.lyrics.pendingLines = pendingLines;
  dom.lyricsTrack.style.transform = "translateY(0)";
  dom.lyricsTrack.innerHTML = "";

  if (!lines.length) {
    renderLyricsPlaceholder("No lyrics available");
    updateLyricsStatus(statusLabel || "No lyrics found");
    return;
  }

  lines.forEach((line) => {
    const div = document.createElement("div");
    div.className = "lyrics-line";
    div.textContent = line.text;
    dom.lyricsTrack.appendChild(div);
  });

  state.lyricsLineEls = Array.from(dom.lyricsTrack.children);

  if (mode === "timed") {
    updateLyricsStatus(statusLabel || "Synced lyrics");
  } else if (mode === "estimated") {
    updateLyricsStatus(statusLabel || "Estimated timing");
  } else {
    updateLyricsStatus(statusLabel || "Lyrics");
  }
  syncLyrics(true);
}

export function syncLyrics(force = false) {
  if (!state.currentTrack || !state.lyrics.lines.length) {
    return;
  }
  const currentTime = dom.audio.currentTime;
  if (!Number.isFinite(currentTime)) {
    return;
  }
  const lines = state.lyrics.lines;
  let index = state.lyrics.activeIndex;
  if (
    force ||
    index < 0 ||
    currentTime < lines[index]?.time ||
    currentTime > lines[index + 1]?.time
  ) {
    index = lines.findIndex((line, i) => {
      const next = lines[i + 1];
      if (line.time == null) {
        return false;
      }
      if (!next || next.time == null) {
        return currentTime >= line.time;
      }
      return currentTime >= line.time && currentTime < next.time;
    });
  }
  if (index === -1) {
    return;
  }
  if (!force && index === state.lyrics.activeIndex) {
    return;
  }
  state.lyrics.activeIndex = index;
  scrollLyricsTo(index);
}

function scrollLyricsTo(index) {
  const lines = state.lyricsLineEls;
  if (!lines.length) {
    return;
  }
  lines.forEach((line, lineIndex) => {
    line.classList.toggle("is-active", lineIndex === index);
    line.classList.toggle("is-next", lineIndex === index + 1);
  });
  const active = lines[index];
  if (!active) {
    return;
  }
  const offset =
    active.offsetTop - dom.lyricsViewport.clientHeight / 2 + active.offsetHeight / 2;
  const clamped = Math.max(0, Math.min(dom.lyricsTrack.scrollHeight, offset));
  dom.lyricsTrack.style.transform = `translateY(${-clamped}px)`;
}

export function maybeEstimateLyrics(track) {
  if (!track || track.Id !== state.lyrics.trackId) {
    return;
  }
  if (state.lyrics.mode !== "static" || !state.lyrics.pendingLines) {
    return;
  }
  const duration = getTrackDurationSeconds(track);
  if (!duration) {
    return;
  }
  const timed = applyEstimatedTimings(state.lyrics.pendingLines, duration);
  setLyricsLines(timed, "estimated");
}

async function requestLyricsPayload(trackId) {
  const endpoints = [
    `/Audio/${trackId}/Lyrics`,
    `/Items/${trackId}/Lyrics`,
  ];
  for (const endpoint of endpoints) {
    try {
      return await fetchJson(endpoint);
    } catch (error) {
      // Try next endpoint.
    }
  }
  return null;
}

export async function loadLyricsForTrack(track, album) {
  if (!track) {
    return;
  }
  const token = ++state.lyricsToken;
  state.lyrics.trackId = track.Id;
  updateLyricsStatus("Loading lyrics...");
  renderLyricsPlaceholder("Loading lyrics...");

  let payload = null;
  try {
    payload = await requestLyricsPayload(track.Id);
  } catch (error) {
    payload = null;
  }

  if (token !== state.lyricsToken) {
    return;
  }

  if (!payload && track.Lyrics) {
    payload = track.Lyrics;
  }

  if (payload) {
    const parsed = parseLyricsPayload(payload);
    const lines = parsed.lines.filter((line) => line.text);
    if (parsed.hasTimestamps) {
      setLyricsLines(lines, "timed");
      return;
    }
    if (lines.length) {
      const cleanLines = lines.map((line) => ({ time: null, text: line.text }));
      setLyricsLines(cleanLines, "static", cleanLines);
      updateLyricsStatus("Lyrics (timing unknown)");
      return;
    }
    setLyricsLines([], "none");
  }

  const cacheKey = makeLyricsCacheKey(track, album);
  const cached = cacheKey ? getCachedLyrics(cacheKey) : null;
  if (cached) {
    const cachedParsed = parseLyricsPayload(cached);
    const lines = cachedParsed.lines.filter((line) => line.text);
    if (cachedParsed.hasTimestamps) {
      setLyricsLines(lines, "timed", null, "Lyrics via LRCLIB");
      return;
    }
    if (lines.length) {
      const cleanLines = lines.map((line) => ({ time: null, text: line.text }));
      if (dom.audio.duration && state.lyrics.mode !== "timed") {
        const estimated = applyEstimatedTimings(cleanLines, dom.audio.duration);
        setLyricsLines(estimated, "estimated", cleanLines, "Lyrics via LRCLIB");
      } else {
        setLyricsLines(cleanLines, "static", cleanLines, "Lyrics via LRCLIB");
      }
      return;
    }
  }

  if (!state.lyricsOnline) {
    setLyricsLines([], "none");
    updateLyricsStatus("No lyrics found");
    return;
  }

  updateLyricsStatus("Fetching lyrics online...");
  const external = await fetchLyricsFromLrclib(track, album);
  if (token !== state.lyricsToken) {
    return;
  }
  if (!external) {
    setLyricsLines([], "none");
    return;
  }
  if (external.instrumental) {
    setLyricsLines([], "none", null, "Instrumental");
    return;
  }
  const externalPayload = external.syncedLyrics || external.plainLyrics || "";
  const externalParsed = parseLyricsPayload(externalPayload);
  if (cacheKey) {
    cacheLyrics(cacheKey, externalPayload);
  }
  const lines = externalParsed.lines.filter((line) => line.text);
  if (externalParsed.hasTimestamps) {
    setLyricsLines(lines, "timed", null, "Lyrics via LRCLIB");
    return;
  }
  if (lines.length) {
    const cleanLines = lines.map((line) => ({ time: null, text: line.text }));
    if (dom.audio.duration && state.lyrics.mode !== "timed") {
      const estimated = applyEstimatedTimings(cleanLines, dom.audio.duration);
      setLyricsLines(estimated, "estimated", cleanLines, "Lyrics via LRCLIB");
    } else {
      setLyricsLines(cleanLines, "static", cleanLines, "Lyrics via LRCLIB");
    }
    return;
  }
  setLyricsLines([], "none");
}
