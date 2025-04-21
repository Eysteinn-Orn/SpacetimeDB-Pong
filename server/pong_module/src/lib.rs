use spacetimedb::{table, reducer, Table, ReducerContext, Identity, Timestamp, log, ScheduleAt, TimeDuration, SpacetimeType, rand::Rng}; // Removed DbResult

// Game constants
const PADDLE_HEIGHT: f32 = 1.0;
const PADDLE_WIDTH: f32 = 0.2; // Need a width for collision detection now
const COURT_HEIGHT: f32 = 5.0;
const COURT_WIDTH: f32 = 10.0;
const BALL_RADIUS: f32 = 0.1;
const PADDLE_X_OFFSET: f32 = COURT_WIDTH / 2.0 - 0.5; // How far paddles are from center (approximate)
const TICK_RATE_MS: i64 = 16; // ~60 FPS

#[table(name = game_state, public)]
pub struct GameState {
    #[primary_key]
    #[auto_inc]
    pub singleton_id: u32,
    pub score1: u32, // Score for side 1 (left)
    pub score2: u32, // Score for side 2 (right)
    pub status: GameStatus,
    pub last_update: Timestamp,
}

#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub enum GameStatus {
    Waiting, // Maybe start here until enough players?
    Playing,
    Paused,
    Finished,
}

// Tracks which side each player belongs to
#[table(name = player_info, public)]
pub struct PlayerInfo {
    #[primary_key]
    pub player_id: Identity,
    pub side: u8, // 1 for left (odd connect order), 2 for right (even connect order)
}

// Stores individual player's paddle position
#[table(name = player_input, public)]
pub struct PlayerInput {
    #[primary_key]
    pub player_id: Identity,
    pub paddle_y: f32, // Current Y position of this player's paddle
    pub last_update: Timestamp,
}

#[table(name = ball, public)]
pub struct Ball {
    #[primary_key]
    #[auto_inc]
    pub singleton_id: u32,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
}

#[table(name = game_tick_schedule, scheduled(game_tick))]
pub struct GameTickSchedule {
    #[primary_key] #[auto_inc] pub id: u64,
    pub scheduled_at: ScheduleAt,
}

#[spacetimedb(init)]
pub fn init(ctx: &ReducerContext) {
    // Initialize game state, ball, and schedule tick
    ensure_game_exists(ctx);

    // Schedule the first game tick
    ctx.schedule_game_tick(GameTickSchedule {
        id: 0,
        scheduled_at: TimeDuration::from_micros(TICK_RATE_MS).into(),
    });
    log::info!("Scheduled initial game tick.");
}

// Initialize game state, ball, and schedule tick
fn ensure_game_exists(ctx: &ReducerContext) {
    let mut game_initialized = false;
    if ctx.db.game_state().iter().count() == 0 {
        ctx.db.game_state().insert(GameState {
            singleton_id: 0,
            score1: 0,
            score2: 0,
            status: GameStatus::Playing, // Or Waiting
            last_update: ctx.timestamp,
        });
        log::info!("Initialized GameState");
        game_initialized = true;
    }
    if ctx.db.ball().iter().count() == 0 {
         ctx.db.ball().insert(Ball {
            singleton_id: 0,
            x: 0.0,
            y: 0.0,
            vx: 0.05,
            vy: 0.02,
        });
        log::info!("Initialized Ball");
    }

    // Schedule the game tick if it hasn't been scheduled
    if game_initialized && ctx.db.game_tick_schedule().iter().count() == 0 {
         ctx.db.game_tick_schedule().insert(GameTickSchedule {
            id: 0,
            scheduled_at: TimeDuration::from_micros(TICK_RATE_MS).into(),
        });
        log::info!("Scheduled game tick");
    }
}

#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    ensure_game_exists(ctx);
    let new_player_id = ctx.sender;

    if ctx.db.player_info().player_id().find(&new_player_id).is_some() {
        log::warn!("Player {:?} already connected.", new_player_id);
        return; // Just return early
    }

    let current_player_count = ctx.db.player_info().iter().count();
    let assigned_side = (current_player_count % 2 + 1) as u8;

    // Insert operations - framework handles potential failure
    ctx.db.player_info().insert(PlayerInfo {
        player_id: new_player_id,
        side: assigned_side,
    });

    ctx.db.player_input().insert(PlayerInput {
        player_id: new_player_id,
        paddle_y: 0.0,
        last_update: ctx.timestamp, // Use ctx.timestamp here if needed
    });

    log::info!("Player {:?} connected and assigned to side {}", new_player_id, assigned_side);

    // No explicit Ok(()) needed
}

#[reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) { // Remove _timestamp: Timestamp
    let disconnected_player_id = ctx.sender;

    // Use delete which returns bool, indicating if deletion happened
    if ctx.db.player_info().player_id().delete(&disconnected_player_id) {
         ctx.db.player_input().player_id().delete(&disconnected_player_id); // Also delete input
         log::info!("Player {:?} disconnected.", disconnected_player_id);
    } else {
        log::warn!("Disconnect event for player {:?} who wasn't in PlayerInfo.", disconnected_player_id);
    }
    // No explicit Ok(()) needed
}

