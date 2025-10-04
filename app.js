// --- VARIÁVEIS GLOBAIS E CONFIGURAÇÃO ---
let scene, camera, renderer, earth, clouds;
let cachedFireData = null;
let map, sparksLayer, heatLayer; // Variáveis de estado para o mapa
const EARTH_RADIUS = 2;
const DEG = THREE.MathUtils.degToRad;

// --- FUNÇÕES DE DADOS E CONVERSÃO ---
async function getFireData() {
    const NASA_API_KEY = "dad364bb4112d56be070ae5cb506ee8d";
    const aDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const apiUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_API_KEY}/VIIRS_SNPP_NRT/-79.4,-53.2,-33.9,13.4/1/${aDayAgo}`;
    console.log("Buscando dados de queimadas...");
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) { throw new Error(`Status: ${response.status}`); }
        const csvText = await response.text();
        if (csvText.includes("No fire alerts")) { return []; }
        
        const lines = csvText.split("\n").slice(1);
        const firePoints = lines.map(line => {
            const columns = line.split(",");
            
            if (columns && columns.length > 8 && columns[0] && columns[1] && columns[2] && columns[6] && columns[8]) {
                const time = String(columns[6]).trim().padStart(4, '0');
                const confidence = String(columns[8]).trim();
                
                if (confidence) { // Ignora a linha se a 'confiança' estiver vazia
                    return { 
                        lat: parseFloat(columns[0]), 
                        lon: parseFloat(columns[1]),
                        brightness: parseFloat(columns[2]),
                        acq_time: `${time.slice(0, 2)}:${time.slice(2)} UTC`,
                        confidence: confidence
                    };
                }
            }
            return null;
        }).filter(p => p);
        
        console.log(`Encontrados ${firePoints.length} focos de incêndio.`);
        return firePoints;
    } catch (error) { console.error("Falha na requisição para a API da NASA:", error); return []; }
}
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * DEG;
    const theta = (lon + 90) * DEG;
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    return new THREE.Vector3(x, y, z);
}

// --- SETUP DA CENA 3D ---
function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById("webgl-container").appendChild(renderer.domElement);
    const textureLoader = new THREE.TextureLoader();
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load("textures/earth_diffuse.jpg"),
        specularMap: textureLoader.load("textures/earth_specular.png"),
        bumpMap: textureLoader.load("textures/earth_bump.jpg"),
        bumpScale: 0.05, specular: new THREE.Color("grey"), shininess: 15,
    });
    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    const cloudMaterial = new THREE.MeshStandardMaterial({
        map: textureLoader.load("textures/earth_clouds.png"),
        transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
    });
    const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64);
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earth.add(clouds);
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    directionalLight.position.set(5, 3, 5);
    scene.add(ambientLight, directionalLight);
    function animate() {
        requestAnimationFrame(animate);
        clouds.rotation.y += 0.0001;
        renderer.render(scene, camera);
    }
    animate();
    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- SETUP DAS ANIMAÇÕES DE SCROLL ---
function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(earth.rotation, {
        x: DEG(-10), y: DEG(-28),
        scrollTrigger: { trigger: "#america-sul", start: "top top", end: "bottom top", scrub: true, },
    });
    gsap.to(camera.position, {
        z: 3,
        scrollTrigger: { trigger: "#brasil", start: "top center", end: "bottom center", scrub: true, },
    });

    ScrollTrigger.create({
        trigger: "#queimadas",
        start: "top top",
        onEnter: async () => {
            if (map) return;
            
            gsap.timeline()
                .to(camera.position, { z: 2.5, duration: 0.8, ease: "power2.in" })
                .to("#webgl-container", { opacity: 0, duration: 0.5 }, "-=0.5")
                .to("#map-container", { opacity: 1, visibility: 'visible', duration: 0.8 }, "-=0.3");
            
            if (!cachedFireData) { cachedFireData = await getFireData(); }
            if (cachedFireData.length === 0) return;

            map = L.map('map-container', { zoomControl: false }).setView([-14.235, -51.925], 5);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            }).addTo(map);

            sparksLayer = L.layerGroup().addTo(map);
            const fireIcon = { color: '#f03', fillColor: '#f03', fillOpacity: 0.7, radius: 1, weight: 0 };
            const batchSize = 500;
            let currentIndex = 0;

            function addSparkBatch() {
                const batch = cachedFireData.slice(currentIndex, currentIndex + batchSize);
                if (batch.length === 0) return;

                batch.forEach(point => {
                    const confidence = point.confidence || "N/A"; // <-- Pequena defesa extra
                    let confidenceLabel = confidence.charAt(0).toUpperCase() + confidence.slice(1);
                    if (confidenceLabel === 'Nominal') confidenceLabel = 'Normal';

                    const popupContent = `<div class="fire-popup"><h4>Foco de Calor Detectado</h4><b>Hora:</b> ${point.acq_time}<br><b>Intensidade:</b> ${point.brightness} K<br><b>Confiança:</b> ${confidenceLabel}</div>`;

                    L.circleMarker([point.lat, point.lon], fireIcon)
                        .addTo(sparksLayer)
                        .bindPopup(popupContent);
                });

                currentIndex += batchSize;
                if (currentIndex < cachedFireData.length) {
                    requestAnimationFrame(addSparkBatch);
                }
            }
            addSparkBatch();

            const counter = { value: 0 };
            gsap.to(counter, {
                duration: 4, value: cachedFireData.length, ease: "power1.out",
                onUpdate: () => {
                    document.getElementById('fire-counter').textContent = Math.round(counter.value).toLocaleString('pt-BR');
                }
            });
        },
        onLeaveBack: () => {
            gsap.timeline()
                .to("#map-container", { opacity: 0, duration: 0.5, onComplete: () => {
                    if (map) { map.remove(); map = null; sparksLayer = null; heatLayer = null; }
                }})
                .set("#map-container", { visibility: 'hidden' })
                .to("#webgl-container", { opacity: 1, duration: 0.8 }, "+=0.2")
                .to(camera.position, { z: 3, duration: 1.0, ease: "power2.out" }, "<");
        }
    });

    ScrollTrigger.create({
        trigger: "#densidade",
        start: "top center",
        onEnter: () => {
            if (!map || !cachedFireData || heatLayer) return;
            console.log("Transição para Heatmap");

            const heatData = cachedFireData.map(point => [point.lat, point.lon, 0.5]);
            heatLayer = L.heatLayer(heatData, {
                radius: 15, blur: 20, maxZoom: 11,
                gradient: { 0.4: 'blue', 0.6: 'yellow', 0.8: 'red', 1.0: '#ff4500' }
            }).addTo(map);
            
            gsap.timeline()
                .to(sparksLayer.getLayers().map(l => l.getElement()), { duration: 1, opacity: 0, ease: "power2.inOut" })
                .from(heatLayer.getElement(), { duration: 1.5, opacity: 0, ease: "power2.inOut" }, "<");
        },
        onLeaveBack: () => {
            if (!sparksLayer || !heatLayer) return;
            console.log("Voltando para os Pontos");
            gsap.timeline()
                .to(heatLayer.getElement(), { duration: 1, opacity: 0, onComplete: () => {
                    if(map && heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
                }})
                .to(sparksLayer.getLayers().map(l => l.getElement()), { duration: 1.5, opacity: 0.7, ease: "power2.inOut" }, "<");
        }
    });
    
    document.querySelectorAll(".story-section").forEach(section => {
        ScrollTrigger.create({
            trigger: section,
            start: "top 50%", end: "bottom 50%",
            onToggle: self => gsap.to(section, { duration: 0.5, className: self.isActive ? 'story-section is-active' : 'story-section' })
        });
    });
}

initThree();
setupScrollAnimation();
