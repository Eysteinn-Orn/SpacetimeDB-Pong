import Matter from 'matter-js';
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
import './style.css';
import { Identity } from '@clockworklabs/spacetimedb-sdk';


// --- HUD Helper ---
const hudElement = document.getElementById('hud');

function updateHUD(text: string) {
    if (hudElement) {
        hudElement.textContent = text;
    } else {
        console.warn("HUD element not found!");
    }
}

// --- Coordinate System Mapping ---
// Server: Origin at center, X: -5 to 5, Y: -2.5 to 2.5
// Matter.js: Origin at top-left, X: 0 to WORLD_WIDTH, Y: 0 to WORLD_HEIGHT

// Game world dimensions (in pixels)
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 400;

// Server game constants (from lib.rs)
const SERVER_COURT_WIDTH = 10.0;
const SERVER_COURT_HEIGHT = 5.0;
const SERVER_PADDLE_HEIGHT = 1.0;
const SERVER_PADDLE_WIDTH = 0.2;
const SERVER_BALL_RADIUS = 0.1;
const SERVER_PADDLE_X_OFFSET = SERVER_COURT_WIDTH / 2.0 - 0.5; // 4.5

// Scaling factors
const SCALE_X = WORLD_WIDTH / SERVER_COURT_WIDTH;
const SCALE_Y = WORLD_HEIGHT / SERVER_COURT_HEIGHT;

// Matter.js dimensions
const PADDLE_WIDTH = SERVER_PADDLE_WIDTH * SCALE_X;
const PADDLE_HEIGHT = SERVER_PADDLE_HEIGHT * SCALE_Y;
const BALL_RADIUS = SERVER_BALL_RADIUS * SCALE_X; // Using X scale to keep it round
const WALL_THICKNESS = 50; // Thickness for invisible walls

// Coordinate conversion functions
function serverToMatterX(x: number): number {
    return (x + SERVER_COURT_WIDTH/2) * SCALE_X;
}

function serverToMatterY(y: number): number {
    return (y + SERVER_COURT_HEIGHT/2) * SCALE_Y;
}

function matterToServerX(x: number): number {
    return (x / SCALE_X) - SERVER_COURT_WIDTH/2;
}

function matterToServerY(y: number): number {
    return (y / SCALE_Y) - SERVER_COURT_HEIGHT/2;
}

// --- Matter.js Setup ---
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Body = Matter.Body;

// Create engine
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0; // No gravity for Pong

// Create renderer
const renderElement = document.getElementById('game-canvas') || document.body;

const render = Render.create({
    element: renderElement,
    engine: engine,
    options: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        wireframes: true, // Show shapes filled
        background: '#111111'
    }
});

// Add walls (top, bottom) - make them static
Composite.add(world, [
    // Top wall
    Bodies.rectangle(WORLD_WIDTH / 2, -WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, { 
        isStatic: true, 
        render: { visible: false } 
    }),
    // Bottom wall
    Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT + WALL_THICKNESS / 2, WORLD_WIDTH, WALL_THICKNESS, { 
        isStatic: true, 
        render: { visible: false } 
    })
]);

// Run the renderer
Render.run(render);

// Create runner
const runner = Runner.create();

// Run the engine
Runner.run(runner, engine);
console.log("Matter.js engine and renderer started.");


// Game Elements Management (using Matter.js Bodies)
const paddles = new Map<string, Matter.Body>(); // Key: Identity Hex String
let ballBody: Matter.Body | null = null; // Only one ball


// --- Helper Functions ---
function findPlayerInfo(connection: DbConnection, playerId: Identity) {
    return Array.from(connection.db.playerInfo.iter()).find(p => p.playerId.isEqual(playerId));
}

// --- SpacetimeDB Callbacks & Registration ---

