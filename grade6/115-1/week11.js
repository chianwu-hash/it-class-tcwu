import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initImageLightbox } from '../../shared/image-lightbox.js';

// 教學示意與燈箱獨立初始化，身分或進度讀取失敗時仍可閱讀。
initImageLightbox();
const demo = document.querySelector('[data-arrangement-demo]');
if (demo) {
    const states = {
        original: { x: [230, 360, 270], y: [30, 108, 254], text: '原排列：左右沒有對齊，上下空隙也不同。' },
        align: { x: [300, 300, 300], y: [30, 108, 254], text: '只做置中對齊：三個中心排在同一條紫色線上，上下空隙仍是 30 和 82。' },
        distribute: { x: [230, 360, 270], y: [30, 134, 254], text: '只做垂直平均分配：上下空隙都是 56，但左右仍然沒有排齊。' },
        both: { x: [300, 300, 300], y: [30, 134, 254], text: '兩個都做：中心排齊，上下空隙也都是 56。對齊與平均分配，各有自己的工作！' }
    };
    const heights = [48, 64, 56];
    demo.querySelectorAll('[data-arrange]').forEach(button => button.addEventListener('click', () => {
        const mode = button.dataset.arrange;
        const state = states[mode];
        state.x.forEach((x, index) => {
            demo.querySelector(`#demo-shape-${index}`).setAttribute('transform', `translate(${x},${state.y[index]})`);
            if (index === 2) return;
            const start = state.y[index] + heights[index];
            const end = state.y[index + 1];
            demo.querySelector(`#gap-line-${index}`).setAttribute('d', `M470 ${start}V${end}M463 ${start}H477M463 ${end}H477`);
            const label = demo.querySelector(`#gap-text-${index}`);
            label.setAttribute('y', (start + end) / 2 + 6);
            label.textContent = `空隙 ${end - start}`;
        });
        demo.querySelector('#alignment-guide').setAttribute('opacity', ['align', 'both'].includes(mode) ? '1' : '0');
        demo.querySelectorAll('[data-arrange]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        demo.querySelector('#arrangement-feedback').textContent = state.text;
        demo.querySelector('#arrangement-svg-desc').textContent = state.text;
    }));
}
initNavbarAuth();
import './week11-typing.js?v=20261113-locator';
