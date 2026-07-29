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

    // ---- CLUSTER (EXACTLY LIKE CULVERTS) ----
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
    const bridgeIcon = L.divIcon({
        className: 'bridge-marker',
        html: '<i class="fas fa-map-marker-alt" style="color:#dc2626;font-size:18px;"></i>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
        popupAnchor: [0, -18]
    });

    // ============================================
    // IMAGE PATH CONVERTER
    // ============================================
    function getImagePath(path) {
        if (!path || path.trim() === '') return null;
        let cleanPath = path.trim();

        if (cleanPath === '' || cleanPath === 'null' || cleanPath === 'undefined') return null;

        // 🔥 AGAR PATH PEHLE SE URL HAI
        if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
            return cleanPath;
        }

        // 🔥 AGAR PROXY AVAILABLE HAI TOH DIRECT PROXY URL
        if (window.proxyActive) {
            const PROXY_SERVER = window.PROXY_SERVER || 'http://localhost:8000';

            if (cleanPath.startsWith('\\\\')) {
                return PROXY_SERVER + '/proxy-image?file=' + encodeURIComponent(cleanPath);
            }

            if (cleanPath.startsWith('/efap-ss/')) {
                return PROXY_SERVER + cleanPath;
            }
        }

        // 🔥 RELATIVE PATH - Direct return
        if (!cleanPath.startsWith('/') && !cleanPath.startsWith('\\\\')) {
            return cleanPath;
        }

        // 🔥 LOCAL NETWORK PATH (Fallback)
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
    // POPUP - BRIDGE FIELDS
    // ============================================
    function createPopupHtml(props) {
        let html = `<div style="min-width:200px;max-width:280px;font-size:0.65rem;">
            <div class="popup-title" style="font-size:0.75rem;font-weight:700;color:#7c2d12;border-bottom:2px solid #b45309;padding-bottom:4px;margin-bottom:6px;">
                🌉 ${props.Bridge_ID || 'Bridge'}
            </div>
            
            <div class="popup-field"><span class="label">Surveyor</span><span class="value">${props.Surveyor_Name || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">District</span><span class="value">${props.District || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Date/Time</span><span class="value">${props.Date_Time || 'N/A'}</span></div>
            
            <div class="popup-field" style="border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin-bottom:4px;">
                <span class="label">Remarks</span>
                <span class="value" style="font-style:italic;color:#64748b;">${props.Remarks || 'N/A'}</span>
            </div>
            
            <div class="popup-field"><span class="label">Main Const.</span><span class="value">${props.Main_Construction_Type || 'N/A'}</span></div>
            
            <div style="font-size:0.55rem;font-weight:600;color:#7c2d12;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
                <i class="fas fa-cubes"></i> Materials
            </div>
            <div class="popup-field"><span class="label">Pier</span><span class="value">${props.Material_Type_Pier || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Abutment</span><span class="value">${props.Material_Type_Abutment || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Wing Wall</span><span class="value">${props.Material_Type_Wing_Wall || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Parapet</span><span class="value">${props.Material_Type_Parapet || 'N/A'}</span></div>
            
            <div style="font-size:0.55rem;font-weight:600;color:#7c2d12;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
                <i class="fas fa-ruler-combined"></i> Dimensions
            </div>
            <div class="popup-field"><span class="label">Bridge Length</span><span class="value">${props.Total_Bridge_Length || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Bridge Width</span><span class="value">${props.Total_Bridge_Width || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Clear Height</span><span class="value">${props.Clear_Height || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">No. of Span</span><span class="value">${props.No_of_Span || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Max Clear Span</span><span class="value">${props.Max_Clear_Span || 'N/A'}</span></div>
            
            <div style="font-size:0.55rem;font-weight:600;color:#7c2d12;margin-top:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:2px;">
                <i class="fas fa-road"></i> Road Info
            </div>
            <div class="popup-field"><span class="label">Road Name</span><span class="value">${props.Road_Name || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">Bridge Name</span><span class="value">${props.Bridge_Name || 'N/A'}</span></div>
            <div class="popup-field"><span class="label">River/Naala</span><span class="value">${props.River_Canal_Naala_Name || 'N/A'}</span></div>
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
            const isHtml = path.toLowerCase().endsWith('.html');

            if (isHtml) {
                const htmlPath = getImagePath(path);
                window.open(htmlPath, '_blank');
                return;
            }

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

            const images = [];
            const seen = new Set();

            const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            while ((match = imgRegex.exec(htmlText)) !== null) {
                let src = match[1];
                if (src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)/i) && !seen.has(src)) {
                    seen.add(src);
                    images.push(src);
                }
            }

            const imgRegex2 = /<img[^>]+src=([^\s>]+)/gi;
            while ((match = imgRegex2.exec(htmlText)) !== null) {
                let src = match[1].replace(/["']/g, '');
                if (src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)/i) && !seen.has(src)) {
                    seen.add(src);
                    images.push(src);
                }
            }

            if (images.length > 0) {
                let imgHtml = '<div class="html-grid">';
                images.forEach((img) => {
                    let imgUrl = img;
                    if (imgUrl.startsWith('file://')) {
                        let parts = imgUrl.split('/');
                        let efapIndex = parts.indexOf('efap-ss');
                        if (efapIndex !== -1) {
                            imgUrl = '/' + parts.slice(efapIndex).join('/');
                        } else {
                            return;
                        }
                    } else if (imgUrl.includes('\\')) {
                        imgUrl = imgUrl.replace(/\\/g, '/');
                    } else if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/')) {
                        const basePath = htmlPath.substring(0, htmlPath.lastIndexOf('/') + 1);
                        imgUrl = basePath + imgUrl;
                    }
                    imgUrl = imgUrl.replace(/ /g, '%20');

                    imgHtml += `
                        <div class="html-grid-item" onclick="window.showImage('${imgUrl}','Image from HTML')">
                            <img src="${imgUrl}" alt="HTML Image" 
                                onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-img\\'><i class=\\'fas fa-exclamation-triangle\\' style=\\'color:#ef4444;\\'></i><br><span style=\\'font-size:0.45rem;color:#94a3b8;\\'>${img.split('/').pop()}</span></div>'">
                        </div>
                    `;
                });
                imgHtml += '</div>';
                container.innerHTML = imgHtml;
            } else {
                container.innerHTML = `<div class="loading-text">No images found in HTML</div>`;
            }
        } catch (err) {
            console.error('Error fetching HTML:', err);
            container.innerHTML = `<div class="loading-text" style="color:#ef4444;">Failed to load HTML</div>`;
        }
    }

    // ============================================
    // CREATE HTML CARD
    // ============================================
    function createHtmlCard(imgPath, label, bridgeId) {
        let path = imgPath.trim();

        if (path.startsWith('\\\\')) {
            let parts = path.split('\\');
            parts = parts.slice(3);
            path = '/' + parts.join('/');
        } else {
            path = path.replace(/\\/g, '/');
        }
        path = path.replace(/ /g, '%20');

        const containerId = `htmlContainer_${bridgeId}_${label}`;

        setTimeout(() => {
            fetchHtmlImages(path, containerId);
        }, 500);

        return `
            <div class="html-card" id="htmlCard_${bridgeId}_${label}">
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
                    <div style="background:linear-gradient(145deg, #7c2d12, #b45309);border:2px solid #b45309;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-up" style="font-size:1rem;color:#fbbf24;"></i>
                        <i class="fas fa-bridge" style="font-size:2.5rem;color:#fbbf24;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Top</span>
                    </div>
                    <div style="background:linear-gradient(145deg, #7c2d12, #b45309);border:2px solid #b45309;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-left" style="font-size:1rem;color:#fbbf24;"></i>
                        <i class="fas fa-bridge" style="font-size:2.5rem;color:#fbbf24;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Left</span>
                    </div>
                    <div style="background:linear-gradient(145deg, #7c2d12, #b45309);border:2px solid #b45309;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:15px;flex:1;min-height:50px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                        <i class="fas fa-arrow-right" style="font-size:1rem;color:#fbbf24;"></i>
                        <i class="fas fa-bridge" style="font-size:2.5rem;color:#fbbf24;"></i>
                        <span style="font-size:0.8rem;color:white;font-weight:600;">Right</span>
                    </div>
                    <div style="text-align:center;color:#94a3b8;font-size:0.5rem;padding:4px 0;flex-shrink:0;">
                        <i class="fas fa-info-circle"></i> Select a bridge to view images
                    </div>
                </div>
            `;
            return;
        }

        const bridgeId = props.Bridge_ID || 'Unknown';
        const district = props.District || '';
        const location = props.Location || '';
        const routeId = props.Route_ID || '';

        function createImageCard(imgPath, label, bridgeId) {
            if (imgPath && imgPath.trim() !== '') {
                const isHtml = imgPath.toLowerCase().endsWith('.html');
                if (isHtml) {
                    return createHtmlCard(imgPath, label, bridgeId);
                } else {
                    const path = getImagePath(imgPath);

                    // Agar path null hai toh placeholder
                    if (!path) {
                        return `
                    <div class="image-card-large" style="background:#f8fafc;border:2px dashed #cbd5e1;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:15px;border-radius:8px;width:100%;">
                        <i class="fas fa-bridge" style="font-size:2rem;color:#cbd5e1;"></i>
                        <span style="font-size:0.65rem;color:#94a3b8;font-weight:500;">${label} Not Available</span>
                    </div>
                `;
                    }

                    return `
                <div class="image-card-large" onclick="window.showImage('${path}','${label} Image - ${bridgeId}')">
                    <div class="image-label">${label}</div>
                    <img src="${path}" alt="${label}" 
                        onload="console.log('✅ Image loaded:', this.src)"
                        onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-image\\' style=\\'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;min-height:80px;width:100%;\\'><i class=\\'fas fa-image\\' style=\\'font-size:2rem;color:#94a3b8;margin-bottom:6px;\\'></i><span style=\\'font-size:0.6rem;color:#94a3b8;font-weight:500;\\'>${label} Not Available</span></div>'">
                    <div class="click-hint">Click to enlarge</div>
                </div>
            `;
                }
            } else {
                return `
            <div class="image-card-large" style="background:#f8fafc;border:2px dashed #cbd5e1;min-height:60px;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 15px;border-radius:8px;width:100%;">
                <i class="fas fa-bridge" style="font-size:1.8rem;color:#cbd5e1;"></i>
                <span style="font-size:0.65rem;color:#94a3b8;font-weight:500;">No ${label} Image</span>
            </div>
        `;
            }
        }

        imageContent.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%;flex:1;gap:6px;min-height:0;">
                <div class="culvert-name" style="flex-shrink:0;">🌉 ${bridgeId}</div>
                <div class="culvert-detail" style="flex-shrink:0;">
                    <i class="fas fa-city"></i> ${district} 
                    ${routeId ? `| <i class="fas fa-route"></i> ${routeId}` : ''}
                    ${location ? `| <i class="fas fa-map-pin"></i> ${location}` : ''}
                </div>
                
                <div style="flex:1;display:flex;flex-direction:column;gap:6px;min-height:0;">
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-up"></i> TOP VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Top_Image, 'Top', bridgeId)}</div>
                    
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-left"></i> LEFT VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Left_Image, 'Left', bridgeId)}</div>
                    
                    <div class="image-section-title" style="flex-shrink:0;"><i class="fas fa-arrow-right"></i> RIGHT VIEW</div>
                    <div style="flex:1;min-height:40px;">${createImageCard(props.Right_Image, 'Right', bridgeId)}</div>
                </div>
                
                <div style="text-align:center;color:#94a3b8;font-size:0.45rem;padding:4px 0;flex-shrink:0;border-top:1px solid #e2e8f0;">
                    <i class="fas fa-info-circle"></i> Click any image to enlarge
                </div>
            </div>
        `;
    }

    // ============================================
    // SELECTED BRIDGE DAMAGES
    // ============================================
    function updateSelectedCulvertDamages(props) {
        const container = document.getElementById('selectedCulvertDamages');
        const nameContainer = document.getElementById('selectedCulvertName');

        if (!props) {
            nameContainer.textContent = 'Click a marker';
            container.innerHTML = `
                <div style="font-size:0.55rem;color:#94a3b8;text-align:center;padding:10px 0;font-style:italic;">
                    👆 Select a bridge to view damages
                </div>
            `;
            return;
        }

        nameContainer.textContent = `🌉 ${props.Bridge_ID || 'Unknown'} - ${props.District || ''}`;

        const damageTypes = [
            { key: 'Deck', img: props.Deck___Damage_Picture, job: props.Deck_Job, qty: props.Deck_Qty__, priority: props.Deck_Priority, icon: 'fa-border-all' },
            { key: 'Expension Joints', img: props.Expension_Joints___Damage_Picture, job: props.Expension_Joints_Damages_Job, qty: props.Expension_Joints_Damages_Qty__, priority: props.Expension_Joints_Damages_Priority, icon: 'fa-arrows-alt-h' },
            { key: 'RC Beam Girder', img: props.RC_Beam_Girder___Damage_Picture, job: props.RC_Beam_Girder_Job, qty: props.RC_Beam_Girder_Qty__, priority: props.RC_Beam_Girder_Priority, icon: 'fa-bars' },
            { key: 'Abutment', img: props.Abutment___Damage_Picture, job: props.Abutment_Job, qty: props.Abutment_Qty__, priority: props.Abutment_Priority, icon: 'fa-arrows-alt-v' },
            { key: 'Pier', img: props.Pier___Damage_Picture, job: props.Pier_Job, qty: props.Pier_Qty__, priority: props.Pier_Priority, icon: 'fa-archway' },
            { key: 'Wing Wall', img: props.Wing_Wall___Damage_Picture, job: props.Wing_Wall_Job, qty: props.Wing_Wall_Qty__, priority: props.Wing_Wall_Priority, icon: 'fa-border-all' },
            { key: 'Slope Protection', img: props.Slope_Protection___Damage_Picture, job: props.Slope_Protection_Job, qty: props.Slope_Protection_Qty__, priority: props.Slope_Protection_Priority, icon: 'fa-mountain' },
            { key: 'Parapet', img: props.Parapet___Damage_Picture, job: props.Parapet_Job, qty: props.Parapet_Qty__, priority: props.Parapet_Priority, icon: 'fa-shield-alt' },
            { key: 'Side Walk', img: props.Side_Walk___Damage_Picture, job: props.Side_Walk_Job, qty: props.Side_Walk_Qty__, priority: props.Side_Walk_Priority, icon: 'fa-walking' },
            { key: 'Other', img: props.Other_Damage_Picture, job: props.Other_Damages_Job, qty: props.Other_Damages_Qty__, priority: props.Other_Damages_Priority, icon: 'fa-tools' }
        ];

        // 🔧 FIX: Check karo ke field exist karti hai ya nahi
        const validDamages = damageTypes.filter(d => {
            const hasImage = d.img && typeof d.img === 'string' && d.img.trim() !== '' && d.img !== 'null' && d.img !== 'undefined';
            const hasJob = d.job && typeof d.job === 'string' && d.job.trim() !== '' && d.job !== 'null' && d.job !== 'undefined';
            const hasPriority = d.priority !== null && d.priority !== undefined && d.priority !== '';
            return hasImage || hasJob || hasPriority;
        });

        if (validDamages.length === 0) {
            container.innerHTML = `
                <div style="font-size:0.55rem;color:#94a3b8;text-align:center;padding:10px 0;font-style:italic;">
                    ✅ No damages reported for this bridge
                </div>
            `;
            return;
        }

        let html = '';
        validDamages.forEach(d => {
            const priorityClass = d.priority || 'None';
            const hasImage = d.img && typeof d.img === 'string' && d.img.trim() !== '' && d.img !== 'null' && d.img !== 'undefined';
            const imgPath = hasImage ? getImagePath(d.img) : '';

            // Safe string conversion
            const safeKey = String(d.key).replace(/'/g, "\\'");
            const safeImgPath = String(imgPath).replace(/'/g, "\\'");
            const safeJob = String(d.job || '').replace(/'/g, "\\'");
            const safeQty = String(d.qty !== null && d.qty !== undefined ? d.qty : '').replace(/'/g, "\\'");
            const safePriority = String(d.priority || '').replace(/'/g, "\\'");
            const safeBridgeId = String(props.Bridge_ID || '').replace(/'/g, "\\'");

            html += `
                <button class="damage-detail-btn" onclick="showDamageDetail('${safeKey}', '${safeImgPath}', '${safeJob}', '${safeQty}', '${safePriority}', '${safeBridgeId}')">
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
    window.showDamageDetail = function (type, imgPath, job, qty, priority, bridgeId) {
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
                <span style="font-size:0.7rem;color:#94a3b8;">Bridge: <strong>${bridgeId || 'Unknown'}</strong></span>
            </div>
            
            <div class="dmg-image-container" onclick="window.openFullScreenImage('${imgUrl}', '${type} Damage - ${bridgeId || 'Bridge'}')" style="cursor:pointer;">
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
            const len = parseFloat(p?.Total_Bridge_Length);
            if (!isNaN(len)) {
                if (len > maxLength) maxLength = len;
                if (len < minLength) minLength = len;
            }
            const span = parseFloat(p?.No_of_Span);
            if (!isNaN(span)) {
                if (span > maxSpan) maxSpan = span;
                if (span < minSpan) minSpan = span;
            }
            const width = parseFloat(p?.Total_Bridge_Width);
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
        const counts = {
            Deck: 0, 'Expension Joints': 0, 'RC Beam Girder': 0,
            Abutment: 0, Pier: 0, 'Wing Wall': 0,
            'Slope Protection': 0, Parapet: 0, 'Side Walk': 0, Other: 0
        };
        const damageMap = {
            'Deck': 'Deck___Damage_Picture',
            'Expension Joints': 'Expension_Joints___Damage_Picture',
            'RC Beam Girder': 'RC_Beam_Girder___Damage_Picture',
            'Abutment': 'Abutment___Damage_Picture',
            'Pier': 'Pier___Damage_Picture',
            'Wing Wall': 'Wing_Wall___Damage_Picture',
            'Slope Protection': 'Slope_Protection___Damage_Picture',
            'Parapet': 'Parapet___Damage_Picture',
            'Side Walk': 'Side_Walk___Damage_Picture',
            'Other': 'Other_Damage_Picture'
        };

        for (let i = 0; i < features.length; i++) {
            const p = features[i].properties;
            for (const [key, field] of Object.entries(damageMap)) {
                if (p?.[field] && p[field].trim() !== '' && p[field] !== 'null' && p[field] !== 'undefined') {
                    counts[key] = (counts[key] || 0) + 1;
                }
            }
        }

        document.getElementById('badgeDeck').textContent = counts.Deck || 0;
        document.getElementById('badgeExpension').textContent = counts['Expension Joints'] || 0;
        document.getElementById('badgeRCBeam').textContent = counts['RC Beam Girder'] || 0;
        document.getElementById('badgeAbutment').textContent = counts.Abutment || 0;
        document.getElementById('badgePier').textContent = counts.Pier || 0;
        document.getElementById('badgeWingWallB').textContent = counts['Wing Wall'] || 0;
        document.getElementById('badgeSlope').textContent = counts['Slope Protection'] || 0;
        document.getElementById('badgeParapetB').textContent = counts.Parapet || 0;
        document.getElementById('badgeSideWalk').textContent = counts['Side Walk'] || 0;
        document.getElementById('badgeOtherB').textContent = counts.Other || 0;
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

        markers = [];
        for (let i = 0; i < featuresToRender.length; i++) {
            const f = featuresToRender[i];
            if (f.geometry && f.geometry.type === 'Point') {
                const coords = f.geometry.coordinates;
                const marker = L.marker([coords[1], coords[0]], { icon: bridgeIcon });
                marker._culvertProps = f.properties;
                markers.push(marker);
            }
        }

        clusterGroup.addLayers(markers);
        filterCountDisplay.textContent = markers.length;

        window.markers = markers;


        // ✅ YEH LINE ADD KARO
        map.invalidateSize();

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

            const length = parseFloat(p.Total_Bridge_Length);
            if (!isNaN(length)) {
                if (length < lengthMin || length > lengthMax) continue;
            }

            const span = parseFloat(p.No_of_Span);
            if (!isNaN(span)) {
                if (span < spanMin || span > spanMax) continue;
            }

            const width = parseFloat(p.Total_Bridge_Width);
            if (!isNaN(width)) {
                if (width < widthMin || width > widthMax) continue;
            }

            if (currentDamageFilter) {
                const damageMap = {
                    'Deck': p.Deck___Damage_Picture,
                    'Expension Joints': p.Expension_Joints___Damage_Picture,
                    'RC Beam Girder': p.RC_Beam_Girder___Damage_Picture,
                    'Abutment': p.Abutment___Damage_Picture,
                    'Pier': p.Pier___Damage_Picture,
                    'Wing Wall': p.Wing_Wall___Damage_Picture,
                    'Slope Protection': p.Slope_Protection___Damage_Picture,
                    'Parapet': p.Parapet___Damage_Picture,
                    'Side Walk': p.Side_Walk___Damage_Picture,
                    'Other': p.Other_Damage_Picture
                };
                const img = damageMap[currentDamageFilter];
                if (!img || img.trim() === '' || img === 'null' || img === 'undefined') continue;
            }

            result.push(f);
        }

        filteredFeatures = result;
        updateDamageBadges(filteredFeatures);
        renderMarkers();
        updateStats();

        if (selectedCulvertProps) {
            const stillExists = filteredFeatures.some(f =>
                f.properties?.Bridge_ID === selectedCulvertProps.Bridge_ID
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
            progressText.textContent = 'Loading Bridges...';
            progressText.style.display = 'block';

            const response = await fetch('BRIDGES.geojson');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                throw new Error('No features found');
            }

            allFeatures = data.features;
            filteredFeatures = [...allFeatures];

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
                    <span style="background:rgba(255,255,255,0.2);padding:4px 16px;border-radius:20px;font-family:monospace;">BRIDGES.geojson</span>
                </div>
            `;
            isLoading = false;
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
