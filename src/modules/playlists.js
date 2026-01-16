import { dom } from "./dom.js";
import { state } from "./state.js";
import { fetchJson } from "./api.js";
import { formatRuntime } from "./utils.js";
import { createTrackButton } from "./ui.js";
import { playTrack } from "./playback.js";
import { jumpToAlbumById } from "./coverflow.js";

const FAVORITES_PLAYLIST_ID = "favorites";
const FAVORITES_PAGE_LIMIT = 100;

function isFavoritesPlaylistId(playlistId) {
  return playlistId === FAVORITES_PLAYLIST_ID;
}

function buildFavoritesPlaylist() {
  const total = state.favoritesMeta.total;
  return {
    Id: FAVORITES_PLAYLIST_ID,
    Name: "Favorites",
    ChildCount: Number.isFinite(total) ? total : null,
  };
}

function updateFavoritesPlaylistEntry() {
  const entry = state.playlists.find((playlist) => playlist.Id === FAVORITES_PLAYLIST_ID);
  if (!entry) {
    return;
  }
  entry.ChildCount = Number.isFinite(state.favoritesMeta.total) ? state.favoritesMeta.total : null;
}

function getFavoritesTracks() {
  return state.playlistTracksById.get(FAVORITES_PLAYLIST_ID) || [];
}

function favoritesStatusText() {
  const total = state.favoritesMeta.total;
  const loaded = getFavoritesTracks().length;
  if (!loaded) {
    return "No favorites found";
  }
  if (Number.isFinite(total)) {
    if (loaded < total) {
      return `Showing ${loaded} of ${total} favorites`;
    }
    return `${total} favorites`;
  }
  if (loaded) {
    return `${loaded} favorites`;
  }
  return "Favorites";
}

function updateFavoritesStatus() {
  updatePlaylistStatus(favoritesStatusText());
}

function shouldShowFavoritesLoadMore() {
  if (state.favoritesMeta.fullyLoaded) {
    return false;
  }
  return getFavoritesTracks().length > 0;
}

function updateFavoritesLoadMoreButton() {
  if (!dom.playlistTracks) {
    return;
  }
  const button = dom.playlistTracks.querySelector(".playlist-load-more");
  if (!button) {
    return;
  }
  const isLoading = state.favoritesMeta.loading;
  button.disabled = isLoading;
  button.textContent = isLoading ? "Loading favorites..." : "Load more favorites";
}

function favoritesEmptyMessage() {
  return "No favorites found";
}

function updatePlaylistStatus(text) {
  if (!dom.playlistStatus) {
    return;
  }
  dom.playlistStatus.textContent = text;
}

function getPlaylistById(playlistId) {
  if (!playlistId) {
    return null;
  }
  return state.playlists.find((playlist) => playlist.Id === playlistId) || null;
}

export function setPlaylistView(view, playlistId = null) {
  state.playlistView = view;
  if (dom.playlistPanel) {
    dom.playlistPanel.dataset.view = view;
  }
  if (dom.playlistBack) {
    dom.playlistBack.hidden = view !== "tracks";
  }
  if (view === "list") {
    state.activePlaylistId = null;
    if (dom.playlistTitle) {
      dom.playlistTitle.textContent = "Playlists";
    }
    renderPlaylistList();
    updatePlaylistStatus(
      state.playlists.length ? `${state.playlists.length} playlists` : "No playlists loaded"
    );
    return;
  }
  state.activePlaylistId = playlistId;
  const playlist = getPlaylistById(playlistId);
  if (dom.playlistTitle) {
    dom.playlistTitle.textContent = playlist?.Name || "Playlist";
  }
  updatePlaylistStatus(isFavoritesPlaylistId(playlistId) ? "Loading favorites..." : "Loading tracks...");
  renderPlaylistList();
}

function renderPlaylistList() {
  if (!dom.playlistList) {
    return;
  }
  dom.playlistList.innerHTML = "";
  if (!state.playlists.length) {
    dom.playlistList.innerHTML = '<div class="empty">No playlists found</div>';
    return;
  }
  state.playlists.forEach((playlist) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-entry";
    button.dataset.playlistId = playlist.Id;
    if (state.activePlaylistId === playlist.Id) {
      button.classList.add("is-active");
    }

    const title = document.createElement("div");
    title.className = "playlist-name";
    title.textContent = playlist.Name || "Untitled playlist";

    const count = document.createElement("div");
    count.className = "playlist-count";
    const childCount = Number.isFinite(playlist.ChildCount) ? playlist.ChildCount : null;
    count.textContent = childCount != null ? `${childCount} tracks` : "Tracks";

    button.appendChild(title);
    button.appendChild(count);
    button.addEventListener("click", () => {
      openPlaylist(playlist);
    });
    dom.playlistList.appendChild(button);
  });
}

