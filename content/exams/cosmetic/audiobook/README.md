# 📖→🎧 화장품 조제관리사 교재 오디오북 파이프라인

MD 교재 파일을 **청취용 원고로 정제**한 뒤 **ElevenLabs TTS**로 MP3 오디오북을 생성하는 Python 프로그램입니다.

```
MD 교재 → 청킹(≤2,500자) → 청취용 원고 정제 → ElevenLabs TTS → 청크 MP3 → 챕터 통합 MP3
```

## 왜 바로 TTS에 넣지 않나요?

원본 MD에는 표(`| ... |`), 계층 기호(`┗`), 원형 숫자(①②③), 법조항(`제3조의2`) 등
**눈으로 읽기 위한 표기**가 많습니다. 그대로 TTS에 넣으면 기호를 그대로 읽거나 맥락 없이 나열합니다.
이 파이프라인은 먼저 **듣기 좋은 문장으로 변환**합니다:

| 원본 | 변환 예 |
|------|---------|
| `#### ① 유지(오일)` | `첫째, 유지(오일)` |
| 표 `\| 구분 \| 특징 \|` | `다음 내용을 표로 정리했습니다. 구분과 특징에 대한 내용입니다. 식물성 오일: …` |
| `제3조의2` | `제3조의 2` |
| `┗ 하위 항목` | `하위 항목으로, …` |

## 사전 준비

1. **Python**: WinPython 3.12.4 (`c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe`)
2. **패키지 설치** (TTS 사용 시에만 필요):
   ```powershell
   c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe -m pip install -r content\audiobook\requirements.txt
   ```
3. **API 키** (TTS 사용 시에만 필요): `content\.env.example` 참고 → `ELEVENLABS_API_KEY` 환경변수 설정
4. **ffmpeg** (선택, MP3 병합 품질 향상): `winget install ffmpeg`

## 사용법

### 1단계 — 원고 정제만 (묣료, API 키 불필요)

```powershell
# 전체 과목 원고 생성
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --polish-only

# 처리 대상만 미리 보기
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --list

# 특정 과목/챕터만
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --subject manufacturing --chapter 1 --polish-only
```

결과물:
- `content/audiobook/scripts/<과목>/ch01_001.txt …` — 청취용 원고 (검수용)
- `content/audiobook/chunks/<과목>/ch01/ch01_001.md …` — 원본 청크 (검수용)

### 2단계 — 원고 검수 후 TTS 실행

`content/audiobook/scripts/` 의 `.txt` 파일을 열어 읽기 자연스러운지 확인하고,
부자연스러운 부분은 직접 수정한 뒤 실행하세요 (수정한 원고가 그대로 합성됩니다).

```powershell
# API 키 설정 (최초 1회, 새 터미널마다 필요)
$env:ELEVENLABS_API_KEY="여기에_키"

# 전체 챕터 TTS + 병합
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --tts

# 중단됐다면 이어서 (이미 만든 청크 MP3는 건너뜀)
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --tts --resume

# 음성 변경 (ElevenLabs 웹에서 한국어 음성 테스트 후 이름/ID 지정)
c:\Python\WPy64-31241\python-3.12.4.amd64\python.exe content\audiobook\run_pipeline.py --tts --voice "음성이름"
```

결과물:
- `content/audiobook/mp3/<과목>/ch01_chunks/ch01_001.mp3 …` — 청크별 MP3
- `content/audiobook/mp3/<과목>/ch01_화장품_원료의_종류와….mp3` — **챕터 통합 MP3** (최종 결과물)

## TTS 설정 (강의식 차분한 음성)

[`tts_elevenlabs.py`](tts_elevenlabs.py) 기본값:

| 항목 | 값 | 이유 |
|------|-----|------|
| model | `eleven_multilingual_v2` | 한국어 품질 최상 (flash보다 자연스러움) |
| stability | 0.5 | 감정 기복 없이 안정적 |
| similarity_boost | 0.75 | 원음 유지 |
| style | 0.0 | 과장된 억양 제거 (강의식) |
| output_format | `mp3_44100_128` | 음질/용량 균형 |

## 모듈 구성

| 파일 | 역할 |
|------|------|
| [`md_chunker.py`](md_chunker.py) | MD → 의미 블록 분할 → ≤2,500자 청크 병합 (표는 행 단위 분할) |
| [`script_polisher.py`](script_polisher.py) | 청크 → 청취용 원고 (표 낭독 변환, 법조항/기호 읽기, 인트로/아웃트로) |
| [`tts_elevenlabs.py`](tts_elevenlabs.py) | ElevenLabs API 호출, 청크별 MP3 저장, 지수 백오프 재시도, 이어하기 |
| [`mp3_merger.py`](mp3_merger.py) | 청크 MP3 → 챕터 통합 MP3 (ffmpeg concat + 0.7초 무음, 없으면 바이너리 연결) |
| [`run_pipeline.py`](run_pipeline.py) | 전체 오케스트레이션 CLI |

## 과목 키 (`--subject`)

| 키 | 폴터 |
|----|------|
| `understanding` | 2026 맞춤형화장품의 이해 |
| `safety` | 2026 유통화장품 안전관리 |
| `manufacturing` | 2026 화장품 제조 및 품질관리 |
| `law` | 화장품법의 이해 |

## 비용/시간 가이드

- ElevenLabs 물료 플랜: 월 10,000 크레딧(≒10,000자) — 챕터 1개 분량 수준. 유료 플랜 권장.
- 청크 1개(2,500자) ≒ 오디오 3~4분 ≒ 생성 수 초.
- 실패하더라도 청크 단위로 저장되므로 `--resume`으로 이어서 실행 가능.

## 문제 해결

- **`환경변수 ELEVENLABS_API_KEY가 설정되지 않았습니다`** → PowerShell에서 `$env:ELEVENLABS_API_KEY="키"` 실행 후 같은 터미널에서 재실행
- **`음성 'Aria'을(를) 찾을 수 없습니다`** → 계정에 음성이 없는 경우. ElevenLabs 웹 Voice Library에서 한국어 음성을 추가하거나 `--voice`에 음성 ID 직접 지정
- **병합 경고(ffmpeg 없음)** → 바이너리 연결로 폴트백되어 재생은 되지만 무음 구분이 없을 수 있음. `winget install ffmpeg` 권장
