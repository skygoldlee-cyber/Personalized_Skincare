// views/textbook-reader.js - 교재 본문 읽기 및 오디오북 플레이어 (Textbook Reader + Audio)
import { escapeHTML, esc, safeTextWithBreaks } from '../sanitize.js';
import { formatSectionContentForReader } from '../reader-format.js';
import { parseTextbookContent } from '../textbook-parser.js';
import { renderStudyAids, bindStudyAidToggles, renderExamFilterToggle, applyExamFilter, isKeySection } from '../study-aids.js';
import { openHtmlViewer } from '../html-viewer.js';
import {
    SUBJECT_DIR_MAP, REFERENCE_FILES, REFERENCE_COMMON, REFERENCE_INGREDIENTS,
    REFERENCE_LAW, mapSourceToRef, resolveRefPath
} from '../pdf-registry.js';
import { collectGlossaryItems, renderGlossaryTable, appendGlossaryTocItem, bindGlossaryEvents } from './glossary-renderer.js';
// [모바일 PWA 견고성] 오디오 매니페스트는 window 전역(가드)에서 읽는다(정적 import 하드 의존 지양).
import { DataLoader } from '../data-loader.js';

// --- 교재 본문 읽기 (Textbook Reader) ---
let textbookReaderState = {
    selectedSubject: '',
    selectedChapter: '',
    storyMode: false
};

// --- 이야기형 MD 캐시: { "subjId:chapterIdx": { chapterTitle, sections, filePath } } ---
const _storyChapterCache = {};

// --- 오디오북 플레이어 ---
let readerAudioState = {
    audio: null,          // 현재 Audio 객체
    currentSrc: '',       // 현재 로드된 오디오 경로
    subjId: '',           // 현재 재생 중인 과목 키
    chapterIdx: -1,       // 현재 재생 중인 단원 인덱스
    chapterTitle: '',     // 현재 재생 중인 단원 제목
    wasPlayingBeforeHidden: false, // 탭 전환 전 재생 상태 (모바일 자동정지 복원용)
    sectionBoundaries: [], // [{start, end}] 각 섹션의 추정 재생 구간(초)
    lastSectionIdx: -1,   // 마지막으로 스크롤된 섹션 인덱스
    autoScroll: true,     // 오디오 따라가기 자동 스크롤 여부
};

// 오디오 이어보기 위치 저장 키 접두사
const READER_AUDIO_POS_PREFIX = 'readerAudioPos_';
// 재생 속도 저장 키
const READER_AUDIO_RATE_KEY = 'readerAudioRate';
// 자동 스크롤 설정 저장 키
const READER_AUDIO_AUTOSCROLL_KEY = 'readerAudioAutoScroll';

function getAudioPathForChapter(subjId, chapter) {
    let localPath = null;

    // 1) 매니페스트 우선 (단원 인덱스 기반)
    try {
        const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
        const chapters = (STUDY_DATA[subjId] && STUDY_DATA[subjId].chapters) || [];
        const idx = chapters.indexOf(chapter);
        const manifest = (typeof window !== 'undefined' && window.AUDIO_MANIFEST) || null;
        if (manifest &&
            manifest[subjId] && idx >= 0 && manifest[subjId][idx]) {
            localPath = manifest[subjId][idx];
        }
    } catch (e) { /* 매니페스트 조회 실패 시 폘백 */ }

    // 2) 폘백: fileName 명명 규칙으로 추론
    if (!localPath) {
        if (!chapter || !chapter.fileName) return null;
        // "1.맞춤형화장품 개요2026.md" → "1_맞춤형화장품_개요2026"
        const base = chapter.fileName.replace(/\.md$/i, '');
        const m = base.match(/^(\d+)\.(.+)$/);
        if (!m) return null;
        const num = m[1];
        const title = m[2].trim().replace(/\s+/g, '_');
        const chNo = num.padStart(2, '0');
        localPath = `content/audiobook/mp3/${subjId}/ch${chNo}_${num}_${title}.mp3`;
    }

    // 3) 외부 CDN URL 변환 (audio_manifest.js 의 getAudioUrl — window 전역, 없으면 로컬 경로 그대로)
    const toUrl = (typeof window !== 'undefined' && window.getAudioUrl) || null;
    return toUrl ? toUrl(localPath) : localPath;
}

/** 화면 하단에 잠시 표시되는 토스트 알림 */
let _audioToastTimer = null;
function showAudioToast(msg) {
    let toast = document.getElementById('reader-audio-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'reader-audio-toast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:2rem;transform:translateX(-50%);background:rgba(15,23,42,0.95);color:#fff;padding:0.6rem 1.1rem;border-radius:8px;font-size:0.85rem;z-index:9999;border:1px solid rgba(6,182,212,0.4);box-shadow:0 4px 16px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.25s;pointer-events:none;max-width:90%;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (_audioToastTimer) clearTimeout(_audioToastTimer);
    _audioToastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

/** 초를 "mm:ss" (1시간 이상이면 "h:mm:ss") 형식으로 변환 */
function formatAudioTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 이어보기 위치를 localStorage에서 읽기 */
function getSavedAudioPos(src) {
    try {
        const v = localStorage.getItem(READER_AUDIO_POS_PREFIX + src);
        const n = v ? parseFloat(v) : 0;
        return (isFinite(n) && n > 0) ? n : 0;
    } catch (e) { return 0; }
}

/** 이어보기 위치를 localStorage에 저장 (끝까지 들었으면 삭제) */
function saveAudioPos(src, pos, duration) {
    try {
        if (!src) return;
        // 끝에서 5초 이내 또는 95% 이상 들었으면 저장 위치 삭제(다음 재생은 처음부터)
        if (isFinite(duration) && duration > 0 && (pos >= duration - 5 || pos / duration >= 0.95)) {
            localStorage.removeItem(READER_AUDIO_POS_PREFIX + src);
        } else if (pos > 3) { // 3초 이하는 저장하지 않음(사실상 처음)
            localStorage.setItem(READER_AUDIO_POS_PREFIX + src, String(pos));
        }
    } catch (e) { /* noop */ }
}

/** 현재 오디오 재생 위치 저장 (단원 전환/화면 이동 전 호출) */
function persistCurrentAudioPos() {
    const a = readerAudioState.audio;
    if (a && readerAudioState.currentSrc) {
        saveAudioPos(readerAudioState.currentSrc, a.currentTime, a.duration);
    }
}

/* =======================================================
   📱 Media Session API — 잠금화면/알림바 미디어 제어
   ======================================================= */

/** 현재 재생 중인 단원의 Media Session 메타데이터 및 액션 핸들러 설정 */
function setupMediaSession(audio, subjId, chapterIdx, chapterTitle) {
    if (!('mediaSession' in navigator)) return;

    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    const subj = STUDY_DATA[subjId];
    const subjTitle = subj ? (subj.title || subjId) : subjId;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle,
        artist: '맞춤형화장품 조제관리사 스마트 학습',
        album: subjTitle,
        artwork: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
        audio.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null && isFinite(details.seekTime)) {
            audio.currentTime = details.seekTime;
        }
    });

    // 이전/다음 단원 핸들러 (단원이 있을 때만)
    const chapters = (subj && subj.chapters) || [];
    if (chapters.length > 1) {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            if (chapterIdx > 0) {
                toggleReaderAudio(subjId, chapterIdx - 1);
            }
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            if (chapterIdx < chapters.length - 1) {
                toggleReaderAudio(subjId, chapterIdx + 1);
            }
        });
    }
}