function emptyPlaylistMessage(playlistId) {
  return isFavoritesPlaylistId(playlistId) ? favoritesEmptyMessage() : "No tracks in this playlist";
}

function appendPlaylistTrackButtons(playlistId, tracks, startIndex) {
  if (!dom.playlistTracks) {
    return;
  }
  tracks.forEach((track, offset) => {
    const index = startIndex + offset;
    const titleText = track.Name || "Untitled";
    const albumName = track.Album || "Unknown album";
    const artists = Array.isArray(track.Artists) && track.Artists.length
      ? track.Artists.join(", ")
      : track.AlbumArtist || "Unknown artist";
    const isFavorite = Boolean(track?.UserData?.IsFavorite);
    const button = createTrackButton({
      number: (index + 1).toString().padStart(2, "0"),
      title: titleText,
      meta: `${albumName} · ${artists}`,
      duration: formatRuntime(track.RunTimeTicks),
      isFavorite,
      dataset: { trackId: track.Id, playlistId },
      onClick: (event) => {
        event.stopPropagation();
        void playPlaylistTrack(playlistId, track, index);
      },
    });
    dom.playlistTracks.appendChild(button);
  });
}

function removePlaylistLoadMoreButton() {
  if (!dom.playlistTracks) {
    return;
  }
  const existing = dom.playlistTracks.querySelector(".playlist-load-more");
  if (existing) {
    existing.remove();
  }
}

