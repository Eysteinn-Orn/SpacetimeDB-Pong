use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp};

// Game constants (adjust as needed)
const MAX_PLAYERS: u8 = 2;
const PADDLE_HEIGHT: f32 = 1.0; // Corresponds to Three.js geometry size
const COURT_HEIGHT: f32 = 5.0; // Example vertical boundary

#[table(name = game_state, public)] // Make public so clients can see game state
pub struct GameState {
    #[primary_key]
    #[auto_inc] // Use auto_inc for singleton pattern simplicity
    pub singleton_id: u32,
    pub player1: Option<Identity>,
    pub player2: Option<Identity>,
    pub score1: u32,
    pub score2: u32,
    // Add game status later (e.g., Waiting, Playing, Finished)
}

#[table(name = player_input, public)] // Make public so clients can see opponent paddle
pub struct PlayerInput {
    #[primary_key]
    pub player_id: Identity,
    pub paddle_y: f32, // Desired Y position
    pub last_update: Timestamp,
}

#[table(name = ball, public)] // Make public so clients can see the ball
pub struct Ball {
    #[primary_key]
    #[auto_inc] // Use auto_inc for singleton pattern simplicity
    pub singleton_id: u32,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
}

// Initialize game state if it doesn't exist
fn ensure_game_state_exists(ctx: &ReducerContext) {
    // Check if any GameState row exists (more robust than checking for ID 0 with auto_inc)
    if ctx.db.game_state().iter().count() == 0 {
        ctx.db.game_state().insert(GameState {
            singleton_id: 0, // auto_inc will assign the actual ID
            player1: None,
            player2: None,
            score1: 0,
            score2: 0,
        });
        log::info!("Initialized GameState");
    }
    // Check if any Ball row exists
    if ctx.db.ball().iter().count() == 0 {
         ctx.db.ball().insert(Ball {
            singleton_id: 0, // auto_inc will assign the actual ID
            x: 0.0,
            y: 0.0,
            vx: 0.05, // Example initial velocity
            vy: 0.02, // Example initial velocity
        });
        log::info!("Initialized Ball");
    }
}

// Use the specific lifecycle reducer attribute
#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext, _timestamp: Timestamp) {
    ensure_game_state_exists(ctx);
    // Fetch the singleton GameState (assuming only one row due to ensure_game_state_exists)
    let mut current_state = ctx.db.game_state().iter().next().expect("GameState exists");
    let new_player_id = ctx.sender;

    let mut player_slot_assigned = false;

    if current_state.player1.is_none() {
        current_state.player1 = Some(new_player_id);
        log::info!("Player {:?} assigned to slot 1", new_player_id);
        player_slot_assigned = true;
    } else if current_state.player2.is_none() && current_state.player1 != Some(new_player_id) {
         current_state.player2 = Some(new_player_id);
         log::info!("Player {:?} assigned to slot 2", new_player_id);
         player_slot_assigned = true;
    } else {
         log::warn!("Player {:?} connected but no slots available or already connected.", new_player_id);
         // Handle spectator logic or rejection later if needed
    }

    if player_slot_assigned {
        // Initialize player input state using the table handle
        ctx.db.player_input().insert(PlayerInput {
            player_id: new_player_id,
            paddle_y: 0.0, // Start in the middle
            last_update: ctx.timestamp,
        }); // Insert returns the struct, not a Result/Option

        ctx.db.game_state()
            .singleton_id()
            .update(current_state); // Update using the primary key handle
    }
}

// Use the specific lifecycle reducer attribute
#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext, _timestamp: Timestamp) {
    // Fetch the singleton GameState
    if let Some(mut current_state) = ctx.db.game_state().iter().next() {
        let disconnected_player_id = ctx.sender;
        let mut state_changed = false;

        if current_state.player1 == Some(disconnected_player_id) {
            current_state.player1 = None;
            log::info!("Player {:?} (slot 1) disconnected", disconnected_player_id);
            state_changed = true;
        } else if current_state.player2 == Some(disconnected_player_id) {
            current_state.player2 = None;
            log::info!("Player {:?} (slot 2) disconnected", disconnected_player_id);
            state_changed = true;
        }

        if state_changed {
            // Remove player input entry using the primary key handle
            // Note: filter_by_player_id returns an Option<PlayerInput>, delete requires the key directly
            // We can use the primary key handle's delete method.
            ctx.db.player_input().player_id().delete(&disconnected_player_id);

            // Update game state using the primary key handle
            ctx.db.game_state().singleton_id().update(current_state);
        }
    } else {
        // This case should ideally not happen if ensure_game_state_exists works correctly
        log::warn!("Disconnect event for user {:?} but GameState not found.", ctx.sender);
    }
}

#[reducer]
pub fn move_paddle(ctx: &ReducerContext, new_y: f32) -> Result<(), String> {
    let player_id = ctx.sender;

    // Clamp paddle position within bounds
    let half_paddle = PADDLE_HEIGHT / 2.0;
    let court_limit = COURT_HEIGHT / 2.0; // Assuming court centered at 0
    let clamped_y = new_y.max(-court_limit + half_paddle).min(court_limit - half_paddle);

    // Fetch the player input using the primary key handle's find method
    if let Some(mut player_input) = ctx.db.player_input().player_id().find(&player_id) {
        player_input.paddle_y = clamped_y;
        player_input.last_update = ctx.timestamp;
        // Update using the primary key handle
        ctx.db.player_input().player_id().update(player_input);
        Ok(())
    } else {
        // Use DbResult::Err for reducer errors
        Err(format!("Player {:?} not found or not assigned a slot.", player_id))
    }
}

// We will add the game loop / tick reducer later
