/// <reference types="vite/client" />
import './style.css'
import * as THREE from 'three';
// Import generated bindings and necessary SDK types
import { GameState } from './module_bindings/game_state_type';
import { PlayerInput } from './module_bindings/player_input_type';
import { Ball } from './module_bindings/ball_type';
// Import SpacetimeDB connection logic and types needed for callbacks
import { 
    initializeSpacetimeDB, 
    spacetimedbConnection // Import the exported variable directly if preferred
} from './spacetimedb'; 
import { 
    DbConnection, 
    EventContext 
} from './module_bindings/index';


// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
const ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
scene.add( ambientLight );
const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.8 );
directionalLight.position.set( 1, 1, 1 );
scene.add( directionalLight );

// Game Elements Management
const paddles = new Map<string, THREE.Mesh>(); // Key: Identity Hex String
let ballMesh: THREE.Mesh | null = null; // Only one ball
const paddleGeometry = new THREE.BoxGeometry( 0.2, 1, 0.2 );
const ballGeometry = new THREE.SphereGeometry( 0.1, 16, 16 );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );


// --- SpacetimeDB Callbacks & Registration ---

function registerTableCallbacks(connection: DbConnection) {
    console.log("Registering table callbacks...");

    // GameState Callbacks
    connection.db.gameState.onInsert((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Insert:", ctx.event.tag, gameState);
        // TODO: Update scores, player assignments etc. in UI/Three.js
    });
    connection.db.gameState.onUpdate((ctx: EventContext, oldGameState: GameState, newGameState: GameState) => {
        console.log("GameState Update:", ctx.event.tag, oldGameState, "->", newGameState);
        // TODO: Update scores, player assignments etc. in UI/Three.js 
    });
     connection.db.gameState.onDelete((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Delete:", ctx.event.tag, gameState);
        // TODO: Handle game reset or unexpected deletion
    });

    // PlayerInput Callbacks
    connection.db.playerInput.onInsert((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Insert:", ctx.event.tag, playerInput);
        const playerIdHex = playerInput.playerId.toHexString(); 
        let paddle = paddles.get(playerIdHex);
        if (!paddle) {
            paddle = new THREE.Mesh(paddleGeometry, material);
            // Iterate through PlayerInfo to find the matching player
            // Note: This might be inefficient for large numbers of players.
            // Consider optimizing on the server-side if needed.
            const playerInfo = Array.from(connection.db.playerInfo.iter()).find(p => p.playerId.isEqual(playerInput.playerId));
            paddle.position.x = playerInfo?.side === 1 ? -4 : 4; 
            paddles.set(playerIdHex, paddle);
            scene.add(paddle);
            console.log(`Created paddle for ${playerIdHex}`);
        }
        paddle.position.y = playerInput.paddleY;
    });
    connection.db.playerInput.onUpdate((ctx: EventContext, oldPlayerInput: PlayerInput, newPlayerInput: PlayerInput) => {
        console.log("PlayerInput Update:", ctx.event.tag, oldPlayerInput, "->", newPlayerInput);
        // Update paddle position in Three.js
        const playerIdHex = newPlayerInput.playerId.toHexString();
        const paddle = paddles.get(playerIdHex);
        if (paddle) {
            paddle.position.y = newPlayerInput.paddleY;
        } else {
             console.warn(`Received PlayerInput update for unknown player: ${playerIdHex}`);
             // Optionally, handle creation here if insert was missed (race condition?)
        }
    });
    connection.db.playerInput.onDelete((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Delete:", ctx.event.tag, playerInput);
        // Remove paddle from Three.js
         const playerIdHex = playerInput.playerId.toHexString();
         const paddle = paddles.get(playerIdHex);
         if (paddle) {
             scene.remove(paddle);
             paddles.delete(playerIdHex);
             console.log(`Removed paddle for ${playerIdHex}`);
         }
    });

    // Ball Callbacks
    connection.db.ball.onInsert((ctx: EventContext, ball: Ball) => {
        console.log("Ball Insert:", ctx.event.tag, ball);
        if (!ballMesh) {
            ballMesh = new THREE.Mesh(ballGeometry, material);
            scene.add(ballMesh);
            console.log("Created ball mesh");
        }
        // Use ball.x and ball.y based on Ball type definition
        ballMesh.position.set(ball.x, ball.y, 0); 
    });
    connection.db.ball.onUpdate((ctx: EventContext, oldBall: Ball, newBall: Ball) => {
        console.log("Ball Update:", ctx.event.tag, oldBall, "->", newBall);
        if (ballMesh) {
            // Use newBall.x and newBall.y based on Ball type definition
            ballMesh.position.set(newBall.x, newBall.y, 0);
        } else {
            console.warn("Received Ball update but ball mesh doesn't exist.");
        }
    });
     connection.db.ball.onDelete((ctx: EventContext, ball: Ball) => {
        console.log("Ball Delete:", ctx.event.tag, ball);
        // Handle ball removal/reset
        if (ballMesh) {
            scene.remove(ballMesh);
            ballMesh = null; // Allow recreation on next insert
            console.log("Removed ball mesh");
        }
    });

    console.log("Callbacks registered.");
}

