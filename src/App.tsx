import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePlaylist,
  deleteSong,
  deleteTag,
  getPlaylists,
  getSongs,
  getTags,
  getTrashedPlaylists,
  getTrashedSongs,
  getTrashedTags,
  savePlaylist,
  saveSong,
  saveSongOrder,
  saveSongs,
  saveTag,
  type Playlist,
  type Song,
  type Tag,
} from './musicDb'
import { ColorSpectrumPicker } from './ColorSpectrumPicker'
import { CoverEditor, type CoverEditorValue } from './CoverEditor'
import './enhancements.css'
import './loopEditor.css'

function formatTime(seconds?: number) {
  if (!Number.isFinite(seconds)) return '--:--'
  const value = Math.max(0, seconds ?? 0)
  const minutes = Math.floor(value / 60)
  const rest = Math.floor(value % 60)
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function formatPrecise(seconds: number) {
  const value = Math.max(0, seconds)
  const minutes = Math.floor(value / 60)
  const rest = value - minutes * 60
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function reverseText(value: string) {
  return [...value].reverse().join('')
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]+/g, '')
}

function fuzzyMatch(value: string, query: string) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  const haystack = normalizeSearch(value)
  if (haystack.includes(needle)) return true
  let index = 0
  for (const char of haystack) if (char === needle[index]) index += 1
  return index === needle.length
}

type View = 'library' | 'history' | 'loops' | 'trash' | 'tag' | 'playlistOverview' | 'tagOverview'
type NavigationEntry = { view: View; playlistId: string | null; tagId?: string | null; detailOpen: boolean }
type ReorderScope = 'library' | 'playlist' | 'sidebar' | 'tags' | null
type MoveCandidate = { kind: 'song' | 'playlist' | 'tag'; id: string; targetIndex: number | null } | null
type MixedOrderMap = Record<string, string[]>
type BundleStateMap = Record<string, string[]>
type Snapshot = { songs: Song[]; playlists: Playlist[]; tags: Tag[]; objectGroups: ObjectGroup[]; objectColors: Record<string, string> }
type PlaylistChooserMode = 'current' | 'bulk' | null
type SortMode = 'manual' | 'azStart' | 'azEnd' | 'plays' | 'duration' | 'chronology'
type SortDirection = 'down' | 'up'
type SortSaveKind = 'song' | 'playlist' | 'tag'
type SortSave = { id: string; kind: SortSaveKind; name: string; orders: Record<string, string[]>; createdAt: number }
type SingleMoveTarget = { kind: GroupKind | 'group'; id: string; parentGroupId?: string; targetIndex: number | null } | null
type PendingGroupCreate = { kind: GroupKind; sourceIds: string[]; parentGroupId?: string; name: string; moveAfterCreate: boolean } | null
type CreationPlacement = { kind: GroupKind; id: string; name: string } | null
type LayoutPreset = { sidebarWidth: number; playerSplitLeft: number; playerSplitRight: number }
type ImportDraftItem = { id: string; file: File; name: string; originalIndex: number }
type ImportDraftSnapshot = { items: Array<{ id: string; name: string; originalIndex: number }>; selectedIds: string[]; sortMode: SortMode; placement: ImportLibraryPlacement }
type ImportDraftConfirmation = 'finish' | 'cancel' | null
type ImportMoveStep = 'select' | 'review' | 'place' | null
type ImportLibraryPlacement = { draftIds: string[]; targetIndex: number } | null
type OverflowMenu = { kind: 'song' | 'songDetail' | 'playlist' | 'playlists' | 'tag' | 'tags' | 'group'; id?: string; parentGroupId?: string } | null
type SidebarSortTarget = 'tags' | 'playlists' | null
type RepeatSetting = { kind: 'infinite' } | { kind: 'count'; count: number } | null
type LoopActivationMode = 'enabled' | 'disabled' | 'manual'
type LoopManualRequest = { ids: string[]; enabled: boolean } | null
type GroupKind = 'song' | 'playlist' | 'tag'
type GroupSortMode = 'general' | SortMode
type ObjectGroup = { id: string; kind: GroupKind; name: string; itemIds: string[]; createdAt: number; sortOrder: number; sortMode: GroupSortMode; sortDirection: SortDirection; color?: string; parentGroupId?: string; afterItems?: boolean }

function itemMatchesGroupQuery(groups: ObjectGroup[], kind: GroupKind, itemId: string, query: string) {
  const direct = groups.filter((group) => group.kind === kind && group.itemIds.includes(itemId))
  return direct.some((start) => {
    let current: ObjectGroup | undefined = start
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      if (fuzzyMatch(current.name, query)) return true
      seen.add(current.id)
      const parentId: string | undefined = current.parentGroupId
      current = parentId ? groups.find((group) => group.id === parentId) : undefined
    }
    return false
  })
}
type SidebarSelectionKind = 'playlist' | 'tag' | null
type SidebarSelectionConfirmation = 'delete' | 'switchManualMove' | null
type AppearanceColorTarget = { kind: GroupKind | 'group'; id: string } | null
type GroupMembershipTarget = { groupId: string; mode: 'add' | 'remove' } | null
type GroupNestingTarget = { groupId: string; mode: 'add' | 'remove' } | null
type GroupClipboard = { kind: GroupKind; rootId: string; groups: ObjectGroup[] } | null
type ClipboardItem = { kind: 'song'; song: Song } | { kind: 'playlist'; playlist: Playlist }
type TagChooserTarget = { kind: 'song' | 'playlist' | 'group'; ids: string[] } | null
type DuplicateAction =
  | { kind: 'tag-add'; tagId: string; targetKind: 'song' | 'playlist'; ids: string[] }
  | { kind: 'paste-song'; source: Song; targetPlaylistId: string | null }
  | { kind: 'paste-playlist'; source: Playlist }
type DuplicateConflict = { action: DuplicateAction; names: string[] } | null
type LoopDrag = { kind: 'move' | 'start' | 'end' | 'cursor' | 'focus'; offset: number } | null
type FocusFollowMode = 'center' | 'page' | 'off'
type LoopEditorSnapshot = { start: number; end: number; cursor: number; focus: number; markers: number[]; zoom: number }
type LoopConfirmation = 'save' | 'delete' | 'deleteMarkers' | null
type SelectionConfirmation = 'switchManual' | 'deleteSelected' | null
type SelectionSourceKind = 'group' | 'playlist' | 'tag' | null
type SelectionObjectEditMode = 'add' | 'remove' | null
type BulkMoveContext = { parentGroupId?: string } | null
type RenameTarget = { kind: 'song' | 'playlist' | 'tag'; id: string } | null
type CoverEditorDraft = { kind: 'playlist' | 'tag'; id: string; file: Blob; scale: number; x: number; y: number; background: string } | null
type ShareNavigator = Navigator & {
  share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>
  canShare?: (data: { title?: string; text?: string; files?: File[] }) => boolean
}

function extensionForType(type: string) {
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a'
  if (type.includes('aac')) return 'aac'
  if (type.includes('wav')) return 'wav'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('flac')) return 'flac'
  return 'mp3'
}

const LOOP_ZOOM_LEVELS = Array.from({ length: 15 }, (_, index) => index + 1)
const LOOP_PLAYBACK_RATES = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 5, 10, 50] as const
const LOOP_STEP_OPTIONS = [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const
const CURSOR_STEP_OPTIONS = [...LOOP_STEP_OPTIONS, 30, 60] as const
const LOOP_PREVIEW_OPTIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10] as const
const SEEK_SECOND_OPTIONS = [5, 10, 15, 30, 60] as const
const LOOP_OVERLAP_SECONDS = .18
const AUTO_LOOP_SEARCH_RADIUS_SECONDS = .6
const GROUP_NESTING_NEW_DRAFT_ID = '__new-empty-group__'
const GROUP_NESTING_PASTE_DRAFT_ID = '__paste-copied-group__'

