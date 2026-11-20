import { initNavbarAuth } from '../../shared/navbar-auth.js';

initNavbarAuth();
import('./week12-typing.js?v=20261120-release').catch(error => {
    document.getElementById('progress-status').textContent = '魔王挑戰暫時載入失敗，請重新整理或告訴老師。';
    console.error(error);
});
