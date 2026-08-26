// src/charts.js - SVG 차트 및 합격 진단 로직 모듈
// [모바일 PWA 견고성] 레지스트리는 index.html의 <script type=module data/registry.js>가
// 채우는 window 전역을 "가드"해서 읽는다. 정적 import 로 하드 의존하면, 레지스트리 파일
// 로드가 실패할 때 이 모듈(및 상위 app.js) 전체가 실행되지 않아 흰 화면이 되므로 지양.

/* =======================================================
   📊 공통 툴팁 유틸리티 (Interactive Tooltip)
   ======================================================= */
let _chartTooltip = null;
let _tooltipHideTimer = null;

function getChartTooltip() {
    if (_chartTooltip) return _chartTooltip;
    _chartTooltip = document.createElement('div');
    _chartTooltip.className = 'chart-tooltip';
    _chartTooltip.style.cssText =
        'position:fixed;z-index:9000;pointer-events:none;' +
        'background:rgba(15,23,42,0.96);color:#fff;border:1px solid rgba(6,182,212,0.5);' +
        'border-radius:8px;padding:0.5rem 0.75rem;font-size:0.8rem;font-weight:600;' +
        'line-height:1.4;box-shadow:0 4px 16px rgba(0,0,0,0.4);' +
        'opacity:0;transition:opacity 0.15s ease;max-width:240px;white-space:nowrap;';
    document.body.appendChild(_chartTooltip);
    return _chartTooltip;
}

function showChartTooltip(html, x, y) {
    const tip = getChartTooltip();
    tip.innerHTML = html;
    tip.style.opacity = '1';
    // 위치 보정: 화면 경계 넘지 않도록
    const rect = tip.getBoundingClientRect();
    let left = x + 12;
    let top = y - rect.height - 8;
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - 12;
    if (top < 8) top = y + 16;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    if (_tooltipHideTimer) { clearTimeout(_tooltipHideTimer); _tooltipHideTimer = null; }
}

function hideChartTooltip() {
    _tooltipHideTimer = setTimeout(() => {
        if (_chartTooltip) _chartTooltip.style.opacity = '0';
    }, 100);
}