function registerTableCallbacks(connection: DbConnection) {
    console.log("Registering table callbacks...");

    // GameState Callbacks
    connection.db.gameState.onInsert((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Insert:", ctx.event.tag, gameState);
        updateHUD(`Score: ${gameState.score1} - ${gameState.score2}`);
    });
    connection.db.gameState.onUpdate((ctx: EventContext, oldGameState: GameState, newGameState: GameState) => {
        console.log("GameState Update:", ctx.event.tag, oldGameState, "->", newGameState);
        updateHUD(`Score: ${newGameState.score1} - ${newGameState.score2}`);
    });
    connection.db.gameState.onDelete((ctx: EventContext, gameState: GameState) => {
        console.log("GameState Delete:", ctx.event.tag, gameState);
        updateHUD("Game Resetting...");
    });

    // PlayerInput Callbacks
    connection.db.playerInput.onInsert((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Insert:", ctx.event.tag, playerInput);
        const playerIdHex = playerInput.playerId.toHexString();
        let paddle = paddles.get(playerIdHex);
        if (!paddle) {
            // Find player side info
            const playerInfo = findPlayerInfo(connection, playerInput.playerId);
            
            // Determine paddle X position based on side
            const serverPaddleX = playerInfo?.side === 1 
                ? -SERVER_PADDLE_X_OFFSET  // Left side (-4.5)
                : SERVER_PADDLE_X_OFFSET;  // Right side (4.5)
            
            // Convert server coordinates to Matter.js coordinates
            const matterX = serverToMatterX(serverPaddleX);
            const matterY = serverToMatterY(playerInput.paddleY);

            paddle = Bodies.rectangle(matterX, matterY, PADDLE_WIDTH, PADDLE_HEIGHT, {
                isStatic: true, // Paddles don't react to physics
                label: `paddle_${playerIdHex}`,
                render: { fillStyle: '#FFFFFF' } // White paddles
            });

            paddles.set(playerIdHex, paddle);
            Composite.add(world, paddle);
            console.log(`Created paddle body for ${playerIdHex} at (${matterX}, ${matterY})`);
        } else {
            // If paddle already exists, just update its position
            const matterY = serverToMatterY(playerInput.paddleY);
            Body.setPosition(paddle, { x: paddle.position.x, y: matterY });
        }
    });
    connection.db.playerInput.onUpdate((ctx: EventContext, oldPlayerInput: PlayerInput, newPlayerInput: PlayerInput) => {
        console.log("PlayerInput Update:", ctx.event.tag, oldPlayerInput, "->", newPlayerInput);
        const playerIdHex = newPlayerInput.playerId.toHexString();
        const paddle = paddles.get(playerIdHex);
        if (paddle) {
            const matterY = serverToMatterY(newPlayerInput.paddleY);
            Body.setPosition(paddle, { x: paddle.position.x, y: matterY });
        } else {
            console.warn(`Received PlayerInput update for unknown player: ${playerIdHex}`);
        }
    });
    connection.db.playerInput.onDelete((ctx: EventContext, playerInput: PlayerInput) => {
        console.log("PlayerInput Delete:", ctx.event.tag, playerInput);
        const playerIdHex = playerInput.playerId.toHexString();
        const paddle = paddles.get(playerIdHex);
        if (paddle) {
            Composite.remove(world, paddle);
            paddles.delete(playerIdHex);
            console.log(`Removed paddle body for ${playerIdHex}`);
        }
    });

    // Ball Callbacks
    connection.db.ball.onInsert((ctx: EventContext, ball: Ball) => {
        console.log("Ball Insert:", ctx.event.tag, ball);
        if (!ballBody) {
            // Convert server coordinates to Matter.js coordinates
            const matterX = serverToMatterX(ball.x);
            const matterY = serverToMatterY(ball.y);

            ballBody = Bodies.circle(matterX, matterY, BALL_RADIUS, {
                label: 'ball',
                restitution: 1, // Bouncy
                friction: 0, // No friction
                frictionAir: 0, // No air resistance
                frictionStatic: 0, // No static friction
                render: { fillStyle: '#FFFFFF' } // White ball
            });
            Composite.add(world, ballBody);
            console.log(`Created ball body at (${matterX}, ${matterY})`);
        } else {
            // If ball exists, just update position
            const matterX = serverToMatterX(ball.x);
            const matterY = serverToMatterY(ball.y);
            Body.setPosition(ballBody, { x: matterX, y: matterY });
            // Reset velocity since server dictates position
            Body.setVelocity(ballBody, { x: 0, y: 0 });
        }
    });
    connection.db.ball.onUpdate((ctx: EventContext, oldBall: Ball, newBall: Ball) => {
        console.log("Ball Update:", ctx.event.tag, oldBall, "->", newBall);
        if (ballBody) {
            // Convert server coordinates to Matter.js coordinates
            const matterX = serverToMatterX(newBall.x);
            const matterY = serverToMatterY(newBall.y);

            // Set position as server is the source of truth
            Body.setPosition(ballBody, { x: matterX, y: matterY });
            // Reset velocity to avoid conflicts with server
            Body.setVelocity(ballBody, { x: 0, y: 0 });
        } else {
            console.warn("Received Ball update but ball body doesn't exist.");
        }
    });
    connection.db.ball.onDelete((ctx: EventContext, ball: Ball) => {
        console.log("Ball Delete:", ctx.event.tag, ball);
        if (ballBody) {
            Composite.remove(world, ballBody);
            ballBody = null; // Allow recreation on next insert
            console.log("Removed ball body");
        }
    });

    console.log("Callbacks registered.");
}

