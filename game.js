import * as THREE from 'three';

// Pelin tila
const gameState = {
    score: 0,
    gameOver: false,
    speed: 0.1,
    kills: 0,
    ammo: 30,
    maxAmmo: 30,
    reloading: false,
    canShoot: true,
    shootCooldown: 0
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
    shoot: false
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

// Pelaaja (coolampi robottihahmo)
const player = new THREE.Group();

// Vartalo
const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00aa00,
    metalness: 0.3,
    roughness: 0.4
});
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.castShadow = true;
player.add(body);

// Pää
const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
const headMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ff00,
    metalness: 0.5,
    roughness: 0.3,
    emissive: 0x003300
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.position.y = 0.6;
head.castShadow = true;
player.add(head);

// Silmät (hehkuvat)
const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
const eyeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
});
const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(-0.1, 0.65, 0.2);
player.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
rightEye.position.set(0.1, 0.65, 0.2);
player.add(rightEye);

// ASE - Yksinkertainen kivääri
const weapon = new THREE.Group();

// Aseen runko (musta)
const weaponBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.15, 0.8),
    new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.8,
        roughness: 0.2
    })
);
weapon.add(weaponBody);

// Piippu (sinertävä)
const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8),
    new THREE.MeshStandardMaterial({ 
        color: 0x2a2a3a,
        metalness: 0.9,
        roughness: 0.1
    })
);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0, -0.65);
weapon.add(barrel);

// Kahva
const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.1),
    new THREE.MeshStandardMaterial({ 
        color: 0x3a2a1a,
        roughness: 0.8
    })
);
grip.position.set(0, -0.15, 0.1);
weapon.add(grip);

// Aseta ase pelaajan oikealle puolelle
weapon.position.set(0.25, 0.3, -0.3);
weapon.rotation.y = -0.2;
player.add(weapon);

// Tallenna viite aseeseen
player.weapon = weapon;

player.position.set(0, 0.5, 0);
scene.add(player);

// Pelaajan fysiikka
const playerState = {
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: true,
    jumpPower: 0.3,
    gravity: -0.02,
    moveSpeed: 0.15
};

// Maa (teksturoitu ruoho-efekti)
const groundGeometry = new THREE.PlaneGeometry(100, 100, 50, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a7c3a,
    roughness: 0.9,
    metalness: 0.0
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;

// Lisää epätasaisuutta maahan
const positions = ground.geometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
    const y = Math.random() * 0.3;
    positions.setZ(i, y);
}
positions.needsUpdate = true;
ground.geometry.computeVertexNormals();

scene.add(ground);

// Taustamaisema - Puut
function createTree(x, z) {
    const tree = new THREE.Group();
    
    // Runko
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8b4513,
        roughness: 0.9
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // Latvus (3 kerrosta)
    const foliageGeometry = new THREE.ConeGeometry(1.2, 2, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5016,
        roughness: 0.8
    });
    
    for (let i = 0; i < 3; i++) {
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 2.5 + i * 0.6;
        foliage.scale.setScalar(1 - i * 0.2);
        foliage.castShadow = true;
        tree.add(foliage);
    }
    
    tree.position.set(x, 0, z);
    return tree;
}

// Luo puita reunoille
for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const distance = 35 + Math.random() * 10;
    const tree = createTree(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance
    );
    scene.add(tree);
}

// Kivet
const rockGeometry = new THREE.DodecahedronGeometry(0.5, 0);
const rockMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    roughness: 1.0,
    metalness: 0.0
});

for (let i = 0; i < 15; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(
        (Math.random() - 0.5) * 80,
        0.3,
        (Math.random() - 0.5) * 80
    );
    rock.scale.set(
        0.5 + Math.random(),
        0.5 + Math.random() * 0.5,
        0.5 + Math.random()
    );
    rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
}

// Esteet (keräiltävät kolikot) - Parannettu ulkoasu
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

// Viholliset (jahtaavat pelaajaa) - Pelottavampi ulkoasu
const enemies = [];
const enemyGeometry = new THREE.IcosahedronGeometry(0.5, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff00ff,
    emissive: 0xff00ff,
    emissiveIntensity: 0.5,
    metalness: 0.8,
    roughness: 0.2,
    wireframe: false
});

function createEnemy() {
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    // Spawn vihollisia kaukana pelaajasta
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 10;
    enemy.position.set(
        Math.cos(angle) * distance,
        0.5,
        Math.sin(angle) * distance
    );
    enemy.castShadow = true;
    enemy.speed = 0.05 + Math.random() * 0.03; // Vaihtelevia nopeuksia
    scene.add(enemy);
    enemies.push(enemy);
}

// Luo 5 vihollista
for (let i = 0; i < 5; i++) {
    createEnemy();
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
        case 'KeyR':
            reload();
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
        mouse.pitch += e.movementY * mouse.sensitivity; // Korjattu: + eikä -
        
        // Rajoita pystykulmaa (ei voi katsoa liikaa ylös/alas)
        mouse.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, mouse.pitch));
    }
});

// Hiiren klikkaus - Ammu!
document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !gameState.gameOver) { // Vasen nappi
        shoot();
    } else if (e.button === 2) { // Oikea nappi - Zoom
        e.preventDefault();
        mouse.isZooming = true;
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 2) { // Oikea nappi - lopeta zoom
        e.preventDefault();
        mouse.isZooming = false;
    }
});

