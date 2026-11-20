import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { initImageLightbox } from '../../shared/image-lightbox.js';

initImageLightbox();
initNavbarAuth();
import('./week12-typing.js?v=20261120-release').catch(error => {
    document.getElementById('progress-status').textContent = '打字闖關暫時載入失敗，請重新整理或告訴老師。';
    console.error(error);
});
