// tests/dom/reader-audio.dom.test.js — 오디오북 플레이어 시나리오
// @spec AO-01,AO-02,AO-03,AO-04,AO-05
// 단원별 오디오 경로 해석, 플레이어 UI 표시, Media Session 메타데이터·액션 핸들러,
// 재생 속도 순환, 시크/정지를 고정한다.

import { describe, it, beforeEach, expect, vi } from 'vitest';

vi.mock('../../src/ui-utils.js', () => ({
    showToast: vi.fn(),
    showConfirm: vi.fn(() => Promise.resolve(true)),
    showGlobalLoading: vi.fn(),
    hideGlobalLoading: vi.fn(),
    vibrate: vi.fn(),
    trapFocus: vi.fn(),
    HAPTIC: { correct: 30, wrong: [40, 30, 40], tap: 10 },
}));

import { resetStudyState } from './helpers.js';
import {
    readerAudioState, getAudioPathForChapter, toggleReaderAudio,
    toggleReaderPlayPause, cycleReaderAudioRate, seekReaderAudio, stopReaderAudio,
} from '../../src/views/reader-audio.js';

function mountAudioUI() {
    document.body.innerHTML = `
        <button id="reader-audio-toggle-btn"></button>
        <div id="reader-audio-player-area" class="is-hidden">
            <span id="reader-audio-now-playing"></span>
            <button id="reader-audio-playpause-btn"></button>
            <input type="range" id="reader-audio-seek" min="0" max="100" value="0" disabled>
            <span id="reader-audio-current"></span>
            <span id="reader-audio-duration"></span>
            <button id="reader-audio-rate-btn">1x</button>
            <span id="reader-audio-status" class="is-hidden"></span>
            <button id="reader-audio-scroll-btn"></button>
        </div>`;
}

function installAudioStub() {
    const instances = [];
    class FakeAudio {
        constructor() {
            this.listeners = {};
            this.paused = true;
            this.currentTime = 0;
            this.duration = 120;
            this.playbackRate = 1;
            this.src = '';
            instances.push(this);
        }
        addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
        play() { this.paused = false; (this.listeners.play || []).forEach(f => f()); return Promise.resolve(); }
        pause() { this.paused = true; (this.listeners.pause || []).forEach(f => f()); }
    }
    vi.stubGlobal('Audio', FakeAudio);
    return instances;
}

function installMediaSessionStub() {
    const handlers = {};
    const ms = {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn((action, fn) => { handlers[action] = fn; }),
    };
    Object.defineProperty(navigator, 'mediaSession', { value: ms, configurable: true });
    vi.stubGlobal('MediaMetadata', class {
        constructor(init) { Object.assign(this, init); }
    });
    return { ms, handlers };
}

const SUBJ_ID = 'subja';
function seedStudyData() {
    window.STUDY_DATA = {
        [SUBJ_ID]: {
            title: '과목A',
            chapters: [
                { chapterTitle: 'Chapter 01', fileName: '1.개론.md', sections: [] },
                { chapterTitle: 'Chapter 02', fileName: '2.심화.md', sections: [] },
            ],
        },
    };
    window.AUDIO_MANIFEST = { [SUBJ_ID]: ['audio/ch01.mp3', 'audio/ch02.mp3'] };
}

describe('오디오북 플레이어 (AO-01~05)', () => {
    let audios, ms;
    beforeEach(() => {
        localStorage.clear();
        resetStudyState();
        mountAudioUI();
        audios = installAudioStub();
        ms = installMediaSessionStub();
        seedStudyData();
        readerAudioState.audio = null;
        readerAudioState.currentSrc = null;
    });

    it('AO-01: 매니페스트 기반으로 단원 오디오 경로를 해석하고 재생한다', () => {
        const chapter = window.STUDY_DATA[SUBJ_ID].chapters[0];
        const path = getAudioPathForChapter(SUBJ_ID, chapter);
        assertPathIsManifest(path);

        toggleReaderAudio(SUBJ_ID, 0);
        expect(audios.length).toBe(1);
        expect(audios[0].src).toBe('audio/ch01.mp3');
        expect(audios[0].paused).toBe(false);
    });

    function assertPathIsManifest(path) {
        expect(path).toBe('audio/ch01.mp3');
    }

    it('AO-01: 오디오 없는 단원은 토스트 안내 후 플레이어를 열지 않는다', async () => {
        const { showToast } = await import('../../src/ui-utils.js');
        // 매니페스트 비움 + fileName 추론 불가 → 경로 해석 실패 경로
        window.AUDIO_MANIFEST = { [SUBJ_ID]: [] };
        window.STUDY_DATA[SUBJ_ID].chapters = [{ chapterTitle: 'X', fileName: null }];
        toggleReaderAudio(SUBJ_ID, 0);
        expect(showToast).toHaveBeenCalled();
        expect(document.getElementById('reader-audio-player-area').classList.contains('is-hidden')).toBe(true);
    });

    it('AO-04: Media Session 메타데이터에 단원 제목·과목명·아트가 설정된다', () => {
        toggleReaderAudio(SUBJ_ID, 1);
        const meta = ms.ms.metadata;
        expect(meta).not.toBeNull();
        expect(meta.title).toBe('Chapter 02');
        expect(meta.album).toBe('과목A');
        expect(meta.artwork.length).toBeGreaterThan(0);
    });

    it('AO-02/AO-03: play/pause/seekto/previoustrack/nexttrack 핸들러가 등록된다', () => {
        toggleReaderAudio(SUBJ_ID, 0);
        const calls = ms.ms.setActionHandler.mock.calls.map(c => c[0]);
        for (const a of ['play', 'pause', 'seekto', 'previoustrack', 'nexttrack']) {
            expect(calls).toContain(a);
        }
        // seekto 핸들러가 currentTime을 갱신
        ms.handlers.seekto({ seekTime: 42 });
        expect(readerAudioState.audio.currentTime).toBe(42);
        // nexttrack → 다음 단원으로 전환
        ms.handlers.nexttrack();
        expect(readerAudioState.chapterIdx).toBe(1);
    });

    it('AO-05: 플레이어 UI가 표시되고 속도 순환·시크·정지가 동작한다', () => {
        toggleReaderAudio(SUBJ_ID, 0);
        expect(document.getElementById('reader-audio-player-area').classList.contains('is-hidden')).toBe(false);
        expect(document.getElementById('reader-audio-now-playing').textContent).toBe('Chapter 01');

        cycleReaderAudioRate();
        expect(readerAudioState.audio.playbackRate).toBe(1.25);
        expect(document.getElementById('reader-audio-rate-btn').textContent).toBe('1.25x');

        seekReaderAudio(50);
        expect(readerAudioState.audio.currentTime).toBe(60); // duration 120의 50%

        toggleReaderPlayPause();
        expect(readerAudioState.audio.paused).toBe(true);
        toggleReaderPlayPause();
        expect(readerAudioState.audio.paused).toBe(false);

        stopReaderAudio();
        expect(document.getElementById('reader-audio-player-area').classList.contains('is-hidden')).toBe(true);
    });

    it('AO-03: 정지 시 Media Session 핸들러가 해제된다', () => {
        toggleReaderAudio(SUBJ_ID, 0);
        stopReaderAudio();
        const calls = ms.ms.setActionHandler.mock.calls;
        const nullified = calls.filter(([, fn]) => fn === null).map(([a]) => a);
        for (const a of ['play', 'pause', 'seekto']) {
            expect(nullified).toContain(a);
        }
        expect(ms.ms.metadata).toBeNull();
    });
});
