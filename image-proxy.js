// ============================================
// IMAGE PROXY - Local to GitHub (Python Version)
// ============================================

(function() {
    console.log('🟢 Image Proxy Loaded (Python Version)');

    // 🔥 NETWORK PATH CONFIG
    const PROXY_URL = window.location.origin + '/proxy-image?file=';

    // 🔥 ORIGINAL getImagePath FUNCTION KO OVERRIDE KAREIN
    const originalGetImagePath = window.getImagePath;
    
    window.getImagePath = function(path) {
        if (!path || path.trim() === '') return null;
        let cleanPath = path.trim();

        if (cleanPath === '' || cleanPath === 'null' || cleanPath === 'undefined') return null;

        // 🔥 AGAR PATH PEHLE SE URL HAI
        if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            return cleanPath;
        }

        // 🔥 NETWORK PATH - PROXY KE THROUGH
        if (cleanPath.startsWith('\\\\')) {
            const encodedPath = encodeURIComponent(cleanPath);
            return PROXY_URL + encodedPath;
        }

        // 🔥 RELATIVE PATH
        if (!cleanPath.startsWith('/') && !cleanPath.startsWith('file://')) {
            return cleanPath;
        }

        return cleanPath;
    };

    // 🔥 showImage FUNCTION BHI UPDATE KAREIN
    const originalShowImage = window.showImage;
    window.showImage = function(imgSrc, label) {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('modalImage');
        const lbl = document.getElementById('modalLabel');

        if (imgSrc && imgSrc.trim() !== '') {
            let path = imgSrc.trim();
            
            // 🔥 CHECK: Agar HTML file hai
            const isHtml = path.toLowerCase().endsWith('.html');
            if (isHtml) {
                const htmlPath = window.getImagePath(path);
                if (htmlPath) {
                    window.open(htmlPath, '_blank');
                } else {
                    alert('HTML file not available.');
                }
                return;
            }

            // 🔥 NETWORK PATH - PROXY KE THROUGH
            if (path.startsWith('\\\\')) {
                const encodedPath = encodeURIComponent(path);
                path = PROXY_URL + encodedPath;
            }

            img.src = path;
            lbl.textContent = label || 'Image';
            modal.classList.add('show');
        } else {
            alert('No image available.');
        }
    };

    console.log('✅ Image Proxy Active (Python)');
    console.log('🔗 Proxy URL:', PROXY_URL);
})();