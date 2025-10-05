// ...existing code...
// --- GLOBAL VARIABLES & CONFIG ---
let scene, camera, renderer, earth, clouds, ominousLight;
const dataCache = new Map();
let map, sparksLayer, heatLayer;
let isHeatmapVisible = false;
const EARTH_RADIUS = 2;
const DEG = THREE.MathUtils.degToRad;

// --- DATA & CONVERSION FUNCTIONS ---
async function getFireData(targetDateString) {
  const NASA_API_KEY = "dad364bb4112d56be070ae5cb506ee8d";
  const apiUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_API_KEY}/VIIRS_SNPP_NRT/-79.4,-53.2,-33.9,13.4/1/${targetDateString}`;

  console.log(`Fetching fire data for date ${targetDateString}...`);
  try {
    if (dataCache.has(targetDateString)) {
      console.log("Data found in cache.");
      return dataCache.get(targetDateString);
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Status: ${response.status}`);
    }
    const csvText = await response.text();
    if (csvText.includes("No fire alerts")) {
      dataCache.set(targetDateString, []);
      return [];
    }

    const lines = csvText.split("\n").slice(1);
    const firePoints = lines
      .map((line) => {
        const columns = line.split(",");
        if (columns && columns.length > 8 && columns[0] && columns[1]) {
          return { lat: parseFloat(columns[0]), lon: parseFloat(columns[1]) };
        }
        return null;
      })
      .filter((p) => p);

    console.log(
      `Found ${firePoints.length} hotspots for ${targetDateString}.`
    );
    dataCache.set(targetDateString, firePoints);
    return firePoints;
  } catch (error) {
    console.error("Failed request to NASA API:", error);
    return [];
  }
}

// Convert lat/lon to 3D space
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 90) * DEG;
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

// Function to draw individual points on the map
function updateMapWithPoints(fireData) {
  // Garante que a camada seja limpa e recriada se necessário
  if (sparksLayer) {
    sparksLayer.clearLayers();
  }
  if (!sparksLayer || !map.hasLayer(sparksLayer)) { sparksLayer = L.layerGroup().addTo(map); }

  const toggleBtn = document.getElementById("toggle-view-btn");
  toggleBtn.disabled = true;

  const fireIcon = {
    color: "#f03",
    fillColor: "#f03",
    fillOpacity: 0.7,
    radius: 1,
    weight: 0,
  };
  const batchSize = 500;
  let currentIndex = 0;

  function addSparkBatch() {
    const batch = fireData.slice(currentIndex, currentIndex + batchSize);
    if (batch.length === 0) {
      toggleBtn.disabled = false;
      return;
    }
    batch.forEach((point) => {
      L.circleMarker([point.lat, point.lon], fireIcon).addTo(sparksLayer);
    });
    currentIndex += batchSize;
    if (currentIndex < fireData.length) {
      requestAnimationFrame(addSparkBatch);
    } else {
      toggleBtn.disabled = false;
    }
  }
  addSparkBatch();
}

// Function to draw the heatmap
function updateMapWithHeatmap(fireData) {
  if (heatLayer) {
    heatLayer.remove();
  }
  const heatData = fireData.map((point) => [point.lat, point.lon, 0.5]);
  heatLayer = L.heatLayer(heatData, {
    radius: 15,
    blur: 20,
    maxZoom: 11,
    gradient: { 0.4: "blue", 0.6: "yellow", 0.8: "red", 1.0: "#ff4500" },
  }).addTo(map);
}

