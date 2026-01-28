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
    
    // FPS Kamera (Babylon.js valmis!)
    const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 1.7, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    // Kameran asetukset
    camera.speed = 0.5;
    camera.angularSensibility = 2000;
    camera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5); // Collision capsule
    camera.checkCollisions = true;
    camera.applyGravity = true;
    
    // WASD-liikkuminen
    camera.keysUp = [87]; // W
    camera.keysDown = [83]; // S
    camera.keysLeft = [65]; // A
    camera.keysRight = [68]; // D
    
    // Pointer Lock
    scene.onPointerDown = (evt) => {
        if (evt.button === 0) { // Vasen nappi
            engine.enterPointerlock();
            shoot(scene, camera);
        }
    };
    
    // Näppäimistö
    scene.onKeyboardObservable.add((kbInfo) => {
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            if (kbInfo.event.key === 'r' || kbInfo.event.key === 'R') {
                reload();
            }
            // Shift = juoksu
            if (kbInfo.event.key === 'Shift') {
                camera.speed = 1.0;
            }
        }
        if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
            if (kbInfo.event.key === 'Shift') {
                camera.speed = 0.5;
            }
        }
    });
    
    // Lataa astronautti
    BABYLON.SceneLoader.ImportMesh("", "models/", "astronaut.glb", scene, (meshes, particleSystems, skeletons, animationGroups) => {
        console.log("✅ Astronautti ladattu!");
        console.log("Meshit:", meshes.length);
        console.log("Animaatiot:", animationGroups.length, animationGroups.map(ag => ag.name));
        
        // Päämesha
        const astronaut = meshes[0];
        astronaut.position = new BABYLON.Vector3(0, 0, 0);
        astronaut.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
        
        // Liitä kameraan (first person)
        astronaut.parent = camera;
        astronaut.position = new BABYLON.Vector3(0, -1.5, 0.5);
        
        // Käynnistä Idle-animaatio
        if (animationGroups.length > 0) {
            const idleAnim = animationGroups.find(ag => ag.name.includes('Idle_Gun')) 
                          || animationGroups.find(ag => ag.name.includes('Idle'))
                          || animationGroups[0];
            idleAnim.start(true);
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