/** SVG 요소에 hover + touch 툴팁 이벤트 바인딩 */
function bindTooltip(el, html) {
    el.style.cursor = 'pointer';
    el.addEventListener('mouseenter', (e) => showChartTooltip(html, e.clientX, e.clientY));
    el.addEventListener('mouseleave', () => hideChartTooltip());
    el.addEventListener('mousemove', (e) => showChartTooltip(html, e.clientX, e.clientY));
    // 모바일 터치 지원
    el.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        if (t) showChartTooltip(html, t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener('touchend', () => {
        setTimeout(() => hideChartTooltip(), 2000);
    }, { passive: true });
}

/* =======================================================
   📊 모의고사 성적 차트 (Performance Line Chart)
   ======================================================= */
export function renderPerformanceChart() {
    const wrapper = document.getElementById('analytics-chart-wrapper');
    const emptyMsg = document.getElementById('empty-chart-msg');
    if (!wrapper) return;
    
    let history = [];
    const saved = localStorage.getItem('sim_results_history');
    if (saved) {
        try {
            history = JSON.parse(saved);
        } catch(e) {}
    }
    
    if (history.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'flex';
        // Remove old SVG if exists
        const oldSvg = wrapper.querySelector('svg');
        if (oldSvg) oldSvg.remove();
        return;
    }
    
    if (emptyMsg) emptyMsg.style.display = 'none';
    const oldSvg = wrapper.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    
    // 최근 5개 모의고사 성적 데이터 추출
    const recentData = history.slice(-5);
    
    // SVG 차트 그리기 (고정 논리 좌표 적용으로 clientWidth 비의존적 반응형 구현)
    const width = 500;
    const height = 240;
    const paddingLeft = 40;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    let svgContent = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%;">
        <defs>
            <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
    `;
    
    // Grid Lines (0, 20, 40, 60, 80, 100%)
    for (let percent = 0; percent <= 100; percent += 20) {
        const y = paddingTop + chartHeight - (percent * chartHeight / 100);
        svgContent += `<line class="chart-grid-line" x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}"/>`;
        svgContent += `<text class="chart-label" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">${percent}%</text>`;
    }
    
    // X 축 눈금 계산
    const pointsCount = recentData.length;
    const xPositions = [];
    recentData.forEach((d, idx) => {
        const x = paddingLeft + (pointsCount > 1 ? (idx * chartWidth / (pointsCount - 1)) : chartWidth / 2);
        xPositions.push(x);
    });
    
    // 라인 좌표 계산 및 빌드
    let linePath = '';
    let areaPath = '';
    
    recentData.forEach((d, idx) => {
        const x = xPositions[idx];
        const y = paddingTop + chartHeight - (d.rate * chartHeight / 100);
        
        if (idx === 0) {
            linePath += `M ${x} ${y}`;
            areaPath += `M ${x} ${paddingTop + chartHeight} L ${x} ${y}`;
        } else {
            linePath += ` L ${x} ${y}`;
            areaPath += ` L ${x} ${y}`;
        }
        
        if (idx === recentData.length - 1) {
            areaPath += ` L ${x} ${paddingTop + chartHeight} Z`;
        }
    });
    
    // 라인이 1개인 경우 처리 방안
    if (pointsCount === 1) {
        const x = xPositions[0];
        const y = paddingTop + chartHeight - (recentData[0].rate * chartHeight / 100);
        svgContent += `<circle class="chart-dot" cx="${x}" cy="${y}" r="6" data-idx="0"/>`;
        svgContent += `<text class="chart-value-label" x="${x}" y="${y - 12}">${recentData[0].rate}%</text>`;
        svgContent += `<text class="chart-label" x="${x}" y="${height - 15}">${recentData[0].date}</text>`;
    } else {
        // 채워진 영역 및 실선 추가
        svgContent += `<path class="chart-area" d="${areaPath}"/>`;
        svgContent += `<path class="chart-line" d="${linePath}"/>`;
        
        // 데이터 도트 및 라벨 추가
        recentData.forEach((d, idx) => {
            const x = xPositions[idx];
            const y = paddingTop + chartHeight - (d.rate * chartHeight / 100);
            svgContent += `<circle class="chart-dot chart-dot-interactive" cx="${x}" cy="${y}" r="5" data-idx="${idx}"/>`;
            svgContent += `<text class="chart-value-label" x="${x}" y="${y - 12}">${d.rate}%</text>`;
            svgContent += `<text class="chart-label" x="${x}" y="${height - 15}">${d.date}</text>`;
        });
    }
    
    svgContent += `</svg>`;
    wrapper.insertAdjacentHTML('beforeend', svgContent);

    // 인터랙티브 툴팁 바인딩 (라인 차트)
    const recentAvg = Math.round(recentData.reduce((s, d) => s + d.rate, 0) / recentData.length);
    wrapper.querySelectorAll('.chart-dot-interactive').forEach(dot => {
        const idx = parseInt(/** @type {SVGElement} */ (dot).dataset.idx || '0', 10);
        const d = recentData[idx];
        const delta = idx > 0 ? d.rate - recentData[idx - 1].rate : null;
        const deltaHtml = delta !== null
            ? `<span style="color:${delta >= 0 ? '#10b981' : '#ef4444'};">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%</span>`
            : '';
        bindTooltip(dot,
            `<div>${d.date}</div>` +
            `<div style="font-size:1.1rem;color:#06b6d4;">${d.rate}%</div>` +
            (deltaHtml ? `<div style="margin-top:2px;">${deltaHtml}</div>` : '') +
            `<div style="margin-top:2px;color:rgba(255,255,255,0.6);font-size:0.72rem;">최근 평균 ${recentAvg}%</div>`
        );
    });
}

/* =======================================================
   📊 과목별 정답률 집계 (공통 헬퍼)
   - content/manifest.json에서 생성된 DATA_REGISTRY를 사용해 동적으로 과목별 집계
   ======================================================= */
export function aggregateSubjectRates(history) {
    const subjectRates = {};
    const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
    subjects.forEach(sub => {
        subjectRates[sub.key] = [];
    });
    
    history.forEach(r => {
        if (r.subjectRates) {
            Object.keys(r.subjectRates).forEach(subj => {
                const rate = r.subjectRates[subj];
                if (rate !== null && rate !== undefined) {
                    let key = subj;
                    if (subj.startsWith('subject')) {
                        const idx = parseInt(subj.replace('subject', ''), 10) - 1;
                        const targetSub = subjects[idx];
                        if (targetSub) {
                            key = targetSub.key;
                        }
                    }
                    if (subjectRates[key]) {
                        subjectRates[key].push(rate);
                    }
                }
            });
        } else {
            // 구버전 이력의 examId가 subject1_100_questions 등인 경우 하향 호환 처리
            const baseId = (r.examId || '').split('_')[0]; // 'subject1' 등
            if (baseId.startsWith('subject')) {
                const idx = parseInt(baseId.replace('subject', ''), 10) - 1;
                const targetSub = subjects[idx];
                if (targetSub && subjectRates[targetSub.key]) {
                    subjectRates[targetSub.key].push(r.rate);
                }
            } else if (subjectRates[baseId]) {
                subjectRates[baseId].push(r.rate);
            }
        }
    });
    return subjectRates;
}

/* =======================================================
   📈 합격 가능성 진단 (Pass/Fail Diagnosis)
   ======================================================= */
