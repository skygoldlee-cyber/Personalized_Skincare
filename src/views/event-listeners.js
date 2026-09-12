// src/views/event-listeners.js — 이벤트 리스너 설정 (app.js에서 분리)
import { state, saveProgress } from '../state.js';
import { shuffle } from '../utils.js';
import { DataLoader } from '../data-loader.js';
import { ManualViewer } from '../manual-viewer.js';
import { updateCardSchedule } from '../spaced-repetition.js';
import { RESET_KEYS, isDailyCompletedKey } from '../storage-keys.js';
import { TIMING } from '../config/timing.js';
import { renderDashboard } from './dashboard.js';
import { loadFlashcards, renderFlashcard } from './flashcard.js';
import { startQuiz, submitQuizAnswer, nextQuizQuestion, renderReviewList, startWeakFocusQuiz } from './quiz.js';
import { submitCalcAnswer, submitIngAnswer } from './trainer.js';
import { filterDictionary } from './dictionary.js';
import { seekReaderAudio } from './textbook-reader.js';
import { showGlobalLoading, hideGlobalLoading, showToast, showConfirm } from '../ui-utils.js';
import { simState, renderSimQuestion, submitExam } from './exam-simulator.js';
import { switchView } from './navigation.js';

function debounce(func, delay = 150) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

