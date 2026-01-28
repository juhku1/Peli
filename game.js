import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// GLTF Loader 3D-mallien lataamiseen
const loader = new GLTFLoader();
const clock = new THREE.Clock(); // Animaatioiden ajastukseen

// Pelin tila
const gameState = {
    score: 0,
    gameOver: false,
    speed: 0.1,
    kills: 0
};

// Näppäimistön tila
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    run: false,
    duck: false
};

// Hiiren ohjaus
const mouse = {
    yaw: 0,        // Vaakakierto (vasemmalle/oikealle)
    pitch: -0.3,   // Pystykierto (ylös/alas)
    sensitivity: 0.002,
    isZooming: false
};

// Näppäimistön tila
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    shoot: false,
    run: false,
    duck: false
};

// Ammukset
const projectiles = [];

// Scene, Camera, Renderer
const scene = new THREE.Scene();
// Gradient-taivas
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0xb0c4de, 10, 80);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Valaistus
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.0);
directionalLight.position.set(10, 15, 8);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -30;
directionalLight.shadow.camera.right = 30;
directionalLight.shadow.camera.top = 30;
directionalLight.shadow.camera.bottom = -30;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Lisävalo (sinertävä täytevalo)
const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// 🤖 PELAAJA - Ladataan 3D-malli
let player = new THREE.Group();
let playerModel = null;
let playerMixer = null;
let playerLoaded = false;

// Lataa astronautti-malli
loader.load('models/astronaut.glb', (gltf) => {
    // Poista placeholder jos on
    if (player.children.length > 0) {
        player.children.forEach(child => player.remove(child));
    }
    
    playerModel = gltf.scene;
    
    // Skaalaa ja aseta malli
    playerModel.scale.set(0.5, 0.5, 0.5);
    playerModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    player.add(playerModel);
    
    // Animaatiot - tallenna kaikki, mutta älä toista vielä
    if (gltf.animations && gltf.animations.length > 0) {
        playerMixer = new THREE.AnimationMixer(playerModel);
        player.animations = gltf.animations;
        player.actions = {};
        
        // Luo action jokaiselle animaatiolle
        gltf.animations.forEach((clip) => {
            player.actions[clip.name] = playerMixer.clipAction(clip);
        });
        
        console.log('✅ Animaatiot:', Object.keys(player.actions));
    }
    
    // Poista vanha ase jos on
    if (player.weapon) {
        player.remove(player.weapon);
        player.weapon = null;
    }
    
    // Luo ase astronautille
    const weaponGroup = new THREE.Group();
    const weaponBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    weaponBody.position.z = -0.4;
    weaponGroup.add(weaponBody);
    
    const weaponBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9 })
    );
    weaponBarrel.position.z = -0.75;
    weaponBarrel.rotation.x = Math.PI / 2;
    weaponGroup.add(weaponBarrel);
    
    weaponGroup.position.set(0.3, 0.5, 0);
    weaponGroup.rotation.y = -Math.PI / 2;
    player.add(weaponGroup);
    player.weapon = weaponGroup;
    
    playerLoaded = true;
    console.log('✅ Robotti-malli ladattu!', gltf.animations.length, 'animaatiota');
}, undefined, (error) => {
    console.error('❌ Virhe ladattaessa mallia:', error);
    createFallbackPlayer();
});

// Fallback: yksinkertainen geometria jos mallia ei saada
function createFallbackPlayer() {
    const geometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        metalness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    player.add(mesh);
    console.log('⚠️ Käytetään fallback-geometriaa pelaajalle');
}

// Lisää ase
function addWeaponToPlayer() {
    const weapon = new THREE.Group();
    
    // Päärunko (neon sininen)
    const weaponBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.6),
        new THREE.MeshStandardMaterial({ 
            color: 0x0066ff,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x0033aa,
            emissiveIntensity: 0.3
        })
    );
    weapon.add(weaponBody);
    
    // Energia-piippu
    const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8),
        new THREE.MeshStandardMaterial({ 
            color: 0x00ffff,
            metalness: 1.0,
            roughness: 0.0,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.5);
    weapon.add(barrel);
    
    // Energia-ydin
    const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    core.position.set(0, 0, 0.15);
    weapon.add(core);
    weapon.core = core;
    
    // Aseta ase pelaajaan
    weapon.position.set(0.3, 0.5, -0.3);
    weapon.rotation.y = -0.3;
    player.add(weapon);
    player.weapon = weapon;
}

