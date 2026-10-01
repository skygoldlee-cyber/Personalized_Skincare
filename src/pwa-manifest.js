// src/pwa-manifest.js — 시험별 동적 PWA 매니페스트 (클래식 스크립트, 모듈 아님)
// @spec P-10,DA-06
// 정적 manifest.webmanifest는 기본 시험 기준 폴백으로 유지하고,
// 비기본 시험이 활성이면 빌드가 생성한 실제 파일 manifest.<id>.webmanifest로 링크를 교체한다.
// ⚠️ blob:/data: URL 주입은 금지 — Chrome이 설치 요건에서 유효하지 않은 스킴으로
//    판정해 beforeinstallprompt가 발생하지 않고, connect-src 'self'가 fetch도 차단한다.
// data/exams.js 이후, app.js(모듈) 이전에 로드되어야 한다.
(function () {
    try {
        const exams = (window.EXAMS_LIST && window.EXAMS_LIST.exams) || [];
        if (!exams.length) return;
        let id = null;
        try { id = localStorage.getItem('current_exam'); } catch (e) { /* noop */ }
        let exam = null;
        for (let i = 0; i < exams.length; i++) {
            if (exams[i].id === id) { exam = exams[i]; break; }
        }
        if (!exam) {
            for (let j = 0; j < exams.length; j++) {
                if (exams[j].default) { exam = exams[j]; break; }
            }
        }
        if (!exam) exam = exams[0];
        if (!exam) return;

        const link = /** @type {HTMLLinkElement|null} */ (document.querySelector('link[rel="manifest"]'));
        if (!link) return;

        // 기본 시험은 정적 manifest.webmanifest가 이미 동일 내용이므로 유지.
        // 비기본 시험은 빌드 산출물 manifest.<id>.webmanifest(실제 파일)로 교체 —
        // 누락 시 정적 매니페스트 폴백이 남아 설치가 깨지지 않는다.
        if (!exam.default) {
            link.href = 'manifest.' + encodeURIComponent(exam.id) + '.webmanifest';
        }

        // 문서 제목/설명도 활성 시험 기준으로 갱신
        if (exam.title) document.title = exam.title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && exam.desc) metaDesc.setAttribute('content', exam.desc);

        // iOS '홈 화면에 추가' 시 사용되는 앱 이름 — 시험별 앱 이름으로 교체
        // (iOS는 추가 시점의 메타 값을 읽으므로 설치 전에 반영되어야 한다)
        const appName = exam.appName
            || (((exam.logoMain || '') + (exam.logoSub || '')).trim())
            || exam.name;
        const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (appleTitle && appName) appleTitle.setAttribute('content', appName);
    } catch (e) { /* 정적 매니페스트 폴백 유지 */ }
})();
