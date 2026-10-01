// src/combo-doc.js — 복수정답형(combo) 문항 배열 → 문제집 Markdown 직렬화
// @spec EV-01
//
// 기존에는 tools/build/build_combo_drills.js가 과목N_복수정답형.md를
// 문제은행 폴더에 굽고 exam-viewer가 그 산출물을 열람했으나,
// 이제 DataLoader.loadComboDrills()(자동 변환 + 수작업 파일럿 병합)의
// 문항을 런타임에 직렬화해 동일 포맷으로 렌더링한다.
// → 생성물 이중 관리(원본 md + exams_md 번들) 제거, 파일럿 문항도 문서에 포함.

const STMT_LABELS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'];
const OPT_INDICATORS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * 과목별 combo 문항을 문제은행 MD 형식으로 직렬화.
 * 문제부: ### Qn. 발문 / citation / ㄱ~ㅁ 진술 / ①~⑤ 조합 선지
 * 정답부: **Qn.** / 정답 조합 / 진술별 O·X 판정표 / 해설(교재 근거)
 * @param {number} subject 과목 번호 (1~4)
 * @param {string|undefined} subjectName 과목명 (manifest subjects[].name)
 * @param {Array} questions combo 문항 배열 (자동 변환 + 파일럿 병합분)
 * @returns {string} 마크다운 문서
 */
export function buildComboSubjectMd(subject, subjectName, questions) {
    const lines = [
        `# ${subject ? `제${subject}과목: ` : ''}${subjectName || '조합형'} ㄱㄴㄷ 조합형`,
        '',
        '> **화장품조제관리사 필기시험 대비** (ㄱㄴㄷ 조합형)',
        '> 문제에 집중할 수 있도록 정답과 교재 근거는 파일 끝에 모아 제공합니다.',
        '> 자동 변환 문항 + 수작업 파일럿 문항이 섞여 있습니다 (런타임 생성 문서).',
        '',
        `총 ${questions.length}제`,
        '',
        '---',
        '',
        `## 📝 [ㄱㄴㄷ 조합형: 옳은 것을 모두 고르시오]`,
        '',
    ];

    const answers = [];
    questions.forEach((q, i) => {
        const num = i + 1;
        const isPilot = String(q.id).startsWith('cb-');
        lines.push(`### Q${num}. ${q.stem}${isPilot ? ' *(수작업 파일럿)*' : ''}`);
        lines.push(`${q.citation}`);
        lines.push('');
        (q.statements || []).forEach(s => lines.push(`${s.id}. ${s.text}`));
        lines.push('');
        // 멤버는 라벨(ㄱㄴㄷ…) 순으로 표기 — 수작업 members도 동일한 관례로 보여주기 위해 재정렬
        const labelOrder = m => STMT_LABELS.indexOf(m);
        (q.options || []).forEach((o, idx) => lines.push(
            `${OPT_INDICATORS[idx]} ${[...(o.members || [])].sort((a, b) => labelOrder(a) - labelOrder(b)).join(', ')}`));
        lines.push('', '---', '');
        answers.push({ num, q });
    });

    lines.push('## 🔑 정답 및 교재 근거', '');
    for (const { num, q } of answers) {
        const trueIds = (q.statements || []).filter(s => s.truth).map(s => s.id);
        // 파일럿은 answer 미보유 — truth 집합과 일치하는 옵션으로 도출
        const trueSet = new Set(trueIds);
        const eq = o => (o.members || []).length === trueSet.size && o.members.every(m => trueSet.has(m));
        const ansIdx = (q.options || []).findIndex(o => (q.answer && o.id === q.answer) || (!q.answer && eq(o)));
        const ansLabel = OPT_INDICATORS[ansIdx] || q.answer || '?';
        lines.push(`**Q${num}.**`);
        lines.push(`> **정답: ${ansLabel} (${trueIds.join(', ')})**`);
        lines.push(`> 진술 판정: ${(q.statements || []).map(s => `${s.id} ${s.truth ? 'O' : 'X'}`).join(' · ')}`);
        lines.push(`> ${String(q.citation || '').replace(/^📖\s*/, '📖 ')}`);
        const exp = String(q.explain || '').trim();
        // 원본 해설에 박힌 '정답: ② …' 라인이 그대로 새어나가면 복수정답형 정답과 혼동 → 필터
        if (exp) exp.split('\n')
            .filter(l => !/^\s*정답\s*[:：]/.test(l.trim()))
            .forEach(l => lines.push(`> ${l.trim()}`));
        lines.push('');
    }
    return lines.join('\n');
}
