// O CÓDIGO A SEGUIR DEVE SER SALVO EM UM ARQUIVO CHAMADO app.js

// --- VARIÁVEIS GLOBAIS ---
let scene, camera, renderer, earth;

function initThree() {
    // 1.1 Cena e Câmera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; // Posição inicial da câmera

    // 1.2 Renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Ajusta o tamanho do renderizador para cobrir a tela inteira, ignorando o left: 250px do CSS
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('webgl-container').appendChild(renderer.domElement);

    // 1.3 Criar a Terra (Modelo 3D)
    const geometry = new THREE.SphereGeometry(2, 64, 64);
    const material = new THREE.MeshStandardMaterial({
        color: 0x3366ff, 
        wireframe: true 
    });
    earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // 1.4 Iluminação
    const ambientLight = new THREE.AmbientLight(0x404040, 3); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // 1.5 Loop de Renderização
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // 1.6 Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// --- 2. SETUP DO SCROLLTRIGGER (A LÓGICA DO STORYTELLING) ---

function setupScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);
    const DEG = THREE.MathUtils.degToRad;
    
    // NOVO: Referência ao painel de imagens na direita
    const fixedPanel = document.getElementById('fixed-context-panel');

    // ----------------------------------------------------
    // SEÇÃO 1: AMÉRICA DO SUL (Rotação e Leve Zoom)
    // ----------------------------------------------------
    gsap.to(earth.rotation, {
        x: DEG(10), 
        y: DEG(-100), 
        
        scrollTrigger: {
            trigger: "#america-sul",
            start: "top center",   
            end: "bottom center",  
            scrub: true,           
        }
    });
    
    // ----------------------------------------------------
    // SEÇÃO 2: BRASIL (Zoom mais próximo)
    // ----------------------------------------------------
    gsap.to(camera.position, {
        z: 3, // Move a câmera para mais perto (Zoom in)
        
        scrollTrigger: {
            trigger: "#brasil",
            start: "top center",
            end: "bottom center",
            scrub: true,
            
            // NOVO: Faz o painel de imagens aparecer ao entrar na seção Brasil
            onEnter: () => {
                gsap.to(fixedPanel, { 
                    opacity: 1, 
                    duration: 0.8, 
                    pointerEvents: 'auto' // Ativa interação ao aparecer
                });
            },
            // NOVO: Garante que ele desapareça ao rolar para cima
            onLeaveBack: () => {
                gsap.to(fixedPanel, { 
                    opacity: 0, 
                    duration: 0.8, 
                    pointerEvents: 'none' // Desativa interação ao esconder
                });
            }
        }
    });

    // ----------------------------------------------------
    // SEÇÃO 3: QUEIMADAS (Troca de material e Esconde o Painel)
    // ----------------------------------------------------
    const dataMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500, 
        emissive: 0xff0000, 
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });

    ScrollTrigger.create({
        trigger: "#queimadas",
        start: "top center",
        
        onEnter: () => {
            // Esconde o Painel de imagens (se estiver visível)
            gsap.to(fixedPanel, { 
                opacity: 0, 
                duration: 0.8, 
                pointerEvents: 'none' 
            });
            // Troca o visual da Terra
            gsap.to(earth.material, { duration: 1, onUpdate: () => {
                earth.material = dataMaterial; 
            }});
        },
        onLeaveBack: () => {
            // Volta para o material inicial
            gsap.to(earth, { duration: 1, onUpdate: () => {
                const initialMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff, wireframe: true });
                earth.material = initialMaterial;
            }});
        },
    });


    // ----------------------------------------------------
    // SEÇÃO 4: ANTES & DEPOIS (Pode ser um zoom sutil ou rotação extra)
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