// Function to call the move_paddle reducer (uses imported connection)
function sendPaddleMove(y: number) {
    // Use the imported connection variable directly
    if (spacetimedbConnection) { 
        // console.log(`Sending move_paddle: y=${y}`); // Reduce console noise
        spacetimedbConnection.reducers.movePaddle(y);
    } else {
        console.warn("Cannot send paddle move: Not connected to SpacetimeDB.");
    }
}


// --- Start Connection ---
initializeSpacetimeDB({
    onConnect: (connection, identity, token) => {
        console.log("Connected to SpacetimeDB!");
        localStorage.setItem("auth_token", token);
        console.log("My Identity:", identity.toHexString());
        console.log("Received token:", token);

        // Update UI
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = "Connected! Subscribing to game state...";
        }

        // Register table callbacks *after* connection and *before* subscription applied
        registerTableCallbacks(connection); 
    },
    onSubscriptionApplied: (_ctx) => {
        console.log("Successfully subscribed to all tables.");
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = "Subscribed! Waiting for players...";
        }
    },
    onSubscriptionError: (_ctx) => {
        const error = (_ctx as any).error || new Error(String((_ctx as any).message || 'Unknown subscription error'));
        console.error("Subscription failed:", error);
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = `Subscription Error: ${error.message}`;
        }
    },
    onConnectError: (_context, error) => {
        console.error("Failed to connect to SpacetimeDB:", error);
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = `Connection Error: ${error.message}`;
        }
    },
    onDisconnect: (_context, error) => {
        console.log("Disconnected from SpacetimeDB.", error ? `Reason: ${error.message}` : '');
        // spacetimedbConnection is set to null internally by initializeSpacetimeDB
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = "Disconnected.";
        }
    }
});


// --- Three.js Setup & Animation Loop ---

// Handle Window Resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation Loop
function animate() {
    requestAnimationFrame( animate );
    // Game logic updates driven by SpacetimeDB callbacks will update mesh positions.
    // The animation loop just needs to render the current state.
    renderer.render( scene, camera );
}

animate();

// Example: Hook up mouse movement to sendPaddleMove (basic)
window.addEventListener('mousemove', (event) => {
    // Convert mouse Y to world Y coordinates (simple example, needs refinement)
    // Assumes camera is at z=5 looking towards origin, court height is ~ +/- 2.5
    const courtHeight = 10; // Visual height in world units
    const y = -(event.clientY / window.innerHeight - 0.5) * courtHeight;
    // Clamp y to prevent paddle going too far off-screen?
    // const paddleMaxY = courtHeight / 2 - (paddleGeometry.parameters.height / 2);
    // const clampedY = Math.max(-paddleMaxY, Math.min(paddleMaxY, y));
    sendPaddleMove(y); // Send unclamped y for now
});
