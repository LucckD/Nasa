// O CÓDIGO A SEGUIR DEVE SER SALVO EM UM ARQUIVO CHAMADO app.js

// --- VARIÁVEIS GLOBAIS ---
let scene, camera, renderer, earth, clouds; // Adicionamos 'clouds' como variável global
const EARTH_RADIUS = 2; 
const DEG = THREE.MathUtils.degToRad;

// --- 1. SETUP DO THREE.JS ---

function initThree() {
    // 1.1 Cena e Câmera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; 

    // 1.2 Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('webgl-container').appendChild(renderer.domElement);

    // ----------------------------------------------------
    // 1.3 CARREGAMENTO DE TEXTURAS E CRIAÇÃO DA TERRA REALISTA
    // ----------------------------------------------------
    const textureLoader = new THREE.TextureLoader();
    
    // NOTA: Os caminhos abaixo assumem que você tem uma pasta 'textures' com os arquivos.
    const earthTexture = textureLoader.load('textures/earth_diffuse.jpg');
    const specularTexture = textureLoader.load('textures/earth_specular.png');
    const bumpTexture = textureLoader.load('textures/earth_bump.jpg');

    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    
    // Material da Terra Realista (MeshPhongMaterial funciona bem com mapas especulares)
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: earthTexture,
        specularMap: specularTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.05, // Intensidade do relevo
        specular: new THREE.Color('grey'), // Cor do brilho especular (água)
        shininess: 15,
    });
    
    earth = new THREE.Mesh(geometry, earthMaterial);
    scene.add(earth);

    // ----------------------------------------------------
    // 1.4 CAMADA DE NUVENS
    // ----------------------------------------------------
    const cloudGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64); // Ligeiramente maior (0.5% maior)
    const cloudTexture = textureLoader.load('textures/earth_clouds.png');
    
    const cloudMaterial = new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending, // Para um visual mais suave
    });
    
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);

    // ----------------------------------------------------
    // 1.5 Iluminação (Aumentada para um visual mais dramático com texturas)
    // ----------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8); // Luz suave
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1); // Simula o Sol
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // 1.6 Loop de Renderização - ATUALIZADO
    function animate() {
        requestAnimationFrame(animate);
        
        // Rotação suave da nuvem para o efeito de movimento dinâmico
        if (clouds) {
             clouds.rotation.y += 0.0001; 
        }
        
        renderer.render(scene, camera);
    }
    animate();

    // 1.7 Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- 2. SETUP DO SCROLLTRIGGER (A LÓGICA DO STORYTELLING) ---

function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);
    
    const fixedPanel = document.getElementById('fixed-context-panel');
    
    // Vamos armazenar o material inicial da Terra para voltar a ele depois
    const initialEarthMaterial = earth.material.clone();

    // ----------------------------------------------------
    // SEÇÃO 1: AMÉRICA DO SUL (Rotação e Leve Zoom)
    // ----------------------------------------------------
    gsap.to(earth.rotation, {
        x: DEG(-10), 
        y: DEG(-28), 
        
        scrollTrigger: {
            trigger: "#america-sul",
            start: "top center",   
            end: "bottom center",  
            scrub: true,           
        }
    });
    
    // ----------------------------------------------------
    // SEÇÃO 2: BRASIL (Zoom mais próximo e Painel de Contexto)
    // ----------------------------------------------------
    gsap.to(camera.position, {
        z: 3, 
        
        scrollTrigger: {
            trigger: "#brasil",
            start: "top center",
            end: "bottom center",
            scrub: true,
            
            onEnter: () => {
                gsap.to(fixedPanel, { 
                    opacity: 1, 
                    duration: 0.8, 
                    pointerEvents: 'auto' 
                });
            },
            onLeaveBack: () => {
                gsap.to(fixedPanel, { 
                    opacity: 0, 
                    duration: 0.8, 
                    pointerEvents: 'none' 
                });
            }
        }
    });

    // ----------------------------------------------------
    // SEÇÃO 3: QUEIMADAS (Troca de material - Camada de Dados)
    // ----------------------------------------------------
    
    // Criamos um material simples para a visualização de dados (efeito de mapa de calor)
    const dataMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500, // Cor de alerta (Laranja/Vermelho)
        emissive: 0xff0000, 
        emissiveIntensity: 0.5,
        wireframe: false,
        transparent: true,
        opacity: 0.8
    });

    ScrollTrigger.create({
        trigger: "#queimadas",
        start: "top center",
        
        onEnter: () => {
            gsap.to(fixedPanel, { 
                opacity: 0, 
                duration: 0.8, 
                pointerEvents: 'none' 
            });
            // TROCA DE MATERIAL: Aplicamos o material de dados
            earth.material = dataMaterial; 
        },
        onLeaveBack: () => {
            // VOLTA AO REALISMO: Aplicamos o material inicial com texturas
            earth.material = initialEarthMaterial; 
        },
    });


    // ----------------------------------------------------
    // SEÇÃO 4: ANTES & DEPOIS
    // ----------------------------------------------------
    gsap.to(earth.rotation, {
        y: DEG(-90), 
        scrollTrigger: {
            trigger: "#antes-depois",
            start: "top center",
            end: "bottom center",
            scrub: true
        }
    });
}

// Inicializa a aplicação
initThree();
setupScrollAnimation();