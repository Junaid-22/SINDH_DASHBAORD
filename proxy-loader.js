// ============================================
// PROXY LOADER - GitHub Pages Version
// ============================================

(function() {
    console.log('🔄 Checking for local proxy...');

    // 🔥 LOCAL PROXY SERVER URL (Live Server)
    const PROXY_SERVER = 'http://localhost:5500'; // Live Server default port
    // const PROXY_SERVER = 'http://127.0.0.1:5500'; // Alternative

    // 🔥 CHECK LOCAL PROXY AVAILABILITY
    async function checkProxy() {
        try {
            const response = await fetch(PROXY_SERVER + '/proxy-image.php?test=1', {
                method: 'GET',
                mode: 'cors'
            });
            return response.ok;
        } catch (e) {
            console.warn('⚠️ Local proxy not available:', e.message);
            return false;
        }
    }

    // 🔥 OVERRIDE getImagePath IF PROXY AVAILABLE
    async function initProxy() {
        const proxyAvailable = await checkProxy();
        
        if (proxyAvailable) {
            console.log('✅ Local proxy available! Images will be served from network.');
            
            // 🔥 ORIGINAL FUNCTION SAVE
            const originalGetImagePath = window.getImagePath;
            
            // 🔥 OVERRIDE
            window.getImagePath = function(path) {
                if (!path || path.trim() === '') return null;
                let cleanPath = path.trim();

                if (cleanPath === '' || cleanPath === 'null' || cleanPath === 'undefined') return null;

                if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
                    return cleanPath;
                }

                if (cleanPath.startsWith('\\\\')) {
                    const encodedPath = encodeURIComponent(cleanPath);
                    return PROXY_SERVER + '/proxy-image.php?file=' + encodedPath;
                }

                return cleanPath;
            };

            // 🔥 showImage BHI UPDATE
            const originalShowImage = window.showImage;
            window.showImage = function(imgSrc, label) {
                const modal = document.getElementById('imageModal');
                const img = document.getElementById('modalImage');
                const lbl = document.getElementById('modalLabel');

                if (imgSrc && imgSrc.trim() !== '') {
                    let path = imgSrc.trim();
                    
                    const isHtml = path.toLowerCase().endsWith('.html');
                    if (isHtml) {
                        const htmlPath = window.getImagePath(path);
                        if (htmlPath) {
                            window.open(htmlPath, '_blank');
                        }
                        return;
                    }

                    if (path.startsWith('\\\\')) {
                        const encodedPath = encodeURIComponent(path);
                        path = PROXY_SERVER + '/proxy-image.php?file=' + encodedPath;
                    }

                    img.src = path;
                    lbl.textContent = label || 'Image';
                    modal.classList.add('show');
                } else {
                    alert('No image available.');
                }
            };

            showToast('✅ Connected to Local Proxy', false);
        } else {
            console.log('ℹ️ Local proxy not available. Using default paths.');
            showToast('ℹ️ Local proxy not available', true);
        }
    }

    function showToast(msg, isError) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${isError ? '#ef4444' : '#22c55e'};
            color: white;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 99999;
            font-family: 'Segoe UI', sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideUp 0.3s ease;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // 🔥 START
    initProxy();

})();