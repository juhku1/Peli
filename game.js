// Babylon.js Astronaut Shooter
// Pelin tila
const gameState = {
    score: 0,
    ammo: 30,
    maxAmmo: 30,
    shootCooldown: 0,
    isRunning: false
};

// Canvas ja Engine
const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

// Luo scene
const createScene = () => {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.2, 0.3, 0.5);
    
    // Valaistus
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;
    
    // Maapohja
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 100, height: 100}, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.3);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;
    ground.checkCollisions = true;
    
    // Third-Person Kamera (kuten Fortnite!)
    const camera = new BABYLON.ArcRotateCamera(
        "camera", 
        -Math.PI / 2, // Alpha (vaakakulma)
        Math.PI / 3,  // Beta (pystykulma) 
        8,            // Etäisyys hahmosta
        new BABYLON.Vector3(0, 1.5, 0), 
        scene
    );
    camera.attachControl(canvas, true);
    
    // Kameran rajoitukset
    camera.lowerRadiusLimit = 3;  // Lähin zoom
    camera.upperRadiusLimit = 15; // Kaukaisin zoom
    camera.lowerBetaLimit = 0.1;  // Ei käänny liikaa ylös
    camera.upperBetaLimit = Math.PI / 2.2; // Ei käänny liikaa alas
    
    // Törmäykset
    camera.checkCollisions = true;
    camera.collisionRadius = new BABYLON.Vector3(0.5, 0.5, 0.5);
    
    // Hiiren herkkyys
    camera.angularSensibilityX = 2000;
    camera.angularSensibilityY = 2000;
    
    // Pelaajan placeholder (ennen kuin malli latautuu)
    let player = BABYLON.MeshBuilder.CreateCapsule("playerTemp", {height: 2, radius: 0.5}, scene);
    player.position.y = 1;
    player.isVisible = false; // Piilotetaan kun malli latautuu
    
    const playerState = {
        moveSpeed: 0.15,
        runSpeed: 0.3,
        rotation: 0
    };
    
    // Pointer Lock
    scene.onPointerDown = (evt) => {
        if (evt.button === 0) { // Vasen nappi
            engine.enterPointerlock();
            shoot(scene, camera);
        }
    };
    
    // Näppäimistö (liikuttaa hahmoa, ei kameraa)
    const keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        run: false
    };
    
    scene.onKeyboardObservable.add((kbInfo) => {
        const down = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
        
        switch(kbInfo.event.code) {
            case 'KeyW': keys.forward = down; break;
            case 'KeyS': keys.backward = down; break;
            case 'KeyA': keys.left = down; break;
            case 'KeyD': keys.right = down; break;
            case 'ShiftLeft': 
            case 'ShiftRight': 
                keys.run = down;
                break;
            case 'KeyR':
                if (down) reload();
                break;
        }
    });
    
    // Lataa astronautti
    BABYLON.SceneLoader.ImportMesh("", "models/", "astronaut.glb", scene, (meshes, particleSystems, skeletons, animationGroups) => {
        console.log("✅ Astronautti ladattu!");
        console.log("Meshit:", meshes.length);
        console.log("Animaatiot:", animationGroups.length, animationGroups.map(ag => ag.name));
        
        // Piilotetaan placeholder
        player.dispose();
        
        // Päämesha
        player = meshes[0];
        player.position = new BABYLON.Vector3(0, 0, 0);
        player.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        
        // EI liitetä kameraan - hahmo seisoo maassa!
        // Kamera seuraa hahmoa
        camera.lockedTarget = player;
        
        // Tallenna animaatiot
        scene.animations = animationGroups;
        scene.currentAnimation = null;
        
        // Käynnistä Idle-animaatio
        if (animationGroups.length > 0) {
            const idleAnim = animationGroups.find(ag => ag.name.includes('Idle_Gun')) 
                          || animationGroups.find(ag => ag.name.includes('Idle'))
                          || animationGroups[0];
            idleAnim.start(true);
            scene.currentAnimation = idleAnim;
        }
        
        // Piilota latausruutu
        document.getElementById('loading').style.display = 'none';
    });
    
    // Luo viholliset
    createEnemies(scene);
    
    // Ammukset array
    scene.projectiles = [];
    
    // Päivityssilmukka
    scene.registerBeforeRender(() => {
        // Liikuta hahmoa WASD-näppäimillä
        if (player && player.position) {
            const speed = keys.run ? playerState.runSpeed : playerState.moveSpeed;
            let isMoving = false;
            
            // Laske liikkumissuunta kameran mukaan
            const forward = new BABYLON.Vector3(
                Math.sin(camera.alpha),
                0,
                Math.cos(camera.alpha)
            );
            const right = new BABYLON.Vector3(
                Math.cos(camera.alpha),
                0,
                -Math.sin(camera.alpha)
            );
            
            if (keys.forward) {
                player.position.addInPlace(forward.scale(speed));
                isMoving = true;
            }
            if (keys.backward) {
                player.position.addInPlace(forward.scale(-speed));
                isMoving = true;
            }
            if (keys.left) {
                player.position.addInPlace(right.scale(-speed));
                isMoving = true;
            }
            if (keys.right) {
                player.position.addInPlace(right.scale(speed));
                isMoving = true;
            }
            
            // Käännä hahmo liikkumissuuntaan
            if (isMoving) {
                const moveDir = new BABYLON.Vector3(0, 0, 0);
                if (keys.forward) moveDir.addInPlace(forward);
                if (keys.backward) moveDir.addInPlace(forward.scale(-1));
                if (keys.left) moveDir.addInPlace(right.scale(-1));
                if (keys.right) moveDir.addInPlace(right);
                
                if (moveDir.length() > 0) {
                    const targetRotation = Math.atan2(moveDir.x, moveDir.z);
                    player.rotation.y = targetRotation;
                }
            }
            
            // Animaatiot
            if (scene.animations && scene.animations.length > 0) {
                let targetAnim = null;
                
                if (isMoving && keys.run) {
                    targetAnim = scene.animations.find(ag => ag.name.includes('Run_Gun')) 
                              || scene.animations.find(ag => ag.name.includes('Run'));
                } else if (isMoving) {
                    targetAnim = scene.animations.find(ag => ag.name.includes('Walk_Gun')) 
                              || scene.animations.find(ag => ag.name.includes('Walk'));
                } else {
                    targetAnim = scene.animations.find(ag => ag.name.includes('Idle_Gun')) 
                              || scene.animations.find(ag => ag.name.includes('Idle'));
                }
                
                if (targetAnim && targetAnim !== scene.currentAnimation) {
                    if (scene.currentAnimation) scene.currentAnimation.stop();
                    targetAnim.start(true);
                    scene.currentAnimation = targetAnim;
                }
            }
        }
        
        // Päivitä cooldown
        if (gameState.shootCooldown > 0) {
            gameState.shootCooldown--;
        }
        
        // Päivitä ammukset
        scene.projectiles.forEach((proj, index) => {
            proj.life--;
            proj.position.addInPlace(proj.velocity);
            
            // Poista vanha ammus
            if (proj.life <= 0) {
                proj.dispose();
                scene.projectiles.splice(index, 1);
                return;
            }
            
            // Tarkista osumat vihollisiin
            scene.enemies.forEach((enemy, enemyIndex) => {
                if (enemy && proj.intersectsMesh(enemy, false)) {
                    // Osuma!
                    createExplosion(scene, enemy.position.clone());
                    enemy.dispose();
                    scene.enemies.splice(enemyIndex, 1);
                    proj.dispose();
                    scene.projectiles.splice(index, 1);
                    
                    gameState.score += 100;
                    updateScore();
                }
            });
        });
        
        // Päivitä FPS
        document.getElementById('fps').textContent = engine.getFps().toFixed(0);
    });
    
    return scene;
};