// Lisää pelaaja sceneen heti (tyhjänä, malli latautuu myöhemmin)
player.position.set(0, 0, 0);
scene.add(player);

// Pelaajan fysiikka
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: true,
    jumpPower: 0.3,
    gravity: -0.02,
    moveSpeed: 0.15,
    runSpeed: 0.25,  // Juoksunopeus
    duckSpeed: 0.08  // Kyykistysnopeus
};

// 🌐 SCI-FI GRID-LATTIA
const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x0a0a1a,
    roughness: 0.8,
    metalness: 0.6,
    emissive: 0x0a0a2a,
    emissiveIntensity: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;

// Grid-viivat
const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x004488);
gridHelper.position.y = 0.01;
gridHelper.material.opacity = 0.3;
gridHelper.material.transparent = true;
scene.add(gridHelper);

scene.add(ground);

// 🌌 SKYBOX (tähtitaivas)
scene.background = new THREE.Color(0x000510);
scene.fog = new THREE.FogExp2(0x000510, 0.015);

// ✨ NEON-PYLVÄÄT (korvaa puut)
function createNeonPillar(x, z) {
    const pillar = new THREE.Group();
    
    // Pääpylväs
    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.3, 6, 8);
    const pillarMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a3a,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x0a0a2a,
        emissiveIntensity: 0.3
    });
    const main = new THREE.Mesh(pillarGeometry, pillarMaterial);
    main.position.y = 3;
    main.castShadow = true;
    pillar.add(main);
    
    // Neon-renkaat (pyörivät, eri värejä)
    const colors = [0x00ffff, 0xff00ff, 0x00ff00];
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(0.5, 0.08, 8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
            color: colors[i % colors.length],
            transparent: true,
            opacity: 0.8
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 1 + i * 1.5;
        ring.rotation.x = Math.PI / 2;
        pillar.add(ring);
    }
    
    // Huippuvalo
    const topLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    topLight.position.y = 6;
    pillar.add(topLight);
    
    pillar.position.set(x, 0, z);
    return pillar;
}

// Luo neon-pylväitä reunoille
for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const distance = 35 + Math.random() * 10;
    const pillar = createNeonPillar(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance
    );
    scene.add(pillar);
}

// 🔮 ENERGIA-KRISTALLIT (korvaa kivet)
const crystalGeometry = new THREE.OctahedronGeometry(0.6, 0);
const crystalMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ffaa,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x00ffaa,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8
});

for (let i = 0; i < 15; i++) {
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(
        (Math.random() - 0.5) * 80,
        0.6,
        (Math.random() - 0.5) * 80
    );
    crystal.scale.set(
        0.5 + Math.random(),
        0.8 + Math.random() * 0.8,
        0.5 + Math.random()
    );
    crystal.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    crystal.castShadow = true;
    crystal.receiveShadow = true;
    scene.add(crystal);
}

// ⚡ ENERGIA-ORBS (keräiltävät, korvaa kolikot)
const coins = [];
const coinGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
const coinMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffd700,
    metalness: 1.0,
    roughness: 0.1,
    emissive: 0x664400,
    emissiveIntensity: 0.2
});

function createCoin() {
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    
    // Varmista että kolikot eivät spawnaa liian lähelle alkupistettä (0,0)
    let x, z;
    do {
        x = (Math.random() - 0.5) * 60;
        z = (Math.random() - 0.5) * 60;
    } while (Math.sqrt(x*x + z*z) < 5); // Vähintään 5 yksikön päässä keskustasta
    
    coin.position.set(x, 0.5, z);
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    scene.add(coin);
    coins.push(coin);
}

// PIILOTETTU: Luo 20 kolikkoa
// for (let i = 0; i < 20; i++) {
//     createCoin();
// }

