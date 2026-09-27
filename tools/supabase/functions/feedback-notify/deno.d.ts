// deno.d.ts — IDE용 최소 Deno 전역 선언
// Edge Function의 실제 런타임은 Supabase의 Deno이지만, Deno 확장이 없는
// 에디터(tsc 서버)가 `Deno.*`를 못 찾아 오류를 표시하므로 최소 시그니처만 선언한다.
// Deno 확장이 활성화된 환경에서는 이 파일 대신 실제 Deno 타입이 사용되면 된다.

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