// Ampumisfunktio
function shoot(scene, camera) {
    if (gameState.shootCooldown > 0 || gameState.ammo <= 0) return;
    
    gameState.ammo--;
    gameState.shootCooldown = 10; // 10 framea
    
    // Luo ammus
    const projectile = BABYLON.MeshBuilder.CreateSphere("projectile", {diameter: 0.2}, scene);
    const projMat = new BABYLON.StandardMaterial("projMat", scene);
    projMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
    projectile.material = projMat;
    
    // Aseta ammuksen paikka kameran eteen
    projectile.position = camera.position.clone();
    projectile.position.y += 0.2; // Hieman ylemmäs
    
    // Laske suunta kameran mukaan
    const forward = camera.getDirection(BABYLON.Axis.Z);
    projectile.velocity = forward.scale(2); // Nopeus
    projectile.life = 90; // Frames
    
    // Lisää listaan
    scene.projectiles.push(projectile);
    
    // Muzzle flash
    const light = new BABYLON.PointLight("flash", projectile.position, scene);
    light.intensity = 10;
    light.diffuse = new BABYLON.Color3(1, 0.8, 0);
    setTimeout(() => light.dispose(), 50);
    
    updateAmmo();
    console.log("🔫 Pum! Ammuksia:", gameState.ammo);
}

// Luo viholliset
function createEnemies(scene) {
    scene.enemies = [];
    
    for (let i = 0; i < 5; i++) {
        const enemy = BABYLON.MeshBuilder.CreateBox("enemy", {size: 1}, scene);
        const enemyMat = new BABYLON.StandardMaterial("enemyMat", scene);
        enemyMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
        enemyMat.emissiveColor = new BABYLON.Color3(0.3, 0, 0);
        enemy.material = enemyMat;
        
        // Satunnainen paikka
        enemy.position = new BABYLON.Vector3(
            Math.random() * 30 - 15,
            0.5,
            Math.random() * 30 - 15
        );
        
        scene.enemies.push(enemy);
    }
}

// Räjähdysefekti
function createExplosion(scene, position) {
    const particleSystem = new BABYLON.ParticleSystem("particles", 50, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/playground/public/textures/flare.png", scene);
    
    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.2, 0, -0.2);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.2, 0, 0.2);
    
    particleSystem.color1 = new BABYLON.Color4(1, 0.5, 0, 1);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;
    
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.5;
    
    particleSystem.emitRate = 100;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);
    
    particleSystem.direction1 = new BABYLON.Vector3(-1, 1, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 1, 1);
    
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;
    
    particleSystem.minEmitPower = 2;
    particleSystem.maxEmitPower = 4;
    particleSystem.updateSpeed = 0.01;
    
    particleSystem.start();
    
    setTimeout(() => {
        particleSystem.stop();
        setTimeout(() => particleSystem.dispose(), 1000);
    }, 200);
}

// Lataa ammukset
function reload() {
    gameState.ammo = gameState.maxAmmo;
    updateAmmo();
    console.log("🔄 Ladattu!");
}

// Päivitä UI
function updateAmmo() {
    document.getElementById('ammo').textContent = `${gameState.ammo}/${gameState.maxAmmo}`;
}

function updateScore() {
    document.getElementById('score').textContent = gameState.score;
}

// Luo scene ja käynnistä
const scene = createScene();

// Render loop
engine.runRenderLoop(() => {
    scene.render();
});

// Ikkunan koon muutos
window.addEventListener('resize', () => {
    engine.resize();
});

console.log("🎮 Babylon.js Astronaut Shooter käynnistetty!");
console.log("Klikkaa aloittaaksesi peli");
