#!/usr/bin/env python3
"""pdf2md_gui.py — pdf2md.py 변환 엔진의 PySide6 프런트엔드

pdf2md.py를 모듈로 import해 변환 로직을 100% 재사용한다(중복 없음).
변환은 QThread 워커에서 수행해 UI가 멈추지 않으며, 문서별 진행률·표
건강 경고·결과를 실시간으로 표시한다.

실행:
  python pdf2md_gui.py
전제:
  · 같은 폴더에 pdf2md.py 가 있어야 한다.
  · pip install PySide6 pdfplumber   (pymupdf는 이미지 추출용 선택사항)
"""
import os
import sys
import json
import traceback

from PySide6.QtCore import Qt, QThread, QObject, Signal, QUrl
from PySide6.QtGui import QFont, QDesktopServices, QAction
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QCheckBox, QListWidget, QPlainTextEdit,
    QProgressBar, QFileDialog, QGroupBox, QTableWidget, QTableWidgetItem,
    QAbstractItemView, QHeaderView, QMessageBox, QSplitter, QStatusBar,
)

# ── 변환 엔진 import (같은 폴더의 pdf2md.py) ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import pdf2md
    IMPORT_ERR = None
except Exception as e:  # pdfplumber/pymupdf 미설치 또는 pdf2md.py 부재
    pdf2md = None
    IMPORT_ERR = f'{type(e).__name__}: {e}'


