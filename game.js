import * as THREE from 'three';

// Pelin tila
const gameState = {
    score: 0,
    gameOver: false,
    speed: 0.1
};

// Näppäimistön tila
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};

// Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 0, 50);

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// Pelaaja (kuutio)
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 0.5, 0);
player.castShadow = true;
scene.add(player);

// Pelaajan fysiikka
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: true,
    jumpPower: 0.3,
    gravity: -0.02,
    moveSpeed: 0.15
};

// Maa (tasainen alusta)
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x90ee90,
    roughness: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Esteet (keräiltävät kolikot)
const coins = [];
const coinGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
const coinMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffd700,
    metalness: 0.8,
    roughness: 0.2
});

function createCoin() {
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    coin.position.set(
        (Math.random() - 0.5) * 30,
        0.5,
        (Math.random() - 0.5) * 30
    );
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    scene.add(coin);
    coins.push(coin);
}

// Luo 20 kolikkoa
for (let i = 0; i < 20; i++) {
    createCoin();
}

// Esteet (välttämiseen)
const obstacles = [];
const obstacleGeometry = new THREE.BoxGeometry(1, 2, 1);
const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

function createObstacle() {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.position.set(
        (Math.random() - 0.5) * 30,
        1,
        (Math.random() - 0.5) * 30
    );
    obstacle.castShadow = true;
    scene.add(obstacle);
    obstacles.push(obstacle);
}

// Luo 10 estettä
for (let i = 0; i < 10; i++) {
    createObstacle();
}

// Kamera seuraa pelaajaa
camera.position.set(0, 5, 10);
camera.lookAt(player.position);

// Näppäimistökuuntelijat
document.addEventListener('keydown', (e) => {
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
    }
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

    // Liikkuminen
    if (keys.forward) player.position.z -= playerState.moveSpeed;
    if (keys.backward) player.position.z += playerState.moveSpeed;
    if (keys.left) player.position.x -= playerState.moveSpeed;
    if (keys.right) player.position.x += playerState.moveSpeed;

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

    // Tarkista kolikot
    coins.forEach((coin, index) => {
        // Pyöritä kolikkoa
        coin.rotation.z += 0.05;
        
        if (checkCollision(player, coin)) {
            scene.remove(coin);
            coins.splice(index, 1);
            gameState.score += 10;
            updateScore();
            // Luo uusi kolikko
            createCoin();
        }
    });

    // Tarkista esteet
    obstacles.forEach((obstacle) => {
        // Pyöritä estettä
        obstacle.rotation.y += 0.01;
        
        if (checkCollision(player, obstacle)) {
            // Peli päättyy
            gameState.gameOver = true;
            alert('Peli päättyi! Pisteet: ' + gameState.score);
            location.reload();
        }
    });

    // Kamera seuraa pelaajaa
    const cameraOffset = new THREE.Vector3(0, 5, 10);
    camera.position.copy(player.position).add(cameraOffset);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

animate();
