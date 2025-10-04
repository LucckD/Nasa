// Variável para armazenar os dados de queimadas e evitar múltiplas chamadas
let cachedFireData = null;

// Função para buscar e processar dados de queimadas da NASA
async function getFireData() {


  const NASA_API_KEY = "chaveRemovidaParaCommitGitHub";
  const aDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const apiUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${NASA_API_KEY}/VIIRS_SNPP_NRT/-79.4,-53.2,-33.9,13.4/1/${aDayAgo}`;

  console.log("Buscando dados de queimadas...");

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("Erro ao buscar dados. Status:", response.status);
      return [];
    }
    const csvText = await response.text();
    const lines = csvText.split("\n");
    const firePoints = [];
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(",");
      if (columns && columns.length > 1 && columns[0] && columns[1]) {
        const lat = parseFloat(columns[0]);
        const lon = parseFloat(columns[1]);
        firePoints.push({ lat, lon });
      }
    }
    console.log(`Encontrados ${firePoints.length} focos de incêndio.`);
    return firePoints;
  } catch (error) {
    console.error("Falha na requisição para a API da NASA:", error);
    return [];
  }
}

// Converte latitude e longitude para um vetor de posição 3D na esfera
function latLonToVector3(lat, lon, radius) {
  const DEG_TO_RAD = THREE.MathUtils.DEG2RAD;
  const phi = (90 - lat) * DEG_TO_RAD;
  const theta = (lon + 180) * DEG_TO_RAD;

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

// --- VARIÁVEIS GLOBAIS ---
let scene, camera, renderer, earth, clouds, firePointsGroup;
const EARTH_RADIUS = 2;
const DEG = THREE.MathUtils.degToRad;

// --- 1. SETUP DO THREE.JS ---
function initThree() {
  scene = new THREE.Scene();
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

  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load("textures/earth_diffuse.jpg");
  const specularTexture = textureLoader.load("textures/earth_specular.png");
  const bumpTexture = textureLoader.load("textures/earth_bump.jpg");

  const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    specularMap: specularTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.05,
    specular: new THREE.Color("grey"),
    shininess: 15,
  });

  earth = new THREE.Mesh(geometry, earthMaterial);
  scene.add(earth);

  const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64);
  const cloudTexture = textureLoader.load("textures/earth_clouds.png");
  const cloudMaterial = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
  });

  clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  earth.add(clouds);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  function animate() {
    requestAnimationFrame(animate);
    if (clouds) {
      clouds.rotation.y += 0.000015;
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}


// ===================================================================
// --- 2. SETUP DO SCROLLTRIGGER 
// ===================================================================

function setupScrollAnimation() {
  gsap.registerPlugin(ScrollTrigger);

  const fixedPanel = document.getElementById("fixed-context-panel");

  // ----------------------------------------------------
  // ANIMAÇÃO 1: Rotação para a AMÉRICA DO SUL
  // ----------------------------------------------------
  gsap.to(earth.rotation, {
    x: DEG(-10),
    y: DEG(-28),
    scrollTrigger: {
      trigger: "#america-sul",
      start: "top top",
      end: "bottom top",
      scrub: true,
      markers: true,
    },
  });

  // ----------------------------------------------------
  // ANIMAÇÃO 2: ZOOM no BRASIL
  // apenas zoom da câmera.
  // ----------------------------------------------------
  gsap.to(camera.position, {
    z: 3,
    scrollTrigger: {
      trigger: "#brasil",
      start: "top center",
      end: "bottom center",
      scrub: true,
      markers: true,
    },
  });

  // ----------------------------------------------------
  // EFEITO 3: Painel de Contexto do BRASIL
  // apenas a aparição e desaparecimento do painel
  // ----------------------------------------------------
  ScrollTrigger.create({
    trigger: "#brasil",
    start: "top center",
    end: "bottom center",
    onEnter: () => {
      gsap.to(fixedPanel, { opacity: 1, duration: 0.5, pointerEvents: 'auto' });
    },
    onLeave: () => {
      gsap.to(fixedPanel, { opacity: 0, duration: 0.5, pointerEvents: 'none' });
    },
    onEnterBack: () => {
      gsap.to(fixedPanel, { opacity: 1, duration: 0.5, pointerEvents: 'auto' });
    },
    onLeaveBack: () => {
      gsap.to(fixedPanel, { opacity: 0, duration: 0.5, pointerEvents: 'none' });
    }
  });


  // ----------------------------------------------------
  // EFEITO 4: Visualização de Dados de QUEIMADAS
  // ----------------------------------------------------
  ScrollTrigger.create({
    trigger: "#queimadas",
    start: "top center",
    end: "bottom center",
    onEnter: async () => {
      gsap.to(clouds.material, { opacity: 0, duration: 0.8 });
      if (firePointsGroup) {
        firePointsGroup.visible = true;
        return;
      }
      if (!cachedFireData) {
        cachedFireData = await getFireData();
      }
      firePointsGroup = new THREE.Group();
      const fireDotSvgDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHJhZGlhbEdyYWRpZW50IGlkPSJnbG93Ij48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSJ3aGl0ZSIgc3RvcC1vcGFjaXR5PSIwIi8+PC9yYWRpYWxHcmFkaWVudD48L2RlZnM+PGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iNjQiIGZpbGw9InVybCgjZ2xvdykiLz48L3N2Zz4=';
      const fireTexture = new THREE.TextureLoader().load(fireDotSvgDataUrl);
      const fireMaterial = new THREE.SpriteMaterial({
        map: fireTexture,
        color: 0xff4500,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
      });
      cachedFireData.forEach((point) => {
        const fireSprite = new THREE.Sprite(fireMaterial);
        const position = latLonToVector3(point.lat, point.lon, EARTH_RADIUS * 1.002);
        fireSprite.position.set(position.x, position.y, position.z);
        fireSprite.scale.set(0.025, 0.025, 1);
        firePointsGroup.add(fireSprite);
      });
      earth.add(firePointsGroup);
    },
    onLeaveBack: () => {
      if (firePointsGroup) {
        firePointsGroup.visible = false;
      }
      gsap.to(clouds.material, { opacity: 0.7, duration: 0.8 });
    },
  });

  };

initThree();
setupScrollAnimation();