// Function to call the move_paddle reducer
function sendPaddleMove(y: number) {
    if (spacetimedbConnection) {
        // Convert Matter.js Y coordinate to server Y coordinate before sending
        const serverY = matterToServerY(y);
        spacetimedbConnection.reducers.movePaddle(serverY);
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

        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = "Connected! Subscribing to game state...";
        }
        updateHUD("Connected. Waiting for game...");

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
        const statusElement = document.querySelector('#app .card p');
        if (statusElement) {
            statusElement.textContent = "Disconnected.";
        }
        updateHUD("Disconnected.");
        // Clean up Matter.js bodies on disconnect
        paddles.forEach(paddle => Composite.remove(world, paddle));
        paddles.clear();
        if (ballBody) {
            Composite.remove(world, ballBody);
            ballBody = null;
        }
    }
});
// Throttle function to limit the frequency of updates
function throttle(func: (...args: any[]) => void, limit: number) {
    let inThrottle: boolean;
    let lastFunc: number | undefined;
    let lastRan: number;
    return function(this: any, ...args: any[]) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    // If there was a call during the throttle period, run it now
                    clearTimeout(lastFunc);
                    lastFunc = undefined;
                    func.apply(context, args); // Use the latest args
                    lastRan = Date.now();
                    inThrottle = true; // Re-enter throttle after the trailing call
                     setTimeout(() => inThrottle = false, limit);
                }
            }, limit);
        } else {

            // If the function was called during the throttle period, store the last call time
            lastFunc = Date.now();
            if (lastFunc - lastRan >= limit) {
                func.apply(context, args); // Call the function with the latest args
                lastRan = Date.now(); // Update lastRan to the current time
            }
            inThrottle = true; // Re-enter throttle after the trailing call

            setTimeout(() => inThrottle = false, limit); // Reset throttle after the limit
        }
    }
}


// Use throttle instead of debounce
const handleMouseMove = throttle((event: MouseEvent) => {
    // Convert mouse Y to Matter.js world Y coordinate
    const canvasBounds = render.canvas.getBoundingClientRect();
    const mouseY = event.clientY - canvasBounds.top;

    // Clamp Y to world bounds (minus half paddle height)
    const minY = PADDLE_HEIGHT / 2;
    const maxY = WORLD_HEIGHT - PADDLE_HEIGHT / 2;
    const clampedY = Math.max(minY, Math.min(maxY, mouseY));

    sendPaddleMove(clampedY);
}, 8); // Throttle interval (16ms for ~60fps)

// Add mouse move listener to the canvas
render.canvas.addEventListener('mousemove', handleMouseMove);


// --- Cleanup ---
// Stop the runner and renderer on window unload
window.addEventListener('beforeunload', () => {
    console.log("Stopping Matter.js runner and renderer.");
    Runner.stop(runner);
    Render.stop(render);

    paddles.forEach(paddle => Composite.remove(world, paddle));
    paddles.clear();
    if (ballBody) {
        Composite.remove(world, ballBody);
        ballBody = null;
    }
    console.log("Matter.js cleanup done.");
});