/** Media Session 정리 (재생 중지/단원 전환 시) */
function clearMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('seekto', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
}

/** 플레이어 UI 요소 모음 */
function getAudioUI() {
    return {
        btn: document.getElementById('reader-audio-toggle-btn'),
        playerArea: document.getElementById('reader-audio-player-area'),
        label: document.getElementById('reader-audio-now-playing'),
        playPauseBtn: document.getElementById('reader-audio-playpause-btn'),
        seek: document.getElementById('reader-audio-seek'),
        curTime: document.getElementById('reader-audio-current'),
        durTime: document.getElementById('reader-audio-duration'),
        rateBtn: document.getElementById('reader-audio-rate-btn'),
        status: document.getElementById('reader-audio-status'),
        scrollBtn: document.getElementById('reader-audio-scroll-btn'),
    };
}

/**
 * 섹션별 예상 재생 구간을 계산한다.
 * 각 섹션의 텍스트 길이를 기준으로 전체 오디오 길이를 비례 배분한다.
 * @param {Array} sections - 섹션 배열
 * @param {number} duration - 오디오 전체 길이(초)
 * @returns {Array<{start:number,end:number}>} 섹션별 구간
 */
function computeSectionBoundaries(sections, duration) {
    if (!sections || !sections.length || !isFinite(duration) || duration <= 0) return [];
    const weights = sections.map(s => Math.max((s.content || '').length, 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    return weights.map(w => {
        const len = (w / total) * duration;
        const start = cursor;
        cursor += len;
        return { start, end: cursor };
    });
}

/** 현재 재생 시간에 해당하는 섹션 인덱스를 반환한다. */
function getCurrentSectionIdx(currentTime) {
    const bounds = readerAudioState.sectionBoundaries;
    if (!bounds.length) return -1;
    for (let i = 0; i < bounds.length; i++) {
        if (currentTime >= bounds[i].start && currentTime < bounds[i].end) return i;
    }
    // 마지막 섹션 끝 이후면 마지막 인덱스 반환
    return bounds.length - 1;
}

/** 현재 섹션을 하이라이트하고 필요 시 스크롤한다. */
function highlightAndScrollToSection(idx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    // 하이라이트 갱신
    container.querySelectorAll('.reader-section-card').forEach(card => {
        card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === idx);
    });

    // 자동 스크롤
    if (readerAudioState.autoScroll && idx !== readerAudioState.lastSectionIdx) {
        const target = document.getElementById(`reader-section-${idx}`);
        if (target) {
            // 접혀 있으면 펼치기
            if (target.classList.contains('collapsed')) {
                target.classList.remove('collapsed');
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
    readerAudioState.lastSectionIdx = idx;
}

/** timeupdate 이벤트에서 호출: 현재 섹션 동기화 */
function syncScrollWithAudio() {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    const idx = getCurrentSectionIdx(a.currentTime);
    if (idx >= 0) highlightAndScrollToSection(idx);
}

/** 자동 스크롤 설정 저장/불러오기 */
function getSavedAutoScroll() {
    try {
        const v = localStorage.getItem(READER_AUDIO_AUTOSCROLL_KEY);
        return v === null ? true : v === '1';
    } catch (e) { return true; }
}
function saveAutoScroll(enabled) {
    try { localStorage.setItem(READER_AUDIO_AUTOSCROLL_KEY, enabled ? '1' : '0'); } catch (e) { /* noop */ }
}

/** 자동 스크롤 토글 버튼 UI 갱신 */
function updateAutoScrollBtn() {
    const ui = getAudioUI();
    if (!ui.scrollBtn) return;
    ui.scrollBtn.innerHTML = readerAudioState.autoScroll
        ? '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기'
        : '<i class="fa-solid fa-arrows-up-down"></i> 스크롤 수동';
    ui.scrollBtn.classList.toggle('active', readerAudioState.autoScroll);
    ui.scrollBtn.title = readerAudioState.autoScroll
        ? '오디오 위치에 맞춰 자동으로 스크롤합니다'
        : '자동 스크롤이 꺼져 있습니다';
}

/** 자동 스크롤 토글 */
export function toggleReaderAutoScroll() {
    readerAudioState.autoScroll = !readerAudioState.autoScroll;
    saveAutoScroll(readerAudioState.autoScroll);
    updateAutoScrollBtn();
    showAudioToast(readerAudioState.autoScroll ? '오디오 따라가기 켜짐' : '오디오 따라가기 꺼짐');
}

/** 재생/일시정지 아이콘 갱신 */
function updatePlayPauseIcon() {
    const ui = getAudioUI();
    const playing = readerAudioState.audio && !readerAudioState.audio.paused;
    if (ui.playPauseBtn) {
        ui.playPauseBtn.innerHTML = playing
            ? '<i class="fa-solid fa-pause"></i>'
            : '<i class="fa-solid fa-play"></i>';
        ui.playPauseBtn.title = playing ? '일시정지' : '재생';
    }
    if (ui.btn) {
        ui.btn.innerHTML = (readerAudioState.audio)
            ? '<i class="fa-solid fa-stop"></i> 정지'
            : '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    }
}

/** 재생 상태 메시지 표시 (로딩/버퍼링/오류) */
function setAudioStatus(msg) {
    const ui = getAudioUI();
    if (ui.status) {
        ui.status.textContent = msg || '';
        ui.status.style.display = msg ? 'inline' : 'none';
    }
}

/** 저장된 재생 속도 적용 */
function getSavedRate() {
    try {
        const v = parseFloat(localStorage.getItem(READER_AUDIO_RATE_KEY));
        return (isFinite(v) && v >= 0.5 && v <= 3) ? v : 1;
    } catch (e) { return 1; }
}

/** 재생 속도 순환 변경 (0.75 → 1 → 1.25 → 1.5 → 2 → 0.75) */
export function cycleReaderAudioRate() {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const a = readerAudioState.audio;
    const current = a ? a.playbackRate : getSavedRate();
    let idx = rates.findIndex(r => Math.abs(r - current) < 0.01);
    idx = (idx + 1) % rates.length;
    const newRate = rates[idx];
    if (a) a.playbackRate = newRate;
    try { localStorage.setItem(READER_AUDIO_RATE_KEY, String(newRate)); } catch (e) { /* noop */ }
    const ui = getAudioUI();
    if (ui.rateBtn) ui.rateBtn.textContent = newRate + 'x';
}

/** 시크바 입력 → 오디오 위치 이동 */
export function seekReaderAudio(value) {
    const a = readerAudioState.audio;
    if (!a || !isFinite(a.duration) || a.duration <= 0) return;
    a.currentTime = (parseFloat(value) / 100) * a.duration;
}

/**
 * 현재 재생 중인 오디오를 완전히 정지하고 상태를 초기화한다.
 * (단원 전환·과목 전환·다른 화면 이동 시 백그라운드 재생 방지)
 */
export function stopReaderAudio() {
    persistCurrentAudioPos(); // 정지 전 위치 저장(이어보기)
    if (readerAudioState.audio) {
        try { readerAudioState.audio.pause(); } catch (e) { /* noop */ }
        readerAudioState.audio = null;
    }
    readerAudioState.currentSrc = '';
    readerAudioState.subjId = '';
    readerAudioState.chapterIdx = -1;
    readerAudioState.chapterTitle = '';
    readerAudioState.sectionBoundaries = [];
    readerAudioState.lastSectionIdx = -1;
    // Media Session 정리
    clearMediaSession();
    // 하이라이트 제거
    const container = document.getElementById('textbook-reader-container');
    if (container) {
        container.querySelectorAll('.reader-section-card.current-section').forEach(el => el.classList.remove('current-section'));
    }
    const ui = getAudioUI();
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-headphones"></i> 오디오 듣기';
    if (ui.playerArea) ui.playerArea.style.display = 'none';
    setAudioStatus('');
}

/** 재생/일시정지 토글 (플레이어 내 버튼) */
export function toggleReaderPlayPause() {
    const a = readerAudioState.audio;
    if (!a) return;
    if (a.paused) {
        a.play().catch(err => {
            console.error('재개 실패:', err);
            setAudioStatus('재생 실패');
        });
    } else {
        a.pause();
    }
}

/**
 * 오디오 로드 및 재생 시작. 같은 단원이면 정지, 다른 단원이면 새로 로드.
 */
export function toggleReaderAudio(subjId, chapterIdx) {
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || !subj.chapters[chapterIdx]) return;
    const chapter = subj.chapters[chapterIdx];
    const audioPath = getAudioPathForChapter(subjId, chapter);
    if (!audioPath) {
        alert('이 단원은 오디오 파일이 없습니다.');
        return;
    }

    const ui = getAudioUI();

    // 같은 오디오를 다시 클릭 → 정지(플레이어 닫기)
    if (readerAudioState.audio && readerAudioState.currentSrc === audioPath) {
        stopReaderAudio();
        return;
    }

    // 다른 오디오 재생 중 → 정지 후 교체 (위치는 저장됨)
    if (readerAudioState.audio) {
        stopReaderAudio();
    }

    // 플레이어 영역 표시 + 로딩 표시
    if (ui.playerArea) ui.playerArea.style.display = 'block';
    if (ui.label) ui.label.textContent = chapter.chapterTitle;
    setAudioStatus('로딩 중…');
    if (ui.btn) ui.btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 로딩';
    if (ui.rateBtn) ui.rateBtn.textContent = getSavedRate() + 'x';

    // 새 오디오 생성
    const audio = new Audio();
    audio.preload = 'auto';
    readerAudioState.audio = audio;
    readerAudioState.currentSrc = audioPath;
    readerAudioState.subjId = subjId;
    readerAudioState.chapterIdx = chapterIdx;
    readerAudioState.chapterTitle = chapter.chapterTitle;
    readerAudioState.lastSectionIdx = -1;

    // Media Session API: 잠금화면/알림바 미디어 제어 활성화
    setupMediaSession(audio, subjId, chapterIdx, chapter.chapterTitle);

    // 자동 스크롤 설정 복원
    readerAudioState.autoScroll = getSavedAutoScroll();
    updateAutoScrollBtn();

    // 이어보기: 메타데이터 로드 후 저장 위치로 이동
    audio.addEventListener('loadedmetadata', () => {
        const resume = getSavedAudioPos(audioPath);
        if (resume > 0 && resume < audio.duration - 5) {
            audio.currentTime = resume;
            setAudioStatus(formatAudioTime(resume) + '부터 이어듣기');
            setTimeout(() => setAudioStatus(''), 2500);
        } else {
            setAudioStatus('');
        }
        if (ui.durTime) ui.durTime.textContent = formatAudioTime(audio.duration);
        if (ui.seek) { ui.seek.disabled = false; }

        // 섹션별 예상 재생 구간 계산
        readerAudioState.sectionBoundaries = computeSectionBoundaries(chapter.sections, audio.duration);
        // 이어보기 위치에 맞는 섹션 즉시 하이라이트
        syncScrollWithAudio();
    });

    // 진행 시간/시크바 갱신 + 섹션 동기화
    audio.addEventListener('timeupdate', () => {
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        if (ui.seek && document.activeElement !== ui.seek) {
            ui.seek.value = String((audio.currentTime / audio.duration) * 100);
        }
        if (ui.curTime) ui.curTime.textContent = formatAudioTime(audio.currentTime);
        syncScrollWithAudio();
    });

    // 주기적 위치 저장 (5초마다)
    audio.addEventListener('timeupdate', () => {
        if (Math.floor(audio.currentTime) % 5 === 0) {
            saveAudioPos(audioPath, audio.currentTime, audio.duration);
        }
    });

    audio.addEventListener('play', () => {
        updatePlayPauseIcon(); setAudioStatus('');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('pause', () => {
        updatePlayPauseIcon(); saveAudioPos(audioPath, audio.currentTime, audio.duration);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
    audio.addEventListener('waiting', () => setAudioStatus('버퍼링…'));
    audio.addEventListener('playing', () => setAudioStatus(''));
    audio.addEventListener('canplay', () => setAudioStatus(''));

    audio.addEventListener('ended', () => {
        saveAudioPos(audioPath, audio.duration, audio.duration); // 저장 위치 삭제
        updatePlayPauseIcon();
        setAudioStatus('재생 완료');
    });

    audio.addEventListener('error', () => {
        const code = audio.error ? audio.error.code : 0;
        const msgMap = {
            1: '오디오 로딩이 중단되었습니다.',
            2: '네트워크 오류로 오디오를 불러올 수 없습니다.',
            3: '오디오 디코딩에 실패했습니다.',
            4: '오디오 형식이 지원되지 않거나 파일을 찾을 수 없습니다.',
        };
        const msg = msgMap[code] || '오디오를 불러올 수 없습니다.';
        setAudioStatus(msg);
        alert(msg + '\n\n경로: ' + audioPath);
        stopReaderAudio();
    });

    // 저장된 재생 속도 적용
    audio.playbackRate = getSavedRate();

    // 소스 설정 후 재생
    audio.src = audioPath;
    const playPromise = audio.play();
    if (playPromise) {
        playPromise.then(() => {
            updatePlayPauseIcon();
        }).catch(err => {
            // 모바일 자동재생 정책 등으로 차단된 경우
            console.warn('자동재생 차단/재생 실패:', err);
            setAudioStatus('재생 버튼을 눌러 시작하세요');
            updatePlayPauseIcon();
        });
    }
}

// 모바일 브라우저: 탭 숨김 시 자동 일시정지, 복귀 시 상태 복원
document.addEventListener('visibilitychange', () => {
    const a = readerAudioState.audio;
    if (!a) return;
    if (document.hidden) {
        readerAudioState.wasPlayingBeforeHidden = !a.paused;
        if (!a.paused) { a.pause(); }
    }
    // 복귀 시 자동 재개는 하지 않음(사용자 제스처 필요 정책 회피). 아이콘만 갱신.
    if (!document.hidden) { updatePlayPauseIcon(); }
});

export { textbookReaderState };

export function renderTextbookReader() {
    const subjectSelect = document.getElementById('reader-subject-select');
    const chapterSelect = document.getElementById('reader-chapter-select');
    const container = document.getElementById('textbook-reader-container');
    
    if (!subjectSelect || !chapterSelect || !container) return;

    // Initialize reader convenience toolbar (font size, theme, focus mode, etc.)
    initReaderToolbar();
    
    // Always repopulate subject select to ensure fresh state
    const previousValue = subjectSelect.value || textbookReaderState.selectedSubject;
    subjectSelect.innerHTML = '<option value="">과목을 선택하세요</option>';
    
    // DataLoader를 사용하여 레지스트리 기반으로 과목 목록 구성
    const subjects = (typeof DataLoader !== 'undefined' && DataLoader.registry)
        ? DataLoader.getSubjectList()
        : [];
    
    subjects.forEach(subj => {
        const option = document.createElement('option');
        option.value = subj.key;
        option.textContent = subj.name;
        subjectSelect.appendChild(option);
    });
    
    // Restore subject selection
    if (previousValue && subjectSelect.querySelector(`option[value="${previousValue}"]`)) {
        subjectSelect.value = previousValue;
        textbookReaderState.selectedSubject = previousValue;
    }
    
    // Restore previous selections
    if (textbookReaderState.selectedSubject) {
        subjectSelect.value = textbookReaderState.selectedSubject;
        populateChapterSelect(textbookReaderState.selectedSubject);
        if (textbookReaderState.selectedChapter) {
            chapterSelect.value = textbookReaderState.selectedChapter;
            renderChapterContent(textbookReaderState.selectedSubject, textbookReaderState.selectedChapter);
        }
    }
    
    // Bind events only once
    if (!subjectSelect.dataset.bound) {
        subjectSelect.dataset.bound = 'true';
        
        subjectSelect.addEventListener('change', (e) => {
            const subjId = e.target.value;
            textbookReaderState.selectedSubject = subjId;
            textbookReaderState.selectedChapter = '';
            const hadAudio = !!readerAudioState.audio;
            stopReaderAudio();
            if (hadAudio) showAudioToast('과목이 변경되어 오디오 재생이 중지되었습니다.');
            
            if (subjId) {
                chapterSelect.disabled = false;
                DataLoader.loadSubject(subjId).then(() => {
                    populateChapterSelect(subjId);
                });
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>단원을 선택하세요</h3>
                        <p>위에서 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            } else {
                chapterSelect.disabled = true;
                chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-book-open" style="font-size: 3rem; color: var(--color-text-muted); margin-bottom: 1rem; display: block;"></i>
                        <h3>읽을 교재를 선택하세요</h3>
                        <p>위에서 과목과 단원을 선택하면 해당 교재의 본문 내용이 표시됩니다.</p>
                    </div>
                `;
            }
        });
        
        chapterSelect.addEventListener('change', (e) => {
            const chapterIdx = e.target.value;
            textbookReaderState.selectedChapter = chapterIdx;
            
            if (chapterIdx && textbookReaderState.selectedSubject) {
                renderChapterContent(textbookReaderState.selectedSubject, parseInt(chapterIdx));
            }
        });
    }

    // Story mode checkbox binding (bind once)
    const storyToggle = document.getElementById('reader-story-mode-toggle');
    if (storyToggle && !storyToggle.dataset.bound) {
        storyToggle.dataset.bound = 'true';
        storyToggle.checked = textbookReaderState.storyMode;
        storyToggle.addEventListener('change', (e) => {
            textbookReaderState.storyMode = e.target.checked;
            // Re-render current chapter if one is selected
            if (textbookReaderState.selectedSubject && textbookReaderState.selectedChapter) {
                renderChapterContent(textbookReaderState.selectedSubject, parseInt(textbookReaderState.selectedChapter));
            }
        });
    }
}

function populateChapterSelect(subjId) {
    const chapterSelect = document.getElementById('reader-chapter-select');
    if (!chapterSelect) return;
    
    chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';
    
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters) return;
    
    subj.chapters.forEach((chapter, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = chapter.chapterTitle;
        chapterSelect.appendChild(option);
    });
}

function renderChapterContent(subjId, chapterIdx) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    chapterIdx = parseInt(chapterIdx);
    const STUDY_DATA = (typeof window !== 'undefined' && window.STUDY_DATA) ? window.STUDY_DATA : {};
    const subj = STUDY_DATA[subjId];
    if (!subj || !subj.chapters || isNaN(chapterIdx) || !subj.chapters[chapterIdx]) return;

    const originalChapter = subj.chapters[chapterIdx];

    // 다른 단원으로 이동하면 이전 오디오 정지
    if (readerAudioState.audio &&
        (readerChapterContext.subjId !== subjId || readerChapterContext.chapterIdx !== chapterIdx)) {
        stopReaderAudio();
        showAudioToast('단원이 변경되어 오디오 재생이 중지되었습니다.');
    }

    readerChapterContext.subjId = subjId;
    readerChapterContext.chapterIdx = chapterIdx;

    const isStory = textbookReaderState.storyMode;
    if (isStory) {
        _loadStoryChapter(subjId, chapterIdx, originalChapter).then(chapter => {
            _renderChapterContentInternal(subjId, chapterIdx, subj, chapter, true);
        }).catch(err => {
            console.warn('[Story Mode] 이야기형 MD 로드 실패, 기본 모드로 전환:', err);
            showAudioToast('이야기형 파일을 불러올 수 없어 기본 모드로 표시합니다.');
            const filteredChapter = _filterMetaSections(originalChapter);
            _renderChapterContentInternal(subjId, chapterIdx, subj, filteredChapter, false);
        });
    } else {
        const filteredChapter = _filterMetaSections(originalChapter);
        _renderChapterContentInternal(subjId, chapterIdx, subj, filteredChapter, false);
    }
}

async function _loadStoryChapter(subjId, chapterIdx, originalChapter) {
    const cacheKey = `${subjId}:${chapterIdx}`;
    if (_storyChapterCache[cacheKey]) return _storyChapterCache[cacheKey];

    const storyFile = originalChapter.fileName.replace(/\.md$/i, '_이야기형.md');
    const manifest = await DataLoader._getManifest();
    const subjMeta = manifest.subjects.find(s => s.key === subjId);
    if (!subjMeta) throw new Error('과목 메타데이터 없음: ' + subjId);

    const relPath = `content/${subjMeta.dir}/${storyFile}`;
    const md = await DataLoader._getMd(relPath, subjId);
    const subjectDir = `content/${subjMeta.dir}`;
    const parsed = parseTextbookContent(md, storyFile, subjectDir);

    const storyChapter = {
        chapterTitle: parsed.chapterTitle,
        sections: parsed.sections.filter(s => !_isStoryMetaSection(s.title)),
        filePath: `./content/${subjMeta.dir}/${storyFile}`,
        fileName: storyFile
    };

    _storyChapterCache[cacheKey] = storyChapter;
    return storyChapter;
}

const _STORY_META_PATTERNS = [
    /^🧭\s*학습\s*아이콘/,
    /^🎯\s*최우선\s*암기\s*축/,
    /^🔢\s*숫자\s*암기\s*미리보기/,
    /^🎯\s*과목\s*시각화\s*개요/,
    /^🚀\s*시험\s*직전/,
    /^📖\s*학습\s*안내/,
    /^📖\s*핵심\s*용어\s*정리/,
    /^📊.*비교표/,
    /^✅\s*확인문제/,
    /^목차\s*$/,
    /^🔍\s*키워드/,
    /^출처:\s/,
];

function _isStoryMetaSection(title) {
    const t = (title || '').trim();
    return _STORY_META_PATTERNS.some(p => p.test(t));
}

function _filterMetaSections(chapter) {
    return {
        ...chapter,
        sections: (chapter.sections || []).filter(s => !_isStoryMetaSection(s.title))
    };
}

async function _renderChapterContentInternal(subjId, chapterIdx, subj, chapter, isStoryMode) {
    const container = document.getElementById('textbook-reader-container');
    if (!container) return;

    container.classList.toggle('story-mode', !!isStoryMode);

    // Show reader auxiliary UI
    const toolbar = document.getElementById('reader-toolbar');
    const toc = document.getElementById('reader-toc');
    const progressBar = document.getElementById('reader-progress-bar');
    if (toolbar) toolbar.style.display = 'flex';
    if (toc) toc.style.display = 'block';
    if (progressBar) progressBar.style.display = 'block';

    const bookmarks = getReaderBookmarks();

    // Build TOC
    const tocList = document.getElementById('reader-toc-list');
    if (tocList) {
        let tocHtml = chapter.sections.map((section, idx) => `
            <div class="reader-toc-item" data-section-idx="${idx}">
                <span class="toc-num">${idx + 1}</span>
                <span>${esc(section.title)}</span>
            </div>
        `).join('');
        tocList.innerHTML = tocHtml;
        tocList.querySelectorAll('.reader-toc-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.sectionIdx);
                const target = document.getElementById(`reader-section-${idx}`);
                if (target) {
                    // Expand if collapsed
                    if (target.classList.contains('collapsed')) {
                        target.classList.remove('collapsed');
                    }
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    // Estimate reading time (Korean ~500 chars/min)
    const totalChars = chapter.sections.reduce((acc, s) => acc + (s.content ? s.content.length : 0), 0);
    const readMinutes = Math.max(1, Math.round(totalChars / 500));

    const audioPath = getAudioPathForChapter(subjId, chapter);
    const hasAudio = !!audioPath;

    // 챕터 전체에서 출처 텍스트 추출 (컨텍스트 사이드바 + L-line PDF 링크용)
    let chapterSourceText = '';
    for (const s of chapter.sections) {
        const m = (s.content || '').match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n)/);
        if (m) { chapterSourceText = m[1]; break; }
    }
    const chapterRefPath = mapSourceToRef(chapterSourceText);

    // --- 용어집 항목 사전 계산 (glossary-renderer 모듈 위임) ---
    const glossaryItems = collectGlossaryItems(chapter.sections, chapterRefPath, mapSourceToRef);
    const hasGlossary = glossaryItems.length > 0;

    // TOC에 용어집 항목 추가
    if (hasGlossary && tocList) {
        appendGlossaryTocItem(tocList);
    }

    let html = `
        <div class="reader-readable-width">
        <div class="reader-chapter-header-card">
            <span class="badge badge-cyan">${esc(subj.name)}</span>
            ${isStoryMode ? '<span class="badge badge-story"><i class="fa-solid fa-book-open-reader"></i> 이야기형</span>' : ''}
            <h3>${esc(chapter.chapterTitle)}</h3>
            <div class="reader-chapter-meta">
                <span><i class="fa-solid fa-layer-group"></i> 섹션 ${chapter.sections.length}개</span>
                <span><i class="fa-regular fa-clock"></i> 예상 읽기 시간 약 ${readMinutes}분</span>
                ${isStoryMode ? '' : renderExamFilterToggle()}
                <a href="${esc(chapter.filePath)}" target="_blank" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 원본 MD
                </a>
                <details id="reader-ref-dropdown" class="reader-ref-dropdown" style="display: inline-block; position: relative;">
                    <summary class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem; cursor: pointer; list-style: none;">
                        <i class="fa-solid fa-book-bookmark"></i> 참조자료
                    </summary>
                    <div class="reader-ref-panel" style="position: absolute; top: 100%; left: 0; z-index: 100; margin-top: 0.4rem; min-width: 320px; max-height: 400px; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); padding: 0.6rem;">
                        ${buildReferenceLinks(subjId, chapterRefPath)}
                    </div>
                </details>
                ${hasAudio ? `
                <button id="reader-audio-toggle-btn" class="btn btn-secondary" data-click="toggleReaderAudio" data-args='["${subjId}", ${chapterIdx}]' style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                    <i class="fa-solid fa-headphones"></i> 오디오 듣기
                </button>` : ''}
            </div>
            ${hasAudio ? `
            <div id="reader-audio-player-area" style="display: none; margin-top: 0.75rem; padding: 0.75rem 0.9rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 8px; font-size: 0.85rem; color: var(--color-text-muted);">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem;">
                    <i class="fa-solid fa-circle-play" style="color: var(--color-primary);"></i>
                    <span id="reader-audio-now-playing" style="color: var(--color-text-main); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    <span id="reader-audio-status" style="margin-left: auto; font-size: 0.78rem; color: var(--warning); display: none;"></span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <button id="reader-audio-playpause-btn" class="btn btn-secondary" data-click="toggleReaderPlayPause" title="재생" style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; padding: 0; border-radius: 50%; flex-shrink: 0;">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <span id="reader-audio-current" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <input type="range" id="reader-audio-seek" min="0" max="100" value="0" step="0.1" disabled data-input="seekReaderAudio" style="flex: 1; accent-color: var(--color-primary); cursor: pointer; height: 4px;">
                    <span id="reader-audio-duration" style="font-variant-numeric: tabular-nums; flex-shrink: 0;">0:00</span>
                    <button id="reader-audio-rate-btn" class="btn btn-secondary" data-click="cycleReaderAudioRate" title="재생 속도" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; min-width: 3rem;">1x</button>
                    <button id="reader-audio-scroll-btn" class="btn btn-secondary" data-click="toggleReaderAutoScroll" title="오디오 위치에 맞춰 자동으로 스크롤" style="font-size: 0.78rem; padding: 0.25rem 0.5rem; flex-shrink: 0; white-space: nowrap;">
                        <i class="fa-solid fa-arrows-up-down"></i> 스크롤 따라가기
                    </button>
                </div>
            </div>` : ''}
        </div>
    `;

    html += await renderStudyAids(chapter, subjId);

    const subjRefFiles = REFERENCE_FILES[subjId] || [];
    const subjDirName = SUBJECT_DIR_MAP[subjId] || '';

    chapter.sections.forEach((section, idx) => {
        const bookmarkKey = `${subjId}_${chapterIdx}_${idx}`;
        const isBookmarked = bookmarks.includes(bookmarkKey);
        const secSrcMatch = (section.content || '').match(/📌\s*\*\*출처\*\*[:：]\s*(.+?)(?:\||\n)/);
        const secRefPath = secSrcMatch ? mapSourceToRef(secSrcMatch[1]) : null;
        const refPath = secRefPath || chapterRefPath;
        html += `
            <div class="reader-section-card" id="reader-section-${idx}" data-section-idx="${idx}">
                <div class="reader-section-header" data-section-idx="${idx}">
                    <i class="fa-solid fa-chevron-down reader-section-toggle"></i>
                    <span class="reader-section-num">${idx + 1}</span>
                    <h4 class="reader-section-title">${esc(section.title)}</h4>
                    <button class="reader-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-bookmark-key="${esc(bookmarkKey)}" title="북마크 ${isBookmarked ? '제거' : '추가'}">
                        <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="reader-section-body">
                    <div class="textbook-reader-section-content">
                        ${formatSectionContentForReader(section.content, chapter.filePath, refPath, subjRefFiles, subjDirName, glossaryItems)}
                    </div>
                </div>
            </div>
        `;
    });

    // --- 과목별 용어집 테이블 (glossary-renderer 모듈 위임) ---
    if (hasGlossary) {
        html += renderGlossaryTable(glossaryItems);
    }

    // Prev / Next chapter navigation
    const prevChapter = chapterIdx > 0 ? subj.chapters[chapterIdx - 1] : null;
    const nextChapter = chapterIdx < subj.chapters.length - 1 ? subj.chapters[chapterIdx + 1] : null;
    html += `
        <div class="reader-chapter-nav">
            <button class="reader-nav-btn prev" ${prevChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx - 1}">
                <span class="nav-dir"><i class="fa-solid fa-arrow-left"></i> 이전 단원</span>
                <span class="nav-title">${prevChapter ? esc(prevChapter.chapterTitle) : '이전 단원 없음'}</span>
            </button>
            <button class="reader-nav-btn next" ${nextChapter ? '' : 'disabled'} data-nav-idx="${chapterIdx + 1}">
                <span class="nav-dir">다음 단원 <i class="fa-solid fa-arrow-right"></i></span>
                <span class="nav-title">${nextChapter ? esc(nextChapter.chapterTitle) : '다음 단원 없음'}</span>
            </button>
        </div>
        </div><!-- /reader-readable-width -->
    `;

    container.innerHTML = html;

    // Study aid toggles (기출 핵심, 숫자 암기표)
    bindStudyAidToggles(container);

    // Exam filter button — 기출/중요 마커가 있는 섹션만 강조
    const examFilterBtn = container.querySelector('#exam-filter-btn');
    if (examFilterBtn) {
        let filterActive = false;
        examFilterBtn.addEventListener('click', () => {
            filterActive = !filterActive;
            examFilterBtn.classList.toggle('active', filterActive);
            const btnText = examFilterBtn.querySelector('span');
            if (btnText) btnText.textContent = filterActive ? '기출만 보기 ON' : '기출만 보기';
            applyExamFilter(container, chapter, filterActive);
        });
    }

    // Section collapse toggles
    container.querySelectorAll('.reader-section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.reader-bookmark-btn')) return;
            const card = header.closest('.reader-section-card');
            if (card) card.classList.toggle('collapsed');
        });
    });

    // Bookmark buttons
    container.querySelectorAll('.reader-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReaderBookmark(btn.dataset.bookmarkKey, btn);
        });
    });

    // Prev/Next nav buttons
    container.querySelectorAll('.reader-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const navIdx = parseInt(btn.dataset.navIdx);
            textbookReaderState.selectedChapter = String(navIdx);
            const chapterSelect = document.getElementById('reader-chapter-select');
            if (chapterSelect) chapterSelect.value = String(navIdx);
            renderChapterContent(subjId, navIdx);
            container.scrollTop = 0;
        });
    });

    // Table expand buttons
    container.querySelectorAll('.reader-table-wrapper').forEach(wrapper => {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'reader-table-expand-btn';
        expandBtn.title = '표 전체 화면으로 보기';
        expandBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        expandBtn.addEventListener('click', () => openTableModal(wrapper));
        wrapper.appendChild(expandBtn);
    });

    // Scroll position reset + scroll spy binding
    container.scrollTop = 0;
    bindReaderScrollEvents();
    applyReaderFontScale();
    applyReaderThemeClass();

    // Mermaid 다이어그램 렌더링 (pre.mermaid 노드가 있을 때만 온디맨드 로드)
    _renderReaderMermaid(container);

    // 참조자료 링크 이벤트 바인딩
    bindReferenceLinks();
}

// --- Mermaid 온디맨드 로드 (manual-viewer.js 패턴과 동일) ---
let _mermaidLoadPromise = null;
function _ensureMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './vendor/mermaid/mermaid.min.js';
        script.async = true;
        script.onload = () => {
            if (window.mermaid) resolve(window.mermaid);
            else reject(new Error('mermaid loaded but window.mermaid is undefined'));
        };
        script.onerror = (e) => { _mermaidLoadPromise = null; reject(e); };
        document.head.appendChild(script);
    });
    return _mermaidLoadPromise;
}

function _renderReaderMermaid(container) {
    const nodes = container ? container.querySelectorAll('pre.mermaid') : [];
    if (nodes.length === 0) return;
    _ensureMermaid()
        .then((mermaid) => {
            try {
                const isLight = document.documentElement.classList.contains('light-theme');
                const nodeArr = Array.from(nodes);
                // 각 노드의 diagram 타입 감지하여 클래스 추가
                nodeArr.forEach(node => {
                    const text = node.textContent.trim();
                    if (text.startsWith('mindmap')) {
                        node.classList.add('mermaid-mindmap');
                    } else {
                        node.classList.add('mermaid-flowchart');
                    }
                });
                let rendered = 0;
                let failed = 0;
                const renderNext = (i) => {
                    if (i >= nodeArr.length) {
                        if (failed > 0) console.warn(`[reader] mermaid: ${rendered} rendered, ${failed} failed`);
                        return;
                    }
                    const node = nodeArr[i];
                    // flowchart에만 lineWidth 적용, mindmap은 기본값
                    const isMindmap = node.classList.contains('mermaid-mindmap');
                    if (!isMindmap) {
                        mermaid.initialize({
                            startOnLoad: false,
                            securityLevel: 'loose',
                            theme: isLight ? 'default' : 'dark',
                            themeVariables: isLight ? {
                                primaryColor: '#f0f4ff',
                                primaryTextColor: '#1a1a2e',
                                primaryBorderColor: '#4a6fa5',
                                lineColor: '#4a6fa5',
                                secondaryColor: '#f5f5f5',
                                tertiaryColor: '#e8eaf6',
                                background: '#ffffff',
                                mainBkg: '#f0f4ff',
                                nodeTextColor: '#1a1a2e',
                                fontSize: '14px',
                                lineWidth: 1
                            } : {
                                primaryColor: '#2d2d44',
                                primaryTextColor: '#e0e0e0',
                                primaryBorderColor: '#7b8faf',
                                lineColor: '#7b8faf',
                                secondaryColor: '#1e1e2e',
                                tertiaryColor: '#2a2a3e',
                                background: '#1a1a2e',
                                mainBkg: '#2d2d44',
                                nodeTextColor: '#e0e0e0',
                                fontSize: '14px',
                                lineWidth: 1
                            }
                        });
                    } else {
                        mermaid.initialize({
                            startOnLoad: false,
                            securityLevel: 'loose',
                            theme: isLight ? 'default' : 'dark'
                        });
                    }
                    mermaid.run({ nodes: [node] })
                        .then(() => { rendered++; renderNext(i + 1); })
                        .catch((e) => {
                            failed++;
                            console.warn(`[reader] mermaid node ${i} failed:`, e?.message || e);
                            node.innerHTML = '<span style="color:var(--color-text-muted);font-size:0.8rem;">[다이어그램 렌더링 실패]</span>';
                            renderNext(i + 1);
                        });
                };
                renderNext(0);
            } catch (e) {
                console.warn('[reader] mermaid render failed:', e);
            }
        })
        .catch((e) => console.warn('[reader] mermaid load failed:', e));
}

// --- Reader convenience feature state & logic ---
let readerChapterContext = { subjId: '', chapterIdx: 0 };
let readerFontScale = parseFloat(localStorage.getItem('readerFontScale')) || 1;
let readerScrollBound = false;

function getReaderBookmarks() {
    try {
        return JSON.parse(localStorage.getItem('readerBookmarks')) || [];
    } catch { return []; }
}

function toggleReaderBookmark(key, btn) {
    let bookmarks = getReaderBookmarks();
    const idx = bookmarks.indexOf(key);
    if (idx >= 0) {
        bookmarks.splice(idx, 1);
        btn.classList.remove('bookmarked');
        btn.querySelector('i').className = 'fa-regular fa-bookmark';
        btn.title = '북마크 추가';
    } else {
        bookmarks.push(key);
        btn.classList.add('bookmarked');
        btn.querySelector('i').className = 'fa-solid fa-bookmark';
        btn.title = '북마크 제거';
    }
    localStorage.setItem('readerBookmarks', JSON.stringify(bookmarks));
}

function applyReaderFontScale() {
    const container = document.getElementById('textbook-reader-container');
    const display = document.getElementById('reader-font-size-display');
    if (container) container.style.setProperty('--reader-font-scale', readerFontScale);
    if (display) display.textContent = Math.round(readerFontScale * 100) + '%';
    localStorage.setItem('readerFontScale', readerFontScale);
}

function applyReaderThemeClass() {
    // 리더 테마는 전역 테마(window.AppTheme / <html>.light-theme)를 그대로 따름
    const view = document.getElementById('textbook-reader-view');
    const isLight = window.AppTheme
        ? window.AppTheme.isLight()
        : document.documentElement.classList.contains('light-theme');
    if (view) view.classList.toggle('reader-light-theme', isLight);
}

function bindReaderScrollEvents() {
    const container = document.getElementById('textbook-reader-container');
    if (!container || readerScrollBound) return;
    readerScrollBound = true;

    container.addEventListener('scroll', () => {
        // Progress bar
        const progressFill = document.getElementById('reader-progress-fill');
        if (progressFill) {
            const max = container.scrollHeight - container.clientHeight;
            const pct = max > 0 ? (container.scrollTop / max) * 100 : 0;
            progressFill.style.width = pct + '%';
        }
        // Back to top visibility
        const backBtn = document.getElementById('reader-back-to-top');
        if (backBtn) backBtn.style.display = container.scrollTop > 400 ? 'block' : 'none';

        // Scroll spy — highlight current section in TOC
        const cards = container.querySelectorAll('.reader-section-card');
        const containerTop = container.getBoundingClientRect().top;
        let currentIdx = -1;
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.top - containerTop < 120) {
                currentIdx = parseInt(card.dataset.sectionIdx);
            }
            card.classList.toggle('current-section', parseInt(card.dataset.sectionIdx) === currentIdx);
        });
        document.querySelectorAll('.reader-toc-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.sectionIdx) === currentIdx);
        });
    });

    // Back to top click
    const backBtn = document.getElementById('reader-back-to-top');
    if (backBtn && !backBtn.dataset.bound) {
        backBtn.dataset.bound = 'true';
        backBtn.addEventListener('click', () => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initReaderToolbar() {
    const decBtn = document.getElementById('reader-font-decrease');
    const incBtn = document.getElementById('reader-font-increase');
    const resetBtn = document.getElementById('reader-font-reset');
    const focusBtn = document.getElementById('reader-focus-toggle');
    const expandAllBtn = document.getElementById('reader-expand-all');
    const collapseAllBtn = document.getElementById('reader-collapse-all');
    const modalClose = document.getElementById('reader-table-modal-close');
    const modal = document.getElementById('reader-table-modal');

    if (decBtn && !decBtn.dataset.bound) {
        decBtn.dataset.bound = 'true';
        decBtn.addEventListener('click', () => {
            readerFontScale = Math.max(0.85, +(readerFontScale - 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (incBtn && !incBtn.dataset.bound) {
        incBtn.dataset.bound = 'true';
        incBtn.addEventListener('click', () => {
            readerFontScale = Math.min(1.4, +(readerFontScale + 0.05).toFixed(2));
            applyReaderFontScale();
        });
    }
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            readerFontScale = 1;
            applyReaderFontScale();
        });
    }
    // 헤더 등 다른 곳에서 테마가 바뀌면 리더도 즉시 동기화
    if (!document.body.dataset.readerThemeSync) {
        document.body.dataset.readerThemeSync = 'true';
        document.addEventListener('themechange', applyReaderThemeClass);
    }
    if (focusBtn && !focusBtn.dataset.bound) {
        focusBtn.dataset.bound = 'true';
        focusBtn.addEventListener('click', () => {
            const focused = document.body.classList.toggle('reader-focus-mode');
            focusBtn.classList.toggle('active', focused);
            focusBtn.innerHTML = focused
                ? '<i class="fa-solid fa-compress"></i> <span>집중 해제</span>'
                : '<i class="fa-solid fa-expand"></i> <span>집중 모드</span>';
        });
    }
    if (expandAllBtn && !expandAllBtn.dataset.bound) {
        expandAllBtn.dataset.bound = 'true';
        expandAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card.collapsed')
                .forEach(c => c.classList.remove('collapsed'));
        });
    }
    if (collapseAllBtn && !collapseAllBtn.dataset.bound) {
        collapseAllBtn.dataset.bound = 'true';
        collapseAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#textbook-reader-container .reader-section-card')
                .forEach(c => c.classList.add('collapsed'));
        });
    }
    if (modalClose && !modalClose.dataset.bound) {
        modalClose.dataset.bound = 'true';
        modalClose.addEventListener('click', closeTableModal);
    }
    if (modal && !modal.dataset.bound) {
        modal.dataset.bound = 'true';
        modal.querySelector('.reader-table-modal-backdrop').addEventListener('click', closeTableModal);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') closeTableModal();
        });
    }
}

function openTableModal(wrapper) {
    const modal = document.getElementById('reader-table-modal');
    const body = document.getElementById('reader-table-modal-body');
    if (!modal || !body) return;
    const table = wrapper.querySelector('table');
    if (!table) return;
    body.innerHTML = '';
    body.appendChild(table.cloneNode(true));
    modal.style.display = 'flex';
}

function closeTableModal() {
    const modal = document.getElementById('reader-table-modal');
    if (modal) modal.style.display = 'none';
}

// --- 참조자료 링크 기능 ---

function buildReferenceLinks(subjId, contextRefPath) {
    const dirName = SUBJECT_DIR_MAP[subjId];
    if (!dirName) return '';
    const subjectFiles = REFERENCE_FILES[subjId] || [];
    
    let links = '';

    // 컨텍스트 추천: 현재 단원의 출처와 관련된 참조자료를 상단에 표시
    if (contextRefPath) {
        const contextName = contextRefPath.split('/').pop().replace(/\.(html|md)$/, '');
        const allRefs = [
            ...subjectFiles.map(f => ({ ...f, path: f.type === 'md' ? `content/참조자료/${dirName}/${f.file}` : resolveRefPath(f.file) })),
            ...REFERENCE_COMMON.map(f => ({ ...f, path: resolveRefPath(f.file) })),
            ...REFERENCE_LAW.map(f => ({ ...f, path: resolveRefPath(f.file) })),
            ...REFERENCE_INGREDIENTS.map(f => ({ ...f, path: f.type === 'md' ? `content/참조자료/${f.dir}/${f.file}` : resolveRefPath(f.file) }))
        ];
        const matched = allRefs.filter(r => r.path === contextRefPath);
        const related = allRefs.filter(r => r.path !== contextRefPath && r.type !== 'md' && contextRefPath.endsWith(r.path?.split('/').pop() || ''));
        const contextRefs = [...matched, ...related].slice(0, 5);
        if (contextRefs.length > 0) {
            links += `<div class="ref-group-label" style="color: var(--color-primary, #1f6feb);"><i class="fa-solid fa-bookmark"></i> 이 단원의 참조자료 (${contextRefs.length})</div>`;
            contextRefs.forEach(f => {
                const icon = 'fa-file-lines';
                if (f.type === 'md') {
                    links += `<a class="ref-link-item" data-ref-md="${esc(f.path)}" style="background:rgba(31,111,235,0.08);"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
                } else {
                    links += `<a href="#" data-ref-html="${esc(f.path)}" class="ref-link-item" style="background:rgba(31,111,235,0.08);"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
                }
            });
            links += `<div style="border-top:1px solid var(--border-color,#30363d);margin:0.4rem 0;"></div>`;
        }
    }
    
    // 과목별 참조자료
    if (subjectFiles.length > 0) {
        links += `<div class="ref-group-label">과목별 참조자료</div>`;
        subjectFiles.forEach(f => {
            const icon = 'fa-file-lines';
            if (f.type === 'md') {
                const path = `content/참조자료/${dirName}/${f.file}`;
                links += `<a class="ref-link-item" data-ref-md="${esc(path)}"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
            } else {
                const path = resolveRefPath(f.file);
                links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid ${icon}"></i> ${esc(f.name)}</a>`;
            }
        });
    }
    
    // 원료 참조자료
    links += `<div class="ref-group-label">원료 참조자료</div>`;
    REFERENCE_INGREDIENTS.forEach(f => {
        if (f.type === 'md') {
            const path = `content/참조자료/${f.dir}/${f.file}`;
            links += `<a class="ref-link-item" data-ref-md="${esc(path)}"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
        } else {
            const path = resolveRefPath(f.file);
            links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
        }
    });
    
    // 법령원문
    links += `<div class="ref-group-label">법령원문</div>`;
    REFERENCE_LAW.forEach(f => {
        const path = resolveRefPath(f.file);
        links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
    });
    
    // 공통 참조자료
    links += `<div class="ref-group-label">공통 참조자료</div>`;
    REFERENCE_COMMON.forEach(f => {
        const path = resolveRefPath(f.file);
        links += `<a href="#" data-ref-html="${esc(path)}" class="ref-link-item"><i class="fa-solid fa-file-lines"></i> ${esc(f.name)}</a>`;
    });
    
    return links;
}

// --- 참조자료 인라인 프리뷰 (툴팁) ---
const _previewCache = {};
let _previewEl = null;
let _previewTimer = null;
let _previewTouchTimer = null;

function _ensurePreviewEl() {
    if (_previewEl) return _previewEl;
    _previewEl = document.createElement('div');
    _previewEl.id = 'ref-preview-tooltip';
    _previewEl.setAttribute('role', 'tooltip');
    _previewEl.style.cssText = 'position:fixed;z-index:10001;display:none;max-width:420px;max-height:280px;overflow-y:auto;background:var(--bg-card,#161b22);border:1px solid var(--border-color,#30363d);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);padding:12px 14px;font-size:0.85rem;line-height:1.5;color:var(--color-text,#e6edf3);pointer-events:none;';
    document.body.appendChild(_previewEl);
    return _previewEl;
}

async function _showPreview(linkEl) {
    const path = linkEl.dataset.refHtml;
    const search = linkEl.dataset.refSearch || '';
    if (!path) return;

    const el = _ensurePreviewEl();
    el.innerHTML = '<div style="opacity:0.6;">로딩 중...</div>';
    el.style.display = 'block';

    try {
        if (!_previewCache[path]) {
            const fileUrl = new URL(path, window.location.href).href;
            const resp = await fetch(fileUrl);
            const rawText = await resp.text();
            const isMd = path.endsWith('.md');
            let text;
            if (isMd) {
                text = rawText.replace(/^#{1,6}\s.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\|/g, ' ').trim();
            } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(rawText, 'text/html');
                text = doc.body.textContent.replace(/\s+/g, ' ').trim();
            }
            _previewCache[path] = text;
        }

        const fullText = _previewCache[path];
        let snippet;
        if (search && search.length >= 2) {
            const idx = fullText.toLowerCase().indexOf(search.toLowerCase());
            if (idx >= 0) {
                const start = Math.max(0, idx - 60);
                snippet = (start > 0 ? '...' : '') + fullText.slice(start, idx + search.length + 120) + '...';
            } else {
                snippet = fullText.slice(0, 200) + '...';
            }
        } else {
            snippet = fullText.slice(0, 200) + '...';
        }

        const fileName = decodeURIComponent(path.split('/').pop().replace(/\.(html|md)$/, ''));
        el.innerHTML = `<div style="font-weight:600;margin-bottom:4px;color:var(--color-primary,#1f6feb);"><i class="fa-solid fa-file-lines"></i> ${esc(fileName)}</div><div style="white-space:pre-wrap;word-break:break-word;">${esc(snippet)}</div>`;
    } catch (err) {
        el.innerHTML = '<div style="opacity:0.6;">미리보기를 불러올 수 없습니다.</div>';
    }

    // Position tooltip near the link
    const rect = linkEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (top + elRect.height > window.innerHeight - 10) {
        top = Math.max(10, rect.top - elRect.height - 6);
    }
    if (left + elRect.width > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - elRect.width - 10);
    }
    el.style.top = top + 'px';
    el.style.left = left + 'px';
}

function _hidePreview() {
    if (_previewEl) _previewEl.style.display = 'none';
}

function bindReferenceLinks() {
    // 기출문제 링크 → 앱 내 HTML 문제집 뷰어(ExamViewer)로 열기
    document.querySelectorAll('[data-exam-md]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const mdPath = a.dataset.examMd;
            if (mdPath && window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath);
            }
        });
    });

    document.querySelectorAll('[data-ref-md]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const mdPath = a.dataset.refMd;
            const lineNum = a.dataset.refLine ? parseInt(a.dataset.refLine) : null;
            if (window.ExamViewer && window.ExamViewer.openExam) {
                window.ExamViewer.openExam(mdPath, lineNum);
            }
        });
    });

    // 용어집 앵커 바인딩: glossary-renderer 모듈 위임
    bindGlossaryEvents(document);

    // HTML 뷰어 바인딩: data-ref-html 속성을 가진 모든 링크
    document.querySelectorAll('[data-ref-html]').forEach(a => {
        // 클릭 → 뷰어 열기
        a.addEventListener('click', (e) => {
            e.preventDefault();
            clearTimeout(_previewTimer);
            clearTimeout(_previewTouchTimer);
            _hidePreview();
            const refHtmlPath = a.dataset.refHtml;
            const searchKeyword = a.dataset.refSearch || '';
            const anchorId = a.dataset.refAnchor || '';
            const lineNum = a.dataset.refLine || '';
            if (refHtmlPath) {
                openHtmlViewer(refHtmlPath, searchKeyword, anchorId, lineNum);
            }
        });
        // 호버 프리뷰 (데스크톱)
        a.addEventListener('mouseenter', () => {
            clearTimeout(_previewTimer);
            _previewTimer = setTimeout(() => _showPreview(a), 400);
        });
        a.addEventListener('mouseleave', () => {
            clearTimeout(_previewTimer);
            _hidePreview();
        });
        // 롱프레스 프리뷰 (모바일)
        a.addEventListener('touchstart', () => {
            clearTimeout(_previewTouchTimer);
            _previewTouchTimer = setTimeout(() => _showPreview(a), 600);
        }, { passive: true });
        a.addEventListener('touchend', () => {
            clearTimeout(_previewTouchTimer);
            setTimeout(_hidePreview, 3000);
        }, { passive: true });
        a.addEventListener('touchmove', () => {
            clearTimeout(_previewTouchTimer);
            _hidePreview();
        }, { passive: true });
    });
}
