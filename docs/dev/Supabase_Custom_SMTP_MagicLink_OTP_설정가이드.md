# Supabase Custom SMTP + Magic Link/OTP 설정 가이드

## 1. 개요

Supabase에서 **Magic Link + OTP 로그인**을 함께 사용하려면 다음 두 가지 설정이 필요합니다.

1. **Custom SMTP 설정**
2. **Magic link or OTP 이메일 템플릿에 `{{ .Token }}` 추가**

현재 앱 설계에서는 **「로그인 메일 보내기」** 버튼 하나로 이메일을 발송하고, 메일에 포함된 **로그인 링크 또는 OTP 코드**를 사용자가 환경에 맞게 선택하도록 구성합니다.

---

## 2. 전체 설정 흐름

```text
Supabase 프로젝트
      │
      ├─ ① Custom SMTP 설정
      │
      ↓
Authentication → Emails
      │
      └─ ② Magic link or OTP 템플릿
              │
              ├─ {{ .Token }}
              └─ {{ .ConfirmationURL }}
                       │
                       ↓
                  이메일 발송
                       │
              ┌────────┴────────┐
              ↓                 ↓
         OTP 코드 입력       링크 클릭
              ↓                 ↓
         PWA 로그인          브라우저 로그인
```

---

# 3. Custom SMTP 설정

## 3.1 Supabase 메뉴

Supabase 대시보드에서 다음으로 이동합니다.

**Authentication → SMTP Settings**

Magic Link/OTP 템플릿을 직접 수정하려면 먼저 Custom SMTP를 설정해야 합니다.

---

## 3.2 Gmail SMTP 권장 설정

Gmail을 발신 SMTP로 사용할 경우 다음과 같이 설정합니다.

| 항목 | 입력값 |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | 발신용 Gmail 주소 |
| Password | Gmail 앱 비밀번호 16자리 |
| Sender email | 같은 Gmail 주소 |
| Sender name | `Passmula` 등 서비스명 |

설정 후:

**Enable Custom SMTP → ON**

으로 활성화합니다.

---

# 4. Gmail 앱 비밀번호 생성

일반 Gmail 비밀번호를 SMTP Password에 입력하면 안 됩니다.

Google 계정에서:

**Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호**

순서로 이동합니다.

앱 이름은 예를 들어:

```text
Supabase
```

로 지정합니다.

생성된 **16자리 앱 비밀번호**를 복사하여 Supabase의 SMTP Password에 입력합니다.

> 앱 비밀번호는 공백을 제거하여 입력합니다.

---

# 5. Magic link or OTP 템플릿 설정

Custom SMTP를 활성화한 다음 Supabase에서:

**Authentication → Emails**

또는

**Authentication → Email Templates**

로 이동합니다.

그 다음:

**Magic link or OTP**

템플릿을 선택합니다.

---

# 6. Body에 `{{ .Token }}` 추가

**Content → Body** 영역을 수정합니다.

다음과 같이 구성할 수 있습니다.

```text
Your sign-in code

Enter this code in the app to sign in:

{{ .Token }}

Or click the link below to sign in:

{{ .ConfirmationURL }}
```

핵심 변수는 두 가지입니다.

### OTP 코드

```text
{{ .Token }}
```

### 로그인 링크

```text
{{ .ConfirmationURL }}
```

---

# 7. 두 변수의 역할

## 7.1 `{{ .Token }}`

Supabase가 이메일 발송 시 실제 OTP 숫자로 자동 치환합니다.

예:

```text
Your sign-in code

123456
```

사용자는 PWA 화면에서 이 코드를 입력합니다.

---

## 7.2 `{{ .ConfirmationURL }}`

Supabase가 실제 로그인 링크로 자동 치환합니다.

사용자가 링크를 클릭하면 브라우저에서 로그인할 수 있습니다.

---

## 7.3 전체 동작 구조

```text
                    Supabase 이메일
                          │
              ┌───────────┴───────────┐
              ↓                       ↓
       {{ .Token }}            {{ .ConfirmationURL }}
              ↓                       ↓
         OTP 숫자 입력              링크 클릭
              ↓                       ↓
          PWA 로그인             브라우저 로그인
```

두 변수는 별도로 입력할 필요가 없습니다.

Supabase가 이메일 발송 시 자동으로 실제 값으로 치환합니다.

---

# 8. Subject는 변경하지 않아도 됨

Subject는 기본값을 그대로 사용해도 됩니다.

이번 설정에서는 **Body에 `{{ .Token }}`와 `{{ .ConfirmationURL }}`를 넣는 것**이 핵심입니다.

---

# 9. Save

Body를 수정한 후:

**Save**

를 클릭합니다.

이 설정은 프로젝트 전체에 적용되므로 사용자별로 설정할 필요가 없습니다.

