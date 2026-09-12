// src/scratchpad.js - 손글씨 계산 연습장(Canvas Scratchpad) 로직 모듈 (글로벌 스코프 실행)

let scratchpadCanvasInitialized = false;
let isDrawing = false;
let isEraser = false;
let lastX = 0;
let lastY = 0;

export function toggleCalcScratchpad() {
    const container = document.getElementById('calc-scratchpad-container');
    const toggleBtn = document.getElementById('calc-scratchpad-toggle');
    if (!container) return;
    
    const isHidden = container.classList.contains('is-hidden');
    if (isHidden) {
        container.classList.remove('is-hidden');
        toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> ✏️ 계산 연습장 닫기';
        
        if (!scratchpadCanvasInitialized) {
            initScratchpadCanvas();
        }
    } else {
        container.classList.add('is-hidden');
        toggleBtn.innerHTML = '<i class="fa-solid fa-pencil"></i> ✏️ 계산 연습장 열기';
    }
}

export function initScratchpadCanvas() {
    const canvas = document.getElementById('scratchpad-canvas');
    if (!canvas) return;
    if (scratchpadCanvasInitialized) return;

    const ctx = canvas.getContext('2d');
    
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const _style = getComputedStyle(document.documentElement);
    ctx.strokeStyle = _style.getPropertyValue('--color-text-main').trim();
    
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function startDraw(e) {
        isDrawing = true;
        const coords = getCoords(e);
        lastX = coords.x;
        lastY = coords.y;
        e.preventDefault();
    }
    
    function draw(e) {
        if (!isDrawing) return;
        const coords = getCoords(e);
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        
        lastX = coords.x;
        lastY = coords.y;
        e.preventDefault();
    }
    
    function stopDraw() {
        isDrawing = false;
    }
    
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    
    canvas.addEventListener('touchstart', startDraw);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDraw);
    canvas.addEventListener('touchcancel', stopDraw);
    
    scratchpadCanvasInitialized = true;
}

export function clearScratchpad() {
    const canvas = document.getElementById('scratchpad-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function toggleScratchpadEraser() {
    const canvas = document.getElementById('scratchpad-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const eraserBtn = document.getElementById('scratchpad-eraser-btn');
    
    isEraser = !isEraser;
    if (isEraser) {
        const _style = getComputedStyle(document.documentElement);
        ctx.strokeStyle = _style.getPropertyValue('--bg-canvas').trim();
        ctx.lineWidth = 12;
        eraserBtn.textContent = '연필 모드';
        eraserBtn.style.background = 'var(--color-primary)';
    } else {
        const _style2 = getComputedStyle(document.documentElement);
        ctx.strokeStyle = _style2.getPropertyValue('--color-text-main').trim();
        ctx.lineWidth = 3;
        eraserBtn.textContent = '지우개';
        eraserBtn.style.background = 'var(--color-gray)';
    }
}