export function renderPassFailDiagnosis() {
    const area = document.getElementById('prediction-result-area');
    if (!area) return;
    
    let history = [];
    const saved = localStorage.getItem('sim_results_history');
    if (saved) {
        try {
            history = JSON.parse(saved);
        } catch(e) {}
    }
    
    if (history.length === 0) {
        area.innerHTML = `
            <div class="prediction-placeholder">
                <i class="fa-solid fa-user-doctor"></i>
                <p>모의고사 점수를 토대로 과락 및 평균 통과 여부를 진단합니다.</p>
            </div>
        `;
        return;
    }
    
    // 최근 5개 모의고사 평균 점수 계산
    const recentExams = history.slice(-5);
    const avgRate = Math.round(recentExams.reduce((sum, r) => sum + r.rate, 0) / recentExams.length);
    
    // 과목별 최근 점수 추출하여 과락 판정
    const subjectRates = aggregateSubjectRates(history);
    const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
    
    // 각 과목 최신 성적 추출
    const getLatestRate = (subjKey) => {
        const rates = subjectRates[subjKey];
        if (!rates || rates.length === 0) return null;
        return rates[rates.length - 1]; // 가장 최신 데이터
    };
    
    const subjectNames = {};
    subjects.forEach((sub, idx) => {
        subjectNames[sub.key] = `${idx + 1}과목: ${sub.name}`;
    });
    
    let isGuarak = false;
    let guarakSubjects = [];
    
    subjects.forEach(sub => {
        const rate = getLatestRate(sub.key);
        if (rate !== null && rate < 40) {
            isGuarak = true;
            guarakSubjects.push(sub.name);
        }
    });
    
    let statusClass = 'pass';
    let statusText = '합격 안정권';
    let advice = '현재 페이스를 유지하시면 무난하게 시험에 통과하실 것으로 예측됩니다!';
    
    if (avgRate >= 60 && !isGuarak) {
        statusClass = 'pass';
        statusText = '합격 예측';
    } else if (avgRate >= 60 && isGuarak) {
        statusClass = 'warning';
        statusText = '과락 경계';
        advice = `평균 점수는 합격선이나, 일부 과목(${guarakSubjects.join(', ')})에서 과락(40% 미만) 위기가 감지되었습니다. 해당 과목을 더 학습하세요!`;
    } else {
        statusClass = 'fail';
        statusText = '합격 미달';
        advice = `평균 점수가 합격 기준(60%)에 도달하지 못했습니다. 플래시카드와 스마트 훈련소를 통해 암기량을 보충하세요!`;
    }
    
    let subjectsHTML = '<div class="pred-subject-scores">';
    subjects.forEach((sub, idx) => {
        const rate = getLatestRate(sub.key);
        if (rate !== null) {
            const shortName = sub.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
            subjectsHTML += `
                <div class="pred-subject-row ${rate < 40 ? 'danger' : ''}">
                    <span>${idx + 1}과목 (${shortName})</span>
                    <strong>${rate}% ${rate < 40 ? '(과락)' : ''}</strong>
                </div>
            `;
        }
    });
    subjectsHTML += '</div>';
    
    area.innerHTML = `
        <div class="pred-card-body">
            <div class="pred-status-header">
                <span class="pred-score-text">최근 평균 ${avgRate}%</span>
                <span class="pred-status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="pred-advice-box">
                <i class="fa-solid fa-lightbulb" style="color: var(--color-warning); margin-right: 0.5rem;"></i>
                ${advice}
            </div>
            ${subjectsHTML}
        </div>
    `;
}

/* =======================================================
   📊 과목별 역량 진단 레이더 차트 (N-Axis Radar Chart)
   ======================================================= */