// Esto oikealle hiiren napille (context menu)
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Ammunta
function shoot() {
    // Tarkista voiko ampua
    if (!gameState.canShoot || gameState.reloading || gameState.ammo <= 0) {
        if (gameState.ammo <= 0 && !gameState.reloading) {
            reload();
        }
        return;
    }
    
    const projectileGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff
    });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    // 1. TÄHTÄYS: Raycasting kameran keskeltä (crosshair osoittaa tänne)
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Tarkista osuuko johonkin objektiin
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Tähtäyspiste: joko osuma tai 1000 yksikköä kameran suuntaan
    const aimPoint = new THREE.Vector3();
    if (intersects.length > 0) {
        // Osui johonkin - käytä osumapistettä
        aimPoint.copy(intersects[0].point);
    } else {
        // Ei osumaa - tähtää kauas eteenpäin
        raycaster.ray.at(1000, aimPoint);
    }
    
    // 2. ASEEN PIIPUN SIJAINTI maailmankoordinaateissa
    // Lasketaan piipun pää oikein aseen transformaation kautta
    const barrelTip = new THREE.Vector3(0, 0, -0.9);
    player.weapon.localToWorld(barrelTip);
    
    // Ammus lähtee piipun päästä
    projectile.position.copy(barrelTip);
    
    // 3. SUUNTA: Piipusta kohti tähtäyspistettä
    const direction = new THREE.Vector3();
    direction.subVectors(aimPoint, barrelTip).normalize();
    
    projectile.velocity = direction.multiplyScalar(1.2); // Hieman nopeampi
    projectile.life = 150;
    
    scene.add(projectile);
    projectiles.push(projectile);
    
    // Muzzle flash piipun päässä
    const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(barrelTip);
    scene.add(flash);
    
    // Poista flash nopeasti
    setTimeout(() => {
        flash.material.opacity = 0.5;
        setTimeout(() => {
            scene.remove(flash);
        }, 50);
    }, 50);
    
    // Vähennä ammuksia
    gameState.ammo--;
    updateAmmo();
    
    // Cooldown seuraavaan ampumiseen
    gameState.canShoot = false;
    gameState.shootCooldown = 5; // 5 framea
}

// Lataa ammukset
function reload() {
    if (gameState.reloading) return;
    
    gameState.reloading = true;
    
    setTimeout(() => {
        gameState.ammo = gameState.maxAmmo;
        gameState.reloading = false;
        updateAmmo();
    }, 1500); // 1.5 sekuntia
}

// Päivitä ammusnäyttö
function updateAmmo() {
    const ammoElement = document.getElementById('ammo');
    if (ammoElement) {
        if (gameState.reloading) {
            ammoElement.textContent = 'Ladataan...';
        } else {
            ammoElement.textContent = gameState.ammo + '/' + gameState.maxAmmo;
        }
    }
}

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
    
    // Päivitä shoot cooldown
    if (gameState.shootCooldown > 0) {
        gameState.shootCooldown--;
        if (gameState.shootCooldown === 0) {
            gameState.canShoot = true;
        }
    }

    // Liikkuminen - nyt hiiren suuntaan nähden (FPS-tyyli)
    const forward = new THREE.Vector3(-Math.sin(mouse.yaw), 0, -Math.cos(mouse.yaw));
    const right = new THREE.Vector3(Math.cos(mouse.yaw), 0, -Math.sin(mouse.yaw));
    
    if (keys.forward) {
        player.position.x += forward.x * playerState.moveSpeed;
        player.position.z += forward.z * playerState.moveSpeed;
    }
    if (keys.backward) {
        player.position.x -= forward.x * playerState.moveSpeed;
        player.position.z -= forward.z * playerState.moveSpeed;
    }
    if (keys.left) {
        player.position.x -= right.x * playerState.moveSpeed;
        player.position.z -= right.z * playerState.moveSpeed;
    }
    if (keys.right) {
        player.position.x += right.x * playerState.moveSpeed;
        player.position.z += right.z * playerState.moveSpeed;
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

    // Tarkista kolikot
    coins.forEach((coin, index) => {
        // Pyöritä kolikkoa
        coin.rotation.z += 0.05;
        
        if (checkCollision(player, coin)) {
            createCoinParticles(coin.position.clone());
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
        
        // Pyöritä vihollista
        enemy.rotation.y += 0.1;
        
        // Tarkista törmäys pelaajaan
        if (checkCollision(player, enemy)) {
            gameState.gameOver = true;
            alert('Vihollinen sai sinut kiinni! Pisteet: ' + gameState.score);
            location.reload();
        }
    });

    // Päivitä ammukset
    projectiles.forEach((projectile, projIndex) => {
        projectile.position.add(projectile.velocity);
        projectile.life--;
        
        // Poista vanhat ammukset
        if (projectile.life <= 0) {
            scene.remove(projectile);
            projectiles.splice(projIndex, 1);
            return;
        }
        
        // Tarkista törmäys vihollisiin
        enemies.forEach((enemy, enemyIndex) => {
            if (checkCollision(projectile, enemy)) {
                // Luo räjähdysefekti
                createExplosion(enemy.position.clone());
                
                // Poista vihollinen ja ammus
                scene.remove(enemy);
                enemies.splice(enemyIndex, 1);
                scene.remove(projectile);
                projectiles.splice(projIndex, 1);
                
                // Lisää pisteitä
                gameState.score += 50;
                gameState.kills++;
                updateScore();
                
                // Luo uusi vihollinen
                createEnemy();
            }
        });
        
        // Tarkista törmäys esteisiin (ammukset pomppii pois)
        obstacles.forEach((obstacle) => {
            if (checkCollision(projectile, obstacle)) {
                scene.remove(projectile);
                projectiles.splice(projIndex, 1);
            }
        });
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