export function setupEventListeners(enhanceDataClickAccessibility) {
    // 1. 진도 초기화 버튼
    document.getElementById('reset-progress-btn').addEventListener('click', async () => {
        const ok = await showConfirm("정말 모든 학습 진도를 초기화하시겠습니까?\n외운 카드, 오답 정보, 모의고사 성적 이력, 연속 학습일, 계산 기록이 모두 지워집니다.", "학습 진도 초기화");
        if (!ok) return;
        // 인메모리 상태 초기화
        state.memorizedCards.clear();
        state.weakCards.clear();
        state.quizResults = {};
        state.trainer.pomodoro.totalTimeToday = 0;
        state.trainer.pomodoro.sessionCount = 0;
        
        // 로컬스토리지에 남아있는 모든 학습 데이터 키 제거
        const keysToRemove = RESET_KEYS;
        keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });

        // 날짜 기반 동적 키(daily_completed_*) 일괄 제거
        const dynamicKeys = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && isDailyCompletedKey(key)) {
                    dynamicKeys.push(key);
                }
            }
        } catch(_) {}
        dynamicKeys.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
        
        saveProgress();
        
        // 현재 활성화 뷰 새로고침
        if (state.currentView === 'dashboard-view') renderDashboard();
        else if (state.currentView === 'flashcard-view') loadFlashcards();
        else if (state.currentView === 'review-view') renderReviewList();
        
        showToast("학습 진도가 모두 초기화되었습니다.", "success");
    });
    
    // 2. 플래시카드 이벤트
    const cardEl = document.getElementById('flashcard-item');
    if (cardEl) {
        cardEl.setAttribute('role', 'button');
        cardEl.setAttribute('tabindex', '0');
        cardEl.setAttribute('aria-label', '플래시카드 — 클릭하여 뒷면 보기');
        const flipCard = () => {
            const isFlipped = cardEl.classList.toggle('flipped');
            cardEl.setAttribute('aria-expanded', String(isFlipped));
            cardEl.setAttribute('aria-label', isFlipped ? '플래시카드 — 클릭하여 앞면 보기' : '플래시카드 — 클릭하여 뒷면 보기');
        };
        cardEl.addEventListener('click', (e) => {
            // 터치 스와이프 후 합성 click 이벤트 중복 방지
            if (cardEl._swipeHandled) {
                cardEl._swipeHandled = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            flipCard();
        });
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
        });

        // U2: 모바일 좌우 스와이프 제스처 — 좌우 카드 전환, 위로 스와이프 시 뒤집기
        let _swipeStartX = 0, _swipeStartY = 0, _swipeStartT = 0, _swipeMoved = false;
        const SWIPE_THRESHOLD = TIMING.SWIPE_THRESHOLD_PX; // px — 이 거리 이상 이동 시 스와이프로 간주
        const SWIPE_TIME_MAX = TIMING.SWIPE_TIME_MAX_MS; // ms — 이 시간 내에 끝나야 스와이프
        cardEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            _swipeStartX = t.clientX;
            _swipeStartY = t.clientY;
            _swipeStartT = Date.now();
            _swipeMoved = false;
            cardEl._swipeHandled = false;
        }, { passive: true });
        cardEl.addEventListener('touchmove', () => { _swipeMoved = true; }, { passive: true });
        cardEl.addEventListener('touchend', (e) => {
            if (e.changedTouches.length !== 1) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - _swipeStartX;
            const dy = t.clientY - _swipeStartY;
            const dt = Date.now() - _swipeStartT;
            // 가로 이동이 세로 이동보다 크고 임계값 초과 시 좌우 스와이프
            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < SWIPE_TIME_MAX) {
                e.preventDefault();
                cardEl._swipeHandled = true; // 합성 click 중복 방지
                const prevBtn = document.getElementById('fc-prev-btn');
                const nextBtn = document.getElementById('fc-next-btn');
                if (dx > 0 && prevBtn) prevBtn.click(); // 오른쪽 스와이프 → 이전
                else if (dx < 0 && nextBtn) nextBtn.click(); // 왼쪽 스와이프 → 다음
            }
            // 가로 이동이 작고 세로 이동이 위쪽이며 임계값 초과 시 뒤집기 (click과 중복 방지 위해 _swipeMoved 체크)
            else if (_swipeMoved && dy < -SWIPE_THRESHOLD && Math.abs(dx) < SWIPE_THRESHOLD * 0.5) {
                e.preventDefault();
                cardEl._swipeHandled = true; // 합성 click 중복 방지
                flipCard();
            }
            // 스와이프가 아닌 단순 탭은 click 이벤트가 자동 발생하므로 뒤집기 처리 위임
        }, { passive: false });
    }
    
    document.getElementById('fc-subject-select').addEventListener('change', (e) => {
        state.flashcards.subject = e.target.value;
        state.flashcards.currentIndex = 0;
        DataLoader.loadSubject(e.target.value).then(() => {
            loadFlashcards();
        }).catch(() => loadFlashcards());
    });
    
    document.getElementById('fc-key-only').addEventListener('change', (e) => {
        state.flashcards.keyOnly = e.target.checked;
        state.flashcards.currentIndex = 0;
        loadFlashcards();
    });
    
    const fcShuffleCheckbox = document.getElementById('fc-shuffle');
    if (fcShuffleCheckbox) {
        fcShuffleCheckbox.addEventListener('change', (e) => {
            state.flashcards.shuffle = e.target.checked;
            state.flashcards.currentIndex = 0;
            loadFlashcards();
        });
    }
    
    const fcDifficultySelect = document.getElementById('fc-difficulty-select');
    if (fcDifficultySelect) {
        fcDifficultySelect.addEventListener('change', (e) => {
            state.flashcards.difficultyFilter = e.target.value;
            state.flashcards.currentIndex = 0;
            loadFlashcards();
        });
    }
    
    document.getElementById('fc-prev-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex--;
        if (state.flashcards.currentIndex < 0) {
            state.flashcards.currentIndex = state.flashcards.data.length - 1;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-next-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.flashcards.data.length === 0) return;
        state.flashcards.currentIndex++;
        if (state.flashcards.currentIndex >= state.flashcards.data.length) {
            state.flashcards.currentIndex = 0;
        }
        renderFlashcard();
    });
    
    document.getElementById('fc-easy-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.memorizedCards.add(currentCard.id);
        state.weakCards.delete(currentCard.id);
        updateCardSchedule(currentCard.id, true); // 2. 간격 반복 (SM-2)
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-easy-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-easy-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });
    
    document.getElementById('fc-hard-btn').addEventListener('click', () => {
        const fc = state.flashcards;
        if (fc.data.length === 0) return;
        const currentCard = fc.data[fc.currentIndex];
        
        state.weakCards.add(currentCard.id);
        state.memorizedCards.delete(currentCard.id);
        updateCardSchedule(currentCard.id, false); // 2. 간격 반복 (SM-2)
        saveProgress();
        
        // 시각 효과 피드백 후 다음 카드로
        document.getElementById('fc-hard-btn').style.transform = 'scale(1.05)';
        setTimeout(() => {
            document.getElementById('fc-hard-btn').style.transform = 'scale(1)';
            document.getElementById('fc-next-btn').click();
        }, 150);
    });

    // 플래시카드 키보드 단축키 (flashcard-view 활성 시에만 동작)
    document.addEventListener('keydown', (e) => {
        if (state.currentView !== 'flashcard-view') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        const cardEl = document.getElementById('flashcard-item');
        if (!cardEl || state.flashcards.data.length === 0) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                document.getElementById('fc-prev-btn').click();
                break;
            case 'ArrowRight':
                e.preventDefault();
                document.getElementById('fc-next-btn').click();
                break;
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                cardEl.classList.toggle('flipped');
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                document.getElementById('fc-easy-btn').click();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                document.getElementById('fc-hard-btn').click();
                break;
        }
    });
    
    // 3. 퀴즈 이벤트
    document.getElementById('quiz-subject-select').addEventListener('change', (e) => {
        state.quiz.subject = e.target.value;
    });
    
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
        showGlobalLoading('퀴즈 데이터를 불러오는 중입니다...');
        DataLoader.loadSubject(state.quiz.subject).then(() => {
            hideGlobalLoading();
            startQuiz();
        }).catch(() => {
            hideGlobalLoading();
            showToast('퀴즈 데이터를 불러오지 못했습니다.', 'error');
            startQuiz();
        });
    });
    
    document.getElementById('submit-quiz-btn').addEventListener('click', () => {
        submitQuizAnswer();
    });
    
    // 엔터키 정답 제출 대응
    document.getElementById('quiz-answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const submitBtn = document.getElementById('submit-quiz-btn');
            const nextBtn = document.getElementById('next-quiz-btn');
            
            if (!submitBtn.classList.contains('is-hidden')) {
                submitQuizAnswer();
            } else if (!nextBtn.classList.contains('is-hidden')) {
                nextQuizQuestion();
            }
        }
    });
    
    document.getElementById('next-quiz-btn').addEventListener('click', () => {
        nextQuizQuestion();
    });
    
    document.getElementById('retry-quiz-btn').addEventListener('click', () => {
        startQuiz();
    });

    // 계산 연습기 엔터키 제출
    const calcInput = document.getElementById('calc-answer-input');
    if (calcInput) {
        calcInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const submitBtn = document.getElementById('submit-calc-btn');
                if (submitBtn && !submitBtn.disabled) {
                    submitCalcAnswer();
                }
            }
        });
    }

    // 원료 챌린지 주관식 엔터키 제출
    const ingInput = document.getElementById('ing-answer-input');
    if (ingInput) {
        ingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const submitBtn = document.getElementById('submit-ing-btn');
                if (submitBtn && !submitBtn.disabled) {
                    submitIngAnswer();
                }
            }
        });
    }
    
    document.getElementById('back-to-dashboard-btn').addEventListener('click', () => {
        switchView('dashboard-view');
    });
    
    // 4. 오답 퀴즈 이벤트 바인딩
    document.getElementById('start-weak-quiz-btn').addEventListener('click', () => {
        startWeakFocusQuiz();
    });

    // 5. 모의고사 시뮬레이터 이벤트 바인딩
    document.getElementById('sim-prev-btn').addEventListener('click', () => {
        if (simState.currentIndex > 0) {
            simState.currentIndex--;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-next-btn').addEventListener('click', () => {
        if (simState.currentIndex < simState.data.questions.length - 1) {
            simState.currentIndex++;
            renderSimQuestion();
        }
    });
    
    document.getElementById('sim-submit-exam-btn').addEventListener('click', async () => {
        const ok = await showConfirm("정말로 답안지를 제출하고 시험을 종료하시겠습니까?", "시험 제출");
        if (ok) submitExam();
    });
    
    // 6. 성분 검색 사전 실시간 검색 이벤트 디바운스 바인딩
    const dictSearchInput = document.getElementById('dict-search-input');
    if (dictSearchInput) {
        dictSearchInput.addEventListener('input', debounce(filterDictionary, 250));
    }

    // 7. HTML 내 인라인 onclick/oninput 제거 대응을 위한 data-click / data-input 위임 바인딩
    //
    //    ⚠️ CSP(script-src에 'unsafe-inline' 없음)에서 인라인 onclick/oninput은 브라우저가
    //       실행을 차단한다. 따라서 동적으로 생성되는 HTML도 반드시 이 위임 경로를 써야 하며,
    //       핸들러는 window에 노출(브리지)되어 있어야 resolveDelegatedHandler가 찾을 수 있다.
    //
    //    인자 전달 규약:
    //      - data-arg  : (레거시) 단일 문자열 인자 하나. 기존 사용처와 100% 호환.
    //      - data-args : JSON 배열로 다중/타입 인자 전달.
    //                    예) data-args='["law", 0]'  → handler("law", 0)
    //                        data-args='[true]'       → handler(true)
    //                    data-args가 있으면 data-arg는 무시된다.
    //      - data-input: input 이벤트용. 현재 요소의 value를 인자로 전달.
    //                    예) <input data-input="seekReaderAudio"> → seekReaderAudio(el.value)

    // 전역 범위(window)에서 함수 찾기 (ManualViewer.openManual 등의 점 표기 네임스페이스 허용)
    function resolveDelegatedHandler(name) {
        let handler = window;
        for (const part of name.split('.')) {
            if (handler) handler = handler[part];
        }
        return handler;
    }

    // data-args(JSON 배열) 우선, 없으면 data-arg(단일 문자열), 둘 다 없으면 인자 없음.
    // 반환값이 null이면 파싱 실패이므로 호출을 건너뛴다.
    function parseDelegatedArgs(el) {
        const rawArgs = el.getAttribute('data-args');
        if (rawArgs !== null) {
            try {
                const parsed = JSON.parse(rawArgs);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (err) {
                console.error(`[delegation] data-args JSON 파싱 실패: ${rawArgs}`, err);
                return null;
            }
        }
        const arg = el.getAttribute('data-arg');
        return arg !== null ? [arg] : [];
    }

    document.body.addEventListener('click', (e) => {
        // 일부 안드로이드 Chrome에서 e.target이 Text 노드가 될 수 있어
        // closest()가 없어 TypeError 발생 → 버튼 동작 안 함 (PC/최신 모바일은 정상)
        const targetEl = e.target instanceof Element ? e.target : e.target.parentElement;
        if (!targetEl) return;
        const el = targetEl.closest('[data-click]');
        if (!el) return;

        const handlerName = el.getAttribute('data-click');

        // A 태그나 href="#" 태그일 경우 기본 동작 차단
        if (el.tagName === 'A' || el.getAttribute('href') === '#') {
            e.preventDefault();
        }

        const handler = resolveDelegatedHandler(handlerName);
        if (typeof handler !== 'function') {
            console.error(`Handler not found: ${handlerName}`);
            return;
        }

        const args = parseDelegatedArgs(el);
        if (args === null) return; // data-args 파싱 실패 시 호출하지 않음
        handler(...args);
    });

    // 키보드 접근성: [data-click] 요소에서 Enter/Space 시 클릭 트리거
    document.body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const targetEl = e.target instanceof Element ? e.target : e.target.parentElement;
        if (!targetEl) return;
        const el = targetEl.closest('[data-click]');
        if (!el) return;
        // 네이티브 버튼/링크/입력은 자체 키보드 처리가 있으므로 제외
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;
        e.preventDefault();
        el.click();
    });

    // 입력 이벤트 위임 (range 슬라이더 등). 인라인 oninput 속성(CSP 차단) 대체.
    document.body.addEventListener('input', (e) => {
        const targetEl = e.target instanceof Element ? e.target : e.target.parentElement;
        if (!targetEl) return;
        const el = targetEl.closest('[data-input]');
        if (!el) return;

        const handlerName = el.getAttribute('data-input');
        const handler = resolveDelegatedHandler(handlerName);
        if (typeof handler !== 'function') {
            console.error(`Input handler not found: ${handlerName}`);
            return;
        }
        handler(el.value);
    });

    // 키보드 접근성: [data-click] div 요소에 tabindex/role 부여
    enhanceDataClickAccessibility();

    // 퀴즈/훈련소 객관식 숫자키 1-5 / OX O,P 단축키
    document.addEventListener('keydown', (e) => {
        if (state.currentView !== 'quiz-view' && state.currentView !== 'trainer-view') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // 객관식: 1-5
        const numMatch = /^([1-5])$/.exec(e.key);
        if (numMatch) {
            const idx = parseInt(numMatch[1], 10) - 1;
            const containers = [
                document.getElementById('quiz-options-container'),
                document.getElementById('limits-options-container'),
                document.getElementById('ing-options-container')
            ].filter(Boolean);
            for (const c of containers) {
                if (c.classList.contains('is-hidden')) continue;
                const btns = c.querySelectorAll('.limits-opt-btn');
                if (btns[idx] && !btns[idx].disabled) {
                    e.preventDefault();
                    btns[idx].click();
                    return;
                }
            }
        }

        // OX: o/p
        if (e.key === 'o' || e.key === 'O') {
            const oxBtns = document.querySelectorAll('.quiz-ox-btn');
            if (oxBtns.length && !oxBtns[0].disabled) {
                e.preventDefault();
                oxBtns[0].click();
            }
        } else if (e.key === 'p' || e.key === 'P') {
            const oxBtns = document.querySelectorAll('.quiz-ox-btn');
            if (oxBtns.length > 1 && !oxBtns[1].disabled) {
                e.preventDefault();
                oxBtns[1].click();
            }
        }
    });
}
