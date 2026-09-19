/**
 * 합답형(combo) 파일럿 — 단답형/객관식 문항의 교재 근거에서 저작한 진술 조합 문항
 * ※ 수작업 저작 데이터 (자동 생성 아님) — 신규 문항 추가 시 npm run check:combo 로 검증
 * 스키마: content/문제은행/문항 스키마 설계.md (combo 유형)
 * 로드: DataLoader.loadComboDrills() → window.COMBO_PILOT
 *
 * 저작 원칙 (합답형 학습전략 §3):
 *  - 모든 진술은 원문항의 📖 교재 근거 표에 실재하는 사실로 작성
 *  - 거짓 진술은 혼동쌍(주체 바꿔치기·수치 변경·범위 왜곡)으로 구성
 *  - 오답 옵션은 정답 조합과 진술 1개만 다른 근접 오지 우선
 *  - sid는 'st-{과목}-{원문Q번호}{진술}' 규칙 — 오답·SM-2 큐 키
 */
window.COMBO_PILOT = {
  source: '문제은행 파일럿 (교재 근거 수작업 변환)',
  questions: [
    /* ── 과목4: 피부학 ── */
    {
      id: 'cb-04-001', subject: 4, type: 'combo', tags: ['구조', '생리'], points: 5,
      stem: '다음 보기 중 에크린선(소한선)에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0285a', conceptId: '한선-구분', text: '입술, 음부, 손톱을 제외한 전신에 분포하며 손바닥·발바닥·이마에 특히 많다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0285b', conceptId: '한선-구분', text: '땀은 무색·무취로 표피로 직접 분비된다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0285c', conceptId: '한선-구분', text: '땀은 주로 모낭을 통해 분비된다', truth: false, explain: '모낭 경유 분비는 아포크린선(대한선)의 특징. 에크린선은 표피로 직접 분비한다' },
        { id: 'ㄹ', sid: 'st-04-0285d', conceptId: '한선-구분', text: '주된 기능은 체취 형성이다', truth: false, explain: '에크린선의 주된 기능은 체온조절이다(pH 3.8~5.6의 맑은 땀)' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄷ'] },
        { id: '2', members: ['ㄱ', 'ㄴ'] },
        { id: '3', members: ['ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄹ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L1247): 에크린선 — 전신 분포, 표피 직접 분비, 무색·무취, pH 3.8~5.6, 체온조절 기능',
      derivedFrom: 'subject4_q285'
    },
    {
      id: 'cb-04-002', subject: 4, type: 'combo', tags: ['수치', '구조'], points: 5,
      stem: '다음 보기 중 자외선의 종류와 특성에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0380a', conceptId: '자외선-파장', text: 'UVA는 320~400nm의 장파장으로 광노화의 원인이다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0380b', conceptId: '자외선-파장', text: 'UVB는 290~320nm로 일광화상·홍반의 원인이다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0380c', conceptId: '자외선-파장', text: 'UVC는 파장이 가장 길어 진피까지 깊이 도달한다', truth: false, explain: 'UVC는 200~290nm 단파장(살균·소독작용). 진피 도달은 장파장 UVA의 특성' },
        { id: 'ㄹ', sid: 'st-04-0380d', conceptId: '자외선-파장', text: '표피와 진피에 모두 도달하는 자외선은 UVB이다', truth: false, explain: '표피·진피 모두 도달하는 것은 UVA. UVB는 주로 표피에 작용한다' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄹ'] },
        { id: '2', members: ['ㄴ', 'ㄷ'] },
        { id: '3', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '4', members: ['ㄱ', 'ㄴ'] },
        { id: '5', members: ['ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L1469): UVA 320~400nm 광노화 / UVB 290~320nm 일광화상·홍반 / UVC 200~290nm 피부암·살균소독',
      derivedFrom: 'subject4_q380'
    },
    {
      id: 'cb-04-003', subject: 4, type: 'combo', tags: ['구조'], points: 5,
      stem: '다음 보기 중 모발의 에피큐티클(Epicuticle)에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0324a', conceptId: '모발-큐티클', text: '모발 가장 바깥쪽의 얇은 막으로 시스틴 함유량이 많다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0324b', conceptId: '모발-큐티클', text: '친유성·알칼리성 약품에 대한 저항성이 가장 강한 층이다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0324c', conceptId: '모발-큐티클', text: '수증기와 물을 모두 통과시키는 구조이다', truth: false, explain: '수증기는 통과하나 물은 통과하지 못하는 구조' },
        { id: 'ㄹ', sid: 'st-04-0324d', conceptId: '모발-큐티클', text: '유연하여 물리적 자극에 강하다', truth: false, explain: '딱딱하고 부서지기 쉬워 물리적 자극에 약함' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄷ'] },
        { id: '2', members: ['ㄴ', 'ㄹ'] },
        { id: '3', members: ['ㄱ', 'ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
        { id: '5', members: ['ㄱ', 'ㄴ'] }
      ],
      explain: '📖 교재 근거 (L1346): 에피큐티클 — 두께 100Å 얇은 막, 시스틴 다량, 약품 저항성 최강, 수증기 통과·물 불통, 물리 자극에 약함',
      derivedFrom: 'subject4_q324'
    },
    {
      id: 'cb-04-004', subject: 4, type: 'combo', tags: ['구조', '생리'], points: 5,
      stem: '다음 보기 중 기저층에 존재하는 세포에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0299a', conceptId: '기저층-세포', text: '각질형성세포(케라티노사이트)는 각질층을 구성하는 각질세포를 만든다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0299b', conceptId: '기저층-세포', text: '멜라닌형성세포는 멜라노솜을 통해 각질형성세포에 멜라닌을 공급한다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0299c', conceptId: '기저층-세포', text: '머켈세포는 멜라닌을 합성하여 피부색을 결정한다', truth: false, explain: '피부색 결정은 멜라닌형성세포의 역할. 머켈세포는 신경말단과 연결된 촉각 감지 세포' },
        { id: 'ㄹ', sid: 'st-04-0361a', conceptId: '기저층-세포', text: '각질형성세포와 멜라닌형성세포는 약 4:1~10:1 비율로 존재한다', truth: true }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '2', members: ['ㄱ', 'ㄹ'] },
        { id: '3', members: ['ㄱ', 'ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L1162, L1196): 기저층 — 케라티노사이트·멜라노사이트·머켈세포 존재, 멜라노솜 공급, 4:1~10:1 비율',
      derivedFrom: 'subject4_q299'
    },
    {
      id: 'cb-04-005', subject: 4, type: 'combo', tags: ['구조', '수치'], points: 5,
      stem: '다음 보기 중 각질층과 표피 구조에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0276a', conceptId: '각질층-구성', text: '각질층은 약 10~20층의 납작한 무핵세포층으로 pH 4.5~5.5의 약산성이다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0276b', conceptId: '각질층-구성', text: '각질층은 케라틴 약 58%, NMF 약 31%, 세포간지질 약 11%로 구성된다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0276c', conceptId: '각질층-구성', text: '세포간지질은 친수기 층만으로 이루어진 단층 구조이다', truth: false, explain: '친수기 층과 친유기 층이 교대로 번갈아 이루는 다층(라멜라) 구조' },
        { id: 'ㄹ', sid: 'st-04-0276d', conceptId: '투명층-분포', text: '투명층은 전신 피부에 두루 존재하는 세포층이다', truth: false, explain: '투명층은 손바닥·발바닥에만 존재하는 2~3층의 무핵세포층' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄴ'] },
        { id: '2', members: ['ㄱ', 'ㄷ'] },
        { id: '3', members: ['ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L1158): 각질층 — 10~20층 무핵세포, pH 4.5~5.5, 케라틴 58%/NMF 31%/세포간지질 11%, 라멜라 구조 / 투명층 — 손바닥·발바닥 한정',
      derivedFrom: 'subject4_q276'
    },
    {
      id: 'cb-04-006', subject: 4, type: 'combo', tags: ['생리', '수치'], points: 5,
      stem: '다음 보기 중 각화 과정과 표피 각 층의 기능에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0299d', conceptId: '각화주기', text: '각화주기(턴오버)는 기저층에서 생성된 세포가 각질층까지 이동·탈락하는 약 28일 주기이다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0276e', conceptId: '과립층-기능', text: '과립층에는 수분저지막이 존재하여 수분 증발을 방지한다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0276f', conceptId: 'NMF-형성', text: '필라그린은 단백질 분해 효소에 의해 분해되어 NMF의 아미노산을 형성한다', truth: true },
        { id: 'ㄹ', sid: 'st-04-0276g', conceptId: '과립층-기능', text: '과립층은 세포분열이 가장 활발하게 일어나는 층이다', truth: false, explain: '세포분열은 기저층의 기능. 과립층은 각화 과정이 시작되는 곳으로 빛을 산란시켜 자외선을 흡수' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄴ', 'ㄹ'] },
        { id: '2', members: ['ㄱ', 'ㄷ'] },
        { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L1158, L1196): 각화주기 28±3일 / 과립층 수분저지막·케라토하이알린 / 필라그린→NMF 아미노산',
      derivedFrom: 'subject4_q299'
    },
    {
      id: 'cb-04-007', subject: 4, type: 'combo', tags: ['절차', '기한'], points: 5,
      stem: '다음 보기 중 맞춤형화장품판매업의 변경신고에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0298a', conceptId: '변경신고-대상', text: '판매업소의 상호 또는 소재지 변경은 변경신고 대상이다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0298b', conceptId: '변경신고-처리', text: '조제관리사 변경신고는 일반 변경신고 처리기한(10일)보다 짧은 7일 이내에 처리된다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0298c', conceptId: '변경신고-기한', text: '변경신고 기한은 변경이 있는 날부터 15일 이내이다', truth: false, explain: '변경이 있는 날부터 30일 이내에 관할 지방식품의약품안전청장에게 신고' },
        { id: 'ㄹ', sid: 'st-04-0298d', conceptId: '변경신고-관할', text: '변경신고는 관할 지방식품의약품안전청장에게 한다', truth: true }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '2', members: ['ㄱ', 'ㄹ'] },
        { id: '3', members: ['ㄴ', 'ㄷ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L588, 제8조의3): 변경신고 대상 — 업자·상호·소재지·조제관리사 변경 / 기한 30일 이내 / 처리 10일(조제관리사 7일)',
      derivedFrom: 'subject4_q298'
    },
    {
      id: 'cb-04-008', subject: 4, type: 'combo', tags: ['금지원료', '정의'], points: 5,
      stem: '다음 보기 중 맞춤형화장품에 사용 가능한 원료에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-04-0369a', conceptId: '사용원료-범위', text: '맞춤형화장품 조제에는 식약처장이 고시하는 사용 가능 원료에 한정된다', truth: true },
        { id: 'ㄴ', sid: 'st-04-0369b', conceptId: '사용원료-범위', text: '화장품에 사용상의 제한이 필요한 원료는 맞춤형화장품 조제에 사용할 수 없다', truth: true },
        { id: 'ㄷ', sid: 'st-04-0369c', conceptId: '사용원료-범위', text: '사전심사를 받지 않은 기능성화장품 고시 원료는 조제관리사의 판단으로 소량 사용할 수 있다', truth: false, explain: '사전심사 미실시·보고서 미제출 기능성 원료는 사용 불가. 재량 사용 근거 없음' },
        { id: 'ㄹ', sid: 'st-04-0369d', conceptId: '사용원료-범위', text: '화장품에 사용할 수 없는 원료도 맞춤형화장품에는 예외적으로 허용된다', truth: false, explain: '화장품에 사용 불가 원료는 맞춤형화장품에도 사용 불가' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄷ'] },
        { id: '2', members: ['ㄴ', 'ㄹ'] },
        { id: '3', members: ['ㄱ', 'ㄴ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L610, 제5조): 사용 불가 원료 — 화장품 사용 불가 원료, 사용상 제한 필요 원료, 사전심사·보고서 미제출 기능성 고시 원료',
      derivedFrom: 'subject4_q369'
    },
    /* ── 과목1: 법령 ── */
    {
      id: 'cb-01-001', subject: 1, type: 'combo', tags: ['처분기준'], points: 5,
      stem: '다음 보기 중 화장품법상 벌칙의 구분에 대한 설명으로 옳은 것을 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-01-0002a', conceptId: '벌칙-구분', text: '맞춤형화장품판매업의 신고·변경신고 위반은 3년 이하 징역 또는 3천만 원 이하 벌금 대상이다', truth: true },
        { id: 'ㄴ', sid: 'st-01-0015a', conceptId: '벌칙-구분', text: '의약품으로 잘못 인식할 수 있게 표시·광고한 자는 1년 이하 징역 또는 1천만 원 이하 벌금 대상이다', truth: true },
        { id: 'ㄷ', sid: 'st-01-0002b', conceptId: '벌칙-구분', text: '조제관리사를 두지 않은 맞춤형화장품판매업자는 1년 이하 징역 대상이다', truth: false, explain: '조제관리사 미배치는 3년 이하 징역 또는 3천만 원 이하 벌금 대상(중대 위반)' },
        { id: 'ㄹ', sid: 'st-01-0015b', conceptId: '벌칙-구분', text: '안전용기·포장 기준 위반은 3년 이하 징역 대상이다', truth: false, explain: '안전용기·포장 기준 위반은 1년 이하 징역 또는 1천만 원 이하 벌금 대상' }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄷ'] },
        { id: '2', members: ['ㄱ', 'ㄴ'] },
        { id: '3', members: ['ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L969~970): 3년/3천만 — 등록·신고 위반, 조제관리사 미배치, 기능성 심사 위반 등 / 1년/1천만 — 부당 표시광고, 안전용기 위반 등',
      derivedFrom: 'subject1_q2'
    },
    {
      id: 'cb-01-002', subject: 1, type: 'combo', tags: ['처분기준'], points: 5,
      stem: '다음 보기 중 4차 위반 시 영업 등록취소 대상이 되는 행위를 모두 고른 것은?',
      statements: [
        { id: 'ㄱ', sid: 'st-01-0056a', conceptId: '등록취소-사유', text: '제조소·화장품책임판매업소의 소재지를 변경(미신고)한 경우', truth: true },
        { id: 'ㄴ', sid: 'st-01-0056b', conceptId: '등록취소-사유', text: '회수 대상 화장품을 회수하지 않거나 회수에 필요한 조치를 하지 않은 경우', truth: true },
        { id: 'ㄷ', sid: 'st-01-0056c', conceptId: '등록취소-사유', text: '시정명령·회수명령 등 행정명령을 이행하지 않은 경우는 해당하지 않는다', truth: false, explain: '시정·검사·개수·회수·폐기·공표명령 불이행도 등록취소 대상' },
        { id: 'ㄹ', sid: 'st-01-0056d', conceptId: '등록취소-사유', text: '사용할 수 없는 원료를 사용한 화장품을 제조한 경우', truth: true }
      ],
      options: [
        { id: '1', members: ['ㄱ', 'ㄴ', 'ㄷ'] },
        { id: '2', members: ['ㄱ', 'ㄹ'] },
        { id: '3', members: ['ㄱ', 'ㄴ', 'ㄹ'] },
        { id: '4', members: ['ㄴ', 'ㄹ'] },
        { id: '5', members: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }
      ],
      explain: '📖 교재 근거 (교재: L869): 4차 위반 시 등록취소 — 소재지 변경, 위해 화장품 제조·수입, 회수 불이행, 금지원료 사용, 행정명령 불이행 등',
      derivedFrom: 'subject1_q56'
    }
  ]
};
