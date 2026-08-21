# 화장품 안전 기준 등에 관한 규정
## [시행 2024. 2. 7.] (원본 기준, 이후 아래 검증으로 일부 갱신됨)

> **최신성 검증 (2026.7 기준):** 원본 파일은 2024.2.7 시행 버전을 기준으로 작성되었습니다. 이후 확인된 개정사항 중 다음 2건을 반영했습니다.
> 1. 메칠페닐렌디아민류(2,6-디하이드록시에칠아미노톨루엔) 조건부 허용 문구 갱신 (2025.9월 개정고시, 대한화장품협회 2025.9.3 통지 확인)
> 2. 황산 o-클로로-p-페닐렌디아민 추가 (2023년말 개정으로 염모제 관련 금지 성분 7종에 포함되었으나 원본에 누락되어 있었음)
>
> 다만 이 목록은 최소 1,000개 이상의 원료를 다루고 있어 모든 항목을 식약처 최신 고시 원문과 1:1 대조하지는 못했습니다. 시험 직전에는 국가법령정보센터(law.go.kr) 또는 식약처(mfds.go.kr) 최신 고시로 최종 확인을 권장합니다.

> **[증상 효과 컬럼 안내]** 이 목록은 화장품에 **사용할 수 없는 원료(별표1)** 입니다. 중금속·발암성물질·유기용제·의약품/마약류·염모제 중간체·동물조직 등은 화장품에서의 유익한 피부 효과가 없으므로 '증상 효과'는 원칙적으로 **해당없음(-)** 이 정답입니다. 다만 **유익 효과가 뚜렷해 과거 사용되었거나 불법 첨가되어 금지된 시험 빈출 성분**(예: 히드로퀴논=미백, 수은=미백, 트레티노인=주름/여드름, 글루코코르티코이드=항염, 미녹시딜=발모)에 한해 `효과 (사용금지 사유)` 형태로 표기했습니다. → 시험 포인트는 '**효과가 있어도 사용금지**'라는 점입니다.

> **[데이터 구조]** 통합 필드 정의는 `approved_ingredients.md`의 "데이터 구조" 절(논리적 마스터 스키마)을 따릅니다. 이 파일의 표는 그 부분집합인 **3열**((원료명\|성분명) · 증상 효과 · (비고\|설명\|예외 조건))을 사용합니다. **'사용 금지 여부'는 별도 컬럼이 아니라 '이 파일(별표1)에 수록되었다는 사실' 자체로 표현**됩니다(전 성분이 사용금지 원료).

---

## 학습 가이드

**시험 대비 핵심 포인트:**
- 전체 목록은 약 500개 이상이지만, 시험에서 고빈도로 출제되는 성분은 약 50개 내외
- 중금속, 발암성 물질, 의약품/마약류는 반드시 암기 필요
- 염모제 관련 성분은 예외 조건(특정 농도 이하 사용 가능)을 꼭 확인

**연상법 팁:**
- **납수비카**: 납, 수은, 비소, 카드뮴 (중금속 4대장)
- **벤조피렌**: 벤조[a]피렌 (발암성 물질 대표)
- **니트로**: 니트로벤젠, 니트로톨루엔 (니트로계 화합물)
- **디에칠렌**: 디에칠렌글라이콜 (용매)

---

## 카테고리별 주요 성분 (고빈도 출제)

### 1. 중금속 및 유해 화학물질 (반드시 암기)

| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| **납** 및 그 화합물 | Lead and its compounds | - | 중금속 대표 |
| **수은** 및 그 화합물 | Mercury and its compounds | 미백(불법 사용) | 중금속 대표 / 과거 미백크림에 불법 첨가되어 금지 |
| **비소** 및 그 화합물 | Arsenic and its compounds | - | 중금속 대표 |
| **카드뮴** 및 그 화합물 | Cadmium and its compounds | - | 중금속 대표 |
| **니켈** 및 그 화합물 | Nickel and its compounds | - | 알레르기 유발 |
| 베릴륨 및 그 화합물 | Beryllium and its compounds | - | 중금속 |
| 셀렌 및 그 화합물 (셀레늄아스파테이트 제외) | Selenium and its compounds (except Selenium Aspartate) | - | 중금속 |
| 금염 | Gold salts | - | 중금속 |

### 2. 유기 용매 및 화학물질

| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| **디에칠렌글라이콜** | Diethylene Glycol | - | 용매, 신장 독성 |
| **디메칠설폭사이드** | Dimethyl Sulfoxide | - | 유기 용매 |
| **메탄올** | Methanol | - | 변성제로서만 알코올 중 5%까지 허용 |
| **벤젠** | Benzene | - | 발암성 용매 |
| **디클로로에탄(에칠렌클로라이드)** | Dichloroethane (Ethylene Chloride) | - | 발암성 용매 |
| **디클로로에칠렌(아세틸렌클로라이드)** | Dichloroethylene (Acetylene Chloride) | - | 발암성 용매 |
| **디옥산** | Dioxane | - | 발암성 용매 |
| **디에칠설페이트** | Diethyl Sulfate | - | 유기 용매 |

### 3. 발암성 물질
| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| **벤조[a]피렌** | Benzo[a]pyrene | - | 발암성 물질 대표 |
| **벤즈[a]안트라센** | Benz[a]anthracene | - | 발암성 물질 |
| 석면 | Asbestos | - | 발암성 물질 |
| 미세플라스틱 | Microplastics | - | 환경오염물질 |
| 디벤즈[a,h]안트라센 | Dibenz[a,h]anthracene | - | 발암성 물질 |

### 4. 의약품 및 마약류

| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| **날로르핀, 그 염류 및 에텔** | Nalorphine, its salts and ethers | - | 마약류 |
| **노스카핀 및 그 염류** | Noscapine and its salts | - | 진해제 |
| **니코틴 및 그 염류** | Nicotine and its salts | - | 마약류 |
| **글루코코르티코이드** | Glucocorticoids | 항염·진정(사용금지) | 스테로이드 / 진정·항염 목적 불법 첨가 사례 다수 |
| **리도카인** | Lidocaine | - | 마취제 |
| **마취제(천연 및 합성)** | Anesthetics (natural and synthetic) | - | 복합화합물 |

### 5. 염모제 관련 (예외 조건 확인 필수)
| 성분명 | 영문명 | 증상 효과 | 예외 조건 |
| -------- | -------- | - | --- |
| 2,7-나프탈렌디올 및 그 염류 | 2,7-Naphthalenediol and its salts | - | 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하 제외 |
| 1-나프톨 및 그 염류 | 1-Naphthol and its salts | - | 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하 제외 |
| 1,5-디-(베타-하이드록시에칠)아미노-2-니트로-4-클로로벤젠 및 그 염류 | 1,5-Di-(beta-hydroxyethyl)amino-2-nitro-4-chlorobenzene and its salts | - | 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.1% 이하 제외 |
| 2,6-디메톡시-3,5-피리딘디아민 하이드로클롤로라이드 | 2,6-Dimethoxy-3,5-pyridinediamine HCl | - | 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.25% 이하 제외 |
| 2,4-디아미노페녹시에탄올 하이드로클로라이드 | 2,4-Diaminophenoxyethanol HCl | - | 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.5% 이하 제외 |

### 6. 동물성 원료 (사용 불가)

| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| 돼지폐 추출물 | Pig Lung Extract | - | 동물성 원료 |
| 경막(dura mater) | Dura Mater | - | 동물성 원료 |
| 삼차신경(trigeminal ganglia) | Trigeminal Ganglia | - | 동물성 원료 |
| 척주(vertebral column) | Vertebral Column | - | 동물성 원료 |
| 편도(tonsil) | Tonsil | - | 동물성 원료 |
| 십이지장에서 직장까지의 장관(intestines from the duodenum to the rectum) | Intestines from the Duodenum to the Rectum | - | 동물성 원료 |
| 비장(spleen) | Spleen | - | 동물성 원료 |
| 부신(adrenal gland) | Adrenal Gland | - | 동물성 원료 |
| 두개골(skull) | Skull | - | 동물성 원료 |
| 뇌척수액(cerebrospinal fluid) | Cerebrospinal Fluid | - | 동물성 원료 |
| 하수체(pituitary gland) | Pituitary Gland | - | 동물성 원료 |
| 눈(eye) | Eye | - | 동물성 원료 |
| 배측근신경절(dorsal root ganglia) | Dorsal Root Ganglia | - | 동물성 원료 |
| 림프절(lymph nodes) | Lymph Nodes | - | 동물성 원료 |
| 흉선(thymus) | Thymus | - | 동물성 원료 |
| 태반(placenta) | Placenta | - | 동물성 원료 |

### 7. 기타 고빈도 성분

| 성분명 | 영문명 | 증상 효과 | 비고 |
| -------- | -------- | - | --- |
| **디클로로벤지딘** | Dichlorobenzidine | - | 니트로계 화합물 |
| **디에칠렌글라이콜** | Diethylene Glycol | - | 용매, 신장 독성 |
| **미세플라스틱** | Microplastics | - | 환경오염물질 |
| **디메칠설폭사이드** | Dimethyl Sulfoxide | - | 유기 용매 |
| **니트로벤젠** | Nitrobenzene | - | 발암성 용매 |

---
## Chapter 01 [별표 1] 사용할 수 없는 원료 (전체 목록)

> **참고:** 아래 목록은 전체 목록입니다. 위 카테고리별 주요 성분부터 학습한 후 전체 목록을 확인하세요.

