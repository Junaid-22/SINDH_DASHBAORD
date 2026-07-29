(function () {
    const startTime = performance.now();
    const loadingBar = document.getElementById('loadingBar');
    const progressText = document.getElementById('progressText');

    let allFeatures = [];
    let filteredFeatures = [];
    let currentDamageFilter = null;
    let isLoading = false;
    let selectedCulvertProps = null;

    // 🔥 YAHAN SE CACHE FUNCTIONS START KAREIN
    // ============================================
    // INDEXEDDB CACHE SYSTEM
    // ============================================

    const DB_NAME = 'CulvertsDB';
    const STORE_NAME = 'cacheStore';
    const CACHE_KEY = 'culvertsData';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveToCache(data) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(data, CACHE_KEY);
            await tx.complete;
            console.log('✅ Data saved to cache');
        } catch (err) {
            console.warn('⚠️ Cache save error:', err);
        }
    }

    async function loadFromCache() {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            return new Promise((resolve, reject) => {
                const request = store.get(CACHE_KEY);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.warn('⚠️ Cache load error:', err);
            return null;
        }
    }

    async function clearCache() {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(CACHE_KEY);
            await tx.complete;
            console.log('🗑️ Cache cleared');
        } catch (err) {
            console.warn('⚠️ Clear cache error:', err);
        }
    }

    // 🔥 YAHAN TAK CACHE FUNCTIONS
    // ============================================

    let lengthMin = 0, lengthMax = 0;
    let spanMin = 0, spanMax = 0;
    let widthMin = 0, widthMax = 0;

    const filterDistrict = document.getElementById('filterDistrict');
    const filterConstruction = document.getElementById('filterConstruction');
    const resetBtn = document.getElementById('resetFilters');
    const filterCountDisplay = document.getElementById('filterCountDisplay');
    const imageContent = document.getElementById('imageContent');

    // ---- MAP ----
    const map = L.map('map', {
        center: [30.3753, 69.3451],
        zoom: 5,
        zoomControl: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap, CartoDB'
    }).addTo(map);

    // ---- CLUSTER ----
    const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        disableClusteringAtZoom: 13,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        animateAddingMarkers: false,
        chunkedLoading: true,
        chunkInterval: 1000,
        chunkDelay: 2
    });
    map.addLayer(clusterGroup);

    // ---- ICON ----
    const culvertIcon = L.divIcon({
        className: 'culvert-marker',
        html: '<i class="fas fa-chevron-circle-down" style="color:#1f6da0; font-size:14px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);"></i>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -8]
    });

    // ============================================
    // IMAGE PATH CONVERTER
    // ============================================
    function getImagePath(path) {
        if (!path || path.trim() === '') return null;
        let cleanPath = path.trim();

        if (cleanPath === '' || cleanPath === 'null' || cleanPath === 'undefined') return null;

        // 🔥 AGAR PROXY AVAILABLE HAI TOH DIRECT PROXY URL
        if (window.proxyActive) {
            const PROXY_SERVER = 'http://localhost:8000';

            if (cleanPath.startsWith('\\\\')) {
                return PROXY_SERVER + '/proxy-image?file=' + encodeURIComponent(cleanPath);
            }

            if (cleanPath.startsWith('/efap-ss/')) {
                return PROXY_SERVER + cleanPath;
            }
        }

        // Agar path already URL hai
        if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            return cleanPath;
        }

        // Python server ke through image serve karo
        if (cleanPath.startsWith('\\\\')) {
            let parts = cleanPath.split('\\');
            parts = parts.filter(p => p !== '');
            let efapIndex = parts.indexOf('efap-ss');
            if (efapIndex !== -1) {
                cleanPath = '/' + parts.slice(efapIndex).join('/');
            } else {
                cleanPath = '/' + parts.join('/');
            }
        } else {
            cleanPath = cleanPath.replace(/\\/g, '/');
            if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
                cleanPath = '/' + cleanPath;
            }
        }

        cleanPath = cleanPath.replace(/\/+/g, '/');
        cleanPath = cleanPath.replace(/ /g, '%20');
        cleanPath = cleanPath.replace(/\[/g, '%5B');
        cleanPath = cleanPath.replace(/\]/g, '%5D');
        cleanPath = cleanPath.replace(/\(/g, '%28');
        cleanPath = cleanPath.replace(/\)/g, '%29');

        return cleanPath;
    }
    // ============================================
    // POPUP
    // ============================================
    function createPopupHtml(props) {
        let html = `<div style="min-width:200px;max-width:280px;font-size:0.65rem;">
        <div class="popup-title" style="font-size:0.75rem;font-weight:700;color:#0b2a4a;border-bottom:2px solid #1a3f62;padding-bottom:4px;margin-bottom:6px;">
            🚧 ${props.Culvert_ID || 'Culvert'}
        </div>
        
        <!-- Surveyor & District -->
        <div class="popup-field"><span class="label">Surveyor</span><span class="value">${props.Surveyor_Name || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">District</span><span class="value">${props.District || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Date/Time</span><span class="value">${props.Date_Time || 'N/A'}</span></div>
        
        <!-- Remarks -->
        <div class="popup-field" style="border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin-bottom:4px;">
            <span class="label">Remarks</span>
            <span class="value" style="font-style:italic;color:#64748b;">${props.Remarks || 'N/A'}</span>
        </div>
        
        <!-- Construction -->
        <div class="popup-field"><span class="label">Main Const.</span><span class="value">${props.Main_Construction_Type || 'N/A'}</span></div>
        
        <!-- Material Types -->
        <div style="font-size:0.55rem;font-weight:600;color:#1a3f62;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
            <i class="fas fa-cubes"></i> Materials
        </div>
        <div class="popup-field"><span class="label">Slab</span><span class="value">${props.Material_Type_Slab || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Side Wall</span><span class="value">${props.Material_Type_Side_Wall || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Wing Wall</span><span class="value">${props.Material_Type_Wing_Wall || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Parapet</span><span class="value">${props.Material_Type_Parapet || 'N/A'}</span></div>
        
        <!-- Dimensions -->
        <div style="font-size:0.55rem;font-weight:600;color:#1a3f62;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
            <i class="fas fa-ruler-combined"></i> Dimensions
        </div>
        <div class="popup-field"><span class="label">Road Width</span><span class="value">${props.Clear_Road_Width || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Parapet Ht</span><span class="value">${props.Parapet_Height || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Parapet Len</span><span class="value">${props.Parapet_Length || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">No. of Span</span><span class="value">${props.No_of_Span || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Culvert Width</span><span class="value">${props.Total_Culvert_Width || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">Culvert Len</span><span class="value">${props.Culvert_Length || 'N/A'}</span></div>
        
        <!-- Road Info -->
        <div style="font-size:0.55rem;font-weight:600;color:#1a3f62;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
            <i class="fas fa-road"></i> Road Info
        </div>
        <div class="popup-field"><span class="label">Road Name</span><span class="value">${props.Road_Name || 'N/A'}</span></div>
        <div class="popup-field"><span class="label">RF</span><span class="value">${props.RF || 'N/A'}</span></div>
        
    </div>`;
        return html;
    }

    // ============================================
    // SHOW IMAGE MODAL
    // ============================================
    window.showImage = function (imgSrc, label) {
        const modal = document.getElementById('imageModal');
        const img = document.getElementById('modalImage');
        const lbl = document.getElementById('modalLabel');

        if (imgSrc && imgSrc.trim() !== '') {
            let path = imgSrc.trim();

            // CHECK: Agar image HTML file hai toh?
            const isHtml = path.toLowerCase().endsWith('.html');

            if (isHtml) {
                // HTML file hai - new tab mein open karo
                const htmlPath = getImagePath(path);
                window.open(htmlPath, '_blank');
                return;
            }

            // Normal image path convert
            if (path.startsWith('\\\\')) {
                let parts = path.split('\\');
                parts = parts.filter(p => p !== '');
                let efapIndex = parts.indexOf('efap-ss');
                if (efapIndex !== -1) {
                    path = '/' + parts.slice(efapIndex).join('/');
                } else {
                    path = '/' + parts.join('/');
                }
            } else if (path.includes('\\')) {
                path = path.replace(/\\/g, '/');
            }
            path = path.replace(/ /g, '%20');

            img.src = path;
            lbl.textContent = label || 'Image';
            modal.classList.add('show');
        } else {
            alert('No image available.');
        }
    };
    document.getElementById('closeModal').addEventListener('click', function () {
        document.getElementById('imageModal').classList.remove('show');
    });
    document.getElementById('imageModal').addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('show');
    });

    // ============================================
    // FETCH HTML IMAGES
    // ============================================
    async function fetchHtmlImages(htmlPath, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            console.log('📄 Fetching HTML:', htmlPath);
            const response = await fetch(htmlPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const htmlText = await response.text();

            console.log('📄 HTML loaded, length:', htmlText.length);

            const images = [];
            const seen = new Set();

            // Pattern 1: <img src="...">
            const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            while ((match = imgRegex.exec(htmlText)) !== null) {
                let src = match[1];
                if (src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)/i) && !seen.has(src)) {
                    console.log('🖼️ Found img src:', src);
                    seen.add(src);
                    images.push(src);
                }
            }

            // Pattern 2: <img src=...> (without quotes)
            const imgRegex2 = /<img[^>]+src=([^\s>]+)/gi;
            while ((match = imgRegex2.exec(htmlText)) !== null) {
                let src = match[1].replace(/["']/g, '');
                if (src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)/i) && !seen.has(src)) {
                    console.log('🖼️ Found img src (no quotes):', src);
                    seen.add(src);
                    images.push(src);
                }
            }

            console.log('📊 Total valid images found:', images.length);

            if (images.length > 0) {
                let imgHtml = '<div class="html-grid">';
                images.forEach((img, index) => {
                    let imgUrl = img;

                    // STEP 1: file:// ko convert karo
                    if (imgUrl.startsWith('file://')) {
                        let parts = imgUrl.split('/');
                        let efapIndex = parts.indexOf('efap-ss');
                        if (efapIndex !== -1) {
                            imgUrl = '/' + parts.slice(efapIndex).join('/');
                        } else {
                            return;
                        }
                    }
                    // STEP 2: backslashes ko forward slash mein convert
                    else if (imgUrl.includes('\\')) {
                        imgUrl = imgUrl.replace(/\\/g, '/');
                    }
                    // STEP 3: relative path ko absolute mein convert
                    else if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/')) {
                        const basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);
                        imgUrl = basePath + imgUrl;
                    }

                    // STEP 4: spaces encode karo
                    imgUrl = imgUrl.replace(/ /g, '%20');

                    console.log(`✅ Image ${index + 1} URL:`, imgUrl);

                    // 🔥 FIX: Direct image path use karo showImage ke liye
                    imgHtml += `
                    <div class="html-grid-item" onclick="window.showImage('${imgUrl}','Image from HTML ${index + 1}')">
                        <img src="${imgUrl}" alt="HTML Image ${index + 1}" 
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-img\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'color:#ef4444;\\'></i><br><span style=\\'font-size:0.45rem;color:#94a3b8;\\'>${img.split('/').pop()}</span></div>'">
                    </div>
                `;
                });
                imgHtml += '</div>';
                container.innerHTML = imgHtml;
            } else {
                container.innerHTML = `
                <div class="loading-text" style="color:#f59e0b;">
                    <i class="fas fa-info-circle"></i>
                    <br>No images found in HTML
                    <br><span style="font-size:0.45rem;color:#94a3b8;">Check console for details</span>
                </div>
            `;
            }
        } catch (err) {
            console.error('❌ Error fetching HTML:', err);
            container.innerHTML = `
            <div class="loading-text" style="color:#ef4444;">
                <i class="fas fa-exclamation-circle"></i>
                <br>Failed to load HTML
                <br><span style="font-size:0.45rem;">${err.message}</span>
            </div>
        `;
        }
    }

    // ============================================
    // CREATE HTML CARD
    // ============================================
    function createHtmlCard(imgPath, label, culvertId) {
        let path = imgPath.trim();

        // Agar \\Server se start ho raha hai
        if (path.startsWith('\\\\')) {
            let parts = path.split('\\');
            parts = parts.slice(3);
            path = '/' + parts.join('/');
        } else {
            path = path.replace(/\\/g, '/');
        }
        path = path.replace(/ /g, '%20');

        const containerId = `htmlContainer_${culvertId}_${label}`;

        console.log('📄 Creating HTML Card for:', path);

        setTimeout(() => {
            fetchHtmlImages(path, containerId);
        }, 500);

        return `
        <div class="html-card" id="htmlCard_${culvertId}_${label}">
            <div class="html-label">${label} 📄</div>
            <div id="${containerId}" class="loading-text">
                <i class="fas fa-spinner fa-spin"></i>
                <br>Loading HTML images...
            </div>
            <div class="html-footer">Images extracted from HTML</div>
        </div>
    `;
    }

    // ============================================
    // UPDATE IMAGE PREVIEW
    // ============================================
    function updateImagePreview(props) {
        if (!props) {
            imageContent.innerHTML = `
                <div style="display:flex;flex-direction:column;height:100%;flex:1;gap:10px;padding:4px 0;min-height:0;">
                    <div style="text-align:center;padding:4px 0;color:#94a3b8;font-size:0.65rem;font-weight:500;flex-shrink:0;">
                        <i class="fas fa-map-pin"></i> Click any marker to view images
                    </div>
                    <div style="background:linear-gradient(145deg, #0b2a4a, #1a3f62);border:2px solid #1a3f62;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-up" style="font-size:1rem;color:#8fcbff;"></i>
                        <i class="fas fa-culvert" style="font-size:2.5rem;color:#8fcbff;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Top</span>
                    </div>
                    <div style="background:linear-gradient(145deg, #0b2a4a, #1a3f62);border:2px solid #1a3f62;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-left" style="font-size:1rem;color:#8fcbff;"></i>
                        <i class="fas fa-culvert" style="font-size:2.5rem;color:#8fcbff;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Left</span>
                    </div>
                    <div style="background:linear-gradient(145deg, #0b2a4a, #1a3f62);border:2px solid #1a3f62;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-right" style="font-size:1rem;color:#8fcbff;"></i>
                        <i class="fas fa-culvert" style="font-size:2.5rem;color:#8fcbff;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Right</span>
                    </div>
                    <div style="text-align:center;color:#94a3b8;font-size:0.5rem;padding:4px 0;flex-shrink:0;">
                        <i class="fas fa-info-circle"></i> Select a culvert to view images
                    </div>
                </div>
            `;
            return;
        }

        const culvertId = props.Culvert_ID || 'Unknown';
        const district = props.District || '';
        const location = props.Location || '';
        const routeId = props.Route_ID || '';

        function createImageCard(imgPath, label, culvertId) {
            if (imgPath && imgPath.trim() !== '') {
                const isHtml = imgPath.toLowerCase().endsWith('.html');
                if (isHtml) {
                    return createHtmlCard(imgPath, label, culvertId);
                } else {
                    const path = getImagePath(imgPath);
                    return `
                <div class="image-card-large" onclick="window.showImage('${path}','${label} Image - ${culvertId}')">
                    <div class="image-label">${label}</div>
                    <img src="${path}" alt="${label}" 
                        onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-image\\' style=\\'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;min-height:80px;width:100%;\\'><i class=\\'fas fa-image\\' style=\\'font-size:2rem;color:#94a3b8;margin-bottom:6px;\\'></i><span style=\\'font-size:0.6rem;color:#94a3b8;font-weight:500;\\'>${label} Not Available</span></div>'">
            
                </div>
            `;
                }
            } else {
                return `
            <div class="image-card-large" style="background:#f8fafc;border:2px dashed #cbd5e1;min-height:60px;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 15px;border-radius:8px;width:100%;">
                <i class="fas fa-culvert" style="font-size:1.8rem;color:#cbd5e1;"></i>
                <span style="font-size:0.65rem;color:#94a3b8;font-weight:500;">No ${label} Image</span>
            </div>
        `;
            }
        }

        imageContent.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;flex:1;gap:6px;min-height:0;">
                <div class="culvert-name" style="flex-shrink:0;">🚧 ${culvertId}</div>
                <div class="culvert-detail" style="flex-shrink:0;">
                    <i class="fas fa-city"></i> ${district} 
                    ${routeId ? `| <i class="fas fa-route"></i> ${routeId}` : ''}
                    ${location ? `| <i class="fas fa-map-pin"></i> ${location}` : ''}
                </div>
                
                <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-height:0;">
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-up"></i> TOP VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Top_Image, 'Top', culvertId)}</div>
                    
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-left"></i> LEFT VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Left_Image, 'Left', culvertId)}</div>
                    
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-right"></i> RIGHT VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Right_Image, 'Right', culvertId)}</div>
                </div>
                
                <div style="text-align:center;color:#94a3b8;font-size:0.45rem;padding:4px 0;flex-shrink:0;border-top:1px solid #e2e8f0;">
                    <i class="fas fa-info-circle"></i> Click any image to enlarge
                </div>
            </div>
        `;
    }

    // ============================================
    // SELECTED CULVERT DAMAGES
    // ============================================
    function updateSelectedCulvertDamages(props) {
        const container = document.getElementById('selectedCulvertDamages');
        const nameContainer = document.getElementById('selectedCulvertName');

        if (!props) {
            nameContainer.textContent = 'Click a marker';
            container.innerHTML = `
                <div style="font-size:0.55rem;color:#94a3b8;text-align:center;padding:10px 0;font-style:italic;">
                    👆 Select a culvert to view damages
                </div>
            `;
            return;
        }

        nameContainer.textContent = `🚧 ${props.Culvert_ID || 'Unknown'} - ${props.District || ''}`;

        const damageTypes = [
            { key: 'Slab', img: props.Slab___Damage_Picture, job: props.Slab_Job, qty: props.Slab_Qty__, priority: props.Slab_Priority, icon: 'fa-border-all' },
            { key: 'Side Wall', img: props.Side_Wall___Damage_Picture, job: props.Side_Wall_Job, qty: props.Side_Wall_Qty__, priority: props.Side_Wall_Priority, icon: 'fa-arrows-alt-h' },
            { key: 'Wing Wall', img: props.Wing_Wall___Damage_Picture, job: props.Wing_Wall_Job, qty: props.Wing_Wall_Qty__, priority: props.Wing_Wall_Priority, icon: 'fa-arrows-alt-v' },
            { key: 'Parapet', img: props.Parapet___Damage_Picture, job: props.Parapet_Job, qty: props.Parapet_Qty__, priority: props.Parapet_Priority, icon: 'fa-shield-alt' },
            { key: 'Other', img: props.Other_Damage_Picture, job: props.Other_Damages_Job, qty: props.Other_Damages_Qty__, priority: props.Other_Damages_Priority, icon: 'fa-tools' }
        ];

        const validDamages = damageTypes.filter(d =>
            (d.img && d.img.trim() !== '' && d.img !== 'null' && d.img !== 'undefined') ||
            (d.job && d.job.trim() !== '') ||
            (d.priority && d.priority.trim() !== '')
        );

        if (validDamages.length === 0) {
            container.innerHTML = `
                <div style="font-size:0.55rem;color:#94a3b8;text-align:center;padding:10px 0;font-style:italic;">
                    ✅ No damages reported for this culvert
                </div>
            `;
            return;
        }

        let html = '';
        validDamages.forEach(d => {
            const priorityClass = d.priority || 'None';
            const hasImage = d.img && d.img.trim() !== '' && d.img !== 'null' && d.img !== 'undefined';
            const imgPath = hasImage ? getImagePath(d.img) : '';

            html += `
                <button class="damage-detail-btn" onclick="showDamageDetail('${d.key}', '${imgPath}', '${d.job || ''}', '${d.qty || ''}', '${d.priority || ''}', '${props.Culvert_ID || ''}')">
                    <i class="fas ${d.icon}"></i> ${d.key}
                    <span class="dmg-priority ${priorityClass}">${d.priority || 'None'}</span>
                    ${hasImage ? '<span class="dmg-badge"><i class="fas fa-image"></i></span>' : ''}
                    ${d.job ? `<span style="font-size:0.5rem;color:#64748b;margin-left:4px;">${d.job}</span>` : ''}
                </button>
            `;
        });
        container.innerHTML = html;
    }

    // ============================================
    // SHOW DAMAGE DETAIL
    // ============================================
    window.showDamageDetail = function (type, imgPath, job, qty, priority, culvertId) {
        const modal = document.getElementById('damageModal');
        const content = document.getElementById('damageModalContent');

        const priorityColors = {
            'Urgent': '#ef4444',
            'High': '#f59e0b',
            'Medium': '#3b82f6',
            'Low': '#22c55e',
            'None': '#94a3b8'
        };
        const priorityColor = priorityColors[priority] || '#94a3b8';

        const displayJob = (job && job !== 'null' && job !== 'undefined') ? job : 'Not specified';
        const displayQty = (qty && qty !== 'null' && qty !== 'undefined') ? qty : 'N/A';
        const displayPriority = (priority && priority !== 'null' && priority !== 'undefined') ? priority : 'None';

        const imgUrl = imgPath && imgPath !== 'null' && imgPath !== 'undefined' ? imgPath : '';

        content.innerHTML = `
            <button class="close-dmg-modal" onclick="document.getElementById('damageModal').classList.remove('show')">&times;</button>
            <h3><i class="fas fa-bolt" style="color:#f59e0b;"></i> ${type} Damage Detail</h3>
            <div style="margin-bottom:8px;">
                <span style="font-size:0.7rem;color:#94a3b8;">Culvert: <strong>${culvertId || 'Unknown'}</strong></span>
            </div>
            
            <div class="dmg-image-container" onclick="window.openFullScreenImage('${imgUrl}', '${type} Damage - ${culvertId || 'Culvert'}')" style="cursor:pointer;">
                ${imgUrl ? `<img src="${imgUrl}" alt="${type} Damage" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-dmg-img\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'font-size:2rem;display:block;color:#ef4444;\\'></i>Image not available</div>'">` :
                `<div class="no-dmg-img"><i class="fas fa-camera" style="font-size:2rem;display:block;color:#94a3b8;"></i>No image available</div>`}
                ${imgUrl ? `<div style="position:absolute;bottom:5px;right:10px;background:rgba(0,0,0,0.6);color:white;font-size:0.5rem;padding:2px 8px;border-radius:10px;"></div>` : ''}
            </div>
            
            <div style="margin-top:8px;">
                <div class="dmg-field">
                    <span class="dmg-label"><i class="fas fa-tag"></i> Type</span>
                    <span class="dmg-value"><strong>${type}</strong></span>
                </div>
                <div class="dmg-field">
                    <span class="dmg-label"><i class="fas fa-tasks"></i> Job</span>
                    <span class="dmg-value">${displayJob}</span>
                </div>
                <div class="dmg-field">
                    <span class="dmg-label"><i class="fas fa-percentage"></i> Quantity</span>
                    <span class="dmg-value">${displayQty}</span>
                </div>
                <div class="dmg-field" style="border-bottom:2px solid ${priorityColor};">
                    <span class="dmg-label"><i class="fas fa-flag"></i> Priority</span>
                    <span class="dmg-value" style="color:${priorityColor};font-weight:700;">${displayPriority}</span>
                </div>
            </div>
            
            <div style="margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:0.6rem;color:#94a3b8;text-align:center;">
                <i class="fas fa-info-circle"></i> Click image to enlarge | Click outside to close
            </div>
        `;

        modal.classList.add('show');
    };

    // ============================================
    // FULL SCREEN IMAGE
    // ============================================
    window.openFullScreenImage = function (imgUrl, label) {
        if (imgUrl && imgUrl !== 'null' && imgUrl !== 'undefined' && imgUrl !== '') {
            const modal = document.getElementById('imageModal');
            const img = document.getElementById('modalImage');
            const lbl = document.getElementById('modalLabel');
            img.src = imgUrl;
            lbl.textContent = label || 'Image';
            modal.classList.add('show');
        } else {
            alert('No image available.');
        }
    };

    // ============================================
    // SLIDERS
    // ============================================
    function initSliders() {
        const lengthSlider = document.getElementById('lengthSlider');
        noUiSlider.create(lengthSlider, {
            start: [lengthMin, lengthMax],
            connect: true,
            range: { min: lengthMin, max: lengthMax },
            step: 0.5,
            tooltips: false,
            format: { to: v => Math.round(v * 10) / 10, from: v => Math.round(v * 10) / 10 }
        });
        lengthSlider.noUiSlider.on('update', function (values) {
            lengthMin = Math.round(parseFloat(values[0]) * 10) / 10;
            lengthMax = Math.round(parseFloat(values[1]) * 10) / 10;
            document.getElementById('lengthValue').textContent = `${lengthMin} - ${lengthMax}`;
        });

        const spanSlider = document.getElementById('spanSlider');
        noUiSlider.create(spanSlider, {
            start: [spanMin, spanMax],
            connect: true,
            range: { min: spanMin, max: spanMax },
            step: 1,
            tooltips: false,
            format: { to: v => Math.round(v), from: v => Math.round(v) }
        });
        spanSlider.noUiSlider.on('update', function (values) {
            spanMin = Math.round(values[0]);
            spanMax = Math.round(values[1]);
            document.getElementById('spanValue').textContent = `${spanMin} - ${spanMax}`;
        });

        const widthSlider = document.getElementById('widthSlider');
        noUiSlider.create(widthSlider, {
            start: [widthMin, widthMax],
            connect: true,
            range: { min: widthMin, max: widthMax },
            step: 0.5,
            tooltips: false,
            format: { to: v => Math.round(v * 10) / 10, from: v => Math.round(v * 10) / 10 }
        });
        widthSlider.noUiSlider.on('update', function (values) {
            widthMin = Math.round(parseFloat(values[0]) * 10) / 10;
            widthMax = Math.round(parseFloat(values[1]) * 10) / 10;
            document.getElementById('widthValue').textContent = `${widthMin} - ${widthMax}`;
        });

        lengthSlider.noUiSlider.on('change', applyFilters);
        spanSlider.noUiSlider.on('change', applyFilters);
        widthSlider.noUiSlider.on('change', applyFilters);
    }

    // ============================================
    // UPDATE SLIDER RANGES
    // ============================================
    function updateSliderRanges(features) {
        let maxLength = 0, maxSpan = 0, maxWidth = 0;
        let minLength = Infinity, minSpan = Infinity, minWidth = Infinity;

        for (let i = 0; i < features.length; i++) {
            const p = features[i].properties;
            const len = parseFloat(p?.Culvert_Length);
            if (!isNaN(len)) {
                if (len > maxLength) maxLength = len;
                if (len < minLength) minLength = len;
            }
            const span = parseFloat(p?.No_of_Span);
            if (!isNaN(span)) {
                if (span > maxSpan) maxSpan = span;
                if (span < minSpan) minSpan = span;
            }
            const width = parseFloat(p?.Total_Culvert_Width);
            if (!isNaN(width)) {
                if (width > maxWidth) maxWidth = width;
                if (width < minWidth) minWidth = width;
            }
        }

        lengthMin = minLength === Infinity ? 0 : Math.floor(minLength);
        lengthMax = maxLength === 0 ? 10 : Math.ceil(maxLength);
        spanMin = minSpan === Infinity ? 0 : Math.floor(minSpan);
        spanMax = maxSpan === 0 ? 5 : Math.ceil(maxSpan);
        widthMin = minWidth === Infinity ? 0 : Math.floor(minWidth);
        widthMax = maxWidth === 0 ? 20 : Math.ceil(maxWidth);

        const lengthSlider = document.getElementById('lengthSlider');
        const spanSlider = document.getElementById('spanSlider');
        const widthSlider = document.getElementById('widthSlider');

        if (lengthSlider.noUiSlider) {
            lengthSlider.noUiSlider.updateOptions({
                range: { min: lengthMin, max: lengthMax },
                start: [lengthMin, lengthMax]
            });
        }
        if (spanSlider.noUiSlider) {
            spanSlider.noUiSlider.updateOptions({
                range: { min: spanMin, max: spanMax },
                start: [spanMin, spanMax]
            });
        }
        if (widthSlider.noUiSlider) {
            widthSlider.noUiSlider.updateOptions({
                range: { min: widthMin, max: widthMax },
                start: [widthMin, widthMax]
            });
        }

        document.getElementById('lengthValue').textContent = `${lengthMin} - ${lengthMax}`;
        document.getElementById('spanValue').textContent = `${spanMin} - ${spanMax}`;
        document.getElementById('widthValue').textContent = `${widthMin} - ${widthMax}`;
    }

    // ============================================
    // UPDATE FILTER OPTIONS
    // ============================================
    function updateFilterOptions(features) {
        const districts = new Set();
        const constructions = new Set();

        for (let i = 0; i < features.length; i++) {
            const p = features[i].properties;
            if (p?.District) districts.add(p.District);
            if (p?.Main_Construction_Type) constructions.add(p.Main_Construction_Type);
        }

        const currentDistrict = filterDistrict.value;
        filterDistrict.innerHTML = '<option value="">All</option>';
        [...districts].sort().forEach(d => {
            filterDistrict.innerHTML += `<option value="${d}">${d}</option>`;
        });
        filterDistrict.value = currentDistrict;

        const currentConst = filterConstruction.value;
        filterConstruction.innerHTML = '<option value="">All</option>';
        [...constructions].sort().forEach(c => {
            filterConstruction.innerHTML += `<option value="${c}">${c}</option>`;
        });
        filterConstruction.value = currentConst;
    }

    // ============================================
    // UPDATE DAMAGE BADGES
    // ============================================
    function updateDamageBadges(features) {
        const counts = { Slab: 0, 'Side Wall': 0, 'Wing Wall': 0, Parapet: 0, Other: 0 };
        for (let i = 0; i < features.length; i++) {
            const p = features[i].properties;
            if (p?.Slab___Damage_Picture && p.Slab___Damage_Picture.trim() !== '') counts.Slab++;
            if (p?.Side_Wall___Damage_Picture && p.Side_Wall___Damage_Picture.trim() !== '') counts['Side Wall']++;
            if (p?.Wing_Wall___Damage_Picture && p.Wing_Wall___Damage_Picture.trim() !== '') counts['Wing Wall']++;
            if (p?.Parapet___Damage_Picture && p.Parapet___Damage_Picture.trim() !== '') counts.Parapet++;
            if (p?.Other_Damage_Picture && p.Other_Damage_Picture.trim() !== '') counts.Other++;
        }
        document.getElementById('badgeSlab').textContent = counts.Slab;
        document.getElementById('badgeSideWall').textContent = counts['Side Wall'];
        document.getElementById('badgeWingWall').textContent = counts['Wing Wall'];
        document.getElementById('badgeParapet').textContent = counts.Parapet;
        document.getElementById('badgeOther').textContent = counts.Other;
    }

    // ============================================
    // RENDER MARKERS
    // ============================================
    function renderMarkers() {
        clusterGroup.clearLayers();

        let featuresToRender = filteredFeatures;
        if (featuresToRender.length === 0 && allFeatures.length > 0) {
            featuresToRender = allFeatures;
        }

        if (featuresToRender.length === 0) {
            filterCountDisplay.textContent = '0';
            updateImagePreview(null);
            updateSelectedCulvertDamages(null);
            return;
        }

        const markers = [];
        for (let i = 0; i < featuresToRender.length; i++) {
            const f = featuresToRender[i];
            if (f.geometry && f.geometry.type === 'Point') {
                const coords = f.geometry.coordinates;
                const marker = L.marker([coords[1], coords[0]], { icon: culvertIcon });
                marker._culvertProps = f.properties;
                markers.push(marker);
            }
        }

        clusterGroup.addLayers(markers);
        filterCountDisplay.textContent = markers.length;

        if (markers.length > 0) {
            try {
                const bounds = clusterGroup.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20] });
                }
            } catch (e) { }
        }

        clusterGroup.off('click');
        clusterGroup.on('click', function (e) {
            const marker = e.layer;
            if (marker._culvertProps) {
                updateImagePreview(marker._culvertProps);
                updateSelectedCulvertDamages(marker._culvertProps);
                selectedCulvertProps = marker._culvertProps;

                if (!marker._popup) {
                    marker.bindPopup(createPopupHtml(marker._culvertProps));
                }
            }
        });
    }

    // ============================================
    // APPLY FILTERS
    // ============================================
    function applyFilters() {
        if (isLoading) return;

        const district = filterDistrict.value;
        const construction = filterConstruction.value;

        const result = [];
        for (let i = 0; i < allFeatures.length; i++) {
            const f = allFeatures[i];
            const p = f.properties;
            if (!p) continue;

            if (district && p.District !== district) continue;
            if (construction && p.Main_Construction_Type !== construction) continue;

            const length = parseFloat(p.Culvert_Length);
            if (!isNaN(length)) {
                if (length < lengthMin || length > lengthMax) continue;
            }

            const span = parseFloat(p.No_of_Span);
            if (!isNaN(span)) {
                if (span < spanMin || span > spanMax) continue;
            }

            const width = parseFloat(p.Total_Culvert_Width);
            if (!isNaN(width)) {
                if (width < widthMin || width > widthMax) continue;
            }

            if (currentDamageFilter) {
                const damageMap = {
                    'Slab': p.Slab___Damage_Picture,
                    'Side Wall': p.Side_Wall___Damage_Picture,
                    'Wing Wall': p.Wing_Wall___Damage_Picture,
                    'Parapet': p.Parapet___Damage_Picture,
                    'Other': p.Other_Damage_Picture
                };
                const img = damageMap[currentDamageFilter];
                if (!img || img.trim() === '') continue;
            }

            result.push(f);
        }

        filteredFeatures = result;
        updateDamageBadges(filteredFeatures);
        renderMarkers();
        updateStats();

        if (selectedCulvertProps) {
            const stillExists = filteredFeatures.some(f =>
                f.properties?.Culvert_ID === selectedCulvertProps.Culvert_ID
            );
            if (!stillExists) {
                updateImagePreview(null);
                updateSelectedCulvertDamages(null);
                selectedCulvertProps = null;
            }
        }
    }

    // ============================================
    // UPDATE STATS
    // ============================================
    function updateStats() {
        document.getElementById('pointCount').textContent = allFeatures.length;

        const allDistricts = new Set();
        for (let i = 0; i < allFeatures.length; i++) {
            if (allFeatures[i].properties?.District) {
                allDistricts.add(allFeatures[i].properties.District);
            }
        }
        document.getElementById('districtCount').textContent = allDistricts.size;
        document.getElementById('filteredCount').textContent = filteredFeatures.length;

        document.getElementById('statsTotalCulverts').textContent = filteredFeatures.length;

        const filteredDistricts = new Set();
        for (let i = 0; i < filteredFeatures.length; i++) {
            if (filteredFeatures[i].properties?.District) {
                filteredDistricts.add(filteredFeatures[i].properties.District);
            }
        }
        document.getElementById('statsDistricts').textContent = filteredDistricts.size;
        document.getElementById('statsFiltered').textContent = filteredFeatures.length;
    }

    // ============================================
    // RESET FILTERS
    // ============================================
    function resetFilters() {
        if (isLoading) return;

        filterDistrict.value = '';
        filterConstruction.value = '';

        const lengthSlider = document.getElementById('lengthSlider');
        const spanSlider = document.getElementById('spanSlider');
        const widthSlider = document.getElementById('widthSlider');

        if (lengthSlider.noUiSlider) {
            const lengthRange = lengthSlider.noUiSlider.options.range;
            lengthSlider.noUiSlider.set([lengthRange.min, lengthRange.max]);
        }
        if (spanSlider.noUiSlider) {
            const spanRange = spanSlider.noUiSlider.options.range;
            spanSlider.noUiSlider.set([spanRange.min, spanRange.max]);
        }
        if (widthSlider.noUiSlider) {
            const widthRange = widthSlider.noUiSlider.options.range;
            widthSlider.noUiSlider.set([widthRange.min, widthRange.max]);
        }

        currentDamageFilter = null;
        document.querySelectorAll('.damage-btn').forEach(b => b.classList.remove('active'));

        selectedCulvertProps = null;
        updateImagePreview(null);
        updateSelectedCulvertDamages(null);

        applyFilters();
    }

    // ============================================
    // LOAD DATA
    // ============================================
    async function loadGeoJSON() {
        if (isLoading) return;
        isLoading = true;

        try {
            progressText.textContent = 'Loading...';
            progressText.style.display = 'block';

            // 🔥 PEHLE CACHE CHECK KAREIN
            const cachedData = await loadFromCache();

            if (cachedData && cachedData.features && cachedData.features.length > 0) {
                console.log('📦 Loading from cache...');
                allFeatures = cachedData.features;
                filteredFeatures = [...allFeatures];

                updateSliderRanges(allFeatures);
                initSliders();
                updateFilterOptions(allFeatures);
                updateDamageBadges(allFeatures);
                renderMarkers();
                updateStats();
                updateImagePreview(null);

                const endTime = performance.now();
                document.getElementById('loadTime').textContent = ((endTime - startTime) / 1000).toFixed(1) + 's (cached)';

                progressText.textContent = `✅ ${allFeatures.length} (cached)`;
                progressText.style.background = 'rgba(0,150,0,0.8)';
                setTimeout(() => {
                    progressText.style.display = 'none';
                    loadingBar.style.width = '100%';
                    setTimeout(() => { loadingBar.style.display = 'none'; }, 300);
                }, 500);

                isLoading = false;

                // 🔥 BACKGROUND MEIN FRESH DATA FETCH KAREIN (Update ke liye)
                fetchFreshData();
                return;
            }

            // 🔥 CACHE MEIN NAHI HAI TOH FETCH KAREIN
            console.log('🌐 Fetching fresh data...');
            const response = await fetch('CULVERTS.geojson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                throw new Error('No features found');
            }

            allFeatures = data.features;
            filteredFeatures = [...allFeatures];

            // 🔥 CACHE MEIN SAVE KAREIN
            await saveToCache(data);

            updateSliderRanges(allFeatures);
            initSliders();
            updateFilterOptions(allFeatures);
            updateDamageBadges(allFeatures);
            renderMarkers();
            updateStats();
            updateImagePreview(null);

            const endTime = performance.now();
            document.getElementById('loadTime').textContent = ((endTime - startTime) / 1000).toFixed(1) + 's';

            progressText.textContent = `✅ ${allFeatures.length}`;
            progressText.style.background = 'rgba(0,180,0,0.8)';
            setTimeout(() => {
                progressText.style.display = 'none';
                loadingBar.style.width = '100%';
                setTimeout(() => { loadingBar.style.display = 'none'; }, 300);
            }, 500);

            isLoading = false;

        } catch (err) {
            console.error(err);
            progressText.textContent = '❌ Error';
            progressText.style.background = 'rgba(220,38,38,0.9)';
            document.getElementById('errorContainer').innerHTML = `
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,38,38,0.95);color:white;padding:20px 35px;border-radius:16px;z-index:1000;text-align:center;font-size:0.9rem;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;display:block;margin-bottom:10px;"></i>
                ${err.message}<br><br>
                <span style="background:rgba(255,255,255,0.2);padding:4px 16px;border-radius:20px;font-family:monospace;">CULVERTS.geojson</span>
            </div>
        `;
            isLoading = false;
        }
    }

    // 🔥 BACKGROUND MEIN FRESH DATA FETCH (Cache update ke liye)
    async function fetchFreshData() {
        try {
            console.log('🔄 Fetching fresh data in background...');
            const response = await fetch('CULVERTS.geojson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                // 🔥 AGAR NAYA DATA HAI TOH CACHE UPDATE KAREIN
                const cachedData = await loadFromCache();
                if (cachedData && cachedData.features?.length === data.features.length) {
                    console.log('✅ Data is up to date');
                    return;
                }

                await saveToCache(data);
                console.log('🔄 Cache updated with fresh data');

                // 🔥 AGAR DATA CHANGE HUA HAI TOH UI UPDATE KAREIN
                allFeatures = data.features;
                filteredFeatures = [...allFeatures];
                updateSliderRanges(allFeatures);
                updateFilterOptions(allFeatures);
                updateDamageBadges(allFeatures);
                renderMarkers();
                updateStats();
            }
        } catch (err) {
            console.warn('⚠️ Background fetch failed:', err);
        }
    }

    // ============================================
    // DAMAGE BUTTONS
    // ============================================
    document.querySelectorAll('.damage-btn[data-damage]').forEach(btn => {
        btn.addEventListener('click', function () {
            if (isLoading) return;
            const damage = this.dataset.damage;
            if (currentDamageFilter === damage) {
                currentDamageFilter = null;
                this.classList.remove('active');
            } else {
                document.querySelectorAll('.damage-btn[data-damage]').forEach(b => b.classList.remove('active'));
                currentDamageFilter = damage;
                this.classList.add('active');
            }
            applyFilters();
        });
    });

    document.getElementById('clearDamageFilter').addEventListener('click', function () {
        if (isLoading) return;
        currentDamageFilter = null;
        document.querySelectorAll('.damage-btn[data-damage]').forEach(b => b.classList.remove('active'));
        applyFilters();
    });

    resetBtn.addEventListener('click', resetFilters);

    document.querySelectorAll('#filterBar select').forEach(el => {
        el.addEventListener('change', applyFilters);
    });

    // ============================================
    // START
    // ============================================
    loadGeoJSON();

    window.map = map;
    window.clusterGroup = clusterGroup;

})();