function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [trashedSongs, setTrashedSongs] = useState<Song[]>([])
  const [trashedPlaylists, setTrashedPlaylists] = useState<Playlist[]>([])
  const [trashedTags, setTrashedTags] = useState<Tag[]>([])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [view, setView] = useState<View>('library')
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentSongId, setCurrentSongId] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [tagCoverUrls, setTagCoverUrls] = useState<Record<string, string>>({})
  const [isPlaying, setIsPlaying] = useState(false)
  const [repeatQueue, setRepeatQueue] = useState(false)
  const [repeatSetting, setRepeatSetting] = useState<RepeatSetting>(null)
  const [repeatRemaining, setRepeatRemaining] = useState<number | null>(null)
  const [repeatMenuOpen, setRepeatMenuOpen] = useState(false)
  const [repeatCountInput, setRepeatCountInput] = useState('3')
  const [objectGroups, setObjectGroups] = useState<ObjectGroup[]>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-object-groups') ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } })
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-collapsed-group-ids') ?? '[]'); return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []) } catch { return new Set() } })
  const [objectColors, setObjectColors] = useState<Record<string, string>>(() => { try { const parsed = JSON.parse(localStorage.getItem('josi-object-colors') ?? '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { return {} } })
  const [appearanceColorTarget, setAppearanceColorTarget] = useState<AppearanceColorTarget>(null)
  const [groupPlaybackIds, setGroupPlaybackIds] = useState<string[] | null>(null)
  const [groupPlaybackChooserOpen, setGroupPlaybackChooserOpen] = useState(false)
  const [groupPlaybackSelectedIds, setGroupPlaybackSelectedIds] = useState<string[]>([])
  const [chooserSearch, setChooserSearch] = useState('')
  const [sidebarSelectionKind, setSidebarSelectionKind] = useState<SidebarSelectionKind>(null)
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set())
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [sidebarSelectionMenuOpen, setSidebarSelectionMenuOpen] = useState(false)
  const [sidebarSelectionConfirmation, setSidebarSelectionConfirmation] = useState<SidebarSelectionConfirmation>(null)
  const [sidebarMoveKind, setSidebarMoveKind] = useState<SidebarSelectionKind>(null)
  const [groupRenameId, setGroupRenameId] = useState<string | null>(null)
  const [groupRenameValue, setGroupRenameValue] = useState('')
  const [groupSortId, setGroupSortId] = useState<string | null>(null)
  const [groupMembershipTarget, setGroupMembershipTarget] = useState<GroupMembershipTarget>(null)
  const [groupMembershipDraftIds, setGroupMembershipDraftIds] = useState<Set<string>>(new Set())
  const [groupNestingTarget, setGroupNestingTarget] = useState<GroupNestingTarget>(null)
  const [groupNestingDraftIds, setGroupNestingDraftIds] = useState<Set<string>>(new Set())
  const [groupClipboard, setGroupClipboard] = useState<GroupClipboard>(null)
  const [groupReorderId, setGroupReorderId] = useState<string | null>(null)
  const [groupMoveId, setGroupMoveId] = useState<string | null>(null)
  const [groupDeleteTargetId, setGroupDeleteTargetId] = useState<string | null>(null)
  const [colorPickerTarget, setColorPickerTarget] = useState<'create' | 'rename' | null>(null)
  const [shuffle, setShuffle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playlistName, setPlaylistName] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#60a5fa')
  const [editingName, setEditingName] = useState('')
  const [isEditingPlaylist, setIsEditingPlaylist] = useState(false)
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)
  const [songToDelete, setSongToDelete] = useState<Song | null>(null)
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameTagColor, setRenameTagColor] = useState('#60a5fa')
  const [message, setMessage] = useState('')
  const [playHistory, setPlayHistory] = useState<string[]>([])
  const [reorderScope, setReorderScope] = useState<ReorderScope>(null)
  const [moveCandidate, setMoveCandidate] = useState<MoveCandidate>(null)
  const [mixedOrders, setMixedOrders] = useState<MixedOrderMap>(() => { try { const value = JSON.parse(localStorage.getItem('josi-mixed-orders') ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } })
  const [bundleLocks, setBundleLocks] = useState<BundleStateMap>(() => { try { const value = JSON.parse(localStorage.getItem('josi-bundle-locks') ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } })
  const [bundleAnchors, setBundleAnchors] = useState<BundleStateMap>(() => { try { const value = JSON.parse(localStorage.getItem('josi-bundle-anchors') ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } })
  const [undoStack, setUndoStack] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [navigation, setNavigation] = useState<NavigationEntry[]>([{ view: 'library', playlistId: null, detailOpen: false }])
  const [navigationIndex, setNavigationIndex] = useState(0)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set())
  const [playlistChooserMode, setPlaylistChooserMode] = useState<PlaylistChooserMode>(null)
  const [playlistChooserDraftIds, setPlaylistChooserDraftIds] = useState<Set<string>>(new Set())
  const [overflowMenu, setOverflowMenu] = useState<OverflowMenu>(null)
  const [sortMode, setSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-sort-mode') as SortMode) || 'manual')
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-sort-direction') as SortDirection) || 'down')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => Math.max(150, Math.min(420, Number(localStorage.getItem('josi-sidebar-width')) || 240)))
  const [playerSplitLeft, setPlayerSplitLeft] = useState(() => Math.max(12, Math.min(44, Number(localStorage.getItem('josi-player-split-left')) || 27)))
  const [playerSplitRight, setPlayerSplitRight] = useState(() => Math.max(56, Math.min(88, Number(localStorage.getItem('josi-player-split-right')) || 68)))
  const [layoutDrag, setLayoutDrag] = useState<'sidebar' | 'playerLeft' | 'playerRight' | null>(null)
  const [layoutDefault] = useState<LayoutPreset>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('josi-layout-default') ?? 'null')
      if (stored && typeof stored === 'object') return {
        sidebarWidth: Math.max(150, Math.min(420, Number(stored.sidebarWidth) || Number(localStorage.getItem('josi-sidebar-width')) || 240)),
        playerSplitLeft: Math.max(12, Math.min(44, Number(stored.playerSplitLeft) || Number(localStorage.getItem('josi-player-split-left')) || 27)),
        playerSplitRight: Math.max(56, Math.min(88, Number(stored.playerSplitRight) || Number(localStorage.getItem('josi-player-split-right')) || 68)),
      }
    } catch { /* keep current layout as the baseline */ }
    const preset = {
      sidebarWidth: Math.max(150, Math.min(420, Number(localStorage.getItem('josi-sidebar-width')) || 240)),
      playerSplitLeft: Math.max(12, Math.min(44, Number(localStorage.getItem('josi-player-split-left')) || 27)),
      playerSplitRight: Math.max(56, Math.min(88, Number(localStorage.getItem('josi-player-split-right')) || 68)),
    }
    localStorage.setItem('josi-layout-default', JSON.stringify(preset))
    return preset
  })
  const [seekSeconds, setSeekSeconds] = useState(() => Number(localStorage.getItem('josi-seek-seconds')) || 10)
  const [loopActivationMode, setLoopActivationMode] = useState<LoopActivationMode>(() => { const value = localStorage.getItem('josi-loop-activation-mode'); return value === 'enabled' || value === 'manual' ? value : 'disabled' })
  const [loopManualRequest, setLoopManualRequest] = useState<LoopManualRequest>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIncludesGroups, setSearchIncludesGroups] = useState(true)
  const [playlistOverviewSearch, setPlaylistOverviewSearch] = useState('')
  const [tagOverviewSearch, setTagOverviewSearch] = useState('')
  const playlistOverviewSearchRef = useRef<HTMLInputElement | null>(null)
  const tagOverviewSearchRef = useRef<HTMLInputElement | null>(null)
  const [playlistCoverTargetId, setPlaylistCoverTargetId] = useState<string | null>(null)
  const [tagCoverTargetId, setTagCoverTargetId] = useState<string | null>(null)
  const [coverEditorDraft, setCoverEditorDraft] = useState<CoverEditorDraft>(null)
  const [selectedSongsListOpen, setSelectedSongsListOpen] = useState(false)
  const [selectedSongsFocusId, setSelectedSongsFocusId] = useState<string | null>(null)
  const [selectedSongsMenuOpen, setSelectedSongsMenuOpen] = useState(false)
  const [selectionSourceKind, setSelectionSourceKind] = useState<SelectionSourceKind>(null)
  const [selectionSourceId, setSelectionSourceId] = useState<string | null>(null)
  const [selectionSourceReturn, setSelectionSourceReturn] = useState<NavigationEntry | null>(null)
  const [selectionObjectEditMode, setSelectionObjectEditMode] = useState<SelectionObjectEditMode>(null)
  const [selectionObjectDraftIds, setSelectionObjectDraftIds] = useState<Set<string>>(new Set())
  const [bulkMoveMode, setBulkMoveMode] = useState(false)
  const [bulkMoveContext, setBulkMoveContext] = useState<BulkMoveContext>(null)
  const [selectionConfirmation, setSelectionConfirmation] = useState<SelectionConfirmation>(null)
  const [trashConfirmation, setTrashConfirmation] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [librarySortPickerOpen, setLibrarySortPickerOpen] = useState(false)
  const [chooserSortMode, setChooserSortMode] = useState<SortMode>('manual')
  const [chooserSortDirection, setChooserSortDirection] = useState<SortDirection>('down')
  const [sortSaves, setSortSaves] = useState<SortSave[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('josi-sort-saves') ?? '[]')
      if (Array.isArray(stored) && stored.length) return stored
    } catch { /* use migration defaults */ }
    return [
      { id: 'legacy-song-save-1', kind: 'song', name: 'Save 1', orders: {}, createdAt: 1 },
      { id: 'legacy-playlist-save-1', kind: 'playlist', name: 'Save 1', orders: {}, createdAt: 1 },
      { id: 'legacy-tag-save-1', kind: 'tag', name: 'Save 1', orders: {}, createdAt: 1 },
    ]
  })
  const [activeSortSaveIds, setActiveSortSaveIds] = useState<Record<SortSaveKind, string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('josi-active-sort-saves') ?? '{}')
      if (stored && typeof stored === 'object') return {
        song: typeof stored.song === 'string' ? stored.song : 'legacy-song-save-1',
        playlist: typeof stored.playlist === 'string' ? stored.playlist : 'legacy-playlist-save-1',
        tag: typeof stored.tag === 'string' ? stored.tag : 'legacy-tag-save-1',
      }
    } catch { /* use defaults */ }
    return { song: 'legacy-song-save-1', playlist: 'legacy-playlist-save-1', tag: 'legacy-tag-save-1' }
  })
  const [sortSaveDialogTarget, setSortSaveDialogTarget] = useState<SortSaveKind | null>(null)
  const [sortSaveName, setSortSaveName] = useState('')
  const [sortSaveRenameId, setSortSaveRenameId] = useState<string | null>(null)
  const [sortSaveRenameValue, setSortSaveRenameValue] = useState('')
  const sortSaveHoldTimerRef = useRef<number | null>(null)
  const sortSaveLongPressRef = useRef(false)
  const [sidePaneScrollLocked, setSidePaneScrollLocked] = useState(() => localStorage.getItem('josi-side-pane-scroll-locked') === '1')
  const [singleMoveTarget, setSingleMoveTarget] = useState<SingleMoveTarget>(null)
  const [pendingGroupCreate, setPendingGroupCreate] = useState<PendingGroupCreate>(null)
  const [groupCreateMenuOpen, setGroupCreateMenuOpen] = useState(false)
  const [creationPlacement, setCreationPlacement] = useState<CreationPlacement>(null)
  const [creationPlacementQueue, setCreationPlacementQueue] = useState<Array<NonNullable<CreationPlacement>>>([])
  const [creationPlacementMenuOpen, setCreationPlacementMenuOpen] = useState(false)
  const [importDraftItems, setImportDraftItems] = useState<ImportDraftItem[]>([])
  const [importDraftSelectedIds, setImportDraftSelectedIds] = useState<Set<string>>(new Set())
  const [importDraftSelectionMode, setImportDraftSelectionMode] = useState(false)
  const [importDraftMenuOpen, setImportDraftMenuOpen] = useState(false)
  const [importDraftRenameOpen, setImportDraftRenameOpen] = useState(false)
  const [importDraftReorderMode, setImportDraftReorderMode] = useState(false)
  const [importDraftMoveMode, setImportDraftMoveMode] = useState(false)
  const [importMoveStep, setImportMoveStep] = useState<ImportMoveStep>(null)
  const [importMoveReviewIds, setImportMoveReviewIds] = useState<string[]>([])
  const [importLibraryTargetIndex, setImportLibraryTargetIndex] = useState<number | null>(null)
  const [importLibraryPlacement, setImportLibraryPlacement] = useState<ImportLibraryPlacement>(null)
  const [importDraftSortMode, setImportDraftSortMode] = useState<SortMode>('manual')
  const [importDraftSortDirection, setImportDraftSortDirection] = useState<SortDirection>('down')
  const [importDraftConfirmation, setImportDraftConfirmation] = useState<ImportDraftConfirmation>(null)
  const [importDraftUndoStack, setImportDraftUndoStack] = useState<ImportDraftSnapshot[]>([])
  const [importDraftRedoStack, setImportDraftRedoStack] = useState<ImportDraftSnapshot[]>([])
  const [lastCommittedImportDraft, setLastCommittedImportDraft] = useState<{ items: ImportDraftItem[]; importedIds: string[]; undo: ImportDraftSnapshot[]; redo: ImportDraftSnapshot[]; placement: ImportLibraryPlacement } | null>(null)
  const [tagSortMode, setTagSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-tag-sort-mode') as SortMode) || 'manual')
  const [tagSortDirection, setTagSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-tag-sort-direction') as SortDirection) || 'down')
  const [playlistSortMode, setPlaylistSortMode] = useState<SortMode>(() => (localStorage.getItem('josi-playlist-sort-mode') as SortMode) || 'manual')
  const [playlistSortDirection, setPlaylistSortDirection] = useState<SortDirection>(() => (localStorage.getItem('josi-playlist-sort-direction') as SortDirection) || 'down')
  const [sidebarSortTarget, setSidebarSortTarget] = useState<SidebarSortTarget>(null)
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(() => localStorage.getItem('josi-playlists-collapsed') === '1')
  const [tagsCollapsed, setTagsCollapsed] = useState(() => localStorage.getItem('josi-tags-collapsed') === '1')
  const [tagChooserTarget, setTagChooserTarget] = useState<TagChooserTarget>(null)
  const [tagChooserOriginalSnapshot, setTagChooserOriginalSnapshot] = useState<Snapshot | null>(null)
  const [tagChooserDirty, setTagChooserDirty] = useState(false)
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null)
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateConflict>(null)
  const [cancelledDuplicateAction, setCancelledDuplicateAction] = useState<DuplicateAction | null>(null)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)

  const [loopEditorSongId, setLoopEditorSongId] = useState<string | null>(null)
  const [loopDraftStart, setLoopDraftStart] = useState(0)
  const [loopDraftEnd, setLoopDraftEnd] = useState(0)
  const [loopCursor, setLoopCursor] = useState(0)
  const [loopFocus, setLoopFocus] = useState(0)
  const [loopZoom, setLoopZoom] = useState(1)
  const [loopSelectionLocked, setLoopSelectionLocked] = useState(false)
  const [markersEnabled, setMarkersEnabled] = useState(true)
  const [cursorLoopEnabled, setCursorLoopEnabled] = useState(true)
  const [focusFollowMode, setFocusFollowMode] = useState<FocusFollowMode>('center')
  const [loopMarkers, setLoopMarkers] = useState<number[]>([])
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)
  const [activeLoopEdge, setActiveLoopEdge] = useState<'start' | 'end'>('start')
  const [previewLeadStart, setPreviewLeadStart] = useState('1')
  const [previewLeadEnd, setPreviewLeadEnd] = useState('1')
  const [edgeStep, setEdgeStep] = useState('0.01')
  const [focusStep, setFocusStep] = useState('1')
  const [cursorStep, setCursorStep] = useState('5')
  const [markerStep, setMarkerStep] = useState('1')
  const [waveform, setWaveform] = useState<number[]>([])
  const [waveformStatus, setWaveformStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [loopPlaybackRate, setLoopPlaybackRate] = useState('1')
  const [loopEditorMenuOpen, setLoopEditorMenuOpen] = useState(false)
  const [loopUndoStack, setLoopUndoStack] = useState<LoopEditorSnapshot[]>([])
  const [loopRedoStack, setLoopRedoStack] = useState<LoopEditorSnapshot[]>([])
  const [loopConfirmation, setLoopConfirmation] = useState<LoopConfirmation>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const overlapAudioRef = useRef<HTMLAudioElement>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const loopTransitionRef = useRef<{ outgoing: HTMLAudioElement; incoming: HTMLAudioElement; startedAt: number; duration: number } | null>(null)
  const loopStartPendingRef = useRef(false)
  const loopOverlapBlockedRef = useRef(false)
  const automaticLoopSeamsRef = useRef(new Map<string, { start: number; end: number }>())
  const automaticLoopSearchRef = useRef(new Set<string>())
  const shouldAutoPlayRef = useRef(false)
  const loopTimelineRef = useRef<HTMLDivElement>(null)
  const loopFocusRef = useRef<HTMLDivElement>(null)
  const loopTimelineScrollRef = useRef<HTMLDivElement>(null)
  const loopDragRef = useRef<LoopDrag>(null)
  const repeatHoldTimerRef = useRef<number | null>(null)
  const repeatHoldTriggeredRef = useRef(false)
  const repeatRemainingRef = useRef<number | null>(null)
  const groupPlaybackIdsRef = useRef<string[] | null>(null)
  const groupDirectClickTimerRef = useRef<number | null>(null)

  const currentPlaybackAudio = () => playbackAudioRef.current ?? audioRef.current
  const otherPlaybackAudio = (audio: HTMLAudioElement) => audio === audioRef.current ? overlapAudioRef.current : audioRef.current
  const updatePlayingState = () => setIsPlaying(Boolean((audioRef.current && !audioRef.current.paused) || (overlapAudioRef.current && !overlapAudioRef.current.paused)))
  const cancelLoopTransition = () => {
    const transition = loopTransitionRef.current
    if (transition) {
      transition.incoming.pause()
      try { transition.outgoing.volume = 1; transition.incoming.volume = 1 } catch { /* iPadOS may ignore element volume */ }
    }
    loopTransitionRef.current = null
    loopStartPendingRef.current = false
    const active = currentPlaybackAudio()
    const other = active ? otherPlaybackAudio(active) : null
    if (other && other !== active) other.pause()
  }
  const ensurePrimaryPlayback = () => {
    const primary = audioRef.current
    if (!primary) return
    const active = currentPlaybackAudio()
    const wasPlaying = Boolean(active && !active.paused)
    const time = active?.currentTime ?? currentTime
    cancelLoopTransition()
    if (active && active !== primary) active.pause()
    primary.currentTime = Number.isFinite(time) ? time : 0
    playbackAudioRef.current = primary
    if (wasPlaying) void primary.play().catch(() => setIsPlaying(false))
  }
  const prepareAutomaticLoopSeam = async (song: Song) => {
    if (automaticLoopSeamsRef.current.has(song.id) || automaticLoopSearchRef.current.has(song.id)) return
    if (song.loopStart === undefined || song.loopEnd === undefined || !song.file?.size) return
    automaticLoopSearchRef.current.add(song.id)
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) { automaticLoopSearchRef.current.delete(song.id); setMessage('Die Loop-Überlappung ist auf diesem Gerät nicht verfügbar; auch die automatische Verbindungssuche wird nicht unterstützt.'); return }
    const context = new AudioContextClass()
    try {
      const buffer = await context.decodeAudioData((await song.file.arrayBuffer()).slice(0))
      const channel = buffer.getChannelData(0)
      const sampleRate = buffer.sampleRate
      const durationSeconds = buffer.duration
      const sample = (time: number) => channel[Math.max(0, Math.min(channel.length - 1, Math.round(time * sampleRate)))]
      let best = { start: song.loopStart, end: song.loopEnd, score: Number.POSITIVE_INFINITY }
      for (let startOffset = -AUTO_LOOP_SEARCH_RADIUS_SECONDS; startOffset <= AUTO_LOOP_SEARCH_RADIUS_SECONDS + .0001; startOffset += .03) {
        const start = Math.max(0, Math.min(durationSeconds - .1, song.loopStart + startOffset))
        for (let endOffset = -AUTO_LOOP_SEARCH_RADIUS_SECONDS; endOffset <= AUTO_LOOP_SEARCH_RADIUS_SECONDS + .0001; endOffset += .03) {
          const end = Math.max(start + .1, Math.min(durationSeconds, song.loopEnd + endOffset))
          if (end <= start + .1) continue
          let score = 0
          for (let index = 0; index < 36; index += 1) {
            const ratio = index / 35
            const outgoing = sample(Math.max(0, end - .03 + ratio * .03))
            const incoming = sample(Math.min(durationSeconds, start + ratio * .03))
            const difference = outgoing - incoming
            score += difference * difference
          }
          score += Math.abs(sample(end) - sample(start)) * 4
          score += (Math.abs(startOffset) + Math.abs(endOffset)) * .002
          if (score < best.score) best = { start, end, score }
        }
      }
      automaticLoopSeamsRef.current.set(song.id, { start: best.start, end: best.end })
      setMessage('Die doppelte Loop-Wiedergabe konnte nicht gestartet werden. Josi verwendet deshalb automatisch einen lokal gesuchten Verbindungspunkt.')
    } catch {
      setMessage('Die doppelte Loop-Wiedergabe konnte nicht gestartet werden. Die automatische Verbindungssuche ist für diese Datei ebenfalls fehlgeschlagen.')
    } finally { automaticLoopSearchRef.current.delete(song.id); void context.close() }
  }

  useEffect(() => {
    Promise.all([getSongs(), getPlaylists(), getTags(), getTrashedSongs(), getTrashedPlaylists(), getTrashedTags()]).then(([storedSongs, storedPlaylists, storedTags, storedTrashedSongs, storedTrashedPlaylists, storedTrashedTags]) => {
      setSongs(storedSongs)
      setPlaylists(storedPlaylists)
      setTags(storedTags)
      setTrashedSongs(storedTrashedSongs)
      setTrashedPlaylists(storedTrashedPlaylists)
      setTrashedTags(storedTrashedTags)
      if (storedSongs.some((song) => !song.file || song.file.size === 0)) setMessage('Mindestens eine lokal gespeicherte Audiodatei ist nicht mehr verfügbar. Diese Lieder müssen neu importiert werden.')
    }).catch(() => setMessage('Lokale Musikdaten konnten nicht geladen werden.'))
  }, [])

  useEffect(() => { localStorage.setItem('josi-sort-mode', sortMode) }, [sortMode])
  useEffect(() => { localStorage.setItem('josi-sort-direction', sortDirection) }, [sortDirection])
  useEffect(() => { localStorage.setItem('josi-seek-seconds', String(seekSeconds)) }, [seekSeconds])
  useEffect(() => { localStorage.setItem('josi-loop-activation-mode', loopActivationMode) }, [loopActivationMode])
  useEffect(() => { localStorage.setItem('josi-tag-sort-mode', tagSortMode) }, [tagSortMode])
  useEffect(() => { localStorage.setItem('josi-tag-sort-direction', tagSortDirection) }, [tagSortDirection])
  useEffect(() => { localStorage.setItem('josi-playlist-sort-mode', playlistSortMode) }, [playlistSortMode])
  useEffect(() => { localStorage.setItem('josi-playlist-sort-direction', playlistSortDirection) }, [playlistSortDirection])
  useEffect(() => { localStorage.setItem('josi-playlists-collapsed', playlistsCollapsed ? '1' : '0') }, [playlistsCollapsed])
  useEffect(() => { localStorage.setItem('josi-tags-collapsed', tagsCollapsed ? '1' : '0') }, [tagsCollapsed])
  useEffect(() => { localStorage.setItem('josi-object-groups', JSON.stringify(objectGroups)) }, [objectGroups])
  useEffect(() => { localStorage.setItem('josi-collapsed-group-ids', JSON.stringify([...collapsedGroupIds])) }, [collapsedGroupIds])
  useEffect(() => { localStorage.setItem('josi-object-colors', JSON.stringify(objectColors)) }, [objectColors])
  useEffect(() => { localStorage.setItem('josi-sidebar-width', String(sidebarWidth)) }, [sidebarWidth])
  useEffect(() => { localStorage.setItem('josi-player-split-left', String(playerSplitLeft)) }, [playerSplitLeft])
  useEffect(() => { localStorage.setItem('josi-player-split-right', String(playerSplitRight)) }, [playerSplitRight])
  useEffect(() => {
    if (!layoutDrag) return
    const move = (event: PointerEvent) => {
      if (layoutDrag === 'sidebar') { setSidebarWidth(Math.max(150, Math.min(420, event.clientX))); return }
      const percent = Math.max(0, Math.min(100, event.clientX / Math.max(window.innerWidth, 1) * 100))
      if (layoutDrag === 'playerLeft') setPlayerSplitLeft(Math.max(12, Math.min(playerSplitRight - 12, percent)))
      else setPlayerSplitRight(Math.min(88, Math.max(playerSplitLeft + 12, percent)))
    }
    const stop = () => setLayoutDrag(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop) }
  }, [layoutDrag, playerSplitLeft, playerSplitRight])

  const finishLayoutEditing = () => {
    localStorage.setItem('josi-sidebar-width', String(sidebarWidth))
    localStorage.setItem('josi-player-split-left', String(playerSplitLeft))
    localStorage.setItem('josi-player-split-right', String(playerSplitRight))
    setLayoutDrag(null)
    setLayoutEditMode(false)
  }

  useEffect(() => localStorage.setItem('josi-sort-saves', JSON.stringify(sortSaves)), [sortSaves])
  useEffect(() => localStorage.setItem('josi-active-sort-saves', JSON.stringify(activeSortSaveIds)), [activeSortSaveIds])
  useEffect(() => localStorage.setItem('josi-side-pane-scroll-locked', sidePaneScrollLocked ? '1' : '0'), [sidePaneScrollLocked])
  useEffect(() => localStorage.setItem('josi-mixed-orders', JSON.stringify(mixedOrders)), [mixedOrders])
  useEffect(() => localStorage.setItem('josi-bundle-locks', JSON.stringify(bundleLocks)), [bundleLocks])
  useEffect(() => localStorage.setItem('josi-bundle-anchors', JSON.stringify(bundleAnchors)), [bundleAnchors])

  const currentSong = songs.find((song) => song.id === currentSongId) ?? null
  const hasLoop = (song: Song | null | undefined) => Boolean(song && song.loopStart !== undefined && song.loopEnd !== undefined)
  const isLoopActive = (song: Song | null | undefined) => hasLoop(song) && (loopActivationMode === 'enabled' || (loopActivationMode === 'manual' && Boolean(song?.loopEnabled)))
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? null
  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null
  const editorSong = songs.find((song) => song.id === loopEditorSongId) ?? null
  const editorDuration = loopEditorSongId && loopEditorSongId === currentSongId ? (duration || editorSong?.duration || 0) : (editorSong?.duration || 0)
  const parsedLoopPlaybackRate = Math.max(.05, Math.min(50, Number.parseFloat(loopPlaybackRate.replace(',', '.')) || 1))

  const sidebarPlaylists = useMemo(() => {
    const items = [...playlists]
    if (playlistSortMode === 'manual') return items.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || b.lastUsedAt - a.lastUsedAt)
    const direction = playlistSortDirection === 'down' ? 1 : -1
    const playsFor = (playlist: Playlist) => playlist.songIds.reduce((sum, id) => sum + (songs.find((song) => song.id === id)?.completedPlays ?? 0), 0)
    const compare = (a: Playlist, b: Playlist) => {
      if (playlistSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (playlistSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (playlistSortMode === 'plays') return playsFor(a) - playsFor(b) || a.name.localeCompare(b.name, 'de')
      if (playlistSortMode === 'duration') return a.songIds.length - b.songIds.length || a.name.localeCompare(b.name, 'de')
      return a.createdAt - b.createdAt
    }
    return items.sort((a, b) => compare(a, b) * direction)
  }, [playlists, songs, playlistSortMode, playlistSortDirection])
  const sidebarTags = useMemo(() => {
    const items = [...tags]
    if (tagSortMode === 'manual') return items.sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
    const direction = tagSortDirection === 'down' ? 1 : -1
    const playsFor = (tag: Tag) => tag.songIds.reduce((sum, id) => sum + (songs.find((song) => song.id === id)?.completedPlays ?? 0), 0)
    const activeSongCount = (tag: Tag) => tag.songIds.filter((id) => songs.some((song) => song.id === id)).length
    const compare = (a: Tag, b: Tag) => {
      if (tagSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (tagSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (tagSortMode === 'plays') return playsFor(a) - playsFor(b) || a.name.localeCompare(b.name, 'de')
      if (tagSortMode === 'duration') return activeSongCount(a) - activeSongCount(b) || a.name.localeCompare(b.name, 'de')
      return a.createdAt - b.createdAt
    }
    return items.sort((a, b) => compare(a, b) * direction)
  }, [tags, songs, tagSortMode, tagSortDirection])
  const manualQueue = useMemo(() => {
    if (!activePlaylist) return [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activePlaylist.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activePlaylist, songs])

  const tagSongQueue = useMemo(() => {
    if (!activeTag) return []
    const byId = new Map(songs.map((song) => [song.id, song]))
    return activeTag.songIds.map((id) => byId.get(id)).filter((song): song is Song => Boolean(song))
  }, [activeTag, songs])

  const baseVisibleSongs = useMemo(() => {
    if (view === 'history') return [...songs]
    if (view === 'loops') return songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined)
    if (view === 'tag') return tagSongQueue
    return manualQueue
  }, [view, songs, manualQueue, tagSongQueue])

  const searchedVisibleSongs = useMemo(() => {
    if (view !== 'library' || !searchQuery.trim()) return baseVisibleSongs
    return baseVisibleSongs.filter((song) => fuzzyMatch(song.name, searchQuery) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, 'song', song.id, searchQuery)))
  }, [baseVisibleSongs, searchQuery, searchIncludesGroups, objectGroups, view])

  const visibleSongs = useMemo(() => {
    const items = [...searchedVisibleSongs]
    const direction = sortDirection === 'down' ? 1 : -1
    const compare = (a: Song, b: Song) => {
      if (sortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
      if (sortMode === 'plays') return (a.completedPlays ?? 0) - (b.completedPlays ?? 0) || a.name.localeCompare(b.name, 'de')
      if (sortMode === 'duration') return (a.duration ?? Number.MAX_SAFE_INTEGER) - (b.duration ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de')
      return a.addedAt - b.addedAt
    }
    const ordered = sortMode === 'manual' ? items : items.sort((a, b) => compare(a, b) * direction)
    const fresh = ordered.filter((song) => song.isNew)
    const normal = ordered.filter((song) => !song.isNew)
    return [...fresh, ...normal]
  }, [searchedVisibleSongs, sortMode, sortDirection])

  const normalPlayerQueue = view === 'tag' && activeTag ? tagSongQueue : activePlaylist ? manualQueue : [...songs].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt))
  const groupPlayerQueue = groupPlaybackIds !== null ? groupPlaybackIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => Boolean(song)) : []
  const playerQueue = groupPlaybackIds !== null ? groupPlayerQueue : normalPlayerQueue
  const currentSongPlaylists = useMemo(() => currentSong ? playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)) : [], [currentSong, playlists])
  const currentSongTags = useMemo(() => currentSong ? tags.filter((tag) => tag.songIds.includes(currentSong.id)) : [], [currentSong, tags])
  const taggedPlaylists = useMemo(() => activeTag ? activeTag.playlistIds.map((id) => playlists.find((playlist) => playlist.id === id)).filter((playlist): playlist is Playlist => Boolean(playlist)) : [], [activeTag, playlists])
  const taggedGroups = useMemo(() => activeTag ? (activeTag.groupIds ?? []).map((id) => objectGroups.find((group) => group.id === id)).filter((group): group is ObjectGroup => Boolean(group)) : [], [activeTag, objectGroups])

  useEffect(() => {
    const urls: Record<string, string> = {}
    playlists.forEach((playlist) => { if (playlist.cover) urls[playlist.id] = URL.createObjectURL(playlist.cover) })
    setCoverUrls(urls)
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [playlists])

  useEffect(() => {
    const urls: Record<string, string> = {}
    tags.forEach((tag) => { if (tag.cover) urls[tag.id] = URL.createObjectURL(tag.cover) })
    setTagCoverUrls(urls)
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
  }, [tags])

  useEffect(() => {
    const next = repeatSetting?.kind === 'count' ? repeatSetting.count : null
    repeatRemainingRef.current = next
    setRepeatRemaining(next)
  }, [currentSongId, repeatSetting])

  useEffect(() => {
    const file = currentSong?.file
    if (!file || file.size === 0) { setCurrentUrl(null); return }
    const url = URL.createObjectURL(file)
    setCurrentUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [currentSong?.id, currentSong?.file])

  useEffect(() => {
    const primary = audioRef.current
    const secondary = overlapAudioRef.current
    if (!primary || !currentUrl) return
    cancelLoopTransition()
    playbackAudioRef.current = primary
    loopOverlapBlockedRef.current = false
    try { primary.volume = 1; if (secondary) secondary.volume = 1 } catch { /* ignored */ }
    primary.load(); secondary?.load()
    if (shouldAutoPlayRef.current) void primary.play().catch(() => setIsPlaying(false))
  }, [currentUrl])

  useEffect(() => {
    const rate = loopEditorSongId ? parsedLoopPlaybackRate : 1
    if (audioRef.current) audioRef.current.playbackRate = rate
    if (overlapAudioRef.current) overlapAudioRef.current.playbackRate = rate
  }, [loopEditorSongId, parsedLoopPlaybackRate, currentUrl])

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const tick = () => {
      const song = currentSong
      const audio = currentPlaybackAudio()
      if (audio && song && !audio.paused) {
        if (loopEditorSongId === song.id && cursorLoopEnabled && loopDraftEnd > loopDraftStart && audio.currentTime >= loopDraftEnd) {
          audio.currentTime = loopDraftStart; setCurrentTime(loopDraftStart); setLoopCursor(loopDraftStart)
        } else if (!loopEditorSongId && isLoopActive(song) && song.loopStart !== undefined && song.loopEnd !== undefined && (repeatSetting?.kind !== 'count' || (repeatRemainingRef.current ?? 0) > 0)) {
          const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(song.id) : undefined
          const start = automatic?.start ?? song.loopStart
          const end = automatic?.end ?? song.loopEnd
          if (loopOverlapBlockedRef.current) {
            if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start); if (repeatSetting?.kind === 'count') consumeRepeat() }
          } else {
            const transition = loopTransitionRef.current
            if (transition) {
              const progress = Math.min(1, (performance.now() - transition.startedAt) / Math.max(1, transition.duration * 1000))
              try { transition.outgoing.volume = 1 - progress; transition.incoming.volume = progress } catch { /* iPadOS may ignore element volume */ }
              if (progress >= 1) {
                transition.outgoing.pause(); transition.outgoing.currentTime = start
                try { transition.outgoing.volume = 1; transition.incoming.volume = 1 } catch { /* ignored */ }
                playbackAudioRef.current = transition.incoming; loopTransitionRef.current = null; setCurrentTime(transition.incoming.currentTime); if (repeatSetting?.kind === 'count') consumeRepeat()
              }
            } else {
              const overlap = Math.min(LOOP_OVERLAP_SECONDS, Math.max(.04, (end - start) / 3))
              if (!loopStartPendingRef.current && audio.currentTime >= end - overlap) {
                const incoming = otherPlaybackAudio(audio)
                if (!incoming) { loopOverlapBlockedRef.current = true; void prepareAutomaticLoopSeam(song) }
                else {
                  loopStartPendingRef.current = true; incoming.pause(); incoming.currentTime = start; incoming.playbackRate = 1
                  try { incoming.volume = 0 } catch { /* ignored */ }
                  void incoming.play().then(() => {
                    loopStartPendingRef.current = false
                    if (audio.paused) { incoming.pause(); try { incoming.volume = 1 } catch { /* ignored */ }; return }
                    loopTransitionRef.current = { outgoing: audio, incoming, startedAt: performance.now(), duration: overlap }
                  }).catch(() => {
                    loopStartPendingRef.current = false; incoming.pause()
                    try { audio.volume = 1; incoming.volume = 1 } catch { /* ignored */ }
                    loopOverlapBlockedRef.current = true
                    if (audio.currentTime >= end) { audio.currentTime = start; setCurrentTime(start); if (repeatSetting?.kind === 'count') consumeRepeat() }
                    void prepareAutomaticLoopSeam(song)
                  })
                }
              }
            }
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, currentSong?.id, currentSong?.loopEnabled, currentSong?.loopStart, currentSong?.loopEnd, loopActivationMode, loopEditorSongId, cursorLoopEnabled, loopDraftStart, loopDraftEnd, repeatSetting, repeatRemaining])

  useEffect(() => {
    if (!editorSong || !editorDuration) return
    const existingStart = editorSong.loopStart
    const existingEnd = editorSong.loopEnd
    let initialCursor = 0
    if (existingStart !== undefined && existingEnd !== undefined && existingEnd > existingStart) {
      const start = Math.max(0, Math.min(existingStart, editorDuration))
      setLoopDraftStart(start)
      setLoopDraftEnd(Math.max(start, Math.min(existingEnd, editorDuration)))
      initialCursor = start
    } else {
      const start = Math.min(editorDuration * .2, Math.max(0, editorDuration - 2))
      const length = Math.min(Math.max(editorDuration * .22, 2), 20, Math.max(2, editorDuration - start))
      setLoopDraftStart(start)
      setLoopDraftEnd(Math.min(editorDuration, start + length))
      initialCursor = start
    }
    setLoopCursor(initialCursor)
    setLoopFocus(initialCursor)
    const initialMarkers = (editorSong.loopMarkers ?? []).filter((value) => value >= 0 && value <= editorDuration)
    setLoopMarkers(initialMarkers)
    setActiveMarkerIndex(initialMarkers.length ? 0 : null)
    setLoopZoom(1)
    setLoopSelectionLocked(false)
    setMarkersEnabled(true)
    setCursorLoopEnabled(true)
    setFocusFollowMode('center')
    setLoopPlaybackRate('1')
    setPreviewLeadStart('1')
    setPreviewLeadEnd('1')
    setLoopEditorMenuOpen(false)
    setLoopUndoStack([])
    setLoopRedoStack([])
    setLoopConfirmation(null)
    setActiveLoopEdge('start')
  }, [loopEditorSongId, editorDuration])

  useEffect(() => {
    if (!loopEditorSongId || !editorSong?.file || editorSong.file.size === 0) {
      setWaveform([])
      setWaveformStatus('idle')
      return
    }
    let cancelled = false
    setWaveform([])
    setWaveformStatus('loading')
    const buildWaveform = async () => {
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) throw new Error('no-audio-context')
      const context = new AudioContextClass()
      try {
        const buffer = await context.decodeAudioData((await editorSong.file.arrayBuffer()).slice(0))
        const channel = buffer.getChannelData(0)
        const buckets = 720
        const block = Math.max(1, Math.floor(channel.length / buckets))
        const peaks = Array.from({ length: buckets }, (_, bucket) => {
          const start = bucket * block
          const end = Math.min(channel.length, start + block)
          let peak = 0
          for (let index = start; index < end; index += Math.max(1, Math.floor(block / 120))) peak = Math.max(peak, Math.abs(channel[index]))
          return peak
        })
        const max = Math.max(...peaks, .001)
        if (!cancelled) {
          setWaveform(peaks.map((value) => Math.max(.04, value / max)))
          setWaveformStatus('ready')
        }
      } finally {
        void context.close()
      }
    }
    void buildWaveform().catch(() => { if (!cancelled) setWaveformStatus('unavailable') })
    return () => { cancelled = true }
  }, [loopEditorSongId, editorSong?.id, editorSong?.file])

  useEffect(() => {
    if (!loopEditorSongId || !editorDuration || focusFollowMode === 'off') return
    setLoopFocus(loopCursor)
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const cursorX = (loopCursor / editorDuration) * timeline.offsetWidth
      if (focusFollowMode === 'center') {
        const target = cursorX - scroller.clientWidth / 2
        scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
        return
      }
      const left = scroller.scrollLeft + 24
      const right = scroller.scrollLeft + scroller.clientWidth - 24
      if (cursorX < left || cursorX > right) {
        const pageStart = Math.floor(cursorX / Math.max(scroller.clientWidth, 1)) * scroller.clientWidth
        scroller.scrollLeft = Math.max(0, Math.min(pageStart, scroller.scrollWidth - scroller.clientWidth))
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [loopCursor, focusFollowMode, loopEditorSongId, editorDuration])

  useEffect(() => {
    if (!loopEditorSongId || !editorDuration) return
    const frame = requestAnimationFrame(() => {
      const scroller = loopTimelineScrollRef.current
      const timeline = loopTimelineRef.current
      if (!scroller || !timeline) return
      const target = (loopFocus / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
      scroller.scrollLeft = Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth))
    })
    return () => cancelAnimationFrame(frame)
  }, [loopZoom])

  const importDraftSnapshot = (): ImportDraftSnapshot => ({
    items: importDraftItems.map((item) => ({ id: item.id, name: item.name, originalIndex: item.originalIndex })),
    selectedIds: [...importDraftSelectedIds],
    sortMode: importDraftSortMode,
    placement: importLibraryPlacement ? { ...importLibraryPlacement, draftIds: [...importLibraryPlacement.draftIds] } : null,
  })
  const restoreImportDraftSnapshot = (target: ImportDraftSnapshot) => {
    const fileById = new Map(importDraftItems.map((item) => [item.id, item.file]))
    lastCommittedImportDraft?.items.forEach((item) => { if (!fileById.has(item.id)) fileById.set(item.id, item.file) })
    setImportDraftItems(target.items.map((item) => ({ ...item, file: fileById.get(item.id)! })).filter((item) => Boolean(item.file)))
    setImportDraftSelectedIds(new Set(target.selectedIds))
    setImportDraftSortMode(target.sortMode)
    setImportLibraryPlacement(target.placement ? { ...target.placement, draftIds: [...target.placement.draftIds] } : null)
  }
  const recordImportDraftHistory = () => {
    setImportDraftUndoStack((items) => [...items, importDraftSnapshot()].slice(-50))
    setImportDraftRedoStack([])
  }
  const undoImportDraft = () => {
    const target = importDraftUndoStack.at(-1)
    if (!target) return false
    setImportDraftUndoStack((items) => items.slice(0, -1))
    setImportDraftRedoStack((items) => [...items, importDraftSnapshot()].slice(-50))
    restoreImportDraftSnapshot(target)
    return true
  }
  const redoImportDraft = () => {
    const target = importDraftRedoStack.at(-1)
    if (!target) return false
    setImportDraftRedoStack((items) => items.slice(0, -1))
    setImportDraftUndoStack((items) => [...items, importDraftSnapshot()].slice(-50))
    restoreImportDraftSnapshot(target)
    return true
  }

  const snapshot = (): Snapshot => ({ songs: songs.map((song) => ({ ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined })), playlists: playlists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })), tags: tags.map((tag) => ({ ...tag, songIds: [...tag.songIds], playlistIds: [...tag.playlistIds], groupIds: [...(tag.groupIds ?? [])] })), objectGroups: objectGroups.map((group) => ({ ...group, itemIds: [...group.itemIds] })), objectColors: { ...objectColors } })
  const recordHistory = () => { setUndoStack((items) => [...items, snapshot()].slice(-50)); setRedoStack([]) }
  const restoreSnapshot = async (target: Snapshot) => {
    const previousSongs = songs
    const previousPlaylists = playlists
    const previousTags = tags
    setSongs(target.songs)
    setPlaylists(target.playlists)
    setTags(target.tags)
    setObjectGroups(target.objectGroups)
    setObjectColors(target.objectColors ?? {})
    const songIds = new Set(target.songs.map((song) => song.id))
    const playlistIds = new Set(target.playlists.map((playlist) => playlist.id))
    await Promise.all(previousSongs.filter((song) => !songIds.has(song.id)).map((song) => deleteSong(song.id)))
    await saveSongOrder(target.songs)
    await Promise.all(previousPlaylists.filter((playlist) => !playlistIds.has(playlist.id)).map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(target.playlists.map(savePlaylist))
    const tagIds = new Set(target.tags.map((tag) => tag.id))
    await Promise.all(previousTags.filter((tag) => !tagIds.has(tag.id)).map((tag) => deleteTag(tag.id)))
    await Promise.all(target.tags.map(saveTag))
  }
  const undo = async () => {
    if (importDraftItems.length) {
      if (undoImportDraft()) return
      return
    }
    const target = undoStack.at(-1)
    if (!target || moveCandidate) return
    setCancelledDuplicateAction(null)
    const undoingCommittedImport = Boolean(lastCommittedImportDraft?.importedIds.length)
      && lastCommittedImportDraft!.importedIds.every((id) => songs.some((song) => song.id === id))
      && lastCommittedImportDraft!.importedIds.every((id) => !target.songs.some((song) => song.id === id))
    setUndoStack((items) => items.slice(0, -1))
    setRedoStack((items) => [...items, snapshot()].slice(-50))
    await restoreSnapshot(target)
    if (undoingCommittedImport && lastCommittedImportDraft) {
      setImportDraftItems(lastCommittedImportDraft.items.map((item) => ({ ...item })))
      setImportDraftSelectedIds(new Set(lastCommittedImportDraft.items.map((item) => item.id)))
      setImportDraftSelectionMode(false)
      setImportDraftMenuOpen(false)
      setImportDraftRenameOpen(false)
      setImportDraftReorderMode(false)
      setImportDraftMoveMode(false)
      setImportDraftSortMode('manual')
      setImportMoveStep(null)
      setImportMoveReviewIds([])
      setImportLibraryTargetIndex(null)
      setImportLibraryPlacement(lastCommittedImportDraft.placement ? { ...lastCommittedImportDraft.placement, draftIds: [...lastCommittedImportDraft.placement.draftIds] } : null)
      setImportDraftConfirmation(null)
      setImportDraftUndoStack([...lastCommittedImportDraft.undo])
      setImportDraftRedoStack([...lastCommittedImportDraft.redo])
      setMessage('Import wurde zurückgenommen. Das Importfenster ist wieder geöffnet.')
    }
  }
  const redo = async () => {
    if (importDraftItems.length) {
      if (redoImportDraft()) return
      const target = redoStack.at(-1)
      if (target && lastCommittedImportDraft?.importedIds.some((id) => target.songs.some((song) => song.id === id))) {
        setRedoStack((items) => items.slice(0, -1))
        setUndoStack((items) => [...items, snapshot()].slice(-50))
        await restoreSnapshot(target)
        setImportDraftItems([])
        setImportDraftSelectedIds(new Set())
        setMessage('Import wurde wiederhergestellt.')
      }
      return
    }
    if (cancelledDuplicateAction) { const action = cancelledDuplicateAction; setCancelledDuplicateAction(null); requestDuplicateAction(action); return }
    const target = redoStack.at(-1); if (!target || moveCandidate) return
    setRedoStack((items) => items.slice(0, -1))
    setUndoStack((items) => [...items, snapshot()].slice(-50))
    await restoreSnapshot(target)
  }

  const applyNavigation = (entry: NavigationEntry) => {
    setView(entry.view); setActivePlaylistId(entry.playlistId); setActiveTagId(entry.tagId ?? null); setDetailOpen(entry.detailOpen); setSelectionMode(false); setSelectedSongIds(new Set()); setOverflowMenu(null); setLoopEditorSongId(null); setSearchQuery('')
  }
  const navigateTo = (entry: NavigationEntry) => {
    const current = navigation[navigationIndex]
    if (current && current.view === entry.view && current.playlistId === entry.playlistId && (current.tagId ?? null) === (entry.tagId ?? null) && current.detailOpen === entry.detailOpen) return
    const next = [...navigation.slice(0, navigationIndex + 1), entry].slice(-60)
    setNavigation(next); setNavigationIndex(next.length - 1); applyNavigation(entry)
  }
  const navigateBack = () => { if (loopEditorSongId) { setLoopEditorSongId(null); return } if (navigationIndex <= 0) return; const next = navigationIndex - 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const navigateForward = () => { if (navigationIndex >= navigation.length - 1) return; const next = navigationIndex + 1; setNavigationIndex(next); applyNavigation(navigation[next]) }
  const goHome = () => { setSettingsOpen(false); setLoopEditorSongId(null); setDetailOpen(false); setActiveTagId(null); setActivePlaylistId(null); navigateTo({ view: 'library', playlistId: null, detailOpen: false }) }
  const openOverviewSearch = (kind: 'playlist' | 'tag') => {
    setOverflowMenu(null)
    if (kind === 'playlist') {
      setPlaylistOverviewSearch('')
      navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false })
      requestAnimationFrame(() => requestAnimationFrame(() => playlistOverviewSearchRef.current?.focus()))
    } else {
      setTagOverviewSearch('')
      navigateTo({ view: 'tagOverview', playlistId: null, tagId: null, detailOpen: false })
      requestAnimationFrame(() => requestAnimationFrame(() => tagOverviewSearchRef.current?.focus()))
    }
  }

  const updateSong = async (updated: Song, addHistory = false) => { if (addHistory) recordHistory(); setSongs((items) => items.map((song) => song.id === updated.id ? updated : song)); await saveSong(updated) }
  const updatePlaylist = async (updated: Playlist, addHistory = false) => { if (addHistory) recordHistory(); setPlaylists((items) => items.map((playlist) => playlist.id === updated.id ? updated : playlist)); await savePlaylist(updated) }
  const updateTag = async (updated: Tag, addHistory = false) => { if (addHistory) recordHistory(); setTags((items) => items.map((tag) => tag.id === updated.id ? updated : tag)); await saveTag(updated) }

  const toggleSelected = (id: string) => setSelectedSongIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const playSong = (id: string, remember = true, preserveGroupQueue = false) => {
    if (selectionMode) return toggleSelected(id)
    if (!preserveGroupQueue) {
      groupPlaybackIdsRef.current = null
      setGroupPlaybackIds(null)
    }
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Audiodatei ist lokal nicht mehr verfügbar. Bitte importiere sie erneut.'); return }
    if (id === currentSongId && currentPlaybackAudio()) return void currentPlaybackAudio()?.play().catch(() => setMessage(`„${song.name}“ konnte nicht gestartet werden.`))
    if (remember && currentSongId) setPlayHistory((items) => [...items, currentSongId].slice(-50))
    shouldAutoPlayRef.current = true; setCurrentSongId(id); setCurrentTime(0)
  }
  const playQueueSong = (song: Song) => {
    const activeAudio = currentPlaybackAudio()
    if (song.id === currentSongId && activeAudio) {
      cancelLoopTransition(); activeAudio.currentTime = 0; setCurrentTime(0)
      void activeAudio.play().catch(() => setMessage(`„${song.name}“ konnte nicht erneut gestartet werden.`))
      return
    }
    playSong(song.id, true, true)
  }
  const moveSong = (direction: 1 | -1) => {
    const lockedGroupIds = groupPlaybackIdsRef.current
    const queue = lockedGroupIds !== null
      ? lockedGroupIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => Boolean(song))
      : playerQueue
    if (!queue.length) return
    const currentIndex = queue.findIndex((song) => song.id === currentSongId)
    if (shuffle && direction === 1 && queue.length > 1) {
      const options = queue.filter((song) => song.id !== currentSongId && song.file?.size)
      if (options.length) return playSong(options[Math.floor(Math.random() * options.length)].id, true, lockedGroupIds !== null)
    }
    const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : queue.length - 1) : currentIndex + direction
    if (nextIndex >= 0 && nextIndex < queue.length) return playSong(queue[nextIndex].id, true, lockedGroupIds !== null)
    if (repeatQueue) return playSong(queue[direction === 1 ? 0 : queue.length - 1].id, true, lockedGroupIds !== null)
    shouldAutoPlayRef.current = false
    setIsPlaying(false)
  }
  const togglePlayback = () => {
    const audio = currentPlaybackAudio()
    if (!currentSong) return playerQueue[0] && playSong(playerQueue[0].id)
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => setMessage(`„${currentSong.name}“ konnte nicht gestartet werden.`))
    else { audioRef.current?.pause(); overlapAudioRef.current?.pause(); cancelLoopTransition(); setIsPlaying(false) }
  }
  const seek = (value: number) => {
    const audio = currentPlaybackAudio(); if (!audio) return
    const next = Math.max(0, Math.min(duration || 0, value)); cancelLoopTransition(); audio.currentTime = next
    const other = otherPlaybackAudio(audio); if (other) other.currentTime = next
    setCurrentTime(next); if (loopEditorSongId) setLoopCursor(next)
  }
  const skipSeconds = (seconds: number) => seek(currentTime + seconds)
  const playPreviousFromHistory = () => {
    if (groupPlaybackIdsRef.current !== null) { moveSong(-1); return }
    const previous = playHistory.at(-1)
    if (!previous) return
    setPlayHistory((items) => items.slice(0, -1))
    playSong(previous, false)
  }

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = currentSong ? new MediaMetadata({ title: currentSong.name, artist: 'Josi' }) : null
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
      ['play', () => void currentPlaybackAudio()?.play()], ['pause', () => { audioRef.current?.pause(); overlapAudioRef.current?.pause(); updatePlayingState() }], ['previoustrack', () => moveSong(-1)], ['nexttrack', () => moveSong(1)],
      ['seekbackward', (event) => skipSeconds(-(event.seekOffset ?? seekSeconds))], ['seekforward', (event) => skipSeconds(event.seekOffset ?? seekSeconds)], ['seekto', (event) => event.seekTime !== undefined && seek(event.seekTime)],
    ]
    handlers.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* unsupported */ } })
    return () => handlers.forEach(([action]) => { try { navigator.mediaSession.setActionHandler(action, null) } catch { /* unsupported */ } })
  }, [currentSong?.id, isPlaying, playerQueue, shuffle, repeatQueue, currentTime, duration, seekSeconds])

  const openImportPicker = () => { const input = fileInputRef.current; if (!input) return; input.value = ''; input.click() }
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))
    if (!audioFiles.length) return setMessage('Keine unterstützten Audiodateien ausgewählt.')
    const items = audioFiles.map((file, index) => ({ id: crypto.randomUUID(), file, name: file.name.replace(/\.[^.]+$/, '') || file.name, originalIndex: index }))
    setImportDraftItems(items)
    setImportDraftSelectedIds(new Set(items.map((item) => item.id)))
    setImportDraftSelectionMode(false)
    setImportDraftMenuOpen(false)
    setImportDraftRenameOpen(false)
    setImportDraftReorderMode(false)
    setImportDraftMoveMode(false)
    setImportMoveStep(null)
    setImportMoveReviewIds([])
    setImportLibraryTargetIndex(null)
    setImportLibraryPlacement(null)
    setImportDraftSortMode('manual')
    setImportDraftSortDirection('down')
    setImportDraftUndoStack([])
    setImportDraftRedoStack([])
    setImportDraftConfirmation(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const importDraftTargetIds = () => importDraftSelectionMode ? [...importDraftSelectedIds] : importDraftItems.map((item) => item.id)
  const sortedImportDraftItems = () => {
    if (importDraftSortMode === 'manual') return [...importDraftItems]
    const sign = importDraftSortDirection === 'down' ? 1 : -1
    const items = [...importDraftItems]
    return items.sort((a, b) => {
      if (importDraftSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }) * sign
      if (importDraftSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' }) * sign
      return (a.originalIndex - b.originalIndex) * sign
    })
  }
  const toggleImportDraftSelected = (id: string) => setImportDraftSelectedIds((current) => {
    const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const beginImportDraftSelection = () => {
    recordImportDraftHistory()
    setImportDraftSelectionMode(true)
    setImportDraftSelectedIds(new Set(importDraftItems.map((item) => item.id)))
    setImportDraftMenuOpen(false)
  }
  const cancelImportDraftMode = () => {
    setImportDraftSelectionMode(false)
    setImportDraftReorderMode(false)
    setImportDraftMoveMode(false)
    setImportMoveStep(null)
    setImportMoveReviewIds([])
    setImportLibraryTargetIndex(null)
    setImportDraftSelectedIds(new Set(importDraftItems.map((item) => item.id)))
  }
  const beginImportMove = () => {
    setImportDraftSortMode('manual')
    setImportDraftMoveMode(true)
    setImportDraftReorderMode(false)
    setImportDraftRenameOpen(false)
    setImportDraftSelectionMode(true)
    setImportDraftSelectedIds(new Set())
    setImportMoveReviewIds([])
    setImportLibraryTargetIndex(null)
    setImportMoveStep('select')
    setImportDraftMenuOpen(false)
  }
  const confirmImportMoveSelection = () => {
    if (!importDraftSelectedIds.size) return
    setImportMoveReviewIds(importDraftItems.filter((item) => importDraftSelectedIds.has(item.id)).map((item) => item.id))
    setImportMoveStep('review')
  }
  const moveImportReviewItem = (id: string, delta: -1 | 1) => {
    setImportMoveReviewIds((current) => {
      const index = current.indexOf(id)
      const other = index + delta
      if (index < 0 || other < 0 || other >= current.length) return current
      const next = [...current]
      ;[next[index], next[other]] = [next[other], next[index]]
      return next
    })
  }
  const removeImportReviewItem = (id: string) => {
    setImportMoveReviewIds((current) => current.filter((item) => item !== id))
    setImportDraftSelectedIds((current) => { const next = new Set(current); next.delete(id); return next })
  }
  const openImportLibraryPlacement = () => {
    if (!importMoveReviewIds.length) return
    setImportLibraryTargetIndex(null)
    setImportMoveStep('place')
    setImportDraftSelectionMode(false)
    navigateTo({ view: 'library', playlistId: null, detailOpen: false })
  }
  const confirmImportLibraryPlacement = () => {
    if (importLibraryTargetIndex === null || !importMoveReviewIds.length) return
    recordImportDraftHistory()
    setImportLibraryPlacement({ draftIds: [...importMoveReviewIds], targetIndex: importLibraryTargetIndex })
    setImportMoveStep(null)
    setImportDraftMoveMode(false)
    setImportDraftSelectionMode(false)
    setImportLibraryTargetIndex(null)
    setMessage('Position für den Import wurde vorgemerkt. Mit „Fertig“ wird sie übernommen.')
  }
  const backFromImportPlacement = () => {
    setImportLibraryTargetIndex(null)
    setImportMoveStep('review')
    setImportDraftSelectionMode(true)
  }
  const cancelImportMoveFlow = () => {
    setImportDraftMoveMode(false)
    setImportDraftSelectionMode(false)
    setImportMoveStep(null)
    setImportMoveReviewIds([])
    setImportLibraryTargetIndex(null)
    setImportDraftSelectedIds(new Set(importDraftItems.map((item) => item.id)))
  }
  const moveImportDraftItem = (id: string, delta: -1 | 1) => {
    const index = importDraftItems.findIndex((item) => item.id === id)
    const other = index + delta
    if (index < 0 || other < 0 || other >= importDraftItems.length) return
    recordImportDraftHistory()
    const next = [...importDraftItems]
    ;[next[index], next[other]] = [next[other], next[index]]
    setImportDraftItems(next)
    setImportDraftSortMode('manual')
  }
  const moveImportDraftSelectionTo = (targetIndex: number) => {
    const selected = new Set(importDraftTargetIds())
    if (!selected.size || selected.size === importDraftItems.length) return
    recordImportDraftHistory()
    const moving = importDraftItems.filter((item) => selected.has(item.id))
    const remaining = importDraftItems.filter((item) => !selected.has(item.id))
    const removedBefore = importDraftItems.slice(0, targetIndex).filter((item) => selected.has(item.id)).length
    const insertAt = Math.max(0, Math.min(remaining.length, targetIndex - removedBefore))
    setImportDraftItems([...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)])
    setImportDraftSortMode('manual')
  }
  const updateImportDraftName = (id: string, name: string) => {
    setImportDraftItems((current) => current.map((item) => item.id === id ? { ...item, name } : item))
  }
  const commitImportDraft = async (fromRedo = false) => {
    if (!importDraftItems.length) return
    try {
      if (!fromRedo) recordHistory()
      const previousNew = songs.filter((song) => song.isNew)
      if (previousNew.length) await Promise.all(previousNew.map((song) => saveSong({ ...song, isNew: false })))
      const orderedFiles = importDraftItems.map((item) => item.file)
      const imported = await saveSongs(orderedFiles)
      const renamed = imported.map((song, index) => ({ ...song, name: importDraftItems[index]?.name.trim() || song.name }))
      await Promise.all(renamed.map(saveSong))
      const nextSongs = [...songs.map((song) => ({ ...song, isNew: false })), ...renamed]
      setSongs(nextSongs)
      if (importLibraryPlacement) {
        const importedByDraft = new Map(importDraftItems.map((item, index) => [item.id, renamed[index]?.id]).filter((entry): entry is [string, string] => Boolean(entry[1])))
        const placedIds = importLibraryPlacement.draftIds.map((id) => importedByDraft.get(id)).filter((id): id is string => Boolean(id))
        const placedSet = new Set(placedIds)
        const unplacedIds = renamed.map((song) => song.id).filter((id) => !placedSet.has(id))
        const rootKey = 'song:root:library'
        const existingGroups = sortedGroupsFor('song', songs)
        const groupedIds = new Set(objectGroups.filter((group) => group.kind === 'song').flatMap((group) => group.itemIds))
        const existingUngrouped = songs.filter((song) => !groupedIds.has(song.id))
        const baseTokens = [...existingGroups.map((group) => groupToken(group.id)), ...existingUngrouped.map((song) => itemToken(song.id))]
        const existingOrder = orderedTokensForContainer(rootKey, baseTokens, sortMode === 'manual')
        const at = Math.max(0, Math.min(importLibraryPlacement.targetIndex, existingOrder.length))
        const nextOrder = [...existingOrder.slice(0, at), ...placedIds.map(itemToken), ...existingOrder.slice(at), ...unplacedIds.map(itemToken)]
        setSortMode('manual')
        setMixedOrders((current) => ({ ...current, [rootKey]: nextOrder }))
        const active = activeSortSave('song')
        if (active) setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders: { ...save.orders, [rootKey]: nextOrder } } : save))
      }
      setLastCommittedImportDraft({ items: importDraftItems.map((item) => ({ ...item })), importedIds: renamed.map((song) => song.id), undo: [...importDraftUndoStack], redo: [...importDraftRedoStack], placement: importLibraryPlacement })
      setImportDraftItems([])
      setImportDraftSelectedIds(new Set())
      setImportDraftSelectionMode(false)
      setImportDraftMenuOpen(false)
      setImportDraftRenameOpen(false)
      setImportDraftReorderMode(false)
      setImportDraftMoveMode(false)
      setImportMoveStep(null)
      setImportMoveReviewIds([])
      setImportLibraryTargetIndex(null)
      setImportLibraryPlacement(null)
      setImportDraftConfirmation(null)
      setMessage(`${renamed.length} ${renamed.length === 1 ? 'Song wurde' : 'Songs wurden'} importiert.`)
    } catch (error) {
      const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'UnknownError')
      setMessage(quota ? 'Import fehlgeschlagen: Der lokale Browser-Speicher ist wahrscheinlich voll oder wurde von iPadOS begrenzt.' : 'Import fehlgeschlagen. Bitte versuche es erneut.')
    }
  }
  const discardImportDraft = () => {
    setImportDraftItems([])
    setImportDraftSelectedIds(new Set())
    setImportDraftSelectionMode(false)
    setImportDraftMenuOpen(false)
    setImportDraftRenameOpen(false)
    setImportDraftReorderMode(false)
    setImportDraftMoveMode(false)
    setImportMoveStep(null)
    setImportMoveReviewIds([])
    setImportLibraryTargetIndex(null)
    setImportLibraryPlacement(null)
    setImportDraftConfirmation(null)
    setImportDraftUndoStack([])
    setImportDraftRedoStack([])
    setMessage('Import wurde abgebrochen.')
  }


  const markSeen = async (id?: string) => {
    if (id) { const song = songs.find((item) => item.id === id); if (song) await updateSong({ ...song, isNew: false }) }
    else {
      const changed = songs.filter((song) => song.isNew)
      if (changed.length) await Promise.all(changed.map((song) => saveSong({ ...song, isNew: false })))
      setSongs((items) => items.map((song) => song.isNew ? { ...song, isNew: false } : song))
    }
    setOverflowMenu(null)
  }

  const beginRename = (kind: 'song' | 'playlist' | 'tag', id: string) => {
    const name = kind === 'song' ? songs.find((song) => song.id === id)?.name : kind === 'playlist' ? playlists.find((playlist) => playlist.id === id)?.name : tags.find((tag) => tag.id === id)?.name
    if (!name) return
    if (kind === 'tag') setRenameTagColor(tags.find((tag) => tag.id === id)?.color ?? '#60a5fa')
    setRenameTarget({ kind, id }); setRenameValue(name); setOverflowMenu(null)
  }
  const confirmRename = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = renameValue.trim()
    if (!renameTarget || !name) return
    if (renameTarget.kind === 'song') {
      const song = songs.find((item) => item.id === renameTarget.id)
      if (song) await updateSong({ ...song, name }, true)
    } else if (renameTarget.kind === 'playlist') {
      const playlist = playlists.find((item) => item.id === renameTarget.id)
      if (playlist) await updatePlaylist({ ...playlist, name, lastUsedAt: Date.now() }, true)
    } else {
      const tag = tags.find((item) => item.id === renameTarget.id)
      if (tag) await updateTag({ ...tag, name, color: renameTagColor, lastUsedAt: Date.now() }, true)
    }
    setRenameTarget(null)
  }

  const normalizeName = (value: string) => value.trim().toLocaleLowerCase('de-DE')
  const copySong = (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song?.file || song.file.size === 0) { setMessage('Diese Datei kann nicht kopiert werden, weil der lokale Audioblob fehlt.'); setOverflowMenu(null); return }
    setClipboard({ kind: 'song', song: { ...song, loopMarkers: song.loopMarkers ? [...song.loopMarkers] : undefined } })
    setOverflowMenu(null); setMessage(`„${song.name}“ liegt in der Josi-Zwischenablage.`)
  }
  const copyPlaylist = (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    setClipboard({ kind: 'playlist', playlist: { ...playlist, songIds: [...playlist.songIds] } })
    setOverflowMenu(null); setMessage(`„${playlist.name}“ liegt in der Josi-Zwischenablage.`)
  }

  const duplicateNamesForAction = (action: DuplicateAction) => {
    if (action.kind === 'tag-add') {
      const tag = tags.find((item) => item.id === action.tagId)
      if (!tag) return []
      const pool = action.targetKind === 'song' ? songs : playlists
      const memberIds = action.targetKind === 'song' ? tag.songIds : tag.playlistIds
      const actionNames = action.ids.map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name))
      const newNames = new Set(actionNames.map(normalizeName).filter(Boolean))
      const existingConflicts = memberIds.filter((id) => !action.ids.includes(id)).map((id) => pool.find((item) => item.id === id)?.name).filter((name): name is string => Boolean(name)).filter((name) => newNames.has(normalizeName(name)))
      const counts = new Map<string, number>(); actionNames.forEach((name) => counts.set(normalizeName(name), (counts.get(normalizeName(name)) ?? 0) + 1))
      const internalConflicts = actionNames.filter((name, index) => (counts.get(normalizeName(name)) ?? 0) > 1 && actionNames.findIndex((item) => normalizeName(item) === normalizeName(name)) === index)
      return [...new Set([...existingConflicts, ...internalConflicts])]
    }
    if (action.kind === 'paste-song') {
      const destination = action.targetPlaylistId ? playlists.find((playlist) => playlist.id === action.targetPlaylistId)?.songIds.map((id) => songs.find((song) => song.id === id)).filter((song): song is Song => Boolean(song)) ?? [] : songs
      return [...new Set(destination.filter((song) => normalizeName(song.name) === normalizeName(action.source.name)).map((song) => song.name))]
    }
    return [...new Set(playlists.filter((playlist) => normalizeName(playlist.name) === normalizeName(action.source.name)).map((playlist) => playlist.name))]
  }
  const requestDuplicateAction = (action: DuplicateAction) => {
    const names = duplicateNamesForAction(action)
    if (names.length) { setDuplicateConflict({ action, names }); return }
    void applyDuplicateAction(action, 'both')
  }
  const moveSongsToTrash = async (ids: string[]) => {
    const idSet = new Set(ids)
    const moving = songs.filter((song) => idSet.has(song.id)).map((song) => ({ ...song, trashedAt: Date.now(), trashPlaylistIds: playlists.filter((playlist) => playlist.songIds.includes(song.id)).map((playlist) => playlist.id) }))
    if (!moving.length) return
    await Promise.all(moving.map(saveSong))
    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => idSet.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !idSet.has(id)) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => !idSet.has(song.id)))
    setTrashedSongs((items) => [...moving, ...items.filter((song) => !idSet.has(song.id))])
    if (currentSongId && idSet.has(currentSongId)) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
  }
  const applyDuplicateAction = async (action: DuplicateAction, resolution: 'replace' | 'both') => {
    setDuplicateConflict(null); setCancelledDuplicateAction(null)
    if (action.kind === 'tag-add') {
      const tag = tags.find((item) => item.id === action.tagId)
      if (!tag) return
      const pool = action.targetKind === 'song' ? songs : playlists
      const newNames = new Set(action.ids.map((id) => normalizeName(pool.find((item) => item.id === id)?.name ?? '')).filter(Boolean))
      const insertIds = resolution === 'replace' ? [...action.ids].reverse().filter((id, index, reversed) => reversed.findIndex((other) => normalizeName(pool.find((item) => item.id === other)?.name ?? '') === normalizeName(pool.find((item) => item.id === id)?.name ?? '')) === index).reverse() : action.ids
      if (tagChooserTarget) setTagChooserDirty(true)
      if (action.targetKind === 'song') {
        const kept = resolution === 'replace' ? tag.songIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(songs.find((song) => song.id === id)?.name ?? ''))) : tag.songIds
        await updateTag({ ...tag, songIds: [...new Set([...kept.filter((id) => !action.ids.includes(id)), ...insertIds])], lastUsedAt: Date.now() }, !tagChooserTarget)
      } else {
        const kept = resolution === 'replace' ? tag.playlistIds.filter((id) => action.ids.includes(id) || !newNames.has(normalizeName(playlists.find((playlist) => playlist.id === id)?.name ?? ''))) : tag.playlistIds
        await updateTag({ ...tag, playlistIds: [...new Set([...kept.filter((id) => !action.ids.includes(id)), ...insertIds])], lastUsedAt: Date.now() }, !tagChooserTarget)
      }
      return
    }
    if (action.kind === 'paste-song') {
      const now = Date.now()
      const conflicts = songs.filter((song) => normalizeName(song.name) === normalizeName(action.source.name))
      if (resolution === 'both' || action.targetPlaylistId) recordHistory()
      if (resolution === 'replace' && action.targetPlaylistId) {
        const target = playlists.find((playlist) => playlist.id === action.targetPlaylistId)
        if (target) await updatePlaylist({ ...target, songIds: target.songIds.filter((id) => !conflicts.some((song) => song.id === id)), lastUsedAt: Date.now() })
      } else if (resolution === 'replace' && conflicts.length) await moveSongsToTrash(conflicts.map((song) => song.id))
      const copy: Song = { ...action.source, id: crypto.randomUUID(), addedAt: now, libraryOrder: now, importBatchId: crypto.randomUUID(), isNew: false, completedPlays: 0, loopMarkers: action.source.loopMarkers ? [...action.source.loopMarkers] : undefined, trashedAt: undefined, trashPlaylistIds: undefined, trashedLoop: undefined }
      await saveSong(copy); setSongs((items) => [...items, copy])
      if (action.targetPlaylistId) {
        const target = playlists.find((playlist) => playlist.id === action.targetPlaylistId)
        if (target) await updatePlaylist({ ...target, songIds: [...target.songIds.filter((id) => resolution !== 'replace' || !conflicts.some((song) => song.id === id)), copy.id], lastUsedAt: Date.now() })
      }
      setOverflowMenu(null); setMessage(`„${copy.name}“ wurde eingefügt.`); return
    }
    const conflicts = playlists.filter((playlist) => normalizeName(playlist.name) === normalizeName(action.source.name))
    if (resolution === 'both') recordHistory()
    if (resolution === 'replace' && conflicts.length) {
      const trashedAt = Date.now()
      const moving = conflicts.map((playlist) => ({ ...playlist, trashedAt }))
      await Promise.all(moving.map(savePlaylist)); setPlaylists((items) => items.filter((playlist) => !conflicts.some((conflict) => conflict.id === playlist.id))); setTrashedPlaylists((items) => [...moving, ...items.filter((playlist) => !conflicts.some((conflict) => conflict.id === playlist.id))])
    }
    const copy: Playlist = { ...action.source, id: crypto.randomUUID(), songIds: [...action.source.songIds], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now(), trashedAt: undefined }
    await savePlaylist(copy); setPlaylists((items) => [copy, ...items]); setOverflowMenu(null); setMessage(`„${copy.name}“ wurde eingefügt.`)
  }
  const resolveDuplicateConflict = (resolution: 'replace' | 'both') => { const action = duplicateConflict?.action; if (action) void applyDuplicateAction(action, resolution) }
  const cancelDuplicateConflict = () => { if (duplicateConflict) setCancelledDuplicateAction(duplicateConflict.action); setDuplicateConflict(null) }
  const pasteFromSongMenu = () => { if (clipboard?.kind !== 'song') return; requestDuplicateAction({ kind: 'paste-song', source: clipboard.song, targetPlaylistId: view === 'library' ? activePlaylistId : null }) }
  const pasteFromPlaylistMenu = (playlistId: string) => {
    if (clipboard?.kind === 'song') requestDuplicateAction({ kind: 'paste-song', source: clipboard.song, targetPlaylistId: playlistId })
    else if (clipboard?.kind === 'playlist') requestDuplicateAction({ kind: 'paste-playlist', source: clipboard.playlist })
  }

  const shareSong = async (id: string) => {
    const song = songs.find((item) => item.id === id)
    const nav = navigator as ShareNavigator
    if (!song?.file || song.file.size === 0) { setMessage('Diese Audiodatei ist lokal nicht mehr verfügbar.'); setOverflowMenu(null); return }
    if (!nav.share) { setMessage('Die System-Freigabe wird in diesem Browser nicht unterstützt.'); setOverflowMenu(null); return }
    const file = new File([song.file], `${song.name}.${extensionForType(song.type)}`, { type: song.type || 'audio/mpeg' })
    const data = { title: song.name, files: [file] }
    if (nav.canShare && !nav.canShare(data)) { setMessage('Diese Audiodatei kann von iPadOS hier nicht direkt geteilt werden.'); setOverflowMenu(null); return }
    try { await nav.share(data) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Teilen konnte nicht geöffnet werden.') }
    setOverflowMenu(null)
  }

  const sharePlaylist = async (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    const nav = navigator as ShareNavigator
    if (!playlist) return
    if (!nav.share) { setMessage('Die System-Freigabe wird in diesem Browser nicht unterstützt.'); setOverflowMenu(null); return }
    const byId = new Map(songs.map((song) => [song.id, song.name]))
    const list = playlist.songIds.map((songId, index) => `${index + 1}. ${byId.get(songId) ?? 'Unbekanntes Lied'}`).join('\n')
    try { await nav.share({ title: playlist.name, text: `${playlist.name}\n\n${list || 'Keine Lieder'}` }) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Teilen konnte nicht geöffnet werden.') }
    setOverflowMenu(null)
  }

  const confirmDeleteSong = async () => {
    if (!songToDelete) return
    const playlistIds = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => playlist.id)
    const trashedSong = { ...songToDelete, trashedAt: Date.now(), trashPlaylistIds: playlistIds }
    await saveSong(trashedSong)
    const affected = playlists.filter((playlist) => playlist.songIds.includes(songToDelete.id)).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => id !== songToDelete.id) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => song.id !== songToDelete.id))
    setTrashedSongs((items) => [trashedSong, ...items.filter((song) => song.id !== trashedSong.id)])
    if (currentSongId === songToDelete.id) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
    if (loopEditorSongId === songToDelete.id) setLoopEditorSongId(null)
    setSelectedSongIds((items) => { const next = new Set(items); next.delete(songToDelete.id); return next })
    setSongToDelete(null)
  }

  const openLoopEditor = (id: string) => {
    const song = songs.find((item) => item.id === id)
    if (!song) return
    if (!song.file || song.file.size === 0) { setMessage('Für diesen Song fehlt die lokale Audiodatei.'); setOverflowMenu(null); return }
    shouldAutoPlayRef.current = false
    ensurePrimaryPlayback()
    setCurrentSongId(id); setDetailOpen(false); setOverflowMenu(null); setLoopEditorSongId(id); setCurrentTime(0)
  }

  const timelineTime = (clientX: number) => {
    const element = loopTimelineRef.current
    if (!element || !editorDuration) return 0
    const rect = element.getBoundingClientRect()
    return Math.max(0, Math.min(editorDuration, ((clientX - rect.left) / Math.max(rect.width, 1)) * editorDuration))
  }
  const focusTime = (clientX: number) => {
    const element = loopFocusRef.current
    if (!element || !editorDuration) return 0
    const rect = element.getBoundingClientRect()
    return Math.max(0, Math.min(editorDuration, ((clientX - rect.left) / Math.max(rect.width, 1)) * editorDuration))
  }
  const beginLoopDrag = (event: React.PointerEvent, kind: 'move' | 'start' | 'end' | 'cursor' | 'focus') => {
    if (!editorDuration) return
    if (loopSelectionLocked && kind !== 'cursor' && kind !== 'focus') return
    if (kind === 'focus' && focusFollowMode !== 'off') return
    recordLoopEditorHistory()
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    const time = kind === 'focus' ? focusTime(event.clientX) : timelineTime(event.clientX)
    if (kind === 'start' || kind === 'end') setActiveLoopEdge(kind)
    if (kind === 'cursor') { setLoopCursor(time); seek(time) }
    if (kind === 'focus') setLoopFocus(time)
    loopDragRef.current = { kind, offset: kind === 'move' ? time - loopDraftStart : 0 }
  }
  const moveLoopDrag = (event: React.PointerEvent) => {
    const drag = loopDragRef.current
    if (!drag || !editorDuration) return
    if (drag.kind === 'focus') { setLoopFocus(focusTime(event.clientX)); return }
    const time = timelineTime(event.clientX)
    const minLength = Math.min(.5, Math.max(.05, editorDuration * .002))
    if (drag.kind === 'cursor') { setLoopCursor(time); seek(time); return }
    if (drag.kind === 'start') { setLoopDraftStart(Math.max(0, Math.min(time, loopDraftEnd - minLength))); return }
    if (drag.kind === 'end') { setLoopDraftEnd(Math.min(editorDuration, Math.max(time, loopDraftStart + minLength))); return }
    const length = Math.max(minLength, loopDraftEnd - loopDraftStart)
    const start = Math.max(0, Math.min(editorDuration - length, time - drag.offset))
    setLoopDraftStart(start); setLoopDraftEnd(start + length)
  }
  const endLoopDrag = () => { loopDragRef.current = null }
  const loopEditorSnapshot = (): LoopEditorSnapshot => ({ start: loopDraftStart, end: loopDraftEnd, cursor: loopCursor, focus: loopFocus, markers: [...loopMarkers], zoom: loopZoom })
  const applyLoopEditorSnapshot = (target: LoopEditorSnapshot) => {
    setLoopDraftStart(target.start); setLoopDraftEnd(target.end); setLoopCursor(target.cursor); setLoopFocus(target.focus); setLoopMarkers([...target.markers]); setLoopZoom(target.zoom)
    setActiveMarkerIndex((index) => target.markers.length ? Math.min(index ?? 0, target.markers.length - 1) : null)
    seek(target.cursor)
  }
  const recordLoopEditorHistory = () => {
    if (!loopEditorSongId) return
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    setLoopRedoStack([])
  }
  const undoLoopEditor = () => {
    const target = loopUndoStack.at(-1)
    if (!target) return
    setLoopUndoStack((items) => items.slice(0, -1))
    setLoopRedoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const redoLoopEditor = () => {
    const target = loopRedoStack.at(-1)
    if (!target) return
    setLoopRedoStack((items) => items.slice(0, -1))
    setLoopUndoStack((items) => [...items, loopEditorSnapshot()].slice(-60))
    applyLoopEditorSnapshot(target)
  }
  const moveCursorTo = (value: number, play = false, remember = false) => {
    if (remember) recordLoopEditorHistory()
    const next = Math.max(0, Math.min(editorDuration || 0, value))
    setLoopCursor(next); seek(next)
    if (play) void audioRef.current?.play().catch(() => setMessage('Die Vorschau konnte nicht gestartet werden.'))
  }
  const parseEditorSeconds = (value: string, fallback: number, max = 60) => Math.max(.001, Math.min(max, Number.parseFloat(value.replace(',', '.')) || fallback))
  const parsedEdgeStep = () => parseEditorSeconds(edgeStep, .01)
  const nudgeLoopEdge = (edge: 'start' | 'end', delta: number) => {
    if (loopSelectionLocked || !editorDuration) return
    recordLoopEditorHistory()
    const minLength = .001
    setActiveLoopEdge(edge)
    if (edge === 'start') setLoopDraftStart((value) => Math.max(0, Math.min(value + delta, loopDraftEnd - minLength)))
    else setLoopDraftEnd((value) => Math.min(editorDuration, Math.max(value + delta, loopDraftStart + minLength)))
  }
  const nudgeFocus = (delta: number) => {
    if (!editorDuration) return
    recordLoopEditorHistory()
    setFocusFollowMode('off')
    setLoopFocus((value) => Math.max(0, Math.min(editorDuration, value + delta)))
  }
  const nudgeCursor = (delta: number) => moveCursorTo(loopCursor + delta, false, true)
  const setMarker = () => {
    if (!markersEnabled || !editorDuration) return
    recordLoopEditorHistory()
    const next = [...loopMarkers, loopCursor].sort((a, b) => a - b)
    setLoopMarkers(next)
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    next.forEach((value, index) => { const currentDistance = Math.abs(value - loopCursor); if (currentDistance < distance) { distance = currentDistance; nearest = index } })
    setActiveMarkerIndex(nearest)
  }
  const nudgeActiveMarker = (delta: number) => {
    if (!markersEnabled || activeMarkerIndex === null || !editorDuration || !loopMarkers[activeMarkerIndex] && loopMarkers[activeMarkerIndex] !== 0) return
    recordLoopEditorHistory()
    const next = [...loopMarkers]
    next[activeMarkerIndex] = Math.max(0, Math.min(editorDuration, next[activeMarkerIndex] + delta))
    const selectedValue = next[activeMarkerIndex]
    next.sort((a, b) => a - b)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.indexOf(selectedValue))
  }
  const deleteActiveMarker = () => {
    if (activeMarkerIndex === null || !loopMarkers.length) return
    recordLoopEditorHistory()
    const next = loopMarkers.filter((_, index) => index !== activeMarkerIndex)
    setLoopMarkers(next)
    setActiveMarkerIndex(next.length ? Math.min(activeMarkerIndex, next.length - 1) : null)
    setLoopEditorMenuOpen(false)
  }
  const deleteAllMarkers = () => {
    if (!loopMarkers.length) return
    recordLoopEditorHistory()
    setLoopMarkers([]); setActiveMarkerIndex(null); setLoopEditorMenuOpen(false); setLoopConfirmation(null)
  }
  const scrollTimelineTo = (time: number) => {
    const scroller = loopTimelineScrollRef.current
    const timeline = loopTimelineRef.current
    if (!scroller || !timeline || !editorDuration) return
    const target = (time / editorDuration) * timeline.offsetWidth - scroller.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth)), behavior: 'smooth' })
  }
  const moveMarkerTarget = (target: 'focus' | 'start' | 'end') => {
    if (activeMarkerIndex === null || loopMarkers[activeMarkerIndex] === undefined || !editorDuration) return
    const marker = loopMarkers[activeMarkerIndex]
    recordLoopEditorHistory()
    if (target === 'focus') { setFocusFollowMode('off'); setLoopFocus(marker); scrollTimelineTo(marker) }
    if (target === 'start') { setActiveLoopEdge('start'); setLoopDraftStart(Math.max(0, Math.min(marker, loopDraftEnd - .001))) }
    if (target === 'end') { setActiveLoopEdge('end'); setLoopDraftEnd(Math.min(editorDuration, Math.max(marker, loopDraftStart + .001))) }
    setLoopEditorMenuOpen(false)
  }
  const previewBoundary = (boundary: 'start' | 'end') => {
    const source = boundary === 'start' ? previewLeadStart : previewLeadEnd
    const lead = Math.max(0, Number.parseFloat(source.replace(',', '.')) || 0)
    moveCursorTo(Math.max(0, (boundary === 'start' ? loopDraftStart : loopDraftEnd) - lead), true, true)
  }
  const markerLabel = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + (index % 26))}${Math.floor(index / 26) + 1}`
  const saveLoopDraft = async () => {
    if (!editorSong || !editorDuration || loopDraftEnd <= loopDraftStart) return
    const wasPlaying = Boolean(currentPlaybackAudio() && !currentPlaybackAudio()?.paused)
    await updateSong({ ...editorSong, loopStart: loopDraftStart, loopEnd: loopDraftEnd, loopEnabled: true, loopConfidence: undefined, loopMarkers: [...loopMarkers] }, true)
    setLoopEditorSongId(null)
    if (wasPlaying) void currentPlaybackAudio()?.play().catch(() => undefined)
    setLoopConfirmation(null)
    setMessage(`Loop für „${editorSong.name}“ gespeichert.`)
  }

  const advanceCreationPlacement = () => {
    setCreationPlacementQueue((current) => {
      const [next, ...rest] = current
      setCreationPlacement(next ?? null)
      return rest
    })
    setCreationPlacementMenuOpen(false)
  }
  const finishCreationPlacement = async (moveAfter: boolean) => {
    const target = creationPlacement
    if (!target) return
    const name = target.name.trim()
    if (name) {
      if (target.kind === 'song') {
        const song = songs.find((item) => item.id === target.id)
        if (song && song.name !== name) await updateSong({ ...song, name }, true)
      } else if (target.kind === 'playlist') {
        const playlist = playlists.find((item) => item.id === target.id)
        if (playlist && playlist.name !== name) await updatePlaylist({ ...playlist, name, lastUsedAt: Date.now() }, true)
      } else {
        const tag = tags.find((item) => item.id === target.id)
        if (tag && tag.name !== name) await updateTag({ ...tag, name, lastUsedAt: Date.now() }, true)
      }
    }
    setCreationPlacement(null)
    setCreationPlacementMenuOpen(false)
    if (moveAfter) openSingleMove(target.kind, target.id)
    else advanceCreationPlacement()
  }
  const cancelSingleMove = () => {
    setSingleMoveTarget(null)
    if (creationPlacementQueue.length) advanceCreationPlacement()
  }

  const createTag = async (event: React.FormEvent) => {
    event.preventDefault(); const name = tagName.trim(); if (!name) return
    if (tags.some((tag) => normalizeName(tag.name) === normalizeName(name))) { setMessage('Ein Tag mit diesem Namen existiert bereits.'); return }
    recordHistory(); const now = Date.now(); const tag: Tag = { id: crypto.randomUUID(), name, color: tagColor, songIds: [], playlistIds: [], createdAt: now, lastUsedAt: now, sortOrder: tags.length }
    await saveTag(tag); setTags((items) => [...items, tag]); setTagName(''); setTagColor('#60a5fa'); setCreationPlacement({ kind: 'tag', id: tag.id, name: tag.name })
  }
  const openTag = async (id: string) => {
    if (reorderScope === 'tags') return
    navigateTo({ view: 'tag', playlistId: null, tagId: id, detailOpen: false })
    const tag = tags.find((item) => item.id === id); if (tag) await updateTag({ ...tag, lastUsedAt: Date.now() })
  }
  const confirmDeleteTag = async () => {
    if (!tagToDelete) return; const trashed = { ...tagToDelete, trashedAt: Date.now() }; await saveTag(trashed); setTags((items) => items.filter((tag) => tag.id !== tagToDelete.id)); setTrashedTags((items) => [trashed, ...items.filter((tag) => tag.id !== trashed.id)]); if (activeTagId === tagToDelete.id) goHome(); setTagToDelete(null)
  }

  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault(); const name = playlistName.trim(); if (!name) return; recordHistory()
    const playlist: Playlist = { id: crypto.randomUUID(), name, songIds: [], createdAt: Date.now(), lastUsedAt: Date.now(), sortOrder: -Date.now() }
    await savePlaylist(playlist); setPlaylists((items) => [playlist, ...items]); setPlaylistName(''); setCreationPlacement({ kind: 'playlist', id: playlist.id, name: playlist.name }); navigateTo({ view: 'library', playlistId: playlist.id, detailOpen: false })
  }
  const openPlaylist = async (id: string | null) => { if (reorderScope === 'sidebar') return; navigateTo({ view: 'library', playlistId: id, detailOpen: false }); const playlist = playlists.find((item) => item.id === id); if (playlist) await updatePlaylist({ ...playlist, lastUsedAt: Date.now() }) }
  const removeSongFromActivePlaylist = async (songId: string) => { if (!activePlaylist) return; await updatePlaylist({ ...activePlaylist, songIds: activePlaylist.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true) }
  const startEditingPlaylist = () => { if (!activePlaylist) return; setEditingName(activePlaylist.name); setIsEditingPlaylist(true) }
  const savePlaylistName = async (event: React.FormEvent) => { event.preventDefault(); if (!activePlaylist || !editingName.trim()) return; await updatePlaylist({ ...activePlaylist, name: editingName.trim(), lastUsedAt: Date.now() }, true); setIsEditingPlaylist(false) }
  const openPlaylistCoverPicker = (id: string) => { setPlaylistCoverTargetId(id); setTagCoverTargetId(null); setOverflowMenu(null); requestAnimationFrame(() => { if (!coverInputRef.current) return; coverInputRef.current.value = ''; coverInputRef.current.click() }) }
  const openTagCoverPicker = (id: string) => { setTagCoverTargetId(id); setPlaylistCoverTargetId(null); setOverflowMenu(null); requestAnimationFrame(() => { if (!coverInputRef.current) return; coverInputRef.current.value = ''; coverInputRef.current.click() }) }
  const changeObjectCover = (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (playlistCoverTargetId) {
      const playlist = playlists.find((item) => item.id === playlistCoverTargetId)
      if (playlist) setCoverEditorDraft({ kind: 'playlist', id: playlist.id, file, scale: playlist.coverScale ?? 1, x: playlist.coverX ?? 0, y: playlist.coverY ?? 0, background: playlist.coverBackground ?? '#111827' })
    } else if (tagCoverTargetId) {
      const tag = tags.find((item) => item.id === tagCoverTargetId)
      if (tag) setCoverEditorDraft({ kind: 'tag', id: tag.id, file, scale: tag.coverScale ?? 1, x: tag.coverX ?? 0, y: tag.coverY ?? 0, background: tag.coverBackground ?? '#111827' })
    }
    setPlaylistCoverTargetId(null); setTagCoverTargetId(null)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }
  const applyCoverEditor = async (value: CoverEditorValue) => {
    if (!coverEditorDraft) return
    if (coverEditorDraft.kind === 'playlist') {
      const playlist = playlists.find((item) => item.id === coverEditorDraft.id)
      if (playlist) await updatePlaylist({ ...playlist, cover: value.file, coverScale: value.scale, coverX: value.x, coverY: value.y, coverBackground: value.background, lastUsedAt: Date.now() }, true)
    } else {
      const tag = tags.find((item) => item.id === coverEditorDraft.id)
      if (tag) await updateTag({ ...tag, cover: value.file, coverScale: value.scale, coverX: value.x, coverY: value.y, coverBackground: value.background, lastUsedAt: Date.now() }, true)
    }
    setCoverEditorDraft(null)
  }
  const confirmDeletePlaylist = async () => { if (!playlistToDelete) return; const trashed = { ...playlistToDelete, trashedAt: Date.now() }; await savePlaylist(trashed); setPlaylists((items) => items.filter((playlist) => playlist.id !== playlistToDelete.id)); setTrashedPlaylists((items) => [trashed, ...items.filter((playlist) => playlist.id !== trashed.id)]); if (activePlaylistId === playlistToDelete.id) navigateTo({ view: 'library', playlistId: null, detailOpen: false }); setPlaylistToDelete(null) }

  const beginReorder = (scope: Exclude<ReorderScope, null>) => { if (scope === 'library' || scope === 'playlist') setSearchQuery(''); if (scope === 'sidebar') { setPlaylistsCollapsed(false); setPlaylistSortMode('manual') } if (scope === 'tags') { setTagsCollapsed(false); setTagSortMode('manual') } setReorderScope(scope); setMoveCandidate(null); setOverflowMenu(null); if (scope !== 'tags' && scope !== 'sidebar') setSortMode('manual') }
  const finishReorder = () => {
    cleanupBundleSingletons()
    if (reorderScope === 'sidebar') snapshotActiveSortSave('playlist')
    else if (reorderScope === 'tags') snapshotActiveSortSave('tag')
    else if (reorderScope === 'library' || reorderScope === 'playlist') snapshotActiveSortSave('song')
    setReorderScope(null); setMoveCandidate(null)
  }
  const reorderIds = (ids: string[], sourceId: string, targetIndex: number) => { const sourceIndex = ids.indexOf(sourceId); if (sourceIndex < 0) return ids; const next = [...ids]; const [moved] = next.splice(sourceIndex, 1); next.splice(Math.max(0, Math.min(targetIndex > sourceIndex ? targetIndex - 1 : targetIndex, next.length)), 0, moved); return next }
  const confirmPendingMove = async () => {
    if (!moveCandidate || moveCandidate.targetIndex === null) return; recordHistory()
    if (moveCandidate.kind === 'playlist') {
      const ids = reorderIds(sidebarPlaylists.map((playlist) => playlist.id), moveCandidate.id, moveCandidate.targetIndex); const order = new Map(ids.map((id, index) => [id, index])); const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: order.get(playlist.id) ?? playlist.sortOrder })); setPlaylists(updated); await Promise.all(updated.map(savePlaylist))
    } else if (moveCandidate.kind === 'tag') {
      const ids = reorderIds(sidebarTags.map((tag) => tag.id), moveCandidate.id, moveCandidate.targetIndex); const order = new Map(ids.map((id, index) => [id, index])); const updated = tags.map((tag) => ({ ...tag, sortOrder: order.get(tag.id) ?? tag.sortOrder })); setTags(updated); await Promise.all(updated.map(saveTag))
    } else if (reorderScope === 'playlist' && activePlaylist) await updatePlaylist({ ...activePlaylist, songIds: reorderIds(activePlaylist.songIds, moveCandidate.id, moveCandidate.targetIndex) })
    else { const ids = reorderIds(songs.map((song) => song.id), moveCandidate.id, moveCandidate.targetIndex); const byId = new Map(songs.map((song) => [song.id, song])); const updated = ids.map((id, index) => ({ ...byId.get(id)!, libraryOrder: index })); setSongs(updated); await saveSongOrder(updated) }
    setMoveCandidate(null)
  }
  const renderDropZone = (index: number, kind: 'song' | 'playlist' | 'tag') => !moveCandidate || moveCandidate.kind !== kind ? null : <button className={`drop-zone${moveCandidate.targetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setMoveCandidate({ ...moveCandidate, targetIndex: index })}><span /></button>

  const membershipText = (songId: string) => { const names = playlists.filter((playlist) => playlist.songIds.includes(songId)).map((playlist) => playlist.name); return names.length ? names.join(' · ') : 'In keiner Playlist' }
  const songTags = (songId: string) => tags.filter((tag) => tag.songIds.includes(songId))
  const playlistTags = (playlistId: string) => tags.filter((tag) => tag.playlistIds.includes(playlistId))
  const groupTags = (groupId: string) => tags.filter((tag) => (tag.groupIds ?? []).includes(groupId))
  const openTagChooser = (kind: 'song' | 'playlist' | 'group', ids: string[]) => { setChooserSearch(''); setChooserSortMode('manual'); setChooserSortDirection('down'); setTagChooserOriginalSnapshot(snapshot()); setTagChooserDirty(false); setTagChooserTarget({ kind, ids }); setOverflowMenu(null); setSortMenuOpen(false) }
  const closeTagChooser = async (apply: boolean) => {
    const original = tagChooserOriginalSnapshot
    if (!apply && tagChooserDirty && original) await restoreSnapshot(original)
    if (apply && tagChooserDirty && original) { setUndoStack((items) => [...items, original].slice(-50)); setRedoStack([]) }
    setTagChooserTarget(null); setTagChooserOriginalSnapshot(null); setTagChooserDirty(false); setChooserSearch('')
  }
  const toggleTargetTag = async (tag: Tag) => {
    if (!tagChooserTarget?.ids.length) return
    const memberIds = tagChooserTarget.kind === 'song' ? tag.songIds : tagChooserTarget.kind === 'playlist' ? tag.playlistIds : (tag.groupIds ?? [])
    const allAssigned = tagChooserTarget.ids.every((id) => memberIds.includes(id))
    if (tagChooserTarget.kind === 'group') {
      const nextIds = allAssigned ? memberIds.filter((id) => !tagChooserTarget.ids.includes(id)) : [...new Set([...memberIds, ...tagChooserTarget.ids])]
      setTagChooserDirty(true)
      await updateTag({ ...tag, groupIds: nextIds, lastUsedAt: Date.now() })
      return
    }
    if (allAssigned) {
      setTagChooserDirty(true)
      if (tagChooserTarget.kind === 'song') await updateTag({ ...tag, songIds: tag.songIds.filter((id) => !tagChooserTarget.ids.includes(id)), lastUsedAt: Date.now() })
      else await updateTag({ ...tag, playlistIds: tag.playlistIds.filter((id) => !tagChooserTarget.ids.includes(id)), lastUsedAt: Date.now() })
      return
    }
    const ids = tagChooserTarget.ids.filter((id) => !memberIds.includes(id))
    requestDuplicateAction({ kind: 'tag-add', tagId: tag.id, targetKind: tagChooserTarget.kind, ids })
  }
  const removeSongFromActiveTag = async (songId: string) => { if (!activeTag) return; await updateTag({ ...activeTag, songIds: activeTag.songIds.filter((id) => id !== songId), lastUsedAt: Date.now() }, true) }
  const startSelection = (initialIds: string[] = []) => { setSelectionMode(true); setSelectedSongIds(new Set(initialIds)); setSortMenuOpen(false); setBulkMoveMode(false); setBulkMoveContext(null) }
  const finishSelection = () => { setSelectionMode(false); setSelectedSongsListOpen(false); setSelectedSongsMenuOpen(false); setSelectedSongsFocusId(null); setSelectionObjectEditMode(null); setSelectionObjectDraftIds(new Set()); setSortMenuOpen(false); setChooserSearch('') }
  const stopSelection = () => { setSelectionMode(false); setSelectedSongIds(new Set()); setPlaylistChooserMode(null); setPlaylistChooserDraftIds(new Set()); setSelectedSongsListOpen(false); setSelectedSongsMenuOpen(false); setSelectedSongsFocusId(null); setSelectionObjectEditMode(null); setSelectionObjectDraftIds(new Set()); setSortMenuOpen(false); setBulkMoveMode(false); setBulkMoveContext(null); setSelectionConfirmation(null) }
  const runFocusedSelectedSongAction = (action: 'move' | 'arrow' | 'line') => {
    const id = selectedSongsFocusId
    if (!id || !selectedSongIds.has(id)) return
    const focused = new Set([id])
    setSelectedSongIds(focused)
    setSelectedSongsMenuOpen(false)
    setSelectedSongsListOpen(false)
    if (action === 'arrow') beginReorder(activePlaylist ? 'playlist' : 'library')
    else beginSelectedMove(focused)
  }
  const restoreSelectionSourceView = () => {
    if (!selectionSourceReturn) return
    setView(selectionSourceReturn.view)
    setActivePlaylistId(selectionSourceReturn.playlistId)
    setActiveTagId(selectionSourceReturn.tagId ?? null)
    setDetailOpen(selectionSourceReturn.detailOpen)
    setSelectionSourceReturn(null)
  }
  const closeSelectionSource = () => {
    setSelectionSourceKind(null); setSelectionSourceId(null); setChooserSearch('')
    restoreSelectionSourceView()
  }
  const openSelectionSource = (kind: Exclude<SelectionSourceKind, null>) => {
    setSelectionSourceReturn({ view, playlistId: activePlaylistId, tagId: activeTagId, detailOpen })
    setSelectionSourceKind(kind); setSelectionSourceId(null); setChooserSearch(''); setSortMenuOpen(false)
    if (kind === 'group') { setView('library'); setActivePlaylistId(null); setActiveTagId(null); setDetailOpen(false) }
    if (kind === 'playlist') setPlaylistsCollapsed(false)
    if (kind === 'tag') setTagsCollapsed(false)
  }
  const applySelectionSourceById = (kind: Exclude<SelectionSourceKind, null>, id: string) => {
    const existingIds = new Set(songs.map((song) => song.id))
    let ids: string[] = []
    if (kind === 'group') {
      const group = objectGroups.find((item) => item.id === id && item.kind === 'song')
      if (group) ids = deepGroupItemIds(group)
    } else if (kind === 'playlist') ids = playlists.find((item) => item.id === id)?.songIds ?? []
    else ids = tags.find((item) => item.id === id)?.songIds ?? []
    const selected = [...new Set(ids.filter((songId) => existingIds.has(songId)))]
    setSelectionMode(true)
    setSelectedSongIds(new Set(selected))
    setSelectionSourceKind(null); setSelectionSourceId(null); setChooserSearch('')
    restoreSelectionSourceView()
    setMessage(selected.length ? `${selected.length} ${selected.length === 1 ? 'Lied wurde' : 'Lieder wurden'} ausgewählt.` : 'Daraus gibt es keine vorhandenen Lieder.')
  }
  const openSelectionObjectEdit = (mode: Exclude<SelectionObjectEditMode, null>) => { setSelectionObjectEditMode(mode); setSelectionObjectDraftIds(new Set()); setChooserSearch(''); setChooserSortMode('manual'); setChooserSortDirection('down'); setSelectedSongsMenuOpen(false) }
  const toggleSelectionObjectDraft = (id: string) => setSelectionObjectDraftIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const applySelectionObjectEdit = () => {
    if (!selectionObjectEditMode) return
    setSelectedSongIds((current) => {
      const next = new Set(current)
      selectionObjectDraftIds.forEach((id) => selectionObjectEditMode === 'add' ? next.add(id) : next.delete(id))
      return next
    })
    setSelectionObjectEditMode(null); setSelectionObjectDraftIds(new Set()); setChooserSearch('')
  }
  const selectedMoveParent = (ids: Set<string> = selectedSongIds) => {
    const selected = [...ids]
    if (!selected.length) return { valid: false, parentGroupId: undefined as string | undefined }
    const memberships = selected.map((id) => objectGroups.filter((group) => group.kind === 'song' && group.itemIds.includes(id)).map((group) => group.id))
    if (memberships.some((ids) => ids.length > 1)) return { valid: false, parentGroupId: undefined as string | undefined }
    const first = memberships[0][0]
    if (memberships.some((ids) => ids[0] !== first)) return { valid: false, parentGroupId: undefined as string | undefined }
    return { valid: true, parentGroupId: first }
  }
  const beginSelectedMove = (ids: Set<string> = selectedSongIds) => {
    setSortMenuOpen(false); setSelectedSongsMenuOpen(false); setSelectedSongsListOpen(false)
    if (!ids.size || view !== 'library') return
    if (searchQuery.trim()) setSearchQuery('')
    const visibleIds = new Set(visibleSongs.map((song) => song.id))
    if ([...ids].some((id) => !visibleIds.has(id))) { setMessage('Zum gemeinsamen Bewegen müssen alle ausgewählten Lieder in der aktuell geöffneten Liste sichtbar sein.'); return }
    const context = selectedMoveParent(ids)
    if (!context.valid) { setMessage('Die ausgewählten Lieder liegen auf verschiedenen Gruppenebenen. Wähle für einen gemeinsamen Strich nur Lieder derselben Ebene.'); return }
    if (context.parentGroupId) updateObjectGroup(context.parentGroupId, (group) => ({ ...group, sortMode: 'manual' }))
    else setSortMode('manual')
    setBulkMoveContext({ parentGroupId: context.parentGroupId })
    setBulkMoveMode(true)
  }
  const finishSelectedMove = () => { setBulkMoveMode(false); setBulkMoveContext(null); snapshotActiveSortSave('song') }
  const moveSelectedToIndex = async (targetIndex: number) => {
    if (!bulkMoveMode || !bulkMoveContext || !selectedSongIds.size || view !== 'library') return
    const parentGroupId = bulkMoveContext.parentGroupId
    const baseTokens = containerBaseTokensFor('song', parentGroupId)
    const key = parentGroupId ? groupContainerKey('song', parentGroupId) : rootContainerKey('song')
    const order = orderedTokensForContainer(key, baseTokens, true)
    const movingTokens = order.filter((token) => !isGroupToken(token) && selectedSongIds.has(tokenId(token)))
    if (!movingTokens.length) return
    const movingSet = new Set(movingTokens)
    const removedBeforeTarget = order.slice(0, targetIndex).filter((token) => movingSet.has(token)).length
    const remaining = order.filter((token) => !movingSet.has(token))
    const insertAt = Math.max(0, Math.min(remaining.length, targetIndex - removedBeforeTarget))
    const nextOrder = [...remaining.slice(0, insertAt), ...movingTokens, ...remaining.slice(insertAt)]
    recordHistory()
    setMixedOrders((current) => ({ ...current, [key]: nextOrder }))
    await persistRelativeOrder('song', nextOrder, parentGroupId)
    const active = activeSortSave('song')
    if (active) setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders: { ...save.orders, [key]: nextOrder } } : save))
    setMessage('Auswahl wurde als Block bewegt. Die Reihenfolge der ausgewählten Lieder blieb erhalten.')
  }
  const renderBulkMoveDropZone = (parentGroupId: string | undefined, index: number) => {
    if (!bulkMoveMode || !bulkMoveContext || (bulkMoveContext.parentGroupId ?? undefined) !== (parentGroupId ?? undefined)) return null
    return <button className="drop-zone bulk-move-zone" type="button" onClick={() => void moveSelectedToIndex(index)} aria-label="Auswahl hierhin bewegen"><span /></button>
  }
  const deleteSelectedSongs = async () => {
    const ids = new Set(selectedSongIds)
    if (!ids.size) return
    const deletedAt = Date.now()
    const movingToTrash = songs.filter((song) => ids.has(song.id)).map((song) => ({ ...song, trashedAt: deletedAt, trashPlaylistIds: playlists.filter((playlist) => playlist.songIds.includes(song.id)).map((playlist) => playlist.id) }))
    await Promise.all(movingToTrash.map(saveSong))
    const affected = playlists.filter((playlist) => playlist.songIds.some((id) => ids.has(id))).map((playlist) => ({ ...playlist, songIds: playlist.songIds.filter((id) => !ids.has(id)) }))
    if (affected.length) await Promise.all(affected.map(savePlaylist))
    setPlaylists((items) => items.map((playlist) => affected.find((changed) => changed.id === playlist.id) ?? playlist))
    setSongs((items) => items.filter((song) => !ids.has(song.id)))
    setTrashedSongs((items) => [...movingToTrash, ...items.filter((song) => !ids.has(song.id))])
    if (currentSongId && ids.has(currentSongId)) { audioRef.current?.pause(); overlapAudioRef.current?.pause(); setCurrentSongId(null); setCurrentUrl(null); setCurrentTime(0); setDuration(0) }
    setSelectionConfirmation(null)
    stopSelection()
  }
  const setRepeatRemainingNow = (value: number | null) => { repeatRemainingRef.current = value; setRepeatRemaining(value) }
  const consumeRepeat = () => { const current = Math.max(0, repeatRemainingRef.current ?? 0); const next = Math.max(0, current - 1); setRepeatRemainingNow(next); return next }
  const restartFinishedAudio = (audio: HTMLAudioElement) => { cancelLoopTransition(); const other = otherPlaybackAudio(audio); other?.pause(); playbackAudioRef.current = audio; audio.currentTime = 0; setCurrentTime(0); requestAnimationFrame(() => void audio.play().catch(() => setMessage('Die Wiederholung konnte nicht gestartet werden.'))) }
  const clearRepeatHold = () => {
    if (repeatHoldTimerRef.current !== null) window.clearTimeout(repeatHoldTimerRef.current)
    repeatHoldTimerRef.current = null
  }
  const beginRepeatHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    clearRepeatHold()
    repeatHoldTriggeredRef.current = false
    repeatHoldTimerRef.current = window.setTimeout(() => {
      repeatHoldTriggeredRef.current = true
      repeatHoldTimerRef.current = null
      setRepeatMenuOpen(true)
    }, 650)
  }
  const endRepeatHold = () => clearRepeatHold()
  const handleRepeatClick = () => {
    if (repeatHoldTriggeredRef.current) { repeatHoldTriggeredRef.current = false; return }
    clearRepeatHold()
    if (repeatSetting) { setRepeatSetting(null); setRepeatRemainingNow(null); setRepeatQueue(false); return }
    setRepeatQueue((value) => !value)
  }
  const chooseInfiniteRepeat = () => { setRepeatSetting({ kind: 'infinite' }); setRepeatRemainingNow(null); setRepeatQueue(false); setRepeatMenuOpen(false) }
  const chooseCountRepeat = () => {
    const count = Math.max(1, Math.min(9999, Math.floor(Number(repeatCountInput) || 1)))
    setRepeatCountInput(String(count)); setRepeatSetting({ kind: 'count', count }); setRepeatRemainingNow(count); setRepeatQueue(false); setRepeatMenuOpen(false)
  }
  const selectAllVisible = () => setSelectedSongIds(new Set(visibleSongs.map((song) => song.id)))
  const selectedLoopSongs = songs.filter((song) => selectedSongIds.has(song.id) && hasLoop(song))
  const selectionContainsOnlyLoops = selectedSongIds.size > 0 && selectedLoopSongs.length === selectedSongIds.size
  const openPlaylistChooser = (mode: Exclude<PlaylistChooserMode, null>) => {
    setChooserSortMode('manual'); setChooserSortDirection('down'); setChooserSearch('')
    setPlaylistChooserMode(mode)
    setPlaylistChooserDraftIds(mode === 'current' && currentSong ? new Set(playlists.filter((playlist) => playlist.songIds.includes(currentSong.id)).map((playlist) => playlist.id)) : new Set())
  }
  const togglePlaylistChooserDraft = (id: string) => setPlaylistChooserDraftIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const closePlaylistChooser = () => { setPlaylistChooserMode(null); setPlaylistChooserDraftIds(new Set()); setChooserSearch('') }
  const applyPlaylistChooser = async () => {
    if (!playlistChooserMode) return
    let changed: Playlist[] = []
    if (playlistChooserMode === 'bulk') {
      const selected = [...selectedSongIds]
      if (selected.length && playlistChooserDraftIds.size) {
        changed = playlists.filter((playlist) => playlistChooserDraftIds.has(playlist.id)).map((playlist) => {
          const songIds = [...playlist.songIds]
          selected.forEach((id) => { if (!songIds.includes(id)) songIds.push(id) })
          return { ...playlist, songIds, lastUsedAt: Date.now() }
        }).filter((playlist) => {
          const previous = playlists.find((item) => item.id === playlist.id)
          return previous ? previous.songIds.length !== playlist.songIds.length : false
        })
      }
    } else if (currentSong) {
      changed = playlists.map((playlist) => {
        const shouldContain = playlistChooserDraftIds.has(playlist.id)
        const contains = playlist.songIds.includes(currentSong.id)
        if (shouldContain === contains) return playlist
        return { ...playlist, songIds: shouldContain ? [...playlist.songIds, currentSong.id] : playlist.songIds.filter((id) => id !== currentSong.id), lastUsedAt: Date.now() }
      }).filter((playlist, index) => playlist !== playlists[index])
    }
    if (changed.length) {
      recordHistory()
      const replacements = new Map(changed.map((playlist) => [playlist.id, playlist]))
      setPlaylists((items) => items.map((playlist) => replacements.get(playlist.id) ?? playlist))
      await Promise.all(changed.map(savePlaylist))
    }
    const bulk = playlistChooserMode === 'bulk'
    closePlaylistChooser()
    if (bulk) finishSelection()
  }
  const applyManualLoopChange = async (ids: string[], enabled: boolean) => {
    const targets = songs.filter((song) => ids.includes(song.id) && hasLoop(song))
    if (!targets.length) return
    if (!enabled && targets.some((song) => song.id === currentSongId)) cancelLoopTransition()
    recordHistory()
    const replacements = new Map(targets.map((song) => [song.id, { ...song, loopEnabled: enabled }]))
    const nextSongs = songs.map((song) => replacements.get(song.id) ?? song)
    await Promise.all(targets.map((song) => saveSong({ ...song, loopEnabled: enabled })))
    setSongs(nextSongs)
    setOverflowMenu(null); setSortMenuOpen(false)
  }
  const requestManualLoopChange = async (ids: string[], enabled: boolean) => {
    const validIds = ids.filter((id) => hasLoop(songs.find((song) => song.id === id)))
    if (!validIds.length) return
    if (loopActivationMode !== 'manual') { setLoopManualRequest({ ids: validIds, enabled }); setOverflowMenu(null); setSortMenuOpen(false); return }
    await applyManualLoopChange(validIds, enabled)
  }
  const toggleSongLoop = async (id: string) => { const song = songs.find((item) => item.id === id); if (!hasLoop(song)) return; await requestManualLoopChange([id], !isLoopActive(song)) }
  const toggleCurrentLoop = async () => { if (!hasLoop(currentSong)) return; await requestManualLoopChange([currentSong!.id], !isLoopActive(currentSong)) }
  const removeCurrentLoop = async () => { if (!currentSong || currentSong.loopStart === undefined || currentSong.loopEnd === undefined) return; await updateSong({ ...currentSong, trashedLoop: { deletedAt: Date.now(), start: currentSong.loopStart, end: currentSong.loopEnd, enabled: Boolean(currentSong.loopEnabled), markers: currentSong.loopMarkers ? [...currentSong.loopMarkers] : undefined }, loopStart: undefined, loopEnd: undefined, loopConfidence: undefined, loopEnabled: false, loopMarkers: undefined }); setLoopConfirmation(null) }

  const restoreTrashedSong = async (song: Song) => {
    const wantedPlaylists = song.trashPlaylistIds ?? []
    const activeIds = new Set(playlists.map((playlist) => playlist.id))
    const remainingIds = wantedPlaylists.filter((id) => !activeIds.has(id))
    const restored = { ...song, trashedAt: undefined, trashPlaylistIds: remainingIds.length ? remainingIds : undefined }
    await saveSong(restored)
    const changedPlaylists = playlists.map((playlist) => wantedPlaylists.includes(playlist.id) && !playlist.songIds.includes(song.id) ? { ...playlist, songIds: [...playlist.songIds, song.id] } : playlist)
    await Promise.all(changedPlaylists.filter((playlist, index) => playlist !== playlists[index]).map(savePlaylist))
    setPlaylists(changedPlaylists)
    setTrashedSongs((items) => items.filter((item) => item.id !== song.id))
    setSongs((items) => [...items, restored].sort((a, b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt)))
  }
  const restoreTrashedTag = async (tag: Tag) => { const restored = { ...tag, trashedAt: undefined }; await saveTag(restored); setTrashedTags((items) => items.filter((item) => item.id !== tag.id)); setTags((items) => [...items, restored]) }
  const restoreTrashedPlaylist = async (playlist: Playlist) => {
    const waitingSongs = songs.filter((song) => song.trashPlaylistIds?.includes(playlist.id))
    const restored = { ...playlist, trashedAt: undefined, songIds: [...playlist.songIds, ...waitingSongs.map((song) => song.id).filter((id) => !playlist.songIds.includes(id))] }
    await savePlaylist(restored)
    const updatedSongs = songs.map((song) => song.trashPlaylistIds?.includes(playlist.id) ? { ...song, trashPlaylistIds: (() => { const remaining = song.trashPlaylistIds.filter((id) => id !== playlist.id); return remaining.length ? remaining : undefined })() } : song)
    await Promise.all(updatedSongs.filter((song, index) => song !== songs[index]).map(saveSong))
    setSongs(updatedSongs)
    setTrashedPlaylists((items) => items.filter((item) => item.id !== playlist.id))
    setPlaylists((items) => [restored, ...items])
  }
  const restoreTrashedLoop = async (song: Song) => { if (!song.trashedLoop) return; const loop = song.trashedLoop; await updateSong({ ...song, loopStart: loop.start, loopEnd: loop.end, loopEnabled: loop.enabled, loopMarkers: loop.markers ? [...loop.markers] : undefined, trashedLoop: undefined }); }
  const emptyTrash = async () => {
    const deletedSongIds = new Set(trashedSongs.map((song) => song.id)); const deletedPlaylistIds = new Set(trashedPlaylists.map((playlist) => playlist.id))
    const cleanedTags = tags.map((tag) => ({ ...tag, songIds: tag.songIds.filter((id) => !deletedSongIds.has(id)), playlistIds: tag.playlistIds.filter((id) => !deletedPlaylistIds.has(id)) }))
    await Promise.all(cleanedTags.filter((tag, index) => tag.songIds.length !== tags[index].songIds.length || tag.playlistIds.length !== tags[index].playlistIds.length).map(saveTag)); setTags(cleanedTags)
    await Promise.all(trashedSongs.map((song) => deleteSong(song.id)))
    await Promise.all(trashedPlaylists.map((playlist) => deletePlaylist(playlist.id)))
    await Promise.all(trashedTags.map((tag) => deleteTag(tag.id)))
    const loopTrashSongs = songs.filter((song) => song.trashedLoop)
    if (loopTrashSongs.length) await Promise.all(loopTrashSongs.map((song) => saveSong({ ...song, trashedLoop: undefined })))
    setSongs((items) => items.map((song) => song.trashedLoop ? { ...song, trashedLoop: undefined } : song))
    setTrashedSongs([]); setTrashedPlaylists([]); setTrashedTags([]); setTrashConfirmation(false)
  }
  const sortSavesFor = (kind: SortSaveKind) => sortSaves.filter((save) => save.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }))
  const activeSortSave = (kind: SortSaveKind) => sortSavesFor(kind).find((save) => save.id === activeSortSaveIds[kind]) ?? sortSavesFor(kind)[0] ?? null
  const sortModeFor = (kind: SortSaveKind) => kind === 'song' ? sortMode : kind === 'playlist' ? playlistSortMode : tagSortMode
  const setSortModeFor = (kind: SortSaveKind, mode: SortMode) => {
    if (kind === 'song') setSortMode(mode)
    else if (kind === 'playlist') setPlaylistSortMode(mode)
    else setTagSortMode(mode)
  }
  const nextSortSaveName = (kind: SortSaveKind) => {
    const used = new Set(sortSavesFor(kind).map((save) => {
      const match = save.name.trim().match(/^Save\s+(\d+)$/i)
      return match ? Number(match[1]) : 0
    }).filter(Boolean))
    let value = 1
    while (used.has(value)) value += 1
    return `Save ${value}`
  }
  const currentRootOrderFor = (kind: SortSaveKind) => kind === 'song' ? songRootOrder : kind === 'playlist' ? playlistRootOrder : tagRootOrder
  const captureSortOrders = (kind: SortSaveKind) => {
    const prefix = `${kind}:`
    const orders = Object.fromEntries(Object.entries(mixedOrders).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, [...value]]))
    orders[rootContainerKey(kind)] = [...currentRootOrderFor(kind)]
    return orders
  }
  const snapshotActiveSortSave = (kind: SortSaveKind) => {
    if (sortModeFor(kind) !== 'manual') return
    const active = activeSortSave(kind)
    if (!active) return
    const orders = captureSortOrders(kind)
    setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders } : save))
  }
  const applySortSave = (kind: SortSaveKind, saveId: string) => {
    const save = sortSaves.find((item) => item.kind === kind && item.id === saveId)
    if (!save) return
    if (sortModeFor(kind) === 'manual' && activeSortSave(kind)?.id !== saveId) snapshotActiveSortSave(kind)
    setActiveSortSaveIds((current) => ({ ...current, [kind]: saveId }))
    setMixedOrders((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${kind}:`)))
      return { ...next, ...Object.fromEntries(Object.entries(save.orders).map(([key, value]) => [key, [...value]])) }
    })
    setSortModeFor(kind, 'manual')
  }
  const changeSortSelection = (kind: SortSaveKind, value: string) => {
    if (value.startsWith('save:')) { applySortSave(kind, value.slice(5)); return }
    if (sortModeFor(kind) === 'manual') snapshotActiveSortSave(kind)
    setSortModeFor(kind, value.replace('auto:', '') as SortMode)
  }
  const openSortSaveDialog = (kind: SortSaveKind) => {
    setSortSaveName('')
    setSortSaveDialogTarget(kind)
    setSortMenuOpen(false)
    setSidebarSortTarget(null)
  }
  const saveCurrentSort = () => {
    const kind = sortSaveDialogTarget
    if (!kind) return
    if (sortModeFor(kind) === 'manual') snapshotActiveSortSave(kind)
    const requested = sortSaveName.trim()
    const name = requested || nextSortSaveName(kind)
    if (sortSavesFor(kind).some((save) => save.name.localeCompare(name, 'de', { sensitivity: 'base' }) === 0)) {
      setMessage(`Ein Save mit dem Namen „${name}“ existiert bereits.`)
      return
    }
    const orders = captureSortOrders(kind)
    const save: SortSave = { id: crypto.randomUUID(), kind, name, orders, createdAt: Date.now() }
    setSortSaves((current) => [...current, save])
    setActiveSortSaveIds((current) => ({ ...current, [kind]: save.id }))
    setMixedOrders((current) => ({ ...current, ...orders }))
    setSortModeFor(kind, 'manual')
    setSortSaveDialogTarget(null)
    setSortSaveName('')
    setMessage(`„${name}“ wurde gespeichert.`)
  }
  const openSortSaveRename = (save: SortSave) => {
    setSortSaveRenameId(save.id)
    setSortSaveRenameValue(save.name)
    setSortMenuOpen(false)
  }
  const confirmSortSaveRename = (event: React.FormEvent) => {
    event.preventDefault()
    const value = sortSaveRenameValue.trim()
    const save = sortSaves.find((item) => item.id === sortSaveRenameId)
    if (!save || !value) return
    if (sortSavesFor(save.kind).some((item) => item.id !== save.id && item.name.localeCompare(value, 'de', { sensitivity: 'base' }) === 0)) {
      setMessage(`Ein Save mit dem Namen „${value}“ existiert bereits.`)
      return
    }
    setSortSaves((current) => current.map((item) => item.id === save.id ? { ...item, name: value } : item))
    setSortSaveRenameId(null)
    setSortSaveRenameValue('')
  }
  const beginSortSaveHold = (save: SortSave) => {
    if (sortSaveHoldTimerRef.current !== null) window.clearTimeout(sortSaveHoldTimerRef.current)
    sortSaveLongPressRef.current = false
    sortSaveHoldTimerRef.current = window.setTimeout(() => {
      sortSaveLongPressRef.current = true
      openSortSaveRename(save)
      sortSaveHoldTimerRef.current = null
    }, 650)
  }
  const endSortSaveHold = () => {
    if (sortSaveHoldTimerRef.current !== null) window.clearTimeout(sortSaveHoldTimerRef.current)
    sortSaveHoldTimerRef.current = null
  }
  const activateSortSaveButton = (save: SortSave) => {
    if (sortSaveLongPressRef.current) { sortSaveLongPressRef.current = false; return }
    applySortSave(save.kind, save.id)
  }


  const globalSortForKind = (kind: GroupKind) => kind === 'song' ? { mode: sortMode, direction: sortDirection } : kind === 'playlist' ? { mode: playlistSortMode, direction: playlistSortDirection } : { mode: tagSortMode, direction: tagSortDirection }
  const itemDuration = (kind: GroupKind, id: string) => {
    if (kind === 'song') return songs.find((song) => song.id === id)?.duration ?? 0
    if (kind === 'playlist') return (playlists.find((playlist) => playlist.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.duration ?? 0), 0)
    return (tags.find((tag) => tag.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.duration ?? 0), 0)
  }
  const itemPlays = (kind: GroupKind, id: string) => {
    if (kind === 'song') return songs.find((song) => song.id === id)?.completedPlays ?? 0
    if (kind === 'playlist') return (playlists.find((playlist) => playlist.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.completedPlays ?? 0), 0)
    return (tags.find((tag) => tag.id === id)?.songIds ?? []).reduce((sum, songId) => sum + (songs.find((song) => song.id === songId)?.completedPlays ?? 0), 0)
  }
  const itemSongCount = (kind: GroupKind, id: string) => kind === 'song' ? 1 : kind === 'playlist' ? (playlists.find((playlist) => playlist.id === id)?.songIds.length ?? 0) : (tags.find((tag) => tag.id === id)?.songIds.filter((songId) => songs.some((song) => song.id === songId)).length ?? 0)
  const objectFor = (kind: GroupKind, id: string): Song | Playlist | Tag | null => kind === 'song' ? songs.find((song) => song.id === id) ?? null : kind === 'playlist' ? playlists.find((playlist) => playlist.id === id) ?? null : tags.find((tag) => tag.id === id) ?? null
  const objectColorKey = (kind: GroupKind, id: string) => `${kind}:${id}`
  const objectSurfaceColor = (kind: GroupKind, id: string) => objectColors[objectColorKey(kind, id)]
  const readableSurfaceText = (color: string) => { const match = color.match(/^#([0-9a-f]{6})$/i); if (!match) return '#111827'; const value = Number.parseInt(match[1], 16); const r = (value >> 16) & 255; const g = (value >> 8) & 255; const b = value & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 158 ? '#111827' : '#f8fafc' }
  const surfaceStyle = (color?: string) => color ? ({ '--custom-surface': color, '--custom-text': readableSurfaceText(color) } as React.CSSProperties) : undefined
  const openAppearanceColor = (kind: GroupKind | 'group', id: string) => { setAppearanceColorTarget({ kind, id }); setOverflowMenu(null) }
  const appearanceInitialColor = () => { if (!appearanceColorTarget) return '#f8fafc'; if (appearanceColorTarget.kind === 'group') return objectGroups.find((group) => group.id === appearanceColorTarget.id)?.color ?? '#f8fafc'; return objectSurfaceColor(appearanceColorTarget.kind, appearanceColorTarget.id) ?? '#202431' }
  const applyAppearanceColor = (color: string) => { if (!appearanceColorTarget) return; recordHistory(); if (appearanceColorTarget.kind === 'group') setObjectGroups((current) => current.map((group) => group.id === appearanceColorTarget.id ? { ...group, color } : group)); else setObjectColors((current) => ({ ...current, [objectColorKey(appearanceColorTarget.kind as GroupKind, appearanceColorTarget.id)]: color })); setAppearanceColorTarget(null) }
  const compareObjects = (kind: GroupKind, a: Song | Playlist | Tag, b: Song | Playlist | Tag, mode: SortMode) => {
    if (mode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
    if (mode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
    if (mode === 'plays') return itemPlays(kind, a.id) - itemPlays(kind, b.id) || a.name.localeCompare(b.name, 'de')
    if (mode === 'duration') return (kind === 'song' ? itemDuration(kind, a.id) - itemDuration(kind, b.id) : itemSongCount(kind, a.id) - itemSongCount(kind, b.id)) || a.name.localeCompare(b.name, 'de')
    const aTime = kind === 'song' ? (a as Song).addedAt : (a as Playlist | Tag).createdAt
    const bTime = kind === 'song' ? (b as Song).addedAt : (b as Playlist | Tag).createdAt
    return aTime - bTime
  }
  const chooserLabelsFor = (kind: GroupKind) => kind === 'song' ? sortLabels : kind === 'playlist' ? playlistSortLabels : tagSortLabels
  const chooserManualLabel = (kind: GroupKind) => activeSortSave(kind)?.name ?? 'Save'
  const chooserManualRanks = (kind: GroupKind) => {
    const itemRank = new Map<string, number>()
    const groupRank = new Map<string, number>()
    let rank = 0
    const save = activeSortSave(kind)
    const allowed: Array<Song | Playlist | Tag> = kind === 'song'
      ? manualQueue
      : kind === 'playlist'
        ? [...playlists].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.createdAt - b.createdAt)
        : [...tags].sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
    const allowedIds = new Set(allowed.map((item) => item.id))
    const orderFor = (key: string, baseTokens: string[]) => {
      const valid = new Set(baseTokens)
      const stored = (save?.orders[key] ?? mixedOrders[key] ?? []).filter((token) => valid.has(token))
      const known = new Set(stored)
      return [...stored, ...baseTokens.filter((token) => !known.has(token))]
    }
    const visit = (parentGroupId?: string) => {
      const children = objectGroups
        .filter((group) => group.kind === kind && (group.parentGroupId ?? undefined) === parentGroupId)
        .filter((group) => {
          const ids = deepGroupItemIds(group)
          return ids.length === 0 || ids.some((id) => allowedIds.has(id))
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
      const childIds = new Set(children.flatMap((group) => deepGroupItemIds(group)))
      const items = parentGroupId
        ? (objectGroups.find((group) => group.id === parentGroupId)?.itemIds ?? []).map((id) => allowed.find((item) => item.id === id)).filter((item): item is Song | Playlist | Tag => Boolean(item))
        : allowed.filter((item) => !objectGroups.some((group) => group.kind === kind && group.itemIds.includes(item.id)))
      const baseTokens = [
        ...children.filter((group) => !group.afterItems).map((group) => groupToken(group.id)),
        ...items.filter((item) => !childIds.has(item.id)).map((item) => itemToken(item.id)),
        ...children.filter((group) => group.afterItems).map((group) => groupToken(group.id)),
      ]
      const key = parentGroupId ? groupContainerKey(kind, parentGroupId) : rootContainerKey(kind)
      orderFor(key, baseTokens).forEach((token) => {
        if (isGroupToken(token)) {
          const id = tokenId(token)
          if (!groupRank.has(id)) groupRank.set(id, rank++)
          visit(id)
        } else {
          const id = tokenId(token)
          if (!itemRank.has(id)) itemRank.set(id, rank++)
        }
      })
    }
    visit()
    return { itemRank, groupRank }
  }
  const sortChooserObjects = <T extends Song | Playlist | Tag>(kind: GroupKind, items: T[]) => {
    if (chooserSortMode === 'manual') {
      const { itemRank } = chooserManualRanks(kind)
      return [...items].sort((a, b) => (itemRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (itemRank.get(b.id) ?? Number.MAX_SAFE_INTEGER))
    }
    const sign = chooserSortDirection === 'down' ? 1 : -1
    return [...items].sort((a, b) => compareObjects(kind, a, b, chooserSortMode) * sign)
  }
  const compareChooserGroups = (kind: GroupKind, a: ObjectGroup, b: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    if (chooserSortMode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
    if (chooserSortMode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' })
    const allowedIds = new Set(allowed.map((item) => item.id))
    const metric = (group: ObjectGroup) => {
      const ids = deepGroupItemIds(group).filter((id) => allowedIds.has(id))
      if (chooserSortMode === 'plays') return ids.reduce((sum, id) => sum + itemPlays(kind, id), 0)
      if (chooserSortMode === 'duration') return kind === 'song' ? ids.reduce((sum, id) => sum + itemDuration(kind, id), 0) : ids.reduce((sum, id) => sum + itemSongCount(kind, id), 0)
      return group.createdAt
    }
    return metric(a) - metric(b) || a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })
  }
  const sortChooserGroups = (kind: GroupKind, groups: ObjectGroup[], allowed: Array<Song | Playlist | Tag>) => {
    if (chooserSortMode === 'manual') {
      const { groupRank } = chooserManualRanks(kind)
      return [...groups].sort((a, b) => (groupRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (groupRank.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de'))
    }
    const sign = chooserSortDirection === 'down' ? 1 : -1
    return [...groups].sort((a, b) => compareChooserGroups(kind, a, b, allowed) * sign)
  }
  const renderChooserSortControls = (kind: GroupKind) => {
    const labels = chooserLabelsFor(kind)
    return <div className="chooser-sort-controls"><select value={chooserSortMode} onChange={(event) => setChooserSortMode(event.target.value as SortMode)}><option value="manual">{chooserManualLabel(kind)}</option>{(Object.keys(labels) as SortMode[]).filter((mode) => mode !== 'manual').map((mode) => <option key={mode} value={mode}>{labels[mode]}</option>)}</select><button type="button" disabled={chooserSortMode === 'manual'} onClick={() => setChooserSortDirection((value) => value === 'down' ? 'up' : 'down')}>{chooserSortMode === 'manual' ? '—' : chooserSortDirection === 'down' ? '↓' : '↑'}</button></div>
  }
  const orderedGroupItems = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const allowedMap = new Map(allowed.map((item) => [item.id, item]))
    if (group.sortMode === 'general') return allowed.filter((item) => group.itemIds.includes(item.id))
    if (group.sortMode === 'manual') return group.itemIds.map((id) => allowedMap.get(id)).filter((item): item is Song | Playlist | Tag => Boolean(item))
    const direction = group.sortDirection === 'down' ? 1 : -1
    return group.itemIds.map((id) => allowedMap.get(id)).filter((item): item is Song | Playlist | Tag => Boolean(item)).sort((a, b) => compareObjects(group.kind, a, b, group.sortMode as SortMode) * direction)
  }
  const directChildGroups = (groupId: string) => objectGroups.filter((group) => group.parentGroupId === groupId)
  const groupDescendantIds = (groupId: string, seen = new Set<string>()): string[] => {
    if (seen.has(groupId)) return []
    const nextSeen = new Set(seen); nextSeen.add(groupId)
    return directChildGroups(groupId).flatMap((child) => [child.id, ...groupDescendantIds(child.id, nextSeen)])
  }
  const deepGroupItemIds = (group: ObjectGroup, seen = new Set<string>()): string[] => {
    if (seen.has(group.id)) return [] as string[]
    const nextSeen = new Set(seen); nextSeen.add(group.id)
    return [...new Set([...group.itemIds, ...directChildGroups(group.id).flatMap((child) => deepGroupItemIds(child, nextSeen))])]
  }
  const groupDuration = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const allowedIds = new Set(allowed.map((item) => item.id))
    return deepGroupItemIds(group).filter((id) => allowedIds.has(id)).reduce((sum, id) => sum + itemDuration(group.kind, id), 0)
  }
  const groupObjectCount = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>) => {
    const allowedIds = new Set(allowed.map((item) => item.id))
    return deepGroupItemIds(group).filter((id) => allowedIds.has(id)).length
  }
  const sortedGroupsFor = (kind: GroupKind, allowed: Array<Song | Playlist | Tag>, parentGroupId: string | null = null) => {
    const allowedIds = new Set(allowed.map((item) => item.id))
    const candidates = objectGroups.filter((group) => {
      if (group.kind !== kind || (group.parentGroupId ?? null) !== parentGroupId) return false
      const ids = deepGroupItemIds(group)
      return ids.length === 0 || ids.some((id) => allowedIds.has(id))
    })
    const { mode, direction } = globalSortForKind(kind)
    if (mode === 'manual') return [...candidates].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    const sign = direction === 'down' ? 1 : -1
    const metric = (group: ObjectGroup) => {
      const ids = deepGroupItemIds(group).filter((id) => allowedIds.has(id))
      if (mode === 'plays') return ids.reduce((sum, id) => sum + itemPlays(kind, id), 0)
      if (mode === 'duration') return kind === 'song' ? ids.reduce((sum, id) => sum + itemDuration(kind, id), 0) : ids.reduce((sum, id) => sum + itemSongCount(kind, id), 0)
      return group.createdAt
    }
    return [...candidates].sort((a, b) => {
      if (mode === 'azStart') return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' }) * sign
      if (mode === 'azEnd') return reverseText(a.name).localeCompare(reverseText(b.name), 'de', { numeric: true, sensitivity: 'base' }) * sign
      return (metric(a) - metric(b) || a.name.localeCompare(b.name, 'de')) * sign
    })
  }
  const flattenedGroupsFor = (kind: GroupKind, allowed: Array<Song | Playlist | Tag>, parentGroupId: string | null = null): ObjectGroup[] =>
    sortedGroupsFor(kind, allowed, parentGroupId).flatMap((group) => [group, ...flattenedGroupsFor(kind, allowed, group.id)])
  const itemToken = (id: string) => `i:${id}`
  const groupToken = (id: string) => `g:${id}`
  const tokenId = (token: string) => token.slice(2)
  const isGroupToken = (token: string) => token.startsWith('g:')
  const rootContainerKey = (kind: GroupKind) => kind === 'song' ? `song:root:${activePlaylistId ?? 'library'}` : `${kind}:root`
  const groupContainerKey = (kind: GroupKind, groupId: string) => `${kind}:group:${groupId}`
  const normalizedMixedOrder = (containerKey: string, baseTokens: string[]) => {
    const valid = new Set(baseTokens)
    const stored = (mixedOrders[containerKey] ?? []).filter((token) => valid.has(token))
    const known = new Set(stored)
    return [...stored, ...baseTokens.filter((token) => !known.has(token))]
  }
  const bundleRunsFor = (containerKey: string, order: string[]) => {
    const locked = new Set(bundleLocks[containerKey] ?? [])
    const runs: string[][] = []
    let current: string[] = []
    order.forEach((token) => {
      if (locked.has(token)) current.push(token)
      else { if (current.length) runs.push(current); current = [] }
    })
    if (current.length) runs.push(current)
    return runs
  }
  const reorderActiveForKind = (kind: GroupKind) => kind === 'song'
    ? view === 'library' && reorderScope === (activePlaylist ? 'playlist' : 'library')
    : kind === 'playlist' ? reorderScope === 'sidebar' : reorderScope === 'tags'
  const reorderActiveForContainer = (kind: GroupKind, parentGroupId?: string) => reorderActiveForKind(kind) || Boolean(parentGroupId && groupReorderId === parentGroupId)
  const containerManualMode = (kind: GroupKind, parentGroupId?: string) => {
    if (reorderActiveForContainer(kind, parentGroupId)) return true
    if (parentGroupId) {
      const parent = objectGroups.find((group) => group.id === parentGroupId)
      const mode = parent?.sortMode === 'general' ? globalSortForKind(kind).mode : parent?.sortMode
      return mode === 'manual'
    }
    return globalSortForKind(kind).mode === 'manual'
  }
  const orderedTokensForContainer = (containerKey: string, baseTokens: string[], manual: boolean) => {
    const storedOrder = normalizedMixedOrder(containerKey, baseTokens)
    if (manual) return mixedOrders[containerKey]?.length ? storedOrder : baseTokens
    const runs = bundleRunsFor(containerKey, storedOrder).filter((run) => run.length >= 2)
    if (!runs.length) return baseTokens
    const rank = new Map(baseTokens.map((token, index) => [token, index]))
    const runFor = new Map<string, string[]>()
    runs.forEach((run) => run.forEach((token) => runFor.set(token, run)))
    const seen = new Set<string>()
    const anchors = new Set(bundleAnchors[containerKey] ?? [])
    const units: Array<{ tokens: string[]; rank: number }> = []
    baseTokens.forEach((token) => {
      if (seen.has(token)) return
      const run = runFor.get(token)
      if (!run) { seen.add(token); units.push({ tokens: [token], rank: rank.get(token) ?? Number.MAX_SAFE_INTEGER }); return }
      run.forEach((item) => seen.add(item))
      const anchor = run.find((item) => anchors.has(item)) ?? run[0]
      units.push({ tokens: run, rank: rank.get(anchor) ?? Number.MAX_SAFE_INTEGER })
    })
    return units.sort((a, b) => a.rank - b.rank).flatMap((unit) => unit.tokens)
  }
  const toggleBundleLock = (containerKey: string, baseTokens: string[], token: string) => {
    const order = normalizedMixedOrder(containerKey, baseTokens)
    setMixedOrders((current) => ({ ...current, [containerKey]: current[containerKey]?.length ? current[containerKey] : order }))
    setBundleLocks((current) => {
      const values = new Set(current[containerKey] ?? [])
      values.has(token) ? values.delete(token) : values.add(token)
      return { ...current, [containerKey]: [...values] }
    })
  }
  const selectBundleAnchor = (containerKey: string, baseTokens: string[], token: string) => {
    const order = normalizedMixedOrder(containerKey, baseTokens)
    const run = bundleRunsFor(containerKey, order).find((items) => items.includes(token))
    if (!run || run.length < 2) return
    setBundleAnchors((current) => {
      const values = new Set(current[containerKey] ?? [])
      run.forEach((item) => values.delete(item))
      values.add(token)
      return { ...current, [containerKey]: [...values] }
    })
  }
  const bundleInfo = (containerKey: string, baseTokens: string[], token: string) => {
    const order = normalizedMixedOrder(containerKey, baseTokens)
    const locked = new Set(bundleLocks[containerKey] ?? [])
    const run = bundleRunsFor(containerKey, order).find((items) => items.includes(token)) ?? []
    return { locked: locked.has(token), bundled: locked.has(token) && run.length >= 2, anchor: run.length >= 2 && (bundleAnchors[containerKey] ?? []).includes(token), run, order }
  }
  const replaceSubsetOrder = (existing: string[], subsetOrder: string[]) => {
    const subset = new Set(subsetOrder)
    let index = 0
    return existing.map((id) => subset.has(id) ? subsetOrder[index++] : id)
  }
  const persistRelativeOrder = async (kind: GroupKind, order: string[], parentGroupId?: string) => {
    const itemIds = order.filter((token) => !isGroupToken(token)).map(tokenId)
    const groupIds = order.filter(isGroupToken).map(tokenId)
    if (parentGroupId) {
      updateObjectGroup(parentGroupId, (group) => ({ ...group, itemIds: replaceSubsetOrder(group.itemIds, itemIds), sortMode: 'manual' }))
      const siblingIds = objectGroups.filter((group) => group.kind === kind && group.parentGroupId === parentGroupId).sort((a,b) => a.sortOrder-b.sortOrder).map((group) => group.id)
      const nextSiblingIds = replaceSubsetOrder(siblingIds, groupIds)
      const groupOrder = new Map(nextSiblingIds.map((id, index) => [id, index]))
      setObjectGroups((current) => current.map((group) => group.parentGroupId === parentGroupId && group.kind === kind ? { ...group, sortOrder: groupOrder.get(group.id) ?? group.sortOrder } : group))
      return
    }
    if (kind === 'playlist') {
      const currentIds = [...sidebarPlaylists].map((playlist) => playlist.id)
      const nextIds = replaceSubsetOrder(currentIds, itemIds)
      const orderMap = new Map(nextIds.map((id, index) => [id, index]))
      const updated = playlists.map((playlist) => ({ ...playlist, sortOrder: orderMap.get(playlist.id) ?? playlist.sortOrder }))
      setPlaylists(updated); await Promise.all(updated.map(savePlaylist))
    } else if (kind === 'tag') {
      const currentIds = [...sidebarTags].map((tag) => tag.id)
      const nextIds = replaceSubsetOrder(currentIds, itemIds)
      const orderMap = new Map(nextIds.map((id, index) => [id, index]))
      const updated = tags.map((tag) => ({ ...tag, sortOrder: orderMap.get(tag.id) ?? tag.sortOrder }))
      setTags(updated); await Promise.all(updated.map(saveTag))
    } else if (activePlaylist) {
      const nextIds = replaceSubsetOrder(activePlaylist.songIds, itemIds)
      await updatePlaylist({ ...activePlaylist, songIds: nextIds, lastUsedAt: Date.now() }, true)
    } else {
      const currentIds = [...songs].sort((a,b) => (a.libraryOrder ?? a.addedAt) - (b.libraryOrder ?? b.addedAt)).map((song) => song.id)
      const nextIds = replaceSubsetOrder(currentIds, itemIds)
      const orderMap = new Map(nextIds.map((id,index) => [id,index]))
      const updated = songs.map((song) => ({ ...song, libraryOrder: orderMap.get(song.id) ?? song.libraryOrder }))
      setSongs(updated); await saveSongOrder(updated)
    }
    const siblingIds = objectGroups.filter((group) => group.kind === kind && !group.parentGroupId).sort((a,b) => a.sortOrder-b.sortOrder).map((group) => group.id)
    const nextSiblingIds = replaceSubsetOrder(siblingIds, groupIds)
    const groupOrder = new Map(nextSiblingIds.map((id,index) => [id,index]))
    setObjectGroups((current) => current.map((group) => group.kind === kind && !group.parentGroupId ? { ...group, sortOrder: groupOrder.get(group.id) ?? group.sortOrder } : group))
  }
  const moveContainerToken = async (kind: GroupKind, containerKey: string, baseTokens: string[], token: string, delta: -1 | 1, parentGroupId?: string) => {
    const order = normalizedMixedOrder(containerKey, baseTokens)
    const runs = bundleRunsFor(containerKey, order)
    const units: string[][] = []
    let index = 0
    while (index < order.length) {
      const run = runs.find((items) => items.length >= 2 && items[0] === order[index])
      if (run) { units.push(run); index += run.length } else { units.push([order[index]]); index += 1 }
    }
    const unitIndex = units.findIndex((unit) => unit.includes(token))
    const other = unitIndex + delta
    if (unitIndex < 0 || other < 0 || other >= units.length) return
    const nextUnits = [...units]; [nextUnits[unitIndex], nextUnits[other]] = [nextUnits[other], nextUnits[unitIndex]]
    const nextOrder = nextUnits.flat()
    setMixedOrders((current) => ({ ...current, [containerKey]: nextOrder }))
    await persistRelativeOrder(kind, nextOrder, parentGroupId)
  }
  const containerBaseTokensFor = (kind: GroupKind, parentGroupId?: string) => {
    const allowed: Array<Song | Playlist | Tag> = kind === 'song' ? visibleSongs : kind === 'playlist' ? sidebarPlaylists : sidebarTags
    if (parentGroupId) {
      const parent = objectGroups.find((group) => group.id === parentGroupId && group.kind === kind)
      if (!parent) return []
      const children = sortedGroupsFor(kind, allowed, parentGroupId)
      const items = orderedGroupItems(parent, allowed)
      return [...children.filter((child) => !child.afterItems).map((child) => groupToken(child.id)), ...items.map((item) => itemToken(item.id)), ...children.filter((child) => child.afterItems).map((child) => groupToken(child.id))]
    }
    const groups = sortedGroupsFor(kind, allowed)
    const groupedIds = new Set(objectGroups.filter((group) => group.kind === kind).flatMap((group) => group.itemIds))
    const ungrouped = allowed.filter((item) => !groupedIds.has(item.id))
    return [...groups.map((group) => groupToken(group.id)), ...ungrouped.map((item) => itemToken(item.id))]
  }
  const moveTargetKind = (target: SingleMoveTarget): GroupKind | null => {
    if (!target) return null
    if (target.kind !== 'group') return target.kind
    return objectGroups.find((group) => group.id === target.id)?.kind ?? null
  }
  const moveItemIdsIntoGroup = (kind: GroupKind, ids: string[], sourceParentGroupId: string | undefined, targetGroupId: string) => {
    const target = objectGroups.find((group) => group.id === targetGroupId && group.kind === kind)
    const validIds = [...new Set(ids)].filter((id) => Boolean(objectFor(kind, id)))
    if (!target || !validIds.length) return false
    if (sourceParentGroupId === targetGroupId) {
      setMessage(`Die Auswahl befindet sich bereits in „${target.name}“.`)
      return true
    }
    const movingTokens = new Set(validIds.map(itemToken))
    const sourceKey = sourceParentGroupId ? groupContainerKey(kind, sourceParentGroupId) : rootContainerKey(kind)
    const sourceBase = containerBaseTokensFor(kind, sourceParentGroupId)
    const sourceOrder = orderedTokensForContainer(sourceKey, sourceBase, true)
    const sourceNext = sourceOrder.filter((token) => !movingTokens.has(token))
    const targetKey = groupContainerKey(kind, targetGroupId)
    const targetBase = containerBaseTokensFor(kind, targetGroupId)
    const targetOrder = orderedTokensForContainer(targetKey, targetBase, true).filter((token) => !movingTokens.has(token))
    const targetNext = [...targetOrder, ...validIds.map(itemToken)]
    recordHistory()
    setSortModeFor(kind, 'manual')
    setObjectGroups((current) => current.map((group) => {
      if (group.kind !== kind) return group
      if (sourceParentGroupId && group.id === sourceParentGroupId) return { ...group, itemIds: group.itemIds.filter((id) => !validIds.includes(id)), sortMode: 'manual' }
      if (group.id === targetGroupId) return { ...group, itemIds: [...group.itemIds.filter((id) => !validIds.includes(id)), ...validIds], sortMode: 'manual' }
      return group
    }))
    setMixedOrders((current) => ({ ...current, [sourceKey]: sourceNext, [targetKey]: targetNext }))
    const active = activeSortSave(kind)
    if (active) setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders: { ...save.orders, [sourceKey]: sourceNext, [targetKey]: targetNext } } : save))
    setMessage(`${validIds.length === 1 ? 'Datei wurde' : 'Dateien wurden'} in „${target.name}“ bewegt. Du kannst dort weiter positionieren.`)
    return true
  }
  const moveSingleTargetIntoGroup = (group: ObjectGroup) => {
    if (!singleMoveTarget || singleMoveTarget.kind === 'group') return
    const actualKind = moveTargetKind(singleMoveTarget)
    if (!actualKind || group.kind !== actualKind) return
    if (!moveItemIdsIntoGroup(actualKind, [singleMoveTarget.id], singleMoveTarget.parentGroupId, group.id)) return
    setSingleMoveTarget((current) => current ? { ...current, parentGroupId: group.id, targetIndex: null } : current)
  }
  const moveSelectedSongsIntoGroup = (group: ObjectGroup) => {
    if (!bulkMoveMode || group.kind !== 'song' || !bulkMoveContext || !selectedSongIds.size) return
    if (!moveItemIdsIntoGroup('song', [...selectedSongIds], bulkMoveContext.parentGroupId, group.id)) return
    setBulkMoveContext({ parentGroupId: group.id })
  }
  const openSingleMove = (kind: GroupKind | 'group', id: string, parentGroupId?: string) => {
    const actualKind = kind === 'group' ? objectGroups.find((group) => group.id === id)?.kind : kind
    if (!actualKind) return
    const baseTokens = containerBaseTokensFor(actualKind, parentGroupId)
    const key = parentGroupId ? groupContainerKey(actualKind, parentGroupId) : rootContainerKey(actualKind)
    const currentOrder = orderedTokensForContainer(key, baseTokens, containerManualMode(actualKind, parentGroupId))
    setMixedOrders((current) => ({ ...current, [key]: currentOrder }))
    setSortModeFor(actualKind, 'manual')
    setSingleMoveTarget({ kind, id, parentGroupId, targetIndex: null })
    setOverflowMenu(null)
    setCreationPlacementMenuOpen(false)
    setMessage('Zielstrich einmal auswählen und dann doppelt antippen, um zu verschieben.')
  }
  const confirmSingleMove = async (targetIndex: number) => {
    if (!singleMoveTarget) return
    const actualKind = moveTargetKind(singleMoveTarget)
    if (!actualKind) { setSingleMoveTarget(null); return }
    const baseTokens = containerBaseTokensFor(actualKind, singleMoveTarget.parentGroupId)
    const key = singleMoveTarget.parentGroupId ? groupContainerKey(actualKind, singleMoveTarget.parentGroupId) : rootContainerKey(actualKind)
    const token = singleMoveTarget.kind === 'group' ? groupToken(singleMoveTarget.id) : itemToken(singleMoveTarget.id)
    const currentOrder = normalizedMixedOrder(key, baseTokens)
    const nextOrder = reorderIds(currentOrder, token, targetIndex)
    if (nextOrder.join('|') === currentOrder.join('|')) { setSingleMoveTarget((current) => current ? { ...current, targetIndex: null } : current); return }
    recordHistory()
    setMixedOrders((current) => ({ ...current, [key]: nextOrder }))
    await persistRelativeOrder(actualKind, nextOrder, singleMoveTarget.parentGroupId)
    const active = activeSortSave(actualKind)
    if (active) setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders: { ...save.orders, [key]: nextOrder } } : save))
    setSingleMoveTarget((current) => current ? { ...current, targetIndex: null } : current)
    setMessage('Objekt wurde verschoben. Du kannst eine weitere Position wählen; „Abbrechen“ beendet den Modus.')
  }
  const renderSingleMoveZone = (kind: GroupKind, parentGroupId: string | undefined, index: number) => {
    if (!singleMoveTarget || moveTargetKind(singleMoveTarget) !== kind || (singleMoveTarget.parentGroupId ?? undefined) !== (parentGroupId ?? undefined)) return null
    const selected = singleMoveTarget.targetIndex === index
    return <button className={`single-move-zone${selected ? ' selected' : ''}`} type="button" aria-label="Zielposition" onClick={(event) => { event.stopPropagation(); setSingleMoveTarget((current) => current ? { ...current, targetIndex: index } : current) }} onDoubleClick={(event) => { event.stopPropagation(); void confirmSingleMove(index) }}><span /></button>
  }

  const cleanupBundleSingletons = () => {
    const nextLocks: BundleStateMap = { ...bundleLocks }
    const nextAnchors: BundleStateMap = { ...bundleAnchors }
    Object.keys(nextLocks).forEach((containerKey) => {
      const order = mixedOrders[containerKey] ?? []
      const locked = new Set(nextLocks[containerKey] ?? [])
      const runs: string[][] = []; let current: string[] = []
      order.forEach((token) => { if (locked.has(token)) current.push(token); else { if (current.length) runs.push(current); current = [] } })
      if (current.length) runs.push(current)
      const valid = new Set(runs.filter((run) => run.length >= 2).flat())
      nextLocks[containerKey] = (nextLocks[containerKey] ?? []).filter((token) => valid.has(token))
      nextAnchors[containerKey] = (nextAnchors[containerKey] ?? []).filter((token) => valid.has(token))
    })
    setBundleLocks(nextLocks); setBundleAnchors(nextAnchors)
  }
  const renderOrderControls = (kind: GroupKind, containerKey: string, baseTokens: string[], token: string, parentGroupId?: string) => {
    if (!reorderActiveForContainer(kind, parentGroupId)) return null
    const info = bundleInfo(containerKey, baseTokens, token)
    return <span className="order-edit-controls"><button type="button" onClick={(event) => { event.stopPropagation(); void moveContainerToken(kind, containerKey, baseTokens, token, -1, parentGroupId) }}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); void moveContainerToken(kind, containerKey, baseTokens, token, 1, parentGroupId) }}>↓</button><button className={`bundle-lock${info.locked ? ' locked' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); toggleBundleLock(containerKey, baseTokens, token) }} aria-label={info.locked ? 'Bund entsperren' : 'Für Bund sperren'}><span aria-hidden="true" /></button>{info.bundled && <button className={`bundle-anchor${info.anchor ? ' active' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); selectBundleAnchor(containerKey, baseTokens, token) }} aria-label="Sortieranker für Bund" />}</span>
  }
  const bundleDisplayClass = (containerKey: string, baseTokens: string[], token: string) => bundleInfo(containerKey, baseTokens, token).bundled ? ' bundle-member' : ''
  const renderBundleBadge = (kind: GroupKind, containerKey: string, baseTokens: string[], token: string, parentGroupId?: string) => !reorderActiveForContainer(kind, parentGroupId) && bundleInfo(containerKey, baseTokens, token).bundled ? <span className="bundle-static-lock" title="Sortierbund" aria-label="Sortierbund"><span aria-hidden="true" /></span> : null

  const createEmptyObjectGroup = (kind: GroupKind, parentGroupId?: string) => {
    setPendingGroupCreate({ kind, sourceIds: [], parentGroupId, name: 'Unbenannt', moveAfterCreate: false })
    setGroupCreateMenuOpen(false)
    setOverflowMenu(null); setSortMenuOpen(false); setGroupNestingTarget(null)
  }
  const createObjectGroup = (kind: GroupKind, sourceIds: string[]) => {
    const valid = [...new Set(sourceIds)].filter((id) => Boolean(objectFor(kind, id)))
    if (valid.length < 2) { setMessage('Wähle mindestens zwei Objekte zum Gruppieren aus.'); return }
    const directParents = objectGroups.filter((group) => group.kind === kind && valid.every((id) => group.itemIds.includes(id)))
    const parent = directParents.sort((a, b) => groupDescendantIds(a.id).length - groupDescendantIds(b.id).length).at(-1)
    setPendingGroupCreate({ kind, sourceIds: valid, parentGroupId: parent?.id, name: 'Unbenannt', moveAfterCreate: false })
    setGroupCreateMenuOpen(false)
    setOverflowMenu(null); setSortMenuOpen(false); setSidebarSelectionMenuOpen(false)
  }
  const finalizePendingGroupCreate = () => {
    const draft = pendingGroupCreate
    if (!draft) return
    const id = crypto.randomUUID()
    const name = draft.name.trim() || 'Unbenannt'
    const siblings = objectGroups.filter((group) => group.kind === draft.kind && (group.parentGroupId ?? null) === (draft.parentGroupId ?? null))
    const minOrder = Math.min(0, ...siblings.map((group) => group.sortOrder))
    const nextGroup: ObjectGroup = { id, kind: draft.kind, name, itemIds: [...draft.sourceIds], createdAt: Date.now(), sortOrder: minOrder - 1, sortMode: 'general', sortDirection: 'down', parentGroupId: draft.parentGroupId, afterItems: draft.parentGroupId ? false : undefined }
    recordHistory()
    setObjectGroups((current) => [nextGroup, ...current.map((group) => draft.parentGroupId && group.id === draft.parentGroupId ? { ...group, itemIds: group.itemIds.filter((itemId) => !draft.sourceIds.includes(itemId)) } : group)])
    const key = draft.parentGroupId ? groupContainerKey(draft.kind, draft.parentGroupId) : rootContainerKey(draft.kind)
    const base = containerBaseTokensFor(draft.kind, draft.parentGroupId)
    const currentOrder = orderedTokensForContainer(key, base, containerManualMode(draft.kind, draft.parentGroupId))
    const nextOrder = [groupToken(id), ...currentOrder.filter((token) => token !== groupToken(id))]
    const manual = sortModeFor(draft.kind) === 'manual'
    if (manual || draft.moveAfterCreate) {
      setMixedOrders((current) => ({ ...current, [key]: nextOrder }))
      const active = activeSortSave(draft.kind)
      if (active) setSortSaves((current) => current.map((save) => save.id === active.id ? { ...save, orders: { ...save.orders, [key]: nextOrder } } : save))
    }
    if (draft.moveAfterCreate) {
      setSortModeFor(draft.kind, 'manual')
      setSingleMoveTarget({ kind: 'group', id, parentGroupId: draft.parentGroupId, targetIndex: null })
      setMessage('Gruppe erstellt. Zielstrich wählen und doppelt antippen.')
    } else setMessage(`Gruppe „${name}“ wurde erstellt.`)
    if (draft.kind === 'song') stopSelection()
    else { setSidebarSelectionKind(null); setSelectedPlaylistIds(new Set()); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false) }
    setPendingGroupCreate(null)
    setGroupCreateMenuOpen(false)
  }
  const startSidebarSelection = (kind: 'playlist' | 'tag', initialIds: string[] = []) => { setSidebarSelectionKind(kind); setSelectedPlaylistIds(kind === 'playlist' ? new Set(initialIds) : new Set()); setSelectedTagIds(kind === 'tag' ? new Set(initialIds) : new Set()); setSidebarSelectionMenuOpen(false); setOverflowMenu(null) }
  const selectGroupObjects = (group: ObjectGroup) => {
    const ids = deepGroupItemIds(group)
    if (group.kind === 'song') {
      const visibleIds = new Set(visibleSongs.map((song) => song.id))
      startSelection(ids.filter((id) => visibleIds.has(id)))
    } else startSidebarSelection(group.kind, ids)
    setOverflowMenu(null)
  }
  const selectAllPlaylists = () => { setSidebarSelectionKind('playlist'); setSelectedPlaylistIds(new Set(sidebarPlaylists.map((playlist) => playlist.id))); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false); setOverflowMenu(null) }
  const stopSidebarSelection = () => { setSidebarSelectionKind(null); setSelectedPlaylistIds(new Set()); setSelectedTagIds(new Set()); setSidebarSelectionMenuOpen(false) }
  const toggleSidebarSelected = (kind: 'playlist' | 'tag', id: string) => {
    const setter = kind === 'playlist' ? setSelectedPlaylistIds : setSelectedTagIds
    setter((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  const selectedSidebarIds = (kind: 'playlist' | 'tag') => [...(kind === 'playlist' ? selectedPlaylistIds : selectedTagIds)]
  const copyNameForSelection = (base: string, used: Set<string>) => { let suffix = 1; let value = `${base} Kopie`; while (used.has(value.toLocaleLowerCase('de-DE'))) { suffix += 1; value = `${base} Kopie ${suffix}` } used.add(value.toLocaleLowerCase('de-DE')); return value }
  const copySelectedSidebarObjects = async () => {
    if (!sidebarSelectionKind) return
    const ids = selectedSidebarIds(sidebarSelectionKind); if (!ids.length) return
    recordHistory(); const now = Date.now()
    if (sidebarSelectionKind === 'playlist') {
      const used = new Set(playlists.map((item) => item.name.toLocaleLowerCase('de-DE')))
      const copies = ids.map((id, index) => { const source = playlists.find((item) => item.id === id); return source ? { ...source, id: crypto.randomUUID(), name: copyNameForSelection(source.name, used), createdAt: now + index, lastUsedAt: now + index, sortOrder: -now - index, trashedAt: undefined } : null }).filter(Boolean) as Playlist[]
      await Promise.all(copies.map(savePlaylist)); setPlaylists((current) => [...copies, ...current]); setMessage(`${copies.length} Playlists wurden kopiert.`)
    } else {
      const used = new Set(tags.map((item) => item.name.toLocaleLowerCase('de-DE')))
      const copies = ids.map((id, index) => { const source = tags.find((item) => item.id === id); return source ? { ...source, id: crypto.randomUUID(), name: copyNameForSelection(source.name, used), songIds: [...source.songIds], playlistIds: [...source.playlistIds], createdAt: now + index, lastUsedAt: now + index, sortOrder: -now - index, trashedAt: undefined } : null }).filter(Boolean) as Tag[]
      await Promise.all(copies.map(saveTag)); setTags((current) => [...copies, ...current]); setMessage(`${copies.length} Tags wurden kopiert.`)
    }
    stopSidebarSelection()
  }
  const beginSidebarSelectionMove = () => {
    if (!sidebarSelectionKind || !selectedSidebarIds(sidebarSelectionKind).length) return
    const mode = sidebarSelectionKind === 'playlist' ? playlistSortMode : tagSortMode
    setSidebarSelectionMenuOpen(false); setChooserSearch('')
    if (mode !== 'manual') { setSidebarSelectionConfirmation('switchManualMove'); return }
    setSidebarMoveKind(sidebarSelectionKind)
  }
  const applySidebarSelectionMove = async (targetIndex: number) => {
    if (!sidebarMoveKind) return
    const selected = new Set(selectedSidebarIds(sidebarMoveKind)); const source = sidebarMoveKind === 'playlist' ? sidebarPlaylists : sidebarTags
    const moving = source.filter((item) => selected.has(item.id)); const remaining = source.filter((item) => !selected.has(item.id)); const insertAt = Math.max(0, Math.min(targetIndex, remaining.length)); const ordered = [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)]
    recordHistory()
    if (sidebarMoveKind === 'playlist') { const order = new Map(ordered.map((item, index) => [item.id, index])); const updated = playlists.map((item) => ({ ...item, sortOrder: order.get(item.id) ?? item.sortOrder })); setPlaylists(updated); await Promise.all(updated.map(savePlaylist)) }
    else { const order = new Map(ordered.map((item, index) => [item.id, index])); const updated = tags.map((item) => ({ ...item, sortOrder: order.get(item.id) ?? item.sortOrder })); setTags(updated); await Promise.all(updated.map(saveTag)) }
    setMessage('Auswahl wurde bewegt. Du kannst weitere Zielpositionen wählen; „Abbrechen“ beendet den Modus.')
  }
  const deleteSelectedSidebarObjects = async () => {
    if (!sidebarSelectionKind) return
    const ids = selectedSidebarIds(sidebarSelectionKind); if (!ids.length) return; const idSet = new Set(ids); const trashedAt = Date.now()
    if (sidebarSelectionKind === 'playlist') { const moving = playlists.filter((item) => idSet.has(item.id)).map((item) => ({ ...item, trashedAt })); await Promise.all(moving.map(savePlaylist)); setPlaylists((items) => items.filter((item) => !idSet.has(item.id))); setTrashedPlaylists((items) => [...moving, ...items.filter((item) => !idSet.has(item.id))]); if (activePlaylistId && idSet.has(activePlaylistId)) goHome() }
    else { const moving = tags.filter((item) => idSet.has(item.id)).map((item) => ({ ...item, trashedAt })); await Promise.all(moving.map(saveTag)); setTags((items) => items.filter((item) => !idSet.has(item.id))); setTrashedTags((items) => [...moving, ...items.filter((item) => !idSet.has(item.id))]); if (activeTagId && idSet.has(activeTagId)) goHome() }
    setSidebarSelectionConfirmation(null); stopSidebarSelection(); setMessage(`${ids.length} ${sidebarSelectionKind === 'playlist' ? 'Playlists' : 'Tags'} wurden in den Papierkorb verschoben.`)
  }
  const updateObjectGroup = (id: string, change: (group: ObjectGroup) => ObjectGroup) => setObjectGroups((current) => current.map((group) => group.id === id ? change(group) : group))
  const dissolveGroup = (id: string) => { const target = objectGroups.find((group) => group.id === id); if (!target) return; recordHistory(); setObjectGroups((current) => current.filter((group) => group.id !== id).map((group) => group.parentGroupId === id ? { ...group, parentGroupId: target.parentGroupId } : group)); const changedTags = tags.filter((tag) => (tag.groupIds ?? []).includes(id)).map((tag) => ({ ...tag, groupIds: (tag.groupIds ?? []).filter((groupId) => groupId !== id) })); if (changedTags.length) { const changedById = new Map(changedTags.map((tag) => [tag.id, tag])); setTags((current) => current.map((tag) => changedById.get(tag.id) ?? tag)); void Promise.all(changedTags.map(saveTag)) } setCollapsedGroupIds((current) => { const next = new Set(current); next.delete(id); return next }); setOverflowMenu(null); setGroupReorderId((value) => value === id ? null : value); setGroupMoveId((value) => value === id ? null : value) }
  const openGroupRename = (group: ObjectGroup) => { setGroupRenameId(group.id); setGroupRenameValue(group.name); setOverflowMenu(null) }
  const saveGroupRename = (event: React.FormEvent) => { event.preventDefault(); const value = groupRenameValue.trim(); if (!groupRenameId || !value) return; updateObjectGroup(groupRenameId, (group) => ({ ...group, name: value })); setGroupRenameId(null) }
  const moveGroup = (id: string, delta: -1 | 1) => {
    const target = objectGroups.find((group) => group.id === id); if (!target) return
    if (target.kind === 'song') setSortMode('manual'); else if (target.kind === 'playlist') setPlaylistSortMode('manual'); else setTagSortMode('manual')
    setObjectGroups((current) => {
      const siblings = current.filter((group) => group.kind === target.kind && (group.parentGroupId ?? null) === (target.parentGroupId ?? null))
      if (!target.parentGroupId) {
        const same = [...siblings].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
        const index = same.findIndex((group) => group.id === id); const other = same[index + delta]; if (!other) return current
        const aOrder = same[index].sortOrder; const bOrder = other.sortOrder
        return current.map((group) => group.id === id ? { ...group, sortOrder: bOrder } : group.id === other.id ? { ...group, sortOrder: aOrder } : group)
      }
      const before = siblings.filter((group) => !group.afterItems).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
      const after = siblings.filter((group) => group.afterItems).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
      const lane = target.afterItems ? after : before
      const index = lane.findIndex((group) => group.id === id)
      const other = lane[index + delta]
      if (other) {
        const aOrder = lane[index].sortOrder; const bOrder = other.sortOrder
        return current.map((group) => group.id === id ? { ...group, sortOrder: bOrder } : group.id === other.id ? { ...group, sortOrder: aOrder } : group)
      }
      if (!target.afterItems && delta === 1) {
        const minAfter = Math.min(0, ...after.map((group) => group.sortOrder))
        return current.map((group) => group.id === id ? { ...group, afterItems: true, sortOrder: minAfter - 1 } : group)
      }
      if (target.afterItems && delta === -1) {
        const maxBefore = Math.max(0, ...before.map((group) => group.sortOrder))
        return current.map((group) => group.id === id ? { ...group, afterItems: false, sortOrder: maxBefore + 1 } : group)
      }
      return current
    })
  }
  const closeGroupMembershipDraft = () => { setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget(null); setChooserSearch('') }
  const openGroupMembership = (groupId: string, mode: 'add' | 'remove') => { setChooserSearch(''); setChooserSortMode('manual'); setChooserSortDirection('down'); setGroupMembershipDraftIds(new Set()); setGroupMembershipTarget({ groupId, mode }); setOverflowMenu(null) }
  const toggleGroupMembershipDraft = (itemId: string) => setGroupMembershipDraftIds((current) => { const next = new Set(current); next.has(itemId) ? next.delete(itemId) : next.add(itemId); return next })
  const applyGroupMembershipDraft = () => {
    if (!groupMembershipTarget) return
    const group = objectGroups.find((item) => item.id === groupMembershipTarget.groupId)
    if (!group) { closeGroupMembershipDraft(); return }
    const selected = [...groupMembershipDraftIds].filter((id) => Boolean(objectFor(group.kind, id)))
    const valid = groupMembershipTarget.mode === 'add'
      ? selected.filter((id) => !group.itemIds.includes(id))
      : selected.filter((id) => group.itemIds.includes(id))
    if (valid.length) {
      recordHistory()
      const selectedSet = new Set(valid)
      updateObjectGroup(group.id, (item) => groupMembershipTarget.mode === 'add'
        ? { ...item, itemIds: [...item.itemIds, ...valid] }
        : { ...item, itemIds: item.itemIds.filter((id) => !selectedSet.has(id)) })
    }
    closeGroupMembershipDraft()
  }
  const groupGroup = (group: ObjectGroup) => {
    const wrapperId = crypto.randomUUID()
    recordHistory()
    setObjectGroups((current) => {
      const siblings = current.filter((item) => item.kind === group.kind && (item.parentGroupId ?? null) === (group.parentGroupId ?? null))
      const minOrder = Math.min(group.sortOrder, ...siblings.map((item) => item.sortOrder))
      const wrapper: ObjectGroup = { id: wrapperId, kind: group.kind, name: 'Unbenannt', itemIds: [], createdAt: Date.now(), sortOrder: minOrder, sortMode: 'general', sortDirection: 'down', parentGroupId: group.parentGroupId, afterItems: group.parentGroupId ? Boolean(group.afterItems) : undefined }
      return [wrapper, ...current.map((item) => item.id === group.id ? { ...item, parentGroupId: wrapperId, afterItems: false } : item)]
    })
    setOverflowMenu(null); setMessage('Gruppe wurde in eine neue Gruppe gelegt.')
  }
  const closeGroupNestingDraft = () => { setGroupNestingDraftIds(new Set()); setGroupNestingTarget(null); setChooserSearch('') }
  const openGroupNesting = (groupId: string, mode: 'add' | 'remove') => { setChooserSearch(''); setChooserSortMode('manual'); setChooserSortDirection('down'); setGroupNestingDraftIds(new Set()); setGroupNestingTarget({ groupId, mode }); setOverflowMenu(null) }
  const toggleGroupNestingDraft = (groupId: string) => setGroupNestingDraftIds((current) => { const next = new Set(current); next.has(groupId) ? next.delete(groupId) : next.add(groupId); return next })
  const applyGroupNestingDraft = () => {
    if (!groupNestingTarget) return
    const target = objectGroups.find((group) => group.id === groupNestingTarget.groupId)
    if (!target) { closeGroupNestingDraft(); return }
    if (groupNestingTarget.mode === 'add') {
      const descendants = new Set(groupDescendantIds(target.id))
      const selected = [...groupNestingDraftIds].filter((id) => {
        if (id === GROUP_NESTING_NEW_DRAFT_ID || id === GROUP_NESTING_PASTE_DRAFT_ID) return false
        const child = objectGroups.find((group) => group.id === id)
        return Boolean(child && child.kind === target.kind && child.id !== target.id && !descendants.has(child.id) && child.parentGroupId !== target.id && !groupDescendantIds(child!.id).includes(target.id))
      })
      const addEmpty = groupNestingDraftIds.has(GROUP_NESTING_NEW_DRAFT_ID)
      const pasteClipboard = groupNestingDraftIds.has(GROUP_NESTING_PASTE_DRAFT_ID) && groupClipboard?.kind === target.kind ? groupClipboard : null
      if (selected.length || addEmpty || pasteClipboard) {
        recordHistory()
        const selectedSet = new Set(selected)
        const childOrders = directChildGroups(target.id).map((group) => group.sortOrder)
        let nextRootOrder = Math.min(0, ...childOrders) - 1
        const additions: ObjectGroup[] = []
        if (addEmpty) {
          additions.push({ id: crypto.randomUUID(), kind: target.kind, name: 'Unbenannt', itemIds: [], createdAt: Date.now(), sortOrder: nextRootOrder--, sortMode: 'general', sortDirection: 'down', parentGroupId: target.id, afterItems: false })
        }
        if (pasteClipboard) {
          const sourceRoot = pasteClipboard.groups.find((group) => group.id === pasteClipboard.rootId)
          if (sourceRoot) {
            const idMap = new Map(pasteClipboard.groups.map((group) => [group.id, crypto.randomUUID()]))
            additions.push(...pasteClipboard.groups.map((source) => ({
              ...source,
              id: idMap.get(source.id)!,
              name: source.id === pasteClipboard.rootId ? `${source.name} Kopie` : source.name,
              itemIds: [...source.itemIds],
              createdAt: Date.now(),
              sortOrder: source.id === pasteClipboard.rootId ? nextRootOrder-- : source.sortOrder,
              parentGroupId: source.id === pasteClipboard.rootId ? target.id : source.parentGroupId ? idMap.get(source.parentGroupId) : target.id,
              afterItems: source.id === pasteClipboard.rootId ? false : source.afterItems,
            })))
          }
        }
        setObjectGroups((current) => [...additions, ...current.map((group) => selectedSet.has(group.id) ? { ...group, parentGroupId: target.id, afterItems: false } : group)])
        const changedCount = selected.length + (addEmpty ? 1 : 0) + (pasteClipboard ? 1 : 0)
        setMessage(`${changedCount} ${changedCount === 1 ? 'Gruppe wurde' : 'Gruppen wurden'} hinzugefügt.`)
      }
    } else {
      const selected = [...groupNestingDraftIds].filter((id) => {
        const candidate = objectGroups.find((group) => group.id === id)
        return Boolean(candidate && ((id === target.id && target.parentGroupId) || candidate.parentGroupId === target.id))
      })
      if (selected.length) {
        recordHistory()
        const selectedSet = new Set(selected)
        setObjectGroups((current) => current.map((group) => selectedSet.has(group.id) ? { ...group, parentGroupId: undefined, afterItems: undefined } : group))
        setMessage(`${selected.length} ${selected.length === 1 ? 'Gruppe wurde' : 'Gruppen wurden'} entfernt.`)
      }
    }
    closeGroupNestingDraft()
  }
  const copyGroup = (group: ObjectGroup) => {
    const ids = new Set([group.id, ...groupDescendantIds(group.id)])
    const groups = objectGroups.filter((item) => ids.has(item.id)).map((item) => ({ ...item, itemIds: [...item.itemIds] }))
    setGroupClipboard({ kind: group.kind, rootId: group.id, groups })
    setOverflowMenu(null); setMessage(`Gruppe „${group.name}“ wurde kopiert.`)
  }
  const removeAllGroupObjects = (groupId: string) => {
    const ids = new Set([groupId, ...groupDescendantIds(groupId)])
    recordHistory()
    setObjectGroups((current) => current.map((group) => ids.has(group.id) ? { ...group, itemIds: [] } : group))
    setOverflowMenu(null)
    setMessage('Alle Objekte wurden aus der Gruppe entfernt. Die Gruppenstruktur bleibt bestehen.')
  }
  const deleteObjectGroup = async (groupId: string) => {
    const target = objectGroups.find((group) => group.id === groupId); if (!target) return
    const groupIds = new Set([groupId, ...groupDescendantIds(groupId)])
    const groupsToDelete = objectGroups.filter((group) => groupIds.has(group.id))
    const objectIds = [...new Set(groupsToDelete.flatMap((group) => group.itemIds))]
    if (target.kind === 'song') {
      await moveSongsToTrash(objectIds)
    } else if (target.kind === 'playlist') {
      const idSet = new Set(objectIds); const trashedAt = Date.now()
      const moving = playlists.filter((item) => idSet.has(item.id)).map((item) => ({ ...item, trashedAt }))
      await Promise.all(moving.map(savePlaylist))
      setPlaylists((items) => items.filter((item) => !idSet.has(item.id)))
      setTrashedPlaylists((items) => [...moving, ...items.filter((item) => !idSet.has(item.id))])
      if (activePlaylistId && idSet.has(activePlaylistId)) goHome()
    } else {
      const idSet = new Set(objectIds); const trashedAt = Date.now()
      const moving = tags.filter((item) => idSet.has(item.id)).map((item) => ({ ...item, trashedAt }))
      await Promise.all(moving.map(saveTag))
      setTags((items) => items.filter((item) => !idSet.has(item.id)))
      setTrashedTags((items) => [...moving, ...items.filter((item) => !idSet.has(item.id))])
      if (activeTagId && idSet.has(activeTagId)) goHome()
    }
    const deletedTagIds = target.kind === 'tag' ? new Set(objectIds) : new Set<string>()
    const tagGroupUpdates = tags
      .filter((tag) => !deletedTagIds.has(tag.id) && (tag.groupIds ?? []).some((id) => groupIds.has(id)))
      .map((tag) => ({ ...tag, groupIds: (tag.groupIds ?? []).filter((id) => !groupIds.has(id)) }))
    if (tagGroupUpdates.length) {
      await Promise.all(tagGroupUpdates.map(saveTag))
      const updates = new Map(tagGroupUpdates.map((tag) => [tag.id, tag]))
      setTags((current) => current.map((tag) => updates.get(tag.id) ?? tag))
    }
    const deletedObjects = new Set(objectIds)
    setObjectGroups((current) => current.filter((group) => !groupIds.has(group.id)).map((group) => group.kind === target.kind ? { ...group, itemIds: group.itemIds.filter((id) => !deletedObjects.has(id)) } : group))
    setCollapsedGroupIds((current) => { const next = new Set(current); groupIds.forEach((id) => next.delete(id)); return next })
    setGroupDeleteTargetId(null); setOverflowMenu(null)
    setMessage('Gruppe und enthaltene Objekte wurden in den Papierkorb verschoben.')
  }
  const groupPlaybackSongIds = (group: ObjectGroup, seen = new Set<string>()): string[] => {
    if (group.kind !== 'song' || seen.has(group.id)) return []
    const nextSeen = new Set(seen); nextSeen.add(group.id)
    const children = sortedGroupsFor('song', songs, group.id)
    const items = orderedGroupItems(group, songs) as Song[]
    const baseTokens = [
      ...children.filter((child) => !child.afterItems).map((child) => groupToken(child.id)),
      ...items.map((item) => itemToken(item.id)),
      ...children.filter((child) => child.afterItems).map((child) => groupToken(child.id)),
    ]
    const order = orderedTokensForContainer(groupContainerKey('song', group.id), baseTokens, containerManualMode('song', group.id))
    const childMap = new Map(children.map((child) => [child.id, child]))
    const itemMap = new Map(items.map((item) => [item.id, item]))
    return order.flatMap((token) => {
      if (isGroupToken(token)) {
        const child = childMap.get(tokenId(token))
        return child ? groupPlaybackSongIds(child, nextSeen) : []
      }
      const item = itemMap.get(tokenId(token))
      return item?.file?.size ? [item.id] : []
    })
  }
  const startGroupPlayback = (groups: ObjectGroup[]) => {
    const ids = groups.flatMap((group) => groupPlaybackSongIds(group))
    if (!ids.length) { setMessage('In der Auswahl befinden sich keine abspielbaren Lieder.'); return }
    groupPlaybackIdsRef.current = ids
    setGroupPlaybackIds(ids)
    setGroupPlaybackChooserOpen(false)
    setChooserSearch('')
    playSong(ids[0], true, true)
  }
  const playObjectGroup = (group: ObjectGroup) => {
    if (group.kind !== 'song') return
    startGroupPlayback([group]); setOverflowMenu(null)
  }
  const openGroupPlaybackChooser = () => {
    setSortMenuOpen(false)
    setChooserSearch('')
    setChooserSortMode('manual')
    setChooserSortDirection('down')
    setGroupPlaybackSelectedIds([])
    setGroupPlaybackChooserOpen(true)
  }
  const togglePlaybackGroup = (id: string) => setGroupPlaybackSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const movePlaybackGroup = (id: string, delta: -1 | 1) => setGroupPlaybackSelectedIds((current) => {
    const index = current.indexOf(id); const other = index + delta
    if (index < 0 || other < 0 || other >= current.length) return current
    const next = [...current]; [next[index], next[other]] = [next[other], next[index]]; return next
  })

  const songGroups = sortedGroupsFor('song', visibleSongs)
  const groupedSongIds = new Set(objectGroups.filter((group) => group.kind === 'song').flatMap((group) => group.itemIds))
  const ungroupedVisibleSongs = visibleSongs.filter((song) => !groupedSongIds.has(song.id))
  const playlistGroups = sortedGroupsFor('playlist', sidebarPlaylists)
  const groupedPlaylistIds = new Set(objectGroups.filter((group) => group.kind === 'playlist').flatMap((group) => group.itemIds))
  const ungroupedSidebarPlaylists = sidebarPlaylists.filter((playlist) => !groupedPlaylistIds.has(playlist.id))
  const tagGroups = sortedGroupsFor('tag', sidebarTags)
  const groupedTagIds = new Set(objectGroups.filter((group) => group.kind === 'tag').flatMap((group) => group.itemIds))
  const ungroupedSidebarTags = sidebarTags.filter((tag) => !groupedTagIds.has(tag.id))

  const songRootKey = rootContainerKey('song')
  const songRootBaseTokens = [...songGroups.map((group) => groupToken(group.id)), ...ungroupedVisibleSongs.map((song) => itemToken(song.id))]
  const songRootOrder = orderedTokensForContainer(songRootKey, songRootBaseTokens, containerManualMode('song'))
  const playlistRootKey = rootContainerKey('playlist')
  const playlistRootBaseTokens = [...playlistGroups.map((group) => groupToken(group.id)), ...ungroupedSidebarPlaylists.map((playlist) => itemToken(playlist.id))]
  const playlistRootOrder = orderedTokensForContainer(playlistRootKey, playlistRootBaseTokens, containerManualMode('playlist'))
  const tagRootKey = rootContainerKey('tag')
  const tagRootBaseTokens = [...tagGroups.map((group) => groupToken(group.id)), ...ungroupedSidebarTags.map((tag) => itemToken(tag.id))]
  const tagRootOrder = orderedTokensForContainer(tagRootKey, tagRootBaseTokens, containerManualMode('tag'))
  const songGroupMap = new Map(songGroups.map((group) => [group.id, group]))
  const songItemMap = new Map(ungroupedVisibleSongs.map((song) => [song.id, song]))
  const playlistGroupMap = new Map(playlistGroups.map((group) => [group.id, group]))
  const playlistItemMap = new Map(ungroupedSidebarPlaylists.map((playlist) => [playlist.id, playlist]))
  const tagGroupMap = new Map(tagGroups.map((group) => [group.id, group]))
  const tagItemMap = new Map(ungroupedSidebarTags.map((tag) => [tag.id, tag]))

  const renderImportLibraryDropZone = (index: number) => importMoveStep !== 'place' ? null : <button className={`import-library-drop-zone${importLibraryTargetIndex === index ? ' selected' : ''}`} type="button" onClick={() => setImportLibraryTargetIndex(index)} aria-label="Import hier platzieren"><span /></button>
  const renderGroupHeader = (group: ObjectGroup, allowed: Array<Song | Playlist | Tag>, containerKey?: string, baseTokens: string[] = []) => {
    const collapsed = collapsedGroupIds.has(group.id)
    const token = groupToken(group.id)
    const key = containerKey ?? rootContainerKey(group.kind)
    const bundleClass = bundleDisplayClass(key, baseTokens, token)
    const toggleCollapsed = () => setCollapsedGroupIds((current) => { const next = new Set(current); next.has(group.id) ? next.delete(group.id) : next.add(group.id); return next })
    const singleMoveGroupTarget = Boolean(singleMoveTarget && singleMoveTarget.kind !== 'group' && moveTargetKind(singleMoveTarget) === group.kind)
    const bulkMoveGroupTarget = Boolean(bulkMoveMode && group.kind === 'song')
    const sourceGroupTarget = selectionSourceKind === 'group' && group.kind === 'song'
    const directGroupMode = singleMoveGroupTarget || bulkMoveGroupTarget || Boolean(selectionSourceKind)
    const actionableGroup = singleMoveGroupTarget || bulkMoveGroupTarget || sourceGroupTarget
    const runDirectGroupAction = () => {
      if (singleMoveGroupTarget) { moveSingleTargetIntoGroup(group); return }
      if (bulkMoveGroupTarget) { moveSelectedSongsIntoGroup(group); return }
      if (sourceGroupTarget) applySelectionSourceById('group', group.id)
    }
    const handleGroupClick = () => {
      if (!directGroupMode) { toggleCollapsed(); return }
      if (groupDirectClickTimerRef.current !== null) window.clearTimeout(groupDirectClickTimerRef.current)
      groupDirectClickTimerRef.current = window.setTimeout(() => {
        groupDirectClickTimerRef.current = null
        if (actionableGroup) runDirectGroupAction()
      }, 220)
    }
    const handleGroupDoubleClick = () => {
      if (!directGroupMode) return
      if (groupDirectClickTimerRef.current !== null) window.clearTimeout(groupDirectClickTimerRef.current)
      groupDirectClickTimerRef.current = null
      toggleCollapsed()
    }
    return <div className={`object-group-header${collapsed ? ' collapsed' : ''}${group.color ? ' custom-surface' : ''}${bundleClass}${actionableGroup ? ' direct-group-target' : ''}${directGroupMode && !actionableGroup ? ' direct-group-navigation' : ''}`} style={surfaceStyle(group.color)} role="button" tabIndex={0} aria-expanded={!collapsed} onClick={handleGroupClick} onDoubleClick={handleGroupDoubleClick} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); actionableGroup ? runDirectGroupAction() : toggleCollapsed() } }}><div className="object-group-heading"><strong><b className="group-chevron">{collapsed ? '▸' : '▾'}</b><span className="group-tag-dots">{groupTags(group.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} title={tag.name} />)}</span><span className="group-name-text">{group.name}</span></strong><span>{groupObjectCount(group, allowed)} Objekte · {formatTime(groupDuration(group, allowed))}</span></div>{renderOrderControls(group.kind, key, baseTokens, token, group.parentGroupId)}{groupMoveId === group.id && !reorderActiveForKind(group.kind) && <div className="group-inline-tools"><button type="button" onClick={(event) => { event.stopPropagation(); moveGroup(group.id, -1) }}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveGroup(group.id, 1) }}>↓</button><button type="button" onClick={(event) => { event.stopPropagation(); setGroupMoveId(null) }}>Fertig</button></div>}{groupReorderId === group.id && !reorderActiveForKind(group.kind) && <button className="group-finish" type="button" onClick={(event) => { event.stopPropagation(); cleanupBundleSingletons(); setGroupReorderId(null) }}>Fertig</button>}{renderBundleBadge(group.kind, key, baseTokens, token, group.parentGroupId)}<button className="overflow-button group-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'group', id: group.id }) }}>•••</button></div>
  }
  const renderSongRow = (song: Song, index: number, groupId?: string, containerKey?: string, baseTokens: string[] = []) => {
    const groupReordering = groupId === groupReorderId
    const surfaceColor = objectSurfaceColor('song', song.id)
    const token = itemToken(song.id)
    const key = containerKey ?? (groupId ? groupContainerKey('song', groupId) : rootContainerKey('song'))
    const bundleClass = bundleDisplayClass(key, baseTokens, token)
    return <div key={song.id} className={`song-row${song.isNew ? ' new-import' : ''}${selectedSongIds.has(song.id) ? ' selected-song' : ''}${groupId ? ' grouped-object-row' : ''}${surfaceColor ? ' custom-surface' : ''}${bundleClass}`} style={surfaceStyle(surfaceColor)}>{renderOrderControls('song', key, baseTokens, token, groupId)}{selectionMode && <button className="selection-check" type="button" onClick={() => toggleSelected(song.id)}>{selectedSongIds.has(song.id) ? '✓' : ''}</button>}<button className="song-main" type="button" onClick={() => playSong(song.id)} disabled={songEditMode || groupReordering || Boolean(selectionSourceKind)}><span className="song-number">{song.id === currentSongId && isPlaying ? '▶' : index + 1}</span><span className="song-copy"><strong>{song.name}</strong><small className="song-subline"><span className="song-tag-dots">{songTags(song.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} title={tag.name} />)}</span><span>{view === 'history' ? formatDate(song.addedAt) : membershipText(song.id)}</span></small></span><span className="song-meta"><small>{!song.file || song.file.size === 0 ? 'FEHLT' : formatTime(song.duration)}</small>{song.loopStart !== undefined && song.loopEnd !== undefined && <span className="loop-badge">↻</span>}</span></button>{renderBundleBadge('song', key, baseTokens, token, groupId)}<button className="overflow-button song-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'song', id: song.id, parentGroupId: groupId })}>•••</button>{activePlaylist && view === 'library' && !selectionMode && !songEditMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActivePlaylist(song.id)}>Entfernen</button>}{activeTag && view === 'tag' && !selectionMode && <button className="remove-song" type="button" onClick={() => void removeSongFromActiveTag(song.id)}>Entfernen</button>}</div>
  }
  const renderPlaylistRow = (playlist: Playlist, index: number, groupId?: string, containerKey?: string, baseTokens: string[] = []) => {
    const groupReordering = groupId === groupReorderId
    const selected = selectedPlaylistIds.has(playlist.id)
    const surfaceColor = objectSurfaceColor('playlist', playlist.id)
    const token = itemToken(playlist.id)
    const key = containerKey ?? (groupId ? groupContainerKey('playlist', groupId) : rootContainerKey('playlist'))
    const bundleClass = bundleDisplayClass(key, baseTokens, token)
    return <div className={`playlist-nav-row${groupId ? ' grouped-object-row' : ''}${bundleClass}`} key={playlist.id}>{renderOrderControls('playlist', key, baseTokens, token, groupId)}{sidebarSelectionKind === 'playlist' && <button className="selection-check sidebar-selection-check" type="button" onClick={() => toggleSidebarSelected('playlist', playlist.id)}>{selected ? '✓' : ''}</button>}<button className={`nav-item${activePlaylistId === playlist.id && view === 'library' ? ' active' : ''}${selected ? ' selected-sidebar-object' : ''}${surfaceColor ? ' custom-surface' : ''}`} style={surfaceStyle(surfaceColor)} type="button" onClick={() => { if (selectionSourceKind) { if (selectionSourceKind === 'playlist') applySelectionSourceById('playlist', playlist.id); return } sidebarSelectionKind === 'playlist' ? toggleSidebarSelected('playlist', playlist.id) : void openPlaylist(playlist.id) }} disabled={reorderScope === 'sidebar' || groupReordering}><span className="playlist-nav-name">{coverUrls[playlist.id] ? <span className="playlist-mini-cover cover-media" style={coverFrameStyle(playlist)}><img className="positioned-cover-image" style={coverImageStyle(playlist)} src={coverUrls[playlist.id]} alt="" /></span> : <span className="playlist-mini-cover">♫</span>}<span className="nav-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span><span>{playlist.name}</span></span><strong>{playlist.songIds.length}</strong></button>{renderBundleBadge('playlist', key, baseTokens, token, groupId)}{sidebarSelectionKind !== 'playlist' && !selectionSourceKind && <button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id, parentGroupId: groupId })}>•••</button>}</div>
  }
  const renderTagRow = (tag: Tag, index: number, groupId?: string, containerKey?: string, baseTokens: string[] = []) => {
    const groupReordering = groupId === groupReorderId
    const selected = selectedTagIds.has(tag.id)
    const surfaceColor = objectSurfaceColor('tag', tag.id)
    const token = itemToken(tag.id)
    const key = containerKey ?? (groupId ? groupContainerKey('tag', groupId) : rootContainerKey('tag'))
    const bundleClass = bundleDisplayClass(key, baseTokens, token)
    return <div className={`playlist-nav-row tag-nav-row${groupId ? ' grouped-object-row' : ''}${bundleClass}`} key={tag.id}>{renderOrderControls('tag', key, baseTokens, token, groupId)}{sidebarSelectionKind === 'tag' && <button className="selection-check sidebar-selection-check" type="button" onClick={() => toggleSidebarSelected('tag', tag.id)}>{selected ? '✓' : ''}</button>}<button className={`nav-item${activeTagId === tag.id && view === 'tag' ? ' active' : ''}${selected ? ' selected-sidebar-object' : ''}${surfaceColor ? ' custom-surface' : ''}`} style={surfaceStyle(surfaceColor)} type="button" onClick={() => { if (selectionSourceKind) { if (selectionSourceKind === 'tag') applySelectionSourceById('tag', tag.id); return } sidebarSelectionKind === 'tag' ? toggleSidebarSelected('tag', tag.id) : void openTag(tag.id) }} disabled={tagEditMode || groupReordering}><span className="tag-nav-name"><i className="tag-dot" style={{ background: tag.color }} /><span>{tag.name}</span></span><strong>{tag.songIds.filter((id) => songs.some((song) => song.id === id)).length}</strong></button>{renderBundleBadge('tag', key, baseTokens, token, groupId)}{sidebarSelectionKind !== 'tag' && !selectionSourceKind && <button className="overflow-button row-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'tag', id: tag.id, parentGroupId: groupId })}>•••</button>}</div>
  }
  const groupPathName = (group: ObjectGroup) => {
    const names = [group.name]
    const seen = new Set([group.id])
    let parentId = group.parentGroupId
    while (parentId) {
      const parent = objectGroups.find((item) => item.id === parentId)
      if (!parent || seen.has(parent.id)) break
      names.unshift(parent.name); seen.add(parent.id); parentId = parent.parentGroupId
    }
    return names.join(' › ')
  }
  const groupNamesForItem = (kind: GroupKind, id: string) => objectGroups.filter((group) => group.kind === kind && group.itemIds.includes(id)).map(groupPathName)
  const coverImageStyle = (item: Playlist | Tag): React.CSSProperties => ({
    left: `calc(50% + ${item.coverX ?? 0}%)`,
    top: `calc(50% + ${item.coverY ?? 0}%)`,
    transform: `translate(-50%, -50%) scale(${item.coverScale ?? 1})`,
  })
  const coverFrameStyle = (item: Playlist | Tag): React.CSSProperties => ({ background: item.coverBackground ?? '#111827' })

  const renderPlaylistCard = (playlist: Playlist) => { const surfaceColor = objectSurfaceColor('playlist', playlist.id); const groups = groupNamesForItem('playlist', playlist.id); return <div className="playlist-card-wrap" key={playlist.id}><button className={`playlist-card${surfaceColor ? ' custom-surface' : ''}`} style={surfaceStyle(surfaceColor)} type="button" onClick={() => void openPlaylist(playlist.id)}><span className="playlist-card-cover cover-media" style={coverFrameStyle(playlist)}>{coverUrls[playlist.id] ? <img className="positioned-cover-image" style={coverImageStyle(playlist)} src={coverUrls[playlist.id]} alt="" /> : '♫'}</span><strong><span className="card-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{playlist.name}</strong><small>{playlist.songIds.length} {playlist.songIds.length === 1 ? 'Lied' : 'Lieder'}</small><small className="card-group-membership">{groups.length ? `Gruppe: ${groups.join(' · ')}` : 'Keine Gruppe'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'playlist', id: playlist.id })}>•••</button></div> }
  const renderTagCard = (tag: Tag) => {
    const activeSongCount = tag.songIds.filter((id) => songs.some((song) => song.id === id)).length
    const activePlaylistCount = tag.playlistIds.filter((id) => playlists.some((playlist) => playlist.id === id)).length
    const groups = groupNamesForItem('tag', tag.id)
    return <div className="playlist-card-wrap tag-card-wrap" key={tag.id}><button className="playlist-card tag-card" type="button" onClick={() => void openTag(tag.id)}><span className="playlist-card-cover tag-card-cover cover-media" style={{ ...coverFrameStyle(tag), borderColor: tag.color, boxShadow: `0 0 0 2px ${tag.color}` }}>{tagCoverUrls[tag.id] ? <img className="positioned-cover-image" style={coverImageStyle(tag)} src={tagCoverUrls[tag.id]} alt="" /> : <span className="tag-card-placeholder" style={{ color: tag.color }}>●</span>}</span><strong><i className="tag-dot" style={{ background: tag.color }} /> {tag.name}</strong><small>{activeSongCount} {activeSongCount === 1 ? 'Lied' : 'Lieder'} · {activePlaylistCount} {activePlaylistCount === 1 ? 'Playlist' : 'Playlists'}</small><small className="card-group-membership">{groups.length ? `Gruppe: ${groups.join(' · ')}` : 'Keine Gruppe'}</small></button><button className="overflow-button card-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'tag', id: tag.id })}>•••</button></div>
  }
  const renderSongGroup = (group: ObjectGroup, depth = 0, parentContainerKey?: string, parentBaseTokens: string[] = []): React.ReactNode => {
    const parentBundleClass = parentContainerKey ? bundleDisplayClass(parentContainerKey, parentBaseTokens, groupToken(group.id)) : ''
    const children = sortedGroupsFor('song', visibleSongs, group.id)
    const items = orderedGroupItems(group, visibleSongs) as Song[]
    const baseTokens = [...children.filter((child) => !child.afterItems).map((child) => groupToken(child.id)), ...items.map((item) => itemToken(item.id)), ...children.filter((child) => child.afterItems).map((child) => groupToken(child.id))]
    const containerKey = groupContainerKey('song', group.id)
    const order = orderedTokensForContainer(containerKey, baseTokens, containerManualMode('song', group.id))
    const childMap = new Map(children.map((child) => [child.id, child])); const itemMap = new Map(items.map((item) => [item.id, item]))
    return <section className={`object-group song-object-group${depth ? ' nested-object-group' : ''}${parentBundleClass}`} key={group.id}>{renderGroupHeader(group, visibleSongs, parentContainerKey, parentBaseTokens)}{!collapsedGroupIds.has(group.id) && <>{order.map((token, index) => <Fragment key={token}>{renderBulkMoveDropZone(group.id, index)}{renderSingleMoveZone('song', group.id, index)}{isGroupToken(token) ? renderSongGroup(childMap.get(tokenId(token))!, depth + 1, containerKey, baseTokens) : renderSongRow(itemMap.get(tokenId(token))!, index, group.id, containerKey, baseTokens)}</Fragment>)}{renderBulkMoveDropZone(group.id, order.length)}{renderSingleMoveZone('song', group.id, order.length)}</>}</section>
  }
  const renderPlaylistGroup = (group: ObjectGroup, depth = 0, parentContainerKey?: string, parentBaseTokens: string[] = []): React.ReactNode => {
    const parentBundleClass = parentContainerKey ? bundleDisplayClass(parentContainerKey, parentBaseTokens, groupToken(group.id)) : ''
    const children = sortedGroupsFor('playlist', sidebarPlaylists, group.id)
    const items = orderedGroupItems(group, sidebarPlaylists) as Playlist[]
    const baseTokens = [...children.filter((child) => !child.afterItems).map((child) => groupToken(child.id)), ...items.map((item) => itemToken(item.id)), ...children.filter((child) => child.afterItems).map((child) => groupToken(child.id))]
    const containerKey = groupContainerKey('playlist', group.id)
    const order = orderedTokensForContainer(containerKey, baseTokens, containerManualMode('playlist', group.id))
    const childMap = new Map(children.map((child) => [child.id, child])); const itemMap = new Map(items.map((item) => [item.id, item]))
    return <section className={`object-group sidebar-object-group${depth ? ' nested-object-group' : ''}${parentBundleClass}`} key={group.id}>{renderGroupHeader(group, sidebarPlaylists, parentContainerKey, parentBaseTokens)}{!collapsedGroupIds.has(group.id) && <>{order.map((token, index) => <Fragment key={token}>{renderSingleMoveZone('playlist', group.id, index)}{isGroupToken(token) ? renderPlaylistGroup(childMap.get(tokenId(token))!, depth + 1, containerKey, baseTokens) : renderPlaylistRow(itemMap.get(tokenId(token))!, index, group.id, containerKey, baseTokens)}</Fragment>)}{renderSingleMoveZone('playlist', group.id, order.length)}</>}</section>
  }
  const renderTagGroup = (group: ObjectGroup, depth = 0, parentContainerKey?: string, parentBaseTokens: string[] = []): React.ReactNode => {
    const parentBundleClass = parentContainerKey ? bundleDisplayClass(parentContainerKey, parentBaseTokens, groupToken(group.id)) : ''
    const children = sortedGroupsFor('tag', sidebarTags, group.id)
    const items = orderedGroupItems(group, sidebarTags) as Tag[]
    const baseTokens = [...children.filter((child) => !child.afterItems).map((child) => groupToken(child.id)), ...items.map((item) => itemToken(item.id)), ...children.filter((child) => child.afterItems).map((child) => groupToken(child.id))]
    const containerKey = groupContainerKey('tag', group.id)
    const order = orderedTokensForContainer(containerKey, baseTokens, containerManualMode('tag', group.id))
    const childMap = new Map(children.map((child) => [child.id, child])); const itemMap = new Map(items.map((item) => [item.id, item]))
    return <section className={`object-group sidebar-object-group${depth ? ' nested-object-group' : ''}${parentBundleClass}`} key={group.id}>{renderGroupHeader(group, sidebarTags, parentContainerKey, parentBaseTokens)}{!collapsedGroupIds.has(group.id) && <>{order.map((token, index) => <Fragment key={token}>{renderSingleMoveZone('tag', group.id, index)}{isGroupToken(token) ? renderTagGroup(childMap.get(tokenId(token))!, depth + 1, containerKey, baseTokens) : renderTagRow(itemMap.get(tokenId(token))!, index, group.id, containerKey, baseTokens)}</Fragment>)}{renderSingleMoveZone('tag', group.id, order.length)}</>}</section>
  }
  const renderPlaylistOverviewGroup = (group: ObjectGroup, depth = 0, inheritedMatch = false): React.ReactNode => {
    const query = playlistOverviewSearch.trim()
    const groupMatch = Boolean(query) && searchIncludesGroups && fuzzyMatch(group.name, query)
    const includeAll = !query || inheritedMatch || groupMatch
    const children = sortedGroupsFor('playlist', sidebarPlaylists, group.id)
    const before = children.filter((child) => !child.afterItems).map((child) => renderPlaylistOverviewGroup(child, depth + 1, includeAll)).filter(Boolean)
    const after = children.filter((child) => child.afterItems).map((child) => renderPlaylistOverviewGroup(child, depth + 1, includeAll)).filter(Boolean)
    const items = (orderedGroupItems(group, sidebarPlaylists) as Playlist[]).filter((item) => includeAll || fuzzyMatch(item.name, query))
    if (query && !groupMatch && !items.length && !before.length && !after.length) return null
    return <section className={`object-group overview-object-group${depth ? ' nested-object-group' : ''}`} key={group.id}>{renderGroupHeader(group, sidebarPlaylists)}{!collapsedGroupIds.has(group.id) && <>{before}<div className="playlist-grid">{items.map(renderPlaylistCard)}</div>{after}</>}</section>
  }
  const renderTagOverviewGroup = (group: ObjectGroup, depth = 0, inheritedMatch = false): React.ReactNode => {
    const query = tagOverviewSearch.trim()
    const groupMatch = Boolean(query) && searchIncludesGroups && fuzzyMatch(group.name, query)
    const includeAll = !query || inheritedMatch || groupMatch
    const children = sortedGroupsFor('tag', sidebarTags, group.id)
    const before = children.filter((child) => !child.afterItems).map((child) => renderTagOverviewGroup(child, depth + 1, includeAll)).filter(Boolean)
    const after = children.filter((child) => child.afterItems).map((child) => renderTagOverviewGroup(child, depth + 1, includeAll)).filter(Boolean)
    const items = (orderedGroupItems(group, sidebarTags) as Tag[]).filter((item) => includeAll || fuzzyMatch(item.name, query))
    if (query && !groupMatch && !items.length && !before.length && !after.length) return null
    return <section className={`object-group overview-object-group tag-overview-group${depth ? ' nested-object-group' : ''}`} key={group.id}>{renderGroupHeader(group, sidebarTags)}{!collapsedGroupIds.has(group.id) && <>{before}<div className="playlist-grid">{items.map(renderTagCard)}</div>{after}</>}</section>
  }
  const repeatBadge = repeatSetting?.kind === 'infinite' ? '∞' : repeatSetting?.kind === 'count' ? String(repeatRemaining ?? repeatSetting.count) : null
  const overflowMenuOnLeftSide = Boolean(overflowMenu && (
    overflowMenu.kind === 'playlists' || overflowMenu.kind === 'playlist' || overflowMenu.kind === 'tags' || overflowMenu.kind === 'tag' ||
    (overflowMenu.kind === 'group' && objectGroups.find((group) => group.id === overflowMenu.id)?.kind !== 'song')
  ))
  const overlayWindowOpen = Boolean(
    importDraftItems.length || selectedSongsListOpen || selectionSourceKind || selectionObjectEditMode || coverEditorDraft || playlistChooserMode || tagChooserTarget || sidebarMoveKind || sidebarSelectionConfirmation ||
    pendingGroupCreate || groupRenameId || groupSortId || groupDeleteTargetId || groupNestingTarget || groupMembershipTarget ||
    groupPlaybackChooserOpen || repeatMenuOpen || sidebarSortTarget || duplicateConflict || tagToDelete || loopConfirmation ||
    trashConfirmation || sortSaveDialogTarget || sortSaveRenameId || settingsOpen || selectionConfirmation || loopManualRequest ||
    creationPlacement || renameTarget || songToDelete || playlistToDelete
  )

  const songEditMode = reorderScope === (activePlaylist ? 'playlist' : 'library') && view === 'library'
  const tagEditMode = reorderScope === 'tags'
  const newImportCount = songs.filter((song) => song.isNew).length
  const title = view === 'history' ? 'Importverlauf' : view === 'loops' ? 'Loops' : view === 'trash' ? 'Papierkorb' : view === 'tag' ? activeTag?.name ?? 'Tag' : activePlaylist?.name ?? 'Bibliothek'
  const trashCount = trashedSongs.length + trashedPlaylists.length + trashedTags.length + songs.filter((song) => song.trashedLoop).length
  const sortLabels: Record<SortMode, string> = { manual: 'Eigene Reihenfolge', azStart: 'A–Z Anfang', azEnd: 'A–Z Ende', plays: 'Anzahl des Hörens', duration: 'Dauer', chronology: 'Chronik' }
  const tagSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }
  const playlistSortLabels: Record<SortMode, string> = { ...sortLabels, duration: 'Anzahl der Lieder' }
  const loopLeft = editorDuration ? (loopDraftStart / editorDuration) * 100 : 0
  const loopWidth = editorDuration ? Math.max(0, ((loopDraftEnd - loopDraftStart) / editorDuration) * 100) : 0
  const cursorLeft = editorDuration ? (loopCursor / editorDuration) * 100 : 0
  const focusLeft = editorDuration ? (loopFocus / editorDuration) * 100 : 0
  const edgeStepSeconds = parsedEdgeStep()
  const focusStepSeconds = parseEditorSeconds(focusStep, 1)
  const cursorStepSeconds = parseEditorSeconds(cursorStep, 5)
  const markerStepSeconds = parseEditorSeconds(markerStep, 1)
  const activeMarker = activeMarkerIndex === null ? null : loopMarkers[activeMarkerIndex] ?? null
  const handleAudioTimeUpdate = (audio: HTMLAudioElement) => { if (currentPlaybackAudio() !== audio) return; setCurrentTime(audio.currentTime); if (loopEditorSongId) setLoopCursor(audio.currentTime) }
  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (loopTransitionRef.current?.outgoing === audio || currentPlaybackAudio() !== audio) return
    const remaining = repeatRemainingRef.current ?? 0
    const finiteAvailable = repeatSetting?.kind !== 'count' || remaining > 0
    const loopActive = isLoopActive(currentSong)
    if (loopActive && currentSong?.loopStart !== undefined && currentSong.loopEnd !== undefined && finiteAvailable) {
      const automatic = loopOverlapBlockedRef.current ? automaticLoopSeamsRef.current.get(currentSong.id) : undefined
      audio.currentTime = automatic?.start ?? currentSong.loopStart
      setCurrentTime(audio.currentTime)
      if (repeatSetting?.kind === 'count') consumeRepeat()
      void audio.play().catch(() => undefined)
      return
    }
    if (currentSong && !loopActive && repeatSetting?.kind === 'infinite') { restartFinishedAudio(audio); return }
    if (currentSong && !loopActive && repeatSetting?.kind === 'count' && remaining > 0) { consumeRepeat(); restartFinishedAudio(audio); return }
    if (currentSong) void updateSong({ ...currentSong, completedPlays: (currentSong.completedPlays ?? 0) + 1 })
    moveSong(1)
  }

  return <div className={`app-shell${sidePaneScrollLocked ? ' side-pane-scroll-locked' : ''}`}>
    <header className="site-header">
      <div className="history-controls" aria-label="Navigation und Verlauf"><button className="home-button" type="button" onClick={goHome} aria-label="Bibliothek">⌂</button><button className="settings-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">⚙</button><button type="button" onClick={navigateBack} disabled={navigationIndex === 0 && !loopEditorSongId}>‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1 || Boolean(loopEditorSongId)}>›</button><button type="button" onClick={() => void undo()} disabled={!undoStack.length || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↶</button><button type="button" onClick={() => void redo()} disabled={(!redoStack.length && !cancelledDuplicateAction) || Boolean(moveCandidate) || Boolean(loopEditorSongId)}>↷</button>{moveCandidate && <><button className="confirm-move" type="button" onClick={() => void confirmPendingMove()} disabled={moveCandidate.targetIndex === null}>✓</button><button className="cancel-move" type="button" onClick={() => setMoveCandidate(null)}>×</button></>}</div>
      <div className="header-right-actions">{layoutEditMode && <button className="layout-finish-button" type="button" onClick={finishLayoutEditing}>Layout fertig</button>}<button className="import-button" type="button" onClick={openImportPicker}>+ Musik importieren</button></div><input ref={fileInputRef} className="file-input" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac" multiple onChange={(event) => void importFiles(event.target.files)} /><input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(event) => void changeObjectCover(event.target.files)} />
    </header>
    {overlayWindowOpen && <div className="dialog-history-controls"><button type="button" onClick={() => void undo()} disabled={importDraftItems.length ? !importDraftUndoStack.length : !undoStack.length || Boolean(moveCandidate)}>↶</button><button type="button" onClick={() => void redo()} disabled={importDraftItems.length ? !importDraftRedoStack.length && !redoStack.length : !redoStack.length && !cancelledDuplicateAction}>↷</button></div>}
    {importDraftItems.length > 0 && (() => {
      const draftItems = sortedImportDraftItems()
      const modeActive = importDraftSelectionMode || importDraftRenameOpen || importDraftReorderMode || importDraftMoveMode
      const targetIds = new Set(importDraftTargetIds())
      const reviewItems = importMoveReviewIds.map((id) => importDraftItems.find((item) => item.id === id)).filter((item): item is ImportDraftItem => Boolean(item))
      const placing = importMoveStep === 'place'
      return <div className={`modal-backdrop import-workspace-backdrop${placing ? ' import-placement-active' : ''}`}>
        {!placing && <section className="import-workspace" onClick={(event) => event.stopPropagation()}>
          <div className="import-workspace-topbar">
            <div className="import-history-spacer" aria-hidden="true" />
            {modeActive && <button className="import-mode-cancel" type="button" onClick={() => {
              if (importDraftRenameOpen) { setImportDraftRenameOpen(false); return }
              if (importDraftMoveMode) { setImportDraftConfirmation('cancel'); return }
              cancelImportDraftMode()
            }}>{importDraftRenameOpen ? 'Fertig' : 'Abbrechen'}</button>}
            <div className="import-workspace-title"><small>MUSIK IMPORTIEREN</small><strong>{importDraftItems.length} {importDraftItems.length === 1 ? 'Lied' : 'Lieder'}</strong></div>
          </div>
          <div className="import-workspace-toolbar">
            <div className="import-sort-controls"><select value={importDraftSortMode} onChange={(event) => setImportDraftSortMode(event.target.value as SortMode)} disabled={importDraftReorderMode || importDraftMoveMode}><option value="manual">Manuell</option><option value="azStart">A–Z Anfang</option><option value="azEnd">A–Z Ende</option><option value="chronology">Auswahlreihenfolge</option></select><button type="button" disabled={importDraftSortMode === 'manual' || importDraftReorderMode || importDraftMoveMode} onClick={() => setImportDraftSortDirection((value) => value === 'down' ? 'up' : 'down')}>{importDraftSortMode === 'manual' ? '—' : importDraftSortDirection === 'down' ? '↓' : '↑'}</button></div>
            <div className="import-menu-wrap"><button className="import-menu-button" type="button" onClick={() => setImportDraftMenuOpen((value) => !value)}>•••</button>{importDraftMenuOpen && <><button className="import-menu-shield" type="button" onClick={() => setImportDraftMenuOpen(false)} /><div className="import-action-menu"><button type="button" onClick={beginImportDraftSelection}>Auswählen</button><button type="button" onClick={() => { recordImportDraftHistory(); setImportDraftRenameOpen(true); setImportDraftMenuOpen(false) }}>Umbenennen</button><button type="button" onClick={() => { setImportDraftSortMode('manual'); setImportDraftReorderMode(true); setImportDraftMoveMode(false); setImportMoveStep(null); setImportDraftMenuOpen(false) }}>Reihenfolge ändern</button><button type="button" onClick={beginImportMove}>Bewegen</button></div></>}</div>
          </div>
          {importDraftSelectionMode && <div className="import-selection-status"><span>{importDraftSelectedIds.size} ausgewählt</span><span className="import-selection-buttons"><button type="button" onClick={() => setImportDraftSelectedIds(new Set(importDraftItems.map((item) => item.id)))}>Alles auswählen</button><button type="button" onClick={() => setImportDraftSelectedIds(new Set())}>Nichts auswählen</button></span></div>}
          <div className="import-draft-list">
            {draftItems.map((item, index) => <div className={`import-draft-row${targetIds.has(item.id) ? ' targeted' : ''}`} key={item.id}>
              {importDraftSelectionMode && <button className="selection-check" type="button" onClick={() => toggleImportDraftSelected(item.id)}>{importDraftSelectedIds.has(item.id) ? '✓' : ''}</button>}
              <span className="import-draft-index">{index + 1}</span>
              {importDraftRenameOpen && targetIds.has(item.id) ? <input value={item.name} onChange={(event) => updateImportDraftName(item.id, event.target.value)} /> : <strong>{item.name}</strong>}
              <small>{item.file.name}</small>
              {importDraftReorderMode && <span className="import-draft-reorder"><button type="button" onClick={() => moveImportDraftItem(item.id, -1)}>↑</button><button type="button" onClick={() => moveImportDraftItem(item.id, 1)}>↓</button></span>}
            </div>)}
          </div>
          {importMoveStep === 'select' ? <div className="import-workspace-actions import-move-step-actions"><button type="button" onClick={() => setImportDraftConfirmation('cancel')}>Abbrechen</button><button type="button" onClick={cancelImportMoveFlow}>Zurück</button><button className="primary-import-finish" type="button" disabled={!importDraftSelectedIds.size} onClick={confirmImportMoveSelection}>Bestätigen</button></div> : <div className="import-workspace-actions"><button type="button" onClick={() => setImportDraftConfirmation('cancel')}>Abbrechen</button><button className="primary-import-finish" type="button" onClick={() => setImportDraftConfirmation('finish')}>Fertig</button></div>}
        </section>}
        {importMoveStep === 'review' && <div className="import-move-review-layer"><section className="import-move-review-dialog"><div className="playlist-chooser-heading"><div><p className="eyebrow">BEWEGEN</p><h2>Auswahl prüfen</h2></div><span>{reviewItems.length} ausgewählt</span></div><p>Entferne Dateien aus dieser Bewegung oder ändere ihre Reihenfolge. Die Dateien selbst bleiben im Import.</p><div className="import-move-review-list">{reviewItems.map((item, index) => <div key={item.id}><span>{index + 1}</span><strong>{item.name}</strong><span className="import-review-actions"><button type="button" onClick={() => moveImportReviewItem(item.id, -1)}>↑</button><button type="button" onClick={() => moveImportReviewItem(item.id, 1)}>↓</button><button type="button" onClick={() => removeImportReviewItem(item.id)}>−</button></span></div>)}</div><div className="dialog-actions import-review-footer"><button type="button" onClick={() => setImportDraftConfirmation('cancel')}>Abbrechen</button><button type="button" onClick={() => setImportMoveStep('select')}>Zurück</button><button type="button" disabled={!reviewItems.length} onClick={openImportLibraryPlacement}>Bestätigen</button></div></section></div>}
        {placing && <div className="import-library-placement-controls"><strong>{importMoveReviewIds.length} {importMoveReviewIds.length === 1 ? 'Lied' : 'Lieder'} in Bibliothek platzieren</strong><span>Wähle einen roten Strich.</span><div><button type="button" onClick={() => setImportDraftConfirmation('cancel')}>Abbrechen</button><button type="button" onClick={backFromImportPlacement}>Zurück</button><button type="button" disabled={importLibraryTargetIndex === null} onClick={confirmImportLibraryPlacement}>Bestätigen</button></div></div>}
        {importDraftConfirmation && <div className="import-confirm-layer"><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>{importDraftConfirmation === 'finish' ? 'Import abschließen?' : 'Import abbrechen?'}</h2><p>{importDraftConfirmation === 'finish' ? `${importDraftItems.length} ${importDraftItems.length === 1 ? 'Lied wird' : 'Lieder werden'} jetzt lokal gespeichert.` : 'Die ausgewählten Dateien werden nicht importiert.'}</p><div className="dialog-actions"><button type="button" onClick={() => setImportDraftConfirmation(null)}>Zurück</button>{importDraftConfirmation === 'finish' ? <button type="button" onClick={() => void commitImportDraft()}>Importieren</button> : <button className="danger-button" type="button" onClick={discardImportDraft}>Nicht importieren</button>}</div></div></div>}
      </div>
    })()}
    {singleMoveTarget && <div className="single-move-hint"><span>Zielstrich wählen und doppelt antippen. Der Modus bleibt aktiv.</span><button type="button" onClick={cancelSingleMove}>Abbrechen</button></div>}
    {sidebarMoveKind && <div className="single-move-hint persistent-move-hint"><span>Bewegen bleibt aktiv.</span><button type="button" onClick={() => { setSidebarMoveKind(null); setChooserSearch('') }}>Abbrechen</button></div>}
    {bulkMoveMode && <div className="single-move-hint persistent-move-hint"><span>Rote Striche verschieben die Auswahl als Block.</span><button type="button" onClick={() => { setBulkMoveMode(false); setBulkMoveContext(null) }}>Abbrechen</button><button type="button" onClick={finishSelectedMove}>Fertig</button></div>}
    {reorderScope && !bulkMoveMode && <div className="single-move-hint reorder-mode-hint"><span>Reihenfolge mit Pfeilen verändern.</span><button type="button" onClick={() => { cleanupBundleSingletons(); setReorderScope(null); setMoveCandidate(null) }}>Abbrechen</button><button type="button" onClick={finishReorder}>Fertig</button></div>}
    {selectionMode && !bulkMoveMode && !reorderScope && !selectedSongsListOpen && <div className="single-move-hint selection-mode-hint"><span>{selectedSongIds.size ? `${selectedSongIds.size} ausgewählt` : 'Dateien auswählen'}</span><button type="button" onClick={stopSelection}>Abbrechen</button><button type="button" onClick={finishSelection}>Fertig</button></div>}

    {view !== 'playlistOverview' && view !== 'tagOverview' && <main className={`music-layout custom-layout${layoutEditMode ? ' layout-editing' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}><aside className="sidebar">
      <button className={`nav-item${view === 'library' && !activePlaylistId ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'library', playlistId: null, detailOpen: false })}><span>Bibliothek</span><strong>{songs.length}</strong></button>
      <button className={`nav-item history-nav${view === 'history' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'history', playlistId: null, detailOpen: false })}><span>Importverlauf</span><strong><span className="new-count-blue">{newImportCount}</span>/{songs.length}</strong></button>
      <button className={`nav-item history-nav${view === 'loops' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'loops', playlistId: null, detailOpen: false })}><span>Loops</span><strong>{songs.filter((song) => song.loopStart !== undefined && song.loopEnd !== undefined).length}</strong></button>
      <button className={`nav-item history-nav${view === 'trash' ? ' active' : ''}`} type="button" onClick={() => navigateTo({ view: 'trash', playlistId: null, detailOpen: false })}><span>Papierkorb</span><strong>{trashCount}</strong></button>
      <div className="sidebar-heading collapsible-heading" onClick={() => setPlaylistsCollapsed((value) => !value)}><span className="heading-label"><b className="section-chevron">{playlistsCollapsed ? '▸' : '▾'}</b> Playlists</span>{sidebarSelectionKind === 'playlist' && <button className="select-all-inline" type="button" onClick={(event) => { event.stopPropagation(); selectAllPlaylists() }}>Alle auswählen</button>}<button className="overflow-button small-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'playlists' }) }}>•••</button>{reorderScope === 'sidebar' && <button className="finish-inline" type="button" onClick={(event) => { event.stopPropagation(); finishReorder() }}>Fertig</button>}</div>
      {!playlistsCollapsed && <><div className="playlist-nav grouped-sidebar-list">{playlistRootOrder.map((token, index) => <Fragment key={token}>{renderSingleMoveZone('playlist', undefined, index)}{isGroupToken(token) ? renderPlaylistGroup(playlistGroupMap.get(tokenId(token))!, 0, playlistRootKey, playlistRootBaseTokens) : renderPlaylistRow(playlistItemMap.get(tokenId(token))!, index, undefined, playlistRootKey, playlistRootBaseTokens)}</Fragment>)}{renderSingleMoveZone('playlist', undefined, playlistRootOrder.length)}</div>
      <form className="new-playlist" onSubmit={createPlaylist}><input value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="Neue Playlist" /><button type="submit" disabled={!playlistName.trim()}>+</button></form></>}
      <div className="sidebar-heading collapsible-heading tag-heading" onClick={() => setTagsCollapsed((value) => !value)}><span className="heading-label"><b className="section-chevron">{tagsCollapsed ? '▸' : '▾'}</b> Tags</span><button className="overflow-button small-overflow" type="button" onClick={(event) => { event.stopPropagation(); setOverflowMenu({ kind: 'tags' }) }}>•••</button>{tagEditMode && <button className="finish-inline" type="button" onClick={(event) => { event.stopPropagation(); finishReorder() }}>Fertig</button>}</div>
      {!tagsCollapsed && <><div className="tag-nav grouped-sidebar-list">{tagRootOrder.map((token, index) => <Fragment key={token}>{renderSingleMoveZone('tag', undefined, index)}{isGroupToken(token) ? renderTagGroup(tagGroupMap.get(tokenId(token))!, 0, tagRootKey, tagRootBaseTokens) : renderTagRow(tagItemMap.get(tokenId(token))!, index, undefined, tagRootKey, tagRootBaseTokens)}</Fragment>)}{renderSingleMoveZone('tag', undefined, tagRootOrder.length)}</div><form className="new-playlist new-tag" onSubmit={createTag}><span className="new-object-create-label">Neuer Tag</span><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Name" aria-label="Neuer Tag" /><div className="tag-color-picker-wrap rainbow-ring"><button className="tag-color-trigger" type="button" style={{ background: tagColor }} onClick={() => setColorPickerTarget('create')} aria-label="Tag-Farbe wählen" /></div><button type="submit" disabled={!tagName.trim()}>+</button></form></>}
    </aside>{layoutEditMode && <button className="library-layout-handle" style={{ left: `${sidebarWidth}px` }} type="button" aria-label="Breite der linken Spalte verändern" onPointerDown={(event) => { event.preventDefault(); setLayoutDrag('sidebar') }} />}

    <section className="library-panel"><div className={`library-heading${activePlaylist ? ' playlist-heading' : ''}`}>
      {activePlaylist && view === 'library' && <button className="playlist-cover cover-media" style={coverFrameStyle(activePlaylist)} type="button" onClick={() => openPlaylistCoverPicker(activePlaylist.id)}>{coverUrls[activePlaylist.id] ? <img className="positioned-cover-image" style={coverImageStyle(activePlaylist)} src={coverUrls[activePlaylist.id]} alt="" /> : <span>+ Bild</span>}</button>}
      <div className="library-title">{!(view === 'library' && !activePlaylist) && <p className="eyebrow">{view === 'history' ? 'IMPORTVERLAUF' : view === 'loops' ? 'GESPEICHERTE LOOPS' : view === 'trash' ? 'PAPIERKORB' : view === 'tag' ? 'TAG' : 'PLAYLIST'}</p>}{activePlaylist && view === 'library' && isEditingPlaylist ? <form className="rename-playlist" onSubmit={savePlaylistName}><input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button type="submit">Speichern</button><button type="button" onClick={() => setIsEditingPlaylist(false)}>Abbrechen</button></form> : <h1>{title}</h1>}<p>{view === 'history' ? <><span className="new-count-blue">{newImportCount}</span>/{songs.length} neue Importe</> : view === 'trash' ? `${trashCount} ${trashCount === 1 ? 'Eintrag' : 'Einträge'}` : view === 'tag' && activeTag ? `${activeTag.songIds.filter((id) => songs.some((song) => song.id === id)).length} Lieder · ${taggedPlaylists.length} Playlists · ${taggedGroups.length} Gruppen` : `${visibleSongs.length} ${visibleSongs.length === 1 ? 'Lied' : 'Lieder'}`}</p>{activePlaylist && view === 'library' && <p className="object-group-detail-line">Gruppe: {groupNamesForItem('playlist', activePlaylist.id).length ? groupNamesForItem('playlist', activePlaylist.id).join(' · ') : 'Keine Gruppe'}</p>}{activeTag && view === 'tag' && <p className="object-group-detail-line">Gruppe: {groupNamesForItem('tag', activeTag.id).length ? groupNamesForItem('tag', activeTag.id).join(' · ') : 'Keine Gruppe'}</p>}</div>
      <div className="playlist-actions">{!selectionMode && view !== 'trash' && <button type="button" onClick={() => startSelection()}>Auswählen</button>}{view === 'trash' && <button className="danger-button" type="button" onClick={() => setTrashConfirmation(true)} disabled={!trashCount}>Papierkorb leeren</button>}{selectionMode && <><button type="button" onClick={selectAllVisible}>Alle</button><button type="button" onClick={stopSelection}>Abbrechen</button></>}{activePlaylist && view === 'library' && !selectionMode && <><button type="button" onClick={startEditingPlaylist}>Name ändern</button><button type="button" onClick={() => openPlaylistCoverPicker(activePlaylist.id)}>Bild ändern</button><button type="button" onClick={() => reorderScope === 'playlist' ? finishReorder() : beginReorder('playlist')}>{reorderScope === 'playlist' ? 'Fertig' : 'Reihenfolge ändern'}</button></>}{!activePlaylist && view === 'library' && !selectionMode && <button type="button" onClick={() => reorderScope === 'library' ? finishReorder() : beginReorder('library')}>{reorderScope === 'library' ? 'Fertig' : 'Reihenfolge ändern'}</button>}</div>
    </div>
    {view === 'tag' && taggedPlaylists.length > 0 && <div className="tagged-playlists-strip"><span>PLAYLISTS</span>{taggedPlaylists.map((playlist) => <button key={playlist.id} type="button" onClick={() => void openPlaylist(playlist.id)}><span className="nav-tag-dots">{playlistTags(playlist.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{playlist.name}</button>)}</div>}
    {view === 'tag' && taggedGroups.length > 0 && <div className="tagged-playlists-strip tagged-groups-strip"><span>GRUPPEN</span>{taggedGroups.map((group) => <span className="tagged-group-chip" key={group.id}><span className="nav-tag-dots">{groupTags(group.id).map((tag) => <i key={tag.id} className="tag-dot" style={{ background: tag.color }} />)}</span>{group.name}</span>)}</div>}
    {view === 'library' && <div className="search-bar"><span aria-hidden="true">⌕</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activePlaylist ? 'Playlist durchsuchen' : 'Bibliothek durchsuchen'} aria-label={activePlaylist ? 'Playlist durchsuchen' : 'Bibliothek durchsuchen'} /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button>{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Suche leeren">×</button>}</div>}
    {view !== 'trash' && <div className="sort-bar"><span>Sortierung</span><div className="library-sort-picker"><button className="library-sort-picker-button" type="button" onClick={() => { setLibrarySortPickerOpen((value) => !value); setSortMenuOpen(false) }}>{sortMode === 'manual' ? activeSortSave('song')?.name ?? 'Save' : sortLabels[sortMode]}<b>▾</b></button>{librarySortPickerOpen && <><button className="sort-picker-shield" type="button" onClick={() => setLibrarySortPickerOpen(false)} /><div className="library-sort-picker-menu">{(Object.keys(sortLabels) as SortMode[]).filter((mode) => mode !== 'manual').map((mode) => <button className={sortMode === mode ? 'active-sort-save' : ''} type="button" key={mode} onClick={() => { changeSortSelection('song', `auto:${mode}`); setLibrarySortPickerOpen(false) }}>{sortLabels[mode]}</button>)}<div className="sort-picker-divider" />{sortSavesFor('song').map((save) => <button className={activeSortSave('song')?.id === save.id && sortMode === 'manual' ? 'active-sort-save' : ''} type="button" key={save.id} onPointerDown={() => beginSortSaveHold(save)} onPointerUp={endSortSaveHold} onPointerCancel={endSortSaveHold} onPointerLeave={endSortSaveHold} onClick={() => { activateSortSaveButton(save); setLibrarySortPickerOpen(false) }}>{save.name}</button>)}</div></>}</div><button type="button" className="sort-direction" disabled={sortMode === 'manual'} onClick={() => setSortDirection((value) => value === 'down' ? 'up' : 'down')}>{sortMode === 'manual' ? '—' : sortDirection === 'down' ? '↓' : '↑'}</button></div>}
    {message && <div className="message">{message}</div>}{selectionMode && <div className="selection-hint">{bulkMoveMode ? 'Zielposition in der Liste antippen.' : `${selectedSongIds.size} ausgewählt. Weitere Aktionen findest du über die Auswahlbox.`}</div>}
    {view === 'trash' ? <div className="trash-list">
      {trashedSongs.map((song) => <article className="trash-item" key={`trash-song-${song.id}`}><div><small>LIED</small><strong>{song.name}</strong><span>{song.trashedAt ? formatDate(song.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedSong(song)}>Wiederherstellen</button></article>)}
      {trashedPlaylists.map((playlist) => <article className="trash-item" key={`trash-playlist-${playlist.id}`}><div><small>PLAYLIST</small><strong>{playlist.name}</strong><span>{playlist.trashedAt ? formatDate(playlist.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedPlaylist(playlist)}>Wiederherstellen</button></article>)}
      {trashedTags.map((tag) => <article className="trash-item" key={`trash-tag-${tag.id}`}><div><small>TAG</small><strong><i className="tag-dot" style={{ background: tag.color }} /> {tag.name}</strong><span>{tag.trashedAt ? formatDate(tag.trashedAt) : ''}</span></div><button type="button" onClick={() => void restoreTrashedTag(tag)}>Wiederherstellen</button></article>)}
      {songs.filter((song) => song.trashedLoop).map((song) => <article className="trash-item" key={`trash-loop-${song.id}`}><div><small>LOOP</small><strong>{song.name}</strong><span>{song.trashedLoop ? `${formatPrecise(song.trashedLoop.start)} – ${formatPrecise(song.trashedLoop.end)}` : ''}</span></div><button type="button" onClick={() => void restoreTrashedLoop(song)}>Wiederherstellen</button></article>)}
      {!trashCount && <div className="empty-state trash-empty"><div className="empty-icon">⌫</div><h2>Der Papierkorb ist leer.</h2></div>}
    </div> : (visibleSongs.length || songGroups.length || importMoveStep === 'place') ? <div className="song-list grouped-song-list">{songRootOrder.map((token, index) => <Fragment key={token}>{renderImportLibraryDropZone(index)}{renderBulkMoveDropZone(undefined, index)}{renderSingleMoveZone('song', undefined, index)}{isGroupToken(token) ? renderSongGroup(songGroupMap.get(tokenId(token))!, 0, songRootKey, songRootBaseTokens) : renderSongRow(songItemMap.get(tokenId(token))!, index, undefined, songRootKey, songRootBaseTokens)}</Fragment>)}{renderImportLibraryDropZone(songRootOrder.length)}{renderBulkMoveDropZone(undefined, songRootOrder.length)}{renderSingleMoveZone('song', undefined, songRootOrder.length)}</div> : <div className="empty-state"><div className="empty-icon">♫</div><h2>{view === 'library' && searchQuery.trim() ? 'Keine Treffer.' : view === 'loops' ? 'Noch keine Loops gespeichert.' : view === 'history' ? 'Keine neuen Importe.' : 'Noch keine Musik hier.'}</h2></div>}
    </section></main>}

    {view === 'playlistOverview' && <section className="playlist-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Playlists</h1><p>{playlists.length} Playlists</p><div className="search-bar overview-search-bar"><span aria-hidden="true">⌕</span><input ref={playlistOverviewSearchRef} type="search" value={playlistOverviewSearch} onChange={(event) => setPlaylistOverviewSearch(event.target.value)} placeholder="Playlists oder Gruppen suchen" aria-label="Playlists oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button>{playlistOverviewSearch && <button type="button" onClick={() => setPlaylistOverviewSearch('')} aria-label="Suche leeren">×</button>}</div></div>{playlistGroups.map((group) => renderPlaylistOverviewGroup(group))}<div className="playlist-grid">{ungroupedSidebarPlaylists.filter((playlist) => !playlistOverviewSearch.trim() || fuzzyMatch(playlist.name, playlistOverviewSearch)).map(renderPlaylistCard)}</div></section>}
    {view === 'tagOverview' && <section className="playlist-overview tag-overview"><div className="playlist-overview-heading"><p className="eyebrow">DEINE MUSIK</p><h1>Tags</h1><p>{tags.length} Tags</p><div className="search-bar overview-search-bar"><span aria-hidden="true">⌕</span><input ref={tagOverviewSearchRef} type="search" value={tagOverviewSearch} onChange={(event) => setTagOverviewSearch(event.target.value)} placeholder="Tags oder Gruppen suchen" aria-label="Tags oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button>{tagOverviewSearch && <button type="button" onClick={() => setTagOverviewSearch('')} aria-label="Suche leeren">×</button>}</div></div>{tagGroups.map((group) => renderTagOverviewGroup(group))}<div className="playlist-grid">{ungroupedSidebarTags.filter((tag) => !tagOverviewSearch.trim() || fuzzyMatch(tag.name, tagOverviewSearch)).map(renderTagCard)}</div><form className="overview-create-form new-playlist new-tag" onSubmit={createTag}><span className="new-object-create-label">Neuer Tag</span><input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Name" aria-label="Neuer Tag" /><div className="tag-color-picker-wrap rainbow-ring"><button className="tag-color-trigger" type="button" style={{ background: tagColor }} onClick={() => setColorPickerTarget('create')} aria-label="Tag-Farbe wählen" /></div><button type="submit" disabled={!tagName.trim()}>+</button></form></section>}

    <section className={`player custom-layout${currentSong ? ' visible' : ''}${layoutEditMode ? ' layout-editing' : ''}`} style={{ '--player-left': `${playerSplitLeft}%`, '--player-middle': `${Math.max(12, playerSplitRight - playerSplitLeft)}%`, '--player-right': `${Math.max(12, 100 - playerSplitRight)}%` } as React.CSSProperties}><audio ref={audioRef} src={currentUrl ?? undefined} playsInline preload="auto" onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)} onLoadedMetadata={(event) => { const value = event.currentTarget.duration; setDuration(value); if (currentSong && Number.isFinite(value) && (!currentSong.duration || Math.abs(currentSong.duration - value) > .5)) void updateSong({ ...currentSong, duration: value }) }} onPlay={() => { playbackAudioRef.current ??= audioRef.current; setIsPlaying(true) }} onPause={() => requestAnimationFrame(updatePlayingState)} onError={() => currentSong && setMessage(`„${currentSong.name}“ kann aus dem lokalen Speicher nicht geladen werden.`)} onEnded={(event) => handleAudioEnded(event.currentTarget)} /><audio ref={overlapAudioRef} src={currentUrl ?? undefined} playsInline preload="auto" onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)} onPlay={() => setIsPlaying(true)} onPause={() => requestAnimationFrame(updatePlayingState)} onEnded={(event) => handleAudioEnded(event.currentTarget)} />{layoutEditMode && <><button className="player-layout-handle player-layout-handle-left" style={{ left: `${playerSplitLeft}%` }} type="button" aria-label="Erste Player-Leiste verschieben" onPointerDown={(event) => { event.preventDefault(); setLayoutDrag('playerLeft') }} /><button className="player-layout-handle player-layout-handle-right" style={{ left: `${playerSplitRight}%` }} type="button" aria-label="Zweite Player-Leiste verschieben" onPointerDown={(event) => { event.preventDefault(); setLayoutDrag('playerRight') }} /></>}
      <button className="now-playing" type="button" onClick={() => currentSong && navigateTo({ view, playlistId: activePlaylistId, tagId: activeTagId, detailOpen: true })} disabled={!currentSong}><span className="cover-placeholder">♫</span><span className="now-playing-copy"><small>JETZT</small><span className="marquee"><strong>{currentSong?.name ?? 'Kein Song ausgewählt'}</strong></span></span></button>
      <div className="transport"><div className="transport-buttons"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)} aria-label="Shuffle">⇄</button><button onClick={() => moveSong(-1)} aria-label="Vorheriges Lied">⏮</button><button onClick={() => skipSeconds(-seekSeconds)} aria-label={`${seekSeconds} Sekunden zurück`}>⏪</button><button className="play-button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)} aria-label={`${seekSeconds} Sekunden vor`}>⏩</button><button onClick={() => moveSong(1)} aria-label="Nächstes Lied">⏭</button><button className={repeatQueue || repeatSetting ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatBadge ? `Wiederholung ${repeatBadge}` : 'Liste wiederholen'}><span className="repeat-symbol">↻{repeatBadge && <b>{repeatBadge}</b>}</span></button></div><div className="progress-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div></div>
      <div className="quick-playlists library-quick-actions"><div className="quick-selection-summary">{selectedSongIds.size ? <button type="button" onClick={() => { setChooserSearch(''); setChooserSortMode('manual'); setChooserSortDirection('down'); setSelectedSongsMenuOpen(false); setSelectedSongsFocusId([...selectedSongIds][0] ?? null); setSelectedSongsListOpen(true) }}><span>{selectedSongIds.size === 1 ? songs.find((song) => selectedSongIds.has(song.id))?.name ?? '1 Lied ausgewählt' : `${selectedSongIds.size} Lieder ausgewählt`}</span><strong>▾</strong></button> : <span className="quick-selection-empty">Mit „Auswählen“ Dateien wählen</span>}</div><div className="library-bottom-menu-wrap"><button className={`library-bottom-menu-button${selectedSongIds.size ? ' has-selection' : ''}`} type="button" onClick={() => { setSortMenuOpen((value) => !value); setLibrarySortPickerOpen(false); setOverflowMenu(null) }} aria-label="Weitere Bibliotheksaktionen">•••</button></div></div>
    </section>

    {detailOpen && currentSong && <section className="song-detail"><div className="detail-topbar"><button type="button" onClick={navigateBack}>‹ Zurück</button><button className="overflow-button detail-overflow" type="button" onClick={() => setOverflowMenu({ kind: 'songDetail', id: currentSong.id })} aria-label="Weitere Liedaktionen">•••</button></div><div className="detail-content"><p className="detail-label">JETZT</p><h2>{currentSong.name}</h2><div className="tag-membership-detail"><span>TAGS</span><strong>{currentSongTags.length ? currentSongTags.map((tag) => <span className="detail-tag-chip" key={tag.id}><i className="tag-dot" style={{ background: tag.color }} />{tag.name}</span>) : 'Keine Tags'}</strong></div><div className="playlist-membership"><span>IN PLAYLISTS</span><strong>{currentSongPlaylists.length ? currentSongPlaylists.map((playlist) => playlist.name).join(' · ') : 'In keiner Playlist'}</strong></div><div className="playlist-membership group-membership-detail"><span>IN GRUPPEN</span><strong>{groupNamesForItem('song', currentSong.id).length ? groupNamesForItem('song', currentSong.id).join(' · ') : 'In keiner Gruppe'}</strong></div><div className="detail-progress"><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} /><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div></div><div className="detail-controls detail-controls-expanded"><button className={shuffle ? 'active-control' : ''} onClick={() => setShuffle((value) => !value)} aria-label="Shuffle">⇄</button><button onClick={playPreviousFromHistory} disabled={!playHistory.length}>⏮</button><button onClick={() => skipSeconds(-seekSeconds)}>↶<small>{seekSeconds}</small></button><button className="detail-play" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button onClick={() => skipSeconds(seekSeconds)}>↷<small>{seekSeconds}</small></button><button onClick={() => moveSong(1)}>⏭</button><button className={repeatQueue || repeatSetting ? 'active-control repeat-control' : 'repeat-control'} onPointerDown={beginRepeatHold} onPointerUp={endRepeatHold} onPointerCancel={endRepeatHold} onContextMenu={(event) => event.preventDefault()} onClick={handleRepeatClick} aria-label={repeatBadge ? `Wiederholung ${repeatBadge}` : 'Liste wiederholen'}><span className="repeat-symbol">↻{repeatBadge && <b>{repeatBadge}</b>}</span></button></div><div className="loop-panel"><div><span className="loop-panel-label">LOOP</span><h3>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined ? `${formatTime(currentSong.loopStart)} – ${formatTime(currentSong.loopEnd)}` : 'Noch kein Loop'}</h3><p>Den Bereich legst du präzise im Loop-Editor fest.</p></div><div className="loop-actions"><button type="button" onClick={() => openLoopEditor(currentSong.id)}>{currentSong.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{currentSong.loopStart !== undefined && currentSong.loopEnd !== undefined && <><button className={isLoopActive(currentSong) ? 'loop-active' : ''} type="button" onClick={() => void toggleCurrentLoop()}>{isLoopActive(currentSong) ? 'Loop aktiv' : 'Loop aktivieren'}</button><button className="danger-button" type="button" onClick={() => setLoopConfirmation('delete')}>Loop entfernen</button></>}</div></div></div></section>}

    {loopEditorSongId && editorSong && <section className="loop-editor" aria-label="Loop bearbeiten"><div className="loop-editor-scroll"><div className="loop-editor-inner">
      <div className="loop-editor-commandbar">
        <div className="loop-command-history" aria-label="Editor Navigation"><button type="button" onClick={goHome} aria-label="Bibliothek">⌂</button><button type="button" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen">⚙</button><button type="button" onClick={() => setLoopEditorSongId(null)} aria-label="Zurück">‹</button><button type="button" onClick={navigateForward} disabled={navigationIndex >= navigation.length - 1} aria-label="Vor">›</button><button type="button" onClick={undoLoopEditor} disabled={!loopUndoStack.length} aria-label="Rückgängig">↶</button><button type="button" onClick={redoLoopEditor} disabled={!loopRedoStack.length} aria-label="Wiederholen">↷</button></div>
        <div className="loop-command-fields">
          <label className="neutral-command"><span>Zoom</span><select value={loopZoom} onChange={(event) => setLoopZoom(Number(event.target.value))}>{LOOP_ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level}×</option>)}</select></label>
          <label className="cursor-command"><span>Cursor Geschwindigkeit</span><select value={loopPlaybackRate} onChange={(event) => setLoopPlaybackRate(event.target.value)}>{LOOP_PLAYBACK_RATES.map((rate) => <option key={rate} value={String(rate)}>{Math.round(rate * 100)}%</option>)}</select></label>
          <div className="focus-command"><span>Fokus folgt Cursor</span><div className="tri-toggle" role="group" aria-label="Fokus folgt Cursor"><button className={focusFollowMode === 'center' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('center'); setLoopFocus(loopCursor) }} aria-label="Zentrieren">◎</button><button className={focusFollowMode === 'page' ? 'selected' : ''} type="button" onClick={() => { setFocusFollowMode('page'); setLoopFocus(loopCursor) }} aria-label="Umblättern">▣</button><button className={focusFollowMode === 'off' ? 'selected' : ''} type="button" onClick={() => setFocusFollowMode('off')} aria-label="Aus">○</button></div></div>
        </div>
        <div className="loop-command-toggles">
          <label className="loop-command"><span>Loop-Kasten</span><button className={`switch-control${loopSelectionLocked ? ' is-off' : ' is-on'}`} type="button" onClick={() => setLoopSelectionLocked((value) => !value)} aria-label={loopSelectionLocked ? 'Loop-Kasten beweglich machen' : 'Loop-Kasten feststellen'}><i /></button></label>
          <label className="cursor-command"><span>Cursor-Loop</span><button className={`switch-control${cursorLoopEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setCursorLoopEnabled((value) => !value)} aria-label="Cursor-Loop umschalten"><i /></button></label>
          <label className="marker-command"><span>Markierungen</span><button className={`switch-control${markersEnabled ? ' is-on' : ' is-off'}`} type="button" onClick={() => setMarkersEnabled((value) => !value)} aria-label="Markierungen umschalten"><i /></button></label>
          <div className="marker-command-actions"><button className="marker-set-top" type="button" onClick={setMarker} disabled={!markersEnabled}>Markierung setzen</button><button className="marker-clear-all" type="button" onClick={() => setLoopConfirmation('deleteMarkers')} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>
        </div>
      </div>

      <div className="loop-editor-title"><div><p>LOOP EDITOR</p><h1>{editorSong.name}</h1></div><div className="waveform-status">{waveformStatus === 'loading' ? 'Wellenform wird berechnet…' : waveformStatus === 'unavailable' ? 'Wellenform nicht verfügbar' : 'Amplitude'}</div></div>

      <div className="loop-timeline-wrap">
        <div ref={loopTimelineScrollRef} className="loop-timeline-scroll"><div ref={loopTimelineRef} className="loop-timeline precision" style={{ width: `${loopZoom * 100}%` }} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}>
          {waveform.length > 0 && <div className="loop-waveform" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${Math.max(4, height * 92)}%` }} />)}</div>}
          <div className="timeline-guide guide-one" /><div className="timeline-guide guide-two" />
          {markersEnabled && loopMarkers.map((marker, index) => <button key={`${marker}-${index}`} className={`loop-marker${activeMarkerIndex === index ? ' active-marker' : ''}`} type="button" style={{ left: `${editorDuration ? marker / editorDuration * 100 : 0}%` }} onPointerDown={(event) => event.stopPropagation()} onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }} aria-label={`Markierung ${markerLabel(index)}`}><em>{formatPrecise(marker)}</em><span>{markerLabel(index)}</span></button>)}
          <div className={`loop-selection${loopSelectionLocked ? ' locked' : ''}`} style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} onPointerDown={(event) => beginLoopDrag(event, 'move')}><span className="loop-time-bubble loop-start-time">{formatPrecise(loopDraftStart)}</span><button className={`loop-handle start${activeLoopEdge === 'start' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Start verschieben" onPointerDown={(event) => beginLoopDrag(event, 'start')} /><span className="loop-window-label">LOOP</span><button className={`loop-handle end${activeLoopEdge === 'end' ? ' active-edge' : ''}`} type="button" aria-label="Loop-Ende verschieben" onPointerDown={(event) => beginLoopDrag(event, 'end')} /><span className="loop-time-bubble loop-end-time">{formatPrecise(loopDraftEnd)}</span></div>
          <button className="loop-cursor" type="button" style={{ left: `${cursorLeft}%` }} aria-label="Abspielposition verschieben"><em>{formatPrecise(loopCursor)}</em><span onPointerDown={(event) => beginLoopDrag(event, 'cursor')} /></button>
        </div>
        <div ref={loopFocusRef} className={`loop-focus-track${focusFollowMode !== 'off' ? ' follows-cursor' : ''}`} style={{ width: `${loopZoom * 100}%` }} onPointerDown={(event) => beginLoopDrag(event, 'focus')} onPointerMove={moveLoopDrag} onPointerUp={endLoopDrag} onPointerCancel={endLoopDrag}><button type="button" className="loop-focus-cursor" style={{ left: `${focusLeft}%` }} aria-label="Zoom-Fokus verschieben" onPointerDown={(event) => beginLoopDrag(event, 'focus')}><em>{formatPrecise(loopFocus)}</em><span /></button></div>
        </div>
        <div className="loop-time-labels"><span>0:00</span><span>{formatTime(editorDuration)}</span></div>
      </div>

      <div className="loop-control-grid">
        <section className="editor-control-card focus-card"><header><span>Fokus-Standort <strong>{formatPrecise(loopFocus)}</strong></span></header><div className="control-step-row"><button type="button" onClick={() => nudgeFocus(-focusStepSeconds)}>◀</button><label className="step-select"><select value={focusStep} onChange={(event) => setFocusStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeFocus(focusStepSeconds)}>▶</button></div></section>
        <section className="editor-control-card cursor-card"><header><span>Cursor-Standort <strong>{formatPrecise(loopCursor)}</strong></span></header><div className="control-step-row cursor-step-row"><button type="button" onClick={() => nudgeCursor(-cursorStepSeconds)}>◀</button><button className="mini-play" type="button" onClick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button><button type="button" onClick={() => nudgeCursor(cursorStepSeconds)}>▶</button><label className="step-select"><select value={cursorStep} onChange={(event) => setCursorStep(event.target.value)}>{CURSOR_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card loop-card"><header><span>Loop-Standort <strong>Start {formatPrecise(loopDraftStart)} · Ende {formatPrecise(loopDraftEnd)}</strong></span></header><div className="loop-edge-row"><div><button type="button" onClick={() => nudgeLoopEdge('start', -edgeStepSeconds)}>◀</button><span>Start</span><button type="button" onClick={() => nudgeLoopEdge('start', edgeStepSeconds)}>▶</button></div><label className="step-select"><select value={edgeStep} onChange={(event) => setEdgeStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><div><button type="button" onClick={() => nudgeLoopEdge('end', -edgeStepSeconds)}>◀</button><span>Ende</span><button type="button" onClick={() => nudgeLoopEdge('end', edgeStepSeconds)}>▶</button></div></div><div className="boundary-preview-row"><label><button type="button" onClick={() => previewBoundary('start')}>▶ Vor Start</button><select value={previewLeadStart} onChange={(event) => setPreviewLeadStart(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label><label><button type="button" onClick={() => previewBoundary('end')}>▶ Vor Ende</button><select value={previewLeadEnd} onChange={(event) => setPreviewLeadEnd(event.target.value)}>{LOOP_PREVIEW_OPTIONS.map((lead) => <option key={lead} value={String(lead)}>{String(lead).replace('.', ',')} s</option>)}</select></label></div></section>
        <section className="editor-control-card marker-card"><header><span>Markierung-Standort <strong>{activeMarker === null ? '--:--.---' : formatPrecise(activeMarker)}</strong></span></header><div className="marker-tabs">{loopMarkers.map((marker, index) => <button key={`${marker}-tab-${index}`} className={activeMarkerIndex === index ? 'selected' : ''} type="button" onClick={() => { setActiveMarkerIndex(index); moveCursorTo(marker, false, true) }}>{markerLabel(index)}</button>)}<button className="add-marker" type="button" onClick={setMarker} disabled={!markersEnabled}>＋</button></div><div className="marker-location-row"><button type="button" onClick={() => nudgeActiveMarker(-markerStepSeconds)} disabled={activeMarker === null}>◀</button><label className="step-select"><select value={markerStep} onChange={(event) => setMarkerStep(event.target.value)}>{LOOP_STEP_OPTIONS.map((step) => <option key={step} value={String(step)}>{String(step).replace('.', ',')} s</option>)}</select></label><button type="button" onClick={() => nudgeActiveMarker(markerStepSeconds)} disabled={activeMarker === null}>▶</button><div className="marker-more-wrap"><button className="marker-more" type="button" onClick={() => setLoopEditorMenuOpen((value) => !value)}>•••</button>{loopEditorMenuOpen && <div className="marker-more-menu"><button type="button" onClick={() => { if (activeMarker !== null) moveCursorTo(activeMarker, false, true); setLoopEditorMenuOpen(false) }} disabled={activeMarker === null}>Cursor hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('focus')} disabled={activeMarker === null}>Zoom hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('start')} disabled={activeMarker === null}>Loop-Anfang hinbewegen</button><button type="button" onClick={() => moveMarkerTarget('end')} disabled={activeMarker === null}>Loop-Ende hinbewegen</button><button type="button" onClick={deleteActiveMarker} disabled={activeMarker === null}>Markierung löschen</button><button type="button" onClick={() => { setLoopEditorMenuOpen(false); setLoopConfirmation('deleteMarkers') }} disabled={!loopMarkers.length}>Alle Markierungen löschen</button></div>}</div></div></section>
      </div>

      <div className="loop-editor-actions"><button className="save-loop" type="button" onClick={() => setLoopConfirmation('save')} disabled={!editorDuration || loopDraftEnd <= loopDraftStart}>Loop speichern</button><button type="button" onClick={() => setLoopEditorSongId(null)}>Abbrechen</button></div>
    </div></div></section>}

    {selectedSongsListOpen && (() => {
      const selectedSongs = sortChooserObjects('song', songs.filter((song) => selectedSongIds.has(song.id))).filter((song) => fuzzyMatch(song.name, chooserSearch) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, 'song', song.id, chooserSearch)))
      const focusId = selectedSongsFocusId && selectedSongIds.has(selectedSongsFocusId) ? selectedSongsFocusId : selectedSongs[0]?.id ?? null
      return <div className="playlist-chooser-backdrop selected-songs-list-backdrop"><section className="playlist-chooser selected-songs-list-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-actions dialog-actions-top selected-songs-dialog-actions"><button type="button" onClick={() => { setSelectedSongsMenuOpen(false); setSelectedSongsListOpen(false); setChooserSearch('') }}>Abbrechen</button><button type="button" onClick={finishSelection}>Fertig</button></div>
        <div className="playlist-chooser-heading selected-songs-heading"><div><p className="eyebrow">AUSWAHL</p><h2>{selectedSongIds.size === 1 ? 'Ausgewähltes Lied' : 'Ausgewählte Lieder'}</h2><small>{focusId ? 'Ein Lied ist aktiv. Tippe ein anderes an, um es für die Aktionen zu wählen.' : 'Tippe ein Lied an.'}</small></div><div className="selected-songs-heading-actions"><button className="selection-more-button selected-songs-more-button" type="button" disabled={!focusId} onClick={() => setSelectedSongsMenuOpen((value) => !value)}>•••</button></div></div>
        {selectedSongsMenuOpen && <div className="overflow-menu selected-songs-action-menu-fixed">
          <button type="button" onClick={() => { setSelectionMode(true); setSelectedSongsMenuOpen(false); setSelectedSongsListOpen(false) }}>Auswählen</button>
          <button type="button" disabled={!focusId || view !== 'library'} onClick={() => runFocusedSelectedSongAction('move')}>Bewegen</button>
          <button type="button" disabled={!focusId || view !== 'library'} onClick={() => runFocusedSelectedSongAction('arrow')}>Reihenfolge verändern (Pfeil)</button>
          <button type="button" disabled={!focusId || view !== 'library'} onClick={() => runFocusedSelectedSongAction('line')}>Reihenfolge verändern (Strich)</button>
          <button type="button" onClick={() => openSelectionObjectEdit('add')}>Objekte hinzufügen</button>
          <button type="button" disabled={!selectedSongIds.size} onClick={() => openSelectionObjectEdit('remove')}>Objekte entfernen</button>
          <button type="button" onClick={() => { setSelectedSongsMenuOpen(false); setSelectedSongsListOpen(false); setChooserSearch('') }}>Abbrechen</button>
          <button type="button" onClick={finishSelection}>Fertig</button>
        </div>}
        <div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Lieder oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button></div>
        {renderChooserSortControls('song')}
        <div className="selected-songs-list">{selectedSongs.map((song, index) => <button className={`selected-song-list-item${focusId === song.id ? ' active' : ''}`} type="button" aria-pressed={focusId === song.id} key={song.id} onClick={() => { setSelectedSongsFocusId(song.id); setSelectedSongsMenuOpen(false) }}><span>{index + 1}.</span><strong>{song.name}</strong><small>{formatTime(song.duration)}</small></button>)}{!selectedSongs.length && <p>Keine passenden Lieder.</p>}</div>
      </section></div>
    })()}
    {selectionSourceKind && (() => {
      const groupCandidates = selectionSourceKind === 'group' ? sortChooserGroups('song', flattenedGroupsFor('song', songs), songs).filter((item) => fuzzyMatch(item.name, chooserSearch)) : []
      const objectCandidates = selectionSourceKind === 'playlist'
        ? sortChooserObjects('playlist', sidebarPlaylists).filter((item) => fuzzyMatch(item.name, chooserSearch))
        : selectionSourceKind === 'tag' ? sortChooserObjects('tag', sidebarTags).filter((item) => fuzzyMatch(item.name, chooserSearch)) : []
      const label = selectionSourceKind === 'group' ? 'Gruppe' : selectionSourceKind === 'playlist' ? 'Playlist' : 'Tag'
      return <div className="playlist-chooser-backdrop selection-source-backdrop"><section className="playlist-chooser selection-source-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="playlist-chooser-heading"><div><p className="eyebrow">AUSWAHL</p><h2>Alles aus {label} auswählen</h2></div></div>
        <div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder={label + ' suchen'} /></div>
        {renderChooserSortControls(selectionSourceKind === 'group' ? 'song' : selectionSourceKind)}
        <div className="group-membership-list">{selectionSourceKind === 'group'
          ? groupCandidates.map((group) => <button type="button" key={group.id} onClick={() => setSelectionSourceId(group.id)}><span>{group.name}</span><strong>{selectionSourceId === group.id ? '✓' : '+'}</strong></button>)
          : objectCandidates.map((item) => <button type="button" key={item.id} onClick={() => setSelectionSourceId(item.id)}><span>{item.name}</span><strong>{selectionSourceId === item.id ? '✓' : '+'}</strong></button>)}
          {!groupCandidates.length && !objectCandidates.length && <p>Keine passenden Einträge.</p>}
        </div>
        <div className="dialog-actions"><button type="button" onClick={() => { setSelectionSourceKind(null); setSelectionSourceId(null); setChooserSearch('') }}>Abbrechen</button><button type="button" disabled={!selectionSourceId} onClick={applySelectionSource}>Fertig</button></div>
      </section></div>
    })()}
    {selectionObjectEditMode && (() => {
      const candidates = sortChooserObjects('song', songs.filter((song) => selectionObjectEditMode === 'add' ? !selectedSongIds.has(song.id) : selectedSongIds.has(song.id))).filter((song) => fuzzyMatch(song.name, chooserSearch) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, 'song', song.id, chooserSearch)))
      return <div className="playlist-chooser-backdrop selection-object-edit-backdrop"><section className="playlist-chooser selection-object-edit-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="playlist-chooser-heading"><div><p className="eyebrow">AUSWAHL</p><h2>{selectionObjectEditMode === 'add' ? 'Objekte hinzufügen' : 'Objekte entfernen'}</h2></div></div>
        <div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Lieder oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button></div>
        {renderChooserSortControls('song')}
        <div className="group-membership-list">{candidates.map((song) => { const staged = selectionObjectDraftIds.has(song.id); return <button type="button" key={song.id} onClick={() => toggleSelectionObjectDraft(song.id)}><span>{song.name}</span><strong>{selectionObjectEditMode === 'add' ? staged ? '−' : '+' : staged ? '+' : '−'}</strong></button> })}{!candidates.length && <p>Keine passenden Lieder.</p>}</div>
        <div className="dialog-actions"><button type="button" onClick={() => { setSelectionObjectEditMode(null); setSelectionObjectDraftIds(new Set()); setChooserSearch('') }}>Abbrechen</button><button type="button" onClick={applySelectionObjectEdit}>Fertig</button></div>
      </section></div>
    })()}
    {playlistChooserMode && <div className="playlist-chooser-backdrop"><section className="playlist-chooser" onClick={(event) => event.stopPropagation()}>
      <div className="dialog-actions"><button type="button" onClick={closePlaylistChooser}>Abbrechen</button><button type="button" onClick={() => void applyPlaylistChooser()}>Fertig</button></div>
      <div className="playlist-chooser-heading"><div><p className="eyebrow">PLAYLISTS</p><h2>{playlistChooserMode === 'bulk' ? `${selectedSongIds.size} Lieder zuordnen` : 'Alle Playlists'}</h2></div></div>
      <div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Playlists oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button></div>
      {renderChooserSortControls('playlist')}
      <div className="group-membership-list">{sortChooserObjects('playlist', sidebarPlaylists).filter((playlist) => fuzzyMatch(playlist.name, chooserSearch) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, 'playlist', playlist.id, chooserSearch))).map((playlist) => { const selected = playlistChooserDraftIds.has(playlist.id); return <button key={playlist.id} type="button" onClick={() => togglePlaylistChooserDraft(playlist.id)}><span>{playlist.name}</span><strong>{selected ? '−' : '+'}</strong></button> })}</div>
    </section></div>}

    {sortMenuOpen && <><button className="menu-shield" type="button" onClick={() => setSortMenuOpen(false)} /><div className="overflow-menu library-global-action-menu"><button type="button" disabled={selectionMode || view === 'trash'} onClick={() => { startSelection(); setSortMenuOpen(false) }}>Auswählen</button><button type="button" disabled={view === 'trash'} onClick={() => openSelectionSource('group')}>Alles aus Gruppe auswählen</button><button type="button" disabled={view === 'trash'} onClick={() => openSelectionSource('playlist')}>Alles aus Playlist auswählen</button><button type="button" disabled={view === 'trash'} onClick={() => openSelectionSource('tag')}>Alles aus Tag auswählen</button><button type="button" disabled={view !== 'library'} onClick={() => { beginReorder(activePlaylist ? 'playlist' : 'library'); setSortMenuOpen(false) }}>Reihenfolge ändern</button><div className="library-bottom-menu-divider" /><button className={selectedSongIds.size ? 'playlist-action-ready' : ''} type="button" disabled={!selectedSongIds.size} onClick={() => { openPlaylistChooser('bulk'); setSortMenuOpen(false) }}>Alle Playlists</button><button type="button" onClick={() => { createEmptyObjectGroup('song'); setSortMenuOpen(false) }}>Leere Gruppe erstellen</button><button type="button" onClick={() => { openGroupPlaybackChooser(); setSortMenuOpen(false) }}>Weitere Gruppen abspielen</button><button type="button" disabled={view !== 'library'} onClick={() => openSortSaveDialog('song')}>Aktuelle Sortierung speichern</button>{selectionMode && <><div className="library-bottom-menu-divider" /><button type="button" onClick={() => createObjectGroup('song', [...selectedSongIds])} disabled={selectedSongIds.size < 2}>Gruppieren</button><button type="button" onClick={() => openTagChooser('song', [...selectedSongIds])} disabled={!selectedSongIds.size}>Tags</button>{selectionContainsOnlyLoops && <><button type="button" onClick={() => void requestManualLoopChange([...selectedSongIds], true)}>Alle Loops aktivieren</button><button type="button" onClick={() => void requestManualLoopChange([...selectedSongIds], false)}>Alle Loops deaktivieren</button></>}<button className="danger-menu-action" type="button" onClick={() => { setSortMenuOpen(false); setSelectionConfirmation('deleteSelected') }} disabled={!selectedSongIds.size}>Alle löschen</button></>}</div></>}

    {overflowMenu && <><button className="menu-shield" type="button" onClick={() => setOverflowMenu(null)} /><div className={`overflow-menu${overflowMenuOnLeftSide ? ' overflow-menu-right' : ''}`} style={overflowMenuOnLeftSide ? { left: 'auto', right: '18px' } : undefined}>{overflowMenu.kind === 'group' && overflowMenu.id && (() => { const group = objectGroups.find((item) => item.id === overflowMenu.id); if (!group) return null; return <>{group.kind === 'song' && <button type="button" onClick={() => playObjectGroup(group)}>Gruppe abspielen</button>}<button type="button" onClick={() => openAppearanceColor('group', group.id)}>Farbe ändern</button><button type="button" onClick={() => openGroupRename(group)}>Gruppe umbenennen</button><button type="button" onClick={() => { setGroupSortId(group.id); setOverflowMenu(null) }}>Sortieren</button><button type="button" onClick={() => selectGroupObjects(group)}>Auswählen</button><button type="button" onClick={() => { setGroupReorderId(group.id); setGroupMoveId(null); setOverflowMenu(null) }}>Reihenfolge ändern</button><button type="button" onClick={() => openSingleMove('group', group.id, group.parentGroupId)}>Bewegen</button><button type="button" onClick={() => copyGroup(group)}>Kopieren</button><button type="button" onClick={() => openTagChooser('group', [group.id])}>Tags</button><button type="button" onClick={() => groupGroup(group)}>Gruppe gruppieren</button><button type="button" onClick={() => openGroupNesting(group.id, 'add')}>Gruppe hinzufügen</button><button type="button" disabled={!group.parentGroupId && !directChildGroups(group.id).length} onClick={() => openGroupNesting(group.id, 'remove')}>Gruppe entfernen</button><button type="button" onClick={() => openGroupMembership(group.id, 'add')}>Objekte hinzufügen</button><button type="button" onClick={() => openGroupMembership(group.id, 'remove')}>Objekte entfernen</button><button type="button" onClick={() => removeAllGroupObjects(group.id)}>{group.kind === 'song' ? 'Alle Lieder entfernen' : 'Alle Objekte entfernen'}</button><button className="danger-menu-action" type="button" onClick={() => dissolveGroup(group.id)}>Gruppe auflösen</button><button className="danger-menu-action" type="button" onClick={() => { setGroupDeleteTargetId(group.id); setOverflowMenu(null) }}>Gruppe löschen</button></> })()}{overflowMenu.kind === 'playlists' && <><button type="button" onClick={() => createEmptyObjectGroup('playlist')}>Leere Gruppe erstellen</button><button type="button" onClick={() => startSidebarSelection('playlist')}>Auswählen</button><button type="button" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('playlists') }}>Sortieren</button><button type="button" onClick={() => beginReorder('sidebar')}>Reihenfolge ändern</button><button type="button" onClick={() => openOverviewSearch('playlist')}>Playlist suchen</button><button type="button" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'playlistOverview', playlistId: activePlaylistId, detailOpen: false }) }}>Übersicht</button></>}{overflowMenu.kind === 'tags' && <><button type="button" onClick={() => createEmptyObjectGroup('tag')}>Leere Gruppe erstellen</button><button type="button" onClick={() => startSidebarSelection('tag')}>Auswählen</button><button type="button" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('tags') }}>Sortieren</button><button type="button" onClick={() => beginReorder('tags')}>Reihenfolge ändern</button><button type="button" onClick={() => openOverviewSearch('tag')}>Tag suchen</button><button type="button" onClick={() => { setOverflowMenu(null); navigateTo({ view: 'tagOverview', playlistId: null, tagId: null, detailOpen: false }) }}>Übersicht</button></>}{overflowMenu.kind === 'tag' && overflowMenu.id && (() => { const tag = tags.find((item) => item.id === overflowMenu.id); if (!tag) return null; return <><button type="button" onClick={() => openTagCoverPicker(tag.id)}>Bild ändern</button><button type="button" onClick={() => openAppearanceColor('tag', tag.id)}>Farbe ändern</button><button type="button" onClick={() => beginRename('tag', tag.id)}>Umbenennen</button><button type="button" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('tags') }}>Sortieren</button><button type="button" onClick={() => startSidebarSelection('tag', [tag.id])}>Auswählen</button><button type="button" onClick={() => beginReorder('tags')}>Reihenfolge ändern</button><button type="button" onClick={() => openSingleMove('tag', tag.id, overflowMenu.parentGroupId)}>Bewegen</button><button className="danger-menu-action" type="button" onClick={() => { setTagToDelete(tag); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'song' && overflowMenu.id && (() => { const song = songs.find((item) => item.id === overflowMenu.id); if (!song) return null; return <><button type="button" onClick={() => openAppearanceColor('song', song.id)}>Farbe ändern</button><button type="button" onClick={() => beginRename('song', song.id)}>Umbenennen</button><button type="button" onClick={() => { startSelection([song.id]); setOverflowMenu(null) }}>Auswählen</button><button type="button" onClick={() => beginReorder(activePlaylist ? 'playlist' : 'library')}>Reihenfolge ändern</button><button type="button" onClick={() => openSingleMove('song', song.id, overflowMenu.parentGroupId)}>Bewegen</button><button type="button" onClick={() => copySong(song.id)}>Kopieren</button><button type="button" disabled={clipboard?.kind !== 'song'} onClick={pasteFromSongMenu}>Einfügen</button><button type="button" onClick={() => openTagChooser('song', [song.id])}>Tags</button><button type="button" onClick={() => void shareSong(song.id)}>Teilen</button><button type="button" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type="button" onClick={() => void toggleSongLoop(song.id)}>{isLoopActive(song) ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}{song.isNew && <><button className="blue-menu-action" type="button" onClick={() => void markSeen(song.id)}>Als gelesen markieren</button><button className="blue-menu-action" type="button" onClick={() => void markSeen()}>Alle als gelesen markieren</button></>}<button className="danger-menu-action" type="button" onClick={() => { setSongToDelete(song); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'songDetail' && overflowMenu.id && (() => { const song = songs.find((item) => item.id === overflowMenu.id); if (!song) return null; return <><button type="button" onClick={() => openAppearanceColor('song', song.id)}>Farbe ändern</button><button type="button" onClick={() => beginRename('song', song.id)}>Umbenennen</button><button type="button" onClick={() => { startSelection([song.id]); setOverflowMenu(null) }}>Auswählen</button><button type="button" onClick={() => beginReorder(activePlaylist ? 'playlist' : 'library')}>Reihenfolge ändern</button><button type="button" onClick={() => openSingleMove('song', song.id)}>Bewegen</button><button type="button" onClick={() => copySong(song.id)}>Kopieren</button><button type="button" disabled={clipboard?.kind !== 'song'} onClick={pasteFromSongMenu}>Einfügen</button><button type="button" onClick={() => openTagChooser('song', [song.id])}>Tags</button><button type="button" onClick={() => void shareSong(song.id)}>Teilen</button><button type="button" onClick={() => openLoopEditor(song.id)}>{song.loopStart !== undefined ? 'Loop bearbeiten' : 'Loop erstellen'}</button>{song.loopStart !== undefined && song.loopEnd !== undefined && <button type="button" onClick={() => void toggleSongLoop(song.id)}>{isLoopActive(song) ? 'Loop deaktivieren' : 'Loop aktivieren'}</button>}<button className="danger-menu-action" type="button" onClick={() => { setSongToDelete(song); setOverflowMenu(null) }}>Löschen</button></> })()}{overflowMenu.kind === 'playlist' && overflowMenu.id && (() => { const playlist = playlists.find((item) => item.id === overflowMenu.id); if (!playlist) return null; return <><button type="button" onClick={() => openPlaylistCoverPicker(playlist.id)}>Bild ändern</button><button type="button" onClick={() => openAppearanceColor('playlist', playlist.id)}>Farbe ändern</button><button type="button" onClick={() => beginRename('playlist', playlist.id)}>Umbenennen</button><button type="button" onClick={() => { setOverflowMenu(null); setSidebarSortTarget('playlists') }}>Sortieren</button><button type="button" onClick={() => startSidebarSelection('playlist', [playlist.id])}>Auswählen</button><button type="button" onClick={() => beginReorder('sidebar')}>Reihenfolge ändern</button><button type="button" onClick={() => openSingleMove('playlist', playlist.id, overflowMenu.parentGroupId)}>Bewegen</button><button type="button" onClick={() => copyPlaylist(playlist.id)}>Kopieren</button><button type="button" onClick={() => openTagChooser('playlist', [playlist.id])}>Tags</button><button type="button" disabled={!clipboard} onClick={() => pasteFromPlaylistMenu(playlist.id)}>Einfügen</button><button type="button" onClick={() => void sharePlaylist(playlist.id)}>Teilen</button><button className="danger-menu-action" type="button" onClick={() => { setPlaylistToDelete(playlist); setOverflowMenu(null) }}>Löschen</button></> })()}</div></>}

    {tagChooserTarget && <div className="playlist-chooser-backdrop tag-chooser-backdrop"><section className="playlist-chooser tag-chooser" onClick={(event) => event.stopPropagation()}>
      <div className="dialog-actions"><button type="button" onClick={() => void closeTagChooser(false)}>Abbrechen</button><button type="button" onClick={() => void closeTagChooser(true)}>Fertig</button></div>
      <div className="playlist-chooser-heading"><div><p className="eyebrow">TAGS</p><h2>{tagChooserTarget.kind === 'song' ? `${tagChooserTarget.ids.length} ${tagChooserTarget.ids.length === 1 ? 'Lied' : 'Lieder'}` : tagChooserTarget.kind === 'playlist' ? `${tagChooserTarget.ids.length} ${tagChooserTarget.ids.length === 1 ? 'Playlist' : 'Playlists'}` : `${tagChooserTarget.ids.length} ${tagChooserTarget.ids.length === 1 ? 'Gruppe' : 'Gruppen'}`} taggen</h2></div></div>
      <div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Tags oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button></div>
      {renderChooserSortControls('tag')}
      <div className="tag-chooser-list">{sortChooserObjects('tag', sidebarTags).filter((tag) => fuzzyMatch(tag.name, chooserSearch) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, 'tag', tag.id, chooserSearch))).map((tag) => { const ids = tagChooserTarget.kind === 'song' ? tag.songIds : tagChooserTarget.kind === 'playlist' ? tag.playlistIds : (tag.groupIds ?? []); const all = tagChooserTarget.ids.every((id) => ids.includes(id)); const some = !all && tagChooserTarget.ids.some((id) => ids.includes(id)); return <button key={tag.id} type="button" onClick={() => void toggleTargetTag(tag)}><span><i className="tag-dot" style={{ background: tag.color }} /><b>{tag.name}</b></span><small>{tag.songIds.filter((id) => songs.some((song) => song.id === id)).length} Lieder</small><strong>{all ? '−' : some ? '±' : '+'}</strong></button> })}{!sidebarTags.length && <p className="tag-empty-hint">Erstelle zuerst links unter „Tags“ einen Tag.</p>}</div>
    </section></div>}
    {sidebarSelectionKind && <div className="sidebar-selection-dock" style={{ left: '12px', right: 'auto', maxWidth: `${Math.max(126, sidebarWidth - 24)}px` }}><strong>{sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size} ausgewählt</strong><button type="button" onClick={stopSidebarSelection}>Abbrechen</button><div className="selection-more-wrap"><button className="selection-more-button" type="button" onClick={() => setSidebarSelectionMenuOpen((value) => !value)}>•••</button>{sidebarSelectionMenuOpen && <><button className="selection-menu-shield" type="button" onClick={() => setSidebarSelectionMenuOpen(false)} /><div className="selection-action-menu sidebar-selection-action-menu"><button type="button" disabled={(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size) < 2} onClick={() => createObjectGroup(sidebarSelectionKind, [...(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds : selectedTagIds)])}>Gruppieren</button><button type="button" disabled={!(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size)} onClick={() => void copySelectedSidebarObjects()}>Kopieren</button>{sidebarSelectionKind === 'playlist' && <button type="button" disabled={!selectedPlaylistIds.size} onClick={() => openTagChooser('playlist', [...selectedPlaylistIds])}>Tags</button>}<button className="danger-menu-action" type="button" disabled={!(sidebarSelectionKind === 'playlist' ? selectedPlaylistIds.size : selectedTagIds.size)} onClick={() => { setSidebarSelectionMenuOpen(false); setSidebarSelectionConfirmation('delete') }}>Alle löschen</button></div></>}</div></div>}
    {sidebarMoveKind && (() => { const source = sidebarMoveKind === 'playlist' ? sidebarPlaylists : sidebarTags; const selected = new Set(selectedSidebarIds(sidebarMoveKind)); const remaining = source.filter((item) => !selected.has(item.id)); const filteredRemaining = remaining.filter((item) => fuzzyMatch(item.name, chooserSearch)); return <div className="modal-backdrop sidebar-move-backdrop"><div className="confirm-dialog sidebar-move-dialog" onClick={(event) => event.stopPropagation()}><h2>{sidebarMoveKind === 'playlist' ? 'Playlists' : 'Tags'} bewegen</h2><p>Wähle weitere Zielpositionen. Der Modus endet erst mit „Abbrechen“.</p><div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Suchen" /></div><div className="sidebar-move-targets"><button type="button" onClick={() => void applySidebarSelectionMove(0)}>Ganz nach oben</button>{filteredRemaining.map((item) => <button type="button" key={item.id} onClick={() => void applySidebarSelectionMove(remaining.findIndex((candidate) => candidate.id === item.id))}>Vor „{item.name}“</button>)}<button type="button" onClick={() => void applySidebarSelectionMove(remaining.length)}>Ganz nach unten</button></div><div className="dialog-actions"><button type="button" onClick={() => setSidebarMoveKind(null)}>Abbrechen</button></div></div></div> })()}
    {sidebarSelectionConfirmation === 'switchManualMove' && sidebarSelectionKind && (() => { const kind: SortSaveKind = sidebarSelectionKind === 'playlist' ? 'playlist' : 'tag'; const saveName = activeSortSave(kind)?.name ?? 'Save'; return <div className="modal-backdrop" onClick={() => setSidebarSelectionConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Zu „{saveName}“ wechseln?</h2><p>Die Auswahl kann nur innerhalb einer gespeicherten {sidebarSelectionKind === 'playlist' ? 'Playlist-' : 'Tag-'}Reihenfolge bewegt werden.</p><div className="dialog-actions"><button type="button" onClick={() => setSidebarSelectionConfirmation(null)}>Nein</button><button type="button" onClick={() => { if (kind === 'playlist') setPlaylistSortMode('manual'); else setTagSortMode('manual'); setSidebarSelectionConfirmation(null); setSidebarMoveKind(sidebarSelectionKind) }}>Ja, wechseln</button></div></div></div> })()}
    {sidebarSelectionConfirmation === 'delete' && sidebarSelectionKind && <div className="modal-backdrop" onClick={() => setSidebarSelectionConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Auswahl löschen?</h2><p>{selectedSidebarIds(sidebarSelectionKind).length} {sidebarSelectionKind === 'playlist' ? 'Playlists' : 'Tags'} werden in den Papierkorb verschoben.</p><div className="dialog-actions"><button type="button" onClick={() => setSidebarSelectionConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void deleteSelectedSidebarObjects()}>In Papierkorb</button></div></div></div>}
    {pendingGroupCreate && <div className="modal-backdrop" onClick={() => { setPendingGroupCreate(null); setGroupCreateMenuOpen(false) }}><form className="confirm-dialog group-create-dialog" onSubmit={(event) => { event.preventDefault(); finalizePendingGroupCreate() }} onClick={(event) => event.stopPropagation()}><h2>Neue Gruppe</h2><div className="creation-name-row"><input value={pendingGroupCreate.name} onChange={(event) => setPendingGroupCreate((current) => current ? { ...current, name: event.target.value } : current)} autoFocus /><div className="creation-more-wrap"><button className="creation-more-button" type="button" onClick={() => setGroupCreateMenuOpen((value) => !value)}>•••</button>{groupCreateMenuOpen && <div className="creation-more-menu"><button type="button" onClick={() => { setPendingGroupCreate((current) => current ? { ...current, moveAfterCreate: true } : current); setGroupCreateMenuOpen(false) }}>{pendingGroupCreate.moveAfterCreate ? 'Bewegen ✓' : 'Bewegen'}</button></div>}</div></div><p>{pendingGroupCreate.moveAfterCreate ? 'Nach dem Erstellen wählst du die Zielposition mit dem roten Strich.' : 'Bei einem Save erscheint die neue Gruppe ganz oben. Bei automatischer Sortierung wird sie sofort passend eingeordnet.'}</p><div className="dialog-actions"><button type="button" onClick={() => { setPendingGroupCreate(null); setGroupCreateMenuOpen(false) }}>Abbrechen</button><button type="submit">Fertig</button></div></form></div>}
        {groupRenameId && <div className="modal-backdrop" onClick={() => setGroupRenameId(null)}><form className="confirm-dialog rename-dialog" onSubmit={saveGroupRename} onClick={(event) => event.stopPropagation()}><h2>Gruppe umbenennen</h2><input value={groupRenameValue} onChange={(event) => setGroupRenameValue(event.target.value)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setGroupRenameId(null)}>Abbrechen</button><button type="submit" disabled={!groupRenameValue.trim()}>Speichern</button></div></form></div>}
    {groupSortId && (() => { const group = objectGroups.find((item) => item.id === groupSortId); if (!group) return null; const labels = group.kind === 'song' ? sortLabels : group.kind === 'playlist' ? playlistSortLabels : tagSortLabels; return <div className="modal-backdrop" onClick={() => setGroupSortId(null)}><div className="confirm-dialog group-sort-dialog" onClick={(event) => event.stopPropagation()}><h2>Gruppe sortieren</h2><div className="sidebar-sort-controls"><select value={group.sortMode} onChange={(event) => updateObjectGroup(group.id, (item) => ({ ...item, sortMode: event.target.value as GroupSortMode }))}><option value="general">Allgemeine Sortierung</option>{(Object.keys(labels) as SortMode[]).map((mode) => <option key={mode} value={mode}>{labels[mode]}</option>)}</select><button type="button" disabled={group.sortMode === 'general' || group.sortMode === 'manual'} onClick={() => updateObjectGroup(group.id, (item) => ({ ...item, sortDirection: item.sortDirection === 'down' ? 'up' : 'down' }))}>{group.sortMode === 'general' || group.sortMode === 'manual' ? '—' : group.sortDirection === 'down' ? '↓' : '↑'}</button></div><p>„Allgemeine Sortierung“ übernimmt automatisch die Sortierung der gesamten Liste.</p><div className="dialog-actions"><button type="button" onClick={() => setGroupSortId(null)}>Fertig</button></div></div></div> })()}
    {groupDeleteTargetId && (() => { const group = objectGroups.find((item) => item.id === groupDeleteTargetId); if (!group) return null; const count = deepGroupItemIds(group).length; const label = group.kind === 'song' ? (count === 1 ? 'Lied' : 'Lieder') : group.kind === 'playlist' ? (count === 1 ? 'Playlist' : 'Playlists') : (count === 1 ? 'Tag' : 'Tags'); return <div className="modal-backdrop" onClick={() => setGroupDeleteTargetId(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Gruppe löschen?</h2><p>„{group.name}“ inklusive aller Untergruppen und {count} {label} wird in den Papierkorb verschoben. „Gruppe auflösen“ würde die enthaltenen Objekte dagegen behalten.</p><div className="dialog-actions"><button type="button" onClick={() => setGroupDeleteTargetId(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void deleteObjectGroup(group.id)}>Gruppe löschen</button></div></div></div> })()}
    {groupPlaybackChooserOpen && (() => {
      const allSongGroups = flattenedGroupsFor('song', visibleSongs)
      const filteredGroups = sortChooserGroups('song', allSongGroups, visibleSongs).filter((group) => fuzzyMatch(group.name, chooserSearch))
      const selectedGroups = groupPlaybackSelectedIds.map((id) => objectGroups.find((group) => group.id === id)).filter((group): group is ObjectGroup => Boolean(group))
      return <div className="playlist-chooser-backdrop" onClick={() => { setGroupPlaybackChooserOpen(false); setChooserSearch('') }}><section className="playlist-chooser multi-group-playback-dialog" onClick={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">WIEDERGABE</p><h2>Weitere Gruppen abspielen</h2></div><button type="button" onClick={() => { setGroupPlaybackChooserOpen(false); setChooserSearch('') }}>×</button></div><div className="group-playback-order"><strong>Reihenfolge</strong>{selectedGroups.length ? selectedGroups.map((group, index) => <div key={group.id}><span>{index + 1}. {group.name}</span><span><button type="button" onClick={() => movePlaybackGroup(group.id, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => movePlaybackGroup(group.id, 1)} disabled={index === selectedGroups.length - 1}>↓</button></span></div>) : <p>Noch keine Gruppe ausgewählt.</p>}</div><div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Gruppen suchen" /></div>{renderChooserSortControls('song')}<div className="group-membership-list">{filteredGroups.map((group) => { const selected = groupPlaybackSelectedIds.includes(group.id); return <button type="button" key={group.id} onClick={() => togglePlaybackGroup(group.id)}><span>{group.name}</span><strong>{selected ? '✓' : '+'}</strong></button> })}</div><div className="dialog-actions"><button type="button" onClick={() => { setGroupPlaybackChooserOpen(false); setChooserSearch('') }}>Abbrechen</button><button type="button" disabled={!selectedGroups.length} onClick={() => startGroupPlayback(selectedGroups)}>Abspielen</button></div></section></div>
    })()}
    {groupNestingTarget && (() => {
      const group = objectGroups.find((item) => item.id === groupNestingTarget.groupId)
      if (!group) return null
      const descendants = new Set(groupDescendantIds(group.id))
      const children = directChildGroups(group.id)
      const allowedForKind: Array<Song | Playlist | Tag> = group.kind === 'song' ? visibleSongs : group.kind === 'playlist' ? sidebarPlaylists : sidebarTags
      const candidates = sortChooserGroups(group.kind, flattenedGroupsFor(group.kind, allowedForKind).filter((item) => item.id !== group.id && !descendants.has(item.id) && item.parentGroupId !== group.id && !groupDescendantIds(item.id).includes(group.id)), allowedForKind)
      const sortedChildren = sortChooserGroups(group.kind, children, allowedForKind)
      return <div className="playlist-chooser-backdrop group-membership-backdrop"><section className="playlist-chooser group-membership-dialog" onClick={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">GRUPPE</p><h2>{groupNestingTarget.mode === 'add' ? 'Gruppe hinzufügen' : 'Gruppe entfernen'}</h2></div></div><div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Gruppen suchen" /></div>{renderChooserSortControls(group.kind)}{groupNestingTarget.mode === 'add' ? <div className="group-membership-list group-nesting-list"><button type="button" onClick={() => toggleGroupNestingDraft(GROUP_NESTING_NEW_DRAFT_ID)}><span>Neue leere Gruppe</span><strong>{groupNestingDraftIds.has(GROUP_NESTING_NEW_DRAFT_ID) ? '−' : '+'}</strong></button><button type="button" disabled={!groupClipboard || groupClipboard.kind !== group.kind} onClick={() => toggleGroupNestingDraft(GROUP_NESTING_PASTE_DRAFT_ID)}><span>Einfügen</span><strong>{groupNestingDraftIds.has(GROUP_NESTING_PASTE_DRAFT_ID) ? '−' : '+'}</strong></button>{candidates.filter((candidate) => fuzzyMatch(candidate.name, chooserSearch)).map((candidate) => { const staged = groupNestingDraftIds.has(candidate.id); return <button type="button" key={candidate.id} onClick={() => toggleGroupNestingDraft(candidate.id)}><span>{candidate.name}</span><strong>{staged ? '−' : '+'}</strong></button> })}{!candidates.filter((candidate) => fuzzyMatch(candidate.name, chooserSearch)).length && <p>Keine weiteren Gruppen vorhanden.</p>}</div> : <div className="group-membership-list group-nesting-list">{group.parentGroupId && fuzzyMatch('Diese Gruppe aus der übergeordneten Gruppe entfernen', chooserSearch) && <button type="button" onClick={() => toggleGroupNestingDraft(group.id)}><span>Diese Gruppe aus der übergeordneten Gruppe entfernen</span><strong>{groupNestingDraftIds.has(group.id) ? '+' : '−'}</strong></button>}{sortedChildren.filter((child) => fuzzyMatch(child.name, chooserSearch)).map((child) => { const staged = groupNestingDraftIds.has(child.id); return <button type="button" key={child.id} onClick={() => toggleGroupNestingDraft(child.id)}><span>{child.name}</span><strong>{staged ? '+' : '−'}</strong></button> })}{!group.parentGroupId && !sortedChildren.filter((child) => fuzzyMatch(child.name, chooserSearch)).length && <p>Keine verschachtelte Gruppe vorhanden.</p>}</div>}<div className="dialog-actions"><button type="button" onClick={closeGroupNestingDraft}>Abbrechen</button><button type="button" onClick={applyGroupNestingDraft}>Fertig</button></div></section></div>
    })()}
    {groupMembershipTarget && (() => { const group = objectGroups.find((item) => item.id === groupMembershipTarget.groupId); if (!group) return null; const allItems: Array<Song | Playlist | Tag> = group.kind === 'song' ? visibleSongs : group.kind === 'playlist' ? sidebarPlaylists : sidebarTags; const rawCandidates = groupMembershipTarget.mode === 'add' ? allItems.filter((item) => !group.itemIds.includes(item.id)) : allItems.filter((item) => group.itemIds.includes(item.id)); const candidates = sortChooserObjects(group.kind, rawCandidates).filter((item) => fuzzyMatch(item.name, chooserSearch) || (searchIncludesGroups && itemMatchesGroupQuery(objectGroups, group.kind, item.id, chooserSearch))); return <div className="playlist-chooser-backdrop group-membership-backdrop"><section className="playlist-chooser group-membership-dialog" onClick={(event) => event.stopPropagation()}><div className="playlist-chooser-heading"><div><p className="eyebrow">GRUPPE</p><h2>{groupMembershipTarget.mode === 'add' ? 'Objekte hinzufügen' : 'Objekte entfernen'}</h2></div></div><div className="chooser-search"><input type="search" value={chooserSearch} onChange={(event) => setChooserSearch(event.target.value)} placeholder="Objekte oder Gruppen suchen" /><button className={`search-group-toggle${searchIncludesGroups ? ' active' : ''}`} type="button" onClick={() => setSearchIncludesGroups((value) => !value)}>{searchIncludesGroups ? 'Gruppen ✓' : 'Gruppen'}</button></div>{renderChooserSortControls(group.kind)}<div className="group-membership-list">{candidates.map((item) => { const staged = groupMembershipDraftIds.has(item.id); return <button type="button" key={item.id} onClick={() => toggleGroupMembershipDraft(item.id)}><span>{item.name}</span><strong>{groupMembershipTarget.mode === 'add' ? staged ? '−' : '+' : staged ? '+' : '−'}</strong></button> })}{!candidates.length && <p>Keine passenden Objekte.</p>}</div><div className="dialog-actions"><button type="button" onClick={closeGroupMembershipDraft}>Abbrechen</button><button type="button" onClick={applyGroupMembershipDraft}>Fertig</button></div></section></div> })()}
    {coverEditorDraft && <CoverEditor title={coverEditorDraft.kind === 'playlist' ? 'Playlist-Bild einstellen' : 'Tag-Bild einstellen'} file={coverEditorDraft.file} initialScale={coverEditorDraft.scale} initialX={coverEditorDraft.x} initialY={coverEditorDraft.y} initialBackground={coverEditorDraft.background} onCancel={() => setCoverEditorDraft(null)} onDone={(value) => void applyCoverEditor(value)} />}
    {colorPickerTarget && <ColorSpectrumPicker title="Tag-Farbe wählen" initialColor={colorPickerTarget === 'create' ? tagColor : renameTagColor} onCancel={() => setColorPickerTarget(null)} onDone={(color) => { if (colorPickerTarget === 'create') setTagColor(color); else setRenameTagColor(color); setColorPickerTarget(null) }} />}
    {appearanceColorTarget && <ColorSpectrumPicker title="Farbe ändern" initialColor={appearanceInitialColor()} onCancel={() => setAppearanceColorTarget(null)} onDone={applyAppearanceColor} />}
    {repeatMenuOpen && <div className="modal-backdrop repeat-choice-backdrop" onClick={() => setRepeatMenuOpen(false)}><div className="confirm-dialog repeat-choice-dialog" onClick={(event) => event.stopPropagation()}><h2>Wiederholung</h2><p>Unendlich wiederholen oder eine feste Anzahl wählen. Bei einem aktiven Loop zählt die Zahl pro Loop-Durchlauf herunter.</p><div className="repeat-choice-options"><button className="repeat-infinity-option" type="button" onClick={chooseInfiniteRepeat}><span>∞</span><strong>Unendlich</strong></button><div className="repeat-count-option"><input type="number" min="1" max="9999" inputMode="numeric" value={repeatCountInput} onChange={(event) => setRepeatCountInput(event.target.value)} aria-label="Anzahl Wiederholungen" /><button type="button" onClick={chooseCountRepeat}>Anwenden</button></div></div><div className="dialog-actions"><button type="button" onClick={() => setRepeatMenuOpen(false)}>Abbrechen</button></div></div></div>}
    {sidebarSortTarget && (() => { const kind: SortSaveKind = sidebarSortTarget === 'tags' ? 'tag' : 'playlist'; const mode = kind === 'tag' ? tagSortMode : playlistSortMode; const direction = kind === 'tag' ? tagSortDirection : playlistSortDirection; const labels = kind === 'tag' ? tagSortLabels : playlistSortLabels; return <div className="modal-backdrop sidebar-sort-backdrop" onClick={() => setSidebarSortTarget(null)}><div className="confirm-dialog sidebar-sort-dialog" onClick={(event) => event.stopPropagation()}><h2>{kind === 'tag' ? 'Tags sortieren' : 'Playlists sortieren'}</h2><div className="sidebar-sort-controls"><select value={mode === 'manual' ? `save:${activeSortSave(kind)?.id ?? ''}` : `auto:${mode}`} onChange={(event) => changeSortSelection(kind, event.target.value)}>{(Object.keys(labels) as SortMode[]).filter((item) => item !== 'manual').map((item) => <option key={item} value={`auto:${item}`}>{labels[item]}</option>)}{sortSavesFor(kind).map((save) => <option key={save.id} value={`save:${save.id}`}>{save.name}</option>)}</select><button type="button" disabled={mode === 'manual'} onClick={() => kind === 'tag' ? setTagSortDirection((value) => value === 'down' ? 'up' : 'down') : setPlaylistSortDirection((value) => value === 'down' ? 'up' : 'down')}>{mode === 'manual' ? '—' : direction === 'down' ? '↓' : '↑'}</button><button className="save-current-sort-button" type="button" onClick={() => openSortSaveDialog(kind)}>Aktuelle Sortierung speichern</button></div><p>Automatische Sortierungen stehen oben. Deine Saves werden darunter alphabetisch angezeigt. Einen Save gedrückt halten, um ihn umzubenennen.</p><div className="sidebar-sort-save-list">{sortSavesFor(kind).map((save) => <button className={activeSortSave(kind)?.id === save.id && mode === 'manual' ? 'active-sort-save' : ''} type="button" key={save.id} onPointerDown={() => beginSortSaveHold(save)} onPointerUp={endSortSaveHold} onPointerCancel={endSortSaveHold} onPointerLeave={endSortSaveHold} onClick={() => activateSortSaveButton(save)}>{save.name}</button>)}</div><div className="dialog-actions"><button type="button" onClick={() => setSidebarSortTarget(null)}>Fertig</button></div></div></div> })()}
    {duplicateConflict && <div className="modal-backdrop duplicate-conflict-backdrop" onClick={cancelDuplicateConflict}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Gleicher Name bereits vorhanden</h2><p>{duplicateConflict.names.length === 1 ? `„${duplicateConflict.names[0]}“ ist am Ziel bereits vorhanden.` : `${duplicateConflict.names.length} gleichnamige Einträge sind am Ziel bereits vorhanden.`} Was soll Josi tun?</p><div className="dialog-actions duplicate-actions"><button type="button" onClick={cancelDuplicateConflict}>Abbrechen</button><button type="button" onClick={() => resolveDuplicateConflict('both')}>Beide einfügen</button><button type="button" onClick={() => resolveDuplicateConflict('replace')}>Ersetzen</button></div></div></div>}
    {tagToDelete && <div className="modal-backdrop" onClick={() => setTagToDelete(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Tag löschen?</h2><p>„{tagToDelete.name}“ wird in den Papierkorb verschoben. Songs und Playlists selbst bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setTagToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeleteTag()}>In Papierkorb</button></div></div></div>}

    {loopConfirmation === 'save' && editorSong && <div className="modal-backdrop" onClick={() => setLoopConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Loop speichern?</h2><p>Der Bereich {formatPrecise(loopDraftStart)} bis {formatPrecise(loopDraftEnd)} und die aktuellen Markierungen werden gespeichert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="save-loop-confirm" type="button" onClick={() => void saveLoopDraft()}>Loop speichern</button></div></div></div>}
    {loopConfirmation === 'delete' && currentSong && <div className="modal-backdrop" onClick={() => setLoopConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Loop löschen?</h2><p>Der gespeicherte Loop von „{currentSong.name}“ wird in den Papierkorb verschoben. Die Audiodatei bleibt unverändert.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void removeCurrentLoop()}>Loop löschen</button></div></div></div>}
    {loopConfirmation === 'deleteMarkers' && <div className="modal-backdrop" onClick={() => setLoopConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Alle Markierungen löschen?</h2><p>Alle orangefarbenen Markierungen dieses Loop-Entwurfs werden entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={deleteAllMarkers}>Alle löschen</button></div></div></div>}

    {trashConfirmation && <div className="modal-backdrop" onClick={() => setTrashConfirmation(false)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Papierkorb endgültig leeren?</h2><p>{trashCount} {trashCount === 1 ? 'Eintrag wird' : 'Einträge werden'} dauerhaft gelöscht. Audiodateien im Papierkorb können danach nicht wiederhergestellt werden.</p><div className="dialog-actions"><button type="button" onClick={() => setTrashConfirmation(false)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void emptyTrash()}>Endgültig leeren</button></div></div></div>}
    {sortSaveDialogTarget && <div className="modal-backdrop" onClick={() => setSortSaveDialogTarget(null)}><form className="confirm-dialog sort-save-dialog" onSubmit={(event) => { event.preventDefault(); saveCurrentSort() }} onClick={(event) => event.stopPropagation()}><h2>Aktuelle Sortierung speichern</h2><p>Gib dem Save einen Namen. Ohne Namen verwendet Josi automatisch die erste freie Nummer.</p><input value={sortSaveName} onChange={(event) => setSortSaveName(event.target.value)} placeholder={nextSortSaveName(sortSaveDialogTarget)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setSortSaveDialogTarget(null)}>Abbrechen</button><button type="submit">Speichern</button></div></form></div>}
    {sortSaveRenameId && <div className="modal-backdrop" onClick={() => setSortSaveRenameId(null)}><form className="confirm-dialog sort-save-dialog" onSubmit={confirmSortSaveRename} onClick={(event) => event.stopPropagation()}><h2>Save umbenennen</h2><input value={sortSaveRenameValue} onChange={(event) => setSortSaveRenameValue(event.target.value)} autoFocus /><div className="dialog-actions"><button type="button" onClick={() => setSortSaveRenameId(null)}>Abbrechen</button><button type="submit" disabled={!sortSaveRenameValue.trim()}>Speichern</button></div></form></div>}
    {settingsOpen && <div className="modal-backdrop settings-backdrop" onClick={() => setSettingsOpen(false)}><div className="confirm-dialog settings-dialog" onClick={(event) => event.stopPropagation()}><h2>Einstellungen</h2><div className="settings-row"><div><strong>Spulweite</strong><small>Für ⏪/⏩ und die Detailansicht.</small></div><select value={seekSeconds} onChange={(event) => setSeekSeconds(Number(event.target.value))}>{SEEK_SECOND_OPTIONS.map((value) => <option key={value} value={value}>{value} Sekunden</option>)}</select></div><div className="settings-row"><div><strong>Loops</strong><small>Bestimmt global, ob vorhandene Loops automatisch an, aus oder pro Lied manuell gesteuert werden.</small></div><select value={loopActivationMode} onChange={(event) => { const next = event.target.value as LoopActivationMode; if (next === 'disabled') cancelLoopTransition(); setLoopActivationMode(next) }}><option value="enabled">Aktiviert</option><option value="disabled">Deaktiviert</option><option value="manual">Manuell</option></select></div><div className="settings-row settings-info-row"><div><strong>Loop-Übergang</strong><small>Josi überlappt Loop-Ende und Loop-Anfang kurz. Falls der zweite Wiedergabekanal technisch nicht startet, wird lokal nach einem ähnlichen Verbindungspunkt gesucht.</small></div><span className="settings-info-value">Automatisch</span></div><div className="settings-row layout-settings-row"><div><strong>Bibliotheks-Interface</strong><small>Im Bearbeitungsmodus lassen sich die Trennleisten verschieben. Außerhalb davon sind sie gesperrt.</small></div><div className="layout-settings-actions"><button type="button" onClick={() => { setSettingsOpen(false); setLayoutEditMode(true) }}>Leisten verschieben</button><button type="button" onClick={() => { setSidebarWidth(layoutDefault.sidebarWidth); setPlayerSplitLeft(layoutDefault.playerSplitLeft); setPlayerSplitRight(layoutDefault.playerSplitRight) }}>Standard</button></div></div><div className="settings-row"><div><strong>Seitliche Bereiche sperren</strong><small>Verhindert das eigenständige Scrollen der linken und rechten Bibliotheksbereiche.</small></div><button className={`settings-switch${sidePaneScrollLocked ? ' on' : ''}`} type="button" role="switch" aria-checked={sidePaneScrollLocked} onClick={() => setSidePaneScrollLocked((value) => !value)}><i /></button></div><div className="dialog-actions"><button type="button" onClick={() => setSettingsOpen(false)}>Fertig</button></div></div></div>}
    {selectionConfirmation === 'switchManual' && <div className="modal-backdrop selection-confirm-backdrop" onClick={() => setSelectionConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Zu „{activeSortSave('song')?.name ?? 'Save'}“ wechseln?</h2><p>Ausgewählte Lieder können nur innerhalb einer gespeicherten Reihenfolge bewegt werden.</p><div className="dialog-actions"><button type="button" onClick={() => setSelectionConfirmation(null)}>Nein</button><button type="button" onClick={() => { setSortMode('manual'); setSelectionConfirmation(null); setBulkMoveMode(true) }}>Ja, wechseln</button></div></div></div>}
    {selectionConfirmation === 'deleteSelected' && <div className="modal-backdrop selection-confirm-backdrop" onClick={() => setSelectionConfirmation(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>{selectedSongIds.size} ausgewählte Lieder löschen?</h2><p>Die ausgewählten Lieder werden in den Papierkorb verschoben und aus allen Playlists entfernt.</p><div className="dialog-actions"><button type="button" onClick={() => setSelectionConfirmation(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void deleteSelectedSongs()}>In Papierkorb</button></div></div></div>}
    {loopManualRequest && <div className="modal-backdrop" onClick={() => setLoopManualRequest(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Auf „Manuell“ umschalten?</h2><p>Die globale Loop-Einstellung steht aktuell auf „{loopActivationMode === 'enabled' ? 'Aktiviert' : 'Deaktiviert'}“. Um {loopManualRequest.ids.length === 1 ? 'diesen Loop' : 'diese Loops'} individuell {loopManualRequest.enabled ? 'zu aktivieren' : 'zu deaktivieren'}, muss Josi auf „Manuell“ wechseln.</p><div className="dialog-actions"><button type="button" onClick={() => setLoopManualRequest(null)}>Nein</button><button type="button" onClick={() => { const request = loopManualRequest; setLoopActivationMode('manual'); setLoopManualRequest(null); void applyManualLoopChange(request.ids, request.enabled) }}>Ja, auf Manuell</button></div></div></div>}
    {creationPlacement && <div className="modal-backdrop" onClick={() => void finishCreationPlacement(false)}><form className="confirm-dialog creation-placement-dialog" onSubmit={(event) => { event.preventDefault(); void finishCreationPlacement(false) }} onClick={(event) => event.stopPropagation()}><h2>{creationPlacement.kind === 'song' ? 'Neues Lied' : creationPlacement.kind === 'playlist' ? 'Neue Playlist' : 'Neuer Tag'}</h2><div className="creation-name-row"><input value={creationPlacement.name} onChange={(event) => setCreationPlacement((current) => current ? { ...current, name: event.target.value } : current)} autoFocus /><div className="creation-more-wrap"><button className="creation-more-button" type="button" onClick={() => setCreationPlacementMenuOpen((value) => !value)}>•••</button>{creationPlacementMenuOpen && <div className="creation-more-menu"><button type="button" onClick={() => void finishCreationPlacement(true)}>Bewegen</button></div>}</div></div><p>Du kannst den Namen direkt ändern oder das Objekt über „Bewegen“ an eine genaue Position setzen.</p><div className="dialog-actions"><button type="submit">Fertig</button></div></form></div>}
    {renameTarget && <div className="modal-backdrop" onClick={() => setRenameTarget(null)}><form className="confirm-dialog rename-dialog" onSubmit={confirmRename} onClick={(event) => event.stopPropagation()}><h2>Umbenennen</h2><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />{renameTarget.kind === 'tag' && <div className="rename-tag-color"><span>Farbe</span><div className="tag-color-picker-wrap rainbow-ring"><button className="tag-color-trigger" type="button" style={{ background: renameTagColor }} onClick={() => setColorPickerTarget('rename')} aria-label="Tag-Farbe wählen" /></div></div>}<div className="dialog-actions"><button type="button" onClick={() => setRenameTarget(null)}>Abbrechen</button><button type="submit" disabled={!renameValue.trim()}>Speichern</button></div></form></div>}
    {songToDelete && <div className="modal-backdrop" onClick={() => setSongToDelete(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Lied löschen?</h2><p>„{songToDelete.name}“ wird in den Papierkorb verschoben und aus allen Playlists entfernt. Die Audiodatei bleibt bis zum Leeren des Papierkorbs wiederherstellbar.</p><div className="dialog-actions"><button type="button" onClick={() => setSongToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeleteSong()}>In Papierkorb</button></div></div></div>}
    {playlistToDelete && <div className="modal-backdrop" onClick={() => setPlaylistToDelete(null)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><h2>Playlist löschen?</h2><p>„{playlistToDelete.name}“ wird in den Papierkorb verschoben. Die Musikdateien bleiben erhalten.</p><div className="dialog-actions"><button type="button" onClick={() => setPlaylistToDelete(null)}>Abbrechen</button><button className="danger-button" type="button" onClick={() => void confirmDeletePlaylist()}>In Papierkorb</button></div></div></div>}
  </div>
}

export default App
