/// <reference types="vite/client" />
import './style.css'
import * as THREE from 'three';
// Import necessary types from the SDK and generated bindings
import { Identity } from '@clockworklabs/spacetimedb-sdk';
// We need to generate these bindings first using `spacetime generate`
// import * as moduleBindings from './module_bindings'; 
// type DbConnection = moduleBindings.DbConnection; // Example, actual type comes from generated bindings

// --- SpacetimeDB Setup ---
const host = "0.0.0.0:3000"; // Replace with your SpacetimeDB host if different
const dbName = "spacetime-pong"; // Replace with your actual database name

// Placeholder type until bindings are generated
type DbConnection = any; 

function connectToSpacetimeDB() {
  console.log(`Connecting to SpacetimeDB at ${host}, database: ${dbName}...`);

  // Use DbConnection.builder() - Note: DbConnection comes from generated bindings
  const builder = (window as any).DbConnection.builder(); // Use window access temporarily

  builder
    .withUri(`ws://${host}`) // Use ws:// or wss://
    .withModuleName(dbName)
    .withToken(localStorage.getItem("identity_token") || undefined)
    .onConnect((connection: DbConnection, identity: Identity, token: string) => {
      console.log("Connected to SpacetimeDB!");
      localStorage.setItem("identity_token", token); // Save the token
      console.log("Received identity:", identity);
      console.log("Received token:", token);

      // Update UI
      const statusElement = document.querySelector('#app .card p');
      if (statusElement) {
        statusElement.textContent = "Connected! Waiting for game state...";
      }

      // Register table callbacks here later using `connection`
      // e.g., connection.db.tableName.onInsert(...);

      // Subscribe to necessary data
      // e.g., connection.subscribe(["SELECT * FROM GameState"]);
      // Using subscribeToAllTables for simplicity now, requires generated bindings
      // connection.subscribeToAllTables(); 
      console.log("Subscribing to all tables (placeholder - requires bindings)");

    })
    .onConnectError((_context: any, error: Error) => { // Explicitly type error
      console.error("Failed to connect to SpacetimeDB:", error);
      const statusElement = document.querySelector('#app .card p');
      if (statusElement) {
        statusElement.textContent = `Connection Error: ${error.message}`;
      }
    })
    .onDisconnect((_context: any, _error: Error | null) => { // Explicitly type error
        console.log("Disconnected from SpacetimeDB.");
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
          statusElement.textContent = "Disconnected.";
        }
    })
    .build();
}

// We need to wait for the generated bindings to load
// Assuming moduleBindings are loaded globally for now
// This is a temporary workaround until we structure imports properly
// after generating bindings.
// A better approach would be to dynamically import or ensure bindings
// are loaded before calling connect.
setTimeout(connectToSpacetimeDB, 100); // Delay connection slightly

// --- Three.js Setup ---
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>Spacetime Pong</h1>
    <div class="card">
      <p>Connecting to SpacetimeDB...</p> 
    </div>
  </div>
`

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111); // Dark background

// Camera
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// Lighting
const ambientLight = new THREE.AmbientLight( 0xffffff, 0.5 ); // Soft white light
scene.add( ambientLight );
const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.8 );
directionalLight.position.set( 1, 1, 1 );
scene.add( directionalLight );

// Game Elements (Placeholders)
const paddleGeometry = new THREE.BoxGeometry( 0.2, 1, 0.2 );
const ballGeometry = new THREE.SphereGeometry( 0.1, 16, 16 );
const material = new THREE.MeshStandardMaterial( { color: 0xffffff } ); // Simple white material

const leftPaddle = new THREE.Mesh( paddleGeometry, material );
leftPaddle.position.x = -3;
scene.add( leftPaddle );

const rightPaddle = new THREE.Mesh( paddleGeometry, material );
rightPaddle.position.x = 3;
scene.add( rightPaddle );

const ball = new THREE.Mesh( ballGeometry, material );
scene.add( ball );

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

    // Add game logic updates here later

	renderer.render( scene, camera );
}

animate();