function appendPlaylistLoadMoreButton(label, onClick, isDisabled) {
  if (!dom.playlistTracks) {
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "playlist-load-more";
  button.textContent = label;
  button.disabled = Boolean(isDisabled);
  button.addEventListener("click", () => {
    onClick();
  });
  dom.playlistTracks.appendChild(button);
}

function renderPlaylistTracks(playlistId, options = {}) {
  if (!dom.playlistTracks) {
    return;
  }
  const {
    appendItems = null,
    showLoadMore = false,
    loadMoreLabel = "Load more tracks",
    onLoadMore = null,
    loadMoreDisabled = false,
  } = options;
  const tracks = state.playlistTracksById.get(playlistId) || [];
  if (!appendItems) {
    dom.playlistTracks.innerHTML = "";
    if (!tracks.length) {
      dom.playlistTracks.innerHTML = `<div class="empty">${emptyPlaylistMessage(playlistId)}</div>`;
      return;
    }
    appendPlaylistTrackButtons(playlistId, tracks, 0);
  } else if (appendItems.length) {
    removePlaylistLoadMoreButton();
    const startIndex = Math.max(0, tracks.length - appendItems.length);
    appendPlaylistTrackButtons(playlistId, appendItems, startIndex);
  } else {
    removePlaylistLoadMoreButton();
  }
  if (showLoadMore && onLoadMore) {
    appendPlaylistLoadMoreButton(loadMoreLabel, onLoadMore, loadMoreDisabled);
  }
  syncPlaylistHighlights();
}

export async function loadPlaylists() {
  if (!state.serverUrl || !state.apiKey || !state.userId) {
    updatePlaylistStatus("");
    return;
  }
  state.playlistsLoading = true;
  const token = ++state.playlistLoadToken;
  updatePlaylistStatus("Loading playlists...");
  try {
    const data = await fetchJson(
      `/Users/${state.userId}/Items?IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&SortOrder=Ascending&Fields=ChildCount`
    );
    if (token !== state.playlistLoadToken) {
      return;
    }
    const remotePlaylists = data.Items || [];
    state.playlists = [buildFavoritesPlaylist(), ...remotePlaylists];
    renderPlaylistList();
    updatePlaylistStatus(
      state.playlists.length ? `${state.playlists.length} playlists` : "No playlists found"
    );
  } catch (error) {
    updatePlaylistStatus("Playlists failed to load");
  } finally {
    if (token === state.playlistLoadToken) {
      state.playlistsLoading = false;
    }
  }
}

async function fetchFavoritesPage(startIndex, limit) {
  return fetchJson(
    `/Users/${state.userId}/Items?IncludeItemTypes=Audio&Recursive=true&Filters=IsFavorite&SortBy=SortName&SortOrder=Ascending&Fields=RunTimeTicks,AlbumId,AlbumArtist,Artists,Album,UserData&StartIndex=${startIndex}&Limit=${limit}`
  );
}

function renderFavoritesTracks({ appendItems = null } = {}) {
  renderPlaylistTracks(FAVORITES_PLAYLIST_ID, {
    appendItems,
    showLoadMore: shouldShowFavoritesLoadMore(),
    loadMoreLabel: state.favoritesMeta.loading ? "Loading favorites..." : "Load more favorites",
    loadMoreDisabled: state.favoritesMeta.loading,
    onLoadMore: () => {
      void loadMoreFavorites();
    },
  });
}

async function loadFavoritesPage({ append }) {
  if (!state.serverUrl || !state.apiKey || !state.userId) {
    return;
  }
  if (state.favoritesMeta.loading) {
    return;
  }
  state.favoritesMeta.loading = true;
  const token = ++state.favoritesMeta.loadToken;
  const startIndex = append ? state.favoritesMeta.startIndex : 0;
  updatePlaylistStatus(append ? "Loading more favorites..." : "Loading favorites...");
  updateFavoritesLoadMoreButton();
  if (!append && dom.playlistTracks) {
    dom.playlistTracks.innerHTML = '<div class="empty">Loading favorites...</div>';
  }
  try {
    const data = await fetchFavoritesPage(startIndex, FAVORITES_PAGE_LIMIT);
    if (token !== state.favoritesMeta.loadToken) {
      return;
    }
    const items = data.Items || [];
    const total = Number.isFinite(data.TotalRecordCount) ? data.TotalRecordCount : null;
    const existing = append ? getFavoritesTracks() : [];
    const merged = append ? existing.concat(items) : items;
    state.playlistTracksById.set(FAVORITES_PLAYLIST_ID, merged);
    if (total != null) {
      state.favoritesMeta.total = total;
    }
    state.favoritesMeta.startIndex = startIndex + items.length;
    const resolvedTotal = total != null ? total : state.favoritesMeta.total;
    state.favoritesMeta.fullyLoaded = resolvedTotal != null
      ? state.favoritesMeta.startIndex >= resolvedTotal
      : items.length < FAVORITES_PAGE_LIMIT;
    renderFavoritesTracks({ appendItems: append ? items : null });
    updateFavoritesStatus();
    updateFavoritesPlaylistEntry();
    renderPlaylistList();
  } catch (error) {
    if (!append && dom.playlistTracks) {
      dom.playlistTracks.innerHTML = '<div class="empty">Could not load favorites</div>';
    }
    updatePlaylistStatus("Favorites failed to load");
  } finally {
    if (token === state.favoritesMeta.loadToken) {
      state.favoritesMeta.loading = false;
      updateFavoritesLoadMoreButton();
    }
  }
}

async function ensureFavoritesTracks() {
  if (state.playlistTracksById.has(FAVORITES_PLAYLIST_ID)) {
    renderFavoritesTracks();
    updateFavoritesStatus();
    return;
  }
  await loadFavoritesPage({ append: false });
}

function loadMoreFavorites() {
  if (state.favoritesMeta.loading) {
    return;
  }
  void loadFavoritesPage({ append: true });
}

async function ensurePlaylistTracks(playlistId) {
  if (!playlistId) {
    return;
  }
  if (isFavoritesPlaylistId(playlistId)) {
    await ensureFavoritesTracks();
    return;
  }
  if (state.playlistTracksById.has(playlistId)) {
    renderPlaylistTracks(playlistId);
    const tracks = state.playlistTracksById.get(playlistId) || [];
    updatePlaylistStatus(`${tracks.length} tracks`);
    return;
  }
  if (dom.playlistTracks) {
    dom.playlistTracks.innerHTML = '<div class="empty">Loading tracks...</div>';
  }
  updatePlaylistStatus("Loading tracks...");
  try {
    const data = await fetchJson(
      `/Playlists/${playlistId}/Items?UserId=${state.userId}&IncludeItemTypes=Audio&Fields=RunTimeTicks,AlbumId,AlbumArtist,Artists,Album,UserData`
    );
    const tracks = data.Items || [];
    state.playlistTracksById.set(playlistId, tracks);
    renderPlaylistTracks(playlistId);
    updatePlaylistStatus(`${tracks.length} tracks`);
  } catch (error) {
    if (dom.playlistTracks) {
      dom.playlistTracks.innerHTML = '<div class="empty">Could not load tracks</div>';
    }
    updatePlaylistStatus("Playlist tracks failed to load");
  }
}

function openPlaylist(playlist) {
  if (!playlist || !playlist.Id) {
    return;
  }
  setPlaylistView("tracks", playlist.Id);
  void ensurePlaylistTracks(playlist.Id);
}

function findAlbumIndexForTrack(albumId, trackId) {
  if (!albumId || !trackId) {
    return null;
  }
  const tracks = state.tracksByAlbum.get(albumId);
  if (!tracks) {
    return null;
  }
  const index = tracks.findIndex((track) => track.Id === trackId);
  return index >= 0 ? index : null;
}

async function resolveAlbumForTrack(track) {
  const albumId = track.AlbumId || track.Album?.Id;
  if (albumId) {
    const cached = state.albums.find((item) => item.Id === albumId);
    if (cached) {
      return cached;
    }
    try {
      return await fetchJson(`/Items/${albumId}`);
    } catch (error) {
      return {
        Id: albumId,
        Name: track.Album || track.Name || "Unknown album",
        AlbumArtist: track.AlbumArtist || track.Artists || "Unknown artist",
        Artists: track.Artists || [],
      };
    }
  }
  return {
    Id: track.Id,
    Name: track.Album || track.Name || "Unknown album",
    AlbumArtist: track.AlbumArtist || track.Artists || "Unknown artist",
    Artists: track.Artists || [],
  };
}

export async function playPlaylistTrack(playlistId, track, playlistIndex) {
  const album = await resolveAlbumForTrack(track);
  const albumIndex = findAlbumIndexForTrack(album.Id, track.Id);
  const resolvedIndex = Number.isFinite(albumIndex) ? albumIndex : 0;
  playTrack(album, track, resolvedIndex, {
    playlistId,
    playlistIndex,
    trackFocusIndex: Number.isFinite(albumIndex) ? albumIndex : null,
  });
  const jumpId = track.AlbumId || (album?.Id !== track.Id ? album?.Id : null);
  if (jumpId) {
    void jumpToAlbumById(jumpId);
  }
}

export function syncPlaylistHighlights() {
  if (!dom.playlistTracks) {
    return;
  }
  const trackButtons = dom.playlistTracks.querySelectorAll(".track");
  trackButtons.forEach((button) => {
    const isPlaying =
      state.nowPlaying &&
      button.dataset.trackId === state.nowPlaying.trackId;
    button.classList.toggle("is-playing", Boolean(isPlaying));
  });
}

export function resetPlaylistState() {
  state.playlists = [];
  state.playlistTracksById.clear();
  state.playlistView = "list";
  state.activePlaylistId = null;
  state.playlistPlayback = null;
  state.playlistsLoading = false;
  state.playlistLoadToken += 1;
  state.favoritesMeta.total = null;
  state.favoritesMeta.startIndex = 0;
  state.favoritesMeta.loading = false;
  state.favoritesMeta.loadToken += 1;
  state.favoritesMeta.fullyLoaded = false;
  if (dom.coverflowSection) {
    dom.coverflowSection.classList.remove("is-playlist-open");
  }
  document.body.classList.remove("is-playlist-open");
  if (dom.playlistPaneToggle) {
    dom.playlistPaneToggle.setAttribute("aria-expanded", "false");
  }
  if (dom.playlistPanel) {
    dom.playlistPanel.dataset.view = "list";
  }
  if (dom.playlistTitle) {
    dom.playlistTitle.textContent = "Playlists";
  }
  updatePlaylistStatus("No playlists loaded");
  if (dom.playlistList) {
    dom.playlistList.innerHTML = '<div class="empty">No playlists loaded</div>';
  }
  if (dom.playlistTracks) {
    dom.playlistTracks.innerHTML = "";
  }
}
