// src/views/pomodoro.js - 뽀모도로 타이머 로직 (trainer.js에서 분리)
import { state, safeSetItem } from '../state.js';

/* =======================================================
   ⏱️ 집중 뽀모도로 타이머 (Pomodoro Study Timer)
   ======================================================= */
export function togglePomodoro() {
    const pomoState = state.trainer.pomodoro;
    const startBtn = document.getElementById('pomo-start-btn');
    const statusLabel = document.getElementById('pomo-status');
    if (!startBtn || !statusLabel) return;

    if (!pomoState.isRunning) {
        // 타이머 시작 및 재개
        pomoState.isRunning = true;

        if (pomoState.status === 'idle') {
            pomoState.status = 'work';
            pomoState.timeLeft = 25 * 60; // 25분
        }

        // 일시 정지 후 재개 및 시작 시 시점 기록
        pomoState.duration = pomoState.timeLeft;
        pomoState.startTime = Date.now();

        if (pomoState.status === 'work') {
            statusLabel.textContent = '집중 중';
            statusLabel.className = 'pomodoro-status work';
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지';
            const pomoTime = document.getElementById('pomo-time');
            if (pomoTime) pomoTime.classList.remove('break-active');
        } else if (pomoState.status === 'break') {
            statusLabel.textContent = '휴식 중';
            statusLabel.className = 'pomodoro-status break';
            startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시 정지';
            const pomoTime = document.getElementById('pomo-time');
            if (pomoTime) pomoTime.classList.add('break-active');
        }

        if (pomoState.timerId) clearInterval(pomoState.timerId);
        pomoState.timerId = setInterval(tickPomodoro, 200); // 200ms 간격 정밀 갱신
    } else {
        // 일시 정지
        pomoState.isRunning = false;
        clearInterval(pomoState.timerId);

        if (pomoState.status === 'work') {
            statusLabel.textContent = '집중 일시정지';
            statusLabel.className = 'pomodoro-status work';
        } else if (pomoState.status === 'break') {
            statusLabel.textContent = '휴식 일시정지';
            statusLabel.className = 'pomodoro-status break';
        }
        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 계속 하기';
    }

    updatePomodoroUI();
}

export function tickPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (!pomoState.isRunning) return;

    // 시작 시각으로부터 경과된 실시간(seconds) 계산 (백그라운드 스로틀링 극복 핵심)
    const elapsedSeconds = Math.floor((Date.now() - pomoState.startTime) / 1000);
    pomoState.timeLeft = Math.max(0, pomoState.duration - elapsedSeconds);

    if (pomoState.timeLeft <= 0) {
        clearInterval(pomoState.timerId);
        pomoState.isRunning = false;
        triggerPomodoroBeep(); // Chime 효과음 재생

        const statusLabel = document.getElementById('pomo-status');
        const startBtn = document.getElementById('pomo-start-btn');
        const pomoTime = document.getElementById('pomo-time');

        if (pomoState.status === 'work') {
            pomoState.totalTimeToday += 25;
            pomoState.sessionCount++;
            safeSetItem('pomo_total_time', pomoState.totalTimeToday);
            safeSetItem('pomo_total_time_date', new Date().toISOString().split('T')[0]);
            safeSetItem('pomo_session_count', pomoState.sessionCount);

            alert("집중 25분이 끝났습니다! 5분간 휴식하세요.");

            pomoState.status = 'break';
            pomoState.timeLeft = 5 * 60; // 5분 휴식
            if (statusLabel) {
                statusLabel.textContent = '휴식 대기';
                statusLabel.className = 'pomodoro-status break';
            }
            if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 휴식 시작';
            if (pomoTime) pomoTime.classList.add('break-active');
        } else {
            alert("휴식이 끝났습니다! 다시 힘내볼까요?");
            pomoState.status = 'idle';
            pomoState.timeLeft = 25 * 60;
            if (statusLabel) {
                statusLabel.textContent = '대기 중';
                statusLabel.className = 'pomodoro-status';
            }
            if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
            if (pomoTime) pomoTime.classList.remove('break-active');
        }
    }

    updatePomodoroUI();
}

export function resetPomodoro() {
    const pomoState = state.trainer.pomodoro;
    if (pomoState.timerId) clearInterval(pomoState.timerId);

    pomoState.isRunning = false;
    pomoState.status = 'idle';
    pomoState.timeLeft = 25 * 60;

    const statusLabel = document.getElementById('pomo-status');
    const startBtn = document.getElementById('pomo-start-btn');
    const pomoTime = document.getElementById('pomo-time');

    if (statusLabel) {
        statusLabel.textContent = '대기 중';
        statusLabel.className = 'pomodoro-status';
    }
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> 집중 시작';
    if (pomoTime) pomoTime.classList.remove('break-active');

    updatePomodoroUI();
}

export function updatePomodoroUI() {
    const pomoState = state.trainer.pomodoro;
    const min = Math.floor(pomoState.timeLeft / 60);
    const sec = pomoState.timeLeft % 60;

    const pomoTimeEl = document.getElementById('pomo-time');
    const pomoTotalEl = document.getElementById('pomo-total-time');
    const pomoSessionEl = document.getElementById('pomo-session-count');

    if (pomoTimeEl) pomoTimeEl.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    if (pomoTotalEl) pomoTotalEl.textContent = `${pomoState.totalTimeToday}분`;
    if (pomoSessionEl) pomoSessionEl.textContent = pomoState.sessionCount;
}

function triggerPomodoroBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        const playBeep = (startTime, frequency, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playBeep(now, 523.25, 0.25); // C5
        playBeep(now + 0.35, 659.25, 0.25); // E5
        playBeep(now + 0.7, 783.99, 0.4); // G5
    } catch (e) {
        console.error("Audio Context failed: ", e);
    }
}