export function renderRadarChart() {
    const wrapper = document.getElementById('radar-chart-wrapper');
    const emptyMsg = document.getElementById('empty-radar-msg');
    if (!wrapper) return;
    
    let history = [];
    const saved = localStorage.getItem('sim_results_history');
    if (saved) {
        try {
            history = JSON.parse(saved);
        } catch(e) {}
    }
    
    if (history.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'flex';
        const oldSvg = wrapper.querySelector('svg');
        if (oldSvg) oldSvg.remove();
        return;
    }
    
    if (emptyMsg) emptyMsg.style.display = 'none';
    const oldSvg = wrapper.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    
    // 과목별 평균 정답률 계산
    const subjectRates = aggregateSubjectRates(history);
    const subjects = (window.DATA_REGISTRY && window.DATA_REGISTRY.subjects) || [];
    const N = subjects.length;
    
    if (N < 3) {
        if (emptyMsg) {
            emptyMsg.textContent = "레이더 차트 분석은 최소 3개 과목 이상 필요합니다.";
            emptyMsg.style.display = 'flex';
        }
        return;
    }
    
    const getAvgRate = (subjKey) => {
        const rates = subjectRates[subjKey];
        if (!rates || rates.length === 0) return 50; // 기본값 50%
        return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    };
    
    const subjectScores = subjects.map(sub => getAvgRate(sub.key));
    
    // 고정 논리 좌표 적용으로 clientWidth 비의존적 반응형 구현
    const width = 300;
    const height = 240;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 35;
    
    // N-축 좌표 매핑 함수 (12시 방향에서 시계방향으로 2*PI/N씩 회전)
    const getPoint = (idx, value) => {
        const scale = value / 100;
        const angle = (2 * Math.PI * idx) / N - (Math.PI / 2); // 12시 방향 시작을 위해 -PI/2
        const x = cx + scale * maxR * Math.cos(angle);
        const y = cy + scale * maxR * Math.sin(angle);
        return { x, y };
    };
    
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">`;
    
    // 1. Concentric Grid lines (20%, 40%, 60%, 80%, 100%)
    for (let level = 20; level <= 100; level += 20) {
        const points = [];
        for (let i = 0; i < N; i++) {
            const p = getPoint(i, level);
            points.push(`${p.x},${p.y}`);
        }
        svg += `<polygon class="radar-grid-line" points="${points.join(' ')}" />`;
        // grid label (12시 방향 축 근처에 표시)
        const lblP = getPoint(0, level);
        svg += `<text x="${lblP.x + 5}" y="${lblP.y + 4}" fill="rgba(255,255,255,0.2)" font-size="8" font-weight="600">${level}%</text>`;
    }
    
    // 2. Axes Lines & Labels
    subjects.forEach((sub, i) => {
        const edgeP = getPoint(i, 100);
        // 축 선
        svg += `<line class="radar-axis-line" x1="${cx}" y1="${cy}" x2="${edgeP.x}" y2="${edgeP.y}" />`;
        
        // 축 라벨 위치 결정 (100% 원 외부로 조금 더 오프셋)
        const angle = (2 * Math.PI * i) / N - (Math.PI / 2);
        const offset = 15;
        const labelX = cx + (maxR + offset) * Math.cos(angle);
        const labelY = cy + (maxR + offset) * Math.sin(angle) + 4; // 폰트 높이 보정
        
        let textAnchor = 'middle';
        const cos = Math.cos(angle);
        if (cos > 0.1) textAnchor = 'start';
        else if (cos < -0.1) textAnchor = 'end';
        
        const shortName = sub.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
        svg += `<text class="radar-axis-label" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}">${i+1}과목 (${shortName})</text>`;
    });
    
    // 3. Data Polygon
    const userPoints = [];
    subjects.forEach((sub, i) => {
        const p = getPoint(i, subjectScores[i]);
        userPoints.push(`${p.x},${p.y}`);
    });
    svg += `<polygon class="radar-polygon" points="${userPoints.join(' ')}" />`;
    
    // 4. Data dots and labels
    subjects.forEach((sub, i) => {
        const p = getPoint(i, subjectScores[i]);
        svg += `<circle class="radar-point radar-point-interactive" cx="${p.x}" cy="${p.y}" data-idx="${i}" />`;
        svg += `<text x="${p.x}" y="${p.y - 8}" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">${subjectScores[i]}%</text>`;
    });
    
    svg += `</svg>`;
    wrapper.insertAdjacentHTML('beforeend', svg);

    // 인터랙티브 툴팁 바인딩 (레이더 차트)
    const overallAvg = Math.round(subjectScores.reduce((s, r) => s + r, 0) / subjectScores.length);
    wrapper.querySelectorAll('.radar-point-interactive').forEach(dot => {
        const idx = parseInt(/** @type {SVGElement} */ (dot).dataset.idx || '0', 10);
        const sub = subjects[idx];
        const rate = subjectScores[idx];
        const rates = subjectRates[sub.key] || [];
        const examCount = rates.length;
        const shortName = sub.name.replace('의 이해', '').replace(' 및 품질관리', '').replace('유통화장품 ', '');
        const status = rate < 40 ? '과락 위험' : rate < 60 ? '합격 미달' : '안정권';
        const statusColor = rate < 40 ? '#ef4444' : rate < 60 ? '#f59e0b' : '#10b981';
        bindTooltip(dot,
            `<div style="font-size:0.85rem;">${idx + 1}과목: ${shortName}</div>` +
            `<div style="font-size:1.1rem;color:#06b6d4;margin-top:2px;">${rate}%</div>` +
            `<div style="margin-top:2px;color:${statusColor};">${status}</div>` +
            `<div style="margin-top:2px;color:rgba(255,255,255,0.6);font-size:0.72rem;">응시 ${examCount}회 · 전체 평균 ${overallAvg}%</div>`
        );
    });
}
