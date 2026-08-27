# Git Push & Vercel 배포 절차

> "깃푸시 & 버셀배포" 요청 시 다음 순서를 따른다.

---

## 1. 데이터 빌드

```bash
npm run build:data
```

- **Cwd**: `c:\Project\Personalized_Skincare`
- 데이터 빌드 + 파서 등가성 검사를 자동 수행
- `sw.js`의 `CACHE_VERSION`이 자동으로 bump됨

---

## 2. Git Commit & Push

```bash
git add -A && git commit -m "<commit message>" && git push
```

- **Cwd**: `c:\Project\Personalized_Skincare`
- commit message는 변경 내용에 맞게 작성

---

## 3. Vercel 배포

```bash
cmd /c vercel --prod
```

- **Cwd**: `c:\Project\Personalized_Skincare`
- **주의**: `npx vercel` 또는 `deploy_web_app` 도구 사용 금지 — 반드시 `cmd /c vercel --prod` 사용

---

## 주의사항

| 요청 | 실행 범위 |
|---|---|
| "깃푸시 & 버셀배포" | 빌드 → 커밋/푸시 → 배포 (전체 파이프라인) |
| "깃푸시만" / "push만" | 커밋/푸시만 (빌드·배포 제외) |
| "빌드만" | `npm run build:data`만 |
| "배포만" | `cmd /c vercel --prod`만 |
