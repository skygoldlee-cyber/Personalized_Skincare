// src/trainer-calc.js - 계산 트레이너 문제 생성기 (순수 로직, 전역 스코프 실행)
//
// 모놀리식 점진 모듈화의 일부로, 기존 app.js의 계산 문제 생성 로직 중
// DOM 조작과 무관한 "문제 데이터(qData) 생성" 부분만 분리했습니다.
// DOM 의존이 없어 단위 테스트/재사용이 쉽습니다.
//
// 반환: { type, question, answer, unit, solution }
// question/solution은 코드가 조립한 신뢰된 HTML(숫자 + <strong>/<br>)이므로
// 호출측에서 innerHTML로 주입해도 안전합니다(raw 사용, 사용자 입력 없음).

function buildCalcQuestion() {
    const qType = Math.floor(Math.random() * 4);
    let qData = {};
    
    if (qType === 0) {
        const totalWeights = [100, 150, 200, 300, 500];
        const rawConcs = [10, 20, 30, 50, 80];
        const targetConcs = [1, 2, 3, 5];
        
        const W = totalWeights[Math.floor(Math.random() * totalWeights.length)];
        const C1 = rawConcs[Math.floor(Math.random() * rawConcs.length)];
        const C2 = targetConcs[Math.floor(Math.random() * targetConcs.length)];
        
        const answer = (C2 / C1) * W;
        
        qData = {
            type: '원료 배합량',
            question: `농도 <strong>${C1}%</strong>인 특정 성분의 원료액을 사용하여 최종 혼합제품 <strong>${W}g</strong> 내에 해당 성분 농도가 <strong>${C2}%</strong>가 되도록 배합하고자 한다. 이때 투입해야 하는 원료액의 양은 몇 <strong>g</strong>인가? (소수점 둘째 자리까지 구하시오)`,
            answer: answer.toFixed(2),
            unit: 'g',
            solution: `■ 공식: 추가 원료량(g) = (목표 성분량 / 원료 농도)<br>
- 목표 성분량: ${W}g * ${C2}% = ${W * C2 / 100}g<br>
- 대입 계산: ${W * C2 / 100}g / ( ${C1} / 100 ) = <strong>${answer.toFixed(2)}g</strong>`
        };
    } else if (qType === 1) {
        const w1List = [100, 200];
        const w2List = [100, 200, 300];
        const c1List = [1, 2, 3];
        const c2List = [4, 5, 6];
        
        const W1 = w1List[Math.floor(Math.random() * w1List.length)];
        const W2 = w2List[Math.floor(Math.random() * w2List.length)];
        const C1 = c1List[Math.floor(Math.random() * c1List.length)];
        const C2 = c2List[Math.floor(Math.random() * c2List.length)];
        
        const totalW = W1 + W2;
        const totalC = (C1 * W1 + C2 * W2) / totalW;
        
        qData = {
            type: '혼합 평균 농도',
            question: `농도가 <strong>${C1}%</strong>인 세럼 내용물 <strong>${W1}g</strong>과 농도가 <strong>${C2}%</strong>인 크림 내용물 <strong>${W2}g</strong>을 한 용기에 담고 균일하게 혼합하였다. 혼합된 화장품의 최종 성분 농도는 몇 <strong>%</strong>인가? (소수점 셋째 자리에서 반올림하여 둘째 자리까지 구하시오)`,
            answer: totalC.toFixed(2),
            unit: '%',
            solution: `■ 공식: 최종 농도(%) = (총 성분 중량 / 총 내용물 중량) * 100<br>
1. A 제품 내 성분 중량: ${W1}g * ${C1}% = ${W1 * C1 / 100}g<br>
2. B 제품 내 성분 중량: ${W2}g * ${C2}% = ${W2 * C2 / 100}g<br>
3. 총 내용물 중량: ${W1}g + ${W2}g = ${totalW}g<br>
4. 최종 식: (${W1 * C1 / 100 + W2 * C2 / 100}g / ${totalW}g) * 100 = <strong>${totalC.toFixed(2)}%</strong>`
        };
    } else if (qType === 2) {
        const wList = [98, 99, 198, 199, 297, 495];
        const lList = [0.5, 1.0, 2.0];
        
        const W = wList[Math.floor(Math.random() * wList.length)];
        const L = lList[Math.floor(Math.random() * lList.length)];
        
        const answer = (L * W) / (100 - L);
        
        qData = {
            type: '한도 내 최대 추가량',
            question: `기본 화장품 내용물 <strong>${W}g</strong>에 법적 사용 제한 성분(최대 배합 한도 <strong>${L}%</strong>, 순도 100%)을 배합 한도를 꽉 채워 맞춤형화장품을 조제하고자 한다. 이때 추가할 수 있는 사용 제한 성분의 최대 중량은 몇 <strong>g</strong>인가? (소수점 셋째 자리에서 반올림하여 둘째 자리까지 구하시오)`,
            answer: answer.toFixed(2),
            unit: 'g',
            solution: `■ 공식: 추가 원료 중량을 x로 둘 때, x / (기존내용물중량 + x) = 한도비율 / 100<br>
- 대입 식: x / (${W} + x) = ${L} / 100<br>
- 정리: 100x = ${L} * (${W} + x) = ${L * W} + ${L}x<br>
- 이항: (100 - ${L})x = ${L * W} => ${100 - L}x = ${L * W}<br>
- 결과: x = ${L * W} / ${100 - L} = <strong>${answer.toFixed(2)}g</strong>`
        };
    } else {
        const w1List = [150, 190, 240, 480];
        const w2List = [5, 10, 20];
        
        const W1 = w1List[Math.floor(Math.random() * w1List.length)];
        const W2 = w2List[Math.floor(Math.random() * w2List.length)];
        
        const totalW = W1 + W2;
        const conc = (W2 / totalW) * 100;
        
        qData = {
            type: '희석 농도',
            question: `베이스 에센스 내용물 <strong>${W1}g</strong>에 보습 활성 원료 <strong>${W2}g</strong>을 추가하여 혼합하였다. 이때 최종 조제된 에센스 내의 보습 활성 원료의 성분 농도(%)는 얼마인가? (소수점 셋째 자리에서 반올림하여 둘째 자리까지 구하시오)`,
            answer: conc.toFixed(2),
            unit: '%',
            solution: `■ 공식: 최종 농도(%) = (추가 원료 중량 / 총 내용물 중량) * 100<br>
1. 총 내용물 중량 = 베이스 중량(${W1}g) + 원료 중량(${W2}g) = ${totalW}g<br>
2. 대입 식 = (${W2}g / ${totalW}g) * 100 = <strong>${conc.toFixed(2)}%</strong>`
        };
    }
    
    return qData;
}