# ── 백그라운드 변환 워커 ──────────────────────────────────────────────────
class ConvertWorker(QObject):
    progress = Signal(int, int)       # (완료 수, 전체 수)
    doc_done = Signal(dict)           # 문서 1건 결과
    log = Signal(str)                 # 로그 한 줄
    finished = Signal(int, int, int)  # (성공, 실패, 표경고)
    fatal = Signal(str)               # 치명 오류(스택)

    def __init__(self, inputs, out_dir, opts):
        super().__init__()
        self.inputs = inputs
        self.out_dir = out_dir
        self.opts = opts
        self._cancel = False

    def cancel(self):
        self._cancel = True

    def run(self):
        try:
            self._run()
        except Exception:
            self.fatal.emit(traceback.format_exc())

    def _run(self):
        o = self.opts
        # 프로파일/옵션은 엔진의 전역 상태에 반영 (단일 실행이라 안전)
        if o.get('profile'):
            pdf2md.load_profile(o['profile'])
        pdf2md.PROFILE['segment'] = o['segment']

        root = o.get('pdf_root') or pdf2md.DEFAULT_PDF_ROOT
        pdfs = pdf2md.collect_pdfs(self.inputs, root)
        if not pdfs:
            self.fatal.emit('변환할 PDF가 없습니다. 입력 경로/필터를 확인하세요.')
            return

        total = len(pdfs)
        ok = fail = flagged = 0
        report = []
        self.progress.emit(0, total)

        for i, (subdir, pdf_path) in enumerate(pdfs, 1):
            if self._cancel:
                self.log.emit('⏹ 사용자 취소 — 남은 문서 중단')
                break
            base = os.path.splitext(os.path.basename(pdf_path))[0]
            doc_dir = self.out_dir if o['flat'] else os.path.join(self.out_dir, base)
            out_path = os.path.join(doc_dir, base + '.md')
            images_dir = None if o['no_images'] else os.path.join(doc_dir, 'images')
            prefix = (base + '_') if o['flat'] else ''
            try:
                os.makedirs(doc_dir, exist_ok=True)
                body = pdf2md.convert(pdf_path, images_dir, prefix)
            except Exception as e:
                fail += 1
                self.log.emit(f'✗ FAIL  {base}: {e}')
                self.doc_done.emit({'doc': base, 'status': 'FAIL', 'error': str(e)})
                report.append({'doc': base, 'error': str(e)})
                self.progress.emit(i, total)
                continue

            md = f'# {base}\n\n{body}\n'
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(md)
            n_tables = md.count('|---') + md.count('| ---')
            flags = self._doctor(md) if o['doctor'] else []
            flagged += len(flags)
            ws = round(pdf2md.whitespace_ratio(body), 1)
            ok += 1

            self.doc_done.emit({
                'doc': base, 'status': 'OK', 'chars': len(body),
                'lines': body.count('\n') + 1, 'ws': ws, 'tables': n_tables,
                'flags': len(flags), 'path': out_path,
            })
            self.log.emit(
                f'✓ {base}: {len(body):,}자 · 표 {n_tables}'
                + (f' · ⚠ 표 {len(flags)}건' if flags else ''))
            for fl in flags:
                self.log.emit('      ' + fl)
            report.append({
                'doc': base, 'src': subdir, 'chars': len(body),
                'lines': body.count('\n') + 1, 'ws': ws, 'tables': n_tables,
            })
            self.progress.emit(i, total)

        try:
            os.makedirs(self.out_dir, exist_ok=True)
            with open(os.path.join(self.out_dir, '_report.json'), 'w',
                      encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self.log.emit(f'(리포트 저장 실패: {e})')

        self.finished.emit(ok, fail, flagged)

    @staticmethod
    def _doctor(md):
        """pdf2md의 표 건강 점검을 재사용해 경고 문자열 리스트 반환"""
        out = []
        for idx, blk in enumerate(pdf2md._md_table_blocks(md), 1):
            h = pdf2md.table_health(blk)
            why = []
            if h['cols'] < 2:
                why.append('열<2')
            if h['rows'] < 1:
                why.append('데이터행 없음')
            if h['empty_pct'] > 40:
                why.append(f"빈셀 {h['empty_pct']}%")
            if h['ragged']:
                why.append('열수 불균일')
            if why:
                out.append(f"표#{idx} ({h['cols']}열×{h['rows']}행) {', '.join(why)}")
        return out


# ── 메인 윈도우 ───────────────────────────────────────────────────────────
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('pdf2md — 참조 PDF → Markdown 변환기')
        self.resize(920, 680)
        self.thread = None
        self.worker = None
        self._build_ui()
        self._apply_style()
        if IMPORT_ERR:
            self._disable_for_import_error()

    # --- UI 구성 ---
    def _build_ui(self):
        central = QWidget()
        root = QVBoxLayout(central)
        root.setContentsMargins(14, 14, 14, 14)
        root.setSpacing(10)

        # 입력 그룹
        in_group = QGroupBox('입력 PDF (파일 또는 폴더)')
        in_lay = QHBoxLayout(in_group)
        self.input_list = QListWidget()
        self.input_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.input_list.setMinimumHeight(96)
        in_lay.addWidget(self.input_list, 1)
        btn_col = QVBoxLayout()
        for label, slot in (('파일 추가', self.add_files),
                            ('폴더 추가', self.add_folder),
                            ('선택 제거', self.remove_selected),
                            ('비우기', self.clear_inputs)):
            b = QPushButton(label)
            b.clicked.connect(slot)
            btn_col.addWidget(b)
        btn_col.addStretch(1)
        in_lay.addLayout(btn_col)
        root.addWidget(in_group)

        # 출력 + 프로파일
        io_group = QGroupBox('출력')
        grid = QGridLayout(io_group)
        grid.addWidget(QLabel('출력 폴더'), 0, 0)
        self.out_edit = QLineEdit()
        if pdf2md is not None:
            self.out_edit.setText(os.path.join(pdf2md.DEFAULT_PDF_ROOT, 'ref_md_v2'))
        grid.addWidget(self.out_edit, 0, 1)
        b_out = QPushButton('찾아보기')
        b_out.clicked.connect(self.pick_out)
        grid.addWidget(b_out, 0, 2)
        grid.addWidget(QLabel('프로파일(JSON, 선택)'), 1, 0)
        self.prof_edit = QLineEdit()
        self.prof_edit.setPlaceholderText('잡행/워터마크/마커 패턴 오버라이드 — 비우면 기본값')
        grid.addWidget(self.prof_edit, 1, 1)
        b_prof = QPushButton('찾아보기')
        b_prof.clicked.connect(self.pick_profile)
        grid.addWidget(b_prof, 1, 2)
        grid.setColumnStretch(1, 1)
        root.addWidget(io_group)

        # 옵션
        opt_group = QGroupBox('옵션')
        opt_lay = QHBoxLayout(opt_group)
        self.cb_segment = QCheckBox('문장 단위 병합')
        self.cb_segment.setChecked(True)
        self.cb_segment.setToolTip(
            '시각적 wrap 줄을 구조 마커/문장 종결 기준으로 한 단위로 접음.\n'
            '주의: 줄 번호가 바뀌므로 #L#### 인용이 있는 산출물은 끄고 변환.')
        self.cb_flat = QCheckBox('평면 출력(--flat)')
        self.cb_flat.setToolTip('{out}/{name}.md 로 저장 (기본: {out}/{name}/{name}.md)')
        self.cb_images = QCheckBox('이미지 추출')
        self.cb_images.setChecked(True)
        self.cb_doctor = QCheckBox('표 건강 점검')
        self.cb_doctor.setChecked(True)
        for cb in (self.cb_segment, self.cb_flat, self.cb_images, self.cb_doctor):
            opt_lay.addWidget(cb)
        opt_lay.addStretch(1)
        root.addWidget(opt_group)

        # 실행 바
        run_bar = QHBoxLayout()
        self.run_btn = QPushButton('변환 시작')
        self.run_btn.setObjectName('runBtn')
        self.run_btn.clicked.connect(self.start)
        self.cancel_btn = QPushButton('취소')
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel)
        self.open_out_btn = QPushButton('출력 폴더 열기')
        self.open_out_btn.clicked.connect(self.open_out_dir)
        self.progress = QProgressBar()
        self.progress.setTextVisible(True)
        run_bar.addWidget(self.run_btn)
        run_bar.addWidget(self.cancel_btn)
        run_bar.addWidget(self.open_out_btn)
        run_bar.addWidget(self.progress, 1)
        root.addLayout(run_bar)

        # 결과 테이블 + 로그 (스플리터)
        split = QSplitter(Qt.Vertical)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(
            ['문서', '글자수', '표', '공백%', '표경고', '상태'])
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        for c in range(1, 6):
            self.table.horizontalHeader().setSectionResizeMode(
                c, QHeaderView.ResizeToContents)
        self.table.doubleClicked.connect(self.open_selected_md)
        split.addWidget(self.table)

        self.log = QPlainTextEdit()
        self.log.setReadOnly(True)
        self.log.setFont(QFont('monospace', 10))
        self.log.setPlaceholderText('변환 로그 · 표 경고가 여기에 표시됩니다.')
        split.addWidget(self.log)
        split.setSizes([340, 200])
        root.addWidget(split, 1)

        self.setCentralWidget(central)
        self.setStatusBar(QStatusBar())
        self.statusBar().showMessage('준비됨')

        # 결과행 → md 경로 매핑
        self._row_path = {}

    def _apply_style(self):
        self.setStyleSheet("""
            QWidget { font-size: 13px; }
            QGroupBox {
                border: 1px solid #d0d3d8; border-radius: 8px;
                margin-top: 8px; padding: 8px; font-weight: 600;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
            QPushButton {
                padding: 6px 12px; border: 1px solid #c3c7cd;
                border-radius: 6px; background: #f5f6f8;
            }
            QPushButton:hover { background: #eceef1; }
            QPushButton:disabled { color: #9aa0a6; background: #f0f0f0; }
            QPushButton#runBtn {
                background: #2f6feb; color: white; border: none; font-weight: 600;
            }
            QPushButton#runBtn:hover { background: #285fce; }
            QPushButton#runBtn:disabled { background: #a9c0f5; }
            QLineEdit { padding: 5px; border: 1px solid #c3c7cd; border-radius: 6px; }
            QProgressBar {
                border: 1px solid #c3c7cd; border-radius: 6px; text-align: center;
                height: 22px;
            }
            QProgressBar::chunk { background: #2f6feb; border-radius: 5px; }
            QPlainTextEdit, QListWidget, QTableWidget {
                border: 1px solid #d0d3d8; border-radius: 6px;
            }
        """)

    def _disable_for_import_error(self):
        self.run_btn.setEnabled(False)
        self.log.setPlainText(
            'pdf2md 엔진을 불러오지 못했습니다:\n'
            f'    {IMPORT_ERR}\n\n'
            '· 이 GUI와 같은 폴더에 pdf2md.py 가 있는지 확인하세요.\n'
            '· 필수 의존성:  pip install pdfplumber\n'
            '· 이미지 추출까지 필요하면:  pip install pymupdf')
        self.statusBar().showMessage('엔진 로드 실패 — 로그 참조')

    # --- 입력 조작 ---
    def add_files(self):
        files, _ = QFileDialog.getOpenFileNames(
            self, 'PDF 선택', '', 'PDF 파일 (*.pdf)')
        self._add_paths(files)

    def add_folder(self):
        d = QFileDialog.getExistingDirectory(self, '폴더 선택')
        if d:
            self._add_paths([d])

    def _add_paths(self, paths):
        existing = {self.input_list.item(i).text()
                    for i in range(self.input_list.count())}
        for p in paths:
            if p and p not in existing:
                self.input_list.addItem(p)

    def remove_selected(self):
        for it in self.input_list.selectedItems():
            self.input_list.takeItem(self.input_list.row(it))

    def clear_inputs(self):
        self.input_list.clear()

    def pick_out(self):
        d = QFileDialog.getExistingDirectory(self, '출력 폴더')
        if d:
            self.out_edit.setText(d)

    def pick_profile(self):
        f, _ = QFileDialog.getOpenFileName(
            self, '프로파일 JSON', '', 'JSON (*.json)')
        if f:
            self.prof_edit.setText(f)

    # --- 실행/취소 ---
    def start(self):
        if self.thread is not None:
            return
        inputs = [self.input_list.item(i).text()
                  for i in range(self.input_list.count())]
        if not inputs:
            QMessageBox.warning(self, '입력 없음', '변환할 PDF나 폴더를 추가하세요.')
            return
        out_dir = self.out_edit.text().strip()
        if not out_dir:
            QMessageBox.warning(self, '출력 없음', '출력 폴더를 지정하세요.')
            return
        prof = self.prof_edit.text().strip()
        if prof and not os.path.isfile(prof):
            QMessageBox.warning(self, '프로파일 오류', '프로파일 JSON 경로가 올바르지 않습니다.')
            return

        opts = {
            'segment': self.cb_segment.isChecked(),
            'flat': self.cb_flat.isChecked(),
            'no_images': not self.cb_images.isChecked(),
            'doctor': self.cb_doctor.isChecked(),
            'profile': prof or None,
        }
        self.table.setRowCount(0)
        self._row_path.clear()
        self.log.clear()
        self.progress.setRange(0, 0)  # busy until first progress
        self.statusBar().showMessage('변환 중…')

        self.thread = QThread(self)
        self.worker = ConvertWorker(inputs, out_dir, opts)
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.run)
        self.worker.progress.connect(self.on_progress)
        self.worker.doc_done.connect(self.on_doc)
        self.worker.log.connect(self.on_log)
        self.worker.finished.connect(self.on_finished)
        self.worker.fatal.connect(self.on_fatal)
        self.worker.finished.connect(self.thread.quit)
        self.worker.fatal.connect(self.thread.quit)
        self.thread.finished.connect(self._cleanup_thread)

        self.run_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.thread.start()

    def cancel(self):
        if self.worker:
            self.worker.cancel()
            self.cancel_btn.setEnabled(False)
            self.statusBar().showMessage('취소 요청 — 현재 문서 완료 후 중단')

    def _cleanup_thread(self):
        if self.thread:
            self.thread.deleteLater()
        self.thread = None
        self.worker = None

    # --- 워커 시그널 핸들러 ---
    def on_progress(self, done, total):
        if self.progress.maximum() == 0 and total:
            self.progress.setRange(0, total)
        self.progress.setValue(done)

    def on_doc(self, r):
        row = self.table.rowCount()
        self.table.insertRow(row)

        def cell(text, align=Qt.AlignLeft):
            it = QTableWidgetItem(str(text))
            it.setTextAlignment(align | Qt.AlignVCenter)
            return it

        self.table.setItem(row, 0, cell(r['doc']))
        if r['status'] == 'OK':
            self.table.setItem(row, 1, cell(f"{r['chars']:,}", Qt.AlignRight))
            self.table.setItem(row, 2, cell(r['tables'], Qt.AlignRight))
            self.table.setItem(row, 3, cell(r['ws'], Qt.AlignRight))
            self.table.setItem(row, 4, cell(r['flags'] or '', Qt.AlignRight))
            self.table.setItem(row, 5, cell('OK', Qt.AlignCenter))
            self._row_path[row] = r.get('path')
        else:
            for c in range(1, 5):
                self.table.setItem(row, c, cell('—', Qt.AlignCenter))
            self.table.setItem(row, 5, cell('FAIL', Qt.AlignCenter))

    def on_log(self, line):
        self.log.appendPlainText(line)

    def on_finished(self, ok, fail, flagged):
        self.run_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        if self.progress.maximum() == 0:
            self.progress.setRange(0, 1)
            self.progress.setValue(1)
        msg = f'완료 — 성공 {ok} · 실패 {fail}'
        if flagged:
            msg += f' · 표 경고 {flagged}건'
        self.statusBar().showMessage(msg)
        self.log.appendPlainText('\n── ' + msg + ' ──')

    def on_fatal(self, tb):
        self.run_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.statusBar().showMessage('오류로 중단됨')
        self.log.appendPlainText('\n[치명 오류]\n' + tb)

    # --- 편의 ---
    def open_selected_md(self):
        rows = {i.row() for i in self.table.selectedIndexes()}
        for row in rows:
            path = self._row_path.get(row)
            if path and os.path.exists(path):
                QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    def open_out_dir(self):
        d = self.out_edit.text().strip()
        if d and os.path.isdir(d):
            QDesktopServices.openUrl(QUrl.fromLocalFile(d))
        else:
            QMessageBox.information(self, '폴더 없음', '출력 폴더가 아직 없습니다.')

    def closeEvent(self, event):
        if self.thread is not None and self.thread.isRunning():
            if self.worker:
                self.worker.cancel()
            self.thread.quit()
            self.thread.wait(3000)
        super().closeEvent(event)


def main():
    app = QApplication(sys.argv)
    app.setApplicationName('pdf2md')
    win = MainWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