// Esteet (välttämiseen) - Parempi visuaalinen ilme
const obstacles = [];
const obstacleGeometry = new THREE.ConeGeometry(0.5, 2, 8);
const obstacleMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000,
    emissive: 0x440000,
    emissiveIntensity: 0.3,
    metalness: 0.2,
    roughness: 0.6
});

function createObstacle() {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    
    // Varmista että esteet eivät spawnaa liian lähelle alkupistettä (0,0)
    let x, z;
    do {
        x = (Math.random() - 0.5) * 60;
        z = (Math.random() - 0.5) * 60;
    } while (Math.sqrt(x*x + z*z) < 8); // Vähintään 8 yksikön päässä keskustasta
    
    obstacle.position.set(x, 1, z);
    obstacle.castShadow = true;
    scene.add(obstacle);
    obstacles.push(obstacle);
}

// PIILOTETTU: Luo 10 estettä
// for (let i = 0; i < 10; i++) {
//     createObstacle();
// }

// 🛸 VIHOLLISROBOTIT - Ladataan 3D-mallit
const enemies = [];
let enemyModelTemplate = null;

// PIILOTETTU: Luo viholliset heti fallback-geometrialla
// for (let i = 0; i < 5; i++) {
//     createFallbackEnemy();
// }

// Lataa vihollismalli ja päivitä viholliset kun valmis
loader.load('models/drone.glb', (gltf) => {
    enemyModelTemplate = gltf.scene;
    console.log('✅ Vihollismalli ladattu!');
    
    // Korvaa jokaisen vihollisen geometria mallilla
    enemies.forEach(enemy => {
        // Poista vanha geometria
        while(enemy.children.length > 0) {
            enemy.remove(enemy.children[0]);
        }
        
        // Lisää malli
        const model = enemyModelTemplate.clone();
        model.scale.set(0.8, 0.8, 0.8);
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                if (child.material) {
                    child.material = child.material.clone();
                    child.material.emissive = new THREE.Color(0xff0033);
                    child.material.emissiveIntensity = 0.5;
                }
            }
        });
        enemy.add(model);
    });
}, undefined, (error) => {
    console.error('❌ Virhe ladattaessa vihollismallia:', error);
});

function createFallbackEnemy() {
    const enemy = new THREE.Group();
    
    // Päärunko (SUURI punainen kulmikas, helposti näkyvä)
    const coreGeometry = new THREE.OctahedronGeometry(1.5, 0);
    const coreMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0033,
        emissive: 0xff0033,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.castShadow = true;
    enemy.add(core);
    enemy.core = core;
    
    console.log('🔴 Luotu vihollinen:', enemy.position);
    
    // Energia-renkaat
    const ringGeometry = new THREE.TorusGeometry(0.7, 0.05, 8, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff00ff,
        transparent: true,
        opacity: 0.7
    });
    
    const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring1.rotation.x = Math.PI / 2;
    enemy.add(ring1);
    enemy.ring1 = ring1;
    
    const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);
    ring2.rotation.y = Math.PI / 2;
    enemy.add(ring2);
    enemy.ring2 = ring2;
    
    // Varoitusvalot
    const lightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    for (let i = 0; i < 4; i++) {
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        const angle = (i / 4) * Math.PI * 2;
        light.position.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5);
        enemy.add(light);
    }
    
    // Spawn kaukana
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 10;
    enemy.position.set(
        Math.cos(angle) * distance,
        1.5,
        Math.sin(angle) * distance
    );
    
    enemy.speed = 0.05 + Math.random() * 0.03;
    enemy.floatOffset = Math.random() * Math.PI * 2;
    
    scene.add(enemy);
    enemies.push(enemy);
}

// Kamera seuraa pelaajaa
camera.position.set(0, 5, 10);
camera.lookAt(player.position);