| 원료명 | 영문명 | 증상 효과 | 설명 |
| -------- | -------- | - | - |
| 갈라민트리에치오다이드 | Gallamine Triethiodide | - | 근육이완제 |
| 갈란타민 | Galantamine | - | 알츠하이머 치료제 |
| 중추신경계에 작용하는 교감신경흥분성아민 | Sympathomimetic amines acting on the central nervous system | - | 중추신경계 작용제 |
| 구아네티딘 및 그 염류 | Guanethidine and its salts | - | 염류 |
| 구아이페네신 | Guaifenesin | - | 동물성 원료 |
| 글루코코르티코이드 | Glucocorticoids | 항염·진정(사용금지) | 스테로이드 / 진정·항염 목적 불법 첨가 사례 다수 |
| 글루테티미드 및 그 염류 | Glutethimide and its salts | - | 염류 |
| 글리사이클아미드 | Glycyclamide | - | 아미드류 |
| 금염 | Gold salts | - | 중금속 |
| 무기 나이트라이트(소듐나이트라이트 제외) | Inorganic nitrites (except Sodium Nitrite) | - | 질산화합물 |
| 나파졸린 및 그 염류 | Naphazoline and its salts | - | 염류 |
| 나프탈렌 | Naphthalene | - | 나프탈렌류 |
| 1,7-나프탈렌디올 | 1,7-Naphthalenediol | - | 나프탈렌류 |
| 2,3-나프탈렌디올 | 2,3-Naphthalenediol | - | 나프탈렌류 |
| 2,7-나프탈렌디올 및 그 염류 | 2,7-Naphthalenediol and its salts | - | (다만, 2,7-나프탈렌디올은 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하 제외) |
| 2-나프톨 | 2-Naphthol | - | 나프탈렌류 |
| 1-나프톨 및 그 염류 | 1-Naphthol and its salts | - | (다만, 1-나프톨은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| 3-(1-나프틸)-4-히드록시코우마린 | 3-(1-Naphthyl)-4-hydroxycoumarin | - | 나프탈렌류 |
| 1-(1-나프틸메칠)퀴놀리늄클로라이드 | 1-(1-Naphthylmethyl)quinolinium chloride | - | 알킬화합물 |
| N-2-나프틸아닐린 | N-2-Naphthylaniline | - | 아민류 화합물 |
| 1,2-나프틸아민 및 그 염류 | 1,2-Naphthylamine and its salts | - | 나프탈렌류 |
| 날로르핀, 그 염류 및 에텔 | Nalorphine, its salts and ethers | - | 마약류 |
| 납 및 그 화합물 | Lead and its compounds | - | 중금속 대표 |
| 네오디뮴 및 그 염류 | Neodymium and its salts | - | 염류 |
| 네오스티그민 및 그 염류 | Neostigmine and its salts (e.g. Neostigmine bromide) | - | (예 네오스티그민브로마이드) |
| 노나데카플루오로데카노익애씨드 | Nonadecafluorodecanoic acid | - | 할로겐화합물 |
| 노닐페놀[1]; 4-노닐페놀, 가지형[2] | Nonylphenol [1]; 4-Nonylphenol, branched [2] | - | 알킬화합물 |
| 노르아드레날린 및 그 염류 | Noradrenaline and its salts | - | 염류 |
| 노스카핀 및 그 염류 | Noscapine and its salts | - | 진해제 |
| 니그로신 스피릿 솔루블(솔벤트 블랙 5) 및 그 염류 | Nigrosine spirit soluble (Solvent Black 5) and its salts | - | 아조 염료 |
| 니켈 | Nickel | - | 알레르기 유발 |
| 니켈 디하이드록사이드 | Nickel dihydroxide | - | 알레르기 유발 |
| 니켈 디옥사이드 | Nickel dioxide | - | 알레르기 유발 |
| 니켈 모노옥사이드 | Nickel monoxide | - | 알레르기 유발 |
| 니켈 설파이드 | Nickel sulfide | - | 알레르기 유발 |
| 니켈 설페이트 | Nickel sulfate | - | 알레르기 유발 |
| 니켈 카보네이트 | Nickel carbonate | - | 알레르기 유발 |
| 니켈(Ⅱ)트리플루오로아세테이트 | Nickel(II) trifluoroacetate | - | 알레르기 유발 |
| 니코틴 및 그 염류 | Nicotine and its salts | - | 마약류 |
| 2-니트로나프탈렌 | 2-Nitronaphthalene | - | 나프탈렌류 |
| 니트로메탄 | Nitromethane | - | 질산화합물 |
| 니트로벤젠 | Nitrobenzene | - | 발암성 용매 |
| 4-니트로비페닐 | 4-Nitrobiphenyl | - | 방향족 화합물 |
| 4-니트로소페놀 | 4-Nitrosophenol | - | 페놀류 |
| 3-니트로-4-아미노페녹시에탄올 및 그 염류 | 3-Nitro-4-aminophenoxyethanol and its salts | - | 아민류 화합물 |
| 니트로스아민류비스에탄올, 니트로소디프로필아민, 디메칠니트로소아민) | Nitrosamines (e.g. 2,2'-(Nitrosoimino)bisethanol, Nitrosodipropylamine, Dimethylnitrosamine) | - | (예 2,2'-(니트로소이미노) |
| 니트로스틸벤, 그 동족체 및 유도체 | Nitrostilbenes, their homologues and derivatives | - | 질산화합물 |
| 2-니트로아니솔 | 2-Nitroanisole | - | 질산화합물 |
| 5-니트로아세나프텐 | 5-Nitroacenaphthene | - | 질산화합물 |
| 니트로크레졸 및 그 알칼리 금속염 | Nitrocresols and their alkali metal salts | - | 질산화합물 |
| 2-니트로톨루엔 | 2-Nitrotoluene | - | 니트로계 화합물 |
| 5-니트로-o-톨루이딘 및 5-니트로-o-톨루이딘 하이드로클로라이드 | 5-Nitro-o-toluidine and 5-Nitro-o-toluidine hydrochloride | - | 톨루엔류 |
| 6-니트로-o-톨루이딘 | 6-Nitro-o-toluidine | - | 톨루엔류 |
| 3-[(2-니트로-4-(트리플루오로메칠)페닐)아미노]프로판-1,2-디올(에이치시 황색 No. 6) 및 그 염류 | 3-[(2-Nitro-4-(trifluoromethyl)phenyl)amino]propane-1,2-diol (HC Yellow No. 6) and its salts | - | 아민류 화합물 |
| 4-[(4-니트로페닐)아조]아닐린(디스퍼스오렌지 3) 및 그 염류 | 4-[(4-Nitrophenyl)azo]aniline (Disperse Orange 3) and its salts | - | 아민류 화합물 |
| 2-니트로-p-페닐렌디아민 및 그 염류 | 2-Nitro-p-phenylenediamine and its salts | - | (예 니트로-p-페닐렌디아민 설페이트) |
| 4-니트로-m-페닐렌디아민 및 그 염류 | 4-Nitro-m-phenylenediamine and its salts | - | (예 p-니트로-m-페닐렌디아민 설페이트) |
| 니트로펜 | Nitrofen | - | 질산화합물 |
| 니트로퓨란계 화합물 | Nitrofuran compounds (e.g. Nitrofurantoin, Furazolidone) | - | (예 니트로푸란토인, 푸라졸리돈) |
| 2-니트로프로판 | 2-Nitropropane | - | 질산화합물 |
| 6-니트로-2,5-피리딘디아민 및 그 염류 | 6-Nitro-2,5-pyridinediamine and its salts | - | 아민류 화합물 |
| 2-니트로-N-하이드록시에칠-p-아니시딘 및 그 염류 | 2-Nitro-N-hydroxyethyl-p-anisidine and its salts | - | 알킬화합물 |
| 니트록솔린 및 그 염류 | Nitroxoline and its salts | - | 염류 |
| 다미노지드 | Daminozide | - | 농약류 |
| 다이노캡(ISO) | Dinocap (ISO) | - | 농약류 |
| 다이우론 | Diuron | - | 농약류 |
| 다투라(Datura)속 및 그 생약제제 | Datura species and their galenical preparations | - | 식물 속 |
| 데카메칠렌비스(트리메칠암모늄)염 | Decamethylenebis(trimethylammonium) salts (e.g. Decamethonium bromide) | - | (예 데카메토늄브로마이드) |
| 데쿠알리늄 클로라이드 | Dequalinium chloride | - | 할로겐화합물 |
| 덱스트로메토르판 및 그 염류 | Dextromethorphan and its salts | - | 진해제 |
| 덱스트로프로폭시펜 | Dextropropoxyphene | - | 진통제 |
| 도데카클로로펜타사이클로[5,2,1,02,6,03,9,05,8]데칸 | Dodecachloropentacyclo[5.2.1.0(2,6).0(3,9).0(5,8)]decane (Mirex) | - | 할로겐화합물 |
| 도딘 | Dodine | - | 농약류 |
| 돼지폐 추출물 | Pig Lung Extract | - | 동물성 원료 |
| 두타스테리드, 그 염류 및 유도체 | Dutasteride, its salts and derivatives | - | 염류 |
| 1,5-디-(베타-하이드록시에칠)아미노-2-니트로-4-클로로벤젠 및 그 염류 | 1,5-Di-(beta-hydroxyethyl)amino-2-nitro-4-chlorobenzene and its salts | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.1% 이하는 제외) |
| 5,5'-디-이소프로필-2,2'-디메칠비페닐-4,4'디일 디히포아이오다이트 | 5,5'-Di-isopropyl-2,2'-dimethylbiphenyl-4,4'-diyl dihypoiodite | - | 알킬화합물 |
| 디기탈리스(Digitalis)속 및 그 생약제제 | Digitalis species and their galenical preparations | - | 강심제 |
| 디노셀, 그 염류 및 에스텔류 | Dinoseb, its salts and esters | - | 염류 |
| 디노터브, 그 염류 및 에스텔류 | Dinoterb, its salts and esters | - | 염류 |
| 디니켈트리옥사이드 | Dinickel trioxide | - | 알레르기 유발 |
| 디니트로톨루엔, 테크니컬등급 | Dinitrotoluene, technical grade | - | 니트로계 화합물 |
| 2,3-디니트로톨루엔 | 2,3-Dinitrotoluene | - | 니트로계 화합물 |
| 2,5-디니트로톨루엔 | 2,5-Dinitrotoluene | - | 니트로계 화합물 |
| 2,6-디니트로톨루엔 | 2,6-Dinitrotoluene | - | 니트로계 화합물 |
| 3,4-디니트로톨루엔 | 3,4-Dinitrotoluene | - | 니트로계 화합물 |
| 3,5-디니트로톨루엔 | 3,5-Dinitrotoluene | - | 니트로계 화합물 |
| 디니트로페놀이성체 | Dinitrophenol isomers | - | 니트로계 화합물 |
| 5-[(2,4-디니트로페닐)아미노]-2-(페닐아미노)-벤젠설포닉애씨드 및 그 염류 | 5-[(2,4-Dinitrophenyl)amino]-2-(phenylamino)benzenesulfonic acid and its salts | - | 발암성 용매 |
| 디메바미드 및 그 염류 | Dimevamide and its salts | - | 염류 |
| 7,11-디메칠-4,6,10-도데카트리엔-3-온 | 7,11-Dimethyl-4,6,10-dodecatrien-3-one | - | 알킬화합물 |
| 2,6-디메칠-1,3-디옥산-4-일아세테이트(디메톡산, o-아세톡시-2,4-디메칠-m-디옥산) | 2,6-Dimethyl-1,3-dioxan-4-yl acetate (Dimethoxane) | - | 발암성 용매 |
| 4,6-디메칠-8-tert-부틸코우마린 | 4,6-Dimethyl-8-tert-butylcoumarin | - | 알킬화합물 |
| [3,3'-디메칠[1,1'-비페닐]-4,4'-디일]디암모늄비스(하이드로젠설페이트) | [3,3'-Dimethyl[1,1'-biphenyl]-4,4'-diyl]diammonium bis(hydrogen sulfate) | - | 알킬화합물 |
| 디메칠설파모일클로라이드 | Dimethylsulfamoyl chloride | - | 알킬화합물 |
| 디메칠설페이트 | Dimethyl sulfate | - | 유기 용매 |
| 디메칠설폭사이드 | Dimethyl sulfoxide | - | 유기 용매 |
| 디메칠서트라코네이트 | Dimethyl citraconate | - | 알킬화합물 |
| N,N-디메칠아닐리늄테트라키스(펜타플루오로페닐)보레이트 | N,N-Dimethylanilinium tetrakis(pentafluorophenyl)borate | - | 알킬화합물 |
| N,N-디메칠아닐린 | N,N-Dimethylaniline | - | 아민류 화합물 |
| 1-디메칠아미노메칠-1-메칠프로필벤조에이트(아밀로카인) 및 그 염류 | 1-Dimethylaminomethyl-1-methylpropyl benzoate (Amylocaine) and its salts | - | 아민류 화합물 |
| 9-(디메칠아미노)-벤조[a]페녹사진-7-이움 및 그 염류 | 9-(Dimethylamino)-benzo[a]phenoxazin-7-ium and its salts | - | 아민류 화합물 |
| 5-((4-(디메칠아미노)페닐)아조)-1,4-디메칠-1H-1,2,4-트리아졸리움 및 그 염류 | 5-((4-(Dimethylamino)phenyl)azo)-1,4-dimethyl-1H-1,2,4-triazolium and its salts | - | 아민류 화합물 |
| 디메칠아민 | Dimethylamine | - | 아민류 화합물 |
| N,N-디메칠아세타마이드 | N,N-Dimethylacetamide | - | 알킬화합물 |
| 3,7-디메칠-2-옥텐-1-올(6,7-디하이드로제라니올) | 3,7-Dimethyl-2-octen-1-ol (6,7-Dihydrogeraniol) | - | 알킬화합물 |
| 6,10-디메칠-3,5,9-운데카트리엔-2-온(슈도이오논) | 6,10-Dimethyl-3,5,9-undecatrien-2-one (Pseudoionone) | - | 알킬화합물 |
| 디메칠카바모일클로라이드 | Dimethylcarbamoyl chloride | - | 알킬화합물 |
| N,N-디메칠-p-페닐렌디아민 및 그 염류 | N,N-Dimethyl-p-phenylenediamine and its salts | - | 니트로계 화합물 |
| 1,3-디메칠펜틸아민 및 그 염류 | 1,3-Dimethylpentylamine and its salts | - | 알킬화합물 |
| 디메칠포름아미드 | Dimethylformamide | - | 알킬화합물 |
| N,N-디메칠-2,6-피리딘디아민 및 그 염산염 | N,N-Dimethyl-2,6-pyridinediamine and its hydrochloride | - | 아민류 화합물 |
| N,N'-디메칠-N-하이드록시에칠-3-니트로-p-페닐렌디아민 및 그 염류 | N,N'-Dimethyl-N-hydroxyethyl-3-nitro-p-phenylenediamine and its salts | - | 아민류 화합물 |
| 2-(2-(2,4-디메톡시페닐)아미노)에테닐]-1,3,3-트리메칠-3H-인돌리움 및 그 염류 | 2-[2-[(2,4-Dimethoxyphenyl)amino]ethenyl]-1,3,3-trimethyl-3H-indolium and its salts | - | 아민류 화합물 |
| 디바나듐펜타옥사이드 | Divanadium pentaoxide | - | 산화물 |
| 디벤즈[a,h]안트라센 | Dibenz[a,h]anthracene | - | 발암성 물질 |
| 2,2-디브로모-2-니트로에탄올 | 2,2-Dibromo-2-nitroethanol | - | 할로겐화합물 |
| 1,2-디브로모-2,4-디시아노부탄(메칠디브로모글루타로나이트릴) | 1,2-Dibromo-2,4-dicyanobutane (Methyldibromoglutaronitrile) | - | 알킬화합물 |
| 디브로모살리실아닐리드 | Dibromosalicylanilide | - | 할로겐화합물 |
| 2,6-디브로모-4-시아노페닐 옥타노에이트 | 2,6-Dibromo-4-cyanophenyl octanoate | - | 할로겐화합물 |
| 1,2-디브로모에탄 | 1,2-Dibromoethane | - | 유기 용매 |
| 1,2-디브로모-3-클로로프로판 | 1,2-Dibromo-3-chloropropane | - | 유기 용매 |
| 5-(α,β-디브로모페닐)-5-메칠히단토인 | 5-(alpha,beta-Dibromophenyl)-5-methylhydantoin | - | 알킬화합물 |
| 2,3-디브로모프로판-1-올 | 2,3-Dibromopropan-1-ol | - | 할로겐화합물 |
| 3,5-디브로모-4-하이드록시벤조니트닐 및 그 염류(브로목시닐 및 그 염류) | 3,5-Dibromo-4-hydroxybenzonitrile and its salts (Bromoxynil and its salts) | - | 할로겐화합물 |
| 디브롬화프로파미딘 및 그 염류(이소치아네이트 포함) | Dibromopropamidine and its salts (including isethionate) | - | 염류 |
| 디설피람 | Disulfiram | - | 농약류 |
| 디소듐[5-[[4'-[[2,6-디하이드록시-3-[(2-하이드록시-5-설포페닐)아조]페닐]아조][1,1'비페닐]-4-일]아조]살리실레이토(4-)]쿠프레이트(2-)(다이렉트브라운 95) | Disodium [5-[[4'-[[2,6-dihydroxy-3-[(2-hydroxy-5-sulfophenyl)azo]phenyl]azo][1,1'-biphenyl]-4-yl]azo]salicylato(4-)]cuprate(2-) (Direct Brown 95) | - | 방향족 화합물 |
| 디소듐 3,3'-[[1,1'-비페닐]-4,4'-디일비스(아조)]-비스(4-아미노나프탈렌-1-설포네이트)(콩고레드) | Disodium 3,3'-[[1,1'-biphenyl]-4,4'-diylbis(azo)]bis(4-aminonaphthalene-1-sulfonate) (Congo Red) | - | 아민류 화합물 |
| 디소듐 4-아미노-3-[[4'-[(2,4-디아미노페닐)아조][1,1'-비페닐]-4-일]아조]-5-하이드록시-6-(페닐아조)나프탈렌-2,7-디설포네이트(다이렉트블랙 38) | Disodium 4-amino-3-[[4'-[(2,4-diaminophenyl)azo][1,1'-biphenyl]-4-yl]azo]-5-hydroxy-6-(phenylazo)naphthalene-2,7-disulfonate (Direct Black 38) | - | 아민류 화합물 |
| 디소듐 4-(3-에톡시카르보닐-4-(5-(3-에톡시카르보닐-5-하이드록시-1-(4-설포네이토페닐)피라졸-4-일)펜타-2,4-디에닐리덴)-4,5-디하이드로-5-옥소피라졸-1-일)벤젠설포네이트 및 트리소듐 4-(3-에톡시카르보닐-4-(5-(3-에톡시카르보닐-5-하이드록시-1-(4-설포네이토페닐)피라졸-4-일) 펜타-2,4-디에닐리덴)-4,5-디하이드로-5-옥소피라졸-1-일) 펜타-2,4-디에닐리덴)-4,5-디하이드로-5-옥소피라졸-1-일)벤젠설포네이트 | Disodium 4-(3-ethoxycarbonyl-4-(5-(3-ethoxycarbonyl-5-hydroxy-1-(4-sulfonatophenyl)pyrazol-4-yl)penta-2,4-dienylidene)-4,5-dihydro-5-oxopyrazol-1-yl)benzenesulfonate and its trisodium analogue | - | 발암성 용매 |
| 디스퍼스레드 15 | Disperse Red 15 | - | 아조 염료 |
| 디스퍼스옐로우 3 | Disperse Yellow 3 | - | 아조 염료 |
| 디아놀아세글루에이트 | Deanol aceglumate | - | 농약류 |
| o-디아니시딘계 아조 염료류 | o-Dianisidine-based azo dyes | - | 아조 염료 |
| o-디아니시딘의 염(3,3'-디메톡시벤지딘의 염) | Salts of o-Dianisidine (salts of 3,3'-Dimethoxybenzidine) | - | 에테르류 |
| 3,7-디아미노-2,8-디메칠-5-페닐-페나지늄 및 그 염류 | 3,7-Diamino-2,8-dimethyl-5-phenylphenazinium and its salts | - | 아민류 화합물 |
| 3,5-디아미노-2,6-디메톡시피리딘 및 그 염류 | 3,5-Diamino-2,6-dimethoxypyridine and its salts | - | (다만, 2,6-디메톡시-3,5-피리딘디아민 하이드로클롤로라이드는 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.25% 이하는 제외) |
| 2,4-디아미노디페닐아민 | 2,4-Diaminodiphenylamine | - | 아민류 화합물 |
| 4,4'-디아미노디페닐아민 및 그 염류 | 4,4'-Diaminodiphenylamine and its salts | - | (예 4,4'-디아미노디페닐아민 설페이트) |
| 2,4-디아미노-5-메칠페네톨 및 그 염산염 | 2,4-Diamino-5-methylphenetol and its hydrochloride | - | 아민류 화합물 |
| 2,4-디아미노-5-메칠페녹시에탄올 및 그 염류 | 2,4-Diamino-5-methylphenoxyethanol and its salts | - | 아민류 화합물 |
| 4,5-디아미노-1-메칠피라졸 및 그 염산염 | 4,5-Diamino-1-methylpyrazole and its hydrochloride | - | 아민류 화합물 |
| 1,4-디아미노-2-메톡시-9,10-안트라센디온(디스퍼스레드 11) 및 그 염류 | 1,4-Diamino-2-methoxy-9,10-anthracenedione (Disperse Red 11) and its salts | - | 아민류 화합물 |
| 3,4-디아미노벤조익애씨드 | 3,4-Diaminobenzoic acid | - | 아민류 화합물 |
| 디아미노톨루엔, [4-메칠-m-페닐렌 디아민] 및 [2-메칠-m-페닐렌 디아민]의 혼합물 | Diaminotoluene, mixture of [4-methyl-m-phenylenediamine] and [2-methyl-m-phenylenediamine] | - | 아민류 화합물 |
| 2,4-디아미노페녹시에탄올 및 그 염류 | 2,4-Diaminophenoxyethanol and its salts | - | (다만, 2,4-디아미노페녹시에탄올 하이드로클로라이드는 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.5% 이하는 제외) |
| 3-[[(4-[[디아미노(페닐아조)페닐]아조]-1-나프탈레닐)아조]-N,N,N-트리메칠-벤젠아미니움 및 그 염류 | 3-[[(4-[[Diamino(phenylazo)phenyl]azo]-1-naphthalenyl)azo]-N,N,N-trimethylbenzenaminium and its salts | - | 발암성 용매 |
| 3-[[(4-[[디아미노(페닐아조)페닐]아조]-2-메칠페닐)아조]-N,N,N-트리메칠-벤젠아미니움 및 그 염류 | 3-[[(4-[[Diamino(phenylazo)phenyl]azo]-2-methylphenyl)azo]-N,N,N-trimethylbenzenaminium and its salts | - | 발암성 용매 |
| 2,4-디아미노페닐에탄올 및 그 염류 | 2,4-Diaminophenylethanol and its salts | - | 아민류 화합물 |
| O,O'-디아세틸-N-알릴-N-노르몰핀 | O,O'-Diacetyl-N-allyl-N-normorphine | - | 디-화합물 |
| 디아조메탄 | Diazomethane | - | 아조 염료 |
| 디알레이트 | Diallate | - | 에스테르류 |
| 디에칠-4-니트로페닐포스페이트 | Diethyl-4-nitrophenyl phosphate | - | 알킬화합물 |
| O,O'-디에칠-O-4-니트로페닐포스포치오에이트(파라치온-ISO) | O,O'-Diethyl O-4-nitrophenyl phosphorothioate (Parathion-ISO) | - | 알킬화합물 |
| 디에칠렌글라이콜 | Diethylene Glycol (except as a non-intentional residue at 0.1% or less) | - | (다만, 비의도적 잔류물로서 0.1% 이하인 경우는 제외) |
| 디에칠말리에이트 | Diethyl maleate | - | 알킬화합물 |
| 디에칠설페이트 | Diethyl sulfate | - | 유기 용매 |
| 2-디에칠아미노에칠-3-히드록시-4-페닐벤조에이트 및 그 염류 | 2-Diethylaminoethyl-3-hydroxy-4-phenylbenzoate and its salts | - | 아민류 화합물 |
| 4-디에칠아미노-o-톨루이딘 및 그 염류 | 4-Diethylamino-o-toluidine and its salts | - | 아민류 화합물 |
| N-[4-[[4-(디에칠아미노)페닐][4-(에칠아미노)-1-나프탈레닐메칠렌]-2,5-사이클로헥사디엔-1-일리딘]-N-에칠-에탄아미늄 및 그 염류 | N-[4-[[4-(Diethylamino)phenyl][4-(ethylamino)-1-naphthalenyl]methylene]-2,5-cyclohexadien-1-ylidene]-N-ethylethanaminium and its salts | - | 아민류 화합물 |
| N-(4-[(4-(디에칠아미노)페닐)페닐메칠렌]-2,5-사이클로헥사디엔-1-일리덴)-N-에칠 에탄아미니움 및 그 염류 | N-(4-[(4-(Diethylamino)phenyl)phenylmethylene]-2,5-cyclohexadien-1-ylidene)-N-ethylethanaminium and its salts | - | 아민류 화합물 |
| N,N-디에칠-m-아미노페놀 | N,N-Diethyl-m-aminophenol | - | 아민류 화합물 |
| 3-디에칠아미노프로필신나메이트 | 3-Diethylaminopropyl cinnamate | - | 아민류 화합물 |
| 디에칠카르바모일 클로라이드 | Diethylcarbamoyl chloride | - | 알킬화합물 |
| N,N-디에칠-p-페닐렌디아민 및 그 염류 | N,N-Diethyl-p-phenylenediamine and its salts | - | 니트로계 화합물 |
| 디엔오시(DNOC, 4,6-디니트로-o-크레졸) | DNOC (4,6-Dinitro-o-cresol) | - | 질산화합물 |
| 디엘드린 | Dieldrin | - | 농약류 |
| 디옥산 | Dioxane | - | 발암성 용매 |
| 디옥세테드린 및 그 염류 | Dioxethedrin and its salts | - | 염류 |
| 5-(2,4-디옥소-1,2,3,4-테트라하이드로피리미딘)-3-플루오로-2-하이드록시메칠테트라하이드로퓨란 | 5-(2,4-Dioxo-1,2,3,4-tetrahydropyrimidin-5-yl)-3-fluoro-2-hydroxymethyltetrahydrofuran | - | 알킬화합물 |
| 디치오-2,2'-비스피리딘-디옥사이드 1,1'(트리하이드레이티드마그네슘설페이트 부가)(피리치온디설파이드+마그네슘설페이트) | Dithio-2,2'-bispyridine dioxide 1,1' (with added trihydrated magnesium sulfate) (Pyrithione disulfide + magnesium sulfate) | - | 케톤류 화합물 |
| 디코우마롤 | Dicoumarol | - | 쿠마린류 |
| 2,3-디클로로-2-메칠부탄 | 2,3-Dichloro-2-methylbutane | - | 알킬화합물 |
| 1,4-디클로로벤젠(p-디클로로벤젠) | 1,4-Dichlorobenzene (p-Dichlorobenzene) | - | 발암성 용매 |
| 3,3'-디클로로벤지딘 | 3,3'-Dichlorobenzidine | - | 니트로계 화합물 |
| 3,3'-디클로로벤지딘디하이드로겐비스(설페이트) | 3,3'-Dichlorobenzidine dihydrogen bis(sulfate) | - | 니트로계 화합물 |
| 3,3'-디클로로벤지딘디하이드로클로라이드 | 3,3'-Dichlorobenzidine dihydrochloride | - | 니트로계 화합물 |
| 3,3'-디클로로벤지딘설페이트 | 3,3'-Dichlorobenzidine sulfate | - | 니트로계 화합물 |
| 1,4-디클로로부트-2-엔 | 1,4-Dichlorobut-2-ene | - | 할로겐화합물 |
| 2,2'-[(3,3'-디클로로[1,1'-비페닐]-4,4'-디일)비스(아조)]비스[3-옥소-N-페닐부탄아마이드](피그먼트엘로우 12) 및 그 염류 | 2,2'-[(3,3'-Dichloro[1,1'-biphenyl]-4,4'-diyl)bis(azo)]bis[3-oxo-N-phenylbutanamide] (Pigment Yellow 12) and its salts | - | 할로겐화합물 |
| 디클로로살리실아닐리드 | Dichlorosalicylanilide | - | 할로겐화합물 |
| 디클로로에칠렌(아세틸렌클로라이드) | Dichloroethylene (Acetylene chloride) (e.g. Vinylidene chloride) | - | (예 비닐리덴클로라이드) |
| 디클로로에탄(에칠렌클로라이드) | Dichloroethane (Ethylene chloride) | - | 발암성 용매 |
| 디클로로-m-크시레놀 | Dichloro-m-xylenol | - | 할로겐화합물 |
| α,α-디클로로톨루엔 | alpha,alpha-Dichlorotoluene | - | 할로겐화합물 |
| 디클로로펜 | Dichlorophen | - | 할로겐화합물 |
| 1,3-디클로로프로판-2-올 | 1,3-Dichloropropan-2-ol | - | 할로겐화합물 |
| 2,3-디클로로프로펜 | 2,3-Dichloropropene | - | 할로겐화합물 |
| 디페녹시레이트 히드로클로라이드 | Diphenoxylate hydrochloride | - | 할로겐화합물 |
| 1,3-디페닐구아니딘 | 1,3-Diphenylguanidine | - | 방향족 화합물 |
| 디페닐아민 | Diphenylamine | - | 방향족 화합물 |
| 디페닐에텔; 옥타브로모 유도체 | Diphenyl ether; octabromo derivative | - | 할로겐화합물 |
| 5,5-디페닐-4-이미다졸리돈 | 5,5-Diphenyl-4-imidazolidinone | - | 방향족 화합물 |
| 디펜클록사진 | Diphenchloxazine | - | 항히스타민제 |
| 2,3-디하이드로-2,2-디메칠-6-[(4-페닐아조)-1-나프틸레닐)아조]-1H-피리미딘(솔벤트블랙 3) 및 그 염류 | 2,3-Dihydro-2,2-dimethyl-6-[(4-(phenylazo)-1-naphthalenyl)azo]-1H-pyrimidine (Solvent Black 3) and its salts | - | 알킬화합물 |
| 3,4-디히드로-2-메톡시-2-메칠-4-페닐-2H,5H,피라노(3,2-c)-(1)벤조피란-5-온(시클로코우마롤) | 3,4-Dihydro-2-methoxy-2-methyl-4-phenyl-2H,5H-pyrano[3,2-c][1]benzopyran-5-one (Cyclocoumarol) | - | 알킬화합물 |
| 2,3-디하이드로-2H-1,4-벤족사진-6-올 및 그 염류 | 2,3-Dihydro-2H-1,4-benzoxazin-6-ol and its salts (Hydroxybenzomorpholine) | - | (다만, 히드록시벤조모르폴린은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하는 제외) |
| 2,3-디하이드로-1H-인돌-5,6-디올(디하이드록시인돌린) 및 그 하이드로브로마이드염(디하이드록시인돌린 하이드로브롬마이드) | 2,3-Dihydro-1H-indole-5,6-diol (Dihydroxyindoline) and its hydrobromide salt | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| (S)-2,3-디하이드로-1H-인돌-카복실릭 애씨드 | (S)-2,3-Dihydro-1H-indole-carboxylic acid | - | 카르복실산류 |
| 디히드로타키스테롤 | Dihydrotachysterol | - | 스테로이드 |
| 2,6-디하이드록시-3,4-디메칠피리딘 및 그 염류 | 2,6-Dihydroxy-3,4-dimethylpyridine and its salts | - | 알킬화합물 |
| 2,4-디하이드록시-3-메칠벤즈알데하이드 | 2,4-Dihydroxy-3-methylbenzaldehyde | - | 알킬화합물 |
| 4,4'-디히드록시-3,3'-(3-메칠치오프로필아이덴)디코우마린 | 4,4'-Dihydroxy-3,3'-(3-methylthiopropylidene)dicoumarin | - | 알킬화합물 |
| 2,6-디하이드록시-4-메칠피리딘 및 그 염류 | 2,6-Dihydroxy-4-methylpyridine and its salts | - | 알킬화합물 |
| 1,4-디하이드록시-5,8-비스[(2-하이드록시에칠)아미노]안트라퀴논(디스퍼스블루 7) 및 그 염류 | 1,4-Dihydroxy-5,8-bis[(2-hydroxyethyl)amino]anthraquinone (Disperse Blue 7) and its salts | - | 아민류 화합물 |
| 4-[4-(1,3-디하이드록시프로프-2-일)페닐아미노-1,8-디하이드록시-5-니트로안트라퀴논 | 4-[4-(1,3-Dihydroxyprop-2-yl)phenylamino]-1,8-dihydroxy-5-nitroanthraquinone | - | 아민류 화합물 |
| 2,2'-디히드록시-3,3'5,5',6,6'-헥사클로로디페닐메탄(헥사클로로펜) | 2,2'-Dihydroxy-3,3',5,5',6,6'-hexachlorodiphenylmethane (Hexachlorophene) | - | 할로겐화합물 |
| 디하이드로코우마린 | Dihydrocoumarin | - | 쿠마린류 |
| N,N'-디헥사데실-N,N'-비스(2-하이드록시에칠)프로판디아마이드; 비스하이드록시에칠비스세틸말론아마이드 | N,N'-Dihexadecyl-N,N'-bis(2-hydroxyethyl)propanediamide; Bishydroxyethyl biscetyl malonamide | - | 알킬화합물 |
| Laurus nobilis L.의 씨로부터 나온 오일 | Oil from the seeds of Laurus nobilis L. | - | 케톤류 화합물 |
| Rauwolfia serpentina 알칼로이드 및 그 염류 | Rauwolfia serpentina alkaloids and their salts | - | 염류 |
| 라가식애씨드(CI 내추럴레드 25) 및 그 염류 | Laccaic acid (CI Natural Red 25) and its salts | - | 카르복실산류 |
| 래출시놀 디글리시딜 에텔 | Resorcinol diglycidyl ether | - | 에테르류 |
| 로다민 B 및 그 염류 | Rhodamine B and its salts | - | 아조 염료 |
| 로벨리아(Lobelia)속 및 그 생약제제 | Lobelia species and their galenical preparations | - | 식물 속 |
| 로벨린 및 그 염류 | Lobeline and its salts | - | 염류 |
| 리누본 | Linuron | - | 농약류 |
| 리도카인 | Lidocaine | - | 마취제 |
| 과산화물가가 20mmol/L을 초과하는 d-리모넨 | d-Limonene with a peroxide value exceeding 20 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 20mmol/L을 초과하는 dl-리모넨 | dl-Limonene with a peroxide value exceeding 20 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 20mmol/L을 초과하는 ℓ-리모넨 | l-Limonene with a peroxide value exceeding 20 mmol/L | - | 산화안정성 관련 |
| 라이서자이드(Lysergide) 및 그 염류 | Lysergide (LSD) and its salts | - | 염류 |
| 「마약류 관리에 관한 법률」제2조에 따른 마약류 | Narcotics as defined by the Act on the Control of Narcotics, etc. | - | (다만, 같은 법 제2조제4호 단서에 따른 대마씨유 및 대마씨추출물의 테트라하이드로칸나비놀 및 칸나비디올에 대하여는 「식품의 기준 및 규격」에서 정한 기준에 적합한 경우는 제외) |
| 마이크로부타닐(2-(4-클로로페닐)-2-(1H-1,2,4-트리아졸-1-일메칠)헥사네니트릴) | Myclobutanil (2-(4-Chlorophenyl)-2-(1H-1,2,4-triazol-1-ylmethyl)hexanenitrile) | - | 알킬화합물 |
| 마취제(천연 및 합성) | Anesthetics (natural and synthetic) | - | 복합화합물 |
| 만노무스틴 및 그 염류 | Mannomustine and its salts | - | 염류 |
| 말라카이트그린 및 그 염류 | Malachite Green and its salts | - | 아조 염료 |
| 말로노니트릴 | Malononitrile | - | 시아네이트류 |
| 1-메칠-3-니트로-1-니트로소구아니딘 | 1-Methyl-3-nitro-1-nitrosoguanidine | - | 알킬화합물 |
| 1-메칠-3-니트로-4-(베타-하이드록시에칠)아미노벤젠 및 그 염류 | 1-Methyl-3-nitro-4-(beta-hydroxyethyl)aminobenzene and its salts (Hydroxyethyl-2-nitro-p-toluidine) | - | (다만, 하이드록시에칠-2-니트로-p-톨루이딘은 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하는 제외) |
| N-메칠-3-니트로-p-페닐렌디아민 및 그 염류 | N-Methyl-3-nitro-p-phenylenediamine and its salts | - | 아민류 화합물 |
| N-메칠-1,4-디아미노안트라퀴논, 에피클로히드린 및 모노에탄올아민의 반응생성물(에이치시 청색 No. 4) 및 그 염류 | Reaction product of N-Methyl-1,4-diaminoanthraquinone, epichlorohydrin and monoethanolamine (HC Blue No. 4) and its salts | - | 아민류 화합물 |
| 3,4-메칠렌디옥시페놀 및 그 염류 | 3,4-Methylenedioxyphenol and its salts | - | 알킬화합물 |
| 메칠레소르신 | Methylresorcinol | - | 알킬화합물 |
| 메칠렌글라이콜 | Methylene glycol | - | 알킬화합물 |
| 4,4'-메칠렌디아닐린 | 4,4'-Methylenedianiline | - | 아민류 화합물 |
| 3,4-메칠렌디옥시아닐린 및 그 염류 | 3,4-Methylenedioxyaniline and its salts | - | 아민류 화합물 |
| 4,4'-메칠렌디-o-톨루이딘 | 4,4'-Methylenedi-o-toluidine | - | 알킬화합물 |
| 4,4'-메칠렌비스(2-에칠아닐린) | 4,4'-Methylenebis(2-ethylaniline) | - | 아민류 화합물 |
| (메칠렌비스(4,1-페닐렌아조(1-(3-(디메칠아미노)프로필)-1,2-디하이드로-6-하이드록시-4-메칠-2-옥소피리딘-5,3-디일))-1,1'-디피리디늄디클로라이드 디하이드로클로라이드 | (Methylenebis(4,1-phenyleneazo(1-(3-(dimethylamino)propyl)-1,2-dihydro-6-hydroxy-4-methyl-2-oxopyridine-5,3-diyl)))-1,1'-dipyridinium dichloride dihydrochloride | - | 아민류 화합물 |
| 4,4'-메칠렌비스[2-(4-하이드록시벤질)-3,6-디메칠페놀]과 6-디아조-5,6-디하이드로-5-옥소-나프탈렌설포네이트(1:2)의 반응생성물과 4,4'-메칠렌비스[2-(4-하이드록시벤질)-3,6-디메칠페놀]과 6-디아조-5,6-디하이드로-5-옥소-나프탈렌설포네이트(1:3) 반응생성물과의 혼합물 | Reaction products of 4,4'-methylenebis[2-(4-hydroxybenzyl)-3,6-dimethylphenol] with 6-diazo-5,6-dihydro-5-oxo-naphthalenesulfonate (1:2 and 1:3 mixture) | - | 알킬화합물 |
| 메칠렌클로라이드 | Methylene chloride | - | 유기 용매 |
| 3-(N-메칠-N-(4-메칠아미노-3-니트로페닐)아미노)프로판-1,2-디올 및 그 염류 | 3-(N-Methyl-N-(4-methylamino-3-nitrophenyl)amino)propane-1,2-diol and its salts | - | 아민류 화합물 |
| 메칠메타크릴레이트모노머 | Methyl methacrylate monomer | - | 알킬화합물 |
| 메칠 트랜스-2-부테노에이트 | Methyl trans-2-butenoate | - | 알킬화합물 |
| 2-[3-(메칠아미노)-4-니트로페녹시]에탄올 및 그 염류 | 2-[3-(Methylamino)-4-nitrophenoxy]ethanol and its salts | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.15% 이하는 제외) |
| N-메칠아세타마이드 | N-Methylacetamide | - | 알킬화합물 |
| (메칠-ONN-아조시)메칠아세테이트 | (Methyl-ONN-azoxy)methyl acetate | - | 알킬화합물 |
| 2-메칠아지리딘(프로필렌이민) | 2-Methylaziridine (Propyleneimine) | - | 알킬화합물 |
| 메칠옥시란 | Methyloxirane | - | 알킬화합물 |
| 메칠유게놀 | Methyl eugenol | - | (다만, 식물 추출물에 의하여 자연적으로 함유되어 다음 농도 이하인 경우는 제외. 향료원액을 8% 초과하여 함유하는 제품 0.01%, 향료원액을 8% 이하로 함유하는 제품 0.004%, 방향용 크림 0.002%, 사용 후 씻어내는 제품 0.001%, 기타 0.0002%) |
| N,N'-((메칠이미노)디에칠렌))비스(에칠디메칠암모늄) 염류 | N,N'-((Methylimino)diethylene)bis(ethyldimethylammonium) salts (e.g. Azamethonium bromide) | - | (예 아자메토늄브로마이드) |
| 메칠이소시아네이트 | Methyl isocyanate | - | 알킬화합물 |
| 6-메칠쿠마린(6-MC) | 6-Methylcoumarin (6-MC) | - | 알킬화합물 |
| 7-메칠쿠마린 | 7-Methylcoumarin | - | 알킬화합물 |
| 메칠크레속심 | Kresoxim-methyl | - | 알킬화합물 |
| 1-메칠-2,4,5-트리하이드록시벤젠 및 그 염류 | 1-Methyl-2,4,5-trihydroxybenzene and its salts | - | 발암성 용매 |
| 메칠페니데이트 및 그 염류 | Methylphenidate and its salts | - | 알킬화합물 |
| 3-메칠-1-페닐-5-피라졸론 및 그 염류 | 3-Methyl-1-phenyl-5-pyrazolone and its salts (Phenyl methyl pyrazolone) | - | (다만, 페닐메칠피라졸론은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.25% 이하는 제외) |
| 메칠페닐렌디아민류, 그 N-치환 유도체류 및 그 염류 | Methylphenylenediamines, their N-substituted derivatives and their salts | - | (다만, 염모제에서 염모성분으로 사용하는 것은 제외하되, 2,6-디하이드록시에칠아미노톨루엔의 경우 용법·용량에 따른 혼합물의 염모성분으로서 1.0% 이하이고 니트로화제를 함유하고 있는 제품에는 사용할 수 없으며 총 니트로사민은 50ppb를 넘지 않아야 함) |
| 황산 o-클로로-p-페닐렌디아민 | o-Chloro-p-phenylenediamine sulfate | - | 아민류 화합물 |
| 2-메칠-m-페닐렌 디이소시아네이트 | 2-Methyl-m-phenylene diisocyanate | - | 알킬화합물 |
| 4-메칠-m-페닐렌 디이소시아네이트 | 4-Methyl-m-phenylene diisocyanate | - | 알킬화합물 |
| 4,4'-[(4-메칠-1,3-페닐렌)비스(아조)]비스[6-메칠-1,3-벤젠디아민](베이직브라운 4) 및 그 염류 | 4,4'-[(4-Methyl-1,3-phenylene)bis(azo)]bis[6-methyl-1,3-benzenediamine] (Basic Brown 4) and its salts | - | 발암성 용매 |
| 4-메칠-6-(페닐아조)-1,3-벤젠디아민 및 그 염류 | 4-Methyl-6-(phenylazo)-1,3-benzenediamine and its salts | - | 발암성 용매 |
| N-메칠포름아마이드 | N-Methylformamide | - | 알킬화합물 |
| 5-메칠-2,3-헥산디온 | 5-Methyl-2,3-hexanedione | - | 알킬화합물 |
| 2-메칠헵틸아민 및 그 염류 | 2-Methylheptylamine and its salts | - | 알킬화합물 |
| 메카밀아민 | Mecamylamine | - | 교감신경 차단제 |
| 메타닐엘로우 | Metanil Yellow | - | 항생제 |
| 메탄올(에탄올 및 이소프로필알콜의 변성제로서만 알콜 중 5%까지 사용) | Methanol (used only as a denaturant for ethanol and isopropyl alcohol, up to 5% in the alcohol) | - | 유기 용매 |
| 메테토헵타진 및 그 염류 | Metethoheptazine and its salts | - | 염류 |
| 메토카바몰 | Methocarbamol | - | 근육이완제 |
| 메토트렉세이트 | Methotrexate | - | 항암제 |
| 2-메톡시-4-니트로페놀(4-니트로구아이아콜) 및 그 염류 | 2-Methoxy-4-nitrophenol (4-Nitroguaiacol) and its salts | - | 페놀류 |
| 2-[(2-메톡시-4-니트로페닐)아미노]에탄올 및 그 염류 | 2-[(2-Methoxy-4-nitrophenyl)amino]ethanol and its salts | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.2% 이하는 제외) |
| 1-메톡시-2,4-디아미노벤젠(2,4-디아미노아니솔 또는 4-메톡시-m-페닐렌디아민 또는 CI76050) 및 그 염류 | 1-Methoxy-2,4-diaminobenzene (2,4-Diaminoanisole or 4-Methoxy-m-phenylenediamine or CI 76050) and its salts | - | 발암성 용매 |
| 1-메톡시-2,5-디아미노벤젠(2,5-디아미노아니솔) 및 그 염류 | 1-Methoxy-2,5-diaminobenzene (2,5-Diaminoanisole) and its salts | - | 발암성 용매 |
| 2-메톡시메칠-p-아미노페놀 및 그 염산염 | 2-Methoxymethyl-p-aminophenol and its hydrochloride | - | 아민류 화합물 |
| 6-메톡시-N2-메칠-2,3-피리딘디아민 하이드로클로라이드 및 디하이드로클로라이드염 | 6-Methoxy-N2-methyl-2,3-pyridinediamine hydrochloride and dihydrochloride | - | (다만, 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로 산으로서 0.68% 이하, 디하이드로클로라이드염으로서 1.0% 이하는 제외) |
| 2-(4-메톡시벤질-N-(2-피리딜)아미노)에칠디메칠아민말리에이트 | 2-(4-Methoxybenzyl-N-(2-pyridyl)amino)ethyldimethylamine maleate | - | 아민류 화합물 |
| 메톡시아세틱애씨드 | Methoxyacetic acid | - | 카르복실산류 |
| 2-메톡시에칠아세테이트(메톡시에탄올아세테이트) | 2-Methoxyethyl acetate (Methoxyethanol acetate) | - | 알킬화합물 |
| N-(2-메톡시에칠)-p-페닐렌디아민 및 그 염산염 | N-(2-Methoxyethyl)-p-phenylenediamine and its hydrochloride | - | 아민류 화합물 |
| 2-메톡시에탄올(에칠렌글리콜 모노에칠에텔, EGMME) | 2-Methoxyethanol (Ethylene glycol monomethyl ether, EGMME) | - | 유기 용매 |
| 2-(2-메톡시에톡시)에탄올(메톡시디글리콜) | 2-(2-Methoxyethoxy)ethanol (Methoxydiglycol) | - | 에테르류 |
| 7-메톡시쿠마린 | 7-Methoxycoumarin | - | 쿠마린류 |
| 4-메톡시톨루엔-2,5-디아민 및 그 염산염 | 4-Methoxytoluene-2,5-diamine and its hydrochloride | - | 아민류 화합물 |
| 6-메톡시-m-톨루이딘(p-크레시딘) | 6-Methoxy-m-toluidine (p-Cresidine) | - | 톨루엔류 |
| 2-[[(4-메톡시페닐)메칠하이드라조노]메칠]-1,3,3-트리메칠-3H-인돌리움 및 그 염류 | 2-[[(4-Methoxyphenyl)methylhydrazono]methyl]-1,3,3-trimethyl-3H-indolium and its salts | - | 알킬화합물 |
| 4-메톡시페놀(히드로퀴논모노메칠에텔 또는 p-히드록시아니솔) | 4-Methoxyphenol (Hydroquinone Monomethyl Ether or p-Hydroxyanisole) | 미백 | 알킬화합물 / 히드로퀴논 유도체(메퀴놀), 미백 목적 |
| 4-(4-메톡시페닐)-3-부텐-2-온(4-아니실리덴아세톤) | 4-(4-Methoxyphenyl)-3-buten-2-one (4-Anisylideneacetone) | - | 방향족 화합물 |
| 1-(4-메톡시페닐)-1-펜텐-3-온(α-메칠아니살아세톤) | 1-(4-Methoxyphenyl)-1-penten-3-one (alpha-Methylanisalacetone) | - | 알킬화합물 |
| 2-메톡시프로판올 | 2-Methoxypropanol | - | 에테르류 |
| 2-메톡시프로핌아세테이트 | 2-Methoxypropyl acetate | - | 아세트산염 |
| 6-메톡시-2,3-피리딘디아민 및 그 염산염 | 6-Methoxy-2,3-pyridinediamine and its hydrochloride | - | 아민류 화합물 |
| 메트알데히드 | Metaldehyde | - | 농약류 |
| 메트암페라몬 및 그 염류 | Metamfepramone and its salts | - | 염류 |
| 메트포르민 및 그 염류 | Metformin and its salts | - | 염류 |
| 메트헵타진 및 그 염류 | Metheptazine and its salts | - | 염류 |
| 메티라폰 | Metyrapone | - | 부신 피질 억제제 |
| 메티프릴론 및 그 염류 | Methyprylon and its salts | - | 염류 |
| 메페네신 및 그 에스텔 | Mephenesin and its esters | - | 근육이완제 |
| 메페클로라진 및 그 염류 | Mefeclorazine and its salts | - | 염류 |
| 메프로바메이트 | Meprobamate | - | 진정제 |
| 2급 아민함량이 0.5%를 초과하는 모노알킬아민, 모노알칸올아민 및 그 염류 | Monoalkylamines, monoalkanolamines and their salts containing more than 0.5% secondary amines | - | 염류 |
| 모노크로토포스 | Monocrotophos | - | 농약류 |
| 모누론 | Monuron | - | 제초제 |
| 모르포린 및 그 염류 | Morpholine and its salts | - | 염류 |
| 모스켄(1,1,3,3,5-펜타메칠-4,6-디니트로인단) | Musk moskene (1,1,3,3,5-Pentamethyl-4,6-dinitroindane) | - | 알킬화합물 |
| 모폐부타존 | Mofebutazone | - | 소염제 |
| 목향(Saussurea lappa Clarke = Saussurea costus (Falc.) Lipsch. = Aucklandia lappa Decne) 뿌리 오일 | Costus root oil (Saussurea lappa Clarke = Saussurea costus (Falc.) Lipsch. = Aucklandia lappa Decne) | - | 식물성 원료 |
| 몰리네이트 | Molinate | - | 농약류 |
| 몰포린-4-카르보닐클로라이드 | Morpholine-4-carbonyl chloride | - | 헤테로고리화합물 |
| 무화과나무(Ficus carica)잎엔솔루트(피그잎엔솔루트) | Fig leaf absolute (Ficus carica) | - | 식물성 원료 |
| 미네랄 울 | Mineral wool | - | 광유 |
| 미세플라스틱(세정, 각질제거 등의 제품에 남아있는 5mm 크기 이하의 고체플라스틱) | Microplastics (solid plastic particles 5 mm or smaller remaining in rinse-off, exfoliating and similar products) | - | 환경오염물질 |
| 바륨염(바륨설페이트 및 색소레이크회석제로 사용한 바륨염은 제외) | Barium salts (except Barium sulfate and Barium salts used as diluents for colour lakes) | - | 중금속 |
| 바비큐레이트 | Barbiturates | - | 바르비투레이트류 |
| 2,2'-바이옥시란 | 2,2'-Bioxirane | - | 에테르류 |
| 발녹트아미드 | Valnoctamide | - | 아미드류 |
| 발린아미드 | Valinamide | - | 아미드류 |
| 방사성 물질 | Radioactive substances | - | (다만, 제품에 포함된 방사능의 농도 등이 「생활주변방사선 안전관리법」제15조의 규정에 적합한 경우 제외) |
| 백신, 독소 또는 혈청 | Vaccines, toxins or sera | - | 동물성 원료 |
| 베낙티진 | Benactyzine | - | 항히스타민제 |
| 베노밀 | Benomyl | - | 농약류 |
| 베라트룸(Veratrum)속 및 그 제제 | Veratrum species and their preparations | - | 식물 속 |
| 베라트린, 그 염류 및 생약제제 | Veratrine, its salts and galenical preparations | - | 염류 |
| 베르베나 오일(Lippia citriodora Kunth.) | Verbena essential oil (Lippia citriodora Kunth.) | - | 식물성 원료 |
| 베릴륨 및 그 화합물 | Beryllium and its compounds | - | 중금속 |
| 베메그리드 및 그 염류 | Bemegride and its salts | - | 염류 |
| 베록시카인 및 그 염류 | Beroxycaine and its salts | - | 염류 |
| 베이직바이올렛 1(메칠바이올렛) | Basic Violet 1 (Methyl Violet) | - | 알킬화합물 |
| 베이직바이올렛 3(크리스탈바이올렛) | Basic Violet 3 (Crystal Violet) | - | 아조 염료 |
| 1-(베타-우레이도에칠)아미노-4-니트로벤젠 및 그 염류 | 1-(beta-Ureidoethyl)amino-4-nitrobenzene and its salts (4-Nitrophenyl aminoethylurea) | - | (다만, 4-니트로페닐 아미노에칠우레아는 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.25% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.5% 이하는 제외) |
| 1-(베타-하이드록시)아미노-2-니트로-4-N-에칠-N-(베타-하이드록시에칠)아미노벤젠 및 그 염류 | 1-(beta-Hydroxy)amino-2-nitro-4-N-ethyl-N-(beta-hydroxyethyl)aminobenzene and its salts (HC Blue No. 13) | - | (예 에이치시 청색 No. 13) |
| 벤드로클루메치아자이드 및 그 유도체 | Bendroflumethiazide and its derivatives | - | 이뇨제 |
| 벤젠 | Benzene | - | 발암성 용매 |
| 1,2-벤젠디카르복실릭애씨드 디펜틸에스터(가지형과 직선형); n-펜틸-이소펜틸 프탈레이트; 디-n-펜틸프탈레이트; 디이소펜틸프탈레이트 | 1,2-Benzenedicarboxylic acid dipentyl ester (branched and linear); n-Pentyl-isopentyl phthalate; Di-n-pentyl phthalate; Diisopentyl phthalate | - | 발암성 용매 |
| 1,2,4-벤젠트리아세테이트 및 그 염류 | 1,2,4-Benzenetriacetate and its salts | - | 발암성 용매 |
| 7-(벤조일아미노)-4-하이드록시-3-[[4-[(4-설포페닐)아조]페닐]아조]-2-나프탈렌설포닉애씨드 및 그 염류 | 7-(Benzoylamino)-4-hydroxy-3-[[4-[(4-sulfophenyl)azo]phenyl]azo]-2-naphthalenesulfonic acid and its salts | - | 아민류 화합물 |
| 벤조일퍼옥사이드 | Benzoyl peroxide | - | 산화물 |
| 벤조[a]피렌 | Benzo[a]pyrene | - | 발암성 물질 대표 |
| 벤조[e]피렌 | Benzo[e]pyrene | - | 발암성 물질 |
| 벤조[j]플루오란텐 | Benzo[j]fluoranthene | - | 발암성 물질 |
| 벤조[k]플루오란텐 | Benzo[k]fluoranthene | - | 발암성 물질 |
| 벤조[e]아세페난트릴렌 | Benzo[e]acephenanthrylene | - | 발암성 물질 |
| 벤즈아제피린류와 벤즈디아제핀류 | Benzazepines and benzodiazepines | - | 진정제 |
| 벤즈아트로핀 및 그 염류 | Benzatropine and its salts | - | 마약류 |
| 벤즈[a]안트라센 | Benz[a]anthracene | - | 발암성 물질 |
| 벤즈이미다즐-2(3H)-온 | Benzimidazol-2(3H)-one | - | 케톤류 화합물 |
| 벤지단 | Benzidine | - | 발암성 아민 |
| 벤지단계 아조 색소류 | Benzidine-based azo dyes | - | 아조 염료 |
| 벤지단디하이드로클로라이드 | Benzidine dihydrochloride | - | 염류 |
| 벤지단설페이트 | Benzidine sulfate | - | 황산염 |
| 벤지단아세테이트 | Benzidine acetate | - | 아세트산염 |
| 벤지로늄브로마이드 | Benzilonium bromide | - | 할로겐화합물 |
| 벤질 2,4-디브로모부타노에이트 | Benzyl 2,4-dibromobutanoate | - | 할로겐화합물 |
| 3(또는 5)-[[4-(벤질메칠아미노)페닐]아조]-1,2-(또는 1,4)-디메칠-1H-1,2,4-트리아졸리움 및 그 염류 | 3(or 5)-[[4-(Benzylmethylamino)phenyl]azo]-1,2-(or 1,4-)dimethyl-1H-1,2,4-triazolium and its salts | - | 아민류 화합물 |
| 벤질바이올렛[4-[[4-[(디메칠아미노)페닐][4-[에칠(3-설포네이토벤질)아미노]페닐]메칠렌]사이클로헥사-2,5-디엔-1-일리덴(메칠)(3-설포네이토벤질)아미노]페닐]메칠렌]사이클로헥사-2,5-디엔-1-일리덴(메칠)사이클로헥사-2,5-디엔-1-일리덴]암모늄 및 소듐염) | Benzyl Violet (CI 42640) and its sodium salt | - | 아민류 화합물 |
| 벤질시아나이트 | Benzyl cyanide | - | 방향족 화합물 |
| 4-벤질옥시페놀(히드로퀴논모노벤질에텔) | 4-Benzyloxyphenol (Hydroquinone Monobenzyl Ether) | - | 방향족 화합물 |
| 2-부타논 옥심 | 2-Butanone oxime (Methyl ethyl ketoxime) | - | 케톤류 화합물 |
| 부타닐리카인 및 그 염류 | Butanilicaine and its salts | - | 염류 |
| 1,3-부타디엔 | 1,3-Butadiene | - | 발암성 물질 |
| 부토피프런 및 그 염류 | Butopiprine and its salts | - | 염류 |
| 부톡시디글리세롤 | Butoxydiglycol | - | 에테르류 |
| 부톡시에탄올 | Butoxyethanol | - | 에테르류 |
| 5-(3-부티릴-2,4,6-트리메칠페닐)-2-[1-(에톡시이미노)프로필]-3-하이드록시사이클로헥스-2-엔-1-온 | 5-(3-Butyryl-2,4,6-trimethylphenyl)-2-[1-(ethoxyimino)propyl]-3-hydroxycyclohex-2-en-1-one (Tepraloxydim) | - | 알킬화합물 |
| 부틸글리시딜에텔 | Butyl glycidyl ether | - | 알킬화합물 |
| 4-tert-부틸-3-메톡시-2,6-디니트로톨루엔(머스크암브레트) | 4-tert-Butyl-3-methoxy-2,6-dinitrotoluene (Musk ambrette) | - | 니트로계 화합물 |
| 1-부틸-3-(N-크로토노일설파닐일)우레아 | 1-Butyl-3-(N-crotonoylsulfanilyl)urea | - | 알킬화합물 |
| 5-tert-부틸-1,2,3-트리메칠-4,6-디니트로벤젠(머스크티베텐) | 5-tert-Butyl-1,2,3-trimethyl-4,6-dinitrobenzene (Musk tibetene) | - | 발암성 용매 |
| 4-tert-부틸페놀 | 4-tert-Butylphenol | - | 알킬화합물 |
| 2-(4-tert-부틸페닐)에탄올 | 2-(4-tert-Butylphenyl)ethanol | - | 알킬화합물 |
| 4-tert-부틸피로카테콜 | 4-tert-Butylpyrocatechol | - | 알킬화합물 |
| 부펙사마 | Bufexamac | - | 진정제 |
| 붕산 | Boric acid | - | 살균제 |
| 브레티륨토실레이트 | Bretylium tosilate | - | 고혈압 치료제 |
| (R)-5-브로모-3-(1-메칠-2-피롤리딘일메칠)-1H-인돌 | (R)-5-Bromo-3-(1-methyl-2-pyrrolidinylmethyl)-1H-indole | - | 알킬화합물 |
| 브로모메탄 | Bromomethane | - | 할로겐화합물 |
| 브로모에칠렌 | Bromoethylene (Vinyl bromide) | - | 알킬화합물 |
| 브로모에탄 | Bromoethane | - | 할로겐화합물 |
| 1-브로모-3,4,5-트리플루오로벤젠 | 1-Bromo-3,4,5-trifluorobenzene | - | 발암성 용매 |
| 1-브로모프로판; n-프로필 브로마이드 | 1-Bromopropane; n-Propyl bromide | - | 알킬화합물 |
| 2-브로모프로판 | 2-Bromopropane | - | 할로겐화합물 |
| 브로목시닐헵타노에이트 | Bromoxynil heptanoate | - | 농약류 |
| 브롬 | Bromine | - | 할로겐화합물 |
| 브롬이소발 | Bromisoval | - | 동물성 원료 |
| 브루신(에탄올의 변성제는 제외) | Brucine (except as a denaturant for ethanol) | - | 알콜류 |
| 비나프아크릴(2-sec-부틸-4,6-디니트로페닐-3-메칠크로토네이트) | Binapacryl (2-sec-Butyl-4,6-dinitrophenyl-3-methylcrotonate) | - | 알킬화합물 |
| 9-비닐카르바졸 | 9-Vinylcarbazole | - | 비닐화합물 |
| 비닐클로라이드모노머 | Vinyl chloride monomer | - | 비닐화합물 |
| 1-비닐-2-피롤리돈 | 1-Vinyl-2-pyrrolidone | - | 비닐화합물 |
| 비마토프로스트, 그 염류 및 유도체 | Bimatoprost, its salts and derivatives | - | 염류 |
| 비소 및 그 화합물 | Arsenic and its compounds | - | 중금속 대표 |
| 1,1-비스(디메칠아미노메칠)프로필벤조에이트(아미드리카인, 알리핀) 및 그 염류 | 1,1-Bis(dimethylaminomethyl)propyl benzoate (Amydricaine, Alypine) and its salts | - | 아민류 화합물 |
| 4,4'-비스(디메칠아미노)벤조페논 | 4,4'-Bis(dimethylamino)benzophenone (Michler's ketone) | - | 아민류 화합물 |
| 3,7-비스(디메칠아미노)-페노치아진-5-이움 및 그 염류 | 3,7-Bis(dimethylamino)phenothiazin-5-ium and its salts | - | 아민류 화합물 |
| 3,7-비스(디에칠아미노)-페녹사진-5-이움 및 그 염류 | 3,7-Bis(diethylamino)phenoxazin-5-ium and its salts | - | 아민류 화합물 |
| N-(4-[비스[4-(디에칠아미노)페닐]메칠렌]-2,5-사이클로헥사디엔-1-일리덴)-N-에칠-에탄아미니움 및 그 염류 | N-(4-[Bis[4-(diethylamino)phenyl]methylene]-2,5-cyclohexadien-1-ylidene)-N-ethylethanaminium and its salts | - | 아민류 화합물 |
| 비스(2-메톡시에칠)에텔(디메톡시디글리콜) | Bis(2-methoxyethyl) ether (Dimethoxydiglycol) | - | 알킬화합물 |
| 비스(2-메톡시에칠)프탈레이트 | Bis(2-methoxyethyl) phthalate | - | 내분비계 교란물질 |
| 1,2-비스(2-메톡시에톡시)에탄; 트리에칠렌글리콜 디메칠 에텔(TEGDME); 트리글라임 | 1,2-Bis(2-methoxyethoxy)ethane; Triethylene glycol dimethyl ether (TEGDME); Triglyme | - | 유기 용매 |
| 1,3-비스(비닐설포닐아세타아미도)-프로판 | 1,3-Bis(vinylsulfonylacetamido)propane | - | 설포화합물 |
| 비스(사이클로펜타디에닐)-비스(2,6-디플루오로-3-(피롤-1-일)-페닐)티타늄 | Bis(cyclopentadienyl)-bis(2,6-difluoro-3-(pyrrol-1-yl)phenyl)titanium | - | 할로겐화합물 |
| 4-[[비스-(4-플루오로페닐)메칠실릴]메칠]-4H-1,2,4-트리아졸과 1-[[비스-(4-플루오로페닐)메칠실릴]메칠]-1H-1,2,4-트리아졸의 혼합물 | Mixture of 4-[[bis-(4-fluorophenyl)methylsilyl]methyl]-4H-1,2,4-triazole and 1-[[bis-(4-fluorophenyl)methylsilyl]methyl]-1H-1,2,4-triazole (Flusilazole) | - | 알킬화합물 |
| 비스(클로로메칠)에텔(옥시비스[클로로메탄]) | Bis(chloromethyl) ether (Oxybis[chloromethane]) | - | 알킬화합물 |
| N,N-비스(2-클로로에칠)메칠아민-N-옥사이드 및 그 염류 | N,N-Bis(2-chloroethyl)methylamine-N-oxide and its salts | - | 아민류 화합물 |
| 비스(2-클로로에칠)에텔 | Bis(2-chloroethyl) ether | - | 알킬화합물 |
| 비스페놀 A(4,4'-이소프로필리덴디페놀) | Bisphenol A (4,4'-Isopropylidenediphenol) | - | 내분비계 교란물질 |
| N'N'-비스(2-히드록시에칠)-N-메칠-2-니트로-p-페닐렌디아민(HC 블루 No.1) 및 그 염류 | N,N'-Bis(2-hydroxyethyl)-N-methyl-2-nitro-p-phenylenediamine (HC Blue No. 1) and its salts | - | 아민류 화합물 |
| 4,6-비스(2-하이드록시에톡시)-m-페닐렌디아민 및 그 염류 | 4,6-Bis(2-hydroxyethoxy)-m-phenylenediamine and its salts | - | 아민류 화합물 |
| 2,6-비스(2-히드록시에톡시)-3,5-피리딘디아민 및 그 염산염 | 2,6-Bis(2-hydroxyethoxy)-3,5-pyridinediamine and its hydrochloride | - | 아민류 화합물 |
| 비에타미베린 | Bietamiverine | - | 식물성 원료 |
| 비치오놀 | Bithionol | - | 비타민류 |
| 비타민 L₁, L₂ | Vitamin L1, L2 | - | 비타민류 |
| [1,1'-비페닐-4,4'-디일]디암모늄설페이트 | [1,1'-Biphenyl-4,4'-diyl]diammonium sulfate | - | 방향족 화합물 |
| 비페닐-2-일아민 | Biphenyl-2-ylamine | - | 방향족 화합물 |
| 비페닐-4-일아민 및 그 염류 | Biphenyl-4-ylamine and its salts | - | 방향족 화합물 |
| 4,4'-비-o-톨루이딘 | 4,4'-Bi-o-toluidine (o-Tolidine) | - | 톨루엔류 |
| 4,4'-비-o-톨루이딘디하이드로클로라이드 | 4,4'-Bi-o-toluidine dihydrochloride | - | 톨루엔류 |
| 4,4'-비-o-톨루이딘설페이트 | 4,4'-Bi-o-toluidine sulfate | - | 황산염 |
| 빈클로졸린 | Vinclozolin | - | 농약류 |
| 사이클라멘알코올 | Cyclamen alcohol | - | 고리형 화합물 |
| N-사이클로렌틸-m-아미노페놀 | N-Cyclopentyl-m-aminophenol | - | 아민류 화합물 |
| 사이클로헥시미드 | Cycloheximide | - | 고리형 화합물 |
| N-사이클로헥실-N-메톡시-2,5-디메칠-3-퓨라마이드 | N-Cyclohexyl-N-methoxy-2,5-dimethyl-3-furamide (Furmecyclox) | - | 알킬화합물 |
| 트랜스-4-사이클로헥실-L-프롤린 모노하이드로클로라이드 | trans-4-Cyclohexyl-L-proline monohydrochloride | - | 알킬화합물 |
| 사프롤(천연에센스에 자연적으로 함유되어 그 양이 최종 제품에서 100ppm을 넘지 않는 경우는 제외) | Safrole (except naturally present in essences, not exceeding 100 ppm in the final product) | - | 향료 |
| α-산토닌(3S, 5aR, 9bS)-3, 3a,4,5,5a,9b-헥사히드로-3,5a,9-트리메칠나프토(1,2-b))퓨란-2,8-디온 | alpha-Santonin ((3S,5aR,9bS)-3,3a,4,5,5a,9b-hexahydro-3,5a,9-trimethylnaphtho[1,2-b]furan-2,8-dione) | - | 알킬화합물 |
| 석면 | Asbestos | - | 발암성 물질 |
| 석유 | Petroleum | - | 석유류 |
| 석유 경제 과정에서 얻어지는 부산물(증류물, 가스 오일류, 나프타, 윤활그리스, 슬랙 왁스, 탄화수소류, 알칸류, 백색 페트롤라롬을 제외한 페트롤라롬, 연료 오일, 잔류물), 다만, 정제 과정이 완전히 알려져 있고 발암 물질을 함유하지 않음을 보여 줄 수 있으면 예외로 한다. | By-products from petroleum refining (distillates, gas oils, naphtha, lubricating grease, slack wax, hydrocarbons, alkanes, petrolatum except white petrolatum, fuel oil, residues), except where the refining process is fully known and shown to contain no carcinogens | - | 동물성 원료 |
| 부타디엔 0.1%를 초과하여 함유하는 석유정제물(가스류, 탄화수소류, 알칸류, 증류물, 라피네이트) | Petroleum refinery products containing more than 0.1% butadiene (gases, hydrocarbons, alkanes, distillates, raffinates) | - | 동물성 원료 |
| 디메칠설폭사이드(DMSO)로 추출한 성분을 3% 초과하여 함유하고 있는 석유 유래 물질 | Petroleum-derived substances containing more than 3% of dimethyl sulfoxide (DMSO)-extractable components | - | 유기 용매 |
| 벤조[a]피렌 0.005%를 초과하여 함유하고 있는 석유화학 유래 물질, 석탄 및 목타르 유래 물질 | Petrochemical-, coal- and wood tar-derived substances containing more than 0.005% benzo[a]pyrene | - | 발암성 물질 대표 |
| 석탄추출 제트기용 연료 및 디겔연료 | Coal-derived jet fuels and diesel fuels | - | 석탄류 |
| 설티암 | Sultiame | - | 항갑상선제 |
| 설팔레이트 | Sulfallate | - | 설페이트류 |
| 3,3'-(설포닐비스(2-니트로-4,1-페닐렌)이미노)비스(6-(페닐아미노))벤젠설포닉애씨드 및 그 염류 | 3,3'-(Sulfonylbis(2-nitro-4,1-phenylene)imino)bis(6-(phenylamino))benzenesulfonic acid and its salts | - | 발암성 용매 |
| 설폰아미드 및 그 유도체(볼루엔설폰아미드/포름알데히드수지, 볼루엔설폰아미드/에폭시수지는 제외) | Sulfonamides and their derivatives (except Toluenesulfonamide/formaldehyde resin and Toluenesulfonamide/epoxy resin) | - | 아미드류 |
| 설핀피라존 | Sulfinpyrazone | - | 통풍 치료제 |
| 과산화물가가 10mmol/L을 초과하는 Cedrus atlantica의 오일 및 추출물 | Oil and extracts of Cedrus atlantica with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 세파엘린 및 그 염류 | Cephaeline and its salts | - | 염류 |
| 센노사이드 | Sennoside | - | 하제 |
| 셀렌 및 그 화합물(셀레늄아스파테이트는 제외) | Selenium and its compounds (except Selenium Aspartate) | - | 중금속 |
| 소듐노나데카플루오로데카노에이트 | Sodium nonadecafluorodecanoate | - | 할로겐화합물 |
| 소듐헥사시클로네이트 | Sodium hexacyclonate | - | 나트륨염 |
| 소듐헵타데카플루오로노나노에이트 | Sodium heptadecafluorononanoate | - | 할로겐화합물 |
| Solanum nigrum L. 및 그 생약제제 | Solanum nigrum L. and its galenical preparations | - | 생약제제 |
| Schoenocaulon officinale Lind.(씨 및 그 생약제제) | Schoenocaulon officinale Lind. (seeds and galenical preparations) | - | 생약제제 |
| 솔벤트레드1(CI 12150) | Solvent Red 1 (CI 12150) | - | 아조 염료 |
| 솔벤트블루 35 | Solvent Blue 35 | - | 아조 염료 |
| 솔벤트오렌지 7 | Solvent Orange 7 | - | 아조 염료 |
| 수은 및 그 화합물 | Mercury and its compounds | 미백(불법 사용) | 중금속 대표 / 과거 미백크림에 불법 첨가되어 금지 |
| 스트로판투스(Strophantus)속 및 그 생약제제 | Strophanthus species and their galenical preparations | - | 식물 속 |
| 스트로판틴, 그 비당질 및 그 각각의 유도체 | Strophanthins, their aglycones and their respective derivatives | - | 강심제 |
| 스트론튬화합물 | Strontium compounds | - | 알칼리 토금속 |
| 스트리크노스(Strychnos)속 그 생약제제 | Strychnos species and their galenical preparations | - | 식물 속 |
| 스트리키닌 및 그 염류 | Strychnine and its salts | - | 염류 |
| 스파르테인 및 그 염류 | Sparteine and its salts | - | 염류 |
| 스피로노락톤 | Spironolactone | - | 이뇨제 |
| 시마진 | Simazine | - | 농약류 |
| 4-시아노-2,6-디요도페닐 옥타노에이트 | 4-Cyano-2,6-diiodophenyl octanoate | - | 방향족 화합물 |
| 스칼렛레드(솔벤트레드 24) | Scarlet Red (Solvent Red 24) | - | 아조 염료 |
| 시클라바메이트 | Cyclarbamate | - | 카르바메이트류 |
| 시클로메놀 및 그 염류 | Cyclomenol and its salts | - | 염류 |
| 시클로포스파미드 및 그 염류 | Cyclophosphamide and its salts | - | 염류 |
| 2-α-시클로헥실벤질(N,N,N',N'테트라에칠)트리메칠렌디아민(페네타민) | 2-alpha-Cyclohexylbenzyl(N,N,N',N'-tetraethyl)trimethylenediamine (Phenetamine) | - | 아민류 화합물 |
| 신코카인 및 그 염류 | Cinchocaine and its salts | - | 염류 |
| 신코펜 및 그 염류(유도체 포함) | Cinchophen and its salts (including derivatives) | - | 염류 |
| 석시노니트릴 | Succinonitrile | - | 시아네이트류 |
| Anamirta cocculus L.(과실) | Anamirta cocculus L. (fruit) | - | 식물성 원료 |
| o-아니시딘 | o-Anisidine | - | 아민류 화합물 |
| 아닐린, 그 염류 및 그 할로겐화 유도체 및 설폰화 유도체 | Aniline, its salts and its halogenated and sulfonated derivatives | - | 아민류 화합물 |
| 아다팔렌 | Adapalene | - | 여드름 치료제 |
| Adonis vernalis L. 및 그 제제 | Adonis vernalis L. and its preparations | - | 식물성 원료 |
| Areca catechu 및 그 생약제제 | Areca catechu and its galenical preparations | - | 생약제제 |
| 아레콜린 | Arecoline | - | 마약류 |
| 아리스톨로키아(Aristolochia)속 및 그 생약제제 | Aristolochia species and their galenical preparations | - | 식물 속 |
| 아리스토로직 애씨드 및 그 염류 | Aristolochic acid and its salts | - | 카르복실산류 |
| 1-아미노-2-니트로-4-(2',3'-디하이드록시프로필)아미노-5-클로로벤젠과 1,4-비스-(2',3'-디하이드록시프로필)아미노-2-니트로-5-클로로벤젠 및 그 염류 | 1-Amino-2-nitro-4-(2',3'-dihydroxypropyl)amino-5-chlorobenzene and 1,4-bis-(2',3'-dihydroxypropyl)amino-2-nitro-5-chlorobenzene and their salts (HC Red No. 10 + HC Red No. 11) | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| 2-아미노-3-니트로페놀 및 그 염류 | 2-Amino-3-nitrophenol and its salts | - | 아민류 화합물 |
| p-아미노-o-니트로페놀(4-아미노-2-니트로페놀) | p-Amino-o-nitrophenol (4-Amino-2-nitrophenol) | - | 아민류 화합물 |
| 2-아미노-4-니트로페놀 | 2-Amino-4-nitrophenol | - | 아민류 화합물 |
| 2-아미노-5-니트로페놀 | 2-Amino-5-nitrophenol | - | 아민류 화합물 |
| 4-아미노-3-니트로페놀 및 그 염류 | 4-Amino-3-nitrophenol and its salts | - | (다만, 4-아미노-3-니트로페놀은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하는 제외) |
| 황산 2-아미노-5-니트로페놀 | 2-Amino-5-nitrophenol sulfate | - | 아민류 화합물 |
| 2,2'-[(4-아미노-3-니트로페닐)이미노]바이세타놀 하이드로클로라이드 및 그 염류 | 2,2'-[(4-Amino-3-nitrophenyl)imino]bisethanol hydrochloride and its salts (HC Red No. 13) | - | (다만, 하이드로클로라이드염으로서 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하는 제외) |
| (8-[(4-아미노-2-니트로페닐)아조]-7-하이드록시-2-나프틸)트리메칠암모늄 및 그 염류(베이직브라운 17의 불순물로 있는 베이직레드 118 제외) | (8-[(4-Amino-2-nitrophenyl)azo]-7-hydroxy-2-naphthyl)trimethylammonium and its salts (except Basic Red 118 present as an impurity in Basic Brown 17) | - | 아민류 화합물 |
| 1-아미노-4-[(디메칠아미노)메칠]페닐)아미노]안트라퀴논 및 그 염류 | 1-Amino-4-[[4-[(dimethylamino)methyl]phenyl]amino]anthraquinone and its salts | - | 아민류 화합물 |
| 6-아미노-2-((2,4-디메칠페닐)-1H-벤즈[de]이소퀴놀린-1,3-(2H)-디온(솔벤트옐로우 44) 및 그 염류 | 6-Amino-2-(2,4-dimethylphenyl)-1H-benz[de]isoquinoline-1,3(2H)-dione (Solvent Yellow 44) and its salts | - | 아민류 화합물 |
| 5-아미노-2,6-디메톡시-3-하이드록시피리딘 및 그 염류 | 5-Amino-2,6-dimethoxy-3-hydroxypyridine and its salts | - | 아민류 화합물 |
| 3-아미노-2,4-디클로로페놀 및 그 염류 | 3-Amino-2,4-dichlorophenol and its salts | - | (다만, 3-아미노-2,4-디클로로페놀 및 그 염산염은 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로 염산염으로서 1.5% 이하는 제외) |
| 2-아미노메칠-p-아미노페놀 및 그 염산염 | 2-Aminomethyl-p-aminophenol and its hydrochloride | - | 아민류 화합물 |
| 2-[(4-아미노-2-메칠-5-니트로페닐)아미노]에탄올 및 그 염류 | 2-[(4-Amino-2-methyl-5-nitrophenyl)amino]ethanol and its salts (HC Violet No. 1) | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.25% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.28% 이하는 제외) |
| 2-[(3-(아미노-4-메톡시페닐)아미노]에탄올 및 그 염류 | 2-[(3-Amino-4-methoxyphenyl)amino]ethanol and its salts | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하는 제외) |
| 4-아미노벤젠설포닉애씨드 및 그 염류 | 4-Aminobenzenesulfonic acid and its salts | - | 발암성 용매 |
| 4-아미노벤조익애씨드 및 아미노기(-NH₂)를 가진 그 에스텔 | 4-Aminobenzoic acid and its esters with a free amino group (-NH2) | - | 아민류 화합물 |
| 2-아미노-1,2-비스(4-메톡시페닐)에탄올 및 그 염류 | 2-Amino-1,2-bis(4-methoxyphenyl)ethanol and its salts | - | 아민류 화합물 |
| 4-아미노살리실릭애씨드 및 그 염류 | 4-Aminosalicylic acid and its salts | - | 아민류 화합물 |
| 4-아미노아조벤젠 | 4-Aminoazobenzene | - | 발암성 용매 |
| 1-(2-아미노에칠)아미노-4-(2-하이드록시에칠)옥시-2-니트로벤젠 및 그 염류 | 1-(2-Aminoethyl)amino-4-(2-hydroxyethyl)oxy-2-nitrobenzene and its salts (HC Orange No. 2) | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.0% 이하는 제외) |
| 아미노카프로익애씨드 및 그 염류 | Aminocaproic acid and its salts | - | 아민류 화합물 |
| 4-아미노-m-크레솔 및 그 염류 | 4-Amino-m-cresol and its salts | - | (다만, 4-아미노-m-크레솔은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하는 제외) |
| 6-아미노-o-크레솔 및 그 염류 | 6-Amino-o-cresol and its salts | - | 아민류 화합물 |
| 2-아미노-6-클로로-4-니트로페놀 및 그 염류 | 2-Amino-6-chloro-4-nitrophenol and its salts | - | (다만, 2-아미노-6-클로로-4-니트로페놀은 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| o-아미노페놀 | o-Aminophenol | - | 아민류 화합물 |
| 황산 o-아미노페놀 | o-Aminophenol sulfate | - | 아민류 화합물 |
| 1-[(3-아미노프로필)아미노]-4-(메칠아미노)안트라퀴논 및 그 염류 | 1-[(3-Aminopropyl)amino]-4-(methylamino)anthraquinone and its salts (HC Blue No. 8) | - | 아민류 화합물 |
| 4-아미노-3-플루오로페놀 | 4-Amino-3-fluorophenol | - | 아민류 화합물 |
| 5-[(4-[(7-아미노-1-하이드록시-3-설포-2-나프틸)아조]-2,5-디에톡시페닐)아조]-2-[(3-포스포노페닐)아조]벤조익애씨드 및 5-[(4-[(7-아미노-1-하이드록시-3-설포-2-나프틸)아조]-2,5-디메톡시페닐)아조]-3-[(3-포스포네일)아조]벤조익애씨드 | 5-[(4-[(7-Amino-1-hydroxy-3-sulfo-2-naphthyl)azo]-2,5-diethoxyphenyl)azo]-2-[(3-phosphonophenyl)azo]benzoic acid and its dimethoxy analogue | - | 아민류 화합물 |
| 3(또는 5)-[[4-[(7-아미노-1-하이드록시-3-설포네이토-2-나프틸)아조]-1-나프틸]아조]살리실릭애씨드 및 그 염류 | 3(or 5)-[[4-[(7-Amino-1-hydroxy-3-sulfonato-2-naphthyl)azo]-1-naphthyl]azo]salicylic acid and its salts | - | 아민류 화합물 |
| Ammi majus 및 그 생약제제 | Ammi majus and its galenical preparations | - | 생약제제 |
| 아미트롤 | Amitrole | - | 농약류 |
| 아미트리프틸린 및 그 염류 | Amitriptyline and its salts | - | 염류 |
| 아밀나이트라이트 | Amyl nitrite | - | 질산화합물 |
| 아밀 4-디메칠아미노벤조익애씨드(펜틸디메칠파바, 파디메이트A) | Amyl 4-dimethylaminobenzoate (Pentyl dimethyl PABA, Padimate A) | - | 아민류 화합물 |
| 과산화물가가 10mmol/L을 초과하는 Abies balsamea 잎의 오일 및 추출물 | Oil and extracts of Abies balsamea leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Abies sibirica 잎의 오일 및 추출물 | Oil and extracts of Abies sibirica leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Abies alba 열매의 오일 및 추출물 | Oil and extracts of Abies alba fruit with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Abies alba 잎의 오일 및 추출물 | Oil and extracts of Abies alba leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Abies pectinata 잎의 오일 및 추출물 | Oil and extracts of Abies pectinata leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 아세노코우마롤 | Acenocoumarol | - | 항응고제 |
| 아세타마이드 | Acetamide | - | 아미드류 |
| 아세토나이트릴 | Acetonitrile | - | 유기 용매 |
| 아세토페논, 포름알데히드, 사이클로헥실아민, 메탄올 및 초산의 반응물 | Reaction product of acetophenone, formaldehyde, cyclohexylamine, methanol and acetic acid | - | 유기 용매 |
| (2-아세톡시에칠)트리메칠암모늄히드록사이드(아세틸콜린 및 그 염류) | (2-Acetoxyethyl)trimethylammonium hydroxide (Acetylcholine and its salts) | - | 알킬화합물 |
| N-[2-(3-아세틸-5-니트로치오펜-2-일아조)-5-디에칠아미노페닐]아세타마이드 | N-[2-(3-Acetyl-5-nitrothiophen-2-ylazo)-5-diethylaminophenyl]acetamide | - | 아민류 화합물 |
| 3-[(4-(아세틸아미노)페닐)아조]-4-하이드록시-7-[[[5-하이드록시-6-(페닐아조)-7-설포-2-나프탈레닐]아미노]카보닐아미노]-2-나프탈렌설포닉애씨드 및 그 염류 | 3-[(4-(Acetylamino)phenyl)azo]-4-hydroxy-7-[[[5-hydroxy-6-(phenylazo)-7-sulfo-2-naphthalenyl]amino]carbonylamino]-2-naphthalenesulfonic acid and its salts | - | 아민류 화합물 |
| 5-(아세틸아미노)-4-하이드록시-3-((2-메칠페닐)아조)-2,7-나프탈렌디설포닉애씨드 및 그 염류 | 5-(Acetylamino)-4-hydroxy-3-((2-methylphenyl)azo)-2,7-naphthalenedisulfonic acid and its salts | - | 아민류 화합물 |
| 아자시클로놀 및 그 염류 | Azacyclonol and its salts | - | 염류 |
| 아자페니딘 | Azafenidin | - | 항암제 |
| 아조벤젠 | Azobenzene | - | 발암성 용매 |
| 아지리딘 | Aziridine | - | 알킬화제 |
| 아코니툼(Aconitum)속 및 그 생약제제 | Aconitum species and their galenical preparations | - | 식물 속 |
| 아코니틴 및 그 염류 | Aconitine and its salts | - | 염류 |
| 아크릴로니트릴 | Acrylonitrile | - | 시아네이트류 |
| 아크릴아마이드 | Acrylamide (except as a residue from polyacrylamides: 0.1 ppm in leave-on body products, 0.5 ppm in other products) | - | (다만, 폴리아크릴아마이드류에서 유래되었으며, 사용 후 씻어내지 않는 보디화장품에 0.1ppm, 기타 제품에 0.5ppm 이하인 경우에는 제외) |
| 아트라놀 | Atranol | - | 농약류 |
| Atropa belladonna L. 및 그 제제 | Atropa belladonna L. and its preparations | - | 식물성 원료 |
| 아트로핀, 그 염류 및 유도체 | Atropine, its salts and derivatives | - | 마약류 |
| 아포몰핀 및 그 염류 | Apomorphine and its salts | - | 염류 |
| Apocynum cannabinum L. 및 그 제제 | Apocynum cannabinum L. and its preparations | - | 식물성 원료 |
| 안드로겐효과를 가진 물질 | Substances with androgenic effect | - | 남성 호르몬 |
| 안트라센 오일 | Anthracene oil | - | 안트라센류 |
| 스테로이드 구조를 갖는 안티안드로겐 | Antiandrogens with steroidal structure | - | 동물성 원료 |
| 안티몬 및 그 화합물 | Antimony and its compounds | - | 중금속 |
| 알드린 | Aldrin | - | 농약류 |
| 알라클로르 | Alachlor | - | 농약류 |
| 알로클아마이드 및 그 염류 | Alloclamide and its salts | - | 염류 |
| 알릴글리시딜에텔 | Allyl glycidyl ether | - | 에테르류 |
| 2-(4-알릴-2-메톡시페녹시)-N,N-디에칠아세트아마이드 및 그 염류 | 2-(4-Allyl-2-methoxyphenoxy)-N,N-diethylacetamide and its salts | - | 알킬화합물 |
| 4-알릴-2,6-비스(2,3-에폭시프로필)페놀, 4-알릴-6-[3-[6-[3-(4-알릴-2,6-비스(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-2-(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-2,6-비스(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-6-[3-[6-[3-(4-알릴-2,6-비스(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-2-(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-2,6-비스(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-4-알릴-2-(2,3-에폭시프로필)페놀의 혼합물이드록시프로필]-2-(2,3-에폭시프로필)페녹시]-2-하이드록시프로필]-2-(2,3-에폭시프로필)페놀의 혼합물 | Mixture of 4-allyl-2,6-bis(2,3-epoxypropyl)phenol and its epoxypropyl-substituted oligomers | - | 알킬화합물 |
| 알릴이소치오시아네이트 | Allyl isothiocyanate | - | 시아네이트류 |
| 에스텔의 유리알릴알코올농도가 0.1%를 초과하는 알릴에스텔류 | Allyl esters containing more than 0.1% free allyl alcohol in the ester | - | 에스테르류 |
| 알릴클로라이드(3-클로로프로펜) | Allyl chloride (3-Chloropropene) | - | 할로겐화합물 |
| 2급 알칸올아민 및 그 염류 | Secondary alkanolamines and their salts | - | 염류 |
| 알칼리 설파이드류 및 알칼리토 설파이드류 | Alkali sulfides and alkaline-earth sulfides | - | 설폰아미드류 |
| 2-알칼리펜타시아노니트로실페레이트 | Alkali pentacyanonitrosylferrates | - | 질산화합물 |
| 알킨알코올 그 에스텔, 에텔 및 염류 | Alkyne alcohols, their esters, ethers and salts | - | 염류 |
| ω-알킬디치오카르보닉애씨드의 염 | Salts of omega-alkyldithiocarbonic acid | - | 카르복실산류 |
| 2급 알킬아민 및 그 염류 | Secondary alkylamines and their salts | - | 염류 |
| 암모늄노나데카플루오로데카노에이트 | Ammonium nonadecafluorodecanoate | - | 할로겐화합물 |
| 암모늄플루오로노나노에이트 | Ammonium heptadecafluorononanoate | - | 할로겐화합물 |
| 2-[4-(2-암모니오프로필아미노)-6-[4-하이드록시-3-(5-메칠-2-메톡시-4-설파모일페닐아조)-2-설포네이토나프트-7-일아미노]-1,3,5-트리아진-2-일아미노]-2-아미노프로필포르메이트 | 2-[4-(2-Ammoniopropylamino)-6-[4-hydroxy-3-(5-methyl-2-methoxy-4-sulfamoylphenylazo)-2-sulfonatonaphth-7-ylamino]-1,3,5-triazin-2-ylamino]-2-aminopropyl formate | - | 아민류 화합물 |
| 애씨드오렌지24(CI 20170) | Acid Orange 24 (CI 20170) | - | 카르복실산류 |
| 애씨드레드73(CI 27290) | Acid Red 73 (CI 27290) | - | 카르복실산류 |
| 애씨드블랙 131 및 그 염류 | Acid Black 131 and its salts | - | 카르복실산류 |
| 에르고칼시페롤 및 콜레칼시페롤(비타민D₂와 D₃) | Ergocalciferol and Cholecalciferol (Vitamin D2 and D3) | - | 비타민류 |
| 에리오나이트 | Erionite | - | 발암성 물질 |
| 에메틴, 그 염류 및 유도체 | Emetine, its salts and derivatives | - | 염류 |
| 에스트로겐 | Estrogens | - | 여성 호르몬 |
| 에제린 또는 피조스티그민 및 그 염류 | Eserine or Physostigmine and its salts | - | 염류 |
| 에이치시 녹색 No. 1 | HC Green No. 1 | - | 색소 |
| 에이치시 적색 No. 8 및 그 염류 | HC Red No. 8 and its salts | - | 염류 |
| 에이치시 청색 No. 11 | HC Blue No. 11 | - | 색소 |
| 에이치시 황색 No. 11 | HC Yellow No. 11 | - | 색소 |
| 에이치시 등색 No. 3 | HC Orange No. 3 | - | 색소 |
| 에지온아미드 | Ethionamide | - | 케톤류 화합물 |
| 에칠렌글리콜 디메칠 에텔(EGDME) | Ethylene glycol dimethyl ether (EGDME) | - | 유기 용매 |
| 2,2'-[(1,2'-에칠렌디일)비스[5-((4-에톡시페닐)아조)벤젠설포닉애씨드)] 및 그 염류 | 2,2'-[(1,2-Ethylenediyl)bis[5-((4-ethoxyphenyl)azo)benzenesulfonic acid]] and its salts | - | 발암성 용매 |
| 에칠렌옥사이드 | Ethylene oxide | - | 알킬화합물 |
| 3-에칠-2-메칠-2-(3-메칠부틸)-1,3-옥사졸리다 | 3-Ethyl-2-methyl-2-(3-methylbutyl)-1,3-oxazolidine | - | 알킬화합물 |
| 1-에칠-1-메칠포리늄 브로마이드 | 1-Ethyl-1-methylmorpholinium bromide | - | 알킬화합물 |
| 1-에칠-1-메칠피리디늄 브로마이드 | 1-Ethyl-1-methylpyrrolidinium bromide | - | 알킬화합물 |
| 에칠비스(4-히드록시-2-옥소-1-벤조피란-3-일)아세테이트 및 그 산의 염류 | Ethyl bis(4-hydroxy-2-oxo-1-benzopyran-3-yl)acetate and salts of the acid (Ethyl biscoumacetate) | - | 알킬화합물 |
| 4-에칠아미노-3-니트로벤조익애씨드(N-에칠-3-니트로 파바) 및 그 염류 | 4-Ethylamino-3-nitrobenzoic acid (N-Ethyl-3-nitro PABA) and its salts | - | 아민류 화합물 |
| 에칠아크릴레이트 | Ethyl acrylate | - | 알킬화합물 |
| 3'-에칠-5',6',7',8'-테트라히드로-5',6',8',8'-테트라메칠-2'-아세토나프탈렌(아세틸에칠테트라메칠테트라린, AETT) | 3'-Ethyl-5',6',7',8'-tetrahydro-5',6',8',8'-tetramethyl-2'-acetonaphthalene (Acetylethyltetramethyltetralin, AETT) | - | 알킬화합물 |
| 에칠페나세미드(페네투라이드) | Ethyl phenacemide (Pheneturide) | - | 알킬화합물 |
| 2-[[4-[에칠(2-하이드록시에칠)아미노]페닐]아조]-6-메톡시-3-메칠-벤조치아졸리움 및 그 염류 | 2-[[4-[Ethyl(2-hydroxyethyl)amino]phenyl]azo]-6-methoxy-3-methylbenzothiazolium and its salts | - | 아민류 화합물 |
| 2-에칠헥사노익애씨드 | 2-Ethylhexanoic acid | - | 알킬화합물 |
| 2-에칠헥실[[3,5-비스(1,1-디메칠에칠)-4-하이드록시페닐]-메칠]치오]아세테이트 | 2-Ethylhexyl [[3,5-bis(1,1-dimethylethyl)-4-hydroxyphenyl]methyl]thioacetate | - | 알킬화합물 |
| O,O'-(에테닐메칠실릴렌디[(4-메칠펜탄-2-온)옥심] | O,O'-(Ethenylmethylsilylene)di[(4-methylpentan-2-one)oxime] | - | 알킬화합물 |
| 에토헵타진 및 그 염류 | Ethoheptazine and its salts | - | 염류 |
| 7-에톡시-4-메칠쿠마린 | 7-Ethoxy-4-methylcoumarin | - | 알킬화합물 |
| 4'-에톡시-2-벤즈이미다졸아닐라이드 | 4'-Ethoxy-2-benzimidazoleanilide | - | 헤테로고리화합물 |
| 2-에톡시에탄올(에칠렌글리콜 모노에칠에텔, EGMEE) | 2-Ethoxyethanol (Ethylene glycol monoethyl ether, EGEE) | - | 유기 용매 |
| 에톡시에탄올아세테이트 | Ethoxyethanol acetate (2-Ethoxyethyl acetate) | - | 아세트산염 |
| 5-에톡시-3-트리클로로메칠-1,2,4-치아디아졸 | 5-Ethoxy-3-trichloromethyl-1,2,4-thiadiazole (Etridiazole) | - | 알킬화합물 |
| 4-에톡시페놀(히드로퀴논모노에칠에텔) | 4-Ethoxyphenol (Hydroquinone Monoethyl Ether) | - | 알킬화합물 |
| 4-에톡시-m-페닐렌디아민 및 그 염류 | 4-Ethoxy-m-phenylenediamine and its salts | - | (예 4-에톡시-m-페닐렌디아민 설페이트) |
| 에페드린 및 그 염류 | Ephedrine and its salts | - | 염류 |
| 1,2-에폭시부탄 | 1,2-Epoxybutane | - | 에폭시화합물 |
| (에폭시에칠)벤젠 | (Epoxyethyl)benzene (Styrene oxide) | - | 발암성 용매 |
| 1,2-에폭시-3-페녹시프로판 | 1,2-Epoxy-3-phenoxypropane | - | 에폭시화합물 |
| R-2,3-에폭시-1-프로판올 | R-2,3-Epoxy-1-propanol | - | 알콜류 |
| 2,3-에폭시프로판-1-올 | 2,3-Epoxypropan-1-ol (Glycidol) | - | 에폭시화합물 |
| 2,3-에폭시프로필-o-톨일에텔 | 2,3-Epoxypropyl-o-tolyl ether | - | 알킬화합물 |
| 에피네프린 | Epinephrine | - | 아드레날린 |
| 옥사디아질 | Oxadiargyl | - | 헤테로고리화합물 |
| (옥사릴비스이미노에칠렌)비스((o-클로로벤질)디에칠암모늄)염류 | (Oxalylbisiminoethylene)bis((o-chlorobenzyl)diethylammonium) salts (e.g. Ambenonium chloride) | - | (예 암베노뮴클로라이드) |
| 옥산아미드 및 그 유도체 | Oxanamide and its derivatives | - | 아미드류 |
| 옥스페네리딘 및 그 염류 | Oxpheneridine and its salts | - | 염류 |
| 4,4'-옥시디아닐린(p-아미노페닐 에텔) 및 그 염류 | 4,4'-Oxydianiline (p-Aminophenyl ether) and its salts | - | 아민류 화합물 |
| (s)-옥시란메탄올 4-메칠벤젠설포네이트 | (S)-Oxiranemethanol 4-methylbenzenesulfonate | - | 발암성 용매 |
| 옥시염화비스머스 이외의 비스머스화합물 | Bismuth compounds other than Bismuth oxychloride | - | 할로겐화합물 |
| 옥시퀴놀린(히드록시-8-퀴놀린 또는 퀴놀린-8-올) 및 그 황산염 | Oxyquinoline (8-Hydroxyquinoline or Quinolin-8-ol) and its sulfate | - | 헤테로고리화합물 |
| 옥타톡신 및 그 염류 | Octamoxin and its salts | - | 염류 |
| 옥타밀아민 및 그 염류 | Octamylamine and its salts | - | 염류 |
| 옥토드린 및 그 염류 | Octodrine and its salts | - | 염류 |
| 올레안드린 | Oleandrin | - | 강심제 |
| 와파린 및 그 염류 | Warfarin and its salts | - | 염류 |
| 요도메탄 | Iodomethane | - | 할로겐화합물 |
| 요오드 | Iodine | - | 할로겐화합물 |
| 요힘빈 및 그 염류 | Yohimbine and its salts | - | 염류 |
| 우레탄(에칠카바메이트) | Urethane (Ethyl carbamate) | - | 알킬화합물 |
| 우로카닌산, 우로카닌산에칠 | Urocanic acid, Ethyl urocanate | - | 알킬화합물 |
| Urginea scilla Stern. 및 그 생약제제 | Urginea scilla Stern. and its galenical preparations | - | 생약제제 |
| 우스닉산 및 그 염류(구리염 포함) | Usnic acid and its salts (including copper salt) | - | 염류 |
| 2,2'-이미노비스-에탄올, 에피클로히드린 및 2-니트로-1,4-벤젠디아민의 반응생성물(에이치시 청색 No. 5) 및 그 염류 | Reaction product of 2,2'-iminobisethanol, epichlorohydrin and 2-nitro-1,4-benzenediamine (HC Blue No. 5) and its salts | - | 발암성 용매 |
| (마이크로-((7,7'-이미노비스(4-하이드록시-3-((2-하이드록시-5-(N-메칠설파모일)페닐)아조)나프탈렌-2-설포네이토))(6-)))디쿠프레이트 및 그 염류 | (mu-((7,7'-Iminobis(4-hydroxy-3-((2-hydroxy-5-(N-methylsulfamoyl)phenyl)azo)naphthalene-2-sulfonato))(6-)))dicuprate and its salts | - | 알킬화합물 |
| 4,4'-(4-이미노사이클로헥사-2,5-디에닐리덴메칠렌)디아닐린 하이드로클로라이드 | 4,4'-(4-Iminocyclohexa-2,5-dienylidenemethylene)dianiline hydrochloride | - | 아민류 화합물 |
| 이미다졸리딘-2-치온 | Imidazolidine-2-thione (Ethylene thiourea) | - | 케톤류 화합물 |
| 과산화물가가 10mmol/L을 초과하는 이소디프렌 | Isodiprene with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 이소메트헵텐 및 그 염류 | Isometheptene and its salts | - | 염류 |
| 이소부틸나이트라이트 | Isobutyl nitrite | - | 알킬화합물 |
| 4,4'-이소부틸에칠리덴디페놀 | 4,4'-Isobutylethylidenediphenol | - | 알킬화합물 |
| 이소소르비디나이트레이트 | Isosorbide dinitrate | - | 질산화합물 |
| 이소카르복사지드 | Isocarboxazid | - | 동물성 원료 |
| 이소프레나린 | Isoprenaline | - | 동물성 원료 |
| 이소프렌(2-메칠-1,3-부타디엔) | Isoprene (2-Methyl-1,3-butadiene) | - | 발암성 물질 |
| 6-이소프로필-2-데카하이드로나프탈렌올(6-이소프로필-2-데카롤) | 6-Isopropyl-2-decahydronaphthalenol (6-Isopropyl-2-decalol) | - | 알킬화합물 |
| 3-(4-이소프로필페닐)-1,1-디메칠우레아(이소프로투론) | 3-(4-Isopropylphenyl)-1,1-dimethylurea (Isoproturon) | - | 알킬화합물 |
| (2-이소프로필펜트-4-에노일)우레아(아프로날리드) | (2-Isopropylpent-4-enoyl)urea (Apronalide) | - | 알킬화합물 |
| 이속사플루롤 | Isoxaflutole | - | 식물 속 |
| 이속시닐 및 그 염류 | Ioxynil and its salts | - | 염류 |
| 이부프로펜피코놀, 그 염류 및 유도체 | Ibuprofen piconol, its salts and derivatives | - | 염류 |
| Ipecacuanha(Cephaelis ipecacuaha Brot. 및 관련된 종)(뿌리, 가루 및 생약제제) | Ipecacuanha (Cephaelis ipecacuanha Brot. and related species) (root, powder and galenical preparations) | - | 생약제제 |
| 이프로디온 | Iprodione | - | 케톤류 화합물 |
| 인체 세포·조직 및 그 배양액 | Human cells, tissues and their culture media | - | (다만, 배양액 중 별표 3의 인체 세포·조직 배양액 안전 기준에 적합한 경우는 제외) |
| 인태반(Human Placenta) 유래 물질 | Human placenta-derived substances | - | 동물성 원료 |
| 인프로쿠온 | Improquone | - | 케톤류 화합물 |
| 임페라토린(9-(3-메칠부트-2-에녹시)퓨로(3,2-g)크로멘-7-온) | Imperatorin (9-(3-Methylbut-2-enoxy)furo[3,2-g]chromen-7-one) | - | 알킬화합물 |
| 자이람 | Ziram | - | 농약류 |
| 자일렌 | Xylene | - | (다만, 화장품 원료의 제조공정에서 용매로 사용되었으나 완전히 제거할 수 없는 잔류용매로서 화장품법 시행규칙 [별표 3] 2), 3), 5)에 해당하는 제품 중 0.01% 이하, 기타 제품 중 0.002% 이하인 경우 제외) |
| 자일로메타졸린 및 그 염류 | Xylometazoline and its salts | - | 염류 |
| 자일리딘, 그 이성체, 염류, 할로겐화 유도체 및 설폰화 유도체 | Xylidine, its isomers, salts, halogenated and sulfonated derivatives | - | 염류 |
| 족사졸아민 | Zoxazolamine | - | 헤테로고리화합물 |
| Juniperus sabina L.(잎, 경유 및 생약제제) | Juniperus sabina L. (leaves, essential oil and galenical preparations) | - | 생약제제 |
| 지르코늄 및 그 산의 염류 | Zirconium and its acid salts | - | 염류 |
| 천수국꽃 추출물 또는 오일 | Tagetes (marigold) flower extract or oil | - | 식물 추출물 |
| Chenopodium ambrosioides(정유) | Chenopodium ambrosioides (essential oil) | - | 식물성 원료 |
| 치람 | Thiram | - | 농약류 |
| 4,4'-치오디아닐린 및 그 염류 | 4,4'-Thiodianiline and its salts | - | 아민류 화합물 |
| 치오아세타마이드 | Thioacetamide | - | 아미드류 |
| 치오우레아 및 그 유도체 | Thiourea and its derivatives | - | 요소류 |
| 치오테파 | Thiotepa | - | 항암제 |
| 치오판네이트-메칠 | Thiophanate-methyl | - | 알킬화합물 |
| 카드뮴 및 그 화합물 | Cadmium and its compounds | - | 중금속 대표 |
| 카라미펜 및 그 염류 | Caramiphen and its salts | - | 염류 |
| 카르벤다짐 | Carbendazim | - | 농약류 |
| 4,4'-카르본이미도일비스[N,N-디메칠아닐린] 및 그 염류 | 4,4'-Carbonimidoylbis[N,N-dimethylaniline] and its salts (Auramine) | - | 아민류 화합물 |
| 카리소프로돌 | Carisoprodol | - | 동물성 원료 |
| 카바독스 | Carbadox | - | 농약류 |
| 카바릴 | Carbaryl | - | 농약류 |
| N-(3-카바모일-3,3-디페닐프로필)-N,N-디이소프로필메칠암모늄염 | N-(3-Carbamoyl-3,3-diphenylpropyl)-N,N-diisopropylmethylammonium salts (e.g. Isopropamide iodide) | - | (예 이소프로파미드아이오다이드) |
| 카바졸의 니트로유도체 | Nitro derivatives of carbazole | - | 질산화합물 |
| 7,7'-(카보닐디이미노)비스(4-하이드록시-3-[[2-설포-4-[(4-설포페닐)아조]페닐]아조-2-나프탈렌설포닉애씨드 및 그 염류 | 7,7'-(Carbonyldiimino)bis(4-hydroxy-3-[[2-sulfo-4-[(4-sulfophenyl)azo]phenyl]azo]-2-naphthalenesulfonic acid and its salts | - | 방향족 화합물 |
| 카본디설파이드 | Carbon disulfide | - | 설폰아미드류 |
| 카본모노옥사이드(일산화탄소) | Carbon monoxide | - | 산화물 |
| 카본블랙안트라센이 각각 5ppb 이하이고 총 다환방향족탄화수소류(PAHs)가 0.5ppm 이하인 경우에는 제외) | Carbon black (except where benzo[a]pyrene and dibenz[a,h]anthracene impurities are each 5 ppb or less and total PAHs are 0.5 ppm or less) | - | (다만, 불순물 중 벤조피렌과 디벤즈(a,h) |
| 카본테트라클로라이드 | Carbon tetrachloride | - | 유기 용매 |
| 카부트아미드 | Carbutamide | - | 아미드류 |
| 카브로말 | Carbromal | - | 동물성 원료 |
| 카탈라제 | Catalase | - | 효소 |
| 카테콜(피로카테콜) | Catechol (Pyrocatechol) | - | 페놀류 |
| 칸타리스, Cantharis vesicatoria | Cantharides, Cantharis vesicatoria | - | 식물성 원료 |
| 캡타폴 | Captafol | - | 해독제 |
| 캡토디암 | Captodiame | - | 항암제 |
| 케토코나졸 | Ketoconazole | - | 항진균제 |
| Conium maculatum L.(과실, 가루, 생약제제) | Conium maculatum L. (fruit, powder, galenical preparations) | - | 생약제제 |
| 코니인 | Coniine | - | 마약류 |
| 코발트디클로라이드(코발트클로라이드) | Cobalt Dichloride (Cobalt Chloride) | - | 중금속 |
| 코발트벤젠설포네이트 | Cobalt benzenesulfonate | - | 중금속 |
| 코발트설페이트 | Cobalt sulfate | - | 중금속 |
| 코우메타롤 | Coumetarol | - | 쿠마린류 |
| 콘발라톡신 | Convallatoxin | - | 강심제 |
| 콜린염 및 에스텔 | Choline salts and their esters (e.g. Choline chloride) | - | (예 콜린클로라이드) |
| 콜키신, 그 염류 및 유도체 | Colchicine, its salts and derivatives | - | 염류 |
| 콜기코시드 및 그 유도체 | Colchicoside and its derivatives | - | 강심제 |
| Colchicum autumnale L. 및 그 생약제제 | Colchicum autumnale L. and its galenical preparations | - | 생약제제 |
| 콜타르 및 정제콜타르 | Coal tar and refined coal tar | - | 타르류 |
| 쿠라레와 쿠라린 | Curare and curarine | - | 근육이완제 |
| 합성 쿠라리잔트(Curarizants) | Synthetic curarizants | - | 복합화합물 |
| 과산화물가가 10mmol/L을 초과하는 Cupressus sempervirens 잎의 오일 및 추출물 | Oil and extracts of Cupressus sempervirens leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 크로톤알데히드(부테날) | Crotonaldehyde (Butenal) | - | 알데하이드류 |
| Croton tiglium(오일) | Croton tiglium (oil) | - | 식물성 원료 |
| 3-(4-클로로페닐)-1,1-디메칠우로늄 트리클로로아세테이트; 모누론-TCA | 3-(4-Chlorophenyl)-1,1-dimethyluronium trichloroacetate; Monuron-TCA | - | 알킬화합물 |
| 크롬; 크로믹애씨드 및 그 염류 | Chromium; Chromic acid and its salts | - | 중금속 |
| 크리센 | Chrysene | - | 항암제 |
| 크산티놀(7-[2-히드록시-3-[N-(2-히드록시에칠)-N-메칠아미노]프로필]테오필린) | Xanthinol (7-[2-Hydroxy-3-[N-(2-hydroxyethyl)-N-methylamino]propyl]theophylline) | - | 아민류 화합물 |
| Claviceps purpurea Tul., 그 알칼로이드 및 생약제제 | Claviceps purpurea Tul., its alkaloids and galenical preparations | - | 생약제제 |
| 1-클로로-4-니트로벤젠 | 1-Chloro-4-nitrobenzene | - | 발암성 용매 |
| 2-[(4-클로로-2-니트로페닐)아미노]에탄올(에이치시 황색 No. 12) 및 그 염류 | 2-[(4-Chloro-2-nitrophenyl)amino]ethanol (HC Yellow No. 12) and its salts | - | 아민류 화합물 |
| 2-[(4-클로로-2-니트로페닐)아조]-N-(2-메톡시페닐)-3-옥소부탄올아마이드(피그먼트엘로우 73) 및 그 염류 | 2-[(4-Chloro-2-nitrophenyl)azo]-N-(2-methoxyphenyl)-3-oxobutanamide (Pigment Yellow 73) and its salts | - | 할로겐화합물 |
| 2-클로로-5-니트로-N-하이드록시에칠-p-페닐렌디아민 및 그 염류 | 2-Chloro-5-nitro-N-hydroxyethyl-p-phenylenediamine and its salts (HC Red No. 3) | - | 아민류 화합물 |
| 클로로데콘 | Chlordecone | - | 할로겐화합물 |
| 2,2'-((3-클로로-4-((2,6-디클로로-4-니트로페닐)아조)페닐)이미노)비스에탄올(디스퍼스브라운 1) 및 그 염류 | 2,2'-((3-Chloro-4-((2,6-dichloro-4-nitrophenyl)azo)phenyl)imino)bisethanol (Disperse Brown 1) and its salts | - | 할로겐화합물 |
| 5-클로로-1,3-디하이드로-2H-인돌-2-온 | 5-Chloro-1,3-dihydro-2H-indol-2-one | - | 할로겐화합물 |
| [6-[[3-클로로-4-(메칠아미노)페닐]이미노]-4-메칠-3-옥소사이클로헥사-1,4-디엔-1-일]우레아(에이치시 적색 No. 9) 및 그 염류 | [6-[[3-Chloro-4-(methylamino)phenyl]imino]-4-methyl-3-oxocyclohexa-1,4-dien-1-yl]urea (HC Red No. 9) and its salts | - | 아민류 화합물 |
| 클로로메칠 메칠에텔 | Chloromethyl methyl ether | - | 알킬화합물 |
| 2-클로로-6-메칠피리미딘-4-일디메칠아민(크리미딘-ISO) | 2-Chloro-6-methylpyrimidin-4-yldimethylamine (Crimidine-ISO) | - | 아민류 화합물 |
| 클로로메탄 | Chloromethane | - | 할로겐화합물 |
| p-클로로벤조트리클로라이드 | p-Chlorobenzotrichloride | - | 할로겐화합물 |
| N-5-클로로벤족사졸-2-일아세트아마이드 | N-5-Chlorobenzoxazol-2-ylacetamide | - | 할로겐화합물 |
| 4-클로로-2-아미노페놀 | 4-Chloro-2-aminophenol | - | 아민류 화합물 |
| 클로로아세타마이드 | Chloroacetamide | - | 할로겐화합물 |
| 클로로아세트알데히드 | Chloroacetaldehyde | - | 할로겐화합물 |
| 클로로아트라놀 | Chloroatranol | - | 할로겐화합물 |
| 6-(2-클로로에칠)-6-(2-메톡시에톡시)-2,5,7,10-테트라옥사-6-실라운데칸 | 6-(2-Chloroethyl)-6-(2-methoxyethoxy)-2,5,7,10-tetraoxa-6-silaundecane (Etacelasil) | - | 알킬화합물 |
| 2-클로로-6-에칠아미노-4-니트로페놀 및 그 염류 | 2-Chloro-6-ethylamino-4-nitrophenol and its salts | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 3% 이하는 제외) |
| 클로로에탄 | Chloroethane | - | 할로겐화합물 |
| 1-클로로-2,3-에폭시프로판 | 1-Chloro-2,3-epoxypropane (Epichlorohydrin) | - | 할로겐화합물 |
| R-1-클로로-2,3-에폭시프로판 | R-1-Chloro-2,3-epoxypropane | - | 할로겐화합물 |
| 클로로탈로닐 | Chlorothalonil | - | 할로겐화합물 |
| 클로로톨루론; 3-(3-클로로-p-톨일)-1,1-디메칠우레아 | Chlorotoluron; 3-(3-Chloro-p-tolyl)-1,1-dimethylurea | - | 알킬화합물 |
| α-클로로톨루엔 | alpha-Chlorotoluene (Benzyl chloride) | - | 할로겐화합물 |
| N'-(4-클로로-o-톨일)-N,N-디메칠포름아미딘 모노하이드로클로라이드 | N'-(4-Chloro-o-tolyl)-N,N-dimethylformamidine monohydrochloride (Chlordimeform hydrochloride) | - | 알킬화합물 |
| 1-(4-클로로페닐)-4,4-디메칠-3-(1,2,4-트리아졸-1-일메칠)펜타-3-올 | 1-(4-Chlorophenyl)-4,4-dimethyl-3-(1,2,4-triazol-1-ylmethyl)pentan-3-ol (Tebuconazole) | - | 알킬화합물 |
| (3-클로로페닐)-(4-메톡시-3-니트로페닐)메타논 | (3-Chlorophenyl)-(4-methoxy-3-nitrophenyl)methanone | - | 할로겐화합물 |
| (2RS,3RS)-3-(2-클로로페닐)-2-(4-플루오로페닐)-[1H-1,2,4-트리아졸-1-일)메칠옥시란(에폭시코나졸) | (2RS,3RS)-3-(2-Chlorophenyl)-2-(4-fluorophenyl)-[(1H-1,2,4-triazol-1-yl)methyl]oxirane (Epoxiconazole) | - | 알킬화합물 |
| 클로로포름 | Chloroform | - | 할로겐화합물 |
| 클로로프렌(2-클로로부타-1,3-디엔) | Chloroprene (2-Chlorobuta-1,3-diene) | - | 할로겐화합물 |
| 클로로플루오로카본 추진제(완전하게 할로겐화 된 클로로플루오로알칸) | Chlorofluorocarbon propellants (fully halogenated chlorofluoroalkanes) | - | 할로겐화합물 |
| 2-클로로-N-(히드록시메칠)아세트아마이드 | 2-Chloro-N-(hydroxymethyl)acetamide | - | 알킬화합물 |
| N-[(6-[(2-클로로-4-하이드록시페닐)이미노]-4-메톡시-3-옥소-1,4-사이클로헥사디엔-1-일]아세타마이드(에이치시 황색 No. 8) 및 그 염류 | N-[6-[(2-Chloro-4-hydroxyphenyl)imino]-4-methoxy-3-oxo-1,4-cyclohexadien-1-yl]acetamide (HC Yellow No. 8) and its salts | - | 할로겐화합물 |
| 클로르단 | Chlordane | - | 농약류 |
| 클로르디메품 | Chlordimeform | - | 농약류 |
| 클로르메자논 | Chlormezanone | - | 진정제 |
| 클로르메틴 및 그 염류 | Chlormethine and its salts | - | 염류 |
| 클로르족사존 | Chlorzoxazone | - | 항염증제 |
| 클로르탈리돈 | Chlortalidone | - | 이뇨제 |
| 클로르프로티센 및 그 염류 | Chlorprothixene and its salts | - | 염류 |
| 클로르프로파미드 | Chlorpropamide | - | 당뇨 치료제 |
| 클로린 | Chlorine | - | 할로겐 |
| 클로졸리네이트 | Chlozolinate | - | 농약류 |
| 클로페노탄; DDT(ISO) | Clofenotane; DDT (ISO) | - | 농약류 |
| 클로벤아미드 | Clofenamide (INN) | - | 아미드류 |
| 키노메치오네이트 | Chinomethionat (Oxythioquinox) | - | 항진균제 |
| 타크로리무스(tacrolimus), 그 염류 및 유도체 | Tacrolimus, its salts and derivatives | - | 염류 |
| 탈륨 및 그 화합물 | Thallium and its compounds | - | 중금속 |
| 탈리도마이드 및 그 염류 | Thalidomide and its salts | - | 염류 |
| 대한민국약전(식품의약품안전처 고시) '탤크'항 중 석면 기준에 적합하지 않은 탤크 | Talc not meeting the asbestos criteria of the 'Talc' monograph in the Korean Pharmacopoeia (MFDS notice) | - | 발암성 물질 |
| 과산화물가가 10mmol/L을 초과하는 테르펜 및 테르페노이드 | Terpenes and terpenoids with a peroxide value exceeding 10 mmol/L (except limonene) | - | (다만, 리모넨류는 제외) |
| 과산화물가가 10mmol/L을 초과하는 신핀 테르펜 및 테르페노이드(sinpine terpenes and terpenoids) | Sinpine terpenes and terpenoids with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 테르펜 알코올류의 아세테이트 | Acetates of terpene alcohols with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 테르펜하이드로카본 | Terpene hydrocarbons with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 α-테르피넨 | alpha-Terpinene with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 γ-테르피넨 | gamma-Terpinene with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 테르피놀렌 | Terpinolene with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| Thevetia neriifolia juss, 배당체 추출물 | Thevetia neriifolia juss, glycoside extract | - | 식물 추출물 |
| N,N,N',N'-테트라글리시딜-4,4'-디아미노-3,3'-디에칠디페닐메탄 | N,N,N',N'-Tetraglycidyl-4,4'-diamino-3,3'-diethyldiphenylmethane | - | 아민류 화합물 |
| N,N,N',N-테트라메칠-4,4'-메칠렌디아닐린 | N,N,N',N'-Tetramethyl-4,4'-methylenedianiline | - | 아민류 화합물 |
| 테트라베나진 및 그 염류 | Tetrabenazine and its salts | - | 염류 |
| 테트라브로모살리실아닐리드 | Tetrabromosalicylanilide | - | 할로겐화합물 |
| 테트라소듐 3,3'-[[1,1'-비페닐]-4,4'-다일비스(아조)]비스[5-아미노-4-하이드록시나프탈렌-2,7-디설포네이트](다이렉트블루 6) | Tetrasodium 3,3'-[[1,1'-biphenyl]-4,4'-diylbis(azo)]bis[5-amino-4-hydroxynaphthalene-2,7-disulfonate] (Direct Blue 6) | - | 아민류 화합물 |
| 1,4,5,8-테트라아미노안트라퀴논(디스퍼스블루 1) | 1,4,5,8-Tetraaminoanthraquinone (Disperse Blue 1) | - | 아민류 화합물 |
| 테트라에칠피로포스페이트; TEPP(ISO) | Tetraethyl pyrophosphate; TEPP (ISO) | - | 알킬화합물 |
| 테트라카보닐니켈 | Tetracarbonylnickel (Nickel carbonyl) | - | 알레르기 유발 |
| 테트라카인 및 그 염류 | Tetracaine and its salts | - | 염류 |
| 테트라코나졸((+/-)-2-(2,4-디클로로페닐)-3-(1H-1,2,4-트리아졸-1-일)프로필-1,1,2,2-테트라플루오로에칠에텔) | Tetraconazole ((+/-)-2-(2,4-Dichlorophenyl)-3-(1H-1,2,4-triazol-1-yl)propyl-1,1,2,2-tetrafluoroethyl ether) | - | 알킬화합물 |
| 2,3,7,8-테트라클로로디벤조-p-디옥신 | 2,3,7,8-Tetrachlorodibenzo-p-dioxin (TCDD) | - | 할로겐화합물 |
| 테트라클로로살리실아닐리드 | Tetrachlorosalicylanilide | - | 할로겐화합물 |
| 5,6,12,13-테트라클로로안트라(2,1,9-def:6,5,10-d'e'f')디이소퀴놀린-1,3,8,10(2H,9H)-테트론 | 5,6,12,13-Tetrachloroanthra[2,1,9-def:6,5,10-d'e'f']diisoquinoline-1,3,8,10(2H,9H)-tetrone | - | 할로겐화합물 |
| 테트라클로로에칠렌 | Tetrachloroethylene | - | 알킬화합물 |
| 테트라키스-하이드록시메칠포스포늄 클로라이드, 우레아 및 증류된 수소화 C16-18 탈로우 알킬아민의 반응생성물(UVCB 축합물) | Reaction product of tetrakis-hydroxymethylphosphonium chloride, urea and distilled hydrogenated C16-18 tallow alkylamine (UVCB condensate) | - | 알킬화합물 |
| 테트라하이드로-6-니트로퀴노살린 및 그 염류 | Tetrahydro-6-nitroquinoxaline and its salts | - | 염류 |
| 테트라히드로졸린(테트리졸린) 및 그 염류 | Tetrahydrozoline (Tetryzoline) and its salts | - | 염류 |
| 테트라하이드로치오피란-3-카르복스알데하이드 | Tetrahydrothiopyran-3-carboxaldehyde | - | 알데하이드류 |
| (+/-)-테트라하이드롬푸릴-(R)-2-[4-(6-클로로퀴노살린-2-일옥시)페닐옥시]프로피오네이트 | (+/-)-Tetrahydrofurfuryl (R)-2-[4-(6-chloroquinoxalin-2-yloxy)phenyloxy]propionate (Quizalofop-tefuryl) | - | 할로겐화합물 |
| 테트릴암모늄브로마이드 | Tetrylammonium bromide | - | 할로겐화합물 |
| 테파졸린 및 그 염류 | Tefazoline and its salts | - | 염류 |
| 텔루륨 및 그 화합물 | Tellurium and its compounds | - | 중금속 |
| 토목향(Inula helenium) 오일 | Elecampane oil (Inula helenium) | - | 식물성 원료 |
| 톡사펜 | Toxaphene | - | 농약류 |
| 톨루엔-3,4-디아민 | Toluene-3,4-diamine | - | 아민류 화합물 |
| 톨루이디늄클로라이드 | Toluidinium chloride | - | 톨루엔류 |
| 톨루이딘, 그 이성체, 염류, 할로겐화 유도체 및 설폰화 유도체 | Toluidine, its isomers, salts, halogenated and sulfonated derivatives | - | 톨루엔류 |
| o-톨루이딘계 색소류 | o-Toluidine-based colorants | - | 톨루엔류 |
| 톨루이딘설페이트(1:1) | Toluidine sulfate (1:1) | - | 황산염 |
| m-톨리덴 디이소시아네이트 | m-Tolylidene diisocyanate | - | 시아네이트류 |
| 4-o-톨릴아조-o-톨루이딘 | 4-o-Tolylazo-o-toluidine | - | 아조 염료 |
| 톨복산 | Tolboxane | - | 톨루엔류 |
| 톨부트아미드 | Tolbutamide | - | 아미드류 |
| [(톨일옥시)메칠]옥시란(크레실 글리시딜 에텔) | [(Tolyloxy)methyl]oxirane (Cresyl glycidyl ether) | - | 알킬화합물 |
| [(m-톨일옥시)메칠]옥시란 | [(m-Tolyloxy)methyl]oxirane | - | 알킬화합물 |
| [(p-톨일옥시)메칠]옥시란 | [(p-Tolyloxy)methyl]oxirane | - | 알킬화합물 |
| 과산화물가가 10mmol/L을 초과하는 피누스(Pinus)속을 스팀증류하여 얻은 투르펜틴 | Turpentine obtained by steam distillation of Pinus species, with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 투르펜틴검(피누스(Pinus)속) | Turpentine gum (Pinus species) with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 투르펜틴 오일 및 정제 오일 | Turpentine oil and rectified oil with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 투아미노헵탄, 이성체 및 그 염류 | Tuaminoheptane, its isomers and salts | - | 아민류 화합물 |
| 과산화물가가 10mmol/L을 초과하는 Thuja Occidentalis 나무줄기의 오일 | Oil of Thuja occidentalis stem wood with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Thuja Occidentalis 잎의 오일 및 추출물 | Oil and extracts of Thuja occidentalis leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 트라닐시프로민 및 그 염류 | Tranylcypromine and its salts | - | 염류 |
| 트레타민 | Tretamine | - | 알킬화제 |
| 트레티노인(레티노익애씨드 및 그 염류) | Tretinoin (Retinoic Acid and its salts) | 주름·여드름(의약품 성분) | 카르복실산류 / 레티노이드 의약품 성분, 화장품 사용금지 |
| 트리니켈디설파이드 | Trinickel disulfide | - | 알레르기 유발 |
| 트리데모르프 | Tridemorph | - | 진해제 |
| 3,5,5-트리메칠사이클로헥스-2-에논 | 3,5,5-Trimethylcyclohex-2-enone (Isophorone) | - | 알킬화합물 |
| 2,4,5-트리메칠아닐린[1]; 2,4,5-트리메칠아닐린 하이드로클로라이드[2] | 2,4,5-Trimethylaniline [1]; 2,4,5-Trimethylaniline hydrochloride [2] | - | 아민류 화합물 |
| 3,6,10-트리메칠-3,5,9-운데카트리엔-2-온(메칠이소슈도이오논) | 3,6,10-Trimethyl-3,5,9-undecatrien-2-one (Methyl isopseudoionone) | - | 알킬화합물 |
| 2,2,6-트리메칠-4-피메리딘벤조에이트(유카인) 및 그 염류 | 2,2,6-Trimethyl-4-piperidinyl benzoate (Eucaine) and its salts | - | 알킬화합물 |
| 3,4,5-트리메톡시페네칠아민 및 그 염류 | 3,4,5-Trimethoxyphenethylamine (Mescaline) and its salts | - | 염류 |
| 트리부틸포스페이트 | Tributyl phosphate | - | 알킬화합물 |
| 3,4',5-트리브로모살리실아닐리드(트리브롬살란) | 3,4',5-Tribromosalicylanilide (Tribromsalan) | - | 할로겐화합물 |
| 2,2,2-트리브로모에탄올(트리브로모에칠알코올) | 2,2,2-Tribromoethanol (Tribromoethyl alcohol) | - | 알킬화합물 |
| 트리소듐 비스(7-아세트아미도-2-(4-니트로-2-옥시도페닐아조)-3-설포네이토-1-나프롤라토)크로메이트(1-) | Trisodium bis(7-acetamido-2-(4-nitro-2-oxidophenylazo)-3-sulfonato-1-naphtholato)chromate(1-) | - | 방향족 화합물 |
| 트리소듐[4'-(8-아세틸아미노-3,6-디설포네이토-2-나프틸아조)-4''-(6-벤조일아미노-3-설포네이토-2-나프틸아조)-비페닐-1,3',3'',1'''-테트라울라토-O,O',O'',O''']코퍼(II) | Trisodium [4'-(8-acetylamino-3,6-disulfonato-2-naphthylazo)-4''-(6-benzoylamino-3-sulfonato-2-naphthylazo)-biphenyl-1,3',3'',1'''-tetraolato-O,O',O'',O''']copper(II) | - | 아민류 화합물 |
| 1,3,5-트리스(3-아미노메칠페닐)-1,3,5-(1H,3H,5H)-트리아진-2,4,6-트리온 및 3,5-비스(3-아미노메칠페닐)-1-폴리[3,5-비스(3-아미노메칠페닐)-2,4,6-트리옥소-1,3,5-(1H,3H,5H)-트리아진-1-일]-1,3,5-(1H,3H,5H)-트리아진-2,4,6-트리온 올리고머의 혼합물 | Mixture of 1,3,5-tris(3-aminomethylphenyl)-1,3,5-(1H,3H,5H)-triazine-2,4,6-trione and related oligomers | - | 아민류 화합물 |
| 1,3,5-트리스-[(2S 및 2R)-2,3-에폭시프로필]-1,3,5-트리아진-2,4,6-(1H,3H,5H)-트리온 | 1,3,5-Tris-[(2S and 2R)-2,3-epoxypropyl]-1,3,5-triazine-2,4,6-(1H,3H,5H)-trione (TGIC) | - | 알킬화합물 |
| 1,3,5-트리스(옥시라닐메칠)-1,3,5-트리아진-2,4,6(1H,3H,5H)-트리온 | 1,3,5-Tris(oxiranylmethyl)-1,3,5-triazine-2,4,6(1H,3H,5H)-trione | - | 알킬화합물 |
| 트리스(2-클로로에칠)포스페이트 | Tris(2-chloroethyl) phosphate | - | 알킬화합물 |
| N1-(트리스(하이드록시메칠))-메칠-4-니트로-1,2-페닐렌디아민(에이치시 황색 No. 3) 및 그 염류 | N1-(Tris(hydroxymethyl)methyl)-4-nitro-1,2-phenylenediamine (HC Yellow No. 3) and its salts | - | 아민류 화합물 |
| 1,3,5-트리스(2-히드록시에칠)헥사히드로1,3,5-트리아신 | 1,3,5-Tris(2-hydroxyethyl)hexahydro-1,3,5-triazine | - | 알킬화합물 |
| 1,2,4-트리아졸 | 1,2,4-Triazole | - | 헤테로고리화합물 |
| 트리암테렌 및 그 염류 | Triamterene and its salts | - | 염류 |
| 트리옥시메칠렌(1,3,5-트리옥산) | Trioxymethylene (1,3,5-Trioxane) | - | 알킬화합물 |
| 트리클로로니트로메탄(클로로피크린) | Trichloronitromethane (Chloropicrin) | - | 할로겐화합물 |
| N-(트리클로로메칠치오)프탈이미드 | N-(Trichloromethylthio)phthalimide (Folpet) | - | 알킬화합물 |
| N-[(트리클로로메칠)치오]-4-사이클로헥센-1,2-디카르복시미드(캡탄) | N-[(Trichloromethyl)thio]-4-cyclohexene-1,2-dicarboximide (Captan) | - | 알킬화합물 |
| 2,3,4-트리클로로부트-1-엔 | 2,3,4-Trichlorobut-1-ene | - | 할로겐화합물 |
| 트리클로로아세틱애씨드 | Trichloroacetic acid | - | 할로겐화합물 |
| 트리클로로에칠렌 | Trichloroethylene | - | 알킬화합물 |
| 1,1,2-트리클로로에탄 | 1,1,2-Trichloroethane | - | 할로겐화합물 |
| 2,2,2-트리클로로에탄-1,1-디올 | 2,2,2-Trichloroethane-1,1-diol (Chloral hydrate) | - | 할로겐화합물 |
| α,α,α-트리클로로톨루엔 | alpha,alpha,alpha-Trichlorotoluene (Benzotrichloride) | - | 할로겐화합물 |
| 2,4,6-트리클로로페놀 | 2,4,6-Trichlorophenol | - | 할로겐화합물 |
| 1,2,3-트리클로로프로판 | 1,2,3-Trichloropropane | - | 할로겐화합물 |
| 트리클로르메틴 및 그 염류 | Trichlormethine and its salts | - | 염류 |
| 트리톨일포스페이트 | Tritolyl phosphate (Tricresyl phosphate) | - | 인산염 |
| 트리파라놀 | Triparanol | - | 농약류 |
| 트리플루오로요도메탄 | Trifluoroiodomethane | - | 할로겐화합물 |
| 트리플루페리돌 | Trifluperidol | - | 항정신병제 |
| 1,1,4-트리하이드록시벤젠 | 1,2,4-Trihydroxybenzene | - | 발암성 용매 |
| 1,3,5-트리하이드록시벤젠(플로로글루시놀) 및 그 염류 | 1,3,5-Trihydroxybenzene (Phloroglucinol) and its salts | - | 발암성 용매 |
| 티로트리신 | Tyrothricin | - | 갑상선 호르몬 |
| 티로프로픽애씨드 및 그 염류 | Tyropropic acid and its salts | - | 카르복실산류 |
| 티아마졸 | Thiamazole (Methimazole) | - | 갑상선 억제제 |
| 티우람디설파이드 | Thiuram disulfide | - | 설폰아미드류 |
| 티우람모노설파이드 | Thiuram monosulfide | - | 설폰아미드류 |
| 파라메타손 | Paramethasone | 항염(사용금지) | 스테로이드 / 코르티코스테로이드 의약품 성분 |
| 파르에톡시카인 및 그 염류 | Parethoxycaine and its salts | - | 염류 |
| 퍼플루오로노나노익애씨드 | Perfluorononanoic acid | - | 할로겐화합물 |
| 2급 아민 함량이 5%를 초과하는 패티애씨드디알킬아마이드류 및 디알칸올아마이드류 | Fatty acid dialkylamides and dialkanolamides containing more than 5% secondary amine | - | 카르복실산류 |
| 페나글리코돌 | Phenaglycodol | - | 진정제 |
| 페나디아졸 | Phenadiazole | - | 진정제 |
| 페나리몰 | Fenarimol | - | 진정제 |
| 페나세미드 | Phenacemide | - | 진정제 |
| p-페네티딘(4-에톡시아닐린) | p-Phenetidine (4-Ethoxyaniline) | - | 아민류 화합물 |
| 페노졸론 | Fenozolone | - | 진정제 |
| 페노티아진 및 그 화합물 | Phenothiazine and its compounds | - | 항정신병제 |
| 페놀 | Phenol | - | 페놀류 |
| 페놀프탈레인(3,3-비스(4-하이드록시페닐)프탈리드) | Phenolphthalein (3,3-Bis(4-hydroxyphenyl)phthalide) | - | 방향족 화합물 |
| 페니라미돌 | Fenyramidol | - | 진정제 |
| o-페닐렌디아민 및 그 염류 | o-Phenylenediamine and its salts | - | 아민류 화합물 |
| m-페닐렌디아민 | m-Phenylenediamine | - | 아민류 화합물 |
| 염산 m-페닐렌디아민 | m-Phenylenediamine hydrochloride | - | 아민류 화합물 |
| 황산 m-페닐렌디아민 | m-Phenylenediamine sulfate | - | 아민류 화합물 |
| 페닐부타존 | Phenylbutazone | - | 방향족 화합물 |
| 4-페닐부트-3-엔-2-온 | 4-Phenylbut-3-en-2-one (Benzylideneacetone) | - | 방향족 화합물 |
| 페닐살리실레이트 | Phenyl salicylate | - | 방향족 화합물 |
| 1-페닐아조-2-나프톨(솔벤트엘로우 14) | 1-Phenylazo-2-naphthol (Solvent Yellow 14) | - | 방향족 화합물 |
| 4-(페닐아조)-m-페닐렌디아민 및 그 염류 | 4-(Phenylazo)-m-phenylenediamine and its salts | - | 아민류 화합물 |
| 4-페닐아조페닐렌-1-3-디아민시트레이트히드로클로라이드(크리소이딘시트레이트히드로클로라이드) | 4-Phenylazophenylene-1,3-diamine citrate hydrochloride (Chrysoidine citrate hydrochloride) | - | 아민류 화합물 |
| (R)-α-페닐에칠암모늄(-)(1R,2S)-(1,2-에폭시프로필)포스포네이트 모노하이드레이트 | (R)-alpha-Phenylethylammonium (-)-(1R,2S)-(1,2-epoxypropyl)phosphonate monohydrate | - | 알킬화합물 |
| 2-페닐인단-1,3-디온(페닌디온) | 2-Phenylindan-1,3-dione (Phenindione) | - | 방향족 화합물 |
| 페닐파라벤 | Phenylparaben | - | 방향족 화합물 |
| 트랜스-4-페닐-L-프롤린 | trans-4-Phenyl-L-proline | - | 방향족 화합물 |
| 페루발삼(Myroxylon pereirae의 수지)[다만, 추출물(extracts) 또는 증류물(distillates)로서 0.4% 이하인 경우는 제외] | Peru balsam (resin of Myroxylon pereirae) (except extracts or distillates at 0.4% or less) | - | 식물 추출물 |
| 페몰린 및 그 염류 | Pemoline and its salts | - | 염류 |
| 페트리클로랄 | Petrichloral | - | 진정제 |
| 펜테트라진 및 그 유도체 및 그 염류 | Pentetrazol, its derivatives and salts | - | 염류 |
| 펜치온 | Fenthion | - | 케톤류 화합물 |
| N,N'-펜타메칠렌비스(트리메칠암모늄)염류 | N,N'-Pentamethylenebis(trimethylammonium) salts (e.g. Pentamethonium bromide) | - | (예 펜타메토늄브로마이드) |
| 펜타에리트리틸테트라나이트레이트 | Pentaerythrityl tetranitrate | - | 질산화합물 |
| 펜타클로로에탄 | Pentachloroethane | - | 할로겐화합물 |
| 펜타클로로페놀 및 그 알칼리 염류 | Pentachlorophenol and its alkali salts | - | 할로겐화합물 |
| 펜틴 아세테이트 | Fentin acetate | - | 아세트산염 |
| 펜틴 하이드록사이드 | Fentin hydroxide | - | 수산화물 |
| 2-펜틸리덴사이클로헥사논 | 2-Pentylidenecyclohexanone | - | 알킬화합물 |
| 펜프로파메이트 | Fenprobamate | - | 진정제 |
| 펜프로코우몬 | Phenprocoumon | - | 항응고제 |
| 펜프로피모르프 | Fenpropimorph | - | 진정제 |
| 펠라티에린 및 그 염류 | Pelletierine and its salts | - | 염류 |
| 포름아마이드 | Formamide | - | 아미드류 |
| 포름알데하이드 및 p-포름알데하이드 | Formaldehyde and p-Formaldehyde (Paraformaldehyde) | - | 알데하이드류 |
| 포스파미돈 | Phosphamidon | - | 농약류 |
| 포스포러스 및 메탈포스피드류 | Phosphorus and metal phosphides | - | 인산화합물 |
| 포타슘브로메이트 | Potassium bromate | - | 칼륨염 |
| 풀단메릴설페이드 | Poldine metilsulfate | - | 항콜린제 |
| 푸로쿠마린류(천연에센스에 자연적으로 함유된 경우는 제외, 다만, 자외선 차단 제품 및 인공 선탠 제품에서는 1ppm 이하이어야 한다.) | Furocoumarins (except naturally present in essences; must be 1 ppm or less in sunscreen and artificial tanning products) (e.g. Trioxysalen, 8-Methoxypsoralen, 5-Methoxypsoralen) | - | (예 트리옥시살렌, 8-메톡시소랄렌, 5-메톡시소랄렌) |
| 푸르푸릴트리메칠암모늄염 | Furfuryltrimethylammonium salts (e.g. Furtrethonium iodide) | - | (예 푸르트레토늄아이오다이드) |
| 풀라지포프-부틸 | Fluazifop-butyl | - | 알킬화합물 |
| 풀미옥사진 | Flumioxazin | - | 식물성 원료 |
| 퓨란 | Furan | - | 헤테로고리화합물 |
| 프라모카인 및 그 염류 | Pramocaine and its salts | - | 염류 |
| 프레그난디올 | Pregnanediol | - | 스테로이드 |
| 프로게스토젠 | Progestogens | - | 동물성 원료 |
| 프로그레놀론아세테이트 | Pregnenolone acetate | - | 아세트산염 |
| 프로베네시드 | Probenecid | - | 통풍 치료제 |
| 프로카인아마이드, 그 염류 및 유도체 | Procainamide, its salts and derivatives | - | 염류 |
| 프로파지트 | Propargite | - | 농약류 |
| 프로파진 | Propazine | - | 항정신병제 |
| 프로파틸나이트레이트 | Propatyl nitrate | - | 질산화합물 |
| 4,4'-[1,3-프로판디일비스(옥시)]비스벤젠-1,3-디아민 및 그 테트라하이드로클로라이드염프로판, 염산 1,3-비스-(2,4-디아미노페녹시)프로판 하이드로클로라이드) | 4,4'-[1,3-Propanediylbis(oxy)]bisbenzene-1,3-diamine and its tetrahydrochloride salt (1,3-Bis-(2,4-diaminophenoxy)propane hydrochloride) | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 산으로서 1.2% 이하는 제외) |
| 1,3-프로판설톤 | 1,3-Propanesultone | - | 설폰화합물 |
| 프로판-1,2,3-트리일트리나이트레이트 | Propane-1,2,3-triyl trinitrate (Nitroglycerin) | - | 질산화합물 |
| 프로피오락톤 | Propiolactone (beta-Propiolactone) | - | 락톤류 |
| 프로피자마이드 | Propyzamide | - | 농약류 |
| 프로피페나존 | Propyphenazone | - | 진통제 |
| Prunus laurocerasus L. | Prunus laurocerasus L. | - | 식물성 원료 |
| 프시로시빈 | Psilocybine | - | 환각제 |
| 프탈레이트류(디부틸프탈레이트, 디에틸헥실프탈레이트, 부틸벤질프탈레이트에 한함) | Phthalates (limited to Dibutyl phthalate, Diethylhexyl phthalate, Butylbenzyl phthalate) | - | 내분비계 교란물질 |
| 플루실라졸 | Flusilazole | - | 농약류 |
| 플루아니손 | Fluanisone | - | 스테로이드 |
| 플루오레손 | Fluoresone | - | 방향족 화합물 |
| 플루오로우라실 | Fluorouracil | - | 할로겐화합물 |
| 플루지포프-p-부틸 | Fluazifop-p-butyl | - | 알킬화합물 |
| 피그먼트레드 53(레이크레드 C) | Pigment Red 53 (Lake Red C) | - | 색소 |
| 피그먼트레드 53:1(레이크레드 CBa) | Pigment Red 53:1 (Lake Red CBa) | - | 색소 |
| 피그먼트오렌지 5(파마넨토오렌지) | Pigment Orange 5 (Permanent Orange) | - | 색소 |
| 피나스테리드, 그 염류 및 유도체 | Finasteride, its salts and derivatives | - | 염류 |
| 과산화물가가 10mmol/L을 초과하는 Pinus nigra 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus nigra leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus mugo 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus mugo leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus mugo pumilio 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus mugo pumilio leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus cembra 이세틸레이티드 잎 및 잔가지의 추출물 | Acetylated extract of Pinus cembra leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus cembra 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus cembra leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus species 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus species leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus sylvestris 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus sylvestris leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus palustris 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus palustris leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus pumila 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus pumila leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| 과산화물가가 10mmol/L을 초과하는 Pinus pinaste 잎과 잔가지의 오일 및 추출물 | Oil and extracts of Pinus pinaster leaves and twigs with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| Pyrethrum album L. 및 그 생약제제 | Pyrethrum album L. and its galenical preparations | - | 생약제제 |
| 피로갈롤 | Pyrogallol | - | 페놀류 |
| Pilocarpus jaborandi Holmes 및 그 생약제제 | Pilocarpus jaborandi Holmes and its galenical preparations | - | 생약제제 |
| 피로카르핀 및 그 염류 | Pilocarpine and its salts | - | 염류 |
| 6-(1-피롤리딘일)-2,4-피리미딘디아민-3-옥사이드(피롤리디닐 디아미노 피리미딘 옥사이드) | 6-(1-Pyrrolidinyl)-2,4-pyrimidinediamine 3-oxide (Pyrrolidinyl diaminopyrimidine oxide) | - | 아민류 화합물 |
| 피리치온소듐(INNM) | Pyrithione sodium (INNM) | - | 케톤류 화합물 |
| 피리치온알루미늄캄실레이트 | Pyrithione aluminum camsilate | - | 케톤류 화합물 |
| 피메크로리무스(pimecrolimus), 그 염류 및 그 유도체 | Pimecrolimus, its salts and derivatives | - | 염류 |
| 피메트로진 | Pymetrozine | - | 진해제 |
| 과산화물가가 10mmol/L을 초과하는 Picea mariana 잎의 오일 및 추출물 | Oil and extracts of Picea mariana leaves with a peroxide value exceeding 10 mmol/L | - | 산화안정성 관련 |
| Physostigma venenosum Balf. | Physostigma venenosum Balf. | - | 식물성 원료 |
| 피이지-3,2',2'-디-p-페닐렌디아민 | PEG-3,2',2'-di-p-phenylenediamine | - | 아민류 화합물 |
| 피크로톡신 | Picrotoxin | - | 강심제 |
| 피크릭애씨드 | Picric acid | - | 카르복실산류 |
| 피토나디온(비타민 K1) | Phytonadione (Vitamin K1) | - | 케톤류 화합물 |
| 피톨라카(Phytolacca)속 및 그 제제 | Phytolacca species and their preparations | - | 식물 속 |
| 피파제테이트 및 그 염류 | Pipazetate and its salts | - | 염류 |
| 6-(피페리딘일)-2,4-피리미딘디아민-3-옥사이드(미녹시딜), 그 염류 및 유도체 | 6-(Piperidinyl)-2,4-pyrimidinediamine 3-oxide (Minoxidil), its salts and derivatives | 발모(의약품 성분) | 아민류 화합물 / 발모 의약품 성분, 화장품 사용금지 |
| α-피페리딘-2-일벤질아세테이트 좌회전성의 트레오폼(레보파세토페란) 및 그 염류 | alpha-Piperidin-2-yl benzyl acetate, levorotatory threo form (Levophacetoperane) and its salts | - | 방향족 화합물 |
| 피프라드롤 및 그 염류 | Pipradrol and its salts | - | 염류 |
| 피프로쿠라륨 및 그 염류 | Piprocurarium and its salts | - | 염류 |
| 형광증백제 | Fluorescent brighteners (except Fluorescent Brightener 367 in nail products - base coat, undercoat, nail polish, nail enamel, top coat - at 0.12% or less) | - | (다만, Fluorescent Brightener 367은 손발톱용 제품류 중 베이스코트, 언더코트, 네일 폴리시, 네일 에나멜, 탑코트에 0.12% 이하일 경우는 제외) |
| 히드라스틴, 히드라스티닌 및 그 염류 | Hydrastine, hydrastinine and their salts | - | 염류 |
| (4-하이드라지노페닐)-N-메칠메탄설폰아마이드 하이드로클로라이드 | (4-Hydrazinophenyl)-N-methylmethanesulfonamide hydrochloride | - | 알킬화합물 |
| 히드라지드 및 그 염류 | Hydrazides and their salts | - | 염류 |
| 히드라진, 그 유도체 및 그 염류 | Hydrazine, its derivatives and their salts | - | 염류 |
| 하이드로아비에틸 알코올 | Hydroabietyl alcohol | - | 알콜류 |
| 히드로겐시아나이드 및 그 염류 | Hydrogen cyanide and its salts | - | 염류 |
| 히드로퀴논 | Hydroquinone | 미백(의약품 성분) | 페놀류 / 미백효과 뚜렷하나 백반증·알레르기로 화장품 사용금지 |
| 히드로플루오릭애씨드, 그 노르말 염, 그 착화합물 및 히드로플루오라이드 | Hydrofluoric acid, its normal salts, its complexes and hydrofluorides | - | 할로겐화합물 |
| N-[3-하이드록시-2-(2-메칠아크릴로일아미노메톡시)프록시메칠]-2-메칠아크릴아마이드, N-[2,3-비스-(2-메칠아크릴로일아미노메톡시)프록시메칠]-2-메칠아크릴아마이드, 메타크릴아마이드 및 2-메칠-N-(2-메칠아크릴로일아미노메칠)-아크릴아마이드 | N-[3-Hydroxy-2-(2-methylacryloylaminomethoxy)propoxymethyl]-2-methylacrylamide, N-[2,3-bis-(2-methylacryloylaminomethoxy)propoxymethyl]-2-methylacrylamide, methacrylamide and 2-methyl-N-(2-methylacryloylaminomethyl)acrylamide | - | 아민류 화합물 |
| 4-히드록시-3-메톡시신나밀알코올의벤조에이트(천연에센스에 자연적으로 함유된 경우는 제외) | Benzoate of 4-hydroxy-3-methoxycinnamyl alcohol (Coniferyl benzoate) (except naturally present in essences) | - | 에테르류 |
| (6-(4-하이드록시)-3-(2-메톡시페닐아조)-2-설포네이토-7-나프틸아미노)-1,3,5-트리아진-2,4-디일)비스[(아미노이-1-메칠에)암모늄]포메이트 | (6-(4-Hydroxy-3-(2-methoxyphenylazo)-2-sulfonato-7-naphthylamino)-1,3,5-triazine-2,4-diyl)bis[(amino-1-methylethyl)ammonium] formate | - | 아민류 화합물 |
| 1-하이드록시-3-니트로-4-(3-하이드록시프로필아미노)벤젠 및 그 염류 | 1-Hydroxy-3-nitro-4-(3-hydroxypropylamino)benzene and its salts (HC Red No. 16) | - | (다만, 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.6% 이하는 제외) |
| 1-하이드록시-2-베타-하이드록시에칠아미노-4,6-디니트로벤젠 및 그 염류 | 1-Hydroxy-2-beta-hydroxyethylamino-4,6-dinitrobenzene and its salts (2-Hydroxyethylpicramic acid) | - | (다만, 2-하이드록시에칠피크라믹애씨드는 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| 5-하이드록시-1,4-벤조디옥산 및 그 염류 | 5-Hydroxy-1,4-benzodioxane and its salts | - | 발암성 용매 |
| 하이드록시아이소헥실 3-사이클로헥센 카보스알데히드(HICC) | Hydroxyisohexyl 3-cyclohexene carboxaldehyde (HICC, Lyral) | - | 알킬화합물 |
| N1-(2-하이드록시에칠)-4-니트로-o-페닐렌디아민(에이치시 황색 No. 5) 및 그 염류 | N1-(2-Hydroxyethyl)-4-nitro-o-phenylenediamine (HC Yellow No. 5) and its salts | - | 아민류 화합물 |
| 하이드록시에칠-2,6-디니트로-p-아니시딘 및 그 염류 | Hydroxyethyl-2,6-dinitro-p-anisidine and its salts | - | 알킬화합물 |
| 3-[[4-[(2-하이드록시에칠)메칠아미노]-2-니트로페닐]아미노]-1,2-프로판디올 및 그 염류 | 3-[[4-[(2-Hydroxyethyl)methylamino]-2-nitrophenyl]amino]-1,2-propanediol and its salts (HC Violet No. 2) | - | 아민류 화합물 |
| 하이드록시에칠-3,4-메칠렌디옥시아닐린; 2-(1,3-벤진디옥솔-5-일아미노)에탄올 하이드로클로라이드 및 그 염류 | Hydroxyethyl-3,4-methylenedioxyaniline; 2-(1,3-Benzodioxol-5-ylamino)ethanol hydrochloride and its salts | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.5% 이하는 제외) |
| 3-[[4-[(2-하이드록시에칠)아미노]-2-니트로페닐]아미노]-1,2-프로판디올 및 그 염류 | 3-[[4-[(2-Hydroxyethyl)amino]-2-nitrophenyl]amino]-1,2-propanediol and its salts (HC Yellow No. 4) | - | 아민류 화합물 |
| 4-(2-하이드록시에칠)아미노-3-니트로페놀 및 그 염류 | 4-(2-Hydroxyethyl)amino-3-nitrophenol and its salts (3-Nitro-p-hydroxyethylaminophenol) | - | (다만, 3-니트로-p-하이드록시에칠아미노페놀은 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 3.0% 이하, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 1.85% 이하는 제외) |
| 2,2'-[[4-[(2-하이드록시에칠)아미노]-3-니트로페닐]이미노]바이세타놀 및 그 염류 | 2,2'-[[4-[(2-Hydroxyethyl)amino]-3-nitrophenyl]imino]bisethanol and its salts (HC Blue No. 2) | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.8% 이하는 제외) |
| 1-[(2-하이드록시에칠)아미노]-4-(메칠아미노-9,10-안트라센디온 및 그 염류 | 1-[(2-Hydroxyethyl)amino]-4-(methylamino)-9,10-anthracenedione and its salts | - | 아민류 화합물 |
| 하이드록시에칠아미노메칠-p-아미노페놀 및 그 염류 | Hydroxyethylaminomethyl-p-aminophenol and its salts | - | 아민류 화합물 |
| 5-[(2-하이드록시에칠)아미노]-o-크레졸 및 그 염류 | 5-[(2-Hydroxyethyl)amino]-o-cresol and its salts (2-Methyl-5-hydroxyethylaminophenol) | - | (다만, 2-메칠-5-하이드록시에칠아미노페놀은 염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 0.5% 이하는 제외) |
| (4-(4-히드록시-3-요오도페녹시)-3,5-디요오도페닐)아세틱애씨드 및 그 염류 | (4-(4-Hydroxy-3-iodophenoxy)-3,5-diiodophenyl)acetic acid and its salts (Tiratricol) | - | 방향족 화합물 |
| 6-하이드록시-1-(3-이소프록시프로필)-4-메칠-2-옥소-5-[4-(페닐아조)페닐아조]-1,2-디하이드로-3-피리딘카보니트릴 | 6-Hydroxy-1-(3-isopropoxypropyl)-4-methyl-2-oxo-5-[4-(phenylazo)phenylazo]-1,2-dihydro-3-pyridinecarbonitrile | - | 알킬화합물 |
| 4-히드록시인돌 | 4-Hydroxyindole | - | 인돌류 |
| 2-[2-하이드록시-3-(2-클로로페닐)카르바모일-1-나프틸아조]-7-[2-하이드록시-3-(3-메칠페닐)카르바모일-1-나프틸아조]플루오렌-9-온 | 2-[2-Hydroxy-3-(2-chlorophenyl)carbamoyl-1-naphthylazo]-7-[2-hydroxy-3-(3-methylphenyl)carbamoyl-1-naphthylazo]fluoren-9-one | - | 알킬화합물 |
| 4-(7-하이드록시-2,4,4-트리메칠-2-크로마닐)레솔시놀-4-일-트리스(6-디아조-5,6-디하이드로-5-옥소나프탈렌-1-설포네이트) 및 4-(7-하이드록시-2,4,4-트리메칠-2-크로마닐)레솔시놀비스(6-디아조-5,6-디하이드로-5-옥소나프탈렌-1-설포네이트)의 2:1 혼합물 | Mixture (2:1) of 4-(7-hydroxy-2,4,4-trimethyl-2-chromanyl)resorcinol-4-yl-tris(6-diazo-5,6-dihydro-5-oxonaphthalene-1-sulfonate) and its bis-analogue | - | 알킬화합물 |
| 11-α-히드록시프레근-4-엔-3,20-디온 및 그 에스텔 | 11-alpha-Hydroxypregn-4-ene-3,20-dione and its esters | - | 케톤류 화합물 |
| 1-(3-하이드록시프로필아미노)-2-니트로-4-비스(2-하이드록시에칠)아미노벤젠 및 그 염류 | 1-(3-Hydroxypropylamino)-2-nitro-4-bis(2-hydroxyethyl)aminobenzene and its salts | - | (다만, 비산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로서 2.0% 이하는 제외) |
| 히드록시프로필 비스(N-히드록시에칠-p-페닐렌디아민) 및 그 염류 | Hydroxypropyl bis(N-hydroxyethyl-p-phenylenediamine) and its salts | - | (다만, 산화염모제에서 용법·용량에 따른 혼합물의 염모 성분으로 테트라하이드로클로라이드염으로서 0.4% 이하는 제외) |
| 하이드록시피리디논 및 그 염류 | Hydroxypyridinone and its salts | - | 염류 |
| 3-하이드록시-4-[(2-하이드록시나프틸)아조]-7-니트로나프탈렌-1-설포닉애씨드 및 그 염류 | 3-Hydroxy-4-[(2-hydroxynaphthyl)azo]-7-nitronaphthalene-1-sulfonic acid and its salts | - | 아조 염료 |
| 할로카르반 | Halocarban (Cloflucarban) | - | 살균제 |
| 할로페리돌 | Haloperidol | - | 항정신병제 |
| 항생 물질 | Antibiotics | - | 항생제 |
| 항히스타민제 | Antihistamines (e.g. Doxylamine, Diphenylpyraline, Diphenhydramine, Methapyrilene, Brompheniramine, Cyclizine, Chlorphenoxamine, Tripelennamine, Hydroxyzine) | - | (예 독실아민, 디페닐피랄린, 디펜히드라민, 메타피릴렌, 브롬페니라민, 사이클리진, 클로르페녹사민, 트리펠렌아민, 히드록사진 등) |
| N,N'-헥사메칠렌비스(트리메칠암모늄)염류 | N,N'-Hexamethylenebis(trimethylammonium) salts (e.g. Hexamethonium bromide) | - | (예 헥사메토늄브로마이드) |
| 헥사메칠포스포릭-트리아마이드 | Hexamethylphosphoric triamide | - | 알킬화합물 |
| 헥사에칠테트라포스페이트 | Hexaethyl tetraphosphate | - | 알킬화합물 |
| 헥사클로로벤젠 | Hexachlorobenzene | - | 발암성 용매 |
| (1R,4S,5R,8S)-1,2,3,4,10,10-헥사클로로-6,7-에폭시-1,4,4a,5,6,7,8,8a-옥타히드로-,1,4:5,8-디메타노나프탈렌(엔드린-ISO) | (1R,4S,5R,8S)-1,2,3,4,10,10-Hexachloro-6,7-epoxy-1,4,4a,5,6,7,8,8a-octahydro-1,4:5,8-dimethanonaphthalene (Endrin-ISO) | - | 할로겐화합물 |
| 1,2,3,4,5,6-헥사클로로사이클로헥산류 | 1,2,3,4,5,6-Hexachlorocyclohexanes (e.g. Lindane) | - | (예 린단) |
| 헥사클로로에탄 | Hexachloroethane | - | 할로겐화합물 |
| (1R,4S,5R,8S)-1,2,3,4,10,10-헥사클로로-1,4,4a,5,8,8a-헥사히드로-1,4:5,8-디메타노나프탈렌(이소드린-ISO) | (1R,4S,5R,8S)-1,2,3,4,10,10-Hexachloro-1,4,4a,5,8,8a-hexahydro-1,4:5,8-dimethanonaphthalene (Isodrin-ISO) | - | 할로겐화합물 |
| 헥사프로피메이트 | Hexapropymate | - | 진정제 |
| (1R,2S)-헥사히드로-1,2-디메칠-3,6-에폭시프탈릭안하이드라이드(칸타리딘) | (1R,2S)-Hexahydro-1,2-dimethyl-3,6-epoxyphthalic anhydride (Cantharidin) | - | 알킬화합물 |
| 헥사하이드로사이클로펜타(C) 피롤-1-(1H)-암모늄 N-에톡시카르보닐-N-(p-톨릴설포닐)아자나이드 | Hexahydrocyclopenta[c]pyrrol-1(1H)-ammonium N-ethoxycarbonyl-N-(p-tolylsulfonyl)azanide | - | 에테르류 |
| 헥사하이드로쿠마린 | Hexahydrocoumarin | - | 쿠마린류 |
| 헥산 | Hexane | - | 알칸류 |
| 헥산-2-온 | Hexan-2-one (Methyl butyl ketone) | - | 케톤류 화합물 |
| 1,7-헵탄디카르복실산(아젤라산), 그 염류 및 유도체 | 1,7-Heptanedicarboxylic acid (Azelaic acid), its salts and derivatives | - | 염류 |
| 트랜스-2-헥세날디메칠아세탈 | trans-2-Hexenal dimethyl acetal | - | 알킬화합물 |
| 트랜스-2-헥세날디에칠아세탈 | trans-2-Hexenal diethyl acetal | - | 알킬화합물 |
| 헨나(Lawsonia Inermis)잎가루 | Henna (Lawsonia inermis) leaf powder (except use as a hair dye ingredient) | - | (다만, 염모제에서 염모 성분으로 사용하는 것은 제외) |
| 트랜스-2-헵테날 | trans-2-Heptenal | - | 트랜스화합물 |
| 헵타클로로에폭사이드 | Heptachlor epoxide | - | 할로겐화합물 |
| 헵타클로르 | Heptachlor | - | 농약류 |
| 3-헵틸-2-(3-헵틸-4-메칠-치오졸린-2-일렌)-4-메칠-치아졸리늄다이드 | 3-Heptyl-2-(3-heptyl-4-methylthiazolin-2-ylidene)-4-methylthiazolinium iodide | - | 알킬화합물 |
| 황산 4,5-디아미노-1-((4-클로로페닐)메칠)-1H-피라졸 | 4,5-Diamino-1-((4-chlorophenyl)methyl)-1H-pyrazole sulfate | - | 아민류 화합물 |
| 황산 5-아미노-4-플루오르-2-메칠페놀 | 5-Amino-4-fluoro-2-methylphenol sulfate | - | 아민류 화합물 |
| Hyoscyamus niger L. (잎, 씨, 가루 및 생약제제) | Hyoscyamus niger L. (leaves, seeds, powder and galenical preparations) | - | 생약제제 |
| 히요시아민, 그 염류 및 유도체 | Hyoscyamine, its salts and derivatives | - | 염류 |
| 히요신, 그 염류 및 유도체 | Hyoscine (Scopolamine), its salts and derivatives | - | 염류 |
| 영국 및 북아일랜드산 소 유래 성분 | Bovine-derived ingredients originating from the UK and Northern Ireland | - | 동물성 원료 |
| BSE(Bovine Spongiform Encephalopathy) 감염조직 및 이를 함유하는 성분 | BSE (Bovine Spongiform Encephalopathy) infected tissues and ingredients containing them | - | 동물성 원료 |
| 광우병이 보고된 지역의 다음의 특정위험물질(specified risk material) 유래성분(소·양·염소 등 반추동물의 18개 부위) | Specified risk material (SRM)-derived ingredients from BSE-reported regions (18 parts of ruminants such as cattle, sheep and goats) | - | 동물성 원료 |
| 뇌(brain) | Brain | - | 동물성 원료 |
| 척수(spinal cord) | Spinal cord | - | 동물성 원료 |
| 송과체(pineal gland) | Pineal gland | - | 동물성 원료 |
| 경막(dura mater) | Dura mater | - | 동물성 원료 |
| 삼차신경(trigeminal ganglia) | Trigeminal ganglia | - | 동물성 원료 |
| 척주(vertebral column) | Vertebral column | - | 동물성 원료 |
| 편도(tonsil) | Tonsil | - | 동물성 원료 |
| 십이지장에서 직장까지의 장관(intestines from the duodenum to the rectum) | Intestines from the duodenum to the rectum | - | 동물성 원료 |
| 비장(spleen) | Spleen | - | 동물성 원료 |
| 부신(adrenal gland) | Adrenal gland | - | 동물성 원료 |
| 두개골(skull) | Skull | - | 동물성 원료 |
| 뇌척수액(cerebrospinal fluid) | Cerebrospinal fluid | - | 동물성 원료 |
| 하수체(pituitary gland) | Pituitary gland | - | 동물성 원료 |
| 눈(eye) | Eye | - | 동물성 원료 |
| 배측근신경절(dorsal root ganglia) | Dorsal root ganglia | - | 동물성 원료 |
| 림프절(lymph nodes) | Lymph nodes | - | 동물성 원료 |
| 흉선(thymus) | Thymus | - | 동물성 원료 |
| 태반(placenta) | Placenta | - | 동물성 원료 |
| 「화학물질의 등록 및 평가 등에 관한 법률」제2조제9호 및 제27조에 따라 지정하고 있는 금지 물질 | Substances prohibited under Articles 2(9) and 27 of the Act on the Registration and Evaluation of Chemical Substances | - | 법률 관련 |

---
• 황산 o-클로로-p-페닐렌디아민 추가 (2023년말 개정으로 염모제 관련 금지 성분 7종에 포함되었으나 원본에 누락되어 있었음)

### 확인했지만 반영하지 못한 사항 (원문 미확보)
• 2025.9월 개정(고시 제2025-63호, 2026.3.3 시행)에서 "6개 성분 사용기준 강화" 대상으로 언급된 성분 처리 현황:
  - 벤조페논-3(옥시벤존), 노녹시놀-9(17.2%), 부틸페닐메칠프로피오날(릴리알, 0.14%), 사이클로테트라실록세인(D4, 8.7%) → **별표2 파일(restricted_ingredients.md)에 수치까지 반영 완료**
  - 2,6-디하이드록시에칠아미노톨루엔(별표1) → 이 파일에 이미 반영
  - 사이클로펜타실록세인(D5) → 정확한 신규 수치 미확보로 보류 중

### 권고
**시험이 임박했다면, 마지막에는 반드시 식약처(mfds.go.kr) 또는 법제처(law.go.kr)에서 최신 고시 원문(전문 PDF/HWP)을 직접 내려받아 별표1·별표2 전체를 확인하세요.** 이 문서는 학습용 요약·정리 자료이며, 법적 효력이 있는 원문을 대체할 수 없습니다.

---

## 📋 영문명 보완 및 조제관리사 기준 검토 메모 (2026.7 작업)

**보완 결과:** 전체 데이터행 1,135건 중 **1,135건에 영문명 기재 완료**. 2026.7 작업에서 식별된 데이터 품질 이슈는 아래와 같이 모두 해결되었습니다.

**기재 기준:** 별표1(사용할 수 없는 원료)은 사실상 EU 화장품규정 Annex II의 한글 음역본입니다. 영문명은 ① 체계적 화학명(IUPAC), ② 의약품 INN, ③ 농약 ISO 공통명, ④ 색소명(CI / Solvent / Basic / Disperse / Pigment), ⑤ 식물 라틴 학명으로 복원했습니다.

### 조제관리사 시험 관점 확인 사항
- **별표1 전 성분 = 사용금지 원료**이므로, '사용 금지 여부'는 이 파일 수록 사실 자체로 표현됩니다(별도 컬럼 없음).
- **'효과가 있어도 사용금지'인 빈출 성분** 영문명 정상 기재 확인: 수은/Hydroquinone(미백), Tretinoin(주름·여드름), Glucocorticoids·Paramethasone(항염), Minoxidil(발모), 4-Methoxyphenol=Mequinol(미백).

### ✅ 데이터 품질 개선 완료 (2026.7)

1. **구조 오류 정리:** 원래 445~451행에 있던 「화장품법 시행규칙 별표3」 제품유형 파편을 삭제하고, 원래 793행 자일렌의 분리되어 있던 예외조항을 원료 행에 재병합하여 표 구조를 정리했습니다. (자일렌 예외조항 문구는 파일에 남아 있던 파편을 기반으로 재구성한 것이므로 원문 대조 후 미세 수정 가능)
2. **영문명 미기재 항목 보완:** 원래 501 부복시디글리세롤(→부톡시디글리세롤, Butoxydiglycol) / 708 에레틴(→에메틴, Emetine) / 897 클로벤아미드(Clofenamide) / 942 톨복산(Tolboxane) / 1049 풀단메릴설페이드(Poldine metilsulfate) 영문명을 식약처/KCIA 원문 대조 후 추가했습니다. (부복시디글리세롤, 에레틴은 원문상 한글 음역 오타로 확인되어 병행 수정)
3. **중복 행 제거:** 원래 853·854행(Pigment Yellow 73) / 619·624행(p-아미노-o-니트로페놀) 동일 행을 제거했습니다.
4. **비고 오류 수정:** 원래 486행 벤지단(Benzidine)의 분류를 '진통제'에서 '발암성 아민'으로 수정했습니다.
5. **한글 음역 오타 수정:** 원래 196·197 텍스트로→덱스트로 / 593 스론튬→스트론튬 / 607 씩시노니트릴→석시노니트릴 / 700·701 알모늄→암모늄 / 826 캠타폴→캡타폴, 827 캠토디암→캡토디암 / 501 부복시디글리세롤→부톡시디글리세롤, 708 에레틴→에메틴을 원문에 맞게 정정했습니다.
6. **추가 분류 수정:** 원래 1049행 풀단메릴설페이드(Poldine metilsulfate)의 분류가 '식물성 원료'로 되어 있어 '항콜린제'로 수정했습니다.

> **주의:** 위 영문명은 학습 편의를 위한 복원치로, 식약처 고시 원문의 표기(또는 INCI명)와 100% 일치하지 않을 수 있습니다. **시험 직전에는 반드시 식약처(mfds.go.kr) 또는 법제처(law.go.kr) 최신 고시 원문으로 최종 확인**하세요.
