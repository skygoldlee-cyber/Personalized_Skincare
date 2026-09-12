// views/reader-audio.js — 오디오북 플레이어 (textbook-reader.js에서 추출)
import { showToast } from '../ui-utils.js';
import { TIMING } from '../config/timing.js';
import { PATHS } from '../paths.js';

// --- 오디오북 플레이어 상태 ---
export const readerAudioState = {
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
        localPath = PATHS.AUDIOBOOK_MP3(subjId, chNo, num, title);
    }

    // 3) 외부 CDN URL 변환 (audio_manifest.js 의 getAudioUrl — window 전역, 없으면 로컬 경로 그대로)
    const toUrl = (typeof window !== 'undefined' && window.getAudioUrl) || null;
    return toUrl ? toUrl(localPath) : localPath;
}

/** 화면 하단에 잠시 표시되는 토스트 알림 */
let _audioToastTimer = null;
export function showAudioToast(msg) {
    let toast = document.getElementById('reader-audio-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'reader-audio-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('is-visible');
    if (_audioToastTimer) clearTimeout(_audioToastTimer);
    _audioToastTimer = setTimeout(() => { toast.classList.remove('is-visible'); }, 2200);
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
export function persistCurrentAudioPos() {
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
        ui.status.classList.toggle('is-hidden', !msg);
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
    if (ui.playerArea) ui.playerArea.classList.add('is-hidden');
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
        showToast('이 단원은 오디오 파일이 없습니다.', 'warning');
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
    if (ui.playerArea) ui.playerArea.classList.remove('is-hidden');
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
            setTimeout(() => setAudioStatus(''), TIMING.AUDIO_STATUS_CLEAR_MS);
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
        showToast(msg + ' (경로: ' + audioPath + ')', 'error', 4000);
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