// --- 3D SCENE SETUP ---
function initThree() {
  scene = new THREE.Scene();

  const loadingManager = new THREE.LoadingManager();
  const loadingOverlay = document.getElementById('loading-overlay');

  loadingManager.onLoad = () => {
    // Esconde a tela de carregamento quando tudo estiver pronto
    gsap.to(loadingOverlay, { opacity: 0, duration: 1, onComplete: () => {
      loadingOverlay.style.display = 'none';
    }});
  };

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("webgl-container").appendChild(renderer.domElement);

  const textureLoader = new THREE.TextureLoader(loadingManager);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: textureLoader.load("textures/earth_diffuse.jpg"),
    specularMap: textureLoader.load("textures/earth_specular.png"),
    bumpMap: textureLoader.load("textures/earth_bump.jpg"),
    bumpScale: 0.05,
    specular: new THREE.Color("grey"),
    shininess: 15,
  });
  const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  earth = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earth);

  const cloudMaterial = new THREE.MeshStandardMaterial({
    map: textureLoader.load("textures/earth_clouds.png"),
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
  });
  const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64);
  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  earth.add(clouds);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
  ominousLight = new THREE.PointLight(0xff4500, 0, 15);
  ominousLight.position.set(-1, 0.5, 4);
  scene.add(ominousLight);
  directionalLight.position.set(5, 3, 5);
  scene.add(ambientLight, directionalLight);

  function animate() {
    requestAnimationFrame(animate);
    clouds.rotation.y += 0.000050;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setupScrollAnimation() {
  gsap.registerPlugin(ScrollTrigger);

  const scrollPrompt = document.getElementById("scroll-prompt");
  ScrollTrigger.create({
    start: 1,
    onEnter: () => gsap.to(scrollPrompt, { autoAlpha: 0 }),
    once: true,
  });

  gsap.to(earth.rotation, {
    x: DEG(-10),
    y: DEG(-28),
    scrollTrigger: {
      trigger: "#america-sul",
      start: "top top",
      end: "bottom top",
      scrub: 1.5, // Usar um número suaviza a animação ao rolar
    },
  });
  gsap.to(camera.position, {
    z: 3,
    scrollTrigger: {
      trigger: "#brasil",
      start: "top center",
      end: "bottom center",
      scrub: 1.5, // Suaviza também o zoom
    },
  });

  ScrollTrigger.create({
    trigger: "#analise-dados",
    start: "top top",
    onEnter: async () => {
      if (map) return;

      gsap
        .timeline()
        .to(camera.position, { z: 2.5, duration: 0.8, ease: "power2.in" })
        .to("#webgl-container", { opacity: 0, duration: 0.5 }, "-=0.5")
        .to(
          "#map-container",
          { opacity: 1, visibility: "visible", duration: 0.8 },
          "-=0.3"
        );

      // Show initial loading message
      document.getElementById("fire-counter").textContent = "Loading...";

      // Fetch today's data
      const todayString = new Date().toISOString().split("T")[0];
      const initialFireData = await getFireData(todayString);

      if (initialFireData.length > 0) {
        const calculatedIntensity = Math.min(
          initialFireData.length / 40000,
          1.0
        );
        gsap.to(ominousLight, {
          intensity: calculatedIntensity,
          duration: 2.5,
          ease: "power2.out",
        });
      }

      // Initialize the map
      map = L.map("map-container", { zoomControl: false }).setView(
        [-14.235, -51.925],
        5
      );
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        }
      ).addTo(map);

      // Show initial view (points) and animate counter
      updateMapWithPoints(initialFireData);
      const counter = { value: 0 };
      gsap.to(counter, {
        duration: 2,
        value: initialFireData.length,
        ease: "power2.out",
        onUpdate: () => {
          document.getElementById("fire-counter").textContent = Math.round(
            counter.value
          ).toLocaleString("en-US");
        },
      });

      const toggleBtn = document.getElementById("toggle-view-btn");
      toggleBtn.addEventListener("click", () => {
        isHeatmapVisible = !isHeatmapVisible;
        const fireData = dataCache.get(dates[slider.value]) || [];

        if (isHeatmapVisible) {
          if (sparksLayer) sparksLayer.clearLayers();
          updateMapWithHeatmap(fireData);
        } else { // Se a visão de pontos estiver ativa
          if (heatLayer) heatLayer.remove();
          heatLayer = null;
          updateMapWithPoints(fireData);
        }
        toggleBtn.textContent = isHeatmapVisible
          ? "Show Individual Points"
          : "Analyze Density";
      });

      // Time slider logic
      const slider = document.getElementById("time-slider");
      const currentDateLabel = document.getElementById("current-date-label");
      const startDateLabel = document.getElementById("start-date-label");

      const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split("T")[0];
      });
      const formatDateLabel = (dateString) =>
        new Date(dateString + "T12:00:00").toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
        });

      startDateLabel.textContent = formatDateLabel(dates[0]);
      currentDateLabel.textContent = "Today";

      let debounceTimer;
      slider.addEventListener("input", (event) => {
        const selectedDateString = dates[event.target.value];
        currentDateLabel.textContent =
          event.target.value == 6
            ? "Today"
            : formatDateLabel(selectedDateString);

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          document.getElementById("fire-counter").textContent = "Loading...";

          const fireData = await getFireData(selectedDateString);
          document.getElementById("fire-counter").textContent =
            fireData.length.toLocaleString("en-US");
          if (isHeatmapVisible) {
            updateMapWithHeatmap(fireData);
          } else {
            updateMapWithPoints(fireData);
          }
        }, 250);
      });
    },
    onLeaveBack: () => {
      gsap.to(ominousLight, { intensity: 0, duration: 1 });
      gsap
        .timeline()
        .to("#map-container", {
          opacity: 0,
          duration: 0.5,
          onComplete: () => {
            if (map) {
              map.remove();
              map = null;
            }
          },
        })
        .set("#map-container", { visibility: "hidden" })
        .to("#webgl-container", { opacity: 1, duration: 0.8 }, "+=0.2")
        .to(camera.position, { z: 3, duration: 1.0, ease: "power2.out" }, "<");
    },
  });

  // --- Lazy Loading para os mapas estáticos ---

  // Carrega o mapa de Risco de Incêndio (FMA) quando a seção #sar-rio entra na tela
  ScrollTrigger.create({
    trigger: "#sar-rio",
    start: "top 80%", // Carrega um pouco antes de ficar totalmente visível
    onEnter: () => {
      // A função initFireRiskMap está em mapa_inpe.js
      if (typeof initFireRiskMap === "function") {
        initFireRiskMap("mapa-sar-container");
      }
    },
    once: true // Garante que a função seja chamada apenas uma vez
  });

  // Carrega o mapa da Tese (Risco de Propagação) quando a seção #nossa-contribuicao entra na tela
  ScrollTrigger.create({
    trigger: "#nossa-contribuicao",
    start: "top 80%",
    onEnter: () => {
      if (typeof initThesisMap === "function") initThesisMap();
    },
    once: true
  });

  // Animate story panels
  document.querySelectorAll(".story-section").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onToggle: (self) =>
        gsap.to(section, {
          duration: 0.5,
          className: self.isActive
            ? "story-section is-active"
            : "story-section",
        }),
    });
  });

  // Animação para os elementos do conteúdo estático
  gsap.utils.toArray('.sar-texto, .comparison-content, .contribuicao-texto').forEach(elem => {
    gsap.from(elem.children, {
      y: 30,
      opacity: 0,
      stagger: 0.2,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: elem, start: 'top 80%' }
    });
  });

  const modal = document.getElementById("data-modal");
  const openBtn = document.getElementById("about-data-btn");
  const closeBtn = document.getElementById("close-modal-btn");

  function openModal() {
    modal.classList.add("is-visible");
  }
  function closeModal() {
    modal.classList.remove("is-visible");
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  // Close modal when clicking outside content
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });
}