// Näppäimistökuuntelijat
document.addEventListener('keydown', (e) => {
    // Estä Alt-näppäimen oletustoiminto (selaimen valikko)
    if (e.key === 'Alt' || e.altKey) {
        e.preventDefault();
    }
    
    switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.forward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.backward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = true;
            break;
        case 'Space':
            if (playerState.onGround) {
                keys.jump = true;
            }
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = true;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            keys.duck = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
            keys.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keys.backward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keys.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keys.right = false;
            break;
        case 'Space':
            keys.jump = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.run = false;
            break;
        case 'ControlLeft':
        case 'ControlRight':
            keys.duck = false;
            break;
    }
});

// Pointer Lock API - FPS-tyylinen hiiren ohjaus
let isPointerLocked = false;

document.addEventListener('click', () => {
    if (!isPointerLocked) {
        renderer.domElement.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
});

// Hiiren liike - tähtäys
document.addEventListener('mousemove', (e) => {
    if (isPointerLocked) {
        mouse.yaw -= e.movementX * mouse.sensitivity;
        mouse.pitch += e.movementY * mouse.sensitivity;
        
        // Rajoita pystykulmaa
        mouse.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, mouse.pitch));
    }
});

// Esto oikealle hiiren napille (context menu)
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Törmäystarkistus
function checkCollision(obj1, obj2) {
    const box1 = new THREE.Box3().setFromObject(obj1);
    const box2 = new THREE.Box3().setFromObject(obj2);
    return box1.intersectsBox(box2);
}

// Päivitä pisteet
function updateScore() {
    document.getElementById('score').textContent = gameState.score;
}

// Räjähdysefekti vihollisille
function createExplosion(position) {
    const particleCount = 20;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.08, 4, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // Satunnainen nopeus joka suuntaan
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.4,
            (Math.random() - 0.5) * 0.3
        );
        particle.life = 1.0;
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Päivitä partikkeleita
    const updateParticles = () => {
        particles.forEach((particle, index) => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.015; // Painovoima
            particle.life -= 0.03;
            particle.material.opacity = particle.life;
            
            if (particle.life <= 0) {
                scene.remove(particle);
                particles.splice(index, 1);
            }
        });
        
        if (particles.length > 0) {
            requestAnimationFrame(updateParticles);
        }
    };
    updateParticles();
}

// Partikkeliefekti kolikoille
function createCoinParticles(position) {
    const particleCount = 10;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.05, 4, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffd700,
            transparent: true,
            opacity: 1
        });
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // Satunnainen nopeus
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.3 + 0.1,
            (Math.random() - 0.5) * 0.2
        );
        particle.life = 1.0;
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Päivitä partikkeleita
    const updateParticles = () => {
        particles.forEach((particle, index) => {
            particle.position.add(particle.velocity);
            particle.velocity.y -= 0.01; // Painovoima
            particle.life -= 0.02;
            particle.material.opacity = particle.life;
            
            if (particle.life <= 0) {
                scene.remove(particle);
                particles.splice(index, 1);
            }
        });
        
        if (particles.length > 0) {
            requestAnimationFrame(updateParticles);
        }
    };
    updateParticles();
}