#[reducer]
pub fn move_paddle(ctx: &ReducerContext, new_y: f32) {
    let player_id = ctx.sender;

    if let Some(mut player_input) = ctx.db.player_input().player_id().find(&player_id) {
        let half_paddle = PADDLE_HEIGHT / 2.0;
        let court_limit = COURT_HEIGHT / 2.0;
        let clamped_y = new_y.max(-court_limit + half_paddle).min(court_limit - half_paddle);

        player_input.paddle_y = clamped_y;
        player_input.last_update = ctx.timestamp;
        ctx.db.player_input().player_id().update(player_input); // Update - framework handles potential failure
        // No explicit Ok(()) needed
    } else {
        // Log error instead of returning Err
        log::warn!("Player {:?} input not found in move_paddle. May have disconnected.", player_id);
    }
}

#[reducer]
fn game_tick(ctx: &ReducerContext, _args: GameTickSchedule) {
    if ctx.sender != ctx.identity() {
        // Log error and return early
        log::error!("game_tick called by non-scheduler identity: {:?}", ctx.sender);
        return;
    }

    let mut game_state = match ctx.db.game_state().iter().next() {
        Some(gs) => gs,
        None => {
            // Log error and return early
            log::error!("GameState not found in game_tick.");
            return;
        }
    };

    if game_state.status != GameStatus::Playing {
        return; // Just return if not playing
    }

    // --- Update Ball Position & Collisions ---
    if let Some(mut ball) = ctx.db.ball().iter().next() {
        let mut scored = false;
        let mut hit_paddle = false; // Track if a hit occurred this tick

        // Store original position for collision response
        let old_ball_x = ball.x;

        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;

        let half_court_h = COURT_HEIGHT / 2.0;
        let half_court_w = COURT_WIDTH / 2.0;
        let half_paddle_h = PADDLE_HEIGHT / 2.0;
        let half_paddle_w = PADDLE_WIDTH / 2.0; // Use paddle width

        // Wall collisions (top/bottom)
        if ball.y + BALL_RADIUS > half_court_h || ball.y - BALL_RADIUS < -half_court_h {
            ball.vy = -ball.vy;
            ball.y = ball.y.max(-half_court_h + BALL_RADIUS).min(half_court_h - BALL_RADIUS);
        }

        // Paddle collisions - Check against ALL paddles on the relevant side
        let paddle_x_left = -PADDLE_X_OFFSET; // Center X of left paddles
        let paddle_x_right = PADDLE_X_OFFSET; // Center X of right paddles

        // Check side 1 (left) if ball moving left and crossing the paddle line
        if ball.vx < 0.0 && old_ball_x > paddle_x_left && ball.x - BALL_RADIUS <= paddle_x_left + half_paddle_w {
            // Find all players on side 1
            for player_info in ctx.db.player_info().iter().filter(|p| p.side == 1) {
                 if let Some(player_input) = ctx.db.player_input().player_id().find(&player_info.player_id) {
                     // Check Y overlap
                     if ball.y + BALL_RADIUS > player_input.paddle_y - half_paddle_h &&
                        ball.y - BALL_RADIUS < player_input.paddle_y + half_paddle_h {
                         // Collision detected!
                         ball.vx = -ball.vx;
                         ball.x = paddle_x_left + half_paddle_w + BALL_RADIUS; // Prevent sticking
                         hit_paddle = true;
                         break; // Only allow one hit per tick
                     }
                 }
            }
        }
        // Check side 2 (right) if ball moving right and crossing the paddle line
        else if ball.vx > 0.0 && old_ball_x < paddle_x_right && ball.x + BALL_RADIUS >= paddle_x_right - half_paddle_w {
             // Find all players on side 2
             for player_info in ctx.db.player_info().iter().filter(|p| p.side == 2) {
                 if let Some(player_input) = ctx.db.player_input().player_id().find(&player_info.player_id) {
                     // Check Y overlap
                     if ball.y + BALL_RADIUS > player_input.paddle_y - half_paddle_h &&
                        ball.y - BALL_RADIUS < player_input.paddle_y + half_paddle_h {
                         // Collision detected!
                         ball.vx = -ball.vx;
                         ball.x = paddle_x_right - half_paddle_w - BALL_RADIUS; // Prevent sticking
                         hit_paddle = true;
                         break; // Only allow one hit per tick
                     }
                 }
            }
        }

        // Scoring (only if no paddle was hit this tick)
        if !hit_paddle {
            if ball.x - BALL_RADIUS < -half_court_w { // Player 2 scores
                game_state.score2 += 1;
                log::info!("Side 2 scored! Score: {} - {}", game_state.score1, game_state.score2);
                scored = true;
            } else if ball.x + BALL_RADIUS > half_court_w { // Player 1 scores
                game_state.score1 += 1;
                log::info!("Side 1 scored! Score: {} - {}", game_state.score1, game_state.score2);
                scored = true;
            }
        }

        if scored {
            // Reset ball
            ball.x = 0.0;
            ball.y = 0.0;
            ball.vx = if ball.vx > 0.0 { -0.05 } else { 0.05 }; // Start towards loser
            ball.vy = if ctx.rng().gen_bool(0.5) { 0.02 } else { -0.02 };
            game_state.last_update = ctx.timestamp;
            ctx.db.game_state().singleton_id().update(game_state); // Update - framework handles potential failure
        }

        // Update ball state
        ctx.db.ball().singleton_id().update(ball); // Update - framework handles potential failure

    } else {
         log::error!("Ball not found in game_tick!");
    }
}
