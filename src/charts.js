// src/charts.js - SVG 차트 및 합격 진단 로직 모듈 (글로벌 스코프 실행)

/* =======================================================
   📊 모의고사 성적 차트 (Performance Line Chart)
   ======================================================= */
function renderPerformanceChart() {
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
        svgContent += `<circle class="chart-dot" cx="${x}" cy="${y}" r="6"/>`;
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
            svgContent += `<circle class="chart-dot" cx="${x}" cy="${y}" r="5"/>`;
            svgContent += `<text class="chart-value-label" x="${x}" y="${y - 12}">${d.rate}%</text>`;
            svgContent += `<text class="chart-label" x="${x}" y="${height - 15}">${d.date}</text>`;
        });
    }
    
    svgContent += `</svg>`;
    wrapper.insertAdjacentHTML('beforeend', svgContent);
}

/* =======================================================
   📈 합격 가능성 진단 (Pass/Fail Diagnosis)
   ======================================================= */
function renderPassFailDiagnosis() {
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
    const subjectRates = {
        'subject1': [],
        'subject2': [],
        'subject3': [],
        'subject4': []
    };
    
    history.forEach(r => {
        if (r.subjectRates) {
            Object.keys(r.subjectRates).forEach(subj => {
                const rate = r.subjectRates[subj];
                if (rate !== null && rate !== undefined) {
                    subjectRates[subj].push(rate);
                }
            });
        } else {
            const baseId = r.examId.split('_')[0]; // e.g. subject2_p1 -> subject2
            if (subjectRates[baseId]) {
                subjectRates[baseId].push(r.rate);
            }
        }
    });
    
    // 각 과목 최신 성적 또는 평균 산출
    const getLatestRate = (subjBaseId) => {
        const rates = subjectRates[subjBaseId];
        if (!rates || rates.length === 0) return null;
        return rates[rates.length - 1]; // 가장 최신 데이터
    };
    
    const s1Rate = getLatestRate('subject1');
    const s2Rate = getLatestRate('subject2');
    const s3Rate = getLatestRate('subject3');
    const s4Rate = getLatestRate('subject4');
    
    const subjectNames = {
        'subject1': '1과목: 화장품법의 이해',
        'subject2': '2과목: 화장품 제조 및 품질관리',
        'subject3': '3과목: 유통화장품 안전관리',
        'subject4': '4과목: 맞춤형화장품의 이해'
    };
    
    let isGuarak = false;
    let guarakSubjects = [];
    
    const checkGuarak = (rate, name) => {
        if (rate !== null && rate < 40) {
            isGuarak = true;
            guarakSubjects.push(name);
        }
    };
    
    checkGuarak(s1Rate, subjectNames['subject1']);
    checkGuarak(s2Rate, subjectNames['subject2']);
    checkGuarak(s3Rate, subjectNames['subject3']);
    checkGuarak(s4Rate, subjectNames['subject4']);
    
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
    
    const subjectsHTML = `
        <div class="pred-subject-scores">
            ${s1Rate !== null ? `<div class="pred-subject-row ${s1Rate < 40 ? 'danger' : ''}"><span>1과목 (화장품법)</span><strong>${s1Rate}% ${s1Rate < 40 ? '(과락)' : ''}</strong></div>` : ''}
            ${s2Rate !== null ? `<div class="pred-subject-row ${s2Rate < 40 ? 'danger' : ''}"><span>2과목 (제조/품질)</span><strong>${s2Rate}% ${s2Rate < 40 ? '(과락)' : ''}</strong></div>` : ''}
            ${s3Rate !== null ? `<div class="pred-subject-row ${s3Rate < 40 ? 'danger' : ''}"><span>3과목 (안전관리)</span><strong>${s3Rate}% ${s3Rate < 40 ? '(과락)' : ''}</strong></div>` : ''}
            ${s4Rate !== null ? `<div class="pred-subject-row ${s4Rate < 40 ? 'danger' : ''}"><span>4과목 (맞춤형화장품)</span><strong>${s4Rate}% ${s4Rate < 40 ? '(과락)' : ''}</strong></div>` : ''}
        </div>
    `;
    
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

// 한글 초성 추출 헬퍼 함수 (검색사전 초성 매칭용 글로벌 유틸리티)
function getChosung(str) {
    const chosungs = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        // 유효한 완성형 한글 음절 범위: 0 ~ 11171 (가 ~ 힣)
        if (code >= 0 && code <= 11171) {
            result += chosungs[Math.floor(code / 588)];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}

/* =======================================================
   📊 과목별 역량 진단 레이더 차트 (Radar Chart)
   ======================================================= */
function renderRadarChart() {
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
    const subjectRates = {
        'subject1': [],
        'subject2': [],
        'subject3': [],
        'subject4': []
    };
    
    history.forEach(r => {
        if (r.subjectRates) {
            Object.keys(r.subjectRates).forEach(subj => {
                const rate = r.subjectRates[subj];
                if (rate !== null && rate !== undefined) {
                    subjectRates[subj].push(rate);
                }
            });
        } else {
            const baseId = r.examId.split('_')[0];
            if (subjectRates[baseId]) {
                subjectRates[baseId].push(r.rate);
            }
        }
    });
    
    const getAvgRate = (subjBaseId) => {
        const rates = subjectRates[subjBaseId];
        if (!rates || rates.length === 0) return 50; // 기본값 50%
        return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    };
    
    const s1 = getAvgRate('subject1');
    const s2 = getAvgRate('subject2');
    const s3 = getAvgRate('subject3');
    const s4 = getAvgRate('subject4');
    
    // 고정 논리 좌표 적용으로 clientWidth 비의존적 반응형 구현
    const width = 300;
    const height = 240;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) / 2 - 35;
    
    // 4개 축 좌표 매핑 함수
    // 0: 상(1과목), 1: 우(2과목), 2: 하(3과목), 3: 좌(4과목)
    const getPoint = (idx, value) => {
        const scale = value / 100;
        if (idx === 0) return { x: cx, y: cy - scale * maxR };
        if (idx === 1) return { x: cx + scale * maxR, y: cy };
        if (idx === 2) return { x: cx, y: cy + scale * maxR };
        return { x: cx - scale * maxR, y: cy };
    };
    
    let svg = `<svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">`;
    
    // 1. Concentric Diamond Grid lines (20%, 40%, 60%, 80%, 100%)
    for (let level = 20; level <= 100; level += 20) {
        const p0 = getPoint(0, level);
        const p1 = getPoint(1, level);
        const p2 = getPoint(2, level);
        const p3 = getPoint(3, level);
        
        svg += `<polygon class="radar-grid-line" points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" />`;
        // grid label
        svg += `<text x="${cx + 5}" y="${cy - (level/100)*maxR + 4}" fill="rgba(255,255,255,0.2)" font-size="8" font-weight="600">${level}%</text>`;
    }
    
    // 2. Axes Lines
    svg += `<line class="radar-axis-line" x1="${cx}" y1="${cy - maxR}" x2="${cx}" y2="${cy + maxR}" />`;
    svg += `<line class="radar-axis-line" x1="${cx - maxR}" y1="${cy}" x2="${cx + maxR}" y2="${cy}" />`;
    
    // 3. Axes Labels
    svg += `<text class="radar-axis-label" x="${cx}" y="${cy - maxR - 15}">1과목 (법령)</text>`;
    svg += `<text class="radar-axis-label" x="${cx + maxR + 25}" y="${cy + 4}" text-anchor="start">2과목 (품질)</text>`;
    svg += `<text class="radar-axis-label" x="${cx}" y="${cy + maxR + 20}">3과목 (안전)</text>`;
    svg += `<text class="radar-axis-label" x="${cx - maxR - 25}" y="${cy + 4}" text-anchor="end">4과목 (이해)</text>`;
    
    // 4. Data Polygon
    const userP0 = getPoint(0, s1);
    const userP1 = getPoint(1, s2);
    const userP2 = getPoint(2, s3);
    const userP3 = getPoint(3, s4);
    
    svg += `<polygon class="radar-polygon" points="${userP0.x},${userP0.y} ${userP1.x},${userP1.y} ${userP2.x},${userP2.y} ${userP3.x},${userP3.y}" />`;
    
    // 5. Data dots and labels
    const drawDot = (p, score) => {
        return `
            <circle class="radar-point" cx="${p.x}" cy="${p.y}" />
            <text x="${p.x}" y="${p.y - 8}" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">${score}%</text>
        `;
    };
    
    svg += drawDot(userP0, s1);
    svg += drawDot(userP1, s2);
    svg += drawDot(userP2, s3);
    svg += drawDot(userP3, s4);
    
    svg += `</svg>`;
    wrapper.insertAdjacentHTML('beforeend', svg);
}
