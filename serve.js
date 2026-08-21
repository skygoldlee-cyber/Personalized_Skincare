// 정적 파일 서버 (HTTP Range 지원) - 오디오 탐색(시크) 안정화용
// 사용: node serve.js  [포트 기본 8000]
// 외부 라이브러리 없이 Node 내장 모듈만 사용.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

function send(res, status, headers, body) {
    res.writeHead(status, headers);
    res.end(body);
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad Request');
    }

    // 경로 탐색 공격 방지
    const safePath = path.normalize(pathname).replace(/^([.][.][/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    fs.stat(filePath, (err, stat) => {
        if (err) {
            return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found: ' + pathname);
        }
        if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            return fs.stat(filePath, (e2, st2) => {
                if (e2) return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
                serveFile(filePath, st2);
            });
        }
        serveFile(filePath, stat);
    });

    function serveFile(fp, stat) {
        const ext = path.extname(fp).toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';
        const size = stat.size;
        const range = req.headers.range;

        // Range 요청 처리 (오디오 시크 필수)
        if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range);
            if (m) {
                let start = m[1] ? parseInt(m[1], 10) : 0;
                let end = m[2] ? parseInt(m[2], 10) : size - 1;
                if (m[1] === '' && m[2] !== '') { // suffix range: bytes=-500
                    start = Math.max(0, size - parseInt(m[2], 10));
                    end = size - 1;
                }
                if (isNaN(start) || isNaN(end) || start > end || start >= size) {
                    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
                    return res.end();
                }
                end = Math.min(end, size - 1);
                res.writeHead(206, {
                    'Content-Type': type,
                    'Content-Range': `bytes ${start}-${end}/${size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': end - start + 1,
                    'Cache-Control': 'no-cache',
                });
                fs.createReadStream(fp, { start, end }).pipe(res);
                return;
            }
        }

        // 일반 요청
        res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
        });
        fs.createReadStream(fp).pipe(res);
    }
});

server.listen(PORT, () => {
    console.log(`정적 서버 시작 (Range 지원): http://localhost:${PORT}/index.html`);
});
