// views/backup.js - 로컬 데이터 백업 및 복원 (Data Backup & Restore)

export function getBackupKeys() {
    // 정적 키 목록 + 날짜 기반 동적 키(daily_completed_YYYY-MM-DD)를 모두 수집
    const staticKeys = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history',
        'fc_migrated_v2'
    ];
    const dynamicKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('daily_completed_')) {
            dynamicKeys.push(key);
        }
    }
    return [...staticKeys, ...dynamicKeys];
}

export function exportData() {
    const keys = getBackupKeys();
    const backupObj = {};
    
    keys.forEach(k => {
        backupObj[k] = localStorage.getItem(k);
    });
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cosmetic_pass_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    alert('학습 데이터 백업 파일 다운로드가 완료되었습니다!');
}

export function triggerImport() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.click();
    }
}

export function setupImportListener() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', importData);
    }
}

export function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const ALLOWED_KEYS = [
        'fc_memorized',
        'fc_weak',
        'quiz_results',
        'sim_results_history',
        'sim_draft_session',
        'pomo_total_time',
        'pomo_total_time_date',
        'study_streak',
        'study_streak_last_date',
        'calc_history',
        'fc_migrated_v2'
    ];
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // 데이터 검증 및 복원
            let restoredCount = 0;
            Object.keys(data).forEach(k => {
                // 화이트리스트 정적 키 또는 daily_completed_ 접두사 동적 키만 복원 허용
                const isAllowed = ALLOWED_KEYS.includes(k) || k.startsWith('daily_completed_');
                if (isAllowed && data[k] !== null && typeof data[k] === 'string') {
                    localStorage.setItem(k, data[k]);
                    restoredCount++;
                }
            });
            
            if (restoredCount > 0) {
                alert('학습 데이터 복원이 성공적으로 완료되었습니다! 페이지를 새로고침하여 적용합니다.');
                location.reload();
            } else {
                alert('가져올 유효한 학습 데이터 키가 존재하지 않습니다.');
            }
        } catch (err) {
            alert('유효하지 않은 백업 파일입니다. 백업 데이터 복원 실패.');
        }
    };
    reader.readAsText(file);
}