function setupHomeButton() {
  const homeBtn = document.getElementById('home-btn');
  if (!homeBtn) return;

  homeBtn.addEventListener('click', (e) => {
    e.preventDefault();

    // 1. Rola a página para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Garante que o mapa 2D seja removido e o globo 3D apareça
    if (map) {
      map.remove();
      map = null;
    }
    gsap.to("#map-container", { opacity: 0, visibility: 'hidden', duration: 0.5 });
    gsap.to("#webgl-container", { opacity: 1, duration: 0.5 });

    // 3. Reseta a câmera e a rotação do globo para o estado inicial
    gsap.to(camera.position, { z: 5, duration: 1.5, ease: 'power3.inOut' });
    gsap.to(earth.rotation, { x: 0, y: 0, duration: 1.5, ease: 'power3.inOut' });

    // 4. Reseta o estado do botão de densidade e da luz de perigo
    isHeatmapVisible = false;
    const toggleBtn = document.getElementById("toggle-view-btn");
    if (toggleBtn) toggleBtn.textContent = "Analyze Density";
    gsap.to(ominousLight, { intensity: 0, duration: 1 });

    // 5. Reativa o "scroll-prompt"
    const scrollPrompt = document.getElementById("scroll-prompt");
    gsap.to(scrollPrompt, { autoAlpha: 1, delay: 0.5 });

    // 6. Força o ScrollTrigger a reavaliar as posições
    ScrollTrigger.refresh();
  });
}

initThree();
setupScrollAnimation();
// setupHomeButton(); // Desativado conforme solicitado
// ...existing code...