---

# 10. Body가 회색으로 잠겨 있는 경우

다음과 같은 상태라면:

- Subject 수정 불가
- Body 수정 불가
- 입력창이 회색
- 템플릿 편집이 비활성화됨

먼저 **Custom SMTP 설정 여부**를 확인합니다.

설정 순서는 반드시 다음과 같습니다.

```text
① Authentication → SMTP Settings
        ↓
② Gmail SMTP 정보 입력
        ↓
③ Enable Custom SMTP ON
        ↓
④ Authentication → Emails
        ↓
⑤ Magic link or OTP
        ↓
⑥ Body 수정
        ↓
⑦ Save
```

그래도 편집되지 않는다면 다음을 순서대로 확인합니다.

1. 기존 텍스트 위를 직접 클릭
2. Supabase 대시보드 새로고침
3. 시크릿 모드에서 재접속
4. 다른 브라우저에서 확인

---

# 11. 실제 이메일 테스트

설정을 완료한 후 앱에서:

```text
이메일 입력
      ↓
[로그인 메일 보내기]
      ↓
Supabase
      ↓
이메일 발송
```

이메일에 다음과 같이 표시되면 정상입니다.

```text
Your sign-in code

123456

Or click the link below to sign in.

[로그인 링크]
```

---

# 12. PWA에서 OTP 로그인

설치형 PWA에서는 이메일에 표시된 OTP 코드를 앱에 입력합니다.

예:

```text
이메일: user@example.com

인증 코드:
[ 123456 ]

[확인]
```

Supabase에서는 다음과 같은 방식으로 인증합니다.

```javascript
supabase.auth.verifyOtp({
  email,
  token,
  type: 'email'
})
```

OTP 방식은 링크를 다른 브라우저에서 열 필요가 없기 때문에 PWA 로그인에 적합합니다.

---

# 13. 브라우저에서 Magic Link 로그인

일반 브라우저에서는 이메일의 로그인 링크를 클릭할 수 있습니다.

```text
이메일
  ↓
[로그인 링크 클릭]
  ↓
브라우저
  ↓
Supabase 세션 생성
  ↓
로그인 완료
```

따라서 동일한 이메일을 다음 두 환경에서 사용할 수 있습니다.

| 환경 | 로그인 방법 |
|---|---|
| PC/모바일 브라우저 | 로그인 링크 클릭 |
| 설치형 PWA | OTP 코드 입력 |
| Android PWA | 링크 클릭 또는 OTP |
| iOS PWA | OTP 권장 |

---

# 14. 현재 앱의 권장 UX

현재 설계에서는 Magic Link와 OTP 버튼을 별도로 만들지 않고 하나로 통합합니다.

버튼:

```text
[로그인 메일 보내기]
```

메일:

```text
Your sign-in code

123456

Or click the link below to sign in.

[로그인 링크]
```

사용자는 자신의 환경에 맞는 방법을 선택합니다.

```text
브라우저
→ 로그인 링크 클릭

PWA
→ OTP 코드 입력
```

이렇게 하면 URL 환경과 PWA 환경에서 로그인 절차를 하나로 통일할 수 있습니다.

---

# 15. 최종 체크리스트

## Supabase

- [ ] Authentication → SMTP Settings 진입
- [ ] Gmail 2단계 인증 활성화
- [ ] Gmail 앱 비밀번호 생성
- [ ] `smtp.gmail.com` 입력
- [ ] Port `465` 입력
- [ ] Gmail 주소 입력
- [ ] 앱 비밀번호 입력
- [ ] Sender email 입력
- [ ] Sender name 입력
- [ ] **Enable Custom SMTP ON**

## Email Template

- [ ] Authentication → Emails
- [ ] `Magic link or OTP` 선택
- [ ] Body 편집
- [ ] `{{ .Token }}` 추가
- [ ] `{{ .ConfirmationURL }}` 추가
- [ ] Save

## 앱 테스트

- [ ] 앱에서 이메일 입력
- [ ] 「로그인 메일 보내기」 클릭
- [ ] 이메일 수신 확인
- [ ] OTP 코드 표시 확인
- [ ] PWA에서 코드 입력
- [ ] 로그인 상태 확인
- [ ] 브라우저에서 로그인 링크도 테스트

---

# 16. 최종 템플릿

실제 Supabase Body에는 아래 내용을 사용하면 됩니다.

```text
Your sign-in code

Enter this code in the app to sign in:

{{ .Token }}

Or click the link below to sign in:

{{ .ConfirmationURL }}

This code and link expire shortly and can only be used once.
```

> `{{ .Token }}`과 `{{ .ConfirmationURL }}`는 Supabase가 이메일 발송 시 자동으로 실제 값으로 치환합니다.
