// feedback-notify — Supabase Database Webhook → Discord 알림
// ------------------------------------------------------------
// feedback 테이블 INSERT 시 호출되어 Discord webhook으로 요약을 전달한다.
// 설정: USER_FEEDBACK_DESIGN.md §8
//
// 환경변수 (supabase secrets set):
//   DISCORD_WEBHOOK_URL  — Discord 채널 webhook URL
//   WEBHOOK_SECRET       — Database Webhook 헤더에 넣은 임의 문자열 (무단 호출 차단)
// ------------------------------------------------------------

const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';

const KIND_LABEL: Record<string, string> = {
  praise: '칭찬', improve: '개선', bug: '오류', idea: '제안',
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  // Database Webhook 생성 시 입력한 secret 헤더 검증
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }

  let record: Record<string, unknown>;
  try {
    const payload = await req.json();
    // Database Webhook 페이로드: { type:'INSERT', table, schema, record, old_record }
    if (payload.type !== 'INSERT' || payload.table !== 'feedback') {
      return new Response('ignored', { status: 200 });
    }
    record = payload.record;
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const kind = KIND_LABEL[String(record.kind)] ?? String(record.kind ?? '?');
  const rating = typeof record.rating === 'number' ? ` ★${record.rating}` : '';
  const ctx = [record.view, record.app_version, record.entry_src]
    .filter(Boolean).join(' · ');
  const body = String(record.body ?? '').slice(0, 500);

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `새 의견 — ${kind}${rating}`,
        description: body,
        color: 0x06b6d4,
        fields: [
          { name: '컨텍스트', value: ctx || '없음', inline: true },
          { name: '시각', value: String(record.created_at ?? ''), inline: true },
        ],
      }],
    }),
  });

  return new Response(res.ok ? 'ok' : 'discord error', {
    status: res.ok ? 200 : 502,
  });
});