// Ikkunan koon muutos
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Pelin päivityssilmukka
function animate() {
    requestAnimationFrame(animate);

    if (gameState.gameOver) return;
    
    // Liikkuminen - nyt hiiren suuntaan nähden (FPS-tyyli)
    const forward = new THREE.Vector3(-Math.sin(mouse.yaw), 0, -Math.cos(mouse.yaw));
    const right = new THREE.Vector3(Math.cos(mouse.yaw), 0, -Math.sin(mouse.yaw));
    
    // Valitse nopeus: kyykistys < kävely < juoksu
    let currentSpeed = playerState.moveSpeed;
    if (keys.duck) {
        currentSpeed = playerState.duckSpeed;
    } else if (keys.run) {
        currentSpeed = playerState.runSpeed;
    }
    
    let isMoving = false;
    let moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (keys.forward) {
        player.position.x += forward.x * currentSpeed;
        player.position.z += forward.z * currentSpeed;
        moveDirection.add(forward);
        isMoving = true;
    }
    if (keys.backward) {
        player.position.x -= forward.x * currentSpeed;
        player.position.z -= forward.z * currentSpeed;
        moveDirection.sub(forward);
        isMoving = true;
    }
    if (keys.left) {
        player.position.x -= right.x * currentSpeed;
        player.position.z -= right.z * currentSpeed;
        moveDirection.sub(right);
        isMoving = true;
    }
    if (keys.right) {
        player.position.x += right.x * currentSpeed;
        player.position.z += right.z * currentSpeed;
        moveDirection.add(right);
        isMoving = true;
    }
    
    // Käännä hahmo liikkumissuuntaan
    if (isMoving && moveDirection.length() > 0) {
        const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);
        player.rotation.y = targetAngle;
    }
    
    // 🎬 ANIMAATIO - Kattava systeemi kaikille 18 animaatiolle
    // Päivitä 3D-mallin animaatiot
    if (playerMixer) {
        const delta = clock.getDelta();
        playerMixer.update(delta);
        
        // Vaihda animaatio tilan mukaan
        if (player.actions) {
            // Valitse oikea animaatio PRIORITEETIN mukaan
            let targetAnimationName = null;
            
            // 1. KUOLEMA (korkein prioriteetti - jos toteutettu)
            if (gameState.gameOver) {
                targetAnimationName = 'CharacterArmature|Death';
            }
            // 2. KYYKISTYS
            else if (keys.duck && playerState.onGround) {
                targetAnimationName = 'CharacterArmature|Duck';
            }
            // 3. HYPPY
            else if (!playerState.onGround) {
                // Nouseva hyppy
                if (playerState.velocity.y > 0) {
                    targetAnimationName = 'CharacterArmature|Jump';
                }
                // Laskeutuminen
                else {
                    targetAnimationName = 'CharacterArmature|Jump_Land';
                    if (!player.actions[targetAnimationName]) {
                        targetAnimationName = 'CharacterArmature|Jump_Idle';
                    }
                }
            }
            // 4. JUOKSU (Shift painettuna)
            else if (isMoving && keys.run) {
                targetAnimationName = 'CharacterArmature|Run_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Run';
                }
            }
            // 5. KÄVELY
            else if (isMoving) {
                targetAnimationName = 'CharacterArmature|Walk_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Walk';
                }
            }
            // 6. IDLE (paikallaan)
            else {
                targetAnimationName = 'CharacterArmature|Idle_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Idle';
                }
            }
                targetAnimationName = 'CharacterArmature|Run_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Run';
                }
            }
            // 6. KÄVELY
            else if (isMoving) {
                targetAnimationName = 'CharacterArmature|Walk_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Walk';
                }
            }
            // 7. IDLE (paikallaan)
            else {
                targetAnimationName = 'CharacterArmature|Idle_Gun';
                if (!player.actions[targetAnimationName]) {
                    targetAnimationName = 'CharacterArmature|Idle';
                }
            }
            
            // Tallenna edellinen animaatio
            if (!player.currentAnimation) {
                player.currentAnimation = targetAnimationName;
            }
            
            // Vaihda animaatiota vain jos se on eri kuin nykyinen
            if (targetAnimationName && player.actions[targetAnimationName] && targetAnimationName !== player.currentAnimation) {
                const targetAction = player.actions[targetAnimationName];
                const previousAction = player.actions[player.currentAnimation];
                
                // Pysäytä edellinen animaatio
                if (previousAction && previousAction.isRunning()) {
                    previousAction.fadeOut(0.2);
                }
                
                // Pysäytä kaikki muut (varmuuden vuoksi)
                Object.keys(player.actions).forEach(name => {
                    if (name !== targetAnimationName && player.actions[name].isRunning()) {
                        player.actions[name].fadeOut(0.1);
                    }
                });
                
                // Käynnistä uusi animaatio
                targetAction.reset().fadeIn(0.2).play();
                player.currentAnimation = targetAnimationName;
            }
            // Varmista että nykyinen animaatio on käynnissä
            else if (targetAnimationName && player.actions[targetAnimationName]) {
                const currentAction = player.actions[targetAnimationName];
                if (!currentAction.isRunning()) {
                    currentAction.reset().play();
                }
            }
        }
    }
    
    // Hyppy
    if (keys.jump && playerState.onGround) {
        playerState.velocity.y = playerState.jumpPower;
        playerState.onGround = false;
    }

    // Painovoima
    playerState.velocity.y += playerState.gravity;
    player.position.y += playerState.velocity.y;

    // Maahan osuminen
    if (player.position.y <= 0.5) {
        player.position.y = 0.5;
        playerState.velocity.y = 0;
        playerState.onGround = true;
    }

    // Rajoita pelaaja pelialueelle
    player.position.x = Math.max(-40, Math.min(40, player.position.x));
    player.position.z = Math.max(-40, Math.min(40, player.position.z));

    // PIILOTETTU: Tarkista kolikot
    // coins.forEach((coin, index) => {
    //     // Pyöritä kolikkoa
    //     coin.rotation.z += 0.05;
    //     
    //     if (checkCollision(player, coin)) {
    //         createCoinParticles(coin.position.clone());
    //         scene.remove(coin);
    //         coins.splice(index, 1);
    //         gameState.score += 10;
    //         updateScore();
    //         // Luo uusi kolikko
    //         createCoin();
    //     }
    // });

    // PIILOTETTU: Tarkista esteet
    // obstacles.forEach((obstacle) => {
    //     // Pyöritä estettä
    //     obstacle.rotation.y += 0.01;
    //     
    //     if (checkCollision(player, obstacle)) {
    //         // Peli päättyy
    //         gameState.gameOver = true;
    //         alert('Peli päättyi! Pisteet: ' + gameState.score);
    //         location.reload();
    //     }
    // });

    // Päivitä viholliset
    enemies.forEach((enemy, enemyIndex) => {
        // Laske suunta pelaajaan
        const direction = new THREE.Vector3();
        direction.subVectors(player.position, enemy.position);
        direction.y = 0; // Älä liiku Y-akselilla
        direction.normalize();
        
        // Liiku pelaajaa kohti
        enemy.position.x += direction.x * enemy.speed;
        enemy.position.z += direction.z * enemy.speed;
        
        // 🛸 DRONE-ANIMAATIOT
        // Kellunta ylös-alas
        const floatTime = Date.now() * 0.002 + enemy.floatOffset;
        enemy.position.y = 1.5 + Math.sin(floatTime) * 0.3;
        
        // Pyörivä ydin
        if (enemy.core) {
            enemy.core.rotation.x += 0.05;
            enemy.core.rotation.y += 0.05;
        }
        
        // Pyörivät energiarenkaat
        if (enemy.ring1 && enemy.ring2) {
            enemy.ring1.rotation.z += 0.08;
            enemy.ring2.rotation.x += 0.06;
        }
        
        // Tarkista törmäys pelaajaan
        if (checkCollision(player, enemy)) {
            gameState.gameOver = true;
            alert('Vihollinen sai sinut kiinni! Pisteet: ' + gameState.score);
            location.reload();
        }
    });

    // Kamera seuraa pelaajaa - Third Person Shooter tyyli
    // Over-the-shoulder asemointi
    const baseCameraDistance = mouse.isZooming ? 3 : 6; // Zoom lähemmäs
    const cameraSide = 1.5; // Kamera oikealla puolella
    const cameraHeight = 3;
    
    // Kameran asemointi hiiren ohjauksen mukaan
    const cameraOffset = new THREE.Vector3(
        Math.sin(mouse.yaw) * baseCameraDistance + cameraSide,
        cameraHeight + mouse.pitch * 2,
        Math.cos(mouse.yaw) * baseCameraDistance
    );
    
    camera.position.copy(player.position).add(cameraOffset);
    
    // Kamera tähtää hiiren suuntaan
    const lookAtPoint = new THREE.Vector3(
        player.position.x - Math.sin(mouse.yaw) * 10,
        player.position.y + 2 - mouse.pitch * 5,
        player.position.z - Math.cos(mouse.yaw) * 10
    );
    
    camera.lookAt(lookAtPoint);
    
    // FOV muuttuu zoomissa
    camera.fov = mouse.isZooming ? 50 : 75;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}

animate();
