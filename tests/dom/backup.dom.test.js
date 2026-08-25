import { describe, it, beforeEach, expect, vi } from 'vitest';
import { getBackupKeys, exportData, triggerImport, importData } from '../../src/views/backup.js';

describe('backup.js — DOM 테스트', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    describe('getBackupKeys', () => {
        it('정적 키만 있을 때 모든 정적 키를 반환', () => {
            const keys = getBackupKeys();
            expect(keys).toContain('fc_memorized');
            expect(keys).toContain('fc_weak');
            expect(keys).toContain('quiz_results');
            expect(keys).toContain('sim_results_history');
            expect(keys).toContain('study_streak');
            expect(keys).toContain('calc_history');
        });

        it('daily_completed_ 동적 키를 포함', () => {
            localStorage.setItem('daily_completed_2025-01-01', '5');
            localStorage.setItem('daily_completed_2025-01-02', '3');
            const keys = getBackupKeys();
            expect(keys).toContain('daily_completed_2025-01-01');
            expect(keys).toContain('daily_completed_2025-01-02');
        });

        it('관련 없는 키는 제외', () => {
            localStorage.setItem('random_key', 'value');
            localStorage.setItem('another_random', 'data');
            const keys = getBackupKeys();
            expect(keys).not.toContain('random_key');
            expect(keys).not.toContain('another_random');
        });
    });

    describe('exportData', () => {
        it('localStorage 데이터를 기반으로 다운로드 링크를 생성', () => {
            localStorage.setItem('fc_memorized', JSON.stringify(['card1', 'card2']));
            localStorage.setItem('study_streak', '5');

            // createElement('a')의 click 호출을 추적
            const clickSpy = vi.fn();
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                const el = originalCreateElement(tag);
                if (tag === 'a') {
                    el.click = clickSpy;
                }
                return el;
            });

            // alert 모킹
            vi.spyOn(window, 'alert').mockImplementation(() => {});

            exportData();

            expect(clickSpy).toHaveBeenCalledOnce();
            expect(window.alert).toHaveBeenCalledOnce();

            vi.restoreAllMocks();
        });
    });

    describe('triggerImport', () => {
        it('import-file-input 요소가 있으면 click 호출', () => {
            const input = document.createElement('input');
            input.id = 'import-file-input';
            input.type = 'file';
            document.body.appendChild(input);

            const clickSpy = vi.spyOn(input, 'click');
            triggerImport();

            expect(clickSpy).toHaveBeenCalledOnce();
        });

        it('import-file-input 요소가 없으면 에러 없이 반환', () => {
            expect(() => triggerImport()).not.toThrow();
        });
    });

    describe('importData', () => {
        it('유효한 백업 데이터를 localStorage에 복원', () => {
            const backupData = {
                fc_memorized: JSON.stringify(['card1']),
                fc_weak: JSON.stringify(['card2']),
                quiz_results: JSON.stringify({ q1: { correct: true } }),
                study_streak: '3',
            };

            const file = new File([JSON.stringify(backupData)], 'backup.json', {
                type: 'application/json',
            });

            // alert 모킹
            vi.spyOn(window, 'alert').mockImplementation(() => {});
            // location.reload 모킹
            delete window.location;
            window.location = { reload: vi.fn() };

            const event = { target: { files: [file] } };

            return new Promise((resolve) => {
                importData(event);

                // FileReader.onload은 비동기이므로 약간 대기
                setTimeout(() => {
                    expect(localStorage.getItem('fc_memorized')).toBe(JSON.stringify(['card1']));
                    expect(localStorage.getItem('fc_weak')).toBe(JSON.stringify(['card2']));
                    expect(localStorage.getItem('study_streak')).toBe('3');
                    resolve();
                }, 100);
            });
        });

        it('화이트리스트에 없는 키는 복원하지 않음', () => {
            const backupData = {
                fc_memorized: JSON.stringify(['card1']),
                malicious_key: 'evil_data',
            };

            const file = new File([JSON.stringify(backupData)], 'backup.json', {
                type: 'application/json',
            });

            vi.spyOn(window, 'alert').mockImplementation(() => {});
            delete window.location;
            window.location = { reload: vi.fn() };

            const event = { target: { files: [file] } };

            return new Promise((resolve) => {
                importData(event);

                setTimeout(() => {
                    expect(localStorage.getItem('fc_memorized')).toBe(JSON.stringify(['card1']));
                    expect(localStorage.getItem('malicious_key')).toBeNull();
                    resolve();
                }, 100);
            });
        });

        it('유효하지 않은 JSON 파일은 에러 메시지 표시', () => {
            const file = new File(['not valid json', ''], 'bad.json', {
                type: 'application/json',
            });

            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            const event = { target: { files: [file] } };

            return new Promise((resolve) => {
                importData(event);

                setTimeout(() => {
                    expect(alertSpy).toHaveBeenCalledWith(
                        expect.stringContaining('유효하지 않은 백업 파일')
                    );
                    resolve();
                }, 100);
            });
        });

        it('빈 파일 선택 시 아무 동작 없음', () => {
            const event = { target: { files: [] } };
            expect(() => importData(event)).not.toThrow();
        });
    });
});
