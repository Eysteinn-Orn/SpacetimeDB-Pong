/// <reference types="vite/client" />
import './style.css'
import * as THREE from 'three';
// Import generated bindings and necessary SDK types
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { GameState } from './module_bindings/game_state_type';
import { PlayerInput } from './module_bindings/player_input_type';
import { Ball } from './module_bindings/ball_type';
// Import EventContext, SubscriptionEventContext, ErrorContext from generated bindings
import { DbConnection, EventContext, SubscriptionEventContext, ErrorContext } from './module_bindings/index';

  
// --- SpacetimeDB Setup ---
const host = "localhost:3000"; // SpacetimeDB host
const dbName = "spacetime-pong"; // Database name used during publish

// Store the connection globally or pass it around
let spacetimedbConnection: DbConnection | null = null;

function connectToSpacetimeDB() {
  console.log(`Connecting to SpacetimeDB at ${host}, database: ${dbName}...`);

  const builder = DbConnection.builder();

  builder
    .withUri(`ws://${host}`)
    .withModuleName(dbName)
    .withToken(localStorage.getItem("auth_token") || '') // Use auth_token consistently
    .onConnect((connection: DbConnection, identity: Identity, token: string) => {
      console.log("Connected to SpacetimeDB!");
      localStorage.setItem("auth_token", token);
      console.log("My Identity:", identity.toHexString()); // Log identity hex string
      console.log("Received token:", token);

      spacetimedbConnection = connection; // Store the connection

      // Update UI
      const statusElement = document.querySelector('#app .card p');
      if (statusElement) {
        statusElement.textContent = "Connected! Subscribing to game state...";
      }

      // Register table callbacks *before* subscribing
      registerTableCallbacks(connection);

      // Subscribe to all tables using the builder with callbacks
      connection.subscriptionBuilder()
        .onApplied((_ctx: SubscriptionEventContext) => { // Use SubscriptionEventContext
            console.log("Successfully subscribed to all tables.");
             if (statusElement) {
                statusElement.textContent = "Subscribed! Waiting for players...";
             }
        })
        .onError((_ctx: ErrorContext) => { // Use ErrorContext
            const error = (_ctx as any).error || new Error(String((_ctx as any).message || 'Unknown subscription error'));
            console.error("Subscription failed:", error);
             if (statusElement) {
                statusElement.textContent = `Subscription Error: ${error.message}`;
             }
        })
        .subscribeToAllTables(); // This call likely returns void

    })
    .onConnectError((_context: ErrorContext, error: Error) => { // Use ErrorContext
      console.error("Failed to connect to SpacetimeDB:", error);
      const statusElement = document.querySelector('#app .card p');
      if (statusElement) {
        statusElement.textContent = `Connection Error: ${error.message}`;
      }
    })
    .onDisconnect((_context: ErrorContext, error?: Error | undefined) => { // Correct error type: Error | undefined
        console.log("Disconnected from SpacetimeDB.", error ? `Reason: ${error.message}` : '');
        spacetimedbConnection = null; // Clear connection
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
          statusElement.textContent = "Disconnected.";
        }
    })
    .build();
}

function registerTableCallbacks(connection: DbConnection) {
    console.log("Registering table callbacks...");

    // GameState Callbacks
    connection.db.gameState.onInsert((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Insert:", ctx.event.tag, gameState);
        // Update scores, player assignments etc. in UI/Three.js later
    });
    connection.db.gameState.onUpdate((ctx: EventContext, oldGameState: GameState, newGameState: GameState) => {
        console.log("GameState Update:", ctx.event.tag, oldGameState, "->", newGameState);
        // Update scores, player assignments etc. in UI/Three.js later
    });
     connection.db.gameState.onDelete((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Delete:", ctx.event.tag, gameState);
        // Handle game reset or unexpected deletion
    });

    // PlayerInput Callbacks
    connection.db.playerInput.onInsert((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Insert:", ctx.event.tag, playerInput);
        // Create or update paddle position in Three.js later
    });
    connection.db.playerInput.onUpdate((ctx: EventContext, oldPlayerInput: PlayerInput, newPlayerInput: PlayerInput) => {
        console.log("PlayerInput Update:", ctx.event.tag, oldPlayerInput, "->", newPlayerInput);
        // Update paddle position in Three.js later
    });
    connection.db.playerInput.onDelete((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Delete:", ctx.event.tag, playerInput);
        // Remove paddle from Three.js later
    });

    // Ball Callbacks
    connection.db.ball.onInsert((ctx: EventContext, ball: Ball) => {
        console.log("Ball Insert:", ctx.event.tag, ball);
        // Update ball position in Three.js later
    });
    connection.db.ball.onUpdate((ctx: EventContext, oldBall: Ball, newBall: Ball) => {
        console.log("Ball Update:", ctx.event.tag, oldBall, "->", newBall);
        // Update ball position in Three.js later
    });
     connection.db.ball.onDelete((ctx: EventContext, ball: Ball) => {
        console.log("Ball Delete:", ctx.event.tag, ball);
        // Handle ball removal/reset
    });

    console.log("Callbacks registered.");
}

// Function to call the move_paddle reducer
function sendPaddleMove(y: number) {
    if (spacetimedbConnection) {
        console.log(`Sending move_paddle: y=${y}`);
        spacetimedbConnection.reducers.movePaddle(y);
    } else {
        console.warn("Cannot send paddle move: Not connected to SpacetimeDB.");
    }
}

// --- Start Connection ---
// No need for setTimeout anymore, bindings are imported directly
connectToSpacetimeDB();


// --- Three.js Setup ---
// Remove the initial innerHTML setup, let Three.js manage the body
// document.querySelector<HTMLDivElement>('#app')!.innerHTML = ` ... `

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
// Append renderer directly to body, assuming #app is removed or unused
document.body.appendChild( renderer.domElement );

// Lighting
const ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 );
scene.add( ambientLight );
const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.8 );
directionalLight.position.set( 1, 1, 1 );
scene.add( directionalLight );

// Game Elements Management
// Use Maps to store game objects managed by SpacetimeDB
const paddles = new Map<string, THREE.Mesh>(); // Key: Identity Hex String
let ballMesh: THREE.Mesh | null = null; // Only one ball

const paddleGeometry = new THREE.BoxGeometry( 0.2, 1, 0.2 );
const ballGeometry = new THREE.SphereGeometry( 0.1, 16, 16 );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff } );

// We will create/update/delete meshes in the SpacetimeDB callbacks now

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
    // Assumes camera is at z=5 looking towards origin, court height is 5
    const courtHeight = 5;
    const y = -(event.clientY / window.innerHeight - 0.5) * courtHeight;
    sendPaddleMove(y);
});
