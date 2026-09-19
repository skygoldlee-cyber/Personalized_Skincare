// src/pwa-manifest.js — 시험별 동적 PWA 매니페스트 (클래식 스크립트, 모듈 아님)
// 정적 manifest.webmanifest는 기본 시험 기준 폴백으로 유지하고,
// EXAMS_LIST + current_exam이 있으면 활성 시험의 이름/설명으로 blob 매니페스트를 주입한다.
// data/exams.js 이후, app.js(모듈) 이전에 로드되어야 한다.
(function () {
    try {
        var exams = (window.EXAMS_LIST && window.EXAMS_LIST.exams) || [];
        if (!exams.length) return;
        var id = null;
        try { id = localStorage.getItem('current_exam'); } catch (e) { /* noop */ }
        var exam = null;
        for (var i = 0; i < exams.length; i++) {
            if (exams[i].id === id) { exam = exams[i]; break; }
        }
        if (!exam) {
            for (var j = 0; j < exams.length; j++) {
                if (exams[j].default) { exam = exams[j]; break; }
            }
        }
        if (!exam) exam = exams[0];
        if (!exam) return;

        var link = document.querySelector('link[rel="manifest"]');
        if (!link) return;

        var base = {
            id: exam.id + '-pass',
            name: exam.title || exam.name,
            short_name: exam.shortName || exam.name,
            description: exam.desc || '',
            start_url: './index.html',
            scope: './',
            display: 'standalone',
            orientation: 'any',
            background_color: '#0b0f19',
            theme_color: '#0b0f19',
            lang: 'ko',
            categories: ['education'],
            prefer_related_applications: false,
            icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
        };
        link.href = URL.createObjectURL(new Blob([JSON.stringify(base)], { type: 'application/manifest+json' }));

        // 문서 제목/설명도 활성 시험 기준으로 갱신
        if (exam.title) document.title = exam.title;
        var metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && exam.desc) metaDesc.setAttribute('content', exam.desc);
    } catch (e) { /* 정적 매니페스트 폴백 유지 */ }
